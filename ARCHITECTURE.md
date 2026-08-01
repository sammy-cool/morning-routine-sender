# Architecture

This document goes one level deeper than `README.md`'s structure table — it
covers _why_ the code is organized this way, how requests actually flow
through it, and design decisions/tradeoffs worth knowing before you change
something.

## Layering

```
index.js  (composition root)
   │
   ├── middleware/        cross-cutting concerns (rate limiting, request context)
   ├── routes/             path → controller wiring, no logic
   ├── controllers/        the actual logic for each route
   ├── config/              shared singletons (DB, Redis, SMTP transporter, env check)
   └── email-core/         domain logic: scheduling, sending, tracking
```

The rule of thumb: **routes know paths, controllers know logic, config
knows connections.** If you're adding a new endpoint, you're touching
`routes/*.routes.js` (one line) and `controllers/*.controller.js` (the
actual work) — `index.js` itself should rarely need to change.

This split follows Express's own guidance to keep route declaration
separate from route logic once an app grows past a handful of endpoints —
`index.js` was 576 lines with all 18 routes inline before this cleanup; it's
stayed under 140 lines since, even as new route groups (subscriber
management, the self-service portal, public signup) were added — new
features mean new files under `routes/`/`controllers/`, not growth in
`index.js` itself.

## Request flow: a scheduled email send

```
emailScheduler.js (node-cron fires)
        │
        ▼
config/mailTransporter.js  ──fetches──▶  config/email-config.js (builds/validates SMTP transporter)
        │
        ▼
email-core/emailService.js  (compiles email-templates/*.mjml with data from helper/shared-data.js)
        │
        ▼
Nodemailer sends
        │
        ▼
email-core/emailTracker.js  (records result → Postgres: email_tracker / job_last_run tables)
```

The manual trigger routes (`POST /send-test-email`, `POST /send-bulk-now`,
in `controllers/email.controller.js`) call into this same chain starting
from `emailService`/`emailScheduler` directly — cron and manual triggers
are two entry points into one pipeline, not two separate implementations.

## Request flow: admin authentication

No sessions — short-lived, one-time Redis keys instead:

```
GET /generate-admin-key  (requires ADMIN_KEY header/query)
        │  generates random key, stores in Redis with 5-min TTL
        ▼
POST /verify-admin-key  OR  POST /secret-jobs-scheduler
        │  looks up key in Redis, deletes it immediately (one-time use)
        ▼
verify-admin-key → sets mrn_role=admin cookie
secret-jobs-scheduler → starts/stops cron jobs directly
```

`GET /admin-dashboard` and the `/` root route both check the `mrn_role`
cookie before deciding what to serve — see `controllers/pages.controller.js`.

## Subscriber management (admin-facing)

Subscribers live in a `subscribers` table (email, cron pattern, timezone,
template type, active flag), replacing what used to be a hardcoded array of
real email addresses committed directly to source control. Full CRUD is
available at `/admin/subscribers` (`controllers/subscribers.controller.js`),
gated by `middleware/requireAdmin.js` — a real auth check (`mrn_role=admin`
cookie), not the unauthenticated pattern some of the older `/admin/*` routes
still use. `helper/validateSubscriber.js` holds validation shared between
this controller and the self-service one below, so the rules (valid email,
real cron syntax via `node-cron`'s own validator, one of the actual
template types that exist in `email-templates/`) can't drift between the
two.

## Request flow: subscriber self-service (magic-link login)

No passwords — a subscriber is just an email address, so login is a
short-lived, single-use link, structurally similar to the admin one-time-key
flow but backed by a longer-lived session afterward:

```
POST /login  { email }
        │  looks up email in `subscribers`; ALWAYS responds with the same
        │  generic message either way (prevents email enumeration)
        │  if found: random token → Redis (15 min TTL) → emails a link
        ▼
GET /verify-login?token=...
        │  redeems the token (one-time use, deleted immediately)
        ▼
   createSession() — NOT a plain cookie holding the email. A random
   opaque session token is stored in the cookie; the actual email lives
   server-side in Redis, keyed by that token (30-day TTL). A subscriber's
   identity is never something a client could forge just by editing their
   own cookie.
        ▼
GET /me, GET /me/history, PATCH /me
        │  gated by middleware/subscriberSession.js's requireSubscriberSession,
        │  which resolves the session token → email and attaches it to
        │  req.subscriberEmail. Every self-service endpoint scopes to
        │  *that* email only — there is no way to pass a different email
        │  in in the request and act on someone else's subscription.
```

`GET /user-dashboard` (`controllers/pages.controller.js`) checks this same
session before serving the page — deliberately via a **lazy `require()`**
inside the function rather than a top-level import, since a top-level
import would pull in `config/redisClient.js` (a real Redis connection
attempt) on every load of this module, including tests that only exercise
unrelated functions like `/health`.

## Request flow: public signup (double opt-in)

```
POST /subscribe  { email, cronPattern?, timezone? }
        │  real validation errors (bad email format, invalid cron) →
        │  actual 400 responses -- this doesn't leak subscriber existence,
        │  only whether the submitted input itself is well-formed
        │  if the email is ALREADY subscribed: same generic response as
        │  the "not found" case, no email sent (enumeration-safe)
        │  otherwise: random token → Redis (24h TTL) → emails a
        │  confirmation link
        ▼
GET /confirm-subscription?token=...
        │  redeems the token, calls addUser(), fires the welcome email
        │  (not awaited -- a slow/failed welcome email shouldn't block
        │  the signup itself), then immediately creates a session via
        │  the exact same createSession() used by /verify-login
        ▼
redirects straight to /user-dashboard, already logged in
```

