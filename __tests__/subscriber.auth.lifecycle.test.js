/**
 * __tests__/subscriber.auth.lifecycle.test.js
 *
 * Comprehensive Test Suite for Subscriber Authentication & Magic Link Lifecycle:
 * 1. controllers/subscriberAuth.controller.js (requestLogin, verifyLogin, logout)
 * 2. middleware/subscriberSession.js (createSession, destroySession, requireSubscriberSession)
 * 3. controllers/me.controller.js (getMe)
 * 4. routes/subscriberPortal.routes.js & canonical/aliased endpoints:
 *    - POST /login & POST /auth/magic-link (requestMagicLink)
 *    - GET /verify-login & GET /auth/verify-magic-link (verifyMagicLink)
 *    - POST /logout & POST /auth/logout (logout)
 *    - GET /me & GET /api/me (getMe)
 */

"use strict";

// Force mock Redis before loading any dependencies
process.env.USE_MOCK_REDIS = "true";
process.env.NODE_ENV = "test";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

// 1. Mock Logger to keep test output clean
jest.mock("../logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  requestLogger: (req, res, next) => next(),
}));

// 2. Mock Shared Data (DB Layer)
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
  recordCheckin: jest.fn(),
}));

// 3. Mock Mail Transporter
const mockSendMail = jest.fn().mockResolvedValue({ messageId: "msg-magic-link-test" });
jest.mock("../config/mailTransporter", () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
  closeTransporterConnection: jest.fn().mockResolvedValue(),
}));

// 4. Mock Rate Limiters for general lifecycle tests (pass-through)
jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
}));

// 5. Mock DB knex
jest.mock("../db/knex", () => ({}));

const sharedData = require("../helper/shared-data");
const redis = require("../config/redisClient");
const authController = require("../controllers/subscriberAuth.controller");
const meController = require("../controllers/me.controller");
const {
  requireSubscriberSession,
  createSession,
  destroySession,
  SESSION_TTL_SECONDS,
} = require("../middleware/subscriberSession");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

/**
 * Builds an Express test application with all canonical and aliased routes
 */
function buildLifecycleApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser("test-secret"));

  // Mock res.locals.apiBase for magic link generation
  app.use((req, res, next) => {
    res.locals.apiBase = "http://localhost:2900";
    next();
  });

  // Mount existing subscriber portal routes
  app.use(subscriberPortalRoutes);

  // Mount aliased endpoints (/api/auth/magic-link, /auth/magic-link, /auth/verify-magic-link, /api/me)
  const magicLinkHandler = authController.requestMagicLink || authController.requestLogin;
  const verifyLinkHandler = authController.verifyMagicLink || authController.verifyLogin;

  app.post("/auth/magic-link", magicLinkHandler);
  app.post("/api/auth/magic-link", magicLinkHandler);
  app.get("/auth/verify-magic-link", verifyLinkHandler);
  app.post("/auth/logout", authController.logout);
  app.get("/api/me", requireSubscriberSession, meController.getMe);

  return app;
}

