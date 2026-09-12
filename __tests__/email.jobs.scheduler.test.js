/**
 * Test Suite: Email Jobs & Scheduler Core
 * Verifies:
 *   - email-core/emailJobs.js (runEmailJob, runWeeklyDigestJob, alertAdmin)
 *   - email-core/emailScheduler.js (sendRoutineEmail, sendUserWeeklyDigest, sendBulkEmails, scheduleAllJobs, stopAllJobs, scheduleCleanupJobs)
 */

// Declare mock functions starting with 'mock' for Jest scope hoisting
const mockSendMail = jest.fn();
const mockGetTransporter = jest.fn(() => ({ sendMail: mockSendMail }));
const mockWasEmailSentToday = jest.fn();
const mockWasEmailSentThisWeek = jest.fn();
const mockRecordSend = jest.fn();
const mockRecordFailure = jest.fn();
const mockSendRoutineEmailService = jest.fn();
const mockSendWeeklyDigestEmailService = jest.fn();
const mockGetUsers = jest.fn();
const mockGetUserByEmail = jest.fn();
const mockDispatchWeeklyDigest = jest.fn();
const mockCheckPreSendEligibility = jest.fn();
const mockRetryWithBackoff = jest.fn();
const mockDispatchMorningPush = jest.fn();
const mockDispatchChannels = jest.fn();
const mockCleanupOldEmailRecords = jest.fn();
const mockOptimizeDatabase = jest.fn();

const mockCronSchedule = jest.fn();
const mockCronValidate = jest.fn();
const mockJobStop = jest.fn();
let mockCapturedCronCallbacks = [];

// Mock Knex DB builder
const mockKnexInstance = jest.fn(() => mockKnexInstance);
mockKnexInstance.schema = {
  hasTable: jest.fn().mockResolvedValue(true),
};
mockKnexInstance.where = jest.fn().mockReturnThis();
mockKnexInstance.first = jest.fn().mockResolvedValue(null);
mockKnexInstance.insert = jest.fn().mockResolvedValue([]);
mockKnexInstance.update = jest.fn().mockResolvedValue(1);

jest.mock("node-cron", () => ({
  validate: mockCronValidate,
  schedule: mockCronSchedule,
}));

jest.mock("../config/mailTransporter", () => ({
  getTransporter: mockGetTransporter,
}));

jest.mock("../email-core/emailTracker", () => ({
  wasEmailSentToday: mockWasEmailSentToday,
  wasEmailSentThisWeek: mockWasEmailSentThisWeek,
  recordSend: mockRecordSend,
  recordFailure: mockRecordFailure,
}));

jest.mock("../email-core/emailService", () => ({
  sendRoutineEmail: mockSendRoutineEmailService,
  sendWeeklyDigestEmail: mockSendWeeklyDigestEmailService,
}));

jest.mock("../email-core/suppressionService", () => ({
  checkPreSendEligibility: mockCheckPreSendEligibility,
}));

jest.mock("../helper/retryUtil", () => ({
  retryWithBackoff: mockRetryWithBackoff,
}));

jest.mock("../helper/errorClassifier", () => ({
  isRetryableError: jest.fn(() => false),
}));

jest.mock("../helper/shared-data", () => ({
  getUsers: mockGetUsers,
  getUserByEmail: mockGetUserByEmail,
}));

jest.mock("../helper/weeklyDigestService", () => ({
  dispatchWeeklyDigest: mockDispatchWeeklyDigest,
}));

jest.mock("../push-core/pushService", () => ({
  dispatchMorningPushForSubscriber: mockDispatchMorningPush,
}));

jest.mock("../helper/channelDispatcher", () => ({
  dispatchChannelsForSubscriber: mockDispatchChannels,
}));

jest.mock("../helper/database-cleanup", () => ({
  cleanupOldEmailRecords: mockCleanupOldEmailRecords,
  optimizeDatabase: mockOptimizeDatabase,
}));

jest.mock("../db/knex", () => mockKnexInstance);

jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const { runEmailJob, runWeeklyDigestJob } = require("../email-core/emailJobs");
const emailScheduler = require("../email-core/emailScheduler");

