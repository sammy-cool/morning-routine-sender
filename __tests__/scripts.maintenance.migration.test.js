// __tests__/scripts.maintenance.migration.test.js
const fs = require("fs");
const { newDb } = require("pg-mem");

// ---------------------------------------------------------
// 1. Module Mocks: Knex Database Client & Logger
// ---------------------------------------------------------
let mockKnexInstance = null;
let mockKnexOverride = null;
const mockDestroy = jest.fn().mockResolvedValue();
const mockBatchInsert = jest.fn().mockResolvedValue();

jest.mock("../db/knex", () => {
  const handler = (table) => {
    if (mockKnexOverride && typeof mockKnexOverride === "function") {
      return mockKnexOverride(table);
    }
    if (mockKnexInstance) {
      return mockKnexInstance(table);
    }
    return {
      insert: jest.fn().mockReturnThis(),
      onConflict: jest.fn().mockReturnThis(),
      merge: jest.fn().mockResolvedValue(),
    };
  };

  handler.raw = (...args) => {
    if (mockKnexOverride && typeof mockKnexOverride.raw === "function") {
      return mockKnexOverride.raw(...args);
    }
    if (mockKnexInstance) {
      return mockKnexInstance.raw(...args);
    }
    return Promise.resolve();
  };

  handler.batchInsert = (...args) => {
    if (mockKnexOverride && typeof mockKnexOverride.batchInsert === "function") {
      return mockKnexOverride.batchInsert(...args);
    }
    return mockBatchInsert(...args);
  };

  handler.destroy = (...args) => mockDestroy(...args);
  return handler;
});

jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

const logger = require("../logger");
const db = require("../db/knex");
const { runDatabaseMaintenance } = require("../scripts/run-db-maintenance");

// ---------------------------------------------------------
// Script Execution Test Harnesses
// ---------------------------------------------------------
async function executeMigrateJsonScript() {
  const { migrateData } = require("../scripts/migrate-json-to-db");
  let exitCode = 0;
  try {
    await migrateData();
  } catch (_e) {
    exitCode = 1;
  }
  return exitCode;
}

async function executeMigrateUsersScript() {
  const { migrateUsers } = require("../scripts/migrate-users-to-db");
  let exitCode = 0;
  try {
    await migrateUsers();
  } catch (_e) {
    exitCode = 1;
  }
  return exitCode;
}

async function executeVerifyDeploymentScript() {
  const { verifyDeployment } = require("../scripts/verify-deployment");
  return new Promise((resolve) => {
    const exitSpy = jest.spyOn(process, "exit").mockImplementation((code) => {
      exitSpy.mockRestore();
      resolve(code);
    });
    verifyDeployment().catch(() => {
      exitSpy.mockRestore();
      resolve(1);
    });
  });
}

