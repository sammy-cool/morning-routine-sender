// __tests__/journal.test.js
process.env.USE_MOCK_REDIS = "true";

const { newDb } = require("pg-mem");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const migration = require("../db/migrations/20260829000000_create_journal_entries_table");
const subscribersMigration = require("../db/migrations/20260711172620_create_subscribers_table");
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
  return (table) => mockKnexInstance(table);
});

describe("Morning Reflection & Journaling", () => {
  let app;
  let memDb;

  beforeEach(async () => {
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex(0);

    // Run schema migrations
    await subscribersMigration.up(mockKnexInstance);
    await migration.up(mockKnexInstance);

    // Seed test subscriber
    await mockKnexInstance("subscribers").insert({
      id: 1,
      email: "builder@example.com",
      cron_pattern: "0 8 * * *",
      timezone: "America/New_York",
      is_active: true,
    });

    const journalRoutes = require("../routes/journal.routes");
    app = express();
    app.use(express.json());
    app.use(cookieParser());
    app.use(journalRoutes);
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
  });

  describe("Schema Migration", () => {
    test("creates journal_entries table and enforces unique (subscriber_email, entry_date)", async () => {
      await mockKnexInstance("journal_entries").insert({
        subscriber_email: "builder@example.com",
        entry_date: "2026-08-29",
        track_key: "deep-work",
        one_big_thing: "Ship Morning Journaling Feature",
        gratitude: "Great coffee and clarity",
        reflection_text: "Laser focused on architecture",
        mood_score: 5,
      });

      const row = await mockKnexInstance("journal_entries")
        .where({ subscriber_email: "builder@example.com", entry_date: "2026-08-29" })
        .first();

      expect(row.subscriber_email).toBe("builder@example.com");
      expect(row.mood_score).toBe(5);
      expect(row.one_big_thing).toBe("Ship Morning Journaling Feature");

      // Enforces unique constraint
      await expect(
        mockKnexInstance("journal_entries").insert({
          subscriber_email: "builder@example.com",
          entry_date: "2026-08-29",
          one_big_thing: "Duplicate attempt",
        }),
      ).rejects.toThrow();
    });

    test("down() drops journal_entries table", async () => {
      await migration.down(mockKnexInstance);
      await expect(mockKnexInstance("journal_entries").select("*")).rejects.toThrow();
    });
  });

  describe("Authentication & Authorization", () => {
    test("rejects unauthenticated requests with 401", async () => {
      const res = await request(app).get("/api/journal/today");
      expect(res.status).toBe(401);
    });

    test("authenticates via valid action token", async () => {
      const email = "builder@example.com";
      const token = generateActionToken(email, "journal");

      const res = await request(app).get(
        `/api/journal/today?email=${encodeURIComponent(email)}&token=${token}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscriberEmail).toBe("builder@example.com");
    });
  });

  describe("POST /api/journal/save & GET /api/journal/today", () => {
    test("saves and loads today's journal entry", async () => {
      const email = "builder@example.com";
      const token = generateActionToken(email, "journal");

      const saveRes = await request(app)
        .post(`/api/journal/save?email=${encodeURIComponent(email)}&token=${token}`)
        .send({
          one_big_thing: "Build clean Knex migrations",
          gratitude: "Supportive team",
          reflection_text: "Deep flow state achieved",
          mood_score: 5,
        });

      expect(saveRes.status).toBe(200);
      expect(saveRes.body.success).toBe(true);
      expect(saveRes.body.entry.mood_score).toBe(5);

      const todayRes = await request(app).get(
        `/api/journal/today?email=${encodeURIComponent(email)}&token=${token}`,
      );

      expect(todayRes.status).toBe(200);
      expect(todayRes.body.entry.one_big_thing).toBe("Build clean Knex migrations");
    });

    test("rejects invalid mood_score (< 1 or > 5)", async () => {
      const email = "builder@example.com";
      const token = generateActionToken(email, "journal");

      const res = await request(app)
        .post(`/api/journal/save?email=${encodeURIComponent(email)}&token=${token}`)
        .send({
          mood_score: 99,
        });

      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/mood_score/i);
    });
  });

  describe("GET /api/journal/history & GET /api/journal/export", () => {
    test("returns history and supports markdown / json exports", async () => {
      const email = "builder@example.com";
      const token = generateActionToken(email, "journal");

      await mockKnexInstance("journal_entries").insert([
        {
          subscriber_email: email,
          entry_date: "2026-08-28",
          track_key: "deep-work",
          one_big_thing: "Day 1 priority",
          gratitude: "Good sleep",
          reflection_text: "High energy",
          mood_score: 4,
        },
        {
          subscriber_email: email,
          entry_date: "2026-08-29",
          track_key: "deep-work",
          one_big_thing: "Day 2 priority",
          gratitude: "Sunlight",
          reflection_text: "Focus",
          mood_score: 5,
        },
      ]);

      const historyRes = await request(app).get(
        `/api/journal/history?email=${encodeURIComponent(email)}&token=${token}`,
      );
      expect(historyRes.status).toBe(200);
      expect(historyRes.body.count).toBe(2);

      const mdRes = await request(app).get(
        `/api/journal/export?format=markdown&email=${encodeURIComponent(email)}&token=${token}`,
      );
      expect(mdRes.status).toBe(200);
      expect(mdRes.headers["content-type"]).toMatch(/text\/markdown/);
      expect(mdRes.text).toContain("Morning Reflection & Journal Archive");
      expect(mdRes.text).toContain("Day 1 priority");

      const jsonRes = await request(app).get(
        `/api/journal/export?format=json&email=${encodeURIComponent(email)}&token=${token}`,
      );
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.totalEntries).toBe(2);
    });
  });
});
