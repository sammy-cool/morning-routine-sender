// __tests__/xp.deliverability.scheduling.edge.test.js
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");

jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  updateUser: jest.fn().mockResolvedValue(true),
  setUserActive: jest.fn().mockResolvedValue(true),
  getAllUsers: jest.fn().mockResolvedValue([]),
}));

jest.mock("../helper/journalService", () => ({
  getAllEntries: jest.fn().mockResolvedValue([]),
  recordEntry: jest.fn().mockResolvedValue({ id: 1 }),
}));

jest.mock("../email-core/emailScheduler", () => ({
  rescheduleUserJob: jest.fn().mockReturnValue(true),
  stopUserJob: jest.fn().mockReturnValue(true),
}));

jest.mock("../middleware/subscriberSession", () => ({
  requireSubscriberSession: (req, res, next) => {
    req.subscriberEmail = req.cookies?.mrn_session
      ? "alex.builder@example.com"
      : req.subscriberEmail || null;
    if (!req.subscriberEmail) {
      return res.status(401).json({ error: "Not logged in" });
    }
    next();
  },
  requireSubscriberAuth: (req, res, next) => {
    req.subscriberEmail = "alex.builder@example.com";
    next();
  },
  getSubscriberAuthEmail: jest.fn().mockResolvedValue("alex.builder@example.com"),
}));

jest.mock("../middleware/requireAdmin", () => ({
  requireAdmin: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const journalService = require("../helper/journalService");
const emailScheduler = require("../email-core/emailScheduler");

const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const deliverabilityRoutes = require("../routes/deliverability.routes");

function createApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(subscriberPortalRoutes);
  app.use("/admin/deliverability", deliverabilityRoutes);
  return app;
}

describe("XP, Deliverability Sparkline & Smart Scheduling Edge Tests", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = createApp();
  });

  describe("Gamification XP Endpoints (GET /me/xp & GET /api/me/xp)", () => {
    test("rejects unauthenticated request with 401", async () => {
      const res = await request(app).get("/api/me/xp");
      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Not logged in");
    });

    test("returns 404 if subscriber profile not found", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);
      const res = await request(app).get("/api/me/xp").set("Cookie", ["mrn_session=mock-token"]);
      expect(res.status).toBe(404);
      expect(res.body.error).toContain("not found");
    });

    test("returns full XP profile and level for authenticated subscriber", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "alex.builder@example.com",
        streakCount: 14,
        duelWins: 3,
      });

      journalService.getAllEntries.mockResolvedValue([
        {
          verified_wakeup: true,
          one_big_thing: "Physical Hardware / NFC Wake-Up Verified",
          mood_score: 5,
          gratitude: "Morning stillness",
          reflection_text: "High output morning",
        },
        {
          verified_wakeup: true,
          one_big_thing: "Launch gamification feature",
          mood_score: 4,
          gratitude: "Code velocity",
          reflection_text: "Deep work session",
        },
      ]);

      const res = await request(app).get("/api/me/xp").set("Cookie", ["mrn_session=mock-token"]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscriber).toBe("alex.builder@example.com");
      expect(res.body.level).toBeGreaterThanOrEqual(1);
      expect(res.body.name).toBeDefined();
      expect(res.body.totalXp).toBeGreaterThan(0);
      expect(res.body.breakdown).toBeDefined();
      expect(res.body.breakdown.journalEntries).toBe(60); // 2 * 30
      expect(res.body.breakdown.duelWins).toBe(300); // 3 * 100
    });
  });

  describe("Deliverability Sparkline & Health Endpoints", () => {
    test("GET /admin/deliverability/sparkline.svg returns valid SVG image", async () => {
      const res = await request(app).get("/admin/deliverability/sparkline.svg");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/image\/svg\+xml/);
      const svg = res.text || (res.body ? res.body.toString("utf8") : "");
      expect(svg).toContain("<svg");
      expect(svg).toContain("EMAIL DELIVERABILITY");
      expect(svg).toContain("</svg>");
    });

    test("GET /admin/deliverability/health returns healthy telemetry", async () => {
      const res = await request(app).get("/admin/deliverability/health");
      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.healthy).toBe(true);
      expect(res.body.checkedAt).toBeDefined();
    });
  });

  describe("Smart Scheduling & Time Picker (PATCH /me & PATCH /me/preferences)", () => {
    test("accepts sendTime '06:30' and auto-computes weekday cronPattern", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "alex.builder@example.com",
      });

      const res = await request(app)
        .patch("/me/preferences")
        .set("Cookie", ["mrn_session=mock-token"])
        .send({
          sendTime: "06:30",
          optimalSendWindow: true,
        });

      expect(res.status).toBe(200);
      expect(sharedData.updateUser).toHaveBeenCalledWith(
        "alex.builder@example.com",
        expect.objectContaining({
          sendTime: "06:30",
          cronPattern: "30 6 * * 1-5",
          optimalSendWindow: true,
        }),
      );
      expect(emailScheduler.rescheduleUserJob).toHaveBeenCalledWith("alex.builder@example.com");
    });

    test("accepts weekendSendTime '08:45' and auto-computes weekendCronPattern", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "alex.builder@example.com",
      });

      const res = await request(app)
        .patch("/me/preferences")
        .set("Cookie", ["mrn_session=mock-token"])
        .send({
          weekendSendTime: "08:45",
          quietHours: { start: 22, end: 6 },
        });

      expect(res.status).toBe(200);
      expect(sharedData.updateUser).toHaveBeenCalledWith(
        "alex.builder@example.com",
        expect.objectContaining({
          weekendSendTime: "08:45",
          weekendCronPattern: "45 8 * * 0,6",
          quietHours: { start: 22, end: 6 },
        }),
      );
    });

    test("rejects invalid sendTime format with 400", async () => {
      const res = await request(app)
        .patch("/me/preferences")
        .set("Cookie", ["mrn_session=mock-token"])
        .send({
          sendTime: "invalid-time",
        });

      expect(res.status).toBe(400);
      expect(res.body.errors[0]).toContain("HH:MM 24-hour format");
    });

    test("rejects invalid quietHours with 400", async () => {
      const res = await request(app)
        .patch("/me/preferences")
        .set("Cookie", ["mrn_session=mock-token"])
        .send({
          quietHours: { start: 25, end: -1 },
        });

      expect(res.status).toBe(400);
      expect(res.body.errors[0]).toContain(
        "quietHours must be an object with start and end numbers between 0 and 23",
      );
    });
  });
});
