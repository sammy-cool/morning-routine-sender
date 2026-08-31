# Changelog

All notable changes to the **Morning Routine Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.6.0] - 2026-08-31

### 🌟 Revolutionary 2026/2027 Full-App UI/UX Redesign & Brand Transformation

- **Cosmic Space Dark Design System (`#050608`)**:
  - Replaced legacy flat dark backgrounds with an ultra-deep obsidian space backdrop (`#050608`), ambient multi-point radial gradients, and animated fluid mesh blobs.
  - Upgraded core primary accent to electric violet (`#7c3aed`) with luminous glow halos (`rgba(124, 58, 237, 0.4)`), coupled with neon cyan (`#22d3ee`), emerald (`#34d399`), amber (`#fbbf24`), and rose (`#fb7185`).
- **Brand Geometry & High-DPI Visual Assets**:
  - Re-architected `public/assets/logo.svg` with multi-layered cosmic sunrise vectors, horizon refraction shimmers, dual orbital zen rings, and radiant violet-to-cyan aurora gradients.
  - Regenerated 512x512 maskable PWA app icons and high-resolution desktop/mobile screenshots (`scripts/generate-pwa-assets.js`).
- **Complete Multi-Page UI Redesign**:
  - **Landing Page (`public/main-index.html`)**: Bento grid architecture, live email preview simulator with interactive checklist states, live HUD clock, floating badge pill, and smooth dialog physics.
  - **Subscriber Dashboard (`public/user-dashboard.html`)**: Refreshed 4-theme palette (Obsidian, Solar Sunrise, Zen Emerald, Cyberpunk Neon), glowing streak hero aura, floating glass bottom navigation for mobile viewports, and smooth card entrance animations.
  - **About & Manifesto (`public/about.html`)**: High-converting narrative layout, glassmorphic comparative story cards, interactive ecosystem grid, and creator profile card.
  - **Live Focus Companion & Check-in (`controllers/routine.controller.js`)**: Violet-glow Pomodoro focus timer, interactive soundscape audio visualizers, and celebratory check-in fireworks.
  - **Admin Command Center (`admin-renderer/views/admin-dashboard.html`)**: Mission-control dark aesthetic, deep violet-blue vertical sidebar gradient, animated entrance cards, and deliverability guard.
  - **Public Streak Share Landing Page (`controllers/pages.controller.js` / `/streak/:handleOrEmail`)**: Dynamic OpenGraph landing page updated with brand logo and cosmic color scheme.
  - **PWA Offline Shell (`public/offline.html`) & Preloader (`public/css/loader.css`)**: Radar wave pulse animations, offline IndexedDB sync indicator, and violet-cyan ring loader.
- **Full Customizable Toast Notifications System & UXCore Engine Integration**:
  - Integrated full capabilities of `customizable-toast-notification@latest` across all platform pages (`public/main-index.html`, `public/user-dashboard.html`, `public/about.html`, `admin-renderer/views/admin-dashboard.html`, `/routine`, and `/checkin`).
  - Added unified `UXCore.toast` client subsystem in `public/js/ux-core.js` featuring convenience methods: `.success()`, `.error()`, `.info()`, `.warn()`, `.cta()`, `.routine()`, and `.streak()`.
  - Dynamic Theme Awareness: Toast countdown progress bars dynamically adapt to active themes (Electric Violet for Obsidian, Warm Gold for Solar, Zen Emerald for Emerald, and Magenta-Cyan for Cyberpunk).
  - Interactive Call-to-Action (CTA) toasts: Direct 1-click Focus Companion launcher upon signup, 1-click check-in launcher upon 25-minute Pomodoro focus sprint completion, and 1-click share trigger upon streak milestones.
  - Multi-sensory synchronization: Integrated procedural Web Audio chimes and mobile Web Vibration API haptics on toast dispatch.
- **Zero Breaking Changes**:
  - 100% functional element preservation across all form IDs, CSRF honeypots, Web Speech voice synthesis, Web Audio ambient generators, Service Worker caching, and Jest test runner (34 test suites, 220 tests passing).

---

## [2.5.0] - 2026-08-31

### 🚀 Added

- **Multi-Format Habit & Journal Data Export (CSV, JSON, Markdown)**:
  - Added RFC 4180 compliant CSV export generator (`journalService.generateCsvExport`) compatible with Microsoft Excel, Apple Numbers, and Google Sheets.
  - Endpoints `GET /api/journal/export?format=csv|json|markdown` and `GET /me/export?format=csv|json|markdown`.
  - Frontend 1-click export buttons in the Subscriber Dashboard.
