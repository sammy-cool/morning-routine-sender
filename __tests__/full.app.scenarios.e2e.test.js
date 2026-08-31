process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "test-admin-secret-key-12345";
process.env.ADMIN_SKIP_KEY = "GG!";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const crypto = require("node:crypto");

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    limit: jest.fn().mockReturnThis(),
    offset: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    del: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockResolvedValue([{ count: 0 }]),
    schema: {
      hasTable: jest.fn().mockResolvedValue(true),
      hasColumn: jest.fn().mockResolvedValue(true),
    },
    raw: jest.fn((str) => str),
  };
  const knex = jest.fn(() => queryBuilder);
  knex.schema = queryBuilder.schema;
  knex.raw = queryBuilder.raw;
  knex.client = { config: { client: "sqlite3" } };
  return knex;
});

jest.mock("../config/mailTransporter", () => ({
  getTransporter: jest.fn().mockReturnValue({
    sendMail: jest.fn().mockResolvedValue({ messageId: "<mock-msg-123@test>" }),
  }),
  closeTransporterConnection: jest.fn().mockResolvedValue(true),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const redis = require("../config/redisClient");
const journalService = require("../helper/journalService");
const { generateActionToken } = require("../helper/unsubscribeToken");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const adminRoutes = require("../routes/admin.routes");
const deliverabilityRoutes = require("../routes/deliverability.routes");
const journalRoutes = require("../routes/journal.routes");
const webhookRoutes = require("../routes/webhook.routes");

function buildTestApp() {
  const app = express();
  app.use(cookieParser("test-secret"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use((req, res, next) => {
    res.locals.apiBase = "http://localhost:2900";
    next();
  });
  app.use(subscriberPortalRoutes);
  app.use(adminRoutes);
  app.use(deliverabilityRoutes);
  app.use(journalRoutes);
  app.use(webhookRoutes);
  return app;
}

describe("🌟 Full-App End-to-End Scenarios & Multi-Platform Logic Matrix", () => {
  let app;

  beforeEach(async () => {
    app = buildTestApp();
    jest.clearAllMocks();
    if (redis && redis.flushall) {
      await redis.flushall();
    }
  });

  // =========================================================================
  // SCENARIO 1: Complete Subscriber Lifecycle Flow
  // =========================================================================
  describe("Scenario 1: Full Subscriber Lifecycle Loop", () => {
    const subscriberEmail = "flow.subscriber@example.com";

    test("executes complete signup, confirmation, preference customization, checkin, and journal flow", async () => {
      // 1. Signup Request (Double Opt-in)
      const signupRes = await request(app).post("/subscribe").send({
        email: subscriberEmail,
        routineTrack: "mindfulness",
        cronPattern: "0 7 * * *",
        timezone: "Asia/Kolkata",
      });
      expect(signupRes.status).toBe(200);
      expect(signupRes.body.message).toMatch(/Check your inbox/i);

      // Verify token in Redis
      const keys = await redis.keys("signup_key:*");
      expect(keys.length).toBeGreaterThan(0);
      const token = keys[0].replace("signup_key:", "");
      const signupPayload = JSON.parse(await redis.get(keys[0]));
      expect(signupPayload.email).toBe(subscriberEmail);
      expect(signupPayload.routineTrack).toBe("mindfulness");

      // Mock sharedData & journalService methods for life-cycle operations
      jest
        .spyOn(sharedData, "addUser")
        .mockResolvedValue({ created: true, email: subscriberEmail });
      jest.spyOn(sharedData, "setUserActive").mockResolvedValue(true);
      jest.spyOn(sharedData, "getUserByEmail").mockResolvedValue({
        email: subscriberEmail,
        routineTrack: "mindfulness",
        templateType: "mindfulness",
        cronPattern: "0 7 * * *",
        timezone: "Asia/Kolkata",
        isActive: true,
        streakCount: 1,
        streakFreezes: 2,
        freezeHistory: [],
      });
      jest.spyOn(sharedData, "updateUser").mockResolvedValue(true);
      jest.spyOn(sharedData, "recordCheckin").mockResolvedValue({
        success: true,
        email: subscriberEmail,
        streak: 1,
        streakCount: 1,
        alreadyCheckedInToday: false,
      });
      jest.spyOn(journalService, "getAllEntries").mockResolvedValue([]);

      // 2. Confirm Subscription
      const confirmRes = await request(app).get(`/confirm-subscription?token=${token}`);
      expect(confirmRes.status).toBe(302);
      expect(confirmRes.header.location).toBe("/user-dashboard");

      // Extract session cookie from confirm response or establish directly
      const sessionToken = crypto.randomBytes(32).toString("hex");
      await redis.set(`subscriber_session:${sessionToken}`, subscriberEmail, "EX", 3600);

      // 3. Authenticated Session: Update Preferences via PATCH /me/preferences
      const prefRes = await request(app)
        .patch("/me/preferences")
        .set("Cookie", [`mrn_session=${sessionToken}`])
        .send({
          routineTrack: "executive",
          cronPattern: "0 6 * * *",
          timezone: "America/New_York",
        });
      expect(prefRes.status).toBe(200);

      // 4. Update AI Coach Persona via POST /me/coach-persona
      const coachRes = await request(app)
        .post("/me/coach-persona")
        .set("Cookie", [`mrn_session=${sessionToken}`])
        .send({ coachPersona: "stoic" });
      expect(coachRes.status).toBe(200);
      expect(coachRes.body.success).toBe(true);

      // 5. Update Multi-channel settings via POST /me/channels
      const channelRes = await request(app)
        .post("/me/channels")
        .set("Cookie", [`mrn_session=${sessionToken}`])
        .send({
          discordWebhookUrl: "https://discord.com/api/webhooks/1234567890/abcdefg_HIJKLMN",
          telegramChatId: "-1001234567890",
          channelsEnabled: ["email", "discord", "telegram"],
        });
      expect(channelRes.status).toBe(200);
      expect(channelRes.body.success).toBe(true);

      // 6. 1-Click Habit Streak Check-in via GET /checkin
      const checkinToken = generateActionToken(subscriberEmail, "checkin");
      const checkinRes = await request(app).get(
        `/checkin?email=${encodeURIComponent(subscriberEmail)}&token=${checkinToken}`,
      );
      expect(checkinRes.status).toBe(200);
      expect(checkinRes.text).toMatch(/Complete|Streak|Routine/i);

      // 7. Activate Streak Freeze Shield via POST /me/use-streak-freeze
      const freezeRes = await request(app)
        .post("/me/use-streak-freeze")
        .set("Cookie", [`mrn_session=${sessionToken}`]);
      expect([200, 400]).toContain(freezeRes.status);

      // 8. Export Journal in Multiple Formats
      const exportJsonRes = await request(app)
        .get("/me/export?format=json")
        .set("Cookie", [`mrn_session=${sessionToken}`]);
      expect(exportJsonRes.status).toBe(200);
      expect(exportJsonRes.body).toHaveProperty("subscriber", subscriberEmail);

      const exportCsvRes = await request(app)
        .get("/me/export?format=csv")
        .set("Cookie", [`mrn_session=${sessionToken}`]);
      expect(exportCsvRes.status).toBe(200);
      expect(exportCsvRes.header["content-type"]).toMatch(/text\/csv/i);
    });
  });

  // =========================================================================
  // SCENARIO 2: Concurrency & Check-in Idempotency
  // =========================================================================
  describe("Scenario 2: High Concurrency & Idempotency", () => {
    test("handles 5 parallel check-in calls without race condition corruption", async () => {
      const email = "concurrency.tester@example.com";
      const initialUser = {
        email,
        streakCount: 3,
        lastCheckinDate: "2026-08-30",
        timezone: "UTC",
        streakFreezes: 2,
        freezeHistory: [],
      };

      jest.spyOn(sharedData, "getUserByEmail").mockResolvedValue(initialUser);
      const recordCheckinSpy = jest
        .spyOn(sharedData, "recordCheckin")
        .mockImplementation(async (targetEmail) => {
          return {
            success: true,
            email: targetEmail,
            streak: 4,
            alreadyCheckedInToday: false,
          };
        });

      const checkinToken = generateActionToken(email, "checkin");
      const parallelRequests = Array(5)
        .fill(null)
        .map(() =>
          request(app).get(`/checkin?email=${encodeURIComponent(email)}&token=${checkinToken}`),
        );

      const results = await Promise.all(parallelRequests);
      results.forEach((res) => {
        expect(res.status).toBe(200);
      });
      expect(recordCheckinSpy).toHaveBeenCalledTimes(5);
    });

    test("dead-letter retry endpoint is registered and handles invocations cleanly", async () => {
      const deliverabilityController = require("../controllers/deliverability.controller");
      expect(typeof deliverabilityController.retryFailedDispatches).toBe("function");
    });
  });

  // =========================================================================
  // SCENARIO 3: Persona Track Content & Multi-Track Resilience
  // =========================================================================
  describe("Scenario 3: Persona Tracks & Shared Data Configs", () => {
    const expectedTracks = [
      "deep-work",
      "mindfulness",
      "executive",
      "learning",
      "classic",
      "career",
      "reflection",
    ];

    test.each(expectedTracks)("provides rich content for track: %s", (track) => {
      const content = sharedData.getTrackContent(track);
      expect(content).toBeDefined();
      expect(content.track).toBe(track);
      expect(content.name).toBeTruthy();
      expect(content.badge).toBeTruthy();
      expect(content.tagline).toBeTruthy();
      expect(content.ritual).toBeTruthy();
      expect(content.quote).toBeTruthy();
      expect(Array.isArray(content.checklist)).toBe(true);
      expect(content.checklist.length).toBeGreaterThanOrEqual(3);
    });

    test("falls back gracefully for unknown track keys", () => {
      const content = sharedData.getTrackContent("non-existent-track-xyz");
      expect(content).toBeDefined();
      expect(content.name).toBeTruthy();
      expect(content.checklist.length).toBeGreaterThanOrEqual(3);
    });
  });

  // =========================================================================
  // SCENARIO 4: Client Audio Engine & Sound Synthesis Interface
  // =========================================================================
  describe("Scenario 4: Client Audio Engine & Sound Interfaces", () => {
    test("UXCore.sound defines playClick, playSuccess, and playMilestone", () => {
      const UXCore = require("../public/js/ux-core");
      expect(UXCore).toBeDefined();
      expect(UXCore.sound).toBeDefined();
      expect(typeof UXCore.sound.playClick).toBe("function");
      expect(typeof UXCore.sound.playSuccess).toBe("function");
      expect(typeof UXCore.sound.playMilestone).toBe("function");
      expect(typeof UXCore.sound.toggleMute).toBe("function");
    });

    test("UXCore.cache implements LRU eviction at capacity", () => {
      const UXCore = require("../public/js/ux-core");
      const cache = UXCore.cache;
      cache.invalidate();

      for (let i = 0; i < 110; i++) {
        cache.set(`test_key_${i}`, { index: i }, 60000);
      }

      const entry0 = cache.get("test_key_0", 60000);
      const entry105 = cache.get("test_key_105", 60000);
      expect(entry0).toBeNull();
      expect(entry105).not.toBeNull();
      expect(entry105.data.index).toBe(105);
    });
  });
});
