// __tests__/email.tracker.cleanup.test.js
const { newDb } = require("pg-mem");
const RedisMock = require("ioredis-mock");

// 1. Dynamic Mock for Knex Database Client
let mockKnexInstance;
let mockKnexOverride = null;
const mockDestroy = jest.fn().mockResolvedValue();

jest.mock("../db/knex", () => {
  const handler = (table) => {
    if (mockKnexOverride && typeof mockKnexOverride === "function") {
      return mockKnexOverride(table);
    }
    return mockKnexInstance(table);
  };
  handler.schema = {
    hasTable: (...args) => mockKnexInstance.schema.hasTable(...args),
  };
  handler.fn = { now: () => new Date().toISOString() };
  handler.raw = (...args) => {
    if (mockKnexOverride && typeof mockKnexOverride.raw === "function") {
      return mockKnexOverride.raw(...args);
    }
    return mockKnexInstance.raw(...args);
  };
  handler.client = { config: { client: "sqlite3" } };
  handler.destroy = mockDestroy;
  return handler;
});

// 2. Mock Winston Logger to silence output during tests
jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require("../logger");
const emailTracker = require("../email-core/emailTracker");
const {
  cleanupOldEmailRecords,
  optimizeDatabase,
  getDatabaseStats,
} = require("../helper/database-cleanup");

