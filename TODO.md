# TODOs – Productivity Email Backend

This document tracks development progress and ideas.

---

## ✅ High Priority

- [ ] Docker setup
- [ ] Add a web UI or dashboard to view logs/tracker status
- [ ] Switch to SQLite, Redis, or a cloud KV store if file size becomes unmanageable

## 🧪 Testing

- [ ] Add unit tests using jest or vitest
- [ ] Export failures as CSV for ops/QA teams

## 🧹 Refactoring & Cleanup

- [ ]

## 🧾 Documentation

- [x] Write setup instructions in `README.md`
- [ ] Add usage and scheduling info
- [x] Document environment variables

## 💡 Ideas / Backlog

- [x] Supporting multiple email types
- [x] Adding retry + idempotency
- [ ] Logging to a file instead of console?
- [ ] Add analytics (open rate, click rate)
- [ ] Allow multiple recipients
- [ ] Add productivity score calculation

---

_Last updated: 2025-06-29_

========================
TEMPORARY_INFO....
npm run test:smtp

# Integration test

npm run db:migrate
node -e "require('./email-core/emailTracker').recordSend('test@example.com', 'default', 'msg-123')"

# Verify data

npx knex seed:run

=====================================

# 2. Test SMTP configuration

npm run test:smtp

# 3. Verify transporter in your app

node -e "require('./config/email-config').createTransporter()"

# 4. Send a real test email

node scripts/test-smtp.js

========
curl -X POST http://localhost:3000/send-test-email ^
-H "Content-Type: application/json" ^
-d "{\"email\":\"priyanshu.alt191@gmail.com\",\"templateType\":\"default\"}"

CLEANUP_CRON_SCHEDULE = 0 2 \* \* \*
LOG_MAX_FILES = 3d
LOG_MAX_SIZE = 10m
DB_RETENTION_DAYS = 30
ERROR_LOG_RETENTION_DAYS = 7
LOG_RETENTION_DAYS = 3
DB_PATH = ./storage/email-tracker.db
DB_CLIENT = sqlite3
USER_AGENT = Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/237.84.2.178 Safari/537.36
FROM_NAME = Morning Routine Sender
WORKER_CONCURRENCY = 5
REDIS_TLS = false
REDIS_DB = 0
REDIS_PASSWORD = eureka
REDIS_PORT = 6379
REDIS_HOST = localhost
LOG_LEVEL = info
TEST_EMAIL_2 = priyanshu.alt191@gmail.com
TEST_EMAIL = priyanshup28997@gmail.com
USE_MOCK_REDIS = true

❌ Failed to send email: Failed to execute 'json' on 'Response': Unexpected end of JSON input
Agar aapka Express app Nginx, Render, Vercel, ya AWS ALB ke peeche chal raha hai,
to req.protocol always "http" ya empty dikha sakta hai —
kyunki Express ko actual client protocol ka pata nahi hota.
✅ Fix: trust proxy enable karo
app.set("trust proxy", true);
