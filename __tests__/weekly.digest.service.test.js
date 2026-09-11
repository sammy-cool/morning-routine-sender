process.env.USE_MOCK_REDIS = "true";

let mockKnexInstance;
jest.mock("../db/knex", () => {
  const createQueryBuilder = () => {
    const builder = {
      where: jest.fn(() => builder),
      whereIn: jest.fn(() => builder),
      orderBy: jest.fn(() => builder),
      select: jest.fn(() => builder),
      first: jest.fn().mockResolvedValue(null),
      then: (resolve) => Promise.resolve([]).then(resolve),
      catch: (reject) => Promise.resolve([]).catch(reject),
    };
    return builder;
  };

  mockKnexInstance = jest.fn(() => createQueryBuilder());
  mockKnexInstance.schema = {
    hasTable: jest.fn().mockResolvedValue(true),
    hasColumn: jest.fn().mockResolvedValue(true),
  };
  const handler = (table) => mockKnexInstance(table);
  Object.defineProperty(handler, "schema", { get: () => mockKnexInstance.schema });
  return handler;
});

jest.mock("mjml", () =>
  jest.fn((xml) => ({ html: `<html><body>${xml}</body></html>`, errors: [] })),
);

const weeklyDigestService = require("../helper/weeklyDigestService");
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const weeklyDigestRoutes = require("../routes/weeklyDigest.routes");

describe("Weekly Sunday Performance & Habit Digest Engine", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser("test-secret"));
    app.locals = { officialDomain: "https://test.morningroutine.com" };
    app.use(weeklyDigestRoutes);
  });

  describe("Weekly Metrics & 7-Day Calendar Aggregation", () => {
    it("should compute past 7 dates accurately with day labels", () => {
      const dates = weeklyDigestService.getPast7Dates("America/New_York");
      expect(dates).toHaveLength(7);
      dates.forEach((d) => {
        expect(d.dateStr).toMatch(/^\d{4}-\d{2}-\d{2}$/);
        expect(typeof d.dayLabel).toBe("string");
        expect(d.dayLabel.length).toBeGreaterThan(0);
      });
    });

    it("should aggregate weekly metrics gracefully with default mood score", async () => {
      const metrics = await weeklyDigestService.getSubscriberWeeklyMetrics(
        "metrics.tester@example.com",
        "UTC",
      );
      expect(metrics).toHaveProperty("completionCalendar");
      expect(metrics.completionCalendar).toHaveLength(7);
      expect(typeof metrics.completionRate).toBe("number");
      expect(metrics.avgMoodScore).toBeGreaterThanOrEqual(1);
      expect(metrics.avgMoodScore).toBeLessThanOrEqual(5);
      expect(typeof metrics.moodTrendLabel).toBe("string");
    });
  });

  describe("MJML Template Model & HTML Rendering", () => {
    it("should build a complete weekly digest payload model", async () => {
      const subscriber = {
        email: "alex.builder@example.com",
        name: "Alex",
        routineTrack: "deep-work",
        streakCount: 14,
        timezone: "America/New_York",
      };

      const payload = await weeklyDigestService.buildWeeklyDigestPayload(
        subscriber,
        "https://app.morningroutine.com",
      );

      expect(payload.userName).toBe("Alex");
      expect(payload.streakBadge).toBe("14-Day Streak Active");
      expect(payload.trackName).toBe("Deep Work & Builder");
      expect(payload.ctaUrl).toContain("/routine?email=alex.builder%40example.com");
      expect(payload.checkinUrl).toContain("/checkin?email=alex.builder%40example.com");
      expect(payload.unsubscribeUrl).toContain("/unsubscribe?email=alex.builder%40example.com");
      expect(payload.weeklyReportCardUrl).toContain("/api/weekly-report/");
      expect(payload.weeklyReportCardDownloadUrl).toContain("download=1");
      expect(payload.aiFocusMantra).toBeDefined();
    });

    it("should compile MJML to valid responsive HTML containing key elements", async () => {
      const payload = {
        userName: "Dev User",
        year: "2026",
        trackName: "Deep Work & Builder",
        trackBadge: "⚡ Deep Work",
        streakCount: 7,
        streakBadge: "7-Day Streak Active",
        streakEncouragement: "Solid focus all week!",
        weeklyQuote: "Focus is a superpower.",
        weeklyPrepItems: [{ title: "Prep #1", description: "Clear inbox" }],
        completionCalendar: [
          { date: "2026-08-23", dayLabel: "S", completed: true },
          { date: "2026-08-24", dayLabel: "M", completed: true },
          { date: "2026-08-25", dayLabel: "T", completed: false },
          { date: "2026-08-26", dayLabel: "W", completed: true },
          { date: "2026-08-27", dayLabel: "T", completed: true },
          { date: "2026-08-28", dayLabel: "F", completed: true },
          { date: "2026-08-29", dayLabel: "S", completed: true },
        ],
        completedDaysCount: 6,
        completionRate: 86,
        avgMoodScore: 4.8,
        moodTrendLabel: "⚡ Peak Flow & Momentum",
        moodSummaryText: "High energy logged throughout the sprint.",
        topWins: [{ date: "2026-08-28", text: "Shipped the core compiler engine" }],
        hasWins: true,
        aiSparkReflection: "Momentum is built one focused hour at a time.",
        aiMicroAction: "Pick 1 needle-mover task first thing Monday.",
        aiFocusMantra: "Deep work creates outsized leverage.",
        ctaUrl: "https://example.com/routine",
        checkinUrl: "https://example.com/checkin",
        preferencesUrl: "https://example.com/user-dashboard",
        unsubscribeUrl: "https://example.com/unsubscribe",
      };

      const { html, text } = await weeklyDigestService.renderWeeklyDigestHtml(payload);
      expect(html).toContain("Weekly Performance &amp; Habit Digest");
      expect(html).toContain("7-Day Streak Active");
      expect(html).toContain("Peak Flow &amp; Momentum");
      expect(html).toContain("Shipped the core compiler engine");
      expect(text).toContain("Weekly Performance & Habit Digest for Dev User");
    });
  });

  describe("Weekly Digest API Endpoints", () => {
    it("GET /api/weekly-digest/preview?format=json should return complete payload model", async () => {
      const res = await request(app).get(
        "/api/weekly-digest/preview?format=json&track=mindfulness",
      );
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.payload).toBeDefined();
      expect(res.body.payload.trackName).toBe("Mindfulness & Stoic");
    });

    it("GET /api/weekly-digest/preview should return compiled HTML preview", async () => {
      const res = await request(app).get("/api/weekly-digest/preview?format=html&track=executive");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("Weekly Performance &amp; Habit Digest");
    });

    it("POST /api/weekly-digest/dispatch should require authorization", async () => {
      const res = await request(app).post("/api/weekly-digest/dispatch");
      expect(res.status).toBe(403);
    });
  });
});