- **Automated Web Push Morning Wake-Up Notifications**:
  - Timezone-synchronized background Web Push dispatches triggered alongside morning email and multi-channel webhooks (`pushService.dispatchMorningPushForSubscriber`).
  - Interactive notification actions (`⚡ Start Ritual` ➔ `/routine`, `🔥 1-Click Check-in` ➔ `/checkin`).
  - Native PWA app badge synchronization updating device streak icons.

---

## [2.4.1] - 2026-08-31

### 🚀 Visual Polish & Interactive Simulator

- **Interactive Live Email Simulator (`public/main-index.html`)**:
  - Live 3D-styled macOS email preview card with 5 interactive persona tabs (Deep Work, Stoic, Exec, Learner, Energizer).
  - Dynamic real-time updates for subject lines, curated quotes, and interactive habit checklist toggles.
- **Brand SVG Logo Deployment Across All Pages**:
  - Embedded high-DPI vector SVG brand logo (`public/assets/logo.svg`) across landing navbar, user dashboard, about page, and admin sidebar.
- **Real-Time Live HUD Clock**:
  - Pulsing status indicator displaying local user time and synchronization status.

---

## [2.4.0] - 2026-08-31

### 🎨 Visual & UI/UX Redesign Overhaul

- **Modern Vector Brand Identity (`public/assets/logo.svg`)**:
  - High-DPI scalable SVG brand logo featuring radiant sunrise geometry, sacred zen focus rings, and glowing auroras (Indigo `#6366f1`, Cyan `#06b6d4`, Emerald `#10b981`, Amber `#f59e0b`).
- **Dynamic Social Streak Share Experience (`controllers/pages.controller.js` / `/streak/:handleOrEmail`)**:
  - Upgraded high-impact glassmorphic share page with real-time vector SVG streak card preview.
  - 1-Click native social sharing directly to **X / Twitter** and **LinkedIn**, plus clipboard link copier with animated toast notification.
- **Next-Gen PWA Offline Shell (`public/offline.html`)**:
  - Glassmorphic offline card with radar wave pulse animation.
  - Real-time offline habit check-in queue counter inspecting IndexedDB and localStorage buffers.
  - 15-second automatic reconnection countdown progress meter and instant retry trigger.
- **Cross-Platform Responsive Bento Grid Architecture**:
  - 12-column adaptive layout across desktop, tablet, and mobile with bottom floating glass docks.
  - Timer teardown and `.unref()` protection across network banners and async visualizers.

---

## [2.3.1] - 2026-08-31

### 🛠️ Fixed & Performance

- **Memory Safety, Lifecycle Teardown & Graceful Shutdown**:
  - **Graceful Server Shutdown & In-Flight Draining**: Implemented asynchronous `server.close()` with keep-alive socket draining (`server.closeIdleConnections`), startup timer cancellation, explicit `db.destroy()` teardown, and 2-second Redis quit deadline with 10-second process watchdog.
  - **Node-Cron Teardown**: Updated `emailScheduler.stopAllJobs(true)` to fully stop background maintenance and cleanup jobs on process exit.
  - **LRU In-Memory Cache Bounds**: Bounded `UXCore.cache` (max 100 with O(1) LRU eviction), `sharedData.cache` (max 100), and `pagesController.templateCache` (max 50) to prevent heap leaks.
  - **AudioNode Graph Garbage Collection**: Guaranteed `onended` disconnect handlers on ephemeral oscillators and `pagehide`/`beforeunload` teardown for SpeechSynthesis and Web Audio engines.
  - **Zero Open Handle Leaks in Tests**: Disabled `DailyRotateFile` background timers in tests, defaulted `ioredis` to `RedisMock`, and eliminated `--forceExit` from Jest test runner.

---

## [2.3.0] - 2026-08-31

### 🚀 Added

- **Voice Briefing Engine (`UXCore.voice`)**:
  - Integrated native `window.speechSynthesis` with automated voice discovery (prefers natural English voices like Google US English, Samantha, Daniel).
  - Reads aloud daily coaching spark and philosophical mindset guidance.
  - Interactive audio wave visualizer with 5 animated frequency bars synced to voice activity.
