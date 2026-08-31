process.env.USE_MOCK_REDIS = "true";

const { newDb } = require("pg-mem");
const subscribersMigration = require("../db/migrations/20260711172620_create_subscribers_table");
const streaksMigration = require("../db/migrations/20260828000000_add_streaks_and_track_to_subscribers");
const journalMigration = require("../db/migrations/20260829000000_create_journal_entries_table");

let mockKnexInstance;
jest.mock("../db/knex", () => {
  const handler = (...args) => mockKnexInstance(...args);
  Object.defineProperty(handler, "schema", {
    get: () => mockKnexInstance.schema,
  });
  handler.fn = { now: () => new Date().toISOString() };
  return handler;
});

const journalService = require("../helper/journalService");

describe("365-Day Activity & Reflection Heatmap Engine", () => {
  const testEmail = "heatmap-tester@example.com";
  let memDb;

  beforeEach(async () => {
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex(0);

    // Apply schema
    await subscribersMigration.up(mockKnexInstance);
    await streaksMigration.up(mockKnexInstance);
    await journalMigration.up(mockKnexInstance);

    // Seed test subscriber
    await mockKnexInstance("subscribers").insert({
      email: testEmail,
      cron_pattern: "0 8 * * *",
      template_type: "deep-work",
      routine_track: "deep-work",
      timezone: "America/New_York",
      is_active: true,
      streak_count: 5,
    });
  });

  afterEach(async () => {
    if (mockKnexInstance && typeof mockKnexInstance.destroy === "function") {
      await mockKnexInstance.destroy();
    }
  });

  test("getActivityHeatmap returns 365 days of data with correct structure", async () => {
    const heatmap = await journalService.getActivityHeatmap(testEmail, 365);

    expect(heatmap).toBeDefined();
    expect(heatmap.subscriberEmail).toBe(testEmail);
    expect(heatmap.timezone).toBe("America/New_York");
    expect(heatmap.totalDays).toBe(365);
    expect(Array.isArray(heatmap.days)).toBe(true);
    expect(heatmap.days.length).toBe(365);
    expect(heatmap.summary).toBeDefined();
    expect(heatmap.summary.totalActiveDays).toBe(0);
    expect(heatmap.summary.completionRate).toBe("0.0%");
  });

  test("getActivityHeatmap accurately maps intensity levels (0 to 4) and metadata", async () => {
    const todayStr = journalService.getTodayDateInTimezone("America/New_York");

    // Insert entries with different mood scores
    await mockKnexInstance("journal_entries").insert({
      subscriber_email: testEmail,
      entry_date: todayStr,
      track_key: "deep-work",
      mood_score: 5,
      one_big_thing: "Launch Next-Gen Features Bundle",
      gratitude: "Great codebase architecture",
    });

    const heatmap = await journalService.getActivityHeatmap(testEmail, 30);

    expect(heatmap.days.length).toBe(30);
    const todayCell = heatmap.days.find((d) => d.date === todayStr);

    expect(todayCell).toBeDefined();
    expect(todayCell.completed).toBe(true);
    expect(todayCell.count).toBe(1);
    expect(todayCell.intensity).toBe(4);
    expect(todayCell.moodScore).toBe(5);
    expect(todayCell.oneBigThingSnippet).toContain("Launch Next-Gen Features");
    expect(todayCell.hasGratitude).toBe(true);
    expect(heatmap.summary.totalActiveDays).toBe(1);
  });
});