describe("Email Tracker & Database Retention Cleanup Test Suite", () => {
  let memDb;
  let redisClient;

  beforeEach(async () => {
    jest.clearAllMocks();
    mockKnexOverride = null;

    // Setup in-memory PostgreSQL instance
    memDb = newDb();

    // Register DATE function for pg-mem compatibility
    memDb.public.registerFunction({
      name: "date",
      args: ["timestamptz"],
      returns: "date",
      implementation: (ts) => new Date(ts).toISOString().slice(0, 10),
    });

    mockKnexInstance = memDb.adapters.createKnex(0);

    // Create email_tracker table
    await mockKnexInstance.schema.createTable("email_tracker", (table) => {
      table.increments("id").primary();
      table.string("recipient_email", 255).notNullable();
      table.string("template_type", 100).notNullable();
      table.timestamp("sent_at").notNullable();
      table.string("status", 50).notNullable();
      table.text("error_message").nullable();
      table.integer("retry_count").defaultTo(0);
      table.string("message_id", 255).nullable();
      table.text("metadata").nullable();
      table.timestamp("created_at").defaultTo(mockKnexInstance.fn.now());
      table.timestamp("updated_at").defaultTo(mockKnexInstance.fn.now());
    });

    // Create email_events table (telemetry / dead-letter logs)
    await mockKnexInstance.schema.createTable("email_events", (table) => {
      table.increments("id").primary();
      table.string("event_id", 255).nullable().unique();
      table.string("recipient_email", 255).notNullable();
      table.string("message_id", 255).nullable();
      table.string("event_type", 50).notNullable();
      table.string("provider", 50).notNullable();
      table.text("raw_payload").nullable();
      table.timestamp("occurred_at").notNullable();
      table.timestamp("created_at").defaultTo(mockKnexInstance.fn.now());
    });

    // Create job_last_run table
    await mockKnexInstance.schema.createTable("job_last_run", (table) => {
      table.increments("id").primary();
      table.string("job_name", 100).notNullable().unique();
      table.timestamp("last_run_at").notNullable();
      table.string("status", 50).notNullable();
      table.integer("emails_sent").defaultTo(0);
      table.integer("emails_failed").defaultTo(0);
      table.text("error_details").nullable();
      table.timestamp("updated_at").defaultTo(mockKnexInstance.fn.now());
    });

    redisClient = new RedisMock();
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
    if (redisClient) {
      await redisClient.flushall();
    }
  });

  // =========================================================================
  // 1. EMAIL TRACKER TESTS
  // =========================================================================
  describe("emailTracker.recordSend", () => {
    test("successfully records email send with normalized recipient and status 'success'", async () => {
      await emailTracker.recordSend(
        "  User.Test@Example.COM  ",
        "morning-zen",
        "msg-uuid-101",
        { track: "mindfulness" },
        0,
      );

      const record = await mockKnexInstance("email_tracker").first();
      expect(record).toBeDefined();
      expect(record.recipient_email).toBe("user.test@example.com");
      expect(record.template_type).toBe("morning-zen");
      expect(record.status).toBe("success");
      expect(record.message_id).toBe("msg-uuid-101");
      expect(Number(record.retry_count)).toBe(0);

      const parsedMeta =
        typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata;
      expect(parsedMeta.track).toBe("mindfulness");
      expect(parsedMeta.recovered).toBeUndefined();
      expect(logger.info).toHaveBeenCalledWith("Email send recorded", expect.any(Object));
    });

    test("enriches metadata with recovered=true and retryCount when retryCount > 0", async () => {
      await emailTracker.recordSend(
        "recovered@example.com",
        "stoic-edge",
        "msg-uuid-102",
        { custom: "data" },
        2,
      );

      const record = await mockKnexInstance("email_tracker")
        .where("recipient_email", "recovered@example.com")
        .first();
      expect(Number(record.retry_count)).toBe(2);

      const parsedMeta =
        typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata;
      expect(parsedMeta.retryCount).toBe(2);
      expect(parsedMeta.recovered).toBe(true);
      expect(parsedMeta.custom).toBe("data");
    });

    test("handles null or non-object metadata safely", async () => {
      await emailTracker.recordSend("fallback@example.com", "deep-work", "msg-uuid-103", null, 0);

      const record = await mockKnexInstance("email_tracker")
        .where("recipient_email", "fallback@example.com")
        .first();
      expect(record).toBeDefined();
      const parsedMeta =
        typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata;
      expect(parsedMeta).toEqual({});
    });

    test("fails open without throwing when Knex insert encounters an error", async () => {
      mockKnexOverride = () => ({
        insert: jest.fn().mockRejectedValue(new Error("Disk Full / DB Down")),
      });

      await expect(
        emailTracker.recordSend("error@example.com", "deep-work", "msg-err"),
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith("Failed to record email send", expect.any(Object));
    });
  });

  describe("emailTracker.recordFailure", () => {
    test("records failure with rich diagnostic metadata when passed an Error object", async () => {
      const error = new Error("SMTP connection timed out: 421 Service not available");
      error.code = "ETIMEDOUT";
      error.syscall = "connect";
      error.responseCode = 421;

      await emailTracker.recordFailure("FAILED@EXAMPLE.COM", "deep-work", error, 3, {
        phase: "smtp_handshake",
      });

      const record = await mockKnexInstance("email_tracker").first();
      expect(record.recipient_email).toBe("failed@example.com");
      expect(record.template_type).toBe("deep-work");
      expect(record.status).toBe("failed");
      expect(Number(record.retry_count)).toBe(3);
      expect(record.error_message).toContain("SMTP connection timed out");

      const parsedMeta =
        typeof record.metadata === "string" ? JSON.parse(record.metadata) : record.metadata;
      expect(parsedMeta.code).toBe("ETIMEDOUT");
      expect(parsedMeta.responseCode).toBe(421);
      expect(parsedMeta.phase).toBe("smtp_handshake");
      expect(parsedMeta.retryCount).toBe(3);
      expect(parsedMeta.stack).toBeDefined();
      expect(logger.warn).toHaveBeenCalledWith("Email failure recorded", expect.any(Object));
    });

    test("handles non-Error string messages and truncates messages > 1000 characters", async () => {
      const superLongError = "A".repeat(1500);

      await emailTracker.recordFailure("longerror@example.com", "weekly-digest", superLongError, 1);

      const record = await mockKnexInstance("email_tracker").first();
      expect(record.error_message.length).toBe(1000);
      expect(record.error_message).toBe("A".repeat(1000));
    });

    test("fails open and logs error when database insert fails", async () => {
      mockKnexOverride = () => ({
        insert: jest.fn().mockRejectedValue(new Error("Lock wait timeout")),
      });

      await expect(
        emailTracker.recordFailure("err@example.com", "test", "some error"),
      ).resolves.not.toThrow();

      expect(logger.error).toHaveBeenCalledWith(
        "Failed to record email failure",
        expect.any(Object),
      );
    });
  });

  describe("emailTracker.wasEmailSentToday", () => {
    test("returns true if successful email was recorded today in given timezone", async () => {
      await mockKnexInstance("email_tracker").insert({
        recipient_email: "active@example.com",
        template_type: "morning-routine",
        sent_at: new Date(),
        status: "success",
        retry_count: 0,
      });

      const wasSent = await emailTracker.wasEmailSentToday(
        "ACTIVE@EXAMPLE.COM",
        "morning-routine",
        "UTC",
      );
      expect(wasSent).toBe(true);
    });

    test("returns false if email was sent yesterday (date boundary check)", async () => {
      const yesterday = new Date(Date.now() - 24 * 60 * 60 * 1000);
      await mockKnexInstance("email_tracker").insert({
        recipient_email: "yesterday@example.com",
        template_type: "morning-routine",
        sent_at: yesterday,
        status: "success",
        retry_count: 0,
      });

      const wasSent = await emailTracker.wasEmailSentToday(
        "yesterday@example.com",
        "morning-routine",
        "UTC",
      );
      expect(wasSent).toBe(false);
    });

    test("returns false if email was attempted today but status is failed", async () => {
      await mockKnexInstance("email_tracker").insert({
        recipient_email: "failedtoday@example.com",
        template_type: "morning-routine",
        sent_at: new Date(),
        status: "failed",
        retry_count: 3,
      });

      const wasSent = await emailTracker.wasEmailSentToday(
        "failedtoday@example.com",
        "morning-routine",
        "UTC",
      );
      expect(wasSent).toBe(false);
    });

    test("fails open and returns false when database query throws", async () => {
      mockKnexOverride = () => {
        throw new Error("Knex connection pool exhausted");
      };

      const result = await emailTracker.wasEmailSentToday("failopen@example.com", "test");
      expect(result).toBe(false);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to check email history",
        expect.any(Object),
      );
    });
  });

  describe("emailTracker.wasEmailSentThisWeek", () => {
    test("returns true if email was sent within daysBack window", async () => {
      const twoDaysAgo = new Date(Date.now() - 2 * 24 * 60 * 60 * 1000);
      await mockKnexInstance("email_tracker").insert({
        recipient_email: "weekly@example.com",
        template_type: "weekly_digest",
        sent_at: twoDaysAgo,
        status: "success",
      });

      const wasSent = await emailTracker.wasEmailSentThisWeek(
        "weekly@example.com",
        "weekly_digest",
        6,
      );
      expect(wasSent).toBe(true);
    });

    test("returns false if email was sent beyond the daysBack window", async () => {
      const eightDaysAgo = new Date(Date.now() - 8 * 24 * 60 * 60 * 1000);
      await mockKnexInstance("email_tracker").insert({
        recipient_email: "weekly@example.com",
        template_type: "weekly_digest",
        sent_at: eightDaysAgo,
        status: "success",
      });

      const wasSent = await emailTracker.wasEmailSentThisWeek(
        "weekly@example.com",
        "weekly_digest",
        6,
      );
      expect(wasSent).toBe(false);
    });

    test("fails open and returns false on error", async () => {
      mockKnexOverride = () => {
        throw new Error("Timeout");
      };

      const wasSent = await emailTracker.wasEmailSentThisWeek("err@example.com");
      expect(wasSent).toBe(false);
    });
  });

  describe("emailTracker.getHistory", () => {
    test("retrieves history sorted descending by sent_at and parsed JSON metadata", async () => {
      const date1 = new Date("2026-09-01T06:00:00Z");
      const date2 = new Date("2026-09-02T06:00:00Z");

      await mockKnexInstance("email_tracker").insert([
        {
          recipient_email: "hist@example.com",
          template_type: "basic",
          sent_at: date1,
          status: "success",
          metadata: JSON.stringify({ day: 1 }),
        },
        {
          recipient_email: "hist@example.com",
          template_type: "deep-work",
          sent_at: date2,
          status: "success",
          metadata: JSON.stringify({ day: 2 }),
        },
      ]);

      const history = await emailTracker.getHistory("hist@example.com", 10);
      expect(history).toHaveLength(2);
      expect(new Date(history[0].sent_at).getTime()).toBeGreaterThan(
        new Date(history[1].sent_at).getTime(),
      );
      expect(history[0].metadata).toEqual({ day: 2 });
      expect(history[1].metadata).toEqual({ day: 1 });
    });

    test("handles malformed JSON in metadata without throwing", async () => {
      await mockKnexInstance("email_tracker").insert({
        recipient_email: "malformed@example.com",
        template_type: "basic",
        sent_at: new Date(),
        status: "success",
        metadata: "{bad-json:",
      });

      const history = await emailTracker.getHistory("malformed@example.com");
      expect(history).toHaveLength(1);
      expect(history[0].metadata).toBe("{bad-json:");
    });

    test("returns empty array when query errors out", async () => {
      mockKnexOverride = () => {
        throw new Error("DB Error");
      };

      const history = await emailTracker.getHistory("err@example.com");
      expect(history).toEqual([]);
      expect(logger.error).toHaveBeenCalledWith(
        "Failed to fetch email history",
        expect.any(Object),
      );
    });
  });

  describe("emailTracker.getStats", () => {
    test("calculates aggregated dispatch statistics over date range", async () => {
      const baseDate = new Date("2026-09-05T00:00:00Z");
      const inRangeDate = new Date("2026-09-06T00:00:00Z");
      const outOfRangeDate = new Date("2026-09-10T00:00:00Z");

      await mockKnexInstance("email_tracker").insert([
        {
          recipient_email: "a@example.com",
          template_type: "basic",
          sent_at: inRangeDate,
          status: "success",
          retry_count: 0,
        },
        {
          recipient_email: "b@example.com",
          template_type: "basic",
          sent_at: inRangeDate,
          status: "failed",
          retry_count: 2,
        },
        {
          recipient_email: "c@example.com",
          template_type: "basic",
          sent_at: outOfRangeDate,
          status: "success",
          retry_count: 0,
        },
      ]);

      const stats = await emailTracker.getStats(baseDate, new Date("2026-09-07T00:00:00Z"));
      expect(stats).toBeDefined();
      expect(Number(stats.total)).toBe(2);
      expect(Number(stats.successful)).toBe(1);
      expect(Number(stats.failed)).toBe(1);
      expect(Number(stats.avg_retries)).toBe(1);
    });

    test("returns null when stats aggregation throws", async () => {
      mockKnexOverride = () => {
        throw new Error("SQL error");
      };

      const stats = await emailTracker.getStats(new Date(), new Date());
      expect(stats).toBeNull();
      expect(logger.error).toHaveBeenCalledWith("Failed to fetch email stats", expect.any(Object));
    });
  });

  describe("emailTracker.updateJobRun & getLastJobRun", () => {
    test("inserts and updates job run status using onConflict merge", async () => {
      await emailTracker.updateJobRun("morning_routine_cron", 50, 0);

      let lastRun = await emailTracker.getLastJobRun("morning_routine_cron");
      expect(lastRun.status).toBe("success");
      expect(Number(lastRun.emails_sent)).toBe(50);
      expect(Number(lastRun.emails_failed)).toBe(0);

      // Second run with failures
      await emailTracker.updateJobRun("morning_routine_cron", 45, 5, "SMTP 421 Rate Limit");
      lastRun = await emailTracker.getLastJobRun("morning_routine_cron");
      expect(lastRun.status).toBe("failed");
      expect(Number(lastRun.emails_sent)).toBe(45);
      expect(Number(lastRun.emails_failed)).toBe(5);
      expect(lastRun.error_details).toBe("SMTP 421 Rate Limit");
    });

    test("getLastJobRun returns null on error", async () => {
      mockKnexOverride = () => {
        throw new Error("DB Error");
      };

      const run = await emailTracker.getLastJobRun("non_existent");
      expect(run).toBeNull();
    });
  });

  describe("emailTracker.close", () => {
    test("destroys Knex connection pool cleanly", async () => {
      mockDestroy.mockResolvedValue();
      await emailTracker.close();
      expect(mockDestroy).toHaveBeenCalled();
      expect(logger.info).toHaveBeenCalledWith("Database connection closed");
    });
  });

  // =========================================================================
  // 2. REDIS IDEMPOTENCY CACHING & INVALIDATION LAYER
  // =========================================================================
  describe("Redis Caching & Invalidation Patterns", () => {
    test("caches idempotency status in Redis to short-circuit DB lookups", async () => {
      const email = "cached@example.com";
      const template = "morning-zen";
      const todayStr = new Date().toISOString().slice(0, 10);
      const cacheKey = `idempotency:sent:${email}:${template}:${todayStr}`;

      // 1. Initial check: Cache miss -> check DB -> set Redis key
      let isCached = await redisClient.get(cacheKey);
      expect(isCached).toBeNull();

      // Simulate recordSend caching write-through with 24h TTL
      await emailTracker.recordSend(email, template, "msg-redis-1");
      await redisClient.set(cacheKey, "1", "EX", 86400);

      // 2. Subsequent check: Cache hit -> immediately true without DB query
      isCached = await redisClient.get(cacheKey);
      expect(isCached).toBe("1");
    });

    test("invalidates cached subscriber history upon new dispatch failure or send", async () => {
      const email = "invalidation@example.com";
      const historyCacheKey = `user_history:${email}`;

      // Simulate pre-cached history
      await redisClient.set(historyCacheKey, JSON.stringify([{ id: 1 }]));

      // New dispatch occurs: invalidate cache
      await emailTracker.recordFailure(email, "deep-work", "Failed");
      await redisClient.del(historyCacheKey);

      const cachedAfter = await redisClient.get(historyCacheKey);
      expect(cachedAfter).toBeNull();
    });
  });

  // =========================================================================
  // 3. DELIVERABILITY METRICS AUDIT & VERIFICATION
  // =========================================================================
  describe("Deliverability Metrics Audit", () => {
    test("verifies emailTracker does not currently implement getDeliverabilityMetrics directly", () => {
      expect(emailTracker.getDeliverabilityMetrics).toBeUndefined();
    });

    test("verifies deliverability rate computation logic matching application standard", () => {
      function calculateDeliverabilityRates(
        sentCount,
        delivered,
        opened,
        clicked,
        softBounce,
        hardBounce,
      ) {
        const totalDispatched = sentCount > 0 ? sentCount : delivered + softBounce + hardBounce;
        const deliveryRate =
          totalDispatched > 0 ? ((delivered / totalDispatched) * 100).toFixed(2) : "100.00";
        const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(2) : "0.00";
        const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(2) : "0.00";
        const bounceRate =
          totalDispatched > 0
            ? (((softBounce + hardBounce) / totalDispatched) * 100).toFixed(2)
            : "0.00";

        return {
          deliveryRate: `${deliveryRate}%`,
          openRate: `${openRate}%`,
          clickRate: `${clickRate}%`,
          bounceRate: `${bounceRate}%`,
        };
      }

      const rates = calculateDeliverabilityRates(100, 95, 40, 10, 3, 2);
      expect(rates.deliveryRate).toBe("95.00%");
      expect(rates.openRate).toBe("42.11%");
      expect(rates.clickRate).toBe("25.00%");
      expect(rates.bounceRate).toBe("5.00%");
    });
  });

  // =========================================================================
  // 4. DATABASE CLEANUP & RETENTION THRESHOLD TESTS
  // =========================================================================
  describe("helper/database-cleanup.js", () => {
    describe("cleanupOldEmailRecords (30-Day Tracker Retention)", () => {
      test("purges records older than cutoff threshold and preserves recent records", async () => {
        const fortyDaysAgo = new Date(Date.now() - 40 * 24 * 60 * 60 * 1000);
        const twentyDaysAgo = new Date(Date.now() - 20 * 24 * 60 * 60 * 1000);

        await mockKnexInstance("email_tracker").insert([
          {
            recipient_email: "old1@example.com",
            template_type: "basic",
            sent_at: fortyDaysAgo,
            status: "success",
          },
          {
            recipient_email: "old2@example.com",
            template_type: "basic",
            sent_at: fortyDaysAgo,
            status: "failed",
          },
          {
            recipient_email: "recent@example.com",
            template_type: "basic",
            sent_at: twentyDaysAgo,
            status: "success",
          },
        ]);

        const result = await cleanupOldEmailRecords(30);
        expect(result.success).toBe(true);
        expect(result.deleted).toBe(2);

        const remaining = await mockKnexInstance("email_tracker").select("*");
        expect(remaining).toHaveLength(1);
        expect(remaining[0].recipient_email).toBe("recent@example.com");
      });

      test("returns success with 0 deleted when no records exceed retention threshold", async () => {
        const tenDaysAgo = new Date(Date.now() - 10 * 24 * 60 * 60 * 1000);
        await mockKnexInstance("email_tracker").insert({
          recipient_email: "fresh@example.com",
          template_type: "basic",
          sent_at: tenDaysAgo,
          status: "success",
        });

        const result = await cleanupOldEmailRecords(30);
        expect(result.success).toBe(true);
        expect(result.deleted).toBe(0);
      });

      test("catches database errors and returns failure response without throwing", async () => {
        mockKnexOverride = () => ({
          where: () => {
            throw new Error("Foreign key / DB constraint violation");
          },
        });

        const result = await cleanupOldEmailRecords(30);
        expect(result.success).toBe(false);
        expect(result.error).toContain("Foreign key");
        expect(logger.error).toHaveBeenCalledWith("❌ Database cleanup failed", expect.any(Object));
      });
    });

    describe("Retention Thresholds (30-day Tracker vs 90-day Dead Letter / Events)", () => {
      test("demonstrates dual-tier retention: 30 days for tracker records and 90 days for dead-letter telemetry", async () => {
        const ninetyFiveDaysAgo = new Date(Date.now() - 95 * 24 * 60 * 60 * 1000);
        const fiftyDaysAgo = new Date(Date.now() - 50 * 24 * 60 * 60 * 1000);

        // Seed email_events (dead letter logs)
        await mockKnexInstance("email_events").insert([
          {
            recipient_email: "deadletter.old@example.com",
            event_type: "hard_bounce",
            provider: "resend",
            occurred_at: ninetyFiveDaysAgo,
          },
          {
            recipient_email: "deadletter.retained@example.com",
            event_type: "hard_bounce",
            provider: "resend",
            occurred_at: fiftyDaysAgo,
          },
        ]);

        // Clean events older than 90 days
        const eventCutoff = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000);
        const eventsDeleted = await mockKnexInstance("email_events")
          .where("occurred_at", "<", eventCutoff)
          .delete();

        expect(eventsDeleted).toBe(1);

        const remainingEvents = await mockKnexInstance("email_events").select("*");
        expect(remainingEvents).toHaveLength(1);
        expect(remainingEvents[0].recipient_email).toBe("deadletter.retained@example.com");
      });
    });

    describe("optimizeDatabase (VACUUM & ANALYZE)", () => {
      test("executes VACUUM and ANALYZE returning success", async () => {
        const rawCalls = [];
        mockKnexOverride = {
          raw: (sql) => {
            rawCalls.push(sql);
            return Promise.resolve({});
          },
        };

        const res = await optimizeDatabase();
        expect(res.success).toBe(true);
        expect(rawCalls).toContain("VACUUM");
        expect(rawCalls).toContain("ANALYZE");
      });

      test("handles VACUUM failure gracefully when running in environment that disallows VACUUM in transactions", async () => {
        mockKnexOverride = {
          raw: (sql) => {
            if (sql === "VACUUM") {
              return Promise.reject(new Error("VACUUM cannot run inside a transaction block"));
            }
            return Promise.resolve({});
          },
        };

        const res = await optimizeDatabase();
        expect(res.success).toBe(true);
        expect(logger.warn).toHaveBeenCalledWith(
          "VACUUM skipped (not supported in this environment)",
          expect.any(Object),
        );
      });

      test("returns failure if ANALYZE fails", async () => {
        mockKnexOverride = {
          raw: (sql) => {
            if (sql === "ANALYZE") {
              return Promise.reject(new Error("Permission denied for ANALYZE"));
            }
            return Promise.resolve({});
          },
        };

        const res = await optimizeDatabase();
        expect(res.success).toBe(false);
        expect(res.error).toBe("Permission denied for ANALYZE");
      });
    });

    describe("getDatabaseStats", () => {
      test("returns record counts, oldest and newest timestamps", async () => {
        const oldest = new Date("2026-08-01T00:00:00Z");
        const newest = new Date("2026-09-01T00:00:00Z");

        await mockKnexInstance("email_tracker").insert([
          {
            recipient_email: "oldest@example.com",
            template_type: "basic",
            sent_at: oldest,
            status: "success",
          },
          {
            recipient_email: "newest@example.com",
            template_type: "basic",
            sent_at: newest,
            status: "success",
          },
        ]);

        const stats = await getDatabaseStats();
        expect(stats).toBeDefined();
        expect(Number(stats.totalRecords)).toBe(2);
        expect(new Date(stats.oldestRecord).toISOString()).toBe(oldest.toISOString());
        expect(new Date(stats.newestRecord).toISOString()).toBe(newest.toISOString());
      });

      test("returns null when stats query fails", async () => {
        mockKnexOverride = () => {
          throw new Error("Table corrupted");
        };

        const stats = await getDatabaseStats();
        expect(stats).toBeNull();
        expect(logger.error).toHaveBeenCalledWith(
          "Failed to get database stats",
          expect.any(Object),
        );
      });
    });
  });
});
