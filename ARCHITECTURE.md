# Architecture & System Design

This document covers the architectural philosophy, subsystem layering, end-to-end request flows, and critical design decisions for **Morning Routine Sender**.

---

## 1. High-Level Layering & Module Topology

```
index.js  (Application Composition Root & Global Error Shields)
   │
   ├── middleware/        Cross-cutting guards (Rate limiting, Signed cookies, Context injection, Anti-spam)
   ├── routes/            Path → Controller router bindings (Zero business logic)
   ├── controllers/       Controller orchestrators (Request parsing, validation, HTTP response negotiation)
   ├── config/            Shared singletons (Knex PostgreSQL pool, Redis client, Nodemailer transporter, Env validator)
   ├── email-core/        Core delivery engine (Cron scheduler, MJML compiler, Telemetry tracker, Suppression list)
   ├── push-core/         Web Push VAPID notification engine
   ├── helper/            Domain services (AI LLM router, Multi-channel dispatcher, Journaling, SVG generator)
   └── public/js/         Client runtime (SWR cache, Web Audio synthesis, Haptic engine, Offline sync, App badging)
```

**Core Principle:**

- **Routes** know HTTP verbs and paths.
- **Controllers** orchestrate inputs and response codes.
- **Services & Helpers** execute business logic and database mutations.
- **Config** manages connections and singletons.

---

## 2. End-to-End Request & Delivery Flows

### A. Scheduled Routine Email & Multi-Channel Dispatch

```
emailScheduler.js (node-cron fires per subscriber's cron & timezone)
        │
        ▼
emailJobs.js (runRoutineEmailJob with timeout protection & suppression check)
        │
        ├──▶ helper/aiSparkGenerator.js (Resolves AI Coach Persona spark via Gemini/OpenAI/Ollama/Curated)
        ├──▶ helper/channelDispatcher.js (Parallel non-blocking Discord embed & Telegram Bot dispatch)
        ├──▶ helper/outboundWebhookDispatcher.js (Dispatches signed HMAC-SHA256 payload to Zapier/Make)
        │
        ▼
emailService.js (Compiles email-templates/email-template.mjml with dynamic theme tokens)
        │
        ▼
mailTransporter.js ──dispatches via SMTP──▶ Nodemailer
        │
        ▼
emailTracker.js (Logs dispatch record, attempt count, and latency in PostgreSQL `email_tracker`)
```

---

### B. Daily Habit Check-in & Offline Background Sync

```
User checks in via /user-dashboard or /routine companion
        │
        ├── If Online ──▶ POST /checkin (or GET /checkin?token=...)
        │                      │
        │                      ├── Validates subscriber & calculates unbroken streak count
        │                      ├── Triggers Outbound Webhooks (routine.completed)
        │                      ├── Syncs W3C App Badge via navigator.setAppBadge(streak)
        │                      └── Returns JSON payload with celebration triggers
        │
        └── If Offline ──▶ public/js/offline-sync.js
                               │
                               ├── Enqueues check-in request in IndexedDB (`checkin_queue`)
                               ├── Registers Service Worker Background Sync (`sync-morning-checkin`)
                               └── Dispatches when network reconnects ──▶ POST /checkin (X-Offline-Sync: true)
```

---

### C. Client UX Core Engine & SWR Caching (`public/js/ux-core.js`)

```
Page Load / Interaction (/user-dashboard)
        │
        ├── 1. UXCore.cache.get(key)
        │         │
        │         ├── Cache Hit ──▶ Immediately renders DOM (<10ms instant paint)
        │         └── Background ──▶ Fetches /me or /api/journal/heatmap and updates cache & DOM
        │
        ├── 2. Optimistic UI Mutations
        │         │
        │         ├── Click Check-in ──▶ Increments streak immediately, plays UXCore.sound.playSuccess()
        │         └── Click Save Note ──▶ Displays "Saved Just Now ✓", vibrates UXCore.haptics.light()
        │
        ├── 3. Keyboard Shortcuts Dispatcher (Space/C, J, H, S, ?, Esc)
        │         │
        │         └── Smart Input Isolation (Ignores keystrokes inside <input>, <textarea>, [contenteditable])
        │
        └── 4. Real-Time Network Monitor
                  │
                  └── Toggles floating glassmorphic offline pill banner & auto-dismisses on reconnect
```

---

### D. Multi-LLM AI Morning Coach Architecture (`helper/aiSparkGenerator.js`)

```
Subscriber Coach Preference (`subscribers.coach_persona`)
  [ 'stoic' | 'relentless' | 'zen' | 'tech-lead' | 'optimist' ]
        │
        ▼
aiSparkGenerator.generateAiSpark({ persona, track, theme })
        │
        ├── 1. Checks configured LLM_PROVIDER ('gemini' | 'openai' | 'ollama' | 'curated')
        ├── 2. Injects archetype system instructions & character tone constraints
        ├── 3. Executes API call with strict 4500ms timeout
        │
        └── 4. Graceful Fallback: If AI provider errors or times out,
               returns deterministic wisdom quote from helper/curatedSparks.js
```

---

### E. Inbound Webhook Telemetry & Dead-Letter Retry Engine

```
SMTP Provider (Resend / SendGrid / Brevo) fires webhook
        │
        ▼
POST /api/webhook/:provider  (routes/webhook.routes.js)
        │
        ▼
webhookParsers.js (Normalizes provider-specific payloads into standard event format)
        │
        ├── If Hard Bounce / Spam Complaint ──▶ suppressionService.recordSuppression()
        │                                           └── Marks subscriber inactive & blacklists email
        │
        └── Logs telemetry in `email_events` table (event_type: delivered, opened, clicked, bounced)
```

