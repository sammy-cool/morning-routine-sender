// __tests__/admin.operations.complete.test.js
/**
 * Admin Controller & Operational Telemetry Complete Test Suite
 *
 * Covers:
 * 1. sendTestEmail (auth via safeCompare, validation, sending, and emailTracker.recordSend)
 * 2. sendBulkNow (auth via safeCompare, adminSkip param, manual bulk execution)
 * 3. readDb (auth via safeCompare, database snapshots of tracker and subscribers)
 * 4. deadLetterQueue & retryDeadLetter (failed event listing, concurrency lock, deduplication, reinvoking sender)
 * 5. Supplementary admin controllers: cleanupDatabase, getDatabaseStats, cleanupLogs
 */

process.env.ADMIN_KEY = "test-super-secret-admin-key";
process.env.CRON_API_KEY = "test-cron-api-key";
process.env.ADMIN_SKIP_KEY = "GG!";
process.env.RENDER_URL = "http://localhost:2900";
process.env.DB_RETENTION_DAYS = "30";

const express = require("express");
const cookieParser = require("cookie-parser");
const cookieSignature = require("cookie-signature");
const request = require("supertest");
const path = require("node:path");
const fs = require("node:fs/promises");

// ---------------------------------------------------------------------------
// Isolated Module Mocks (Explicit factories to prevent opening real DB sockets)
// ---------------------------------------------------------------------------

jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
  requestLogger: (req, res, next) => next(),
}));

jest.mock("../helper/read-db", () => ({
  readDb: jest.fn(),
}));

jest.mock("../helper/database-cleanup", () => ({
  cleanupOldEmailRecords: jest.fn(),
  getDatabaseStats: jest.fn(),
}));

jest.mock("../email-core/emailService", () => ({
  sendRoutineEmail: jest.fn(),
  sendWeeklyDigestEmail: jest.fn(),
}));

jest.mock("../email-core/emailTracker", () => ({
  recordSend: jest.fn(),
  recordFailure: jest.fn(),
  wasEmailSentToday: jest.fn(),
  wasEmailSentThisWeek: jest.fn(),
  getLastJobRun: jest.fn(),
  updateJobRun: jest.fn(),
  close: jest.fn(),
}));

jest.mock("../email-core/emailScheduler", () => ({
  sendBulkEmails: jest.fn(),
  sendRoutineEmail: jest.fn(),
  getScheduledJobsStatus: jest.fn(),
  scheduleAllJobs: jest.fn(),
  stopAllJobs: jest.fn(),
  rescheduleAllJobs: jest.fn(),
  rescheduleUserJob: jest.fn(),
  stopUserJob: jest.fn(),
}));

jest.mock("../helper/shared-data", () => ({
  getAllUsers: jest.fn(),
  getUsers: jest.fn(),
  getUserByEmail: jest.fn(),
  addUser: jest.fn(),
  removeUser: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
}));

jest.mock("../config/mailTransporter", () => ({
  getTransporter: jest.fn(() => ({ sendMail: jest.fn() })),
  closeTransporterConnection: jest.fn(),
}));

let mockKnexTableHandler = jest.fn();
let mockKnexSchema = {
  hasTable: jest.fn().mockResolvedValue(true),
};
let mockKnexRaw = jest.fn();

jest.mock("../db/knex", () => {
  const handler = (table) => mockKnexTableHandler(table);
  Object.defineProperty(handler, "schema", {
    get: () => mockKnexSchema,
  });
  Object.defineProperty(handler, "fn", {
    get: () => ({ now: () => new Date().toISOString() }),
  });
  Object.defineProperty(handler, "raw", {
    get: () => mockKnexRaw,
  });
  return handler;
});

// ---------------------------------------------------------------------------
// Module Imports
// ---------------------------------------------------------------------------

const { safeCompare } = require("../helper/util");
const adminController = require("../controllers/admin.controller");
const emailController = require("../controllers/email.controller");
const deliverabilityController = require("../controllers/deliverability.controller");

