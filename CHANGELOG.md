# Changelog

All notable changes to the **Morning Routine Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.1.0] - 2026-08-30

### 🚀 Added

- **365-Day Activity & Reflection Heatmap (GitHub-Style)**:
  - 52-week responsive CSS Grid visualization tracking daily habit consistency over 365 days.
  - 5 mood intensity levels (Level 0: Inactive, Level 1–2: Low/Challenging, Level 3: Balanced, Level 4: Focused, Level 5: Peak Flow).
  - Floating hover tooltip and slide-in reflection inspection drawer to review past wins, gratitude, and mindset notes.
  - Endpoint `GET /api/journal/heatmap?days=365` backed by `journalService.getActivityHeatmap`.

- **5 AI Morning Coach Personas & Customizer**:
  - Persona registry (`stoic`, `relentless`, `zen`, `tech-lead`, `optimist`) with distinct coaching archetypes, philosophy anchors, and tone guidelines.
  - Dynamic prompt builder injecting persona voice into multi-LLM dispatcher (Gemini / OpenAI / Ollama / Curated Fallback).
  - Subscriber preference management via `GET /api/coach-personas` and `POST /me/coach-persona`.
  - Database schema migration `20260829020000_add_coach_persona_to_subscribers.js`.

- **Outbound Automation Webhooks (Zapier / Make / Slack / Notion)**:
  - Non-blocking webhook dispatcher engine with HMAC-SHA256 signature verification (`X-MorningRoutine-Signature`), timestamp headers, and 5000ms timeout protection.
  - Automatic event dispatching for `routine.completed` and `journal.logged`.
  - Configuration and testing endpoints: `POST /me/outbound-webhook` and `POST /api/outbound-webhook/test`.
  - Database schema migration `20260829030000_add_outbound_webhooks_to_subscribers.js`.

- **Dynamic SVG Streak Share Cards & Viral Social Badges**:
  - High-DPI 1200x630 vector SVG generator with dark linear gradient aesthetic, glowing flame streak badge, milestone titles (_First Light_ ➔ _Master of Morning_), and deterministic vector QR verification matrix.
  - Public and authenticated endpoints: `GET /api/streak-card/:email/card.svg` and `GET /me/streak-card`.
  - Interactive social share modal with 1-click sharing to **X / Twitter**, **LinkedIn**, SVG link copy, and GitHub README Markdown badge code.

- **Dynamic Social OpenGraph (OG) & Share Landing Page**:
  - Public social landing route `GET /streak/:handleOrEmail` rendering rich OpenGraph (`og:title`, `og:image`, `og:description`) and Twitter card (`summary_large_image`) meta tags.
  - Interactive preview card displaying discipline track, momentum streak, and 1-click _"Start Your Routine"_ / _"View Live Companion"_ CTAs.

- **Sunday Weekly Performance Digest & Automated Cron**:
  - Automated weekly cron job running Sunday at 18:00 (6:00 PM) in each subscriber's local timezone.
  - Weekly idempotency guard (`emailTracker.wasEmailSentThisWeek`) preventing duplicate sends.
  - Responsive Sunday MJML digest template aggregating 7-day completion calendar, mood trends, high-leverage wins, and upcoming week AI spark.
  - Admin batch trigger endpoint `POST /admin/api/trigger-weekly-digest` with real-time telemetry summary.

- **PWA Native App Icon Badging API**:
  - W3C App Badging API integration (`public/js/app-badging.js`) setting the OS app icon / dock / taskbar badge to active habit streak count.
  - Service worker background update on push notifications, background sync, and dashboard check-in.

- **Enhanced Admin Raw Database Records Inspector (`email_tracker`)**:
  - Dual-mode Visual Grid + Raw JSON modal with search filters by recipient, template type, and status.
  - KPI summary counters (Total Records, Successful, Failed, Avg Retries, Active Errors).
  - Slide-in payload drawer and 1-click JSON export.

- **Multi-Channel Dispatch Engine (Discord Webhook + Telegram Bot)**:
  - Rich Discord embed dispatches and Telegram Markdown messages sent alongside morning routine emails.
  - Non-blocking 5000ms timeout with error isolation so primary email delivery is never interrupted.
  - Database schema migration `20260829010000_add_channels_to_subscribers.js`.

- **Daily Morning Journaling & Reflection Engine**:
  - Morning mindset reflection inputs (One Big Thing, Gratitude, Reflection Text, Mood Score 1–5).
  - Endpoints `GET /api/journal/today`, `POST /api/journal/save`, `GET /api/journal/history`, and `GET /api/journal/export?format=markdown`.
  - Database schema migration `20260829000000_create_journal_entries_table.js`.

- **PWA Offline Habit Check-in & Background Sync**:
  - Offline sync engine (`public/js/offline-sync.js` and `public/sw.js`) queueing habit check-ins in IndexedDB when offline.
  - Background Sync API (`sync-morning-checkin`) automatically draining and syncing queue upon network reconnection.

- **Developer Tooling & Code Quality Infrastructure**:
  - ESLint 9 Flat Config (`eslint.config.mjs`) and Prettier code formatter (`.prettierrc.json`).
  - AST Syntax Check script (`npm run check:syntax`) validating all project JavaScript files.
  - 33 automated test suites containing 201 unit & integration tests (`npm test`) with 100% pass rate.

### 🔄 Changed

- Refactored `controllers/routine.controller.js` to trigger outbound webhooks, PWA app badging, and background sync.
- Refactored `controllers/journal.controller.js` to dispatch outbound webhooks on reflection save.
- Refactored `controllers/pages.controller.js` and `routes/pages.routes.js` to support public streak sharing.
- Updated `public/user-dashboard.html` and `public/js/user-dashboard.js` with modern glassmorphism aesthetic and interactive modules.

---

## [1.0.0] - 2025-10-09

### 🚀 Added

- Automated morning routine scheduling with cron patterns and timezone support.
- Multi-track routines: Deep Work & Builder, Mindfulness & Zen, Executive Focus, Lifelong Learner, Physical Energizer.
- Knex.js database layer with PostgreSQL migrations for subscribers, email tracker, and last run tracking.
- Nodemailer email transport with MJML responsive templates.
- Admin dashboard for database monitoring, log cleanup, and subscriber management.
