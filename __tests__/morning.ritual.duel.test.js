// __tests__/morning.ritual.duel.test.js
process.env.USE_MOCK_REDIS = "true";

const { newDb } = require("pg-mem");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

const subscribersMigration = require("../db/migrations/20260711172620_create_subscribers_table");
const streaksMigration = require("../db/migrations/20260828000000_add_streaks_and_track_to_subscribers");
const journalMigration = require("../db/migrations/20260829000000_create_journal_entries_table");
const channelsMigration = require("../db/migrations/20260829010000_add_channels_to_subscribers");
const coachPersonaMigration = require("../db/migrations/20260829020000_add_coach_persona_to_subscribers");
const outboundWebhooksMigration = require("../db/migrations/20260829030000_add_outbound_webhooks_to_subscribers");
const streakFreezesMigration = require("../db/migrations/20260831000000_add_streak_freezes_to_subscribers");
const squadsMigration = require("../db/migrations/20260912000000_create_accountability_squads_tables");

jest.mock("../config/redisClient", () => {
  const store = new Map();
  return {
    get: jest.fn((k) => Promise.resolve(store.get(k) || null)),
    set: jest.fn((k, v) => {
      store.set(k, v);
      return Promise.resolve("OK");
    }),
    del: jest.fn((k) => {
      store.delete(k);
      return Promise.resolve(1);
    }),
    quit: jest.fn(() => Promise.resolve()),
  };
});

jest.mock("../helper/outboundWebhookDispatcher", () => ({
  dispatchWebhookForSubscriber: jest.fn().mockResolvedValue(true),
}));

let mockKnexInstance;
jest.mock("../db/knex", () => {
  const handler = (table) => mockKnexInstance(table);
  handler.transaction = async (cb) => cb(mockKnexInstance);
  handler.fn = { now: () => new Date() };
  handler.raw = (str) => str;
  return handler;
});

const routineController = require("../controllers/routine.controller");
const squadController = require("../controllers/squad.controller");
const { generateActionToken } = require("../helper/unsubscribeToken");

