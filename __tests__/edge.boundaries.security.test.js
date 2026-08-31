process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const cookieParser = require("cookie-parser");
const journalService = require("../helper/journalService");
const redis = require("../config/redisClient");
const sharedData = require("../helper/shared-data");
const meController = require("../controllers/me.controller");
const emailTracker = require("../email-core/emailTracker");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const journalRoutes = require("../routes/journal.routes");

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
  };
  return jest.fn(() => queryBuilder);
});

function buildApp() {
  const app = express();
  app.use(cookieParser("test-secret"));
  app.use(express.json());
  app.use(subscriberPortalRoutes);
  app.use(journalRoutes);
  return app;
}

describe("🛡️ Edge Cases, Boundary Limits & Security Hardening Suite", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe("1. CSV Formula Injection Defense (CWE-1236)", () => {
    test("prefixes formula triggers with single quote during CSV export", () => {
      const maliciousEntries = [
        {
          entry_date: "2026-08-31",
          track_key: "deep-work",
          mood_score: 5,
          one_big_thing: "=CMD|' /C calc'!A0",
          gratitude: "@SUM(1, 1)",
          reflection_text: "+100% productivity gains",
          created_at: "2026-08-31T07:00:00Z",
        },
        {
          entry_date: "2026-08-30",
          track_key: "mindfulness",
          mood_score: 4,
          one_big_thing: "-Negative thoughts released",
          gratitude: "\tTabbed text injection",
          reflection_text: "Standard safe reflection text",
          created_at: "2026-08-30T07:00:00Z",
        },
      ];

      const csv = journalService.generateCsvExport(maliciousEntries);
      expect(csv).toBeDefined();

      // Ensure formulas are prefixed with single quote
      expect(csv).toContain("\"'=CMD|' /C calc'!A0\"");
      expect(csv).toContain('"\'@SUM(1, 1)"');
      expect(csv).toContain('"\'+100% productivity gains"');
      expect(csv).toContain('"\'-Negative thoughts released"');
      expect(csv).toContain('"Standard safe reflection text"');
    });
  });

  describe("2. Query Limit & Pagination Clamping", () => {
    test("clamps negative limits to minimum of 1 in getMyHistory", async () => {
      const email = "limit.tester@example.com";
      const getHistorySpy = jest.spyOn(emailTracker, "getHistory").mockResolvedValue([]);

      const sessionToken = "valid-session-limit-test";
      await redis.set(`subscriber_session:${sessionToken}`, email, "EX", 3600);

      const res = await request(app)
        .get("/me/history?limit=-5")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(200);
      expect(getHistorySpy).toHaveBeenCalledWith(email, 1);
    });

    test("clamps excessive limits to maximum of 100 in getMyHistory", async () => {
      const email = "limit.tester@example.com";
      const getHistorySpy = jest.spyOn(emailTracker, "getHistory").mockResolvedValue([]);

      const sessionToken = "valid-session-limit-test-2";
      await redis.set(`subscriber_session:${sessionToken}`, email, "EX", 3600);

      const res = await request(app)
        .get("/me/history?limit=999999")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(200);
      expect(getHistorySpy).toHaveBeenCalledWith(email, 100);
    });
  });

  describe("3. Resilient Timezone & Streak Freeze Boundary", () => {
    test("handles corrupted subscriber timezone gracefully without 500 crash", async () => {
      const email = "corrupt.tz@example.com";
      jest.spyOn(sharedData, "getUserByEmail").mockResolvedValue({
        email,
        streakCount: 5,
        timezone: "Invalid/Corrupted_Timezone_Name",
        streakFreezes: 2,
        freezeHistory: [],
      });
      jest.spyOn(sharedData, "updateUser").mockResolvedValue(true);

      const sessionToken = "session-corrupt-tz";
      await redis.set(`subscriber_session:${sessionToken}`, email, "EX", 3600);

      const res = await request(app)
        .post("/me/streak-freeze/use")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      // Should succeed with UTC fallback, not throw a 500 RangeError
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.streakFreezes).toBe(1);
    });

    test("rejects streak freeze activation when 0 shields remain", async () => {
      const email = "no.shields@example.com";
      jest.spyOn(sharedData, "getUserByEmail").mockResolvedValue({
        email,
        streakCount: 5,
        timezone: "UTC",
        streakFreezes: 0,
        freezeHistory: [],
      });

      const sessionToken = "session-no-shields";
      await redis.set(`subscriber_session:${sessionToken}`, email, "EX", 3600);

      const res = await request(app)
        .post("/me/streak-freeze/use")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/No streak freeze shields remaining/i);
    });
  });
});