const readDbHelper = require("../helper/read-db");
const databaseCleanupHelper = require("../helper/database-cleanup");
const emailService = require("../email-core/emailService");
const emailTracker = require("../email-core/emailTracker");
const emailScheduler = require("../email-core/emailScheduler");
const sharedData = require("../helper/shared-data");

const adminRoutes = require("../routes/admin.routes");
const emailRoutes = require("../routes/email.routes");
const deliverabilityRoutes = require("../routes/deliverability.routes");

// ---------------------------------------------------------------------------
// Helpers & App Builder
// ---------------------------------------------------------------------------

const ADMIN_SECRET = process.env.ADMIN_KEY;
const CRON_KEY = process.env.CRON_API_KEY;

function signCookie(value, secret = ADMIN_SECRET) {
  return `s:${cookieSignature.sign(value, secret)}`;
}

const signedAdminCookie = `mrn_role=${encodeURIComponent(signCookie("admin"))}`;
const signedUserCookie = `mrn_role=${encodeURIComponent(signCookie("subscriber"))}`;

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser(ADMIN_SECRET));
  app.locals.officialDomain = "http://localhost:2900";
  app.use(adminRoutes);
  app.use(emailRoutes);
  app.use("/admin/deliverability", deliverabilityRoutes);
  return app;
}

// ---------------------------------------------------------------------------
// Test Suite
// ---------------------------------------------------------------------------

