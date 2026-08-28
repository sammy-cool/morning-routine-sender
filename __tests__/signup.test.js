process.env.USE_MOCK_REDIS = "true";
process.env.UNSUBSCRIBE_SECRET = "test-secret";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  addUser: jest.fn(),
  setUserActive: jest.fn(),
}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
}));
jest.mock("../email-core/emailScheduler", () => ({
  getScheduledJobsStatus: jest.fn(),
  sendBulkEmails: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });
jest.mock("../config/mailTransporter", () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
}));

// Same reasoning as subscriberPortal.test.js: the real limiter is a
// shared singleton whose counter persists across the whole test process.
jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const redis = require("../config/redisClient");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const emailController = require("../controllers/email.controller");
const { generateUnsubscribeToken } = require("../helper/unsubscribeToken");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.locals.apiBase = "http://localhost:2900";
  app.use(subscriberPortalRoutes);
  app.get("/unsubscribe", emailController.unsubscribe);
  return app;
}

function extractConfirmToken(html) {
  return html.match(/token=([a-f0-9]+)/)[1];
}

describe("signup (double opt-in)", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe("POST /subscribe", () => {
    test("rejects an invalid email with a real error", async () => {
      const res = await request(app).post("/subscribe").send({ email: "not-an-email" });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test("rejects an invalid cron pattern with a real error", async () => {
      const res = await request(app)
        .post("/subscribe")
        .send({ email: "new@example.com", cronPattern: "not a cron" });
      expect(res.status).toBe(400);
    });

    test("already-subscribed email gets the generic response, no email sent (no enumeration signal)", async () => {
      sharedData.getUserByEmail.mockResolvedValue({ email: "existing@example.com" });

      const res = await request(app).post("/subscribe").send({ email: "existing@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/confirm your subscription/i);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test("a genuinely new email gets a confirmation email with a real token in Redis", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);

      const res = await request(app).post("/subscribe").send({ email: "brandnew@example.com" });

      expect(res.status).toBe(200);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toBe("brandnew@example.com");

      const token = extractConfirmToken(mockSendMail.mock.calls[0][0].html);
      const stored = await redis.get(`signup_key:${token}`);
      expect(JSON.parse(stored).email).toBe("brandnew@example.com");
    });
  });

  describe("GET /confirm-subscription", () => {
    test("a bogus token redirects to the expired state, not a crash", async () => {
      const res = await request(app).get("/confirm-subscription?token=bogus");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/?signup=expired");
    });

    test("a valid token creates the subscriber, sends a welcome email, and logs them in", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);
      sharedData.addUser.mockResolvedValue({ created: true, email: "confirmed@example.com" });

      const agent = request.agent(app);
      await agent.post("/subscribe").send({ email: "confirmed@example.com" });
      const token = extractConfirmToken(mockSendMail.mock.calls[0][0].html);

      const res = await agent.get(`/confirm-subscription?token=${token}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/user-dashboard");
      expect(sharedData.addUser).toHaveBeenCalledWith({
        email: "confirmed@example.com",
        cronPattern: undefined,
        timezone: undefined,
      });

      // Welcome email is fired async (not awaited by the handler, so the
      // response doesn't wait on it) -- give the microtask queue a tick.
      await new Promise((r) => setImmediate(r));
      expect(mockSendMail).toHaveBeenCalledTimes(2); // confirmation + welcome
      expect(mockSendMail.mock.calls[1][0].subject).toMatch(/welcome/i);
    });

    test("the signup token cannot be reused a second time", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);
      sharedData.addUser.mockResolvedValue({ created: true, email: "onetime@example.com" });

      const agent = request.agent(app);
      await agent.post("/subscribe").send({ email: "onetime@example.com" });
      const token = extractConfirmToken(mockSendMail.mock.calls[0][0].html);

      const first = await agent.get(`/confirm-subscription?token=${token}`);
      expect(first.headers.location).toBe("/user-dashboard");

      const second = await request(app).get(`/confirm-subscription?token=${token}`);
      expect(second.headers.location).toBe("/?signup=expired");
    });

    test("confirming twice (double-click, created:false) still logs in, doesn't error", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);
      sharedData.addUser.mockResolvedValue({ created: false, email: "double@example.com" });

      const agent = request.agent(app);
      await agent.post("/subscribe").send({ email: "double@example.com" });
      const token = extractConfirmToken(mockSendMail.mock.calls[0][0].html);

      const res = await agent.get(`/confirm-subscription?token=${token}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/user-dashboard");
      // created:false -- no second welcome email
      expect(mockSendMail).toHaveBeenCalledTimes(1);
    });
  });
});

describe("unsubscribe (fixed -- previously never touched the database)", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  test("rejects a request with no token", async () => {
    const res = await request(app).get("/unsubscribe?email=someone@example.com");
    expect(res.status).toBe(200); // renders an HTML page, not a JSON error
    expect(res.text).toMatch(/expired or invalid/i);
    expect(sharedData.setUserActive).not.toHaveBeenCalled();
  });

  test("rejects a forged/incorrect token", async () => {
    const res = await request(app).get(
      "/unsubscribe?email=someone@example.com&token=totally-wrong",
    );
    expect(res.text).toMatch(/expired or invalid/i);
    expect(sharedData.setUserActive).not.toHaveBeenCalled();
  });

  test("a correctly signed token actually pauses the subscriber", async () => {
    sharedData.setUserActive.mockResolvedValue(true);
    const email = "real-subscriber@example.com";
    const token = generateUnsubscribeToken(email);

    const res = await request(app).get(
      `/unsubscribe?email=${encodeURIComponent(email)}&token=${token}`,
    );

    expect(res.status).toBe(200);
    expect(res.text).toMatch(/you're unsubscribed/i);
    expect(sharedData.setUserActive).toHaveBeenCalledWith(email, false);
  });

  test("a token generated for a DIFFERENT email is rejected -- can't unsubscribe someone else", async () => {
    const tokenForSomeoneElse = generateUnsubscribeToken("victim@example.com");

    const res = await request(app).get(
      `/unsubscribe?email=${encodeURIComponent("attacker-guessed-this@example.com")}&token=${tokenForSomeoneElse}`,
    );

    expect(res.text).toMatch(/expired or invalid/i);
    expect(sharedData.setUserActive).not.toHaveBeenCalled();
  });
});
