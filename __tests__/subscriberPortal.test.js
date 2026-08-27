// Must be set before any module that transitively requires
// config/redisClient.js is loaded, since it reads this at require-time
// to decide between a real connection and ioredis-mock.
process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

// Same reasoning as subscribers.controller.test.js: explicit factories so
// requiring these modules never touches a real DB or SMTP connection.
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockReturnValue({
    track: "deep-work",
    name: "Deep Work & Builder",
    badge: "⚡ Deep Work & Builder",
    tagline: "High-focus engineering rituals",
    ritual: "Select your #1 most critical deliverable.",
    quote: "Deep work is the ability to focus. - Cal Newport",
    checklist: ["Hydrate (500ml)", "Silence Notifications"]
  }),
}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "test-id" });
jest.mock("../config/mailTransporter", () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
}));

// sendEmailLimiter is a shared singleton (see middleware/rateLimiters.js)
// whose internal per-IP request counter persists for the lifetime of the
// test process, not per-test or per-file. With ALLOWED_RATE_LIMITER unset
// in the test env, express-rate-limit's default max is 5 -- meaning by
// the 6th call to /login across this whole file, real requests were
// silently getting a 429 before ever reaching requestLogin(), which is
// actually correct production behavior, just not what this suite is
// testing. Mocked as a pass-through so each test's behavior depends only
// on what that test sets up, not how many /login calls ran before it.
jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const emailTracker = require("../email-core/emailTracker");
const redis = require("../config/redisClient");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.locals.apiBase = "http://localhost:2900";
  app.use(subscriberPortalRoutes);
  return app;
}

