# Changelog

All notable changes to the **Morning Routine Sender** project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [2.6.9] - 2026-08-31

### 📓 Reflection Journal Service, 365-Day Activity Heatmap & Vector Streak Badge Engine

- **Reflection Journal Service & CSV Injection Sanitization (`__tests__/journal.service.heatmap.test.js`)**:
  - Added comprehensive test suite covering 21 scenarios across `helper/journalService.js` and `helper/streakCardGenerator.js`.
  - Validated subscriber email normalization (`normalizeEmail`), localized timezone resolution (`getTodayDateInTimezone`), and subscriber context loading with requested date overrides.
  - Validated strict `mood_score` integer range validation ($1 \le \text{mood} \le 5$) and rejection of invalid values.
  - Validated idempotent upsert logic (`saveEntry`): updating existing records vs inserting new entries and resolving `subscriber_id`.
  - Validated historical query pagination with bound clamping ($1 \le \text{limit} \le 100$, $\text{offset} \ge 0$).
  - Validated Markdown reflection archive generation with average mood metrics, emoji mindset indicators, priority tasks, and gratitude highlights.
  - Validated RFC 4180 CSV export with formula injection sanitization (DDE prevention: neutralizing strings starting with `=`, `+`, `-`, `@`, `\t`, `\r` by prefixing `'`).
- **365-Day Continuous Activity Heatmap Time Series**:
  - Validated 365-day continuous chronological time-series generation, mapping activity to intensity levels 0-4.
  - Validated current streak backwards walk computation, longest streak retention, and completion percentage calculation.
- **Dynamic Vector Streak Card & QR Matrix Generator**:
  - Validated XML special character escaping (`&`, `<`, `>`, `"`, `'`).
  - Validated escalating milestone title thresholds (`First Light`, `Kinetic Momentum`, `Weekly Champion`, `Iron Consistency`, `Unbreakable Flow`, `Titan Habit`, `Master of Morning`).
  - Validated track metadata resolution (icons, colors, labels across 5 tracks).
  - Validated pure SVG vector QR code matrix generator with finder patterns, timing patterns, and FNV-1a hash distribution.
  - Validated full 1200x630 vector SVG badge card assembly with cyberpunk gradient cards, flame streak glows, and QR verification module.
- **Total Test Suite Metrics**:
  - Expanded test suites to **55 passed, 55 total suites** (**721 tests passing, 100% green**).

---

## [2.6.8] - 2026-08-31

### ⚙️ PWA Asset Generation, Client DOM Lifecycle, Schedulers & Deliverability DNS Guard Suite

- **Pure Node PWA Visual Asset Engine & CLI Utilities (`__tests__/scripts.node.test.js`)**:
  - Added comprehensive test suite covering 24 scenarios across `scripts/generate-pwa-assets.js`, `scripts/test-smtp.js`, and `scripts/monitor.js`.
  - Validated pure Node.js IEEE 802.3 32-bit CRC32 algorithm with standard test vectors (`0x00000000`, `0xCBF43926`).
  - Validated pure Node.js PNG encoder emitting valid 8-byte PNG signature, IHDR chunk (8-bit depth, RGBA type 6), row filter byte 0, zlib compressed IDAT chunk, and IEND trailer.
  - Validated 2D software rasterizer (`Canvas2D`): bounds-checked clipping, alpha blending compositing, fillRect, rounded rects, circles, lines, gradients, polygons, equalizers, and 5x4 dot-matrix font renderer.
  - Validated SMTP connection verification script (`scripts/test-smtp.js`) with exit code mocking (0 on success, 1 on connection/send failure).
  - Validated system health monitoring engine (`scripts/monitor.js`) covering `/health`, `/scheduled-jobs`, and `/admin/database-stats` probes.
  - Added CLI execution guards (`if (require.main === module)`) and exports to `generate-pwa-assets.js`, `test-smtp.js`, and `monitor.js`.