describe("Email Jobs & Scheduler Comprehensive Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    mockCapturedCronCallbacks = [];
    process.env = {
      ...originalEnv,
      ADMIN_EMAIL: "admin@example.com",
      FROM_USER: "sender@example.com",
      ADMIN_SKIP_KEY: "OVERRIDE_SECRET",
    };

    mockSendMail.mockResolvedValue({ messageId: "alert-msg-123" });
    mockCronValidate.mockReturnValue(true);
    mockCronSchedule.mockImplementation((pattern, fn, opts) => {
      mockCapturedCronCallbacks.push({ pattern, fn, opts });
      return { stop: mockJobStop, start: jest.fn() };
    });

    mockCheckPreSendEligibility.mockResolvedValue({ isSuppressed: false });
    mockWasEmailSentToday.mockResolvedValue(false);
    mockRetryWithBackoff.mockImplementation(async (fn) => {
      const res = await fn(0);
      return { result: res, retries: 0, totalAttempts: 1 };
    });
    mockSendRoutineEmailService.mockResolvedValue({ messageId: "routine-msg-1" });
    mockSendWeeklyDigestEmailService.mockResolvedValue({ messageId: "weekly-msg-1" });
  });

  afterEach(() => {
    emailScheduler.stopAllJobs(true);
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ==========================================================================
  // 1. emailJobs.js Tests
  // ==========================================================================
  describe("emailJobs.js Execution", () => {
    test("skips invalid recipient email addresses and alerts admin", async () => {
      process.env.TEST_EMAIL = "invalid-email-format";

      const results = await runEmailJob();

      expect(results.invalid).toContain("invalid-email-format");
      expect(results.sent.length).toBe(0);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          subject: "Alert: Failed daily_report emails",
          text: expect.stringContaining("invalid-email-format"),
        }),
      );
    });

    test("skips daily report if already sent today", async () => {
      process.env.TEST_EMAIL = "valid@example.com";
      mockWasEmailSentToday.mockResolvedValue(true);

      const results = await runEmailJob();

      expect(results.skipped).toContain("valid@example.com");
      expect(results.sent.length).toBe(0);
      expect(mockSendRoutineEmailService).not.toHaveBeenCalled();
    });

    test("dispatches daily report, records send, and avoids alert on success", async () => {
      process.env.TEST_EMAIL = "valid@example.com";
      mockWasEmailSentToday.mockResolvedValue(false);
      mockSendRoutineEmailService.mockResolvedValue({ messageId: "msg-123" });

      const results = await runEmailJob();

      expect(results.sent).toEqual([
        { email: "valid@example.com", success: "daily_report_success" },
      ]);
      expect(mockRecordSend).toHaveBeenCalledWith(
        "valid@example.com",
        "daily_report",
        expect.stringMatching(/^test-id-\d+$/),
      );
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test("records failure and alerts admin when daily report dispatch throws", async () => {
      process.env.TEST_EMAIL = "valid@example.com";
      mockWasEmailSentToday.mockResolvedValue(false);
      mockSendRoutineEmailService.mockRejectedValue(new Error("SMTP 421 Connection timeout"));

      const results = await runEmailJob();

      expect(results.failed).toEqual([
        { email: "valid@example.com", error: "SMTP 421 Connection timeout" },
      ]);
      expect(mockRecordFailure).toHaveBeenCalledWith(
        "valid@example.com",
        "daily_report",
        "SMTP 421 Connection timeout",
      );
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          to: "admin@example.com",
          text: expect.stringContaining("valid@example.com"),
        }),
      );
    });

    test("runWeeklyDigestJob processes subscribers and skips paused / sent digests", async () => {
      mockGetUsers.mockResolvedValue([
        { email: "active@example.com", isActive: true },
        { email: "paused@example.com", isActive: false },
        { email: "already-sent@example.com", isActive: true },
      ]);
      mockWasEmailSentThisWeek.mockImplementation(
        async (email) => email === "already-sent@example.com",
      );
      mockDispatchWeeklyDigest.mockResolvedValue({ success: true, messageId: "weekly-msg-1" });

      const results = await runWeeklyDigestJob({ force: false });

      expect(results.total).toBe(3);
      expect(results.sent).toEqual([{ email: "active@example.com", messageId: "weekly-msg-1" }]);
      expect(results.skipped).toEqual([
        { email: "paused@example.com", reason: "paused" },
        { email: "already-sent@example.com", reason: "already_sent_this_week" },
      ]);
      expect(mockKnexInstance.schema.hasTable).toHaveBeenCalledWith("job_last_run");
    });

    test("runWeeklyDigestJob supports targeted email and force flag", async () => {
      mockGetUserByEmail.mockResolvedValue({ email: "targeted@example.com", isActive: true });
      mockDispatchWeeklyDigest.mockResolvedValue({ success: true, messageId: "targeted-msg" });

      const results = await runWeeklyDigestJob({ email: "TARGETED@EXAMPLE.COM ", force: true });

      expect(mockGetUserByEmail).toHaveBeenCalledWith("targeted@example.com");
      expect(mockWasEmailSentThisWeek).not.toHaveBeenCalled();
      expect(results.sent.length).toBe(1);
    });

    test("runWeeklyDigestJob alerts admin on dispatch failures", async () => {
      mockGetUsers.mockResolvedValue([{ email: "user@example.com", isActive: true }]);
      mockWasEmailSentThisWeek.mockResolvedValue(false);
      mockDispatchWeeklyDigest.mockResolvedValue({ success: false, error: "Quota exceeded" });

      const results = await runWeeklyDigestJob();

      expect(results.failed).toEqual([{ email: "user@example.com", error: "Quota exceeded" }]);
      expect(mockSendMail).toHaveBeenCalledWith(
        expect.objectContaining({
          subject: "Alert: Failed weekly_digest emails",
          text: expect.stringContaining("user@example.com"),
        }),
      );
    });
  });

  // ==========================================================================
  // 2. emailScheduler.js Tests
  // ==========================================================================
  describe("emailScheduler.js Scheduling & Routine Dispatch", () => {
    const testSubscriber = {
      email: "subscriber@example.com",
      templateType: "stoic",
      timezone: "America/New_York",
      routineTrack: "deep-work",
    };

    test("skips routine dispatch if subscriber is suppressed", async () => {
      mockCheckPreSendEligibility.mockResolvedValue({
        isSuppressed: true,
        reason: "hard_bounce",
      });

      const res = await emailScheduler.sendRoutineEmail(testSubscriber, "invalid_skip");

      expect(res).toEqual({ status: "skipped", reason: "hard_bounce" });
      expect(mockRetryWithBackoff).not.toHaveBeenCalled();
    });

    test("allows dispatch to suppressed subscriber if admin skip key matches", async () => {
      mockCheckPreSendEligibility.mockResolvedValue({
        isSuppressed: true,
        reason: "hard_bounce",
      });

      const res = await emailScheduler.sendRoutineEmail(testSubscriber, "OVERRIDE_SECRET");

      expect(res.status).toBe("success");
      expect(mockSendRoutineEmailService).toHaveBeenCalled();
    });

    test("skips routine dispatch if email was already sent today", async () => {
      mockWasEmailSentToday.mockResolvedValue(true);

      const res = await emailScheduler.sendRoutineEmail(testSubscriber, "no_skip");

      expect(res).toEqual({ status: "skipped", reason: "already_sent_today" });
      expect(mockSendRoutineEmailService).not.toHaveBeenCalled();
    });

    test("successfully dispatches routine, triggers push and channels, and records send", async () => {
      mockSendRoutineEmailService.mockResolvedValue({ messageId: "msg-sched-1" });

      const res = await emailScheduler.sendRoutineEmail(testSubscriber);

      expect(res).toEqual({ status: "success", messageId: "msg-sched-1", retries: 0 });
      expect(mockDispatchMorningPush).toHaveBeenCalledWith(testSubscriber);
      expect(mockDispatchChannels).toHaveBeenCalledWith(testSubscriber, expect.any(Object));
      expect(mockRecordSend).toHaveBeenCalledWith(
        testSubscriber.email,
        testSubscriber.templateType,
        "msg-sched-1",
        expect.objectContaining({ scheduled: true, routineTrack: "deep-work" }),
        0,
      );
    });

    test("records error and failure diagnostics when retryWithBackoff fails", async () => {
      const dispatchError = new Error("Connection dropped by peer");
      dispatchError.retriesExecuted = 2;
      dispatchError.totalAttempts = 3;
      dispatchError.isRetryable = false;
      mockRetryWithBackoff.mockRejectedValue(dispatchError);

      const res = await emailScheduler.sendRoutineEmail(testSubscriber);

      expect(res).toEqual({
        status: "failed",
        error: "Connection dropped by peer",
        retries: 2,
      });
      expect(mockRecordFailure).toHaveBeenCalledWith(
        testSubscriber.email,
        testSubscriber.templateType,
        dispatchError,
        2,
        expect.objectContaining({ scheduled: true, phase: "smtp_dispatch" }),
      );
    });

    test("sendBulkEmails aggregates counts across users", async () => {
      mockGetUsers.mockResolvedValue([
        { email: "u1@example.com", templateType: "stoic" },
        { email: "u2@example.com", templateType: "zen" },
      ]);
      mockWasEmailSentToday.mockResolvedValueOnce(false).mockResolvedValueOnce(true);

      const summary = await emailScheduler.sendBulkEmails();

      expect(summary).toEqual({ successCount: 1, failureCount: 0, skippedCount: 1 });
    });

    test("sendUserWeeklyDigest checks duplicate sends and dispatches digest", async () => {
      mockWasEmailSentToday.mockResolvedValueOnce(true);
      const skipRes = await emailScheduler.sendUserWeeklyDigest(testSubscriber, "wrong_key");
      expect(skipRes).toEqual({ status: "skipped", reason: "already_sent_today" });

      mockWasEmailSentToday.mockResolvedValueOnce(false);
      mockSendWeeklyDigestEmailService.mockResolvedValue({ messageId: "weekly-123" });
      const successRes = await emailScheduler.sendUserWeeklyDigest(testSubscriber);
      expect(successRes).toEqual({ status: "success", messageId: "weekly-123", retries: 0 });
      expect(mockRecordSend).toHaveBeenCalledWith(
        testSubscriber.email,
        "weekly-digest",
        "weekly-123",
        expect.any(Object),
        0,
      );
    });

    test("scheduleAllJobs registers cron jobs for users and executes callback", async () => {
      mockGetUsers.mockResolvedValue([
        { email: "active@example.com", cronPattern: "0 8 * * *", timezone: "Europe/London" },
      ]);
      mockGetUserByEmail.mockResolvedValue({
        email: "active@example.com",
        isActive: true,
        templateType: "basic",
      });

      await emailScheduler.scheduleAllJobs();

      expect(mockCronSchedule).toHaveBeenCalledWith("0 8 * * *", expect.any(Function), {
        scheduled: true,
        timezone: "Europe/London",
      });
      expect(mockCronSchedule).toHaveBeenCalledWith("0 8 * * 0", expect.any(Function), {
        scheduled: true,
        timezone: "Europe/London",
      });

      const dailyCallback = mockCapturedCronCallbacks.find((c) => c.pattern === "0 8 * * *").fn;
      await dailyCallback();

      expect(mockGetUserByEmail).toHaveBeenCalledWith("active@example.com");
      expect(mockSendRoutineEmailService).toHaveBeenCalled();
    });

    test("stopAllJobs stops user jobs and preserves system cleanup", async () => {
      mockGetUsers.mockResolvedValue([{ email: "user@example.com" }]);
      await emailScheduler.scheduleAllJobs();
      emailScheduler.scheduleCleanupJobs();

      expect(emailScheduler.getScheduledJobsStatus().length).toBe(3);

      emailScheduler.stopAllJobs(false);
      expect(mockJobStop).toHaveBeenCalledTimes(2);
      expect(emailScheduler.getScheduledJobsStatus().length).toBe(1);

      emailScheduler.stopAllJobs(true);
      expect(mockJobStop).toHaveBeenCalledTimes(3);
      expect(emailScheduler.getScheduledJobsStatus().length).toBe(0);
    });

    test("scheduleUserJob, stopUserJob, and rescheduleUserJob perform dynamic hot-reloading", async () => {
      const user = {
        email: "dynamic@example.com",
        cronPattern: "0 7 * * 1-5",
        timezone: "America/New_York",
        isActive: true,
      };

      // 1. Schedule single user
      emailScheduler.scheduleUserJob(user);
      expect(emailScheduler.getScheduledJobsStatus().length).toBe(2);

      // 2. Stop single user
      const stopped = emailScheduler.stopUserJob("dynamic@example.com");
      expect(stopped).toBe(2);
      expect(emailScheduler.getScheduledJobsStatus().length).toBe(0);

      // 3. Hot-reschedule active user from DB
      mockGetUserByEmail.mockResolvedValueOnce({
        email: "dynamic@example.com",
        cronPattern: "0 6 * * *",
        timezone: "Asia/Kolkata",
        isActive: true,
      });

      const res = await emailScheduler.rescheduleUserJob("dynamic@example.com");
      expect(res.rescheduled).toBe(true);
      expect(emailScheduler.getScheduledJobsStatus().length).toBe(2);

      // 4. Hot-reschedule inactive user removes jobs
      mockGetUserByEmail.mockResolvedValueOnce({
        email: "dynamic@example.com",
        isActive: false,
      });

      const resInactive = await emailScheduler.rescheduleUserJob("dynamic@example.com");
      expect(resInactive.rescheduled).toBe(false);
      expect(emailScheduler.getScheduledJobsStatus().length).toBe(0);
    });

    test("rescheduleAllJobs re-queries DB and hot-reloads all active schedules", async () => {
      mockGetUsers.mockResolvedValue([
        { email: "user1@example.com", cronPattern: "0 8 * * *" },
        { email: "user2@example.com", cronPattern: "0 9 * * *" },
      ]);

      const result = await emailScheduler.rescheduleAllJobs();
      expect(result.success).toBe(true);
      expect(result.totalJobs).toBe(4); // 2 users * 2 jobs (daily + weekly)
      expect(result.activeJobs.length).toBe(4);
    });
  });
});
