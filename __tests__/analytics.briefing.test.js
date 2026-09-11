// __tests__/analytics.briefing.test.js
process.env.USE_MOCK_REDIS = "true";

const { newDb } = require("pg-mem");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const journalMigration = require("../db/migrations/20260829000000_create_journal_entries_table");
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

describe("Habit Analytics & Morning Audio Briefing Services", () => {
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
    await journalMigration.up(mockKnexInstance);

    const todayStr = new Intl.DateTimeFormat("en-CA").format(new Date());

    // Seed test subscriber
    await mockKnexInstance("subscribers").insert({
      id: 1,
      email: "leader@example.com",
      cron_pattern: "0 8 * * *",
      streak_count: 14,
      streak_freezes: 2,
      last_checkin_date: todayStr,
      routine_track: "deep-work",
      coach_persona: "stoic",
      is_active: true,
    });

    // Seed journal reflections
    await mockKnexInstance("journal_entries").insert([
      {
        subscriber_id: 1,
        subscriber_email: "leader@example.com",
        entry_date: todayStr,
        track_key: "deep-work",
        one_big_thing: "Architect new system modules",
        gratitude: "Clear morning clarity",
        mood_score: 5,
        created_at: new Date("2026-09-11T07:30:00Z"),
      },
      {
        subscriber_id: 1,
        subscriber_email: "leader@example.com",
        entry_date: "2026-09-10",
        track_key: "deep-work",
        one_big_thing: "Write automated tests",
        gratitude: "Good sleep",
        mood_score: 4,
        created_at: new Date("2026-09-10T08:15:00Z"),
      },
    ]);

    const routes = require("../routes/subscriberEnhancements.routes");
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(routes);
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
  });

  test("1. requires authentication for analytics and briefing endpoints", async () => {
    const resA = await request(app).get("/api/me/analytics");
    expect(resA.status).toBe(401);

    const resB = await request(app).get("/api/me/briefing");
    expect(resB.status).toBe(401);
  });

  test("2. computes habit analytics with 7-day rate, weekday consistency, and time-of-day buckets", async () => {
    const token = generateActionToken("leader@example.com", "routine");
    const res = await request(app)
      .get("/api/me/analytics")
      .query({ email: "leader@example.com", token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const a = res.body.analytics;
    expect(a.currentStreak).toBe(14);
    expect(a.streakFreezes).toBe(2);
    expect(a.totalEntriesLogged).toBe(2);
    expect(a.avgMoodScore).toBe(4.5);
    expect(a.peakFocusWindow).toBeDefined();

    // Check weekday breakdown
    expect(Array.isArray(a.weekdayBreakdown)).toBe(true);
    expect(a.weekdayBreakdown).toHaveLength(7);

    // Check time of day distribution
    expect(a.timeOfDayDistribution).toBeDefined();
    expect(typeof a.timeOfDayDistribution.primeFocus).toBe("number");
  });

  test("3. generates personalized audio briefing script with coach persona directives", async () => {
    const token = generateActionToken("leader@example.com", "routine");
    const res = await request(app)
      .get("/api/me/briefing")
      .query({ email: "leader@example.com", token });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);

    const b = res.body.briefing;
    expect(b.title).toContain("Morning Focus Briefing");
    expect(b.persona).toBe("stoic");
    expect(b.coachTitle).toContain("Stoic Sage");
    expect(b.estimatedDurationSec).toBeGreaterThan(20);
    expect(Array.isArray(b.sections)).toBe(true);
    expect(b.fullScript).toContain("Welcome");
    expect(b.fullScript).toContain("discipline");
  });
});