Deliberately double opt-in rather than "type an email, get subscribed
immediately": a single-step flow would let anyone subscribe someone
_else's_ address without their consent. The confirmation click doubles as
first login, which is why there's one welcome-email trigger point instead
of two separate "first signup" and "first login" code paths.

### Unsubscribe

`GET /unsubscribe?email=...&token=...` (`controllers/email.controller.js`)
actually updates the subscriber's row (`setUserActive(email, false)`) —
this used to call a browser-DOM toast-notification function from
server-side code and silently do nothing to the database at all. The
`token` is a stateless HMAC of the email (`helper/unsubscribeToken.js`,
`UNSUBSCRIBE_SECRET` env var, falls back to `ADMIN_KEY` if unset) rather
than a Redis-backed one-time token like login/signup — unsubscribe links
are embedded in every routine email and need to keep working indefinitely,
not expire like a login link should. Verified with
`crypto.timingSafeEqual` rather than `===`, so a wrong guess can't be
brute-forced faster by its rejection timing. Without this token, anyone
who knew (or guessed) another subscriber's email could unsubscribe them
just by visiting the URL.

## Shared singletons, and why they're separate modules

Three pieces of app-wide state used to live as module-scoped variables
directly inside `index.js`, which made them inaccessible once routes moved
into their own files. Each now has one home:

| State                             | Lives in                     | Used by                                                                                                                     |
| --------------------------------- | ---------------------------- | --------------------------------------------------------------------------------------------------------------------------- |
| Redis connection                  | `config/redisClient.js`      | `controllers/auth.controller.js`, `subscriberAuth.controller.js`, `signup.controller.js`, `middleware/subscriberSession.js` |
| SMTP transporter (lazy singleton) | `config/mailTransporter.js`  | `controllers/email.controller.js`, `subscriberAuth.controller.js`, `signup.controller.js`, `index.js` (graceful shutdown)   |
| Rate limiter                      | `middleware/rateLimiters.js` | `admin.routes.js`, `email.routes.js`, `subscriberPortal.routes.js`                                                          |

Each is created once, on first `require()`, and reused everywhere it's
imported (Node's module cache makes this a natural singleton — no extra
DI framework needed for a project this size).

## Known design tradeoffs (not bugs — deliberate or pre-existing decisions)

- **~~`config/redis-config.js` vs `config/redisClient.js`~~ — resolved.**
  Consolidated into one `config/redisClient.js`: kept the single-URL
  connection style (right choice for a managed provider like Render Redis),
  absorbed `USE_MOCK_REDIS` support and retry backoff from the file that
  used to be dead code. `REDIS_LEAP_URL` (the old Leapcell-era var name) is
  still checked as a fallback if `REDIS_URL` isn't set, with a warning —
  remove that fallback once the env var is renamed on Render.
- **~~`helper/read-db.js` used a separate DB connection~~ — resolved.**
  Now reuses the shared Knex instance from `db/knex.js` instead of its own
  `pg.Client` (which was pointed at a dead `DATABASE_URL` from before the
  Render Postgres migration).
- **node-cron over BullMQ**: this project used to have a parallel BullMQ-based
  queue system (removed in the dead-code cleanup pass). node-cron is what's
  actually live. If job volume grows to the point where retries, backoff,
  or multiple workers matter, BullMQ is the natural next step — but
  re-introduce it deliberately, not as leftover half-wired code.
- **Content-Security-Policy uses `'unsafe-inline'`** for `script-src` and
  `style-src`. An audit of `public/`/`admin-renderer/` found 30+ inline
  `onclick`/`onchange` handlers (mostly `admin-dashboard.html`) plus inline
  `<script>`/`<style>` blocks. A strict CSP without `'unsafe-inline'` would
  break these today. This CSP still meaningfully restricts which external
  origins can be loaded from (`cdn.jsdelivr.net`, Google Fonts, and
  `cdnjs.cloudflare.com` are the only allowlisted external sources — all
  verified against actual usage, not guessed) and blocks clickjacking via
  `frame-ancestors`, but it does not defend against inline-script-based
  XSS specifically. Removing `'unsafe-inline'` would mean converting every
  inline handler to `addEventListener()` across 6 HTML files — a real,
  separate project if tightened further.

## Testing strategy

`__tests__/` covers pure functions and mock-based controller/route tests —
no live DB/Redis/SMTP connections required, so the suite is fast and
deterministic. This required deliberately mocking every transitive
dependency that would otherwise open a real connection, including some
non-obvious ones caught the hard way: `routes/subscriberPortal.routes.js`
pulls in `me.controller.js` → `emailTracker.js` → `db/knex.js`, and
`email.controller.js` pulls in `emailScheduler.js` →
`database-cleanup.js` → `db/knex.js` — both real-DB paths that don't go
through `helper/shared-data.js` and so need their own explicit mocks.

Also worth knowing if a future test file behaves strangely:
`middleware/rateLimiters.js`'s `sendEmailLimiter` is a shared singleton
whose internal per-IP request counter persists for the _entire test
process_, not per test or per file. With `ALLOWED_RATE_LIMITER` unset,
`express-rate-limit` defaults to `max: 5` — so a test file that calls a
rate-limited route (like `/login` or `/subscribe`) more than 5 times
across its whole suite will start getting silently blocked with a real
`429`, with zero indication why an assertion three tests later suddenly
fails. Mock `middleware/rateLimiters.js` as a pass-through
(`(req, res, next) => next()`) in any test file that exercises these
routes more than a few times.