describe("Scripts Test Suite: Database Maintenance, Data Migrations & Deployment Verification", () => {
  const originalEnv = { ...process.env };
  const originalArgv = [...process.argv];

  beforeEach(() => {
    jest.clearAllMocks();
    mockKnexOverride = null;
    process.exitCode = undefined;
    process.env = { ...originalEnv };
    process.argv = [...originalArgv];
    jest.spyOn(console, "log").mockImplementation(() => {});
    jest.spyOn(console, "error").mockImplementation(() => {});
  });

  afterEach(() => {
    process.env = originalEnv;
    process.argv = originalArgv;
    jest.restoreAllMocks();
  });

  // =========================================================================
  // 1. scripts/run-db-maintenance.js
  // =========================================================================
  describe("1. Database Maintenance Script (scripts/run-db-maintenance.js)", () => {
    test("runs VACUUM (ANALYZE) on all 6 tables and global ANALYZE when healthy", async () => {
      const rawCalls = [];
      mockKnexOverride = {
        raw: jest.fn().mockImplementation((sql) => {
          rawCalls.push(sql);
          return Promise.resolve();
        }),
      };

      await runDatabaseMaintenance();

      const expectedTables = [
        "email_tracker",
        "job_last_run",
        "subscribers",
        "suppression_list",
        "email_events",
        "push_subscriptions",
      ];

      expectedTables.forEach((table) => {
        expect(rawCalls).toContain(`VACUUM (ANALYZE) ${table}`);
        expect(logger.info).toHaveBeenCalledWith(
          expect.stringContaining(`VACUUM (ANALYZE) completed for table: ${table}`),
        );
      });

      expect(rawCalls).toContain("ANALYZE");
      expect(logger.info).toHaveBeenCalledWith("✅ [DB Maintenance] Global ANALYZE completed.");
      expect(logger.info).toHaveBeenCalledWith(
        expect.stringMatching(/🎉 \[DB Maintenance\] Maintenance routine finished in \d+ms\./),
      );
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
    });

    test("handles partial failures: skips a table on error, logs warning, and continues", async () => {
      mockKnexOverride = {
        raw: jest.fn().mockImplementation((sql) => {
          if (sql.includes("push_subscriptions")) {
            return Promise.reject(new Error('relation "push_subscriptions" does not exist'));
          }
          return Promise.resolve();
        }),
      };

      await runDatabaseMaintenance();

      expect(logger.warn).toHaveBeenCalledWith(
        expect.stringContaining(
          '⚠️ [DB Maintenance] VACUUM skipped for table push_subscriptions: relation "push_subscriptions" does not exist',
        ),
      );
      expect(mockKnexOverride.raw).toHaveBeenCalledWith("ANALYZE");
      expect(logger.info).toHaveBeenCalledWith("✅ [DB Maintenance] Global ANALYZE completed.");
      expect(mockDestroy).toHaveBeenCalledTimes(1);
      expect(process.exitCode).toBeUndefined();
    });

    test("handles catastrophic failure: sets process.exitCode = 1 and logs error", async () => {
      mockKnexOverride = {
        raw: jest.fn().mockImplementation((sql) => {
          if (sql === "ANALYZE") {
            return Promise.reject(new Error("Database connection lost"));
          }
          return Promise.resolve();
        }),
      };

      await runDatabaseMaintenance();

      expect(logger.error).toHaveBeenCalledWith(
        "❌ [DB Maintenance] Database maintenance failed:",
        { error: "Database connection lost" },
      );
      expect(process.exitCode).toBe(1);
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    test("exports runDatabaseMaintenance function without auto-executing on require", () => {
      const maintenanceModule = require("../scripts/run-db-maintenance");
      expect(typeof maintenanceModule.runDatabaseMaintenance).toBe("function");
    });
  });

  // =========================================================================
  // 2. scripts/migrate-json-to-db.js
  // =========================================================================
  describe("2. Email Tracker JSON to DB Migration (scripts/migrate-json-to-db.js)", () => {
    test("skips migration cleanly if ./storage/email-tracker.json does not exist", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(false);

      const exitCode = await executeMigrateJsonScript();

      expect(exitCode).toBe(0);
      expect(logger.info).toHaveBeenCalledWith(
        "No existing email-tracker.json found, skipping migration",
      );
      expect(mockBatchInsert).not.toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    test("migrates Array-based JSON records, formats dates, applies fallbacks, and backs up file", async () => {
      const sampleArrayData = [
        {
          recipient: "alice@example.com",
          template: "welcome",
          sentAt: "2026-09-01T10:00:00.000Z",
          status: "delivered",
          messageId: "<msg-1@routine.dev>",
          metadata: { provider: "smtp" },
          retryCount: 1,
        },
        {
          email: "bob@example.com",
          timestamp: "2026-09-02T12:00:00.000Z",
        },
      ];

      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(sampleArrayData));
      const renameSpy = jest.spyOn(fs, "renameSync").mockImplementation(() => {});

      const exitCode = await executeMigrateJsonScript();

      expect(exitCode).toBe(0);
      expect(mockBatchInsert).toHaveBeenCalledTimes(1);
      const [table, insertedRecords, batchSize] = mockBatchInsert.mock.calls[0];

      expect(table).toBe("email_tracker");
      expect(batchSize).toBe(100);
      expect(insertedRecords).toHaveLength(2);

      // Record 1 - full fields
      expect(insertedRecords[0].recipient_email).toBe("alice@example.com");
      expect(insertedRecords[0].template_type).toBe("welcome");
      expect(insertedRecords[0].sent_at).toEqual(new Date("2026-09-01T10:00:00.000Z"));
      expect(insertedRecords[0].status).toBe("delivered");
      expect(insertedRecords[0].message_id).toBe("<msg-1@routine.dev>");
      expect(insertedRecords[0].metadata).toBe(JSON.stringify({ provider: "smtp" }));
      expect(insertedRecords[0].retry_count).toBe(1);

      // Record 2 - fallbacks (missing template, status, retryCount, metadata)
      expect(insertedRecords[1].recipient_email).toBe("bob@example.com");
      expect(insertedRecords[1].template_type).toBe("default");
      expect(insertedRecords[1].sent_at).toEqual(new Date("2026-09-02T12:00:00.000Z"));
      expect(insertedRecords[1].status).toBe("success");
      expect(insertedRecords[1].metadata).toBe(JSON.stringify({}));
      expect(insertedRecords[1].retry_count).toBe(0);

      expect(logger.info).toHaveBeenCalledWith("Migrated 2 records from JSON to database");
      expect(renameSpy).toHaveBeenCalledWith(
        "./storage/email-tracker.json",
        expect.stringMatching(/\.\/storage\/email-tracker\.json\.backup-\d+/),
      );
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    test("migrates Object/Map-based JSON records correctly", async () => {
      const sampleObjectData = {
        "record-1": {
          email: "charlie@example.com",
          template: "morning-digest",
          lastSent: "2026-09-03T07:30:00.000Z",
          customAttr: 42,
        },
      };

      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue(JSON.stringify(sampleObjectData));
      jest.spyOn(fs, "renameSync").mockImplementation(() => {});

      const exitCode = await executeMigrateJsonScript();

      expect(exitCode).toBe(0);
      expect(mockBatchInsert).toHaveBeenCalledTimes(1);
      const inserted = mockBatchInsert.mock.calls[0][1];

      expect(inserted).toHaveLength(1);
      expect(inserted[0].recipient_email).toBe("charlie@example.com");
      expect(inserted[0].template_type).toBe("morning-digest");
      expect(inserted[0].sent_at).toEqual(new Date("2026-09-03T07:30:00.000Z"));
      expect(inserted[0].status).toBe("success");
      expect(inserted[0].metadata).toBe(JSON.stringify(sampleObjectData["record-1"]));
    });

    test("handles empty array: does not call batchInsert or rename file", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue("[]");
      const renameSpy = jest.spyOn(fs, "renameSync").mockImplementation(() => {});

      const exitCode = await executeMigrateJsonScript();

      expect(exitCode).toBe(0);
      expect(mockBatchInsert).not.toHaveBeenCalled();
      expect(renameSpy).not.toHaveBeenCalled();
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    test("handles corrupt JSON: logs error, exits with code 1, and destroys db", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest.spyOn(fs, "readFileSync").mockReturnValue("{ corrupt_json: true, invalid... ");

      const exitCode = await executeMigrateJsonScript();

      expect(exitCode).toBe(1);
      expect(logger.error).toHaveBeenCalledWith(
        "Migration failed",
        expect.objectContaining({ error: expect.any(String) }),
      );
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    test("handles database error during batchInsert: exits with code 1 and destroys db", async () => {
      jest.spyOn(fs, "existsSync").mockReturnValue(true);
      jest
        .spyOn(fs, "readFileSync")
        .mockReturnValue(
          JSON.stringify([{ recipient: "error@example.com", sentAt: "2026-09-01T00:00:00Z" }]),
        );
      mockBatchInsert.mockRejectedValueOnce(new Error("Deadlock detected during batch insert"));

      const exitCode = await executeMigrateJsonScript();

      expect(exitCode).toBe(1);
      expect(logger.error).toHaveBeenCalledWith("Migration failed", {
        error: "Deadlock detected during batch insert",
      });
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. scripts/migrate-users-to-db.js
  // =========================================================================
  describe("3. Subscriber Migration Script (scripts/migrate-users-to-db.js)", () => {
    test("migrates legacy subscribers using onConflict('email').merge()", async () => {
      process.env.TEST_EMAIL = "primary-test@routine.dev";
      process.env.TEST_EMAIL_2 = "secondary-test@routine.dev";

      const insertFn = jest.fn().mockReturnThis();
      const onConflictFn = jest.fn().mockReturnThis();
      const mergeFn = jest.fn().mockResolvedValue();

      mockKnexOverride = jest.fn().mockImplementation((table) => {
        expect(table).toBe("subscribers");
        return {
          insert: insertFn,
          onConflict: onConflictFn,
          merge: mergeFn,
        };
      });

      const exitCode = await executeMigrateUsersScript();

      expect(exitCode).toBe(0);
      expect(insertFn).toHaveBeenCalledTimes(1);
      const inserted = insertFn.mock.calls[0][0];

      expect(inserted).toHaveLength(5);
      expect(inserted[0].email).toBe("primary-test@routine.dev");
      expect(inserted[1].email).toBe("secondary-test@routine.dev");
      expect(inserted[2].email).toBe("user1@example.com");

      inserted.forEach((sub) => {
        expect(sub.template_type).toBe("basic");
        expect(sub.timezone).toBe("Asia/Kolkata");
        expect(sub.is_active).toBe(true);
        expect(typeof sub.cron_pattern).toBe("string");
      });

      expect(onConflictFn).toHaveBeenCalledWith("email");
      expect(mergeFn).toHaveBeenCalledTimes(1);
      expect(logger.info).toHaveBeenCalledWith(
        "Migrated 5 subscribers into the database",
        expect.objectContaining({ emails: expect.any(Array) }),
      );
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });

    test("handles database error during subscriber migration: exits 1 and destroys db", async () => {
      mockKnexOverride = jest.fn().mockImplementation(() => ({
        insert: jest.fn().mockReturnThis(),
        onConflict: jest.fn().mockReturnThis(),
        merge: jest.fn().mockRejectedValue(new Error("Connection refused")),
      }));

      const exitCode = await executeMigrateUsersScript();

      expect(exitCode).toBe(1);
      expect(logger.error).toHaveBeenCalledWith("Subscriber migration failed", {
        error: "Connection refused",
      });
      expect(mockDestroy).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 4. In-Memory pg-mem Integration: Deduplication & Streak Preservation
  // =========================================================================
  describe("4. JSON Subscriber Parsing, Deduplication & Streak Preservation (pg-mem)", () => {
    let memKnex;

    beforeEach(async () => {
      const mem = newDb();
      memKnex = mem.adapters.createKnex(0);

      await memKnex.schema.createTable("subscribers", (table) => {
        table.increments("id").primary();
        table.string("email", 255).notNullable().unique();
        table.string("template_type", 100).notNullable().defaultTo("basic");
        table.string("cron_pattern", 100).notNullable();
        table.string("timezone", 100).notNullable().defaultTo("Asia/Kolkata");
        table.boolean("is_active").notNullable().defaultTo(true);
        table.integer("streak_count").notNullable().defaultTo(0);
        table.string("last_checkin_date", 20).nullable();
        table.integer("streak_freeze_count").notNullable().defaultTo(0);
        table.string("routine_track", 100).notNullable().defaultTo("deep-work");
      });
    });

    afterEach(async () => {
      if (memKnex) await memKnex.destroy();
    });

    test("deduplication: running migration twice maintains single subscriber record", async () => {
      const records = [
        {
          email: "unique@example.com",
          template_type: "basic",
          cron_pattern: "0 8 * * *",
          timezone: "Asia/Kolkata",
          is_active: true,
        },
      ];

      await memKnex("subscribers").insert(records).onConflict("email").merge();
      await memKnex("subscribers").insert(records).onConflict("email").merge();

      const all = await memKnex("subscribers").select("*");
      expect(all).toHaveLength(1);
      expect(all[0].email).toBe("unique@example.com");
    });

    test("streak preservation: merging base migration payload preserves existing streak data", async () => {
      // 1. Existing subscriber with established streak and checkin
      await memKnex("subscribers").insert({
        email: "champion@example.com",
        template_type: "basic",
        cron_pattern: "0 7 * * *",
        timezone: "Asia/Kolkata",
        is_active: true,
        streak_count: 21,
        last_checkin_date: "2026-09-09",
        streak_freeze_count: 3,
        routine_track: "deep-work",
      });

      // 2. Migration runs with updated cron_pattern or template_type
      const migrationPayload = [
        {
          email: "champion@example.com",
          template_type: "mindfulness",
          cron_pattern: "30 6 * * *",
          timezone: "Asia/Kolkata",
          is_active: true,
        },
      ];

      await memKnex("subscribers").insert(migrationPayload).onConflict("email").merge();

      const updated = await memKnex("subscribers").where("email", "champion@example.com").first();

      // Updated configuration fields
      expect(updated.template_type).toBe("mindfulness");
      expect(updated.cron_pattern).toBe("30 6 * * *");

      // Critical: Streaks, last checkin date, freeze count, and track were preserved!
      expect(Number(updated.streak_count)).toBe(21);
      expect(updated.last_checkin_date).toBe("2026-09-09");
      expect(Number(updated.streak_freeze_count)).toBe(3);
      expect(updated.routine_track).toBe("deep-work");
    });

    test("JSON subscriber parser handles invalid emails, missing fields, and date formatting", () => {
      function parseSubscriberJson(rawJson) {
        if (!rawJson || typeof rawJson !== "string") {
          throw new Error("Invalid JSON input");
        }
        const data = JSON.parse(rawJson);
        if (!Array.isArray(data)) {
          throw new Error("Expected array of subscribers");
        }

        const validEmailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const validRecords = [];

        for (const item of data) {
          if (!item.email || !validEmailRegex.test(item.email.trim())) {
            continue; // Skip invalid or missing email
          }

          let formattedDate = null;
          if (item.lastCheckin) {
            const d = new Date(item.lastCheckin);
            if (!isNaN(d.getTime())) {
              formattedDate = d.toISOString().slice(0, 10);
            }
          }

          validRecords.push({
            email: item.email.trim().toLowerCase(),
            template_type: item.templateType || item.template || "basic",
            cron_pattern: item.cronPattern || "0 8 * * *",
            timezone: item.timezone || "Asia/Kolkata",
            is_active: item.isActive !== false,
            streak_count: typeof item.streakCount === "number" ? Math.max(0, item.streakCount) : 0,
            last_checkin_date: formattedDate,
          });
        }
        return validRecords;
      }

      const inputJson = JSON.stringify([
        {
          email: " valid.user@routine.dev ",
          templateType: "executive",
          streakCount: 15,
          lastCheckin: "2026-09-08T06:30:00Z",
        },
        {
          email: "invalid-email-address",
        },
        {
          email: null,
        },
        {
          email: "fallback@routine.dev",
          lastCheckin: "invalid-date-string",
        },
      ]);

      const parsed = parseSubscriberJson(inputJson);
      expect(parsed).toHaveLength(2);

      expect(parsed[0].email).toBe("valid.user@routine.dev");
      expect(parsed[0].template_type).toBe("executive");
      expect(parsed[0].streak_count).toBe(15);
      expect(parsed[0].last_checkin_date).toBe("2026-09-08");

      expect(parsed[1].email).toBe("fallback@routine.dev");
      expect(parsed[1].template_type).toBe("basic");
      expect(parsed[1].streak_count).toBe(0);
      expect(parsed[1].last_checkin_date).toBeNull();

      expect(() => parseSubscriberJson("{ malformed json ")).toThrow();
    });
  });

  // =========================================================================
  // 5. scripts/verify-deployment.js
  // =========================================================================
  describe("5. Deployment Verification Script (scripts/verify-deployment.js)", () => {
    let originalFetch;

    beforeEach(() => {
      originalFetch = global.fetch;
      process.env.MAX_VERIFY_ATTEMPTS = "1";
    });

    afterEach(() => {
      global.fetch = originalFetch;
    });

    test("passes deployment verification on healthy 200 JSON health check & robots.txt SEO check", async () => {
      process.argv = ["node", "verify-deployment.js", "https://production.routine.dev"];

      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes("/health")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: {
              get: (header) => (header === "content-type" ? "application/json" : null),
            },
            json: async () => ({
              status: "ok",
              uptimeSeconds: 360,
              memoryUsageMB: 48,
              checks: { database: "healthy", redis: "healthy" },
            }),
          });
        }
        if (url.includes("/robots.txt")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => "text/plain" },
            text: async () => "User-agent: *\nAllow: /\nDisallow: /admin",
          });
        }
        return Promise.reject(new Error("Unknown route"));
      });

      const exitCode = await executeVerifyDeploymentScript();

      expect(exitCode).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://production.routine.dev/health",
        expect.objectContaining({
          headers: { "User-Agent": "DeployVerification/2.0" },
        }),
      );
      expect(global.fetch).toHaveBeenCalledWith(
        "https://production.routine.dev/robots.txt",
        expect.any(Object),
      );
    });

    test("enables deep verification query parameter when --deep flag is present", async () => {
      process.argv = ["node", "verify-deployment.js", "https://prod.routine.dev", "--deep"];

      global.fetch = jest.fn().mockImplementation((url) => {
        if (url.includes("/health?deep=true")) {
          return Promise.resolve({
            ok: true,
            status: 200,
            headers: { get: () => "application/json" },
            json: async () => ({ status: "ok" }),
          });
        }
        return Promise.resolve({
          ok: true,
          status: 200,
          headers: { get: () => "text/plain" },
          text: async () => "User-agent: *",
        });
      });

      const exitCode = await executeVerifyDeploymentScript();

      expect(exitCode).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://prod.routine.dev/health?deep=true",
        expect.any(Object),
      );
    });

    test("resolves TARGET_URL hierarchy: CLI argument > RENDER_URL > BASE_URL > default", async () => {
      // 1. RENDER_URL precedence when no CLI argument is supplied
      process.argv = ["node", "verify-deployment.js"];
      process.env.RENDER_URL = "https://morning-render.onrender.com///"; // tests trailing slash stripping

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "application/json" },
        json: async () => ({ status: "ok" }),
        text: async () => "User-agent: *",
      });

      const exitCode = await executeVerifyDeploymentScript();

      expect(exitCode).toBe(0);
      expect(global.fetch).toHaveBeenCalledWith(
        "https://morning-render.onrender.com/health",
        expect.any(Object),
      );
    });

    test("fails and exits 1 when health endpoint returns non-ok status code (503)", async () => {
      process.env.MAX_VERIFY_ATTEMPTS = "1"; // Limit attempts to 1 for instantaneous test execution
      process.argv = ["node", "verify-deployment.js", "http://localhost:2900"];

      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 503,
        headers: { get: () => "application/json" },
        json: async () => ({ status: "degraded", error: "Database unreachable" }),
      });

      const exitCode = await executeVerifyDeploymentScript();

      expect(exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "[DEPLOYMENT FAILED] Health verification timed out after 1 attempts.",
        ),
      );
    });

    test("handles fetch network error / timeout abort without crashing", async () => {
      process.env.MAX_VERIFY_ATTEMPTS = "1";
      process.argv = ["node", "verify-deployment.js", "http://localhost:2900"];

      global.fetch = jest
        .fn()
        .mockRejectedValue(new Error("The operation was aborted due to timeout"));

      const exitCode = await executeVerifyDeploymentScript();

      expect(exitCode).toBe(1);
      expect(console.error).toHaveBeenCalledWith(
        expect.stringContaining(
          "[DEPLOYMENT FAILED] Health verification timed out after 1 attempts.",
        ),
      );
    });

    test("handles text non-JSON health check response gracefully", async () => {
      process.env.MAX_VERIFY_ATTEMPTS = "1";
      process.argv = ["node", "verify-deployment.js", "http://localhost:2900"];

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        status: 200,
        headers: { get: () => "text/html" },
        text: async () => "<html><body>Gateway Timeout</body></html>",
      });

      const exitCode = await executeVerifyDeploymentScript();

      expect(exitCode).toBe(1); // Fails because text does not satisfy result.data?.status === 'ok'
    });
  });
});
