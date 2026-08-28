process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");

jest.mock("../db/knex", () => ({}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockImplementation((track) => ({
    track: track || "deep-work",
    name: "Deep Work & Builder",
    badge: "⚡ Deep Work & Builder",
    tagline: "High-focus engineering rituals",
    ritual: "Select your #1 most critical deliverable.",
    quote: "Deep work is the superpower of the 21st century. - Cal Newport",
    checklist: ["Hydrate (500ml)", "Silence Notifications", "Open IDE & Begin 25m Sprint"],
  })),
}));

jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const { generateActionToken } = require("../helper/unsubscribeToken");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Habit Streak & Check-in Edge Cases", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe("GET /checkin", () => {
    test("rejects check-in when email or token are missing", async () => {
      const res = await request(app).get("/checkin");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Invalid Check-in Link/i);
    });

    test("rejects check-in with tampered or incorrect action token", async () => {
      const email = "streak@example.com";
      const wrongToken = "invalid-checkin-token-12345";

      const res = await request(app).get(
        `/checkin?email=${encodeURIComponent(email)}&token=${wrongToken}`,
      );
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Link Expired or Invalid/i);
    });

    test("rejects check-in when token action is unauthorized", async () => {
      const email = "streak@example.com";
      // Generate a token for an unauthorized action
      const unauthorizedToken = generateActionToken(email, "unauthorized_action");

      const res = await request(app).get(
        `/checkin?email=${encodeURIComponent(email)}&token=${unauthorizedToken}`,
      );
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Link Expired or Invalid/i);
    });

    test("successfully completes first-time check-in and renders Day 1 celebration", async () => {
      const email = "firstday@example.com";
      const token = generateActionToken(email, "checkin");

      sharedData.getUserByEmail.mockResolvedValue({
        email,
        streakCount: 0,
        routineTrack: "deep-work",
        timezone: "America/New_York",
      });

      sharedData.recordCheckin.mockResolvedValue({
        success: true,
        email,
        streak: 1,
        alreadyCheckedInToday: false,
      });

      const res = await request(app).get(
        `/checkin?email=${encodeURIComponent(email)}&token=${token}`,
      );
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Day 1 Complete/i);
      expect(res.text).toMatch(/1-Day Active Streak/i);
      expect(sharedData.recordCheckin).toHaveBeenCalledWith(email, "America/New_York");
    });

    test("handles duplicate same-day check-in without double incrementing", async () => {
      const email = "duplicate@example.com";
      const token = generateActionToken(email, "checkin");

      sharedData.getUserByEmail.mockResolvedValue({
        email,
        streakCount: 5,
        routineTrack: "mindfulness",
        timezone: "Asia/Tokyo",
      });

      sharedData.recordCheckin.mockResolvedValue({
        success: true,
        email,
        streak: 5,
        alreadyCheckedInToday: true,
      });

      const res = await request(app).get(
        `/checkin?email=${encodeURIComponent(email)}&token=${token}`,
      );
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/5-Day Streak Maintained/i);
      expect(res.text).toMatch(/Already Checked In/i);
    });
  });
});
