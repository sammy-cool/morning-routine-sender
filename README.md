# 🌞 Morning Routine Sender

[![Node.js](https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Knex-336791?style=flat-square&logo=postgresql&logoColor=white)](https://knexjs.org)
[![Redis](https://img.shields.io/badge/Redis-ioredis-dc382d?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Tests](https://img.shields.io/badge/Tests-201%2F201%20Passing-10b981?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io)
[![Version](https://img.shields.io/badge/Version-v2.1.0-6366f1?style=flat-square)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](./LICENSE)

An enterprise-ready **Node.js/Express** automation platform that dispatches personalized, responsive morning routine emails (powered by **MJML**, daily motivation quotes, and curated tech news) on custom cron schedules. Equipped with a next-gen **Obsidian Glassmorphism Admin Command Center**, a passwordless **Subscriber Magic-Link Portal**, **365-Day Activity Heatmaps**, **AI Morning Coach Personas**, **Outbound Webhooks**, **Dynamic Streak Share Cards**, **Sunday Weekly Digests**, and a high-performance **Winston Telemetry Logger**.

---

## ⚡ Key Features

- 📊 **365-Day Activity & Reflection Heatmap (GitHub-Style)**:
  - 52-week responsive CSS Grid visualization tracking daily habit consistency over 365 days.
  - Interactive hover tooltips and slide-in reflection inspection drawer to review past wins, gratitude, and mindset notes.
- 🧠 **5 AI Morning Coach Personas**:
  - Persona archetypes (`Stoic`, `Relentless`, `Zen`, `Tech Lead`, `Optimist`) with dynamic prompt engineering and multi-LLM dispatching (Gemini, OpenAI, Ollama, Curated fallback).
- 🔌 **Outbound Automation Webhooks (Zapier / Make / Slack / Notion)**:
  - HMAC-SHA256 signature verification (`X-MorningRoutine-Signature`), timestamp headers, and non-blocking 5s timeout protection.
- 🎨 **Dynamic SVG Streak Share Cards & OpenGraph Landing Page**:
  - High-DPI 1200x630 vector SVG share cards with glowing flame streak badges and deterministic vector QR code matrices.
  - Public social landing route `GET /streak/:handleOrEmail` with rich OpenGraph and Twitter card previews.
- 📅 **Sunday Weekly Performance Digest & Automated Cron**:
  - Automated weekly cron job running Sunday at 18:00 (6:00 PM) in each subscriber's local timezone.
  - Responsive Sunday MJML digest template aggregating 7-day completion calendar, mood trends, and upcoming week AI spark.
- 📱 **PWA Native App Icon Badging & Offline Sync**:
  - W3C App Badging API (`navigator.setAppBadge`) setting OS taskbar/dock icons to active habit streaks.
  - Offline sync engine queueing habit check-ins in IndexedDB and syncing via Service Worker Background Sync API.
- 💬 **Multi-Channel Dispatch Engine**:
  - Parallel Discord Webhook embeds and Telegram Bot messages dispatched with morning routine emails.
- 💎 **Next-Gen Admin Command Center (`/admin-dashboard`)**:
  - Live KPI telemetry, interactive Chart.js analytics, raw database inspector modal with visual grid & JSON toggles, and 1-click dead-letter retry.
- 📬 **Mobile-First Responsive MJML Templates**:
  - Pixel-perfect rendering across Apple Mail, Gmail iOS/Android, Outlook, and web clients.
- 🔐 **Secure Dual Authentication**:
  - **Admin**: Instant master `ADMIN_KEY` direct login or Redis-backed temporary 5-minute keys with 24-hour signed cookie sessions.
  - **Subscriber Portal**: Passwordless, one-time signed magic links (`POST /login` → 15-min token → `/user-dashboard`).
- 🍞 **Personal Toast Engine**:
  - Integrated with [`customizable-toast-notification@latest`](https://www.npmjs.com/package/customizable-toast-notification).

---

## 🏗️ Architecture & Tech Stack

| Layer                 | Technology                                                                      |
| :-------------------- | :------------------------------------------------------------------------------ |
| **Backend Runtime**   | Node.js (v20+ LTS), Express 4                                                   |
| **Database & ORM**    | PostgreSQL with Knex.js query builder & migrations                              |
| **Cache & Sessions**  | Redis via `ioredis` (with dev mock fallback)                                    |
| **Email Compilation** | Nodemailer (SMTP) + MJML + Handlebars                                           |
| **Scheduler**         | `node-cron` with in-memory job registry & timezone-aware triggers               |
| **Frontend UI**       | Modern Vanilla JS, Glassmorphism CSS, Chart.js, FontAwesome                     |
| **Logging**           | Winston with `winston-daily-rotate-file` & deep error serialization             |
| **Testing & Quality** | Jest + Supertest (33 test suites, 201 unit/integration tests), ESLint, Prettier |
| **Deployment**        | Render (Web Service + Managed PostgreSQL + Redis)                               |

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
