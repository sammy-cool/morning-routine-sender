process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const cookieParser = require("cookie-parser");

let mockAuthenticatedEmail = "nfc.runner@example.com";

jest.mock("../middleware/subscriberSession", () => ({
  requireSubscriberSession: (req, res, next) => {
    if (!mockAuthenticatedEmail) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    req.subscriberEmail = mockAuthenticatedEmail;
    req.subscriberSession = { email: mockAuthenticatedEmail };
    next();
  },
  requireSubscriberAuth: (req, res, next) => {
    if (!mockAuthenticatedEmail) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }
    req.subscriberEmail = mockAuthenticatedEmail;
    req.subscriberSession = { email: mockAuthenticatedEmail };
    next();
  },
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (_req, _res, next) => next(),
  authLimiter: (_req, _res, next) => next(),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockReturnValue({
    quote: "Every morning is a new beginning.",
  }),
}));

jest.mock("../helper/journalService", () => ({
  recordEntry: jest.fn().mockResolvedValue({ id: 101 }),
  saveEntry: jest.fn().mockResolvedValue({ id: 101 }),
}));

jest.mock("../helper/channelDispatcher", () => ({
  dispatchChannelsForSubscriber: jest.fn().mockResolvedValue({ dispatched: 1, results: [] }),
}));

jest.mock("../push-core/pushService", () => ({
  dispatchMorningPushForSubscriber: jest.fn().mockResolvedValue({ status: "dispatched" }),
}));

const sharedData = require("../helper/shared-data");
const journalService = require("../helper/journalService");
const channelDispatcher = require("../helper/channelDispatcher");
const { generateActionToken } = require("../helper/unsubscribeToken");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser("test-secret"));
  app.locals = { officialDomain: "https://test.morningroutine.com" };
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Hardware NFC & Apple Shortcuts Wake-Up Checkin Integration", () => {
  let app;
  const testEmail = "nfc.runner@example.com";
  let validHardwareToken;
  let validCheckinToken;

  beforeEach(() => {
    jest.clearAllMocks();
    mockAuthenticatedEmail = testEmail;
    validHardwareToken = generateActionToken(testEmail, "hardware");
    validCheckinToken = generateActionToken(testEmail, "checkin");
    app = buildTestApp();
  });

  describe("POST & GET /api/me/hardware-checkin Authentication & Token Verification", () => {
    it("should reject request with 401 when token is missing", async () => {
      const res = await request(app).post("/api/me/hardware-checkin").send({ email: testEmail });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Missing or invalid hardware verification token/i);
    });

    it("should reject request with 401 when token is invalid", async () => {
      const res = await request(app)
        .post("/api/me/hardware-checkin")
        .send({ email: testEmail, token: "invalid-bogus-token-12345" });

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toMatch(/Invalid or expired verification token/i);
    });

    it("should reject request with 404 when subscriber is not found", async () => {
      sharedData.getUserByEmail.mockResolvedValueOnce(null);

      const res = await request(app)
        .post("/api/me/hardware-checkin")
        .send({ email: testEmail, token: validHardwareToken });

      expect(res.status).toBe(404);
      expect(res.body.success).toBe(false);
      expect(res.body.error).toBe("Subscriber not found");
    });
  });

  describe("Successful Physical NFC Hardware Check-in Flow", () => {
    it("should verify wake-up, increment streak, record journal entry, and trigger notification via POST", async () => {
      const mockSubscriber = {
        email: testEmail,
        streakCount: 5,
        timezone: "America/New_York",
        channelsEnabled: "discord,telegram",
      };

      sharedData.getUserByEmail.mockResolvedValue(mockSubscriber);
      sharedData.recordCheckin.mockResolvedValueOnce({
        success: true,
        email: testEmail,
        streakCount: 6,
        streak: 6,
        alreadyCheckedInToday: false,
      });

      const res = await request(app).post("/api/me/hardware-checkin").send({
        email: testEmail,
        token: validHardwareToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.verifiedWakeup).toBe(true);
      expect(res.body.streak).toBe(6);
      expect(res.body.message).toBe("⚡ Physical Wake-Up Verified!");

      // Verify journal entry recorded
      expect(journalService.recordEntry).toHaveBeenCalledWith(
        testEmail,
        expect.objectContaining({
          one_big_thing: "Physical NFC / Hardware Wake-Up Verified",
          verified_wakeup: true,
          streak: 6,
        }),
      );

      // Verify notification dispatched
      expect(channelDispatcher.dispatchChannelsForSubscriber).toHaveBeenCalled();
    });

    it("should accept valid check-in token as alternative to hardware token", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        streakCount: 2,
        timezone: "UTC",
      });
      sharedData.recordCheckin.mockResolvedValueOnce({
        success: true,
        streakCount: 3,
        streak: 3,
        alreadyCheckedInToday: false,
      });

      const res = await request(app).get(
        `/api/me/hardware-checkin?email=${encodeURIComponent(testEmail)}&token=${validCheckinToken}`,
      );

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.streak).toBe(3);
      expect(res.body.verifiedWakeup).toBe(true);
    });

    it("should accept token via Authorization Bearer header", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        streakCount: 1,
        timezone: "UTC",
      });
      sharedData.recordCheckin.mockResolvedValueOnce({
        success: true,
        streakCount: 2,
        streak: 2,
        alreadyCheckedInToday: false,
      });

      const res = await request(app)
        .post("/api/me/hardware-checkin")
        .set("Authorization", `Bearer ${validHardwareToken}`)
        .send({ email: testEmail });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.streak).toBe(2);
    });
  });

  describe("Idempotency (Checking in Twice in the Same Day)", () => {
    it("should return alreadyCheckedIn: true with existing streak when checking in twice", async () => {
      const mockSubscriber = {
        email: testEmail,
        streakCount: 12,
        timezone: "America/New_York",
      };

      sharedData.getUserByEmail.mockResolvedValue(mockSubscriber);
      sharedData.recordCheckin.mockResolvedValueOnce({
        success: true,
        email: testEmail,
        streakCount: 12,
        streak: 12,
        alreadyCheckedInToday: true,
      });

      const res = await request(app).post("/api/me/hardware-checkin").send({
        email: testEmail,
        token: validHardwareToken,
      });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.alreadyCheckedIn).toBe(true);
      expect(res.body.streak).toBe(12);
      expect(res.body.message).toBe("Morning routine already verified today!");

      // Journal entry should NOT be duplicated on redundant same-day checkin
      expect(journalService.recordEntry).not.toHaveBeenCalled();
    });
  });

  describe("GET /api/me/shortcut-config Endpoint", () => {
    it("should return personal webhook URL and automation instructions for authenticated subscriber", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        streakCount: 5,
      });

      const res = await request(app).get("/api/me/shortcut-config");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.token).toBe(validHardwareToken);
      expect(res.body.webhookUrl).toContain("/api/me/hardware-checkin");
      expect(res.body.webhookUrl).toContain(`token=${validHardwareToken}`);
      expect(res.body.webhookUrl).toContain(`email=${encodeURIComponent(testEmail)}`);
      expect(res.body.instructions).toHaveProperty("ios");
      expect(res.body.instructions).toHaveProperty("android");
      expect(res.body.instructions.ios).toContain("Apple Shortcuts");
      expect(res.body.instructions.android).toContain("NFC Tag trigger");
    });

    it("should reject unauthenticated request with 401", async () => {
      mockAuthenticatedEmail = null;

      const res = await request(app).get("/api/me/shortcut-config");

      expect(res.status).toBe(401);
      expect(res.body.success).toBe(false);
    });
  });
});
