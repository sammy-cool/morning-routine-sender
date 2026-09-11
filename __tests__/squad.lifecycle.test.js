// __tests__/squad.lifecycle.test.js
process.env.USE_MOCK_REDIS = "true";

const { newDb } = require("pg-mem");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const squadsMigration = require("../db/migrations/20260912000000_create_accountability_squads_tables");
const subscribersMigration = require("../db/migrations/20260711172620_create_subscribers_table");
const streaksMigration = require("../db/migrations/20260828000000_add_streaks_and_track_to_subscribers");
const channelsMigration = require("../db/migrations/20260829010000_add_channels_to_subscribers");
const coachPersonaMigration = require("../db/migrations/20260829020000_add_coach_persona_to_subscribers");
const outboundWebhooksMigration = require("../db/migrations/20260829030000_add_outbound_webhooks_to_subscribers");
const streakFreezesMigration = require("../db/migrations/20260831000000_add_streak_freezes_to_subscribers");
const { generateActionToken } = require("../helper/unsubscribeToken");

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

let mockKnexInstance;
jest.mock("../db/knex", () => {
  const handler = (table) => mockKnexInstance(table);
  handler.transaction = async (cb) => cb(mockKnexInstance);
  handler.fn = { now: () => new Date() };
  handler.raw = (str) => str;
  return handler;
});