- **Browser & Client DOM Script Interactions (`__tests__/public.jsdom.test.js`)**:
  - Added test suite covering 19 client-side browser scenarios across `public/js/landing-page-modal.js`, `public/js/skeleton-loader.js`, `public/js/pwa-install.js`, `public/js/subscriber-login.js`, and `public/js/subscriber-signup.js`.
  - Validated admin modal focus trapping, accessibility attributes (`inert`, `aria-hidden`, `aria-expanded`), Escape key listener, and secret-based one-time key generation flow.
  - Validated skeleton loader particle burst animations inside `#logoBox`, 300ms transition fade-out, and DOM cleanup.
  - Validated PWA installation banner lifecycle, `beforeinstallprompt` event interception, standalone mode detection, 7-day dismissal cooldown in `localStorage`, and `appinstalled` celebration toast.
  - Validated subscriber login and signup forms: honeypot bot trap field forwarding, button disable states during fetch, CTA toast links, and server error response parsing.
- **Email Scheduler & Recurring Cron Jobs Engine (`__tests__/email.jobs.scheduler.test.js`)**:
  - Added test suite covering 16 scenarios across `email-core/emailJobs.js` and `email-core/emailScheduler.js`.
  - Validated daily routine dispatch and Sunday weekly digest cron scheduling with per-user timezone support.
  - Validated pre-send suppression checks with admin skip secret key override bypass (`ADMIN_SKIP_KEY`).
  - Validated duplicate send skipping via `wasEmailSentToday` and `wasEmailSentThisWeek`.
  - Validated transient retry recovery using `retryWithBackoff`, error classification diagnostics, and non-blocking Web Push & Multi-Channel notifications.
  - Dynamic evaluation of `process.env.ADMIN_EMAIL` in `alertAdmin()` to prevent undefined recipient alerts.
- **Deliverability DNS Guard, Tokens & Curated Sparks Matrix (`__tests__/dnsGuard.sparks.token.test.js`)**:
  - Added test suite covering 20 scenarios across `helper/dnsGuard.js`, `helper/unsubscribeToken.js`, `helper/curatedSparks.js`, and `helper/read-db.js`.
  - Validated DNS deliverability audit (`performDeliverabilityAudit`): SPF validation (single record RFC check, `+all` / `?all` warnings, lookup count bounds), DKIM selector inspection (1024-bit vs 2048-bit key length warnings), DMARC policy compliance, and MX priority sorting.
  - Validated deterministic action-scoped HMAC SHA-256 tokens (`generateActionToken`, `verifyActionToken`) and constant-time comparison timing attack resistance.
  - Validated 5 coach persona specifications (`stoic`, `relentless`, `zen`, `tech-lead`, `optimist`), streak milestone tiers (1, 3, 7, 14, 30, 60, 100), and deterministic seed selection.
  - Validated `readDb()` Knex database inspector query and error handling.
- **Total Test Suite Metrics**:
  - Expanded test suites to **54 passed, 54 total suites** (**700 tests passing, 100% green**).

---

## [2.6.7] - 2026-08-31

### 📱 Web Push Notifications, Magic Link Auth Lifecycle, Webhook Parsers & CLI Scripts Suite