- **Procedural Ambient Focus Soundscapes (`UXCore.ambient`)**:
  - Pure Web Audio API synthesis engine with zero external MP3s or network bandwidth overhead.
  - 3 procedural focus soundscape modes:
    - `binaural`: 10Hz Alpha Waves (200Hz base + 210Hz beat) for calm focused cognition and deep work.
    - `rain`: Pink noise buffer with randomized high-frequency water droplet oscillators.
    - `zen-waves`: Low-frequency sine LFO modulating filtered noise swell mimicking rhythmic ocean waves.
- **Dynamic 4-Theme Switching System (`UXCore.theme`)**:
  - 4 themes: **Obsidian** (default dark slate), **Solar Sunrise** (warm gold/amber), **Zen Emerald** (forest mint), and **Cyberpunk Neon** (electric violet/cyan).
  - CSS custom properties (`--bg-main`, `--bg-surface`, `--primary`, `--primary-glow`, `--accent-color`, `--theme-ambient-1/2/3`).
  - Floating Theme Picker dropdown with active swatch indicator, live preview, and `localStorage` persistence.
- **Interactive Spotlight Onboarding Walkthrough (`UXCore.tour`)**:
  - 3-step zero-dependency guided spotlight tour for new and returning subscribers (`1-Click Check-in` ➔ `Mindset Journal` ➔ `365-Day Consistency & AI Coaches`).
  - Glassmorphic spotlight card with progress dots, step counter, skip/back buttons, and celebration confetti on completion.
- **Streak Freeze Shields & Automated Gap Protection**:
  - Database schema migration `20260831000000_add_streak_freezes_to_subscribers.js` (`streak_freezes` default 2, `freeze_history` jsonb).
  - Automatic freeze shield consumption on 1-day missed gaps (`diffDays === 2`), preserving the user's hard-earned streak count.
  - Endpoints `GET /me/streak-freeze/status` and `POST /me/streak-freeze/use` for manual shield management.
- **Journaling Micro-Interactions & Hotkeys**:
  - Auto-expanding textareas on input.
  - Live character and word count tracking with "Thoughtful Reflection ✓" badge indicator.
  - `Ctrl+Enter` / `Cmd+Enter` keyboard shortcut to save reflections instantly.

---

## [2.2.0] - 2026-08-30

### 🚀 Added

- **Unified Client UX Core Subsystem (`public/js/ux-core.js`)**:
  - **SWR (Stale-While-Revalidate) Cache Engine**: Instant `<10ms` cache hits for subscriber profile, 365-day heatmap data, and today's reflection journal, backed by localStorage fallback and memory Map.
  - **Optimistic UI Updates**: Immediate streak increment and instant reflection save indicators with automatic, graceful rollback if network requests fail.
  - **Procedural Web Audio Synthesis Engine**: Zero external audio files/CDNs; synthesizes pleasant rising C Major triad chimes (`playSuccess`) and harmonic arpeggio fanfares (`playMilestone`) with exponential volume envelope decays.
  - **Mobile Haptic Feedback Engine**: Multi-pattern vibration feedback (`light`, `success`, `celebration`) using the Web Vibration API with resilient device guards.
  - **Accessible Keyboard Shortcuts Dispatcher**: Power-user global hotkeys (`Space`/`C` for habit check-in, `J` for reflection journal, `H` for 365-day heatmap, `S` for SVG streak share card, `?` for shortcuts guide, `Esc` to close all modals) with smart input exclusion.
  - **Real-Time Network Status Monitor**: Floating glassmorphic offline/online status banner with auto-sync status and smooth transition dismissal.

- **Interactive Gamification & Milestone Celebration Modal**:
  - Multi-tier milestone celebrations (Day 3, 7, 14, 30, 60, 100, 365) with custom consistency tiers (_Spark Initiate_, _Week 1 Champion_, _Habit Vanguard_, _Monthly Spartan_, _Diamond Titan_, _Centurion Master_, _Immortal Legend_).
  - Multi-cannon celebratory confetti bursts, animated flickering flame aura, Web Audio milestone fanfares, and 1-click social card share button.

- **Mobile Bottom Navigation Bar (< 768px)**:
  - Fixed glassmorphic navigation dock optimized for mobile viewports with 4 quick-action tabs (Dashboard, Heatmap, Journal, Live Companion).
  - Scroll-spy active section indicator and tactile haptic tap feedback.

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
