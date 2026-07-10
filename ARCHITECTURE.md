# Architecture

This document goes one level deeper than `README.md`'s structure table — it
covers *why* the code is organized this way, how requests actually flow
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
122 lines now.

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

## Shared singletons, and why they're separate modules

Three pieces of app-wide state used to live as module-scoped variables
directly inside `index.js`, which made them inaccessible once routes moved
into their own files. Each now has one home:

| State | Lives in | Used by |
|---|---|---|
| Redis connection | `config/redisClient.js` | `controllers/auth.controller.js` |
| SMTP transporter (lazy singleton) | `config/mailTransporter.js` | `controllers/email.controller.js`, `index.js` (graceful shutdown) |
| Rate limiter | `middleware/rateLimiters.js` | `admin.routes.js`, `email.routes.js` |

Each is created once, on first `require()`, and reused everywhere it's
imported (Node's module cache makes this a natural singleton — no extra
DI framework needed for a project this size).

## Known design tradeoffs (not bugs — deliberate or pre-existing decisions)

- **`config/redis-config.js` vs `config/redisClient.js`**: two separate
  ways of building a Redis connection exist in the codebase. `redisClient.js`
  is what the live app actually uses (auth flow). `redis-config.js` predates
  it and isn't wired into any live route today. Worth consolidating in a
  future pass, but that's a decision about which config shape to standardize
  on — not something to silently merge.
- **`helper/read-db.js`** connects directly via `pg` using `DATABASE_URL`,
  independent of the shared Knex instance in `db/knex.js`. Two DB access
  paths, one connection pool config. Same category as above — a
  consolidation candidate, not touched here.
- **node-cron over BullMQ**: this project used to have a parallel BullMQ-based
  queue system (removed in the dead-code cleanup pass). node-cron is what's
  actually live. If job volume grows to the point where retries, backoff,
  or multiple workers matter, BullMQ is the natural next step — but
  re-introduce it deliberately, not as leftover half-wired code.

## Testing strategy

`__tests__/` currently covers pure functions and mock-based controller unit
tests only (`helper/util.js`, `pages.controller.js`'s `/health`) —
no live DB/Redis/SMTP connections required, so the suite is fast and
deterministic. Testing routes that touch Postgres/Redis/SMTP needs a
mocking strategy decision (test DB vs. `ioredis-mock` vs. full stubs) before
expanding coverage there.
