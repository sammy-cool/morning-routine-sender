process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

jest.mock("../db/knex", () => ({}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));
jest.mock("../email-core/emailScheduler", () => ({
  getScheduledJobsStatus: jest.fn().mockReturnValue([]),
  sendBulkEmails: jest.fn().mockResolvedValue({ total_sent: 0 }),
}));
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  setUserActive: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "unsub-msg-123" });
jest.mock("../config/mailTransporter", () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
  requireAdmin: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const { generateUnsubscribeToken } = require("../helper/unsubscribeToken");
const emailRoutes = require("../routes/email.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.locals.apiBase = "https://routine.example.com";
  app.use(emailRoutes);
  return app;
}

describe("Unsubscribe & Self-Service Edge Cases", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  describe("GET /unsubscribe (Self-service vs Token links)", () => {
    test("direct visit without parameters renders the self-service management portal", async () => {
      const res = await request(app).get("/unsubscribe");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Manage Subscription/i);
      expect(res.text).toMatch(/Send 1-Click Unsubscribe Link/i);
      expect(sharedData.setUserActive).not.toHaveBeenCalled();
    });

    test("visit with email only (missing token) returns link expired/invalid notice", async () => {
      const res = await request(app).get("/unsubscribe?email=test@example.com");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Link Expired or Invalid/i);
      expect(sharedData.setUserActive).not.toHaveBeenCalled();
    });

    test("visit with valid email and signed HMAC token successfully pauses routine", async () => {
      const email = "subscriber@example.com";
      const token = generateUnsubscribeToken(email);
      sharedData.setUserActive.mockResolvedValue(true);

      const res = await request(app).get(`/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/You're Unsubscribed/i);
      expect(sharedData.setUserActive).toHaveBeenCalledWith(email, false);
    });

    test("visit with tampered or forged token is rejected without modifying subscriber state", async () => {
      const email = "subscriber@example.com";
      const forgedToken = "bad-token-1234567890abcdef";

      const res = await request(app).get(`/unsubscribe?email=${encodeURIComponent(email)}&token=${forgedToken}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Link Expired or Invalid/i);
      expect(sharedData.setUserActive).not.toHaveBeenCalled();
    });
  });

  describe("POST /unsubscribe/request (Self-Service 1-Click Link Dispatch)", () => {
    test("sends 1-click unsubscribe email for active subscriber", async () => {
      const email = "active@example.com";
      sharedData.getUserByEmail.mockResolvedValue({
        email,
        isActive: true,
      });

      const res = await request(app)
        .post("/unsubscribe/request")
        .send({ email });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/If that email is subscribed/i);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const mailOptions = mockSendMail.mock.calls[0][0];
      expect(mailOptions.to).toBe(email);
      expect(mailOptions.html).toMatch(/\/unsubscribe\?email=active%40example\.com&token=/);
    });

    test("returns identical generic message for unknown email without sending mail", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);

      const res = await request(app)
        .post("/unsubscribe/request")
        .send({ email: "unknown@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/If that email is subscribed/i);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test("returns generic message for invalid email format", async () => {
      const res = await request(app)
        .post("/unsubscribe/request")
        .send({ email: "not-an-email" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/If that email is subscribed/i);
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });
});