describe("Accountability Squads & Peer Streaks Lifecycle", () => {
  let app;
  let memDb;

  beforeEach(async () => {
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex(0);

    // Run schema migrations
    await subscribersMigration.up(mockKnexInstance);
    await streaksMigration.up(mockKnexInstance);
    await channelsMigration.up(mockKnexInstance);
    await coachPersonaMigration.up(mockKnexInstance);
    await outboundWebhooksMigration.up(mockKnexInstance);
    await streakFreezesMigration.up(mockKnexInstance);
    await squadsMigration.up(mockKnexInstance);

    // Seed test subscribers
    await mockKnexInstance("subscribers").insert([
      {
        id: 1,
        email: "alex@example.com",
        cron_pattern: "0 8 * * *",
        streak_count: 5,
        last_checkin_date: new Intl.DateTimeFormat("en-CA").format(new Date()),
        routine_track: "deep-work",
        is_active: true,
      },
      {
        id: 2,
        email: "sarah@example.com",
        cron_pattern: "0 8 * * *",
        streak_count: 8,
        last_checkin_date: "2026-09-01",
        routine_track: "mindfulness",
        is_active: true,
      },
      {
        id: 3,
        email: "marcus@example.com",
        cron_pattern: "0 8 * * *",
        streak_count: 3,
        last_checkin_date: new Intl.DateTimeFormat("en-CA").format(new Date()),
        routine_track: "learning",
        is_active: true,
      },
    ]);

    const squadRoutes = require("../routes/squad.routes");
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(squadRoutes);
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
  });

  test("1. requires authentication to access squad endpoints", async () => {
    const res = await request(app).get("/api/me/squad");
    expect(res.status).toBe(401);
  });

  test("2. returns inSquad: false when subscriber is not in any squad", async () => {
    const token = generateActionToken("alex@example.com", "routine");
    const res = await request(app).get("/api/me/squad").query({ email: "alex@example.com", token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.inSquad).toBe(false);
    expect(res.body.squad).toBeNull();
  });

  test("3. validates squad name and creates a new squad with leader role", async () => {
    const token = generateActionToken("alex@example.com", "routine");

    // Invalid short name
    const badRes = await request(app)
      .post("/api/me/squad/create")
      .query({ email: "alex@example.com", token })
      .send({ name: "A" });
    expect(badRes.status).toBe(400);

    // Valid squad creation
    const res = await request(app)
      .post("/api/me/squad/create")
      .query({ email: "alex@example.com", token })
      .send({ name: "Morning Titans" });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.squad.name).toBe("Morning Titans");
    expect(res.body.squad.role).toBe("leader");
    expect(res.body.squad.inviteCode).toMatch(/^SQUAD-[A-Z0-9]+$/);

    // Cannot create another squad while already in one
    const dupeRes = await request(app)
      .post("/api/me/squad/create")
      .query({ email: "alex@example.com", token })
      .send({ name: "Second Squad" });
    expect(dupeRes.status).toBe(400);
    expect(dupeRes.body.error).toContain("already a member");
  });

  test("4. allows peers to join via invite code and computes aggregate streak", async () => {
    const alexToken = generateActionToken("alex@example.com", "routine");
    const sarahToken = generateActionToken("sarah@example.com", "routine");

    // Alex creates squad
    const createRes = await request(app)
      .post("/api/me/squad/create")
      .query({ email: "alex@example.com", token: alexToken })
      .send({ name: "Focus Guild" });

    const inviteCode = createRes.body.squad.inviteCode;

    // Sarah joins squad
    const joinRes = await request(app)
      .post("/api/me/squad/join")
      .query({ email: "sarah@example.com", token: sarahToken })
      .send({ invite_code: inviteCode });

    expect(joinRes.status).toBe(200);
    expect(joinRes.body.success).toBe(true);
    expect(joinRes.body.squad.role).toBe("member");

    // Fetch squad details for Alex
    const squadRes = await request(app)
      .get("/api/me/squad")
      .query({ email: "alex@example.com", token: alexToken });

    expect(squadRes.status).toBe(200);
    expect(squadRes.body.inSquad).toBe(true);
    expect(squadRes.body.squad.name).toBe("Focus Guild");
    expect(squadRes.body.stats.totalMembers).toBe(2);
    // Alex has checked in today, Sarah has not
    expect(squadRes.body.stats.todayCompletedCount).toBe(1);
    expect(squadRes.body.stats.allCheckedInToday).toBe(false);

    // Squad aggregate streak is min(5, 8) = 5
    expect(squadRes.body.squad.squadStreak).toBe(5);

    const members = squadRes.body.members;
    expect(members).toHaveLength(2);
    const alexMember = members.find((m) => m.email === "alex@example.com");
    const sarahMember = members.find((m) => m.email === "sarah@example.com");
    expect(alexMember.checkedInToday).toBe(true);
    expect(sarahMember.checkedInToday).toBe(false);
  });

  test("5. handles member leaving, leader succession, and dissolution", async () => {
    const alexToken = generateActionToken("alex@example.com", "routine");
    const sarahToken = generateActionToken("sarah@example.com", "routine");

    // Alex creates squad
    const createRes = await request(app)
      .post("/api/me/squad/create")
      .query({ email: "alex@example.com", token: alexToken })
      .send({ name: "Duo Squad" });

    const inviteCode = createRes.body.squad.inviteCode;

    // Sarah joins
    await request(app)
      .post("/api/me/squad/join")
      .query({ email: "sarah@example.com", token: sarahToken })
      .send({ invite_code: inviteCode });

    // Leader (Alex) leaves squad -> Sarah promoted to leader
    const leaveRes = await request(app)
      .post("/api/me/squad/leave")
      .query({ email: "alex@example.com", token: alexToken });

    expect(leaveRes.status).toBe(200);

    // Check Sarah's view: she should now be leader
    const sarahSquadRes = await request(app)
      .get("/api/me/squad")
      .query({ email: "sarah@example.com", token: sarahToken });

    expect(sarahSquadRes.body.inSquad).toBe(true);
    expect(sarahSquadRes.body.stats.totalMembers).toBe(1);
    expect(sarahSquadRes.body.squad.userRole).toBe("leader");

    // Sarah leaves squad -> squad dissolves
    await request(app)
      .post("/api/me/squad/leave")
      .query({ email: "sarah@example.com", token: sarahToken });

    const finalRes = await request(app)
      .get("/api/me/squad")
      .query({ email: "sarah@example.com", token: sarahToken });

    expect(finalRes.body.inSquad).toBe(false);
  });
});
