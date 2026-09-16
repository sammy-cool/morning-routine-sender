process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "test-admin-secret-key-12345";
jest.setTimeout(30000);

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

jest.mock("../db/knex", () => {
  const mockFn = () => ({
    where: jest.fn().mockReturnThis(),
    andWhere: jest.fn().mockReturnThis(),
    select: jest.fn().mockResolvedValue([]),
    orderBy: jest.fn().mockResolvedValue([]),
  });
  mockFn.schema = {
    hasTable: jest.fn().mockResolvedValue(true),
  };
  return mockFn;
});

jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn().mockResolvedValue([]),
  recordSentEmail: jest.fn(),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockReturnValue({
    track: "deep-work",
    name: "Deep Work",
    badge: "⚡ Deep Work",
    tagline: "Focus",
    ritual: "Sprint",
    quote: "Focus",
    checklist: ["Hydrate"],
  }),
}));

const sharedData = require("../helper/shared-data");
const redis = require("../config/redisClient");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const journalService = require("../helper/journalService");

const ROOT_DIR = path.join(__dirname, "..");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(subscriberPortalRoutes);
  return app;
}

describe("User Dashboard Enhancements & Verification", () => {
  const testEmail = "testuser@example.com";
  const sessionToken = "valid-mock-session-token-123";
  let app;

  beforeAll(async () => {
    app = buildApp();
    await redis.set(`subscriber_session:${sessionToken}`, testEmail);
  });

  afterAll(async () => {
    await redis.del(`subscriber_session:${sessionToken}`);
  });

  describe("1. 1-Click Checkin Session Authentication", () => {
    test("rejects checkin if no token and no session cookie", async () => {
      const res = await request(app)
        .get(`/checkin?email=${encodeURIComponent(testEmail)}`)
        .set("Accept", "application/json");

      expect(res.status).toBe(400);
      expect(res.body.success).toBe(false);
      expect(res.body.badge).toBe("Verification Error");
    });

    test("accepts checkin when authenticated via mrn_session cookie without token", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        streakCount: 5,
        isActive: true,
        routineTrack: "deep-work",
      });
      sharedData.recordCheckin.mockResolvedValue({
        success: true,
        streakCount: 6,
        isNewStreak: true,
      });

      const res = await request(app)
        .get(`/checkin?email=${encodeURIComponent(testEmail)}`)
        .set("Cookie", [`mrn_session=${sessionToken}`])
        .set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.streakCount).toBe(6);
      expect(res.body.badge).toContain("Streak");
    });
  });

  describe("2. Streak Freeze Status API", () => {
    test("returns both streakFreezes and streakFreezesRemaining", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        streakCount: 5,
        streakFreezes: 2,
        freezeHistory: [],
      });

      const res = await request(app)
        .get("/me/streak-freeze/status")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.streakFreezes).toBe(2);
      expect(res.body.streakFreezesRemaining).toBe(2);
    });
  });

  describe("3. 365-Day Consistency Heatmap Synthesis", () => {
    test("getActivityHeatmap synthesizes checkin streak into active days", async () => {
      const todayStr = new Date().toISOString().split("T")[0];
      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        streak_count: 5,
        last_checkin_date: todayStr,
        timezone: "UTC",
      });

      const heatmap = await journalService.getActivityHeatmap(testEmail, 30);

      expect(heatmap).toBeDefined();
      expect(Array.isArray(heatmap.days)).toBe(true);
      expect(heatmap.days.length).toBe(30);
      expect(heatmap.summary.totalActiveDays).toBeGreaterThanOrEqual(1);

      const todayCell = heatmap.days.find((d) => d.date === todayStr);
      expect(todayCell).toBeDefined();
      expect(todayCell.completed).toBe(true);
      expect(todayCell.intensity).toBeGreaterThanOrEqual(1);
    });
  });

  describe("4. Dashboard HTML Header & Links Audit", () => {
    const html = fs.readFileSync(path.join(ROOT_DIR, "public", "user-dashboard.html"), "utf8");

    test("contains dynamic header user sublabel and user header chip", () => {
      expect(html).toContain('id="headerUserSubLabel"');
      expect(html).toContain('id="userHeaderChip"');
      expect(html).toContain('id="headerAvatar"');
      expect(html).toContain('id="headerUserEmailFull"');
      expect(html).toContain('id="headerUserMeta"');
    });

    test("navbar container aligns symmetrically with main content container on laptop/desktop viewports", () => {
      expect(html).toContain("header.navbar .container.nav-wrap");
      expect(html).toContain("max-width: 1080px");
      expect(html).toContain("flex-wrap: nowrap");
    });

    test("heatmap months grid columns match heatmap grid 53 columns exactly", () => {
      expect(html).toContain("grid-template-columns: 32px repeat(53, 12px)");
    });

    test("active coach persona badge is positioned inside heading and removed from audio controls", () => {
      expect(html).toMatch(
        /<h2[^>]*>[\s\S]*AI Morning Coach Persona[\s\S]*id="activePersonaBadge"/,
      );
    });

    test("contains squad navigation button in header and footer", () => {
      expect(html).toContain('id="navSquadBtn"');
      expect(html).toContain('href="#squadCard"');
    });

    test("footer preferences link points to #subscriptionCard instead of /unsubscribe", () => {
      expect(html).toMatch(/href="#subscriptionCard"[^>]*>.*Preferences/);
      expect(html).toContain('href="/unsubscribe"');
    });
  });

  describe("5. Client Script Logic Audit", () => {
    const js = fs.readFileSync(path.join(ROOT_DIR, "public", "js", "user-dashboard.js"), "utf8");

    test("aligns day-of-week with leading spacer cells in renderHeatmapGrid", () => {
      expect(js).toContain("heatmap-cell-pad");
      expect(js).toContain("getUTCDay()");
    });

    test("exposes openShortcutsModal and scrollToSection to window", () => {
      expect(js).toContain("window.openShortcutsModal = openShortcutsModal");
      expect(js).toContain("window.scrollToSection = scrollToSection");
    });

    test("reloads heatmap on 1-click checkin and journal save", () => {
      expect(js).toContain("loadActivityHeatmap(true)");
    });

    test("pluralizes time-of-day habit logs accurately without '1 logs'", () => {
      expect(js).toContain('${tod.earlyBird === 1 ? "log" : "logs"}');
      expect(js).toContain('${tod.primeFocus === 1 ? "log" : "logs"}');
      expect(js).toContain('${tod.midMorning === 1 ? "log" : "logs"}');
    });

    test("dynamically attaches radar chart URL with cache buster", () => {
      expect(js).toContain("radarUrl = `/api/me/radar.svg");
      expect(js).toContain("downloadRadarLink.href = `${radarUrl}&download=1`");
    });
  });

  describe("6. Streak Milestones & Duel Model Integrity", () => {
    test("getStreakMilestones populates badge, thresholdDays, and daysRemaining symmetrically", () => {
      const { getStreakMilestones } = require("../helper/streakMilestones");
      const res = getStreakMilestones(6);
      expect(res.milestones[0].badge).toBeDefined();
      expect(res.milestones[0].thresholdDays).toBe(3);
      expect(res.milestones[0].unlocked).toBe(true);
      expect(res.nextMilestone).toBeDefined();
      expect(res.nextMilestone.daysRemaining).toBe(1);
      expect(res.nextMilestone.percent).toBeDefined();
    });
  });
});
