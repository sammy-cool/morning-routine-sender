# 🌞 Morning Routine Sender

A Node.js/Express backend that sends scheduled, personalized "morning routine" emails (MJML template + a daily quote) to a user list, tracks every send in PostgreSQL, and provides an admin dashboard (installable PWA) to monitor and control the schedule.

## Tech stack

| Layer                   | Choice                                                 |
| ----------------------- | ------------------------------------------------------ |
| Runtime                 | Node.js, Express 4                                     |
| Database                | PostgreSQL via Knex (query builder + migrations)       |
| Cache / ephemeral store | Redis (ioredis) — used for short-lived admin auth keys |
| Email                   | Nodemailer (SMTP) + MJML templates                     |
| Scheduling              | node-cron                                              |
| Frontend                | Plain HTML/CSS/JS, PWA (service worker + manifest)     |
| Logging                 | Winston + winston-daily-rotate-file                    |
| Testing                 | Jest                                                   |
| Hosting                 | Render                                                 |

## Project structure

See [`ARCHITECTURE.md`](./ARCHITECTURE.md) for request-flow diagrams, module
responsibility boundaries, and known design tradeoffs.

```
.
├── index.js                  # Composition root: middleware, router mounts, server start/shutdown
├── knexfile.js                # Knex/Postgres connection config
├── db/
│   ├── knex.js                 # Knex instance
│   ├── migrations/             # Schema history
│   └── seeds/
├── routes/                   # Path → controller wiring only, no logic
│   ├── admin.routes.js         # /read-db, /admin/*
│   ├── auth.routes.js          # /generate-admin-key, /verify-admin-key, /secret-jobs-scheduler
│   ├── email.routes.js         # /send-test-email, /send-bulk-now, /unsubscribe, /scheduled-jobs
│   ├── pages.routes.js         # /health, /offline, /manifest.json, /sw.js, /user-dashboard, /
│   ├── subscribers.routes.js   # /admin/subscribers (CRUD, requireAdmin-gated)
│   └── subscriberPortal.routes.js  # /login, /verify-login, /logout, /subscribe, /confirm-subscription, /me, /me/history
├── controllers/               # Actual route logic, one file per route group
│   ├── admin.controller.js
│   ├── auth.controller.js
│   ├── email.controller.js
│   ├── me.controller.js            # Self-scoped subscriber API (GET/PATCH /me)
│   ├── pages.controller.js
│   ├── signup.controller.js        # Public double opt-in signup
│   ├── subscriberAuth.controller.js  # Magic-link login for subscribers
│   └── subscribers.controller.js   # Admin subscriber CRUD
├── config/
│   ├── email-config.js         # Builds/validates the Nodemailer transporter
│   ├── mailTransporter.js      # Lazy-singleton transporter + graceful-shutdown close
│   ├── redisClient.js          # Shared Redis connection
│   └── env.js                  # Startup env check (warns if required vars are missing)
├── middleware/
│   ├── setApiBase.js
│   ├── rateLimiters.js         # Shared express-rate-limit instance
│   ├── requireAdmin.js         # mrn_role=admin cookie gate
│   └── subscriberSession.js    # Redis-backed subscriber session (opaque token, not a plain-email cookie)
├── email-core/
│   ├── emailScheduler.js       # node-cron jobs — the live scheduling system
│   ├── emailService.js         # Low-level "send one email" helper
│   ├── emailJobs.js            # Job-run wrapper + admin failure alerts
│   └── emailTracker.js         # Postgres-backed send/failure/job-run tracking
├── email-templates/
│   └── email-template.mjml     # Email layout (MJML → HTML)
├── helper/                    # Shared utilities (quote cache, cleanup, retries, util fns,
│                              #   subscriber input validation, HMAC unsubscribe tokens)
├── admin-renderer/             # Admin dashboard HTML/JS (cookie-gated)
├── public/                    # User-facing dashboard, PWA assets, landing page
├── scripts/                   # Standalone scripts (SMTP test, monitor, one-off migration)
├── __tests__/                 # Jest test suite
└── logger.js                   # Winston setup
```

## How an email gets sent

1. `index.js` boots and calls `emailScheduler.scheduleAllJobs()`.
2. `emailScheduler.js`'s node-cron jobs fire on schedule and call the send functions.
3. A transporter is pulled from `config/mailTransporter.js`, and the MJML template in `email-templates/` is compiled with quote/routine data from `helper/shared-data.js`.
4. Nodemailer sends it; the result is recorded via `email-core/emailTracker.js` into Postgres (`email_tracker` / `job_last_run` tables).

Manual trigger paths (`/send-test-email`, `/send-bulk-now`) call the same underlying functions directly, bypassing cron.

## Admin auth flow

Rather than persistent sessions, the app uses short-lived Redis-backed one-time keys:

1. `GET /generate-admin-key` (requires `ADMIN_KEY`) → generates a key, stores it in Redis with a 5-minute TTL.
2. That key is passed to `POST /verify-admin-key` (sets an `mrn_role=admin` cookie) or `POST /secret-jobs-scheduler` (start/stop cron jobs) — both check Redis, then delete the key (one-time use).
3. `/admin-dashboard` checks for the `mrn_role=admin` cookie before serving the dashboard.

## Subscribers