describe("subscriber portal", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
  });

  describe("POST /login", () => {
    test("returns the same generic message for an unknown email", async () => {
      sharedData.getUserByEmail.mockResolvedValue(null);

      const res = await request(app)
        .post("/login")
        .send({ email: "unknown@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/login link has been sent/i);
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test("returns the identical message for a real subscriber (no enumeration signal)", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "real@example.com",
        isActive: true,
      });

      const unknownRes = await request(app)
        .post("/login")
        .send({ email: "unknown@example.com" });
      sharedData.getUserByEmail.mockResolvedValue(null);
      const knownRes = await request(app)
        .post("/login")
        .send({ email: "unknown@example.com" });

      expect(unknownRes.body.message).toBe(knownRes.body.message);
      expect(unknownRes.status).toBe(knownRes.status);
    });

    test("sends an email and stores a one-time Redis token for a real subscriber", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "real@example.com",
        isActive: true,
      });

      const res = await request(app)
        .post("/login")
        .send({ email: "real@example.com" });

      expect(res.status).toBe(200);
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toBe("real@example.com");

      // Extract the token from the actual email body sent, then confirm
      // it's really sitting in Redis -- proving the token in the email
      // matches what verify-login will actually look up.
      const html = mockSendMail.mock.calls[0][0].html;
      const tokenMatch = html.match(/token=([a-f0-9]+)/);
      expect(tokenMatch).not.toBeNull();
      const storedEmail = await redis.get(`login_key:${tokenMatch[1]}`);
      expect(storedEmail).toBe("real@example.com");
    });

    test("still returns the generic message if the DB lookup throws", async () => {
      sharedData.getUserByEmail.mockRejectedValue(new Error("DB unreachable"));

      const res = await request(app)
        .post("/login")
        .send({ email: "anything@example.com" });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/login link has been sent/i);
    });
  });

  describe("GET /verify-login -> session -> /me flow", () => {
    test("a valid token logs the subscriber in and grants access to /me", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "flow@example.com",
        isActive: true,
      });

      const agent = request.agent(app);

      // Step 1: request login, capture the real token from the sent email
      await agent.post("/login").send({ email: "flow@example.com" });
      const html = mockSendMail.mock.calls[0][0].html;
      const token = html.match(/token=([a-f0-9]+)/)[1];

      // Step 2: click the link
      const verifyRes = await agent.get(`/verify-login?token=${token}`);
      expect(verifyRes.status).toBe(302);
      expect(verifyRes.headers.location).toBe("/user-dashboard");

      // Step 3: the session cookie set in step 2 should now grant access
      sharedData.getUserByEmail.mockResolvedValue({
        email: "flow@example.com",
        templateType: "basic",
        cronPattern: "0 8 * * *",
        timezone: "Asia/Kolkata",
        isActive: true,
      });
      const meRes = await agent.get("/me");
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe("flow@example.com");
    });

    test("the login token cannot be reused a second time", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "onetime@example.com",
        isActive: true,
      });

      const agent = request.agent(app);
      await agent.post("/login").send({ email: "onetime@example.com" });
      const html = mockSendMail.mock.calls[0][0].html;
      const token = html.match(/token=([a-f0-9]+)/)[1];

      const first = await agent.get(`/verify-login?token=${token}`);
      expect(first.headers.location).toBe("/user-dashboard");

      const second = await request(app).get(`/verify-login?token=${token}`);
      expect(second.headers.location).toBe("/?login=expired");
    });

    test("an invalid token redirects to the expired state, not a crash", async () => {
      const res = await request(app).get("/verify-login?token=totally-bogus");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/?login=expired");
    });
  });

  describe("/me without a session", () => {
    test("GET /me returns 401", async () => {
      const res = await request(app).get("/me");
      expect(res.status).toBe(401);
    });

    test("PATCH /me returns 401", async () => {
      const res = await request(app).patch("/me").send({ timezone: "UTC" });
      expect(res.status).toBe(401);
    });

    test("GET /me/history returns 401", async () => {
      const res = await request(app).get("/me/history");
      expect(res.status).toBe(401);
    });
  });

  describe("authenticated /me endpoints", () => {
    async function loggedInAgent(email) {
      sharedData.getUserByEmail.mockResolvedValue({ email, isActive: true });
      const agent = request.agent(app);
      await agent.post("/login").send({ email });
      const html = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0].html;
      const token = html.match(/token=([a-f0-9]+)/)[1];
      await agent.get(`/verify-login?token=${token}`);
      return agent;
    }

    test("PATCH /me rejects an empty body", async () => {
      const agent = await loggedInAgent("empty@example.com");
      const res = await agent.patch("/me").send({});
      expect(res.status).toBe(400);
    });

    test("PATCH /me rejects an invalid cron pattern", async () => {
      const agent = await loggedInAgent("badcron@example.com");
      const res = await agent.patch("/me").send({ cronPattern: "not a cron" });
      expect(res.status).toBe(400);
      expect(res.body.errors).toBeDefined();
    });

    test("PATCH /me updates preferences and returns the updated record", async () => {
      const agent = await loggedInAgent("update@example.com");
      sharedData.updateUser.mockResolvedValue();
      sharedData.getUserByEmail.mockResolvedValue({
        email: "update@example.com",
        cronPattern: "0 9 * * *",
        timezone: "UTC",
        isActive: true,
      });

      const res = await agent.patch("/me").send({ cronPattern: "0 9 * * *", timezone: "UTC" });

      expect(res.status).toBe(200);
      expect(sharedData.updateUser).toHaveBeenCalledWith("update@example.com", {
        cronPattern: "0 9 * * *",
        timezone: "UTC",
      });
      expect(res.body.timezone).toBe("UTC");
    });

    test("PATCH /me can pause via isActive:false", async () => {
      const agent = await loggedInAgent("pause@example.com");
      sharedData.setUserActive.mockResolvedValue();
      sharedData.getUserByEmail.mockResolvedValue({
        email: "pause@example.com",
        isActive: false,
      });

      const res = await agent.patch("/me").send({ isActive: false });

      expect(res.status).toBe(200);
      expect(sharedData.setUserActive).toHaveBeenCalledWith("pause@example.com", false);
      expect(res.body.isActive).toBe(false);
    });

    test("GET /me/history returns the subscriber's own history only", async () => {
      const agent = await loggedInAgent("history@example.com");
      emailTracker.getHistory.mockResolvedValue([
        { sent_at: "2026-01-01", status: "success" },
      ]);

      const res = await agent.get("/me/history?limit=5");

      expect(res.status).toBe(200);
      expect(emailTracker.getHistory).toHaveBeenCalledWith("history@example.com", 5);
      expect(res.body.history).toHaveLength(1);
    });
  });

  describe("POST /logout", () => {
    test("destroys the session -- /me is unreachable afterwards", async () => {
      const agent = await (async () => {
        sharedData.getUserByEmail.mockResolvedValue({
          email: "logout@example.com",
          isActive: true,
        });
        const a = request.agent(app);
        await a.post("/login").send({ email: "logout@example.com" });
        const html = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0].html;
        const token = html.match(/token=([a-f0-9]+)/)[1];
        await a.get(`/verify-login?token=${token}`);
        return a;
      })();

      const beforeLogout = await agent.get("/me");
      expect(beforeLogout.status).toBe(200);

      await agent.post("/logout");

      const afterLogout = await agent.get("/me");
      expect(afterLogout.status).toBe(401);
    });
  });

  describe("GET /checkin", () => {
    const { generateActionToken } = require("../helper/unsubscribeToken");

    test("rejects request without email or token", async () => {
      const res = await request(app).get("/checkin");
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Invalid Check-in Link/i);
    });

    test("records streak on valid token and renders celebration page", async () => {
      const email = "streak@example.com";
      const token = generateActionToken(email, "checkin");
      sharedData.getUserByEmail.mockResolvedValue({
        email,
        streakCount: 3,
        routineTrack: "deep-work",
      });
      sharedData.recordCheckin.mockResolvedValue({
        success: true,
        email,
        streak: 4,
        alreadyCheckedInToday: false,
      });

      const res = await request(app).get(`/checkin?email=${encodeURIComponent(email)}&token=${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Day 4 Complete/i);
      expect(sharedData.recordCheckin).toHaveBeenCalledWith(email, undefined);
    });
  });

  describe("GET /routine", () => {
    const { generateActionToken } = require("../helper/unsubscribeToken");

    test("renders interactive routine page for subscriber with token", async () => {
      const email = "routine@example.com";
      const token = generateActionToken(email, "routine");
      sharedData.getUserByEmail.mockResolvedValue({
        email,
        streakCount: 5,
        routineTrack: "deep-work",
      });

      const res = await request(app).get(`/routine?email=${encodeURIComponent(email)}&token=${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toMatch(/Today's Action Ritual/i);
      expect(res.text).toMatch(/5-Day Streak/i);
    });
  });
});