describe("3-Minute Morning Ritual, Tactile Wake-Up & Morning Duel", () => {
  let app;
  let memDb;
  const testEmail = "duel-tester@example.com";
  const rivalEmail = "duel-rival@example.com";
  let checkinToken;

  beforeEach(async () => {
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex(0);

    // Run schema migrations
    await subscribersMigration.up(mockKnexInstance);
    await streaksMigration.up(mockKnexInstance);
    await journalMigration.up(mockKnexInstance);
    await channelsMigration.up(mockKnexInstance);
    await coachPersonaMigration.up(mockKnexInstance);
    await outboundWebhooksMigration.up(mockKnexInstance);
    await streakFreezesMigration.up(mockKnexInstance);
    await squadsMigration.up(mockKnexInstance);

    // Insert test subscribers
    await mockKnexInstance("subscribers").insert([
      {
        id: 1,
        email: testEmail,
        cron_pattern: "0 8 * * *",
        is_active: true,
        streak_count: 5,
        routine_track: "deep-work",
        timezone: "UTC",
      },
      {
        id: 2,
        email: rivalEmail,
        cron_pattern: "0 8 * * *",
        is_active: true,
        streak_count: 7,
        routine_track: "executive",
        timezone: "UTC",
      },
    ]);

    checkinToken = generateActionToken(testEmail, "checkin");

    app = express();
    app.use(express.json());
    app.use(cookieParser());

    // Middleware to set subscriber email header for test
    app.use((req, _res, next) => {
      if (req.headers["x-test-email"]) {
        req.subscriberEmail = req.headers["x-test-email"];
        req.subscriber = { email: req.headers["x-test-email"] };
      }
      next();
    });

    app.post("/checkin", routineController.checkin);
    app.post("/routine/checkin", routineController.checkin);
    app.get("/routine", routineController.liveRoutine);
    app.get("/api/duel/status", squadController.getMorningDuelStatus);
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
  });

  describe("Verified Wake-Up Check-in & Priority Goal Lock", () => {
    test("POST /routine/checkin accepts verified_wakeup and priority_goal in JSON mode", async () => {
      const res = await request(app)
        .post("/routine/checkin")
        .set("Accept", "application/json")
        .send({
          email: testEmail,
          token: checkinToken,
          verified_wakeup: true,
          priority_goal: "Ship breakthrough MVP features",
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verifiedWakeup).toBe(true);
      expect(res.body.morningVerified).toBe(true);
      expect(res.body.priorityGoal).toBe("Ship breakthrough MVP features");
      expect(res.body.streakCount).toBeGreaterThanOrEqual(1);
    });

    test("POST /checkin handles subsequent checkin today maintaining verified status", async () => {
      // Perform first check-in
      await request(app).post("/routine/checkin").set("Accept", "application/json").send({
        email: testEmail,
        token: checkinToken,
        verified_wakeup: true,
        priority_goal: "First routine log",
      });

      // Second checkin on same day
      const res = await request(app).post("/checkin").set("Accept", "application/json").send({
        email: testEmail,
        token: checkinToken,
        verified_wakeup: true,
        priority_goal: "Second check-in attempt",
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verifiedWakeup).toBe(true);
      expect(res.body.title).toContain("Already Checked In Today");
    });
  });

  describe("Live Routine HTML Companion & Ritual Elements", () => {
    test("GET /routine renders 3-Minute Live Ritual panel and Tactile Wake-Up challenge", async () => {
      const routineToken = generateActionToken(testEmail, "routine");
      const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);

      expect(res.status).toBe(200);
      expect(res.text).toContain("3-Minute Live Morning Ritual");
      expect(res.text).toContain("Tactile Wake-Up Challenge");
      expect(res.text).toContain("breathingOrb");
      expect(res.text).toContain("waterTapBtn");
      expect(res.text).toContain("livePriorityInput");
      expect(res.text).toContain("startMorningRitual");
    });
  });

  describe("Morning Duel & AI Ghost Mode Endpoint (/api/duel/status)", () => {
    test("GET /api/duel/status defaults to AI Ghost Mode for solo subscriber", async () => {
      const res = await request(app).get("/api/duel/status").set("x-test-email", testEmail);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mode).toBe("ai_ghost");
      expect(res.body.opponent.type).toBe("ai_ghost");
      expect(res.body.opponent.benchmarkTime).toBeDefined();
      expect(res.body.headline).toBeDefined();
    });

    test("GET /api/duel/status switches to squad_duel when in squad with peer", async () => {
      const [inserted] = await mockKnexInstance("accountability_squads")
        .insert({
          name: "Titan Dawn Squad",
          invite_code: "SQUAD-TEST",
          creator_email: testEmail,
          max_members: 5,
          squad_streak: 2,
        })
        .returning("id");

      const resolvedSquadId =
        typeof inserted === "object" && inserted !== null ? inserted.id : inserted;

      await mockKnexInstance("squad_members").insert([
        { squad_id: resolvedSquadId, subscriber_email: testEmail, role: "leader" },
        { squad_id: resolvedSquadId, subscriber_email: rivalEmail, role: "member" },
      ]);

      const res = await request(app).get("/api/duel/status").set("x-test-email", testEmail);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mode).toBe("squad_duel");
      expect(res.body.opponent.type).toBe("peer");
      expect(res.body.opponent.displayName).toContain(rivalEmail.split("@")[0]);
      expect(res.body.duelState).toBeDefined();
    });

    test("GET /api/duel/status handles unauthenticated visitor preview gracefully", async () => {
      const res = await request(app).get("/api/duel/status");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.mode).toBe("ai_ghost");
      expect(res.body.opponent.type).toBe("ai_ghost");
    });
  });
});