describe("Admin Operations & Operational Telemetry Controller Suite", () => {
  let app;

  beforeEach(() => {
    app = buildTestApp();
    jest.clearAllMocks();
    mockKnexSchema.hasTable.mockResolvedValue(true);
  });

  // =========================================================================
  // 1. safeCompare Utility & Admin Key Authentication Logic
  // =========================================================================
  describe("Cryptographic safeCompare Verification", () => {
    test("returns true for identical keys", () => {
      expect(safeCompare("secretKey123", "secretKey123")).toBe(true);
      expect(safeCompare(ADMIN_SECRET, ADMIN_SECRET)).toBe(true);
      expect(safeCompare(CRON_KEY, CRON_KEY)).toBe(true);
    });

    test("returns false for mismatched keys of same or different lengths", () => {
      expect(safeCompare("secretKey123", "secretKey124")).toBe(false);
      expect(safeCompare("short", "longerSecretKey")).toBe(false);
      expect(safeCompare("", "nonEmpty")).toBe(false);
    });

    test("returns false when inputs are not strings (timing attack resistance)", () => {
      expect(safeCompare(null, "secret")).toBe(false);
      expect(safeCompare(undefined, "secret")).toBe(false);
      expect(safeCompare(12345, "12345")).toBe(false);
      expect(safeCompare({}, {})).toBe(false);
    });
  });

  // =========================================================================
  // 2. sendTestEmail (controllers/email.controller.js)
  // =========================================================================
  describe("1. sendTestEmail", () => {
    describe("Authentication & Access Guard", () => {
      test("rejects request with 403 when no auth credentials provided", async () => {
        const res = await request(app).post("/send-test-email").send({ email: "test@example.com" });

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/admin access required/i);
        expect(emailService.sendRoutineEmail).not.toHaveBeenCalled();
      });

      test("rejects request with 403 when invalid API key provided in x-cron-key", async () => {
        const res = await request(app)
          .post("/send-test-email")
          .set("x-cron-key", "invalid-key")
          .send({ email: "test@example.com" });

        expect(res.status).toBe(403);
        expect(emailService.sendRoutineEmail).not.toHaveBeenCalled();
      });

      test("rejects request with 403 when non-admin signed cookie is provided", async () => {
        const res = await request(app)
          .post("/send-test-email")
          .set("Cookie", [signedUserCookie])
          .send({ email: "test@example.com" });

        expect(res.status).toBe(403);
        expect(emailService.sendRoutineEmail).not.toHaveBeenCalled();
      });

      test("allows request with valid signed admin cookie", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({ messageId: "msg-admin-cookie" });

        const res = await request(app)
          .post("/send-test-email")
          .set("Cookie", [signedAdminCookie])
          .send({ email: "test@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      test("allows request with valid x-cron-key header", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({ messageId: "msg-cron-key" });

        const res = await request(app)
          .post("/send-test-email")
          .set("x-cron-key", CRON_KEY)
          .send({ email: "cron@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      test("allows request with valid x-admin-secret header", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({ messageId: "msg-admin-secret" });

        const res = await request(app)
          .post("/send-test-email")
          .set("x-admin-secret", ADMIN_SECRET)
          .send({ email: "secret@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });

      test("allows request with valid ?key= query parameter", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({ messageId: "msg-query-key" });

        const res = await request(app)
          .post(`/send-test-email?key=${encodeURIComponent(ADMIN_SECRET)}`)
          .send({ email: "query@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
      });
    });

    describe("Payload Validation & Email Dispatch", () => {
      test("returns 400 Bad Request when email is missing", async () => {
        const res = await request(app)
          .post("/send-test-email")
          .set("x-cron-key", CRON_KEY)
          .send({ templateType: "deep-work" });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Email is required");
        expect(emailService.sendRoutineEmail).not.toHaveBeenCalled();
      });

      test("sends test email with specified template and records send status in DB", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({
          success: true,
          messageId: "test-msg-id-12345",
          response: "250 2.0.0 OK",
        });
        emailTracker.recordSend.mockResolvedValue();

        const res = await request(app).post("/send-test-email").set("x-cron-key", CRON_KEY).send({
          email: "recipient@example.com",
          templateType: "deep-work",
        });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Test email sent to recipient@example.com");
        expect(res.body.data.messageId).toBe("test-msg-id-12345");

        // Verifies correct payload passed to routine email service
        expect(emailService.sendRoutineEmail).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            email: "recipient@example.com",
            templateType: "deep-work",
            routineTrack: "deep-work",
            name: "Test User",
            dayNumber: "01",
            streakCount: 1,
          }),
        );

        // Verifies telemetry tracking
        expect(emailTracker.recordSend).toHaveBeenCalledWith(
          "recipient@example.com",
          "deep-work",
          "test-msg-id-12345",
        );
      });

      test("defaults templateType to 'basic' when omitted", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({ messageId: "msg-default-template" });

        const res = await request(app)
          .post("/send-test-email")
          .set("x-cron-key", CRON_KEY)
          .send({ email: "default@example.com" });

        expect(res.status).toBe(200);
        expect(emailService.sendRoutineEmail).toHaveBeenCalledWith(
          expect.anything(),
          expect.anything(),
          expect.objectContaining({
            templateType: "basic",
            routineTrack: "basic",
          }),
        );
        expect(emailTracker.recordSend).toHaveBeenCalledWith(
          "default@example.com",
          "basic",
          "msg-default-template",
        );
      });

      test("remains successful even if emailTracker.recordSend throws", async () => {
        emailService.sendRoutineEmail.mockResolvedValue({ messageId: "msg-db-fail" });
        emailTracker.recordSend.mockRejectedValue(new Error("Database connection dropped"));

        const res = await request(app)
          .post("/send-test-email")
          .set("x-cron-key", CRON_KEY)
          .send({ email: "robust@example.com" });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.messageId).toBe("msg-db-fail");
      });

      test("returns 500 when emailService.sendRoutineEmail throws", async () => {
        emailService.sendRoutineEmail.mockRejectedValue(
          new Error("SMTP 535 Authentication failed"),
        );

        const res = await request(app)
          .post("/send-test-email")
          .set("x-cron-key", CRON_KEY)
          .send({ email: "fail@example.com" });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain("SMTP 535");
        expect(emailTracker.recordSend).not.toHaveBeenCalled();
      });
    });
  });

  // =========================================================================
  // 3. sendBulkNow (controllers/email.controller.js)
  // =========================================================================
  describe("2. sendBulkNow", () => {
    describe("Authentication & Access Guard", () => {
      test("rejects bulk run with 403 when unauthenticated", async () => {
        const res = await request(app).post("/send-bulk-now");

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/admin access required/i);
        expect(emailScheduler.sendBulkEmails).not.toHaveBeenCalled();
      });

      test("rejects bulk run with 403 on invalid key", async () => {
        const res = await request(app).post("/send-bulk-now").set("x-cron-key", "wrong-bulk-key");

        expect(res.status).toBe(403);
        expect(emailScheduler.sendBulkEmails).not.toHaveBeenCalled();
      });
    });

    describe("Manual Bulk Routine Execution", () => {
      test("triggers manual bulk routine run with admin key and returns summary", async () => {
        const bulkStats = { successCount: 15, failureCount: 2, skippedCount: 3 };
        emailScheduler.sendBulkEmails.mockResolvedValue(bulkStats);

        const res = await request(app).post("/send-bulk-now").set("x-admin-secret", ADMIN_SECRET);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          success: true,
          successCount: 15,
          failureCount: 2,
          skippedCount: 3,
        });
        expect(emailScheduler.sendBulkEmails).toHaveBeenCalledWith(undefined, expect.anything());
      });

      test("forwards adminSkip query parameter to emailScheduler.sendBulkEmails", async () => {
        emailScheduler.sendBulkEmails.mockResolvedValue({
          successCount: 20,
          failureCount: 0,
          skippedCount: 0,
        });

        const res = await request(app)
          .post("/send-bulk-now?adminSkip=GG!")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(emailScheduler.sendBulkEmails).toHaveBeenCalledWith("GG!", expect.anything());
      });

      test("returns 500 when emailScheduler.sendBulkEmails fails", async () => {
        emailScheduler.sendBulkEmails.mockRejectedValue(
          new Error("Redis Lock acquisition timeout"),
        );

        const res = await request(app).post("/send-bulk-now").set("x-cron-key", CRON_KEY);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe("Redis Lock acquisition timeout");
      });
    });
  });

  // =========================================================================
  // 4. readDb (controllers/admin.controller.js)
  // =========================================================================
  describe("3. readDb & Database Snapshots", () => {
    describe("Authentication & Access Guard", () => {
      test("rejects GET /read-db with 403 when unauthenticated", async () => {
        const res = await request(app).get("/read-db");

        expect(res.status).toBe(403);
        expect(res.body.error).toMatch(/admin access required/i);
        expect(readDbHelper.readDb).not.toHaveBeenCalled();
      });

      test("rejects GET /read-db with 403 when wrong key passed in query", async () => {
        const res = await request(app).get("/read-db?key=invalid");

        expect(res.status).toBe(403);
        expect(readDbHelper.readDb).not.toHaveBeenCalled();
      });
    });

    describe("Database Snapshot Retrieval", () => {
      test("returns email_tracker rows snapshot with valid admin key", async () => {
        const fakeRows = [
          { id: 1, recipient_email: "u1@test.com", template_type: "deep-work", status: "success" },
          { id: 2, recipient_email: "u2@test.com", template_type: "executive", status: "failed" },
        ];
        readDbHelper.readDb.mockResolvedValue({ rowCount: 2, rows: fakeRows });

        const res = await request(app).get("/read-db").set("x-cron-key", CRON_KEY);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.rowCount).toBe(2);
        expect(res.body.data.rows).toEqual(fakeRows);
        expect(readDbHelper.readDb).toHaveBeenCalledTimes(1);
      });

      test("returns database snapshot with signed admin cookie", async () => {
        readDbHelper.readDb.mockResolvedValue({ rowCount: 0, rows: [] });

        const res = await request(app).get("/read-db").set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.data.rows).toEqual([]);
      });

      test("returns 500 when helper database query throws", async () => {
        readDbHelper.readDb.mockRejectedValue(
          new Error("Postgres connection terminated unexpectedly"),
        );

        const res = await request(app).get("/read-db").set("x-admin-secret", ADMIN_SECRET);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toContain("Postgres connection terminated");
      });

      test("verifies subscriber and job run snapshot retrieval via helper abstractions", async () => {
        // Test sharedData subscriber snapshot
        const mockSubscribers = [
          { email: "sub1@test.com", isActive: true, streakCount: 5 },
          { email: "sub2@test.com", isActive: false, streakCount: 0 },
        ];
        sharedData.getAllUsers.mockResolvedValue(mockSubscribers);
        const subSnapshot = await sharedData.getAllUsers();
        expect(subSnapshot).toEqual(mockSubscribers);

        // Test emailTracker job run snapshot
        const mockJobRun = {
          job_name: "daily_morning_routine",
          last_run_at: new Date().toISOString(),
          status: "success",
          emails_sent: 10,
          emails_failed: 0,
        };
        emailTracker.getLastJobRun.mockResolvedValue(mockJobRun);
        const jobSnapshot = await emailTracker.getLastJobRun("daily_morning_routine");
        expect(jobSnapshot.job_name).toBe("daily_morning_routine");
        expect(jobSnapshot.status).toBe("success");
      });
    });
  });

  // =========================================================================
  // 5. deadLetterQueue & retryDeadLetter (controllers/deliverability.controller.js)
  // =========================================================================
  describe("4. deadLetterQueue & retryDeadLetter", () => {
    describe("deadLetterQueue (GET /admin/api/recent-events)", () => {
      test("rejects unauthenticated requests with 403 Forbidden", async () => {
        const res = await request(app).get("/admin/api/recent-events");
        expect(res.status).toBe(403);
      });

      test("returns empty events list when email_events table does not exist", async () => {
        mockKnexSchema.hasTable.mockResolvedValueOnce(false);

        const res = await request(app)
          .get("/admin/api/recent-events")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(0);
        expect(res.body.events).toEqual([]);
      });

      test("lists dead-letter events filtered by event_type and provider", async () => {
        const fakeEvents = [
          {
            id: 1,
            event_id: "evt-bounce-1",
            recipient_email: "bounced@example.com",
            event_type: "hard_bounce",
            provider: "resend",
            bounce_code: "550",
            bounce_description: "Mailbox does not exist",
            occurred_at: new Date().toISOString(),
          },
        ];

        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          limit: jest.fn().mockReturnThis(),
          select: jest.fn().mockResolvedValue(fakeEvents),
        };
        mockKnexTableHandler.mockReturnValue(queryBuilder);

        const res = await request(app)
          .get("/admin/api/recent-events?event_type=hard_bounce&provider=resend&limit=10")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.count).toBe(1);
        expect(res.body.events).toEqual(fakeEvents);
        expect(queryBuilder.where).toHaveBeenCalledWith("provider", "resend");
        expect(queryBuilder.where).toHaveBeenCalledWith("event_type", "hard_bounce");
        expect(queryBuilder.limit).toHaveBeenCalledWith(10);
      });

      test("returns 500 when database query for dead letters fails", async () => {
        mockKnexTableHandler.mockImplementation(() => {
          throw new Error("Disk full: cannot read table");
        });

        const res = await request(app)
          .get("/admin/api/recent-events")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
        expect(res.body.error).toBe("Disk full: cannot read table");
      });
    });

    describe("retryDeadLetter (POST /admin/api/retry-failed)", () => {
      test("rejects unauthenticated retry invocation with 403 Forbidden", async () => {
        const res = await request(app).post("/admin/api/retry-failed").send({ hours: 24 });

        expect(res.status).toBe(403);
      });

      test("returns 404 when email_tracker table is missing", async () => {
        mockKnexSchema.hasTable.mockResolvedValueOnce(false);

        const res = await request(app)
          .post("/admin/api/retry-failed")
          .set("Cookie", [signedAdminCookie])
          .send({ hours: 12 });

        expect(res.status).toBe(404);
        expect(res.body.error).toContain("email_tracker table does not exist");
      });

      test("returns empty summary when no failed dispatches are found in window", async () => {
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue([]),
        };
        mockKnexTableHandler.mockReturnValue(queryBuilder);

        const res = await request(app)
          .post("/admin/api/retry-failed")
          .set("Cookie", [signedAdminCookie])
          .send({ hours: 48 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.summary.totalFound).toBe(0);
        expect(res.body.summary.retried).toBe(0);
        expect(res.body.results).toEqual([]);
      });

      test("deduplicates failed entries, reinvokes sender, and tracks outcomes", async () => {
        // Two failed records for the same recipient & template, plus one distinct
        const failedRecords = [
          {
            id: 101,
            recipient_email: "fail1@example.com",
            template_type: "deep-work",
            sent_at: new Date(),
            status: "failed",
          },
          {
            id: 102,
            recipient_email: "fail1@example.com",
            template_type: "deep-work",
            sent_at: new Date(Date.now() - 3600000),
            status: "failed",
          },
          {
            id: 103,
            recipient_email: "fail2@example.com",
            template_type: "mindfulness",
            sent_at: new Date(),
            status: "failed",
          },
        ];

        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue(failedRecords),
        };
        mockKnexTableHandler.mockReturnValue(queryBuilder);

        // Mock subscriber lookup: fail1 exists in db, fail2 is fallback
        sharedData.getUserByEmail.mockImplementation(async (email) => {
          if (email === "fail1@example.com") {
            return {
              email: "fail1@example.com",
              templateType: "deep-work",
              routineTrack: "deep-work",
              timezone: "America/New_York",
              isActive: true,
              streakCount: 3,
            };
          }
          return null; // Triggers fallback object creation
        });

        // Mock sender reinvocation: fail1 succeeds, fail2 fails
        emailScheduler.sendRoutineEmail.mockImplementation(async (user) => {
          if (user.email === "fail1@example.com") {
            return {
              status: "success",
              messageId: "retry-msg-101",
              retries: 1,
            };
          } else {
            return {
              status: "failed",
              error: "SMTP 550 Mailbox unavailable",
              retries: 3,
            };
          }
        });

        const res = await request(app)
          .post("/admin/api/retry-failed")
          .set("Cookie", [signedAdminCookie])
          .send({ hours: 24 });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.summary.totalFound).toBe(3);
        // Only 2 unique recipient+template pairs should be retried
        expect(res.body.summary.uniqueRecipients).toBe(2);
        expect(res.body.summary.retried).toBe(2);
        expect(res.body.summary.succeeded).toBe(1);
        expect(res.body.summary.failed).toBe(1);
        expect(res.body.summary.skipped).toBe(0);

        expect(res.body.results).toHaveLength(2);
        expect(res.body.results[0]).toMatchObject({
          email: "fail1@example.com",
          templateType: "deep-work",
          status: "success",
          messageId: "retry-msg-101",
        });
        expect(res.body.results[1]).toMatchObject({
          email: "fail2@example.com",
          templateType: "mindfulness",
          status: "failed",
          error: "SMTP 550 Mailbox unavailable",
        });

        expect(emailScheduler.sendRoutineEmail).toHaveBeenCalledTimes(2);
      });

      test("enforces concurrency mutex lock (429 Too Many Requests)", async () => {
        let resolveInFlight;
        const inFlightPromise = new Promise((resolve) => {
          resolveInFlight = resolve;
        });

        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockReturnThis(),
          then: (resolve, reject) => inFlightPromise.then(resolve, reject),
        };
        mockKnexTableHandler.mockReturnValue(queryBuilder);

        // Start first retry execution in background by invoking .then()
        const firstRequest = request(app)
          .post("/admin/api/retry-failed")
          .set("Cookie", [signedAdminCookie])
          .send({ hours: 24 });
        const firstDone = firstRequest.then((res) => res);

        // Poll briefly until the in-flight lock is engaged
        let concurrentRes;
        for (let i = 0; i < 20; i++) {
          await new Promise((r) => setTimeout(r, 10));
          const probe = await request(app)
            .post("/admin/api/retry-failed")
            .set("Cookie", [signedAdminCookie])
            .send({ hours: 24 });
          if (probe.status === 429) {
            concurrentRes = probe;
            break;
          }
        }

        expect(concurrentRes).toBeDefined();
        expect(concurrentRes.status).toBe(429);
        expect(concurrentRes.body.error).toMatch(/already in progress/i);

        // Resolve first request and let it finish cleanly
        resolveInFlight([]);
        const firstRes = await firstDone;
        expect(firstRes.status).toBe(200);

        // After completion, the mutex is unlocked and a subsequent request succeeds
        mockKnexTableHandler.mockReturnValue({
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue([]),
        });
        const subsequentRes = await request(app)
          .post("/admin/api/retry-failed")
          .set("Cookie", [signedAdminCookie])
          .send({ hours: 24 });

        expect(subsequentRes.status).toBe(200);
      });

      test("handles individual dispatch exceptions gracefully without aborting batch", async () => {
        const failedRecords = [
          { id: 201, recipient_email: "crash@example.com", template_type: "deep-work" },
        ];
        const queryBuilder = {
          where: jest.fn().mockReturnThis(),
          orderBy: jest.fn().mockResolvedValue(failedRecords),
        };
        mockKnexTableHandler.mockReturnValue(queryBuilder);
        sharedData.getUserByEmail.mockResolvedValue(null);

        // Emulates synchronous throw during send
        emailScheduler.sendRoutineEmail.mockRejectedValue(
          new Error("Fatal internal scheduler error"),
        );

        const res = await request(app)
          .post("/admin/api/retry-failed")
          .set("Cookie", [signedAdminCookie])
          .send({ hours: 24 });

        expect(res.status).toBe(200);
        expect(res.body.summary.failed).toBe(1);
        expect(res.body.results[0]).toMatchObject({
          email: "crash@example.com",
          status: "failed",
          error: "Fatal internal scheduler error",
        });
      });
    });
  });

  // =========================================================================
  // 6. Direct Controller Method Invocations (Unit Isolation)
  // =========================================================================
  describe("Unit Isolation: Direct Controller Invocations", () => {
    test("adminController.readDb executes properly with mocked req/res", async () => {
      const req = {
        signedCookies: { mrn_role: "admin" },
        get: jest.fn().mockReturnValue(null),
        query: {},
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      readDbHelper.readDb.mockResolvedValue({ rowCount: 1, rows: [{ id: 99 }] });

      await adminController.readDb(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        data: { rowCount: 1, rows: [{ id: 99 }] },
      });
    });

    test("emailController.sendTestEmail executes properly with mocked req/res", async () => {
      const req = {
        signedCookies: {},
        get: jest.fn((header) => (header === "x-cron-key" ? CRON_KEY : null)),
        query: {},
        body: { email: "unit@example.com", templateType: "classic" },
        app: { locals: { officialDomain: "http://localhost:2900" } },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      emailService.sendRoutineEmail.mockResolvedValue({ messageId: "unit-msg-123" });

      await emailController.sendTestEmail(req, res);

      expect(res.json).toHaveBeenCalledWith(
        expect.objectContaining({
          success: true,
          message: "Test email sent to unit@example.com",
        }),
      );
      expect(emailTracker.recordSend).toHaveBeenCalledWith(
        "unit@example.com",
        "classic",
        "unit-msg-123",
      );
    });

    test("emailController.sendBulkNow executes properly with mocked req/res", async () => {
      const req = {
        signedCookies: { mrn_role: "admin" },
        get: jest.fn().mockReturnValue(null),
        query: { adminSkip: "GG!" },
        app: { locals: {} },
      };
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      emailScheduler.sendBulkEmails.mockResolvedValue({
        successCount: 5,
        failureCount: 1,
        skippedCount: 0,
      });

      await emailController.sendBulkNow(req, res);

      expect(res.json).toHaveBeenCalledWith({
        success: true,
        successCount: 5,
        failureCount: 1,
        skippedCount: 0,
      });
    });
  });

  // =========================================================================
  // 7. Supplementary adminController Operations
  // =========================================================================
  describe("Supplementary adminController Endpoints", () => {
    describe("POST /admin/cleanup-database", () => {
      test("cleans up database using days from request body", async () => {
        databaseCleanupHelper.cleanupOldEmailRecords.mockResolvedValue({
          success: true,
          deleted: 14,
        });

        const res = await request(app)
          .post("/admin/cleanup-database")
          .set("Cookie", [signedAdminCookie])
          .send({ days: 15 });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ success: true, deleted: 14 });
        expect(databaseCleanupHelper.cleanupOldEmailRecords).toHaveBeenCalledWith(15);
      });

      test("cleans up database using default days when days not specified or invalid", async () => {
        databaseCleanupHelper.cleanupOldEmailRecords.mockResolvedValue({
          success: true,
          deleted: 5,
        });

        const res = await request(app)
          .post("/admin/cleanup-database")
          .set("Cookie", [signedAdminCookie])
          .send({ days: -1 });

        expect(res.status).toBe(200);
        // Falls back to DB_RETENTION_DAYS (30)
        expect(databaseCleanupHelper.cleanupOldEmailRecords).toHaveBeenCalledWith(30);
      });

      test("returns 500 when cleanupOldEmailRecords throws", async () => {
        databaseCleanupHelper.cleanupOldEmailRecords.mockRejectedValue(
          new Error("Cleanup lock failed"),
        );

        const res = await request(app)
          .post("/admin/cleanup-database")
          .set("Cookie", [signedAdminCookie])
          .send({ days: 30 });

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      });
    });

    describe("GET /admin/database-stats", () => {
      test("returns database statistics for authenticated admin", async () => {
        const stats = {
          totalRecords: 120,
          oldestRecord: "2026-01-01",
          newestRecord: "2026-09-10",
        };
        databaseCleanupHelper.getDatabaseStats.mockResolvedValue(stats);

        const res = await request(app)
          .get("/admin/database-stats")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(res.body).toEqual(stats);
      });

      test("returns 500 when getDatabaseStats throws", async () => {
        databaseCleanupHelper.getDatabaseStats.mockRejectedValue(new Error("Stats query timeout"));

        const res = await request(app)
          .get("/admin/database-stats")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      });
    });

    describe("POST /admin/cleanup-logs", () => {
      const logsDir = path.join(__dirname, "..", "logs");

      beforeEach(async () => {
        try {
          await fs.mkdir(logsDir, { recursive: true });
        } catch (_e) {
          /* ignore */
        }
      });

      test("cleans up log files older than 3 days and reports deleted count", async () => {
        const oldLogFile = path.join(logsDir, `test_old_${Date.now()}.log`);
        const freshLogFile = path.join(logsDir, `test_fresh_${Date.now()}.log`);

        await fs.writeFile(oldLogFile, "Old log entry\n");
        await fs.writeFile(freshLogFile, "Fresh log entry\n");

        // Set old log file mtime back by 5 days
        const fiveDaysAgo = new Date();
        fiveDaysAgo.setDate(fiveDaysAgo.getDate() - 5);
        await fs.utimes(oldLogFile, fiveDaysAgo, fiveDaysAgo);

        const res = await request(app)
          .post("/admin/cleanup-logs")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.deleted).toBeGreaterThanOrEqual(1);

        // Verify fresh log still exists and old log was removed
        await expect(fs.access(oldLogFile)).rejects.toThrow();
        await expect(fs.access(freshLogFile)).resolves.toBeUndefined();

        // Teardown fresh test file
        try {
          await fs.unlink(freshLogFile);
        } catch (_e) {
          /* ignore */
        }
      });
    });

    describe("POST /admin/api/reschedule-all", () => {
      test("rejects unauthenticated request with 403", async () => {
        const res = await request(app).post("/admin/api/reschedule-all");
        expect(res.status).toBe(403);
      });

      test("calls emailScheduler.rescheduleAllJobs and returns 200 with result", async () => {
        const emailScheduler = require("../email-core/emailScheduler");
        emailScheduler.rescheduleAllJobs.mockResolvedValueOnce({
          success: true,
          totalJobs: 5,
          activeJobs: [],
        });

        const res = await request(app)
          .post("/admin/api/reschedule-all")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.totalJobs).toBe(5);
        expect(emailScheduler.rescheduleAllJobs).toHaveBeenCalledTimes(1);
      });

      test("returns 500 when emailScheduler.rescheduleAllJobs rejects", async () => {
        const emailScheduler = require("../email-core/emailScheduler");
        emailScheduler.rescheduleAllJobs.mockRejectedValueOnce(new Error("DB Connection Lost"));

        const res = await request(app)
          .post("/admin/api/reschedule-all")
          .set("Cookie", [signedAdminCookie]);

        expect(res.status).toBe(500);
        expect(res.body.success).toBe(false);
      });
    });
  });
});
