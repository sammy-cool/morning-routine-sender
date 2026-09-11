# 🌞 Morning Routine Sender

[![Node.js](https://img.shields.io/badge/Node.js-v20+-68a063?style=flat-square&logo=node.js&logoColor=white)](https://nodejs.org)
[![Express](https://img.shields.io/badge/Express-4.x-000000?style=flat-square&logo=express&logoColor=white)](https://expressjs.com)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Knex-336791?style=flat-square&logo=postgresql&logoColor=white)](https://knexjs.org)
[![Redis](https://img.shields.io/badge/Redis-ioredis-dc382d?style=flat-square&logo=redis&logoColor=white)](https://redis.io)
[![Tests](https://img.shields.io/badge/Tests-763%2F763%20Passing-10b981?style=flat-square&logo=jest&logoColor=white)](https://jestjs.io)
[![Version](https://img.shields.io/badge/Version-v2.2.0-6366f1?style=flat-square)](./CHANGELOG.md)
[![License](https://img.shields.io/badge/License-MIT-6366f1?style=flat-square)](./LICENSE)

An enterprise-ready **Node.js/Express** automation platform that dispatches personalized, responsive morning routine emails (powered by **MJML**, daily motivation quotes, and curated tech news) on custom cron schedules. Equipped with a next-gen **Obsidian Glassmorphism Admin Command Center (`/admin-dashboard`)**, a passwordless **Subscriber Magic-Link Portal (`/user-dashboard`)**, **SWR Caching & Optimistic UI**, **Accountability Squads & Peer Streaks**, **AI Morning Audio Briefings**, **Deep Habit Analytics**, **Procedural Web Audio synthesis**, **Mobile Haptic Feedback**, **365-Day Activity Heatmaps**, **AI Morning Coach Personas**, **Outbound Automation Webhooks**, **Dynamic SVG Streak Share Cards**, **Sunday Weekly Digests**, and a high-performance **Winston Telemetry Logger**.

---

## ⚡ Key Features

- 👥 **Accountability Squads & Peer Streaks**:
  - Form peer squads (up to 5 members), generate unique invite codes (`SQUAD-XXXX`), track collective aggregate streaks, and review live peer check-in status.
- 📈 **Deep Habit Analytics & Time-of-Day Insights**:
  - 7-day and 30-day consistency percentage calculations, 4-week day-of-week breakdown, and peak energy time-of-day distribution buckets (Early Morning, Core Morning, Afternoon, Evening).
- 🎙️ **AI Morning Audio Briefing Service**:
  - Dynamic audio briefings generated with persona-tailored speech directives (Stoic Sage, High-Performance Coach, Monk, Ruthless Leader, Visionary Strategist) and browser SpeechSynthesis narration.
- 🔔 **Rich Push Notification Actions & Lock-Screen Check-In**:
  - Web Push notifications with interactive actions (`🔥 Check-in Now`, `⚡ Start Ritual`, `⏰ Snooze 15m`) and Service Worker background 1-click execution.
- ✉️ **Gmail & Schema.org 1-Click Interactive Markup**:
  - Injected Schema.org JSON-LD `EmailMessage` interactive action markup enabling 1-click check-ins straight from Gmail inbox lists.
- ⚡ **Next-Gen Client UX Engine (`UXCore`)**:
  - **SWR (Stale-While-Revalidate) Caching**: `<10ms` instant page renders for subscriber profiles, 365-day heatmaps, and journal notes.
  - **Optimistic UI Updates**: Instant streak increment and reflection status indicators with resilient auto-rollback.
  - **Procedural Web Audio Synthesis**: Zero external audio files; pure browser oscillator audio synthesis for pleasant check-in chimes and celebratory milestone fanfares.
  - **Mobile Haptic Feedback**: Tactile vibration rhythms (`light`, `success`, `celebration`) for mobile devices.
  - **Accessible Keyboard Hotkeys**: Global shortcuts (`Space`/`C` for check-in, `J` for journal, `H` for heatmap, `S` for share card, `?` for shortcuts guide, `Esc` to dismiss).
  - **Mobile Bottom Navigation Bar (< 768px)**: Fixed glassmorphic navigation dock with active scroll-spy tracking.
- 🏆 **Gamification & Milestone Celebrations**:
  - Multi-tier milestone celebrations (Day 3, 7, 14, 30, 60, 100, 365) with custom consistency tiers, multi-cannon confetti bursts, animated flickering flame aura, and 1-click social sharing.
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

| Layer                   | Technology                                                                        |
| :---------------------- | :-------------------------------------------------------------------------------- |
| **Backend Runtime**     | Node.js (v20+ LTS), Express 4                                                     |
| **Database & ORM**      | PostgreSQL with Knex.js query builder & migrations                                |
| **Cache & Sessions**    | Redis via `ioredis` (with resilient dev mock fallback)                            |
| **Email Compilation**   | Nodemailer (SMTP) + MJML + Handlebars                                             |
| **Scheduler**           | `node-cron` with in-memory job registry & timezone-aware triggers                 |
| **Frontend UI**         | Modern Vanilla JS, Glassmorphism CSS, Web Audio Synthesis, Web Vibration API      |
| **Logging & Telemetry** | Winston with `winston-daily-rotate-file` & structured JSON serialization          |
| **Testing & Quality**   | Jest + Supertest (34 test suites, 211 unit/integration tests), ESLint 9, Prettier |
| **Deployment**          | Render (Web Service + Managed PostgreSQL + Redis)                                 |

---

## 📂 Project Structure

```
.
├── index.js                      # Application entry point, security middleware, router mounts
├── knexfile.js                   # PostgreSQL Knex configuration (pool & SSL settings)
├── logger.js                     # Enterprise Winston logger with request middleware
├── render.yaml                   # Infrastructure-as-Code blueprint for Render
├── db/
│   ├── knex.js                   # Initialized Knex database instance
│   ├── migrations/               # PostgreSQL schema migration files
│   └── seeds/                    # Database seeds
├── routes/
│   ├── admin.routes.js           # Database inspection, telemetry, & maintenance routes
│   ├── auth.routes.js            # Admin key issuance & verification routes
│   ├── deliverability.routes.js  # Bounce/delivery event feeds & dead-letter retry routes
│   ├── email.routes.js           # Test send, bulk dispatch, and unsubscribe routes
│   ├── journal.routes.js         # Reflection journaling & 365-day heatmap API routes
│   ├── pages.routes.js           # Static pages, health check, PWA manifest, and dashboards
│   ├── push.routes.js            # Web Push subscription & test dispatch routes
│   ├── subscriberPortal.routes.js# Magic-link auth, personas, & self-scoped subscriber routes
│   ├── subscribers.routes.js     # Admin CRUD operations for subscribers
│   ├── webhook.routes.js         # Inbound SMTP provider webhook listeners (Resend/SendGrid/Brevo)
│   └── weeklyDigest.routes.js    # Sunday weekly digest preview & trigger routes
├── controllers/
│   ├── admin.controller.js       # Database retention & file log cleanup
│   ├── auth.controller.js        # Admin verification & key generator
│   ├── deliverability.controller.js # Delivery telemetry aggregation & 1-click retry
│   ├── email.controller.js       # Email testing, bulk trigger & unsubscribe page
│   ├── journal.controller.js     # Daily reflection journal & 365-day heatmap controller
│   ├── me.controller.js          # Self-scoped subscriber profile, personas, & outbound webhooks
│   ├── pages.controller.js       # Dynamic template renderer with domain replacement
│   ├── push.controller.js        # Web Push subscription registration & test push
│   ├── routine.controller.js     # 1-Click habit streak checkin & live routine companion
│   ├── signup.controller.js      # Double opt-in newsletter signup
│   ├── subscriberAuth.controller.js # Magic link generation and redemption
│   ├── subscriberStats.controller.js # Aggregated analytics & subscriber metrics
│   ├── subscribers.controller.js # Admin subscriber management
│   ├── webhook.controller.js     # Webhook parser for bounce/complaint/delivery events
│   └── weeklyDigest.controller.js# Sunday performance digest controller
├── config/
│   ├── email-config.js           # Nodemailer transport builder & verification
│   ├── env.js                    # Startup environment validator
│   ├── mailTransporter.js        # Singleton SMTP transporter with graceful teardown
│   ├── redisClient.js            # Resilient ioredis client with dev mock fallback
│   └── smtp-providers.js         # Multi-provider SMTP presets
├── middleware/
│   ├── honeypot.js               # Anti-spam hidden field validator
│   ├── rateLimiters.js           # Express rate limiters for auth & email endpoints
│   ├── requireAdmin.js           # Signed cookie admin gatekeeper
│   ├── setApiBase.js             # Dynamic canonical URL and domain injector
│   └── subscriberSession.js      # Opaque Redis session validator for subscribers
├── email-core/
│   ├── emailJobs.js              # Cron dispatch wrapper with failure alerting & weekly digest
│   ├── emailScheduler.js         # node-cron scheduler registration & management
│   ├── emailService.js           # Async MJML template compiler and SMTP sender
│   ├── emailTracker.js           # PostgreSQL send telemetry & log tracker
│   └── suppressionService.js     # Suppression list manager for hard bounces & unsubscribes
├── push-core/
│   └── pushService.js            # VAPID Web Push notification engine
├── helper/
│   ├── aiSparkGenerator.js       # Multi-LLM provider engine (Gemini/OpenAI/Ollama/Curated)
│   ├── channelDispatcher.js      # Discord embed & Telegram bot dispatcher
│   ├── curatedSparks.js          # Persona-curated fallback motivation quotes
│   ├── errorClassifier.js        # SMTP error classification & retry categorization
│   ├── journalService.js         # Journal entry upsert, export, & heatmap aggregation
│   ├── outboundWebhookDispatcher.js # Signed HMAC-SHA256 outbound webhook dispatcher
│   ├── retryUtil.js              # Async exponential backoff retry engine
│   ├── shared-data.js            # Quote cache, daily routine themes, and fallbacks
│   ├── streakCardGenerator.js    # High-DPI dynamic SVG streak card generator
│   ├── unsubscribeToken.js       # HMAC-SHA256 signed action tokens
│   ├── webhookParsers.js         # Provider-specific bounce & delivery event normalizers
│   └── weeklyDigestService.js    # Sunday digest MJML template compiler & dispatcher
├── public/
│   ├── main-index.html           # Landing page with signup & subscriber portals
│   ├── user-dashboard.html       # Subscriber command center, heatmap & journal
│   ├── offline.html              # PWA offline fallback screen
│   ├── manifest.json             # PWA Web App Manifest
│   ├── sw.js                     # Service worker with offline caching & background sync
│   └── js/                       # Client engines
│       ├── app-badging.js        # Native W3C App Badging integration
│       ├── offline-sync.js       # IndexedDB offline checkin queue
│       ├── user-dashboard.js     # Dashboard state manager & UI controller
│       └── ux-core.js            # SWR cache, audio synthesis, haptics, & shortcuts
├── admin-renderer/
│   ├── js/
│   │   └── admin-dashboard.js    # Admin console telemetry & charts logic
│   └── views/
│       └── admin-dashboard.html  # Obsidian Glassmorphism Admin Command Center
└── __tests__/                    # 34 comprehensive Jest test suites (211/211 passing)
```

---

## 📡 API Reference

### 1. Public & Subscriber Portal Endpoints

| Method  | Endpoint                            | Description                                                                 |
| :------ | :---------------------------------- | :-------------------------------------------------------------------------- |
| `GET`   | `/`                                 | Responsive landing page (signup + subscriber portal + live companion links) |
| `GET`   | `/about`                            | Project overview, philosophy, and architecture details                      |
| `GET`   | `/routine`                          | Live focus companion screen with routine timer & check-in                   |
| `GET`   | `/checkin`                          | 1-Click habit streak check-in (supports JSON & Web UI)                      |
| `GET`   | `/user-dashboard` (or `/dashboard`) | Subscriber command center (preferences, journal, & heatmap)                 |
| `GET`   | `/streak/:handleOrEmail`            | Dynamic OpenGraph & Twitter Card share landing page                         |
| `POST`  | `/subscribe`                        | New subscriber double opt-in registration                                   |
| `GET`   | `/confirm-subscription`             | Confirm signup and establish subscriber session                             |
| `POST`  | `/login`                            | Request passwordless magic login link                                       |
| `GET`   | `/verify-login`                     | Redeem magic link and initialize subscriber session                         |
| `POST`  | `/logout`                           | Terminate subscriber session                                                |
| `GET`   | `/me`                               | Fetch authenticated subscriber profile                                      |
| `PATCH` | `/me`                               | Update routine schedule, timezone, track, or pause/resume                   |
| `GET`   | `/me/history`                       | View subscriber email delivery history                                      |
| `GET`   | `/api/coach-personas`               | List 5 AI morning coach persona archetypes                                  |
| `POST`  | `/me/coach-persona`                 | Update coaching persona preference                                          |
| `POST`  | `/me/channels`                      | Update Discord webhook & Telegram chat ID notifications                     |
| `POST`  | `/me/outbound-webhook`              | Configure outbound automation webhook (Zapier/Make)                         |
| `GET`   | `/api/journal/today`                | Fetch today's reflection note and mood score                                |
| `POST`  | `/api/journal/save`                 | Save daily reflection, gratitude, and mood score                            |
| `GET`   | `/api/journal/heatmap`              | Aggregated 365-day consistency heatmap data                                 |
| `GET`   | `/api/journal/history`              | List recent 30 reflection entries                                           |
| `GET`   | `/api/journal/export`               | Export all reflections as Markdown or JSON                                  |
| `GET`   | `/api/streak-card/:email/card.svg`  | Dynamic high-DPI SVG streak share card                                      |
| `POST`  | `/api/push/subscribe`               | Register browser Web Push subscription                                      |
| `GET`   | `/unsubscribe`                      | 1-Click cryptographically signed unsubscribe confirmation                   |

---

### 2. Admin & Telemetry Endpoints (Gated via `mrn_role=admin`)

| Method   | Endpoint                           | Description                                                         |
| :------- | :--------------------------------- | :------------------------------------------------------------------ |
| `GET`    | `/admin-dashboard`                 | Obsidian Glassmorphism Admin Command Center                         |
| `POST`   | `/verify-admin-key`                | Authenticate master `ADMIN_KEY` or temporary Redis key              |
| `GET`    | `/generate-admin-key`              | Generate 5-minute temporary admin key (requires `ADMIN_KEY` header) |
| `GET`    | `/admin/subscribers`               | List subscribers with search & filter                               |
| `POST`   | `/admin/subscribers`               | Manually add subscriber                                             |
| `PATCH`  | `/admin/subscribers/:email`        | Update subscriber attributes or toggle active state                 |
| `DELETE` | `/admin/subscribers/:email`        | Remove subscriber record                                            |
| `GET`    | `/admin/subscriber-stats`          | Aggregated metrics (total, active, paused, 7D/30D/90D growth)       |
| `GET`    | `/admin/api/telemetry-overview`    | Real-time 7D & 30D delivery, open, and bounce rates                 |
| `GET`    | `/admin/api/recent-events`         | Live webhook delivery feed from SMTP providers                      |
| `POST`   | `/admin/api/retry-failed`          | 1-Click dead-letter retry for failed dispatches                     |
| `POST`   | `/admin/api/trigger-weekly-digest` | Trigger Sunday weekly digest batch dispatch                         |
| `POST`   | `/send-test-email`                 | Dispatch test routine email with selected track theme               |
| `POST`   | `/send-bulk-now`                   | Trigger immediate bulk dispatch to all active subscribers           |
| `GET`    | `/scheduled-jobs`                  | List active `node-cron` schedulers                                  |
| `GET`    | `/read-db`                         | Inspect raw `email_tracker` audit logs                              |
| `POST`   | `/admin/cleanup-database`          | Prune email audit logs older than N days                            |
| `POST`   | `/admin/cleanup-logs`              | Purge disk log files older than 3 days                              |
| `GET`    | `/health`                          | System health check (uptime, memory, scheduling mode)               |

---

## ⚙️ Environment Variables

Create a `.env` file in the root directory (see [`.env.example`](./.env.example)):

```env
# Server & Environment
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

# AI Providers (Gemini / OpenAI / Ollama / Curated)
LLM_PROVIDER=curated
GEMINI_API_KEY=your-gemini-api-key
OPENAI_API_KEY=your-openai-api-key
OLLAMA_BASE_URL=http://localhost:11434
OLLAMA_MODEL=mistral

# Multi-Channel Dispatch (Optional)
TELEGRAM_BOT_TOKEN=your-telegram-bot-token

# Web Push (VAPID Keys)
VAPID_PUBLIC_KEY=your-vapid-public-key
VAPID_PRIVATE_KEY=your-vapid-private-key
VAPID_SUBJECT=mailto:your-email@domain.com

# External APIs & Logging
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

## 🧪 Testing & Code Quality

Run the comprehensive Jest test suite, AST syntax validator, linter, and Prettier check:

```bash
# Run all 34 test suites (211 unit/integration tests)
npm test

# Run AST syntax check across all JavaScript files
npm run check:syntax

# Run ESLint 9 validation
npm run lint

# Verify Prettier code style formatting
npm run format:check

# Run tests in watch mode
npm run test:watch

# Test SMTP connectivity
npm run test:smtp
```

---

## 🌐 Production Deployment (Render)

1. Push your branch to GitHub (`master`).
2. In your Render Dashboard:
   - Set **Build Command**: `npm install`
   - Set **Start Command**: `npx knex migrate:latest && node index.js`
   - Configure environment variables in the **Environment** tab.
3. Render will build and deploy the web service automatically with zero downtime.
4. Verify deployment health at: `https://morning-routine-sender.onrender.com/health`

---

## 📄 License

Distributed under the **MIT License**. Created with 💜 by **Priyanshu** — [priyanshu-eureka.netlify.app](https://priyanshu-eureka.netlify.app/).