Subscribers live in Postgres (`subscribers` table), not a hardcoded array —
each row has an email, cron pattern, timezone, template type, and active
flag. Two ways in:

- **Admin adds someone directly**: `/admin/subscribers` (CRUD), gated by a
  real `mrn_role=admin` check via `middleware/requireAdmin.js`.
- **Public signup**: `POST /subscribe` → confirmation email → click to
  confirm → subscribed, welcomed, and auto-logged in. Double opt-in
  deliberately, so signup can't be used to subscribe someone else's email
  without their consent.

Subscribers manage themselves without needing an admin: `POST /login` sends
a magic link (no passwords), and once logged in, `/user-dashboard` shows
send history and lets them edit their own cron time/timezone/template or
pause/resume — via a self-scoped API (`GET`/`PATCH /me`) that only ever
acts on the logged-in subscriber's own record. Every routine email also
includes a working one-click unsubscribe link, signed per-subscriber so it
can't be used against someone else's subscription.

See `ARCHITECTURE.md` for the full request-flow diagrams (login, signup,
and the session-token design that keeps a subscriber's identity from being
forgeable via a plain cookie).

## API endpoints

| Method | Path                                        | Purpose                                                                          |
| ------ | ------------------------------------------- | -------------------------------------------------------------------------------- |
| GET    | `/`                                         | Landing page / role-based redirect                                               |
| GET    | `/health`                                   | Health check                                                                     |
| GET    | `/admin-dashboard`                          | Admin dashboard (cookie-gated)                                                   |
| GET    | `/user-dashboard`                           | User dashboard                                                                   |
| GET    | `/offline`                                  | Offline fallback page (PWA)                                                      |
| GET    | `/manifest.json`, `/sw.js`                  | PWA assets                                                                       |
| GET    | `/generate-admin-key`                       | Issue a one-time admin key                                                       |
| POST   | `/verify-admin-key`                         | Exchange a key for an admin session cookie                                       |
| POST   | `/secret-jobs-scheduler?action=start\|stop` | Start/stop cron jobs                                                             |
| POST   | `/send-test-email`                          | Send a single test email                                                         |
| POST   | `/send-bulk-now`                            | Trigger a bulk send immediately                                                  |
| GET    | `/unsubscribe`                              | Unsubscribe (requires a signed per-email token, included in every routine email) |
| GET    | `/scheduled-jobs`                           | Status of registered cron jobs                                                   |
| GET    | `/read-db`                                  | Raw DB read (admin)                                                              |
| POST   | `/admin/cleanup-database`                   | Manual retention cleanup                                                         |
| GET    | `/admin/database-stats`                     | DB stats                                                                         |
| POST   | `/admin/cleanup-logs`                       | Delete old log files                                                             |
| GET    | `/admin/subscribers`                        | List all subscribers (admin)                                                     |
| POST   | `/admin/subscribers`                        | Add a subscriber (admin)                                                         |
| PATCH  | `/admin/subscribers/:email`                 | Edit prefs / pause-resume (admin)                                                |
| DELETE | `/admin/subscribers/:email`                 | Remove a subscriber (admin)                                                      |
| POST   | `/login`                                    | Request a magic login link                                                       |
| GET    | `/verify-login`                             | Redeem a login link, creates a session                                           |
| POST   | `/logout`                                   | End the current subscriber session                                               |
| POST   | `/subscribe`                                | Request signup (sends a confirmation link)                                       |
| GET    | `/confirm-subscription`                     | Redeem signup confirmation, auto-logs in                                         |
| GET    | `/me`                                       | Own subscriber record (session-gated)                                            |
| GET    | `/me/history`                               | Own send history (session-gated)                                                 |
| PATCH  | `/me`                                       | Edit own prefs / pause-resume (session-gated)                                    |

## Getting started

```bash
npm install
cp .env.example .env      # fill in real values — see comments in the file for what each var does
npm run db:migrate        # creates email_tracker, job_last_run, and subscribers tables
npm run start_nodemon_server
```

Then: `GET /generate-admin-key` (with `ADMIN_KEY` header) → `POST /verify-admin-key` → visit `/admin-dashboard`.

## Scripts

| Command                                            | Purpose                            |
| -------------------------------------------------- | ---------------------------------- |
| `npm run start_server`                             | Start the server (`node index.js`) |
| `npm run start_nodemon_server`                     | Start with auto-restart on change  |
| `npm test`                                         | Run the Jest test suite            |
| `npm run test:watch`                               | Jest in watch mode                 |
| `npm run test:smtp`                                | Standalone SMTP connectivity check |
| `npm run db:migrate` / `db:rollback` / `db:status` | Knex migration commands            |
| `npm run db:seed`                                  | Run seed files                     |

## Deployment (Render)

The app is deployed on Render as a web service. Start command runs the migration then the server; see `Procfile` / your Render dashboard Start Command setting for the exact invocation used in production.

## Known gaps

A handful of things are documented but not yet wired up, or wired inconsistently — flagged with comments at the relevant file (e.g. `.env.example`, `helper/read-db.js`) rather than silently fixed, since some are deliberate decisions rather than bugs. Worth a read through those comments before assuming a var or file does what its name suggests.

## License

MIT © Priyanshu — [priyanshu-eureka.netlify.app](https://priyanshu-eureka.netlify.app/)