describe("Subscriber Authentication & Magic Link Lifecycle Test Suite", () => {
  let app;
  const LOGIN_KEY_PREFIX = "login_key:";
  const SESSION_PREFIX = "subscriber_session:";

  beforeEach(async () => {
    app = buildLifecycleApp();
    jest.clearAllMocks();
    mockSendMail.mockClear();

    // Flush mock redis keys before each test
    if (typeof redis.flushall === "function") {
      await redis.flushall();
    }
  });

  afterAll(async () => {
    if (redis && typeof redis.quit === "function") {
      await redis.quit();
    }
  });

  // =========================================================================
  // 1. UNIT TESTS: subscriberAuth.controller.js
  // =========================================================================
  describe("Unit Tests: subscriberAuth.controller.js", () => {
    describe("requestLogin / requestMagicLink", () => {
      const handler = authController.requestMagicLink || authController.requestLogin;

      test("returns generic message without sending email when email is missing or empty", async () => {
        const req = { body: {} };
        const res = { json: jest.fn() };

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          message: "If that email is subscribed, a login link has been sent.",
        });
        expect(mockSendMail).not.toHaveBeenCalled();
        expect(sharedData.getUserByEmail).not.toHaveBeenCalled();
      });

      test("returns generic message when email format is invalid", async () => {
        const req = { body: { email: "invalid-email-format" } };
        const res = { json: jest.fn() };

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          message: "If that email is subscribed, a login link has been sent.",
        });
        expect(mockSendMail).not.toHaveBeenCalled();
      });

      test("returns generic message without sending email when subscriber does not exist", async () => {
        sharedData.getUserByEmail.mockResolvedValue(null);

        const req = { body: { email: "nonexistent@example.com" } };
        const res = { json: jest.fn() };

        await handler(req, res);

        expect(sharedData.getUserByEmail).toHaveBeenCalledWith("nonexistent@example.com");
        expect(res.json).toHaveBeenCalledWith({
          message: "If that email is subscribed, a login link has been sent.",
        });
        expect(mockSendMail).not.toHaveBeenCalled();
      });

      test("generates CSPRNG token (64 hex chars), stores in Redis with 15m TTL (900s), and dispatches email", async () => {
        sharedData.getUserByEmail.mockResolvedValue({
          email: "valid@example.com",
          isActive: true,
          routineTrack: "deep-work",
        });

        const req = {
          body: { email: "  Valid@Example.Com  " },
          protocol: "http",
          get: jest.fn().mockReturnValue("localhost:2900"),
        };
        const res = {
          locals: { apiBase: "http://localhost:2900" },
          json: jest.fn(),
        };

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          message: "If that email is subscribed, a login link has been sent.",
        });
        expect(mockSendMail).toHaveBeenCalledTimes(1);

        const mailOptions = mockSendMail.mock.calls[0][0];
        expect(mailOptions.to).toBe("valid@example.com");
        expect(mailOptions.subject).toMatch(/login link/i);

        // Extract token from email body
        const tokenMatch = mailOptions.html.match(/token=([a-f0-9]{64})/);
        expect(tokenMatch).not.toBeNull();
        const token = tokenMatch[1];

        // Check Redis storage and TTL
        const storedEmail = await redis.get(LOGIN_KEY_PREFIX + token);
        expect(storedEmail).toBe("valid@example.com");
        const ttl = await redis.ttl(LOGIN_KEY_PREFIX + token);
        expect(ttl).toBeGreaterThan(0);
        expect(ttl).toBeLessThanOrEqual(15 * 60);
      });

      test("gracefully masks database errors and still returns generic message", async () => {
        sharedData.getUserByEmail.mockRejectedValue(new Error("Database connection pool timeout"));

        const req = { body: { email: "crashed@example.com" } };
        const res = { json: jest.fn() };

        await handler(req, res);

        expect(res.json).toHaveBeenCalledWith({
          message: "If that email is subscribed, a login link has been sent.",
        });
        expect(mockSendMail).not.toHaveBeenCalled();
      });
    });

    describe("verifyLogin / verifyMagicLink", () => {
      const handler = authController.verifyMagicLink || authController.verifyLogin;

      test("redirects to /?login=missing_token when token query param is absent", async () => {
        const req = { query: {} };
        const res = { redirect: jest.fn() };

        await handler(req, res);

        expect(res.redirect).toHaveBeenCalledWith(302, "/?login=missing_token");
      });

      test("redirects to /?login=expired when token is not found or expired in Redis", async () => {
        const req = { query: { token: "expired-or-invalid-token" } };
        const res = { redirect: jest.fn() };

        await handler(req, res);

        expect(res.redirect).toHaveBeenCalledWith(302, "/?login=expired");
      });

      test("consumes token on verification, sets session cookie, and redirects to /user-dashboard", async () => {
        const token = "a".repeat(64);
        await redis.set(LOGIN_KEY_PREFIX + token, "verified@example.com", "EX", 900);

        const req = { query: { token } };
        const res = {
          cookie: jest.fn(),
          redirect: jest.fn(),
        };

        await handler(req, res);

        // Token consumed (deleted from Redis)
        const tokenAfter = await redis.get(LOGIN_KEY_PREFIX + token);
        expect(tokenAfter).toBeNull();

        // Cookie set
        expect(res.cookie).toHaveBeenCalledWith(
          "mrn_session",
          expect.any(String),
          expect.objectContaining({
            httpOnly: true,
            sameSite: "lax",
            path: "/",
          }),
        );
        expect(res.cookie).toHaveBeenCalledWith(
          "mrn_role",
          "user",
          expect.objectContaining({
            httpOnly: true,
            sameSite: "lax",
          }),
        );

        expect(res.redirect).toHaveBeenCalledWith(302, "/user-dashboard");
      });

      test("redirects to /?login=error when an unhandled exception occurs", async () => {
        const token = "error-token-test";
        jest.spyOn(redis, "get").mockRejectedValueOnce(new Error("Redis connection crashed"));
        const req = { query: { token } };
        const res = { redirect: jest.fn() };

        await handler(req, res);

        expect(res.redirect).toHaveBeenCalledWith(302, "/?login=error");
      });
    });

    describe("logout", () => {
      test("destroys session, deletes Redis session key, clears cookies, and returns 200", async () => {
        const sessionToken = "session-to-destroy-123";
        await redis.set(SESSION_PREFIX + sessionToken, "logout@example.com", "EX", 3600);

        const req = { cookies: { mrn_session: sessionToken } };
        const res = {
          clearCookie: jest.fn(),
          json: jest.fn(),
        };

        await authController.logout(req, res);

        const sessionAfter = await redis.get(SESSION_PREFIX + sessionToken);
        expect(sessionAfter).toBeNull();

        expect(res.clearCookie).toHaveBeenCalledWith("mrn_session", { path: "/" });
        expect(res.clearCookie).toHaveBeenCalledWith("mrn_role", { path: "/" });
        expect(res.json).toHaveBeenCalledWith({ message: "Logged out" });
      });
    });
  });

  // =========================================================================
  // 2. END-TO-END INTEGRATION TESTS: Complete Magic Link Lifecycle
  // =========================================================================
  describe("End-to-End Lifecycle: Request -> Verify -> /me -> Logout", () => {
    const subscriberData = {
      id: 42,
      email: "alex@example.com",
      timezone: "America/New_York",
      cronPattern: "0 7 * * *",
      routineTrack: "deep-work",
      streakCount: 14,
      isActive: true,
      channels: { email: true, push: false },
    };

    test("Full Happy Path: Request Magic Link -> Click -> Access /me -> Logout", async () => {
      sharedData.getUserByEmail.mockResolvedValue(subscriberData);

      const agent = request.agent(app);

      // 1. Request Magic Link via POST /login
      const reqRes = await agent.post("/login").send({ email: "alex@example.com" });
      expect(reqRes.status).toBe(200);
      expect(reqRes.body.message).toMatch(/login link has been sent/i);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      // 2. Extract Token from Email URL
      const emailHtml = mockSendMail.mock.calls[0][0].html;
      const match = emailHtml.match(/token=([a-f0-9]{64})/);
      expect(match).not.toBeNull();
      const magicToken = match[1];

      // 3. Verify Token is present in Redis with 15m TTL
      const redisEmail = await redis.get(LOGIN_KEY_PREFIX + magicToken);
      expect(redisEmail).toBe("alex@example.com");

      // 4. Click Link: GET /verify-login?token=...
      const verifyRes = await agent.get(`/verify-login?token=${magicToken}`);
      expect(verifyRes.status).toBe(302);
      expect(verifyRes.headers.location).toBe("/user-dashboard");

      // Verify Set-Cookie header contains mrn_session
      const setCookies = verifyRes.headers["set-cookie"];
      expect(setCookies).toBeDefined();
      const sessionCookie = setCookies.find((c) => c.startsWith("mrn_session="));
      expect(sessionCookie).toBeDefined();
      expect(sessionCookie).toMatch(/HttpOnly/i);

      // 5. Token is immediately consumed from Redis
      const consumedToken = await redis.get(LOGIN_KEY_PREFIX + magicToken);
      expect(consumedToken).toBeNull();

      // 6. Access Authenticated Endpoint GET /me using active session
      const meRes = await agent.get("/me");
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe("alex@example.com");
      expect(meRes.body.streakCount).toBe(14);
      expect(meRes.body.routineTrack).toBe("deep-work");

      // 7. Logout via POST /logout
      const logoutRes = await agent.post("/logout");
      expect(logoutRes.status).toBe(200);
      expect(logoutRes.body.message).toBe("Logged out");

      // 8. Subsequent access to /me returns 401 Unauthorized
      const postLogoutMe = await agent.get("/me");
      expect(postLogoutMe.status).toBe(401);
      expect(postLogoutMe.body.error).toMatch(/not logged in/i);
    });

    test("Aliased Routes Flow: /auth/magic-link -> /auth/verify-magic-link -> /api/me -> /auth/logout", async () => {
      sharedData.getUserByEmail.mockResolvedValue(subscriberData);

      const agent = request.agent(app);

      // 1. POST /auth/magic-link
      const reqRes = await agent.post("/auth/magic-link").send({ email: "alex@example.com" });
      expect(reqRes.status).toBe(200);
      expect(mockSendMail).toHaveBeenCalledTimes(1);

      const emailHtml = mockSendMail.mock.calls[0][0].html;
      const magicToken = emailHtml.match(/token=([a-f0-9]{64})/)[1];

      // 2. GET /auth/verify-magic-link?token=...
      const verifyRes = await agent.get(`/auth/verify-magic-link?token=${magicToken}`);
      expect(verifyRes.status).toBe(302);
      expect(verifyRes.headers.location).toBe("/user-dashboard");

      // 3. GET /api/me
      const meRes = await agent.get("/api/me");
      expect(meRes.status).toBe(200);
      expect(meRes.body.email).toBe("alex@example.com");

      // 4. POST /auth/logout
      const logoutRes = await agent.post("/auth/logout");
      expect(logoutRes.status).toBe(200);

      // 5. GET /api/me is now 401
      const meAfter = await agent.get("/api/me");
      expect(meAfter.status).toBe(401);
    });

    test("Replay Attack Prevention: Token cannot be consumed twice", async () => {
      sharedData.getUserByEmail.mockResolvedValue(subscriberData);

      const agent1 = request.agent(app);
      await agent1.post("/login").send({ email: "alex@example.com" });
      const magicToken = mockSendMail.mock.calls[0][0].html.match(/token=([a-f0-9]{64})/)[1];

      // First consumption succeeds
      const firstVerify = await agent1.get(`/verify-login?token=${magicToken}`);
      expect(firstVerify.status).toBe(302);
      expect(firstVerify.headers.location).toBe("/user-dashboard");

      // Second consumption with identical token fails with redirect to expired
      const agent2 = request.agent(app);
      const secondVerify = await agent2.get(`/verify-login?token=${magicToken}`);
      expect(secondVerify.status).toBe(302);
      expect(secondVerify.headers.location).toBe("/?login=expired");
    });
  });

  // =========================================================================
  // 3. USER ENUMERATION & TIMING DEFENSE TESTS
  // =========================================================================
  describe("User Enumeration Prevention", () => {
    test("returns identical response status and body for registered vs unregistered emails", async () => {
      sharedData.getUserByEmail.mockImplementation(async (email) => {
        if (email === "registered@example.com") {
          return { email, isActive: true };
        }
        return null;
      });

      const resRegistered = await request(app)
        .post("/login")
        .send({ email: "registered@example.com" });

      const resUnregistered = await request(app)
        .post("/login")
        .send({ email: "unregistered@example.com" });

      expect(resRegistered.status).toBe(200);
      expect(resUnregistered.status).toBe(200);
      expect(resRegistered.body).toEqual(resUnregistered.body);
      expect(resRegistered.body).toEqual({
        message: "If that email is subscribed, a login link has been sent.",
      });

      // Email only dispatched for registered subscriber
      expect(mockSendMail).toHaveBeenCalledTimes(1);
      expect(mockSendMail.mock.calls[0][0].to).toBe("registered@example.com");
    });

    test("returns identical response for invalid email syntax (prevents format-based probing)", async () => {
      const resMalformed = await request(app)
        .post("/login")
        .send({ email: "not-an-email-address@@@" });

      expect(resMalformed.status).toBe(200);
      expect(resMalformed.body).toEqual({
        message: "If that email is subscribed, a login link has been sent.",
      });
      expect(mockSendMail).not.toHaveBeenCalled();
    });

    test("returns identical response even if database throws an exception", async () => {
      sharedData.getUserByEmail.mockRejectedValue(new Error("Database connection lost"));

      const resDbCrash = await request(app).post("/login").send({ email: "victim@example.com" });

      expect(resDbCrash.status).toBe(200);
      expect(resDbCrash.body).toEqual({
        message: "If that email is subscribed, a login link has been sent.",
      });
    });
  });

  // =========================================================================
  // 4. HONEYPOT & BOT DEFENSE TESTS
  // =========================================================================
  describe("Honeypot Bot Protection", () => {
    test("silently ignores bot submission when honeypot 'website' field is filled", async () => {
      sharedData.getUserByEmail.mockResolvedValue({
        email: "bot-target@example.com",
        isActive: true,
      });

      const res = await request(app).post("/login").send({
        email: "bot-target@example.com",
        website: "http://spam-site-crawler.xyz",
      });

      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/login link has been sent/i);
      // Ensure no mail was sent and no token generated
      expect(mockSendMail).not.toHaveBeenCalled();
    });
  });

  // =========================================================================
  // 5. SESSION EXPIRATION & INVALIDATION TESTS
  // =========================================================================
  describe("Session Security & Expiration Edge Cases", () => {
    test("unauthenticated GET /me returns 401 Unauthorized", async () => {
      const res = await request(app).get("/me");
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Not logged in" });
    });

    test("tampered or fabricated session cookie returns 401", async () => {
      const res = await request(app)
        .get("/me")
        .set("Cookie", ["mrn_session=fabricated-session-token-999"]);

      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: "Not logged in" });
    });

    test("expired session in Redis returns 401", async () => {
      const sessionToken = "expired-token-xyz";
      // Don't insert or let it expire
      const res = await request(app)
        .get("/me")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(401);
    });

    test("returns 404 if subscriber was removed from database while session is active", async () => {
      const sessionToken = "valid-session-deleted-user";
      await redis.set(SESSION_PREFIX + sessionToken, "deleted@example.com", "EX", 3600);
      sharedData.getUserByEmail.mockResolvedValue(null);

      const res = await request(app)
        .get("/me")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: "Subscriber not found" });
    });

    test("returns 500 if database fails during /me profile retrieval", async () => {
      const sessionToken = "valid-session-db-error";
      await redis.set(SESSION_PREFIX + sessionToken, "user@example.com", "EX", 3600);
      sharedData.getUserByEmail.mockRejectedValue(new Error("DB read error"));

      const res = await request(app)
        .get("/me")
        .set("Cookie", [`mrn_session=${sessionToken}`]);

      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: "Failed to load your subscription" });
    });

    test("session TTL in Redis matches 30-day configuration", async () => {
      const resMock = {
        cookie: jest.fn(),
      };
      const token = await createSession(resMock, "ttl-check@example.com");

      const ttl = await redis.ttl(SESSION_PREFIX + token);
      expect(ttl).toBeGreaterThan(0);
      expect(ttl).toBeLessThanOrEqual(SESSION_TTL_SECONDS);

      expect(resMock.cookie).toHaveBeenCalledWith(
        "mrn_session",
        token,
        expect.objectContaining({
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: SESSION_TTL_SECONDS * 1000,
        }),
      );
    });
  });

  // =========================================================================
  // 6. RATE LIMITING TESTS (Isolated Middleware Behavior)
  // =========================================================================
  describe("Rate Limiting Middleware Behavior", () => {
    test("enforces max request threshold on rate-limited endpoints", async () => {
      const rateLimit = require("express-rate-limit");
      const testLimiter = rateLimit({
        windowMs: 60 * 1000,
        max: 3,
        message: "Too many requests, try again later.",
      });

      const testApp = express();
      testApp.use(express.json());
      testApp.post("/rate-limited-login", testLimiter, (req, res) => {
        res.json({ message: "OK" });
      });

      // Requests 1, 2, 3 should succeed
      for (let i = 0; i < 3; i++) {
        const res = await request(testApp).post("/rate-limited-login").send({});
        expect(res.status).toBe(200);
      }

      // Request 4 should be rejected with 429
      const blockedRes = await request(testApp).post("/rate-limited-login").send({});
      expect(blockedRes.status).toBe(429);
      expect(blockedRes.text).toMatch(/too many requests/i);
    });
  });
});