**Dead-Letter Retry:**

- Admin accesses **`/admin-dashboard`** ➔ `POST /admin/api/retry-failed`.
- Finds dispatches marked `failed` in `email_tracker` from the last 24h/48h/7d.
- Re-queues dispatches through `emailScheduler.sendRoutineEmail()` with exponential backoff.

---

### F. Sunday Weekly Performance Digest Engine

```
emailScheduler.js (Automated weekly cron trigger: '0 18 * * 0' / Sundays at 18:00)
        │
        ▼
runWeeklyDigestJob() (email-core/emailJobs.js)
        │
        ├── 1. Queries all active subscribers
        ├── 2. Checks emailTracker.wasEmailSentThisWeek() (prevents duplicate dispatches)
        ├── 3. Aggregates past 7-day journal entries, mood scores, and completion days
        ├── 4. Compiles Sunday MJML digest template with AI spark for upcoming week
        │
        ▼
Dispatches via mailTransporter with structured telemetry recording
```

---

## 3. Database Schema & Migration History

The database layer utilizes **PostgreSQL** with **Knex.js** migrations:

| Migration File                                           | Primary Tables & Columns Added                                                           |
| -------------------------------------------------------- | ---------------------------------------------------------------------------------------- |
| `20251009153643_create_email_tracker_table.js`           | `email_tracker` (recipient, status, sent_at, template_type, retry_count, metadata JSONB) |
| `20251009153701_create_last_run_table.js`                | `job_last_run` (job_name, last_run_at, status)                                           |
| `20260711172620_create_subscribers_table.js`             | `subscribers` (email, cron_pattern, timezone, is_active)                                 |
| `20260828000000_add_streaks_and_track_to_subscribers.js` | Adds `streak_count`, `last_completed_date`, `routine_track` to `subscribers`             |
| `20260828010000_create_suppression_and_events_tables.js` | `suppression_list` (bounces/complaints) and `email_events` (audit log)                   |
| `20260828020000_create_push_subscriptions_table.js`      | `push_subscriptions` (endpoint, auth, p256dh, subscriber_email)                          |
| `20260829000000_create_journal_entries_table.js`         | `journal_entries` (entry_date, mood_score, one_big_thing, gratitude, reflection_text)    |
| `20260829010000_add_channels_to_subscribers.js`          | Adds `discord_webhook_url`, `telegram_chat_id`, `channels_enabled`                       |
| `20260829020000_add_coach_persona_to_subscribers.js`     | Adds `coach_persona` (stoic, relentless, zen, tech-lead, optimist)                       |
| `20260829030000_add_outbound_webhooks_to_subscribers.js` | Adds `webhook_endpoint_url`, `webhook_secret`, `webhook_enabled`                         |
| `20260831000000_add_streak_freezes_to_subscribers.js`    | Adds `streak_freezes`, `freeze_history`                                                  |
| `20260912000000_create_accountability_squads_tables.js`  | Creates `accountability_squads` and `squad_members` tables with cascade deletion         |

---

## 4. Authentication & Security Design

1. **Dual-Tier Authentication**:
   - **Admin Console (`/admin-dashboard`)**: Master `ADMIN_KEY` direct login or Redis-backed temporary 5-minute single-use keys (`GET /generate-admin-key`). Successful authentication issues a 24-hour signed HMAC cookie (`mrn_role=admin`).
   - **Subscriber Portal (`/user-dashboard`)**: Passwordless double opt-in & magic links (`POST /login` ➔ 15-minute single-use Redis token ➔ `GET /verify-login` ➔ 30-day opaque session token in signed cookie).

2. **Enumeration-Resistant Endpoints**:
   - `/login` and `/subscribe` always return consistent timing-safe success responses regardless of whether the email is present in the database.

3. **Stateless HMAC Action Tokens**:
   - Unsubscribe links (`/unsubscribe?email=...&token=...`) and push check-in actions use stateless HMAC-SHA256 signatures verified with `crypto.timingSafeEqual()`.

4. **Anti-Spam Honeypot Defenses**:
   - `middleware/honeypot.js` monitors hidden form fields (`website`, `hp_username`) and silently drops automated bot submissions.

---

## 5. Testing & Verification Strategy

All unit and integration tests live in `__tests__/`:

- **Fast, Isolated, Zero-Dependency**: External networks, SMTP servers, AI LLMs, and Redis are completely mocked with deterministic stubs.
- **61 Test Suites (763/763 Passing)**:
  - Database schema and symmetric migration rollback consistency across all 12 migrations.
  - SWR caching, haptics, Web Audio, and keyboard hotkey dispatching (`ux.core.test.js`).
  - Accountability squads lifecycle & peer streaks (`squad.lifecycle.test.js`).
  - Habit analytics & morning audio briefings (`analytics.briefing.test.js`).
  - Web push action buttons & Schema.org email markup (`push.actions.schema.test.js`).
  - Multi-channel notification delivery (Discord embeds, Telegram bot API).
  - Outbound webhook HMAC signature validation.
  - Sunday weekly digest compilation & scheduler de-duplication.
  - OpenGraph dynamic meta tags & SVG streak share card generation.
  - Dead-letter retry and SMTP bounce suppression mechanisms.