- **Web Push Notifications Architecture & Endpoints (`__tests__/push.notifications.complete.test.js`)**:
  - Added comprehensive test suite covering all 52 push notification scenarios across `push-core/pushService.js`, `controllers/push.controller.js`, and `routes/push.routes.js`.
  - Validated VAPID keys initialization, public key distribution (`GET /api/push/vapid-public-key`), browser registration (`POST /api/push/subscribe`), unsubscription (`POST /api/push/unsubscribe`), and test push dispatching (`POST /api/push/send-test`, `POST /api/push/test`).
  - Validated automatic deactivation and dead-endpoint pruning upon receiving HTTP 410 Gone and 404 Not Found from push services.
  - Validated transient retry tracking and attempt incrementing for HTTP 429 Rate Limit, 500 Internal Error, and 503 Service Unavailable.
  - Fixed subscriber email case-normalization bug in [`push-core/pushService.js`](file:///home/smarty/projects/morning-routine-sender/push-core/pushService.js) before querying `db("subscribers")` for `subscriber_id`.
  - Converted `isConfigured` in `pushService.js` to a dynamic getter wrapping `initVapid()`.
- **Subscriber Authentication & Magic Link Lifecycle (`__tests__/subscriber.auth.lifecycle.test.js`)**:
  - Added test suite for subscriber magic link authentication across 24 test scenarios.
  - Validated 256-bit CSPRNG token generation, Redis storage with 15-minute TTL, single-use token consumption, and 30-day signed `mrn_session` cookie creation.
  - Validated user enumeration prevention: identical status codes and generic messaging for existing, non-existing, and invalid format email requests.
  - Validated hidden honeypot bot defense, replay attack prevention, and session profile authorization (`GET /me`).
- **Webhook Parsers, Error Classification & Retry Utilities (`__tests__/webhooks.parsers.classification.test.js`)**:
  - Added test suite for webhook normalization across 35 test scenarios covering 4 ESP formats: SendGrid, Mailgun, Postmark, and Resend.
  - Validated HMAC SHA-256 signature verification and payload tampering detection.
  - Validated error classifier distinguishing transient retryable SMTP/HTTP codes (421, 450, 451, 452, 429, 502, 503, 504) from permanent fatal codes (550-554, 400, 401, 403, 404).
  - Validated exponential backoff with decorrelated half-jitter bounded within $[0.5 \times \text{expCap}, \text{expCap}]$.
- **Database Maintenance & Migration Scripts (`__tests__/scripts.maintenance.migration.test.js`)**:
  - Added test suite covering 21 CLI and maintenance script scenarios.
  - Validated `run-db-maintenance.js` executing `VACUUM (ANALYZE)` across all 6 core PostgreSQL tables with isolated error resilience.
  - Validated `migrate-json-to-db.js` chunked batch inserts, date formatting, and automated JSON backup renaming.
  - Validated `migrate-users-to-db.js` idempotent merge and streak data preservation (`streak_count`, `last_checkin_date`, `streak_freeze_count`, `routine_track`).
  - Added `if (require.main === module)` CLI execution guards and module exports to `migrate-json-to-db.js`, `migrate-users-to-db.js`, and `verify-deployment.js`.
  - Added explicit `return` statements after `process.exit` in `verify-deployment.js` to prevent lingering retry loops.
- **Total Test Suite Metrics**:
  - Test suite coverage expanded to **50 passed, 50 total suites** (**621 tests passing, 100% green**).

---

## [2.6.6] - 2026-08-31

### 🔐 Admin Authentication, Telemetry Operations, Email Tracker Lifecycle & Dual Auth Security

- **Admin Auth Controller & Secret Job Scheduler (`__tests__/auth.controller.complete.test.js`)**:
  - Added comprehensive test suite covering all 37 authentication and job scheduler scenarios.
  - Validated `generateAdminKey`: header/query secret validation, 32-byte hex one-time key generation via CSPRNG, Redis storage with 300s TTL (`admin_key:<key>`), and 503 Redis failure recovery.
  - Validated `verifyAdminKey`: constant-time `safeCompare` against master `ADMIN_KEY`, signed 24h `mrn_role=admin` cookie issuance, Redis one-time key atomic consumption (`redis.del`), and fallback role `user`.
  - Validated `secretJobsScheduler`: development environment IP restriction (rejecting non-localhost clients), valid action dispatching (`start` / `stop`) with one-time key invalidation.
- **Admin Operations & Bulk Email Dispatching (`__tests__/admin.operations.complete.test.js`)**:
  - Validated `sendTestEmail`: dual API key authentication (`CRON_API_KEY` and `ADMIN_KEY` via `safeCompare`), cookie session authentication, template type defaults, and email delivery dispatch.
  - Validated `sendBulkNow`: administrative triggering of bulk routine dispatches with dual auth verification and error resilience.
  - Validated `readDb`: administrative inspection of subscribers and job logs with dual auth verification.
  - Validated `deadLetterQueue` & `retryDeadLetter`: listing failed delivery entries, distributed retry concurrency locking (preventing duplicate retry dispatches), and retry metadata incrementation.
  - Validated administrative log cleanup and database vacuum retention operations.
- **Email Tracker Telemetry & Database Retention (`__tests__/email.tracker.cleanup.test.js`)**:
  - Validated `recordSend` and `recordFailure` persistence across SQLite and PostgreSQL databases using Knex transactions.
  - Validated `getDeliverabilityMetrics`: bounce rate, open rate, click-through rate, and aggregate success computation.
  - Validated `wasEmailSentToday` timezone-aware boundary checks and Redis query caching with automated invalidation.
  - Validated `helper/database-cleanup.js`: 30-day email tracker retention pruning, 90-day dead letter log compaction, and database vacuum/analyze.
- **Security & Dual Auth Shadowing Fix**:
  - Resolved API key shadowing in [`controllers/email.controller.js`](file:///home/smarty/projects/morning-routine-sender/controllers/email.controller.js) (`sendTestEmail` & `sendBulkNow`) and [`controllers/admin.controller.js`](file:///home/smarty/projects/morning-routine-sender/controllers/admin.controller.js) (`readDb`) where `CRON_API_KEY || ADMIN_KEY` shadowed `ADMIN_KEY`. Both keys are now independently evaluated safely with `safeCompare`.
- **Test Suite Expansion**:
  - Total test suites expanded to **46 passed, 46 total** (**489 tests, 100% green**).

---

## [2.6.5] - 2026-08-31

### 🛡️ Complete 11-Migration Symmetric Rollback, Outbound HMAC Webhooks, Multi-Channel Failovers & SMTP Matrix Testing

- **Database Migrations Reversibility & Integrity Matrix (`__tests__/db.migrations.complete.test.js`)**:
  - Added comprehensive test suite executing full schema creation across all 11 Knex migrations (`20251009153643` through `20260831000000`).
  - Validated symmetric full rollbacks (`down()` 11 through 1) and granular step-by-step rollbacks verifying all 7 tables (`email_tracker`, `job_last_run`, `subscribers`, `suppression_list`, `email_events`, `push_subscriptions`, `journal_entries`).
  - Tested 23 cumulative `subscribers` column defaults, foreign key cascades (`ON DELETE CASCADE` on `push_subscriptions` and `journal_entries`), and unique constraints (`email`, `job_name`, `endpoint`, composite `[subscriber_email, entry_date]`).
- **Cryptographic Outbound Webhooks & Multi-Channel Failovers (`__tests__/outbound.analytics.channels.test.js`)**:
  - Validated HMAC SHA-256 signatures (`X-MorningRoutine-Signature`), payload structure, and 5000ms AbortController timeout boundaries.
  - Validated exponential backoff retries on network/5xx errors and fail-fast aborts on 4xx client errors.
  - Verified `Promise.allSettled` channel isolation: Discord webhook failures do not cascade or block Telegram bot notifications.
  - Verified subscriber analytics calculation: window clamping (`?days=1..365`), active/paused ratios, and streak distribution cohorts.
- **Security Utilities, CSPRNG Token Generator & Error Serialization (`__tests__/helpers.security.serializer.test.js`)**:
  - Validated Error serialization for database logging (Axios HTTP codes, Postgres codes, native exceptions, circular references, and 5-frame stack trace truncation).
  - Validated constant-time `safeCompare` pre-hashed SHA-256 comparison preventing timing side-channel attacks across mismatched buffer lengths.
  - Exported `generateRandomString` from [`helper/util.js`](file:///home/smarty/projects/morning-routine-sender/helper/util.js) and verified CSPRNG Shannon entropy ($> 3.5$ bits/char) and collision resistance across 10,000 generated tokens.
  - Verified DNS Deliverability Guard (`auditSPF`, `auditDMARC`, `auditMX`, `auditDKIM`, and DNS timeout error resilience).
- **Core Express Middlewares (`__tests__/middleware.core.test.js`)**:
  - Added test suite for `requireAdmin` cookie guards, `setApiBase` URL resolution, `checkHoneypot` bot suppression, `rateLimiters`, and `subscriberSession` Redis/token authentications.
- **SMTP Provider Presets & Transporter Pool Lifecycle (`__tests__/config.smtp.providers.test.js`)**:
  - Validated standard provider presets (Gmail, SendGrid, AWS SES, Mailgun, Zoho, Outlook, Office365) and port/TLS defaults.
  - Verified Redis mock/live client switches, TLS options, and exponential retry strategy.
  - Verified Nodemailer pooled connection defaults and singleton lifecycle teardown.
- **Test Suite Expansion**:
  - Added 5 new comprehensive test suites.
  - Total test suites expanded to **43 passed, 43 total** (**372 tests, 100% green**).

---

## [2.6.4] - 2026-08-31

### 🚀 Enterprise CI/CD Pipeline, Multi-Platform SEO & Rich Email Plain-Text Integration

- **Enterprise CI Pipeline Optimization (`.github/workflows/ci.yml`)**:
  - Implemented top-level `permissions: contents: read` enforcing least-privilege security.
  - Added strict job timeouts (`timeout-minutes: 10` on lint & audit, `timeout-minutes: 15` on tests) preventing hung runners.
  - Expanded automated test matrix across Active LTS Node versions: `18.x`, `20.x`, and `22.x` with `fail-fast: false`.
  - Re-ordered step sequence: Prettier format fast-fail -> AST syntax validation -> ESLint analysis -> Security vulnerability audit -> Matrix test runner.
- **Search Engine Optimization (SEO), Structured Data & Sitemaps**:
  - **Schema.org Rich Snippets (`public/main-index.html`)**: Added `WebSite`, `Organization`, and `FAQPage` JSON-LD schemas enabling Google Search FAQ rich snippets for landing page questions.
  - **Live Companion SEO (`controllers/routine.controller.js`)**: Injected canonical URL (`/routine`), meta description, OpenGraph (`og:title`, `og:image`, `og:url`), and Twitter Cards to the Live Focus Companion view.
  - **Public Streak Share Metadata (`controllers/pages.controller.js`)**: Added `robots: index, follow`, `twitter:site: @MorningRoutine`, and PWA mobile status meta tags to `/streak/:handleOrEmail`.
  - **Sitemap Freshness (`public/sitemap.xml`)**: Updated `lastmod` timestamps to `2026-08-31` and pruned `noindex` offline shell URL from sitemap index.
  - **PWA Asset Integrity (`public/offline.html`)**: Added explicit `<link rel="icon">`, `<link rel="apple-touch-icon">`, and `<link rel="manifest">` tags.
- **Transactional & Daily Email Plain-Text Fallbacks & ESP Resilience**:
  - **Rich Plain-Text Rendering (`email-core/emailService.js`)**: Expanded text fallbacks to include AI Morning Kickoff Spark, Coach Mantra, 2-Min Micro-Action, and 4-item Habit Checklist.
  - **Bulk RFC Headers**: Added `Precedence: bulk`, `Auto-Submitted: auto-generated`, and `X-Entity-Ref-ID` preventing Gmail conversation thread collisions and auto-responder loops.
  - **Transactional Text Fallbacks (`controllers/signup.controller.js`, `controllers/subscriberAuth.controller.js`)**: Added `text` properties across signup confirmation, magic login, and welcome emails.
  - **Weekly Digest Parity (`helper/shared-data.js`)**: Added `career` and `reflection` track configurations to `WEEKLY_DIGEST_CONFIGS`.
- **Security Boundaries & Input Sanitization**:
  - **CSV Formula Injection Prevention (`helper/journalService.js`)**: Prefixed formula triggers (`=`, `+`, `-`, `@`, `\t`, `\r`) with single quotes to defend exported CSVs against CWE-1236.
  - **History Query Limit Clamping (`controllers/me.controller.js`)**: Clamped `req.query.limit` within `[1, 100]` preventing negative limits or unbounded queries.
- **Expanded Test Suite Coverage**:
  - Added [`__tests__/seo.link.integrity.test.js`](file:///home/smarty/projects/morning-routine-sender/__tests__/seo.link.integrity.test.js) testing static asset presence, meta tags, sitemaps, robots.txt, and LLM context endpoints.
  - Added [`__tests__/email.templates.rendering.test.js`](file:///home/smarty/projects/morning-routine-sender/__tests__/email.templates.rendering.test.js) testing HTML/plain-text rendering across all 7 tracks, headers, and digest metrics.
  - Added [`__tests__/edge.boundaries.security.test.js`](file:///home/smarty/projects/morning-routine-sender/__tests__/edge.boundaries.security.test.js) testing CSV formula injection defense, query limits, and corrupted timezone resilience.
  - Test suite coverage expanded to **38 test suites / 276 tests** (100% passing).

---

## [2.6.3] - 2026-08-31

### 🌟 Comprehensive End-to-End Testing, Concurrency Guards, Track Configs & UI Audio Polish

- **Full-App Scenario & E2E Integration Suite (`__tests__/full.app.scenarios.e2e.test.js`)**:
  - Added full end-to-end integration test suite verifying the complete multi-platform loop:
    - Double opt-in signup with track preservation -> Confirmation & session issuance -> Preferences customization (`PATCH /me/preferences`) -> AI Coach Persona assignment (`POST /me/coach-persona`) -> Multi-channel notification dispatch -> 1-Click Habit Streak check-in (`GET /checkin`) -> Streak freeze shield usage (`POST /me/use-streak-freeze`) -> Multi-format Journal data export (`CSV`, `JSON`, `Markdown`).
  - Added parallel check-in concurrency test verifying absolute updates prevent streak race conditions.
  - Added procedural Web Audio and SWR LRU cache eviction unit assertions.
  - Test suite coverage expanded to **35 test suites / 233 tests** (100% passing).
- **Procedural Soundscape & Audio Interface Polish (`public/js/ux-core.js`)**:
  - Implemented `UXCore.sound.playClick()` (800 Hz triangle wave tone, 30ms) eliminating runtime `TypeError` when clicking theme options and UI controls.
  - Safeguarded `window.addEventListener("pagehide")` / `beforeunload` registration with `typeof window.addEventListener === 'function'` for universal Node / SSR / test runner execution.
- **Signup Track Selection Retention (`controllers/signup.controller.js`)**:
  - Retained custom `routineTrack` and `templateType` selections in Redis token payloads during double opt-in signup, guaranteeing user-selected tracks persist through subscription confirmation.
- **Rich Persona Track Config Coverage (`helper/shared-data.js`)**:
  - Added dedicated first-class configurations for `career` (_Career & Executive Growth_) and `reflection` (_Evening & Daily Reflection_) tracks, featuring personalized badges, taglines, quotes, rituals, and morning checklists.
- **Dead-Letter Retry Mutex Concurrency Lock (`controllers/deliverability.controller.js`)**:
  - Integrated `isRetryingDeadLetters` in-memory lock flag returning `429 Too Many Requests` during active retry jobs to prevent concurrent duplicate email and webhook dispatches from simultaneous admin triggers.
- **Resilient Timezone Fallback (`controllers/me.controller.js`)**:
  - Wrapped `Intl.DateTimeFormat` evaluations in safe try/catch blocks with automatic `"UTC"` fallback to prevent unhandled 500 errors on invalid subscriber timezone strings.
- **Versatile REST Route Aliasing (`routes/subscriberPortal.routes.js`)**:
  - Mounted convenience route aliases: `PATCH /me/preferences`, `POST /me/preferences`, `PATCH /me/channels`, and `POST /me/use-streak-freeze`.
  - Supported `persona` parameter alias in `POST /me/coach-persona`.

---

## [2.6.2] - 2026-08-31

### 🛡️ Permissions Policy, Service Worker Graceful Network Fallback, and WAI-ARIA Modal Accessibility Fixes

- **Explicit Permissions-Policy Header (`index.js`)**:
  - Configured `Permissions-Policy: camera=(), microphone=(), geolocation=(), payment=(), unload=*` middleware.
  - Resolves Chrome `[Violation] Permissions policy violation: unload is not allowed in this document` caused by browser extension content scripts registering unload hooks.
- **Service Worker Graceful Network Failure Handler (`public/sw.js`)**:
  - Added `.catch()` rejection handler to dynamic route handler (`isDynamicApi || req.method !== "GET"`).
  - Eliminates unhandled Service Worker promise rejections (`FetchEvent for /admin-dashboard resulted in a network error response: promise was rejected / TypeError: Failed to fetch`).
  - Returns structured 503 JSON offline response for API queries and styled 503 HTML offline shell for admin navigation.
  - Bumped Service Worker cache version to `v4.3.1`.
- **WAI-ARIA Focus Safety & `inert` Modal Management (`admin-renderer/views/admin-dashboard.html`, `public/js/landing-page-modal.js`, `public/js/user-dashboard.js`, `public/main-index.html`, `public/user-dashboard.html`)**:
  - Fixed `Blocked aria-hidden on an element because its descendant retained focus` console violation.
  - Relocated focus away from descendant close buttons (`<button class="btn btn-glass btn-sm">`) back to trigger element or `document.body` **before** applying `aria-hidden="true"`.
  - Added modern W3C `inert` attribute management on hidden modals (`#dbInspectorModal`, `#subscriberModal`, `#commandPaletteModal`, `#confirmDialogModal`, `#keyModal`, `#streakShareModal`, `#milestoneModal`, `#shortcutsModal`, `#heatmapDrawer`).

---

## [2.6.1] - 2026-08-31

### ⚡ Comprehensive Full-App GPU & Rendering Performance Optimization

- **Admin Dashboard High-Frequency Rendering & Bottleneck Elimination (`admin-renderer/views/admin-dashboard.html`)**:
  - **Eliminated Continuous Full-Viewport Rasterization**: Replaced infinite `@keyframes gradient-shift` and `background-attachment: fixed` on `body` with static, pre-rendered multi-radial gradient surfaces.
  - **Overlapping Gaussian Blur Elimination**: Removed heavy `backdrop-filter: blur(24px)` across sidebar and all cards; applied high-opacity obsidian surfaces (`rgba(13, 18, 30, 0.92)`), `contain: layout paint;`, and hardware compositing `transform: translateZ(0)`.
  - **Chart.js In-Place Memory & Canvas Updates**: Refactored `loadGrowthStats` and `renderTemplateDistributionChart` to mutate existing datasets in-place with `chart.update('none')`, preventing continuous canvas destruction and WebGL/2D context recreation.
  - **DOM & Memory Capping**: Capped live `ActivityLogger` to 50 items and DB Inspector query visualization to 50 paginated rows.
  - **Debounced Search & Command Palette**: Debounced live subscriber search, logs filtering, and Command Palette queries (150ms).
  - **Visibility-Aware Webhook Auto-Polling**: Integrated `isWebhookFetching` concurrency lock, increased poll interval to 20s, and attached `visibilitychange` listener to sleep background polling when tabs are hidden.
  - **Idempotent Offline Check Guard (`admin-renderer/js/admin-dashboard.js`)**: Added banner deduplication guard preventing redundant DOM node creation.

- **User Dashboard & Heatmap Optimization (`public/js/user-dashboard.js` & `public/user-dashboard.html`)**:
  - **Batch Heatmap Rendering**: Refactored `renderHeatmapGrid(days)` to construct 52-week month headers and 365 day cells into single `DocumentFragment` batches, replacing 365 consecutive DOM reflows with 1 single batch commit (`replaceChildren`).
  - **Single Delegated Event Listener**: Replaced 1,460 individual cell event listeners ($365 \times 4$) with 1 delegated listener on `#heatmapGrid`, cutting memory closures to zero.
  - **Layout Thrashing Elimination**: Wrapped tooltip reads/writes in `requestAnimationFrame` to eliminate forced synchronous reflows.
  - **IntersectionObserver Mobile Scroll Spy**: Replaced layout-measuring `scroll` listener with zero-overhead `IntersectionObserver`.
  - **Speech Visualizer Node Caching & rAF**: Pre-cached voice visualizer bar elements and converted visualizer update loop in `public/js/ux-core.js` to `requestAnimationFrame`.
  - **Debounced Journal Textarea**: Added 100ms debouncing to journal auto-expand input handler with rAF height calculation.

- **Public Landing, About, Offline & Loader Compositing Optimization**:
  - **`public/main-index.html`**: Reduced background mesh blob blur radii from 80px to 40px with `contain: strict; will-change: transform;`, optimized navbar blur to 10px, converted 6 Bento feature cards to solid high-opacity surfaces, and added `content-visibility: auto` to offscreen sections.
  - **`public/about.html`**: Removed expensive `blur(28px)` from 30+ story, track, feature, tech, and creator cards; added `content-visibility: auto` and GPU layer containment across all section blocks.
  - **`public/offline.html`**: Removed continuous 15s body keyframe gradient animations and converted offline card to hardware-accelerated solid obsidian surface.
  - **`public/css/loader.css`**: Replaced CPU `filter: drop-shadow` with `box-shadow` on rotating logo ring and upgraded skeleton shimmer from `background-position` animations to zero-paint GPU `transform: translateX()`.

- **Verification & Test Suite Integrity**:
  - All 34 test suites passing (220 tests, zero regressions).
  - Zero ESLint errors across the entire codebase (`npm run lint`).
  - Strict syntax validation passed for all JS files.

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
