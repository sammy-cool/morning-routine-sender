# 🌞 Morning Routine Sender

[![Node.js](https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Knex-336791?style=flat-square&logo=postgresql&logoColor=white)](https://knexjs.org)
[![Redis](https://img.shields.io/badge/Redis-ioredis-dc382d?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Tests](https://img.shields.io/badge/Tests-63%2F63%20Passing-10b981?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io)
[![License](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](./LICENSE)

An enterprise-ready **Node.js/Express** automation platform that dispatches personalized, responsive morning routine emails (powered by **MJML**, daily motivation quotes, and curated tech news) on custom cron schedules. Equipped with a next-gen **Obsidian Glassmorphism Admin Command Center**, a passwordless **Subscriber Magic-Link Portal**, and a high-performance **Winston Telemetry Logger**.

---

## ⚡ Key Features

- 💎 **Next-Gen Admin Command Center (`/admin-dashboard`)**:
  - Live KPI stats (active/paused subscribers, delivery health, active cron schedulers, retention counts).
  - Interactive **Chart.js** analytics (Growth trends & Routine template distributions).
  - Real-time subscriber management with inline search, filter, edit, and CSV export.
  - **Email Studio**: Live routine test dispatcher with 6 routine themes and 1-click bulk campaign trigger.
  - Global Command Palette (`⌘K` / `Ctrl+K`) for rapid keyboard navigation.
- 📬 **Mobile-First Responsive MJML Templates**:
  - Pixel-perfect rendering across Apple Mail, Gmail iOS/Android, Outlook, and web clients.
  - Sunrise header pills, daily focus quote callouts, actionable daily rituals, and trending dev news cards.
  - Working 1-click cryptographically signed unsubscribe and preference links.
- 🔐 **Secure Dual Authentication**:
  - **Admin**: Instant master `ADMIN_KEY` direct login or Redis-backed temporary 5-minute keys with 24-hour signed cookie sessions.
  - **Subscriber Portal**: Passwordless, one-time signed magic links (`POST /login` → 15-min token → `/user-dashboard`).
- ⏱️ **Timezone-Aware Cron Engine (`node-cron`)**:
  - Individual subscriber cron patterns and timezones saved in PostgreSQL.
- 🛡️ **Enterprise Security & Reliability**:
  - Strict **Helmet Content Security Policy** whitelisting necessary CDNs, fonts, and scripts.
  - Anti-spam honeypot inputs on public signup forms.
  - Rate limiting on sensitive auth and dispatch routes.
- 🪵 **Pro Structured Telemetry Logger**:
  - Deep error stack unwrapping (no empty `[object Object]` logs).
  - Express HTTP request latency tracking (`+12ms`), IP, and User-Agent capture.
  - Daily rotating compressed file logs (`app-%DATE%.log`, `error-%DATE%.log`).
- 🍞 **Personal Toast Engine**:
  - Integrated with [`customizable-toast-notification@latest`](https://www.npmjs.com/package/customizable-toast-notification).

---

## 🏗️ Architecture & Tech Stack

| Layer                 | Technology                                                          |
| :-------------------- | :------------------------------------------------------------------ |
| **Backend Runtime**   | Node.js (v20+ LTS), Express 4                                       |
| **Database & ORM**    | PostgreSQL with Knex.js query builder & migrations                  |
| **Cache & Sessions**  | Redis via `ioredis` (with dev mock fallback)                        |
| **Email Compilation** | Nodemailer (SMTP) + MJML + Handlebars                               |
| **Scheduler**         | `node-cron` with in-memory job registry                             |
| **Frontend UI**       | Modern Vanilla JS, Glassmorphism CSS, Chart.js, FontAwesome         |
| **Logging**           | Winston with `winston-daily-rotate-file` & deep error serialization |
| **Testing**           | Jest + Supertest (8 test suites, 63 unit/integration tests)         |
| **Deployment**        | Render (Web Service + Managed PostgreSQL + Redis)                   |

---

## 📂 Project Structure

```
.
├── index.js                      # Application entry point, security middleware, router mounts
├── knexfile.js                   # PostgreSQL Knex configuration (pool & SSL settings)
├── logger.js                     # Enterprise Winston logger with request middleware
├── db/
│   ├── knex.js                   # Initialized Knex database instance
│   ├── migrations/               # PostgreSQL schema migration files
│   └── seeds/                    # Database seeds
├── routes/
│   ├── admin.routes.js           # Database inspection & maintenance routes
│   ├── auth.routes.js            # Admin key issuance & verification routes
│   ├── email.routes.js           # Test send, bulk dispatch, and unsubscribe routes
│   ├── pages.routes.js           # Static pages, health check, PWA manifest, and dashboards
│   ├── subscribers.routes.js     # Admin CRUD operations for subscribers
│   └── subscriberPortal.routes.js# Magic-link auth & self-scoped subscriber routes
├── controllers/
│   ├── admin.controller.js       # Database retention & file log cleanup
│   ├── auth.controller.js        # Admin verification & key generator
│   ├── email.controller.js       # Email testing, bulk trigger & unsubscribe page
│   ├── me.controller.js          # Self-scoped subscriber profile (/me)
│   ├── pages.controller.js       # Dynamic template renderer with domain replacement
│   ├── signup.controller.js      # Double opt-in newsletter signup
│   ├── subscriberAuth.controller.js # Magic link generation and redemption
│   ├── subscriberStats.controller.js # Aggregated analytics & subscriber metrics
│   └── subscribers.controller.js # Admin subscriber management
├── config/
│   ├── email-config.js           # Nodemailer transport builder & verification
│   ├── mailTransporter.js        # Singleton SMTP transporter with graceful teardown
│   ├── redisClient.js            # Resilient ioredis client with dev mock fallback
│   └── env.js                    # Startup environment validator
├── middleware/
│   ├── rateLimiters.js           # Express rate limiters for auth & email endpoints
│   ├── requireAdmin.js           # Signed cookie admin gatekeeper
│   ├── setApiBase.js             # Dynamic canonical URL and domain injector
│   └── subscriberSession.js      # Opaque Redis session validator for subscribers
├── email-core/
│   ├── emailJobs.js              # Cron dispatch wrapper with failure alerting
│   ├── emailScheduler.js         # node-cron scheduler registration & management
│   ├── emailService.js           # Async MJML template compiler and SMTP sender
│   └── emailTracker.js           # PostgreSQL send telemetry & log tracker
├── email-templates/
│   └── email-template.mjml       # Responsive MJML email layout
├── helper/
│   ├── database-cleanup.js       # Retention-based database record cleaner
│   ├── retryUtil.js              # Async retry wrapper with structured backoff logs
│   ├── shared-data.js            # Quote cache, daily routine themes, and fallbacks
│   ├── unsubscribeToken.js       # HMAC-SHA256 signed unsubscribe token generator
│   └── util.js                   # Crypto utilities, safe string compare, and News API
├── admin-renderer/
│   └── views/
│       └── admin-dashboard.html  # Obsidian Glassmorphism Admin Command Center
├── public/
│   ├── main-index.html           # Landing page with signup & subscriber portals
│   ├── user-dashboard.html       # Subscriber routine preferences & history view
│   ├── offline.html              # PWA offline fallback screen
│   ├── manifest.json             # PWA Web App Manifest
│   ├── sw.js                     # Service worker with offline caching
│   └── js/                       # Client scripts (signup, login, modal)
└── __tests__/                    # Comprehensive Jest test suite
```

---

## 📡 API Reference

### 1. Public & Subscriber Portal Endpoints

| Method  | Endpoint                            | Description                                                              |
| :------ | :---------------------------------- | :----------------------------------------------------------------------- |
| `GET`   | `/`                                 | Responsive landing page (signup + subscriber portal + admin key trigger) |
| `GET`   | `/user-dashboard` (or `/dashboard`) | Subscriber preferences & history dashboard (session-gated)               |
| `POST`  | `/subscribe`                        | New subscriber double opt-in registration                                |
| `GET`   | `/confirm-subscription`             | Confirm signup and establish subscriber session                          |
| `POST`  | `/login`                            | Request passwordless magic login link                                    |
| `GET`   | `/verify-login`                     | Redeem magic link and initialize subscriber session                      |
| `POST`  | `/logout`                           | Terminate subscriber session                                             |
| `GET`   | `/me`                               | Fetch authenticated subscriber profile                                   |
| `PATCH` | `/me`                               | Update routine schedule, timezone, or pause/resume                       |
| `GET`   | `/me/history`                       | View subscriber email delivery history                                   |
| `GET`   | `/unsubscribe`                      | 1-click cryptographically signed unsubscribe confirmation                |

### 2. Admin & Telemetry Endpoints (Gated via `mrn_role=admin`)

| Method   | Endpoint                    | Description                                                         |
| :------- | :-------------------------- | :------------------------------------------------------------------ |
| `GET`    | `/admin-dashboard`          | Next-Gen Admin Command Center                                       |
| `POST`   | `/verify-admin-key`         | Authenticate master `ADMIN_KEY` or temporary Redis key              |
| `GET`    | `/generate-admin-key`       | Generate 5-minute temporary admin key (requires `ADMIN_KEY` header) |
| `GET`    | `/admin/subscribers`        | List subscribers with search & filter                               |
| `POST`   | `/admin/subscribers`        | Manually add subscriber                                             |
| `PATCH`  | `/admin/subscribers/:email` | Update subscriber attributes or toggle active state                 |
| `DELETE` | `/admin/subscribers/:email` | Remove subscriber record                                            |
| `GET`    | `/admin/subscriber-stats`   | Aggregated metrics (total, active, paused, 7D/30D/90D growth)       |
| `POST`   | `/send-test-email`          | Dispatch test routine email with selected theme                     |
| `POST`   | `/send-bulk-now`            | Trigger immediate bulk dispatch to all active subscribers           |
| `GET`    | `/scheduled-jobs`           | List active `node-cron` schedulers                                  |
| `GET`    | `/read-db`                  | Inspect raw `email_tracker` audit logs                              |
| `POST`   | `/admin/cleanup-database`   | Prune email audit logs older than N days                            |
| `POST`   | `/admin/cleanup-logs`       | Purge disk log files older than 3 days                              |
| `GET`    | `/health`                   | System health check                                                 |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory:

```env
# Server
PORT=2900
NODE_ENV=development
RENDER_URL=https://morning-routine-sender.onrender.com
ALLOWED_ORIGINS=https://priyanshu-eureka.netlify.app

# Database (PostgreSQL)
DATABASE_URL=postgres://username:password@hostname:5432/morning_routine_db
DB_RETENTION_DAYS=30

# Redis
REDIS_URL=redis://default:password@hostname:6379

# Admin Security
ADMIN_KEY=your-super-secret-admin-master-key
CRON_API_KEY=your-cron-secret-key

# SMTP Credentials
FROM_USER=your-email@gmail.com
FROM_PASS=your-16-digit-google-app-password
LOGO_URL=https://your-domain.com/assets/logo.png

# External APIs
THE_NEWS_API_KEY=your-thenewsapi-key-optional
LOG_LEVEL=info
```

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** `v20.0.0` or higher
- **PostgreSQL** instance
- **Redis** instance (optional in development; mock fallback automatically activates)

### 1. Installation

```bash
git clone https://github.com/sammy-cool/morning-routine-sender.git
cd morning-routine-sender
npm install
```

### 2. Database Migrations

```bash
cp .env.example .env
npm run db:migrate
```

### 3. Start Development Server

```bash
npm run start_nodemon_server
```

Visit `http://localhost:2900` in your browser.

---

## 🧪 Testing

Run the comprehensive Jest test suite:

```bash
# Run all 8 test suites
npm test

# Run tests in watch mode
npm run test:watch

# Test SMTP connectivity
npm run test:smtp
```

---

## 🌐 Production Deployment (Render)

1. Push your branch to GitHub (`master` or `fix/render-deploy-fix`).
2. In your Render Dashboard:
   - Set **Build Command**: `npm install`
   - Set **Start Command**: `npx knex migrate:latest && node index.js`
   - Configure environment variables in the **Environment** tab.
3. Render will build and deploy the web service automatically with zero downtime.

---

## 📄 License

Distributed under the **MIT License**. Created with 💜 by **Priyanshu** — [priyanshu-eureka.netlify.app](https://priyanshu-eureka.netlify.app/).
