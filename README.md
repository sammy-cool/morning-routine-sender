# 🌞 Morning Routine Sender

A Node.js/Express backend that sends scheduled, personalized "morning routine" emails (MJML template + a daily quote) to a user list, tracks every send in PostgreSQL, and provides an admin dashboard (installable PWA) to monitor and control the schedule.

## Tech stack

| Layer | Choice |
|---|---|
| Runtime | Node.js, Express 4 |
| Database | PostgreSQL via Knex (query builder + migrations) |
| Cache / ephemeral store | Redis (ioredis) — used for short-lived admin auth keys |
| Email | Nodemailer (SMTP) + MJML templates |
| Scheduling | node-cron |
| Frontend | Plain HTML/CSS/JS, PWA (service worker + manifest) |
| Logging | Winston + winston-daily-rotate-file |
| Testing | Jest |
| Hosting | Render |

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
│   └── pages.routes.js         # /health, /offline, /manifest.json, /sw.js, /user-dashboard, /
├── controllers/               # Actual route logic, one file per route group
├── config/
│   ├── email-config.js         # Builds/validates the Nodemailer transporter
│   ├── mailTransporter.js      # Lazy-singleton transporter + graceful-shutdown close
│   ├── redisClient.js          # Shared Redis connection
│   └── env.js                  # Startup env check (warns if required vars are missing)
├── middleware/
│   ├── setApiBase.js
│   └── rateLimiters.js         # Shared express-rate-limit instance
├── email-core/
│   ├── emailScheduler.js       # node-cron jobs — the live scheduling system
│   ├── emailService.js         # Low-level "send one email" helper
│   ├── emailJobs.js            # Job-run wrapper + admin failure alerts
│   └── emailTracker.js         # Postgres-backed send/failure/job-run tracking
├── email-templates/
│   └── email-template.mjml     # Email layout (MJML → HTML)
├── helper/                    # Shared utilities (quote cache, cleanup, retries, util fns)
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

## API endpoints

| Method | Path | Purpose |
|---|---|---|
| GET | `/` | Landing page / role-based redirect |
| GET | `/health` | Health check |
| GET | `/admin-dashboard` | Admin dashboard (cookie-gated) |
| GET | `/user-dashboard` | User dashboard |
| GET | `/offline` | Offline fallback page (PWA) |
| GET | `/manifest.json`, `/sw.js` | PWA assets |
| GET | `/generate-admin-key` | Issue a one-time admin key |
| POST | `/verify-admin-key` | Exchange a key for an admin session cookie |
| POST | `/secret-jobs-scheduler?action=start\|stop` | Start/stop cron jobs |
| POST | `/send-test-email` | Send a single test email |
| POST | `/send-bulk-now` | Trigger a bulk send immediately |
| GET | `/unsubscribe` | Unsubscribe a user |
| GET | `/scheduled-jobs` | Status of registered cron jobs |
| GET | `/read-db` | Raw DB read (admin) |
| POST | `/admin/cleanup-database` | Manual retention cleanup |
| GET | `/admin/database-stats` | DB stats |
| POST | `/admin/cleanup-logs` | Delete old log files |

## Getting started

```bash
npm install
cp .env.example .env      # fill in real values — see comments in the file for what each var does
npm run db:migrate        # creates email_tracker and job_last_run tables
npm run start_nodemon_server
```

Then: `GET /generate-admin-key` (with `ADMIN_KEY` header) → `POST /verify-admin-key` → visit `/admin-dashboard`.

## Scripts

| Command | Purpose |
|---|---|
| `npm run start_server` | Start the server (`node index.js`) |
| `npm run start_nodemon_server` | Start with auto-restart on change |
| `npm test` | Run the Jest test suite |
| `npm run test:watch` | Jest in watch mode |
| `npm run test:smtp` | Standalone SMTP connectivity check |
| `npm run db:migrate` / `db:rollback` / `db:status` | Knex migration commands |
| `npm run db:seed` | Run seed files |

## Deployment (Render)

The app is deployed on Render as a web service. Start command runs the migration then the server; see `Procfile` / your Render dashboard Start Command setting for the exact invocation used in production.

## Known gaps

A handful of things are documented but not yet wired up, or wired inconsistently — flagged with comments at the relevant file (e.g. `.env.example`, `helper/read-db.js`) rather than silently fixed, since some are deliberate decisions rather than bugs. Worth a read through those comments before assuming a var or file does what its name suggests.

## License

MIT © Priyanshu — [priyanshu-eureka.netlify.app](https://priyanshu-eureka.netlify.app/)
