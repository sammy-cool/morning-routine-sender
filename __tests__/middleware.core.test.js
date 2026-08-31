/**
 * __tests__/middleware.core.test.js
 *
 * Test Suite for Core Express Middlewares:
 * 1. requireAdmin (Admin cookie guard)
 * 2. setApiBase (Domain & protocol resolver)
 * 3. checkHoneypot (Bot spam detection)
 * 4. rateLimiters (Rate limiting middleware)
 * 5. subscriberSession (Redis sessions, magic action tokens, cookie lifecycle)
 */

"use strict";

process.env.USE_MOCK_REDIS = "true";

const { requireAdmin } = require("../middleware/requireAdmin");
const { setApiBase } = require("../middleware/setApiBase");
const { checkHoneypot } = require("../middleware/honeypot");
const { sendEmailLimiter, authLimiter } = require("../middleware/rateLimiters");
const {
  createSession,
  getSessionEmail,
  destroySession,
  requireSubscriberSession,
  getSubscriberAuthEmail,
  requireSubscriberAuth,
  SESSION_TTL_SECONDS,
} = require("../middleware/subscriberSession");

const redis = require("../config/redisClient");
const { generateActionToken } = require("../helper/unsubscribeToken");

function mockReqRes(options = {}) {
  const req = {
    cookies: options.cookies || {},
    signedCookies: options.signedCookies || {},
    headers: options.headers || {},
    query: options.query || {},
    body: options.body || {},
    ip: options.ip || "127.0.0.1",
    get(headerName) {
      return this.headers[headerName.toLowerCase()];
    },
    ...options.reqExtra,
  };

  const cookiesSet = [];
  const cookiesCleared = [];

  const res = {
    _status: 200,
    _json: null,
    locals: {},
    status(code) {
      this._status = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
    cookie(name, value, opts) {
      cookiesSet.push({ name, value, opts });
      return this;
    },
    clearCookie(name, opts) {
      cookiesCleared.push({ name, opts });
      return this;
    },
  };

  return { req, res, cookiesSet, cookiesCleared };
}

describe("Core Middlewares Test Suite", () => {
  afterEach(async () => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // 1. requireAdmin
  // =========================================================================
  describe("1. requireAdmin Middleware", () => {
    test("rejects request with 403 Forbidden when signed cookie is missing", () => {
      const { req, res } = mockReqRes();
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res._status).toBe(403);
      expect(res._json).toEqual({ error: "Forbidden: admin access required" });
      expect(next).not.toHaveBeenCalled();
    });

    test("rejects request with 403 Forbidden when role is not 'admin'", () => {
      const { req, res } = mockReqRes({ signedCookies: { mrn_role: "user" } });
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(res._status).toBe(403);
      expect(next).not.toHaveBeenCalled();
    });

    test("calls next() when signed cookie has role 'admin'", () => {
      const { req, res } = mockReqRes({ signedCookies: { mrn_role: "admin" } });
      const next = jest.fn();

      requireAdmin(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._status).toBe(200);
    });
  });

  // =========================================================================
  // 2. setApiBase
  // =========================================================================
  describe("2. setApiBase Middleware", () => {
    const originalEnv = process.env;

    beforeEach(() => {
      process.env = { ...originalEnv };
    });

    afterAll(() => {
      process.env = originalEnv;
    });

    test("uses process.env.RENDER_URL when set", () => {
      process.env.RENDER_URL = "https://routine.onrender.com";
      const { req, res } = mockReqRes({ headers: { host: "localhost:3000" } });
      const next = jest.fn();

      setApiBase(req, res, next);

      expect(res.locals.apiBase).toBe("https://routine.onrender.com");
      expect(res.locals.officialDomain).toBe("https://routine.onrender.com");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("uses http://${host} in development when RENDER_URL is absent", () => {
      delete process.env.RENDER_URL;
      process.env.NODE_ENV = "development";
      const { req, res } = mockReqRes({ headers: { host: "127.0.0.1:3000" } });
      const next = jest.fn();

      setApiBase(req, res, next);

      expect(res.locals.apiBase).toBe("http://127.0.0.1:3000");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("uses https://${host} in production when RENDER_URL is absent", () => {
      delete process.env.RENDER_URL;
      process.env.NODE_ENV = "production";
      const { req, res } = mockReqRes({ headers: { host: "custom.domain.com" } });
      const next = jest.fn();

      setApiBase(req, res, next);

      expect(res.locals.apiBase).toBe("https://custom.domain.com");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("falls back to localhost:3000 when host header is missing", () => {
      delete process.env.RENDER_URL;
      const { req, res } = mockReqRes();
      const next = jest.fn();

      setApiBase(req, res, next);

      expect(res.locals.apiBase).toBe("http://localhost:3000");
      expect(next).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // 3. checkHoneypot
  // =========================================================================
  describe("3. checkHoneypot Middleware", () => {
    test("short-circuits and returns generic response when honeypot field is filled", () => {
      const genericResponse = { message: "Check your email for confirmation" };
      const middleware = checkHoneypot("website", genericResponse);

      const { req, res } = mockReqRes({
        body: { email: "bot@spam.com", website: "http://spam.org" },
      });
      const next = jest.fn();

      middleware(req, res, next);

      expect(res._status).toBe(200);
      expect(res._json).toEqual(genericResponse);
      expect(next).not.toHaveBeenCalled();
    });

    test("calls next() when honeypot field is absent or empty string", () => {
      const middleware = checkHoneypot("website", { ok: true });

      const { req, res } = mockReqRes({ body: { email: "human@example.com", website: "" } });
      const next = jest.fn();

      middleware(req, res, next);

      expect(next).toHaveBeenCalledTimes(1);
      expect(res._json).toBeNull();
    });
  });

  // =========================================================================
  // 4. rateLimiters
  // =========================================================================
  describe("4. rateLimiters Middleware", () => {
    test("exports sendEmailLimiter and authLimiter middleware functions", () => {
      expect(typeof sendEmailLimiter).toBe("function");
      expect(typeof authLimiter).toBe("function");
    });
  });

  // =========================================================================
  // 5. subscriberSession
  // =========================================================================
  describe("5. subscriberSession Middleware & Utilities", () => {
    test("createSession stores session in Redis and sets HTTP-only cookie on response", async () => {
      const { res, cookiesSet } = mockReqRes();
      const token = await createSession(res, "session.user@example.com");

      expect(typeof token).toBe("string");
      expect(token.length).toBe(64); // 32 bytes hex

      const storedEmail = await redis.get(`subscriber_session:${token}`);
      expect(storedEmail).toBe("session.user@example.com");

      expect(cookiesSet).toHaveLength(1);
      expect(cookiesSet[0].name).toBe("mrn_session");
      expect(cookiesSet[0].value).toBe(token);
      expect(cookiesSet[0].opts.httpOnly).toBe(true);
      expect(cookiesSet[0].opts.maxAge).toBe(SESSION_TTL_SECONDS * 1000);
    });

    test("getSessionEmail returns email for active session, and null for invalid/expired token", async () => {
      const token = "mock_valid_token_12345";
      await redis.set(`subscriber_session:${token}`, "alice@example.com");

      const { req: validReq } = mockReqRes({ cookies: { mrn_session: token } });
      const email = await getSessionEmail(validReq);
      expect(email).toBe("alice@example.com");

      const { req: invalidReq } = mockReqRes({ cookies: { mrn_session: "non_existent_token" } });
      const nullEmail = await getSessionEmail(invalidReq);
      expect(nullEmail).toBeNull();

      const { req: noCookieReq } = mockReqRes();
      expect(await getSessionEmail(noCookieReq)).toBeNull();
    });

    test("destroySession removes Redis token and clears session cookies", async () => {
      const token = "destroy_token_999";
      await redis.set(`subscriber_session:${token}`, "bob@example.com");

      const { req, res, cookiesCleared } = mockReqRes({ cookies: { mrn_session: token } });
      await destroySession(req, res);

      const remaining = await redis.get(`subscriber_session:${token}`);
      expect(remaining).toBeNull();

      expect(cookiesCleared).toEqual(
        expect.arrayContaining([
          { name: "mrn_session", opts: { path: "/" } },
          { name: "mrn_role", opts: { path: "/" } },
        ]),
      );
    });

    test("requireSubscriberSession rejects unauthenticated requests with 401", async () => {
      const { req, res } = mockReqRes();
      const next = jest.fn();

      await requireSubscriberSession(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json).toEqual({ error: "Not logged in" });
      expect(next).not.toHaveBeenCalled();
    });

    test("requireSubscriberSession attaches subscriberEmail and calls next() when session is valid", async () => {
      const token = "valid_sub_token_777";
      await redis.set(`subscriber_session:${token}`, "subscriber@domain.com");

      const { req, res } = mockReqRes({ cookies: { mrn_session: token } });
      const next = jest.fn();

      await requireSubscriberSession(req, res, next);

      expect(req.subscriberEmail).toBe("subscriber@domain.com");
      expect(next).toHaveBeenCalledTimes(1);
    });

    test("getSubscriberAuthEmail resolves from magic action token when session cookie is absent", async () => {
      const email = "token.auth@example.com";
      const actionToken = generateActionToken(email, "journal");

      // Query token authentication
      const { req: queryReq } = mockReqRes({ query: { email, token: actionToken } });
      const resolvedQueryEmail = await getSubscriberAuthEmail(queryReq);
      expect(resolvedQueryEmail).toBe(email);

      // Bearer Header token authentication
      const { req: headerReq } = mockReqRes({
        headers: {
          "x-subscriber-email": email,
          authorization: `Bearer ${actionToken}`,
        },
      });
      const resolvedHeaderEmail = await getSubscriberAuthEmail(headerReq);
      expect(resolvedHeaderEmail).toBe(email);
    });

    test("requireSubscriberAuth rejects invalid token or session with 401", async () => {
      const { req, res } = mockReqRes({ query: { email: "fake@ex.com", token: "invalid_tok" } });
      const next = jest.fn();

      await requireSubscriberAuth(req, res, next);

      expect(res._status).toBe(401);
      expect(res._json.error).toContain("Authentication required");
      expect(next).not.toHaveBeenCalled();
    });
  });
});
