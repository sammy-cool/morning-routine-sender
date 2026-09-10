/**
 * __tests__/auth.controller.complete.test.js
 *
 * Comprehensive Unit and Integration Test Suite for:
 * controllers/auth.controller.js & routes/auth.routes.js
 *
 * Covers:
 * 1. generateAdminKey(req, res):
 *    - 403 rejection on missing/invalid x-admin-secret or query.adminSecret
 *    - Rejection when ADMIN_KEY env is missing/unset
 *    - Cache-Control: no-store header assertion
 *    - 32-byte hex one-time key generation (64 hex characters)
 *    - Key storage in Redis (admin_key:<key>, "valid", "EX", 300)
 *    - 503 response on Redis failures
 *
 * 2. verifyAdminKey(req, res):
 *    - 400 on missing or whitespace-only body.key
 *    - Master ADMIN_KEY via safeCompare -> signed cookie mrn_role=admin (24h) & { role: "admin" }
 *    - Master ADMIN_KEY does NOT query or delete from Redis
 *    - Valid one-time key from Redis -> single-use consumption (redis.del) & { role: "admin" }
 *    - Invalid or expired key -> returns 200 { role: "user" } without cookie
 *    - Redis lookup exception handling -> gracefully falls back to { role: "user" }
 *    - Cookie secure flag behavior in production vs non-production
 *    - 500 server error catch branch
 *
 * 3. secretJobsScheduler(req, res):
 *    - IP restriction in development (rejects non-localhost IPs with 403, allows 127.0.0.1/::1)
 *    - IP restriction bypassed in non-development (test/production)
 *    - 400 on missing key parameter (header & query)
 *    - 503 on Redis failure during key lookup
 *    - 403 on invalid or expired key
 *    - Key consumption on valid key prior to job action
 *    - Action 'start' -> calls emailScheduler.scheduleAllJobs() & returns 200
 *    - Action 'stop' -> calls emailScheduler.stopAllJobs() & returns 200
 *    - Invalid or missing action -> returns 400 (key still consumed)
 *    - Scheduler execution errors -> returns 500
 *    - Key accepted from x-api-key header and query parameter
 *
 * 4. Integration Test Suite:
 *    - Express + CookieParser + AuthRoutes mounted via Supertest
 *    - Full end-to-end flows: generate -> verify -> replay check
 */

"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

// 1. Mock logger to prevent polluting test logs
jest.mock("../logger", () => ({
  info: jest.fn(),
  error: jest.fn(),
  warn: jest.fn(),
  debug: jest.fn(),
  requestLogger: (req, res, next) => next(),
}));

// 2. Mock redisClient with explicit mock functions
jest.mock("../config/redisClient", () => ({
  set: jest.fn(),
  get: jest.fn(),
  del: jest.fn(),
  quit: jest.fn().mockResolvedValue("OK"),
}));

// 3. Mock emailScheduler to prevent triggering real cron or database connections
jest.mock("../email-core/emailScheduler", () => ({
  scheduleAllJobs: jest.fn(),
  stopAllJobs: jest.fn(),
}));

// 4. Mock Knex/shared-data just in case transitive requires resolve them
jest.mock("../db/knex", () => ({}));
jest.mock("../helper/shared-data", () => ({
  getUsers: jest.fn().mockResolvedValue([]),
  getUserByEmail: jest.fn().mockResolvedValue(null),
}));

// 5. Mock rate limiters so tests are not throttled
jest.mock("../middleware/rateLimiters", () => ({
  authLimiter: (req, res, next) => next(),
}));

const redis = require("../config/redisClient");
const emailScheduler = require("../email-core/emailScheduler");
const authController = require("../controllers/auth.controller");
const authRoutes = require("../routes/auth.routes");

// Helper to create mock Express req and res objects for direct unit testing
function createMockReqRes(options = {}) {
  const headers = {};
  if (options.headers) {
    for (const [key, value] of Object.entries(options.headers)) {
      headers[key.toLowerCase()] = value;
    }
  }

  const req = {
    headers,
    query: options.query || {},
    body: options.body || {},
    ip: "ip" in options ? options.ip : "127.0.0.1",
    socket: options.socket || { remoteAddress: "127.0.0.1" },
    get(headerName) {
      return this.headers[headerName.toLowerCase()];
    },
    ...options.reqExtra,
  };

  const headersSet = {};
  const cookiesSet = [];

  const res = {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(data) {
      this.body = data;
      return this;
    },
    set(header, value) {
      headersSet[header] = value;
      return this;
    },
    setHeader(header, value) {
      headersSet[header] = value;
      return this;
    },
    cookie(name, value, opts) {
      cookiesSet.push({ name, value, opts });
      return this;
    },
    ...options.resExtra,
  };

  return { req, res, headersSet, cookiesSet };
}

describe("controllers/auth.controller.js - Complete Test Suite", () => {
  const ORIGINAL_ENV = process.env;
  const TEST_ADMIN_KEY = "master-super-secret-key-1234567890";

  beforeEach(() => {
    jest.clearAllMocks();
    emailScheduler.scheduleAllJobs.mockReset().mockResolvedValue();
    emailScheduler.stopAllJobs.mockReset().mockReturnValue();
    process.env = {
      ...ORIGINAL_ENV,
      NODE_ENV: "test",
      ADMIN_KEY: TEST_ADMIN_KEY,
    };
  });

  afterAll(() => {
    process.env = ORIGINAL_ENV;
  });

  // =========================================================================
  // 1. generateAdminKey(req, res) - Unit Tests
  // =========================================================================
  describe("1. generateAdminKey(req, res)", () => {
    test("rejects with 403 when ADMIN_KEY env variable is not set", async () => {
      delete process.env.ADMIN_KEY;
      const { req, res } = createMockReqRes({
        headers: { "x-admin-secret": TEST_ADMIN_KEY },
      });

      await authController.generateAdminKey(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: "Forbidden: Invalid admin secret" });
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("rejects with 403 when secret is missing from both header and query", async () => {
      const { req, res } = createMockReqRes();

      await authController.generateAdminKey(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: "Forbidden: Invalid admin secret" });
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("rejects with 403 when provided secret does not match ADMIN_KEY", async () => {
      const { req, res } = createMockReqRes({
        headers: { "x-admin-secret": "wrong-secret-token" },
      });

      await authController.generateAdminKey(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: "Forbidden: Invalid admin secret" });
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("rejects with 403 when secret in query is invalid", async () => {
      const { req, res } = createMockReqRes({
        query: { adminSecret: "incorrect-query-secret" },
      });

      await authController.generateAdminKey(req, res);

      expect(res.statusCode).toBe(403);
      expect(res.body).toEqual({ message: "Forbidden: Invalid admin secret" });
      expect(redis.set).not.toHaveBeenCalled();
    });

    test("sets Cache-Control: no-store header on every invocation", async () => {
      const { req, res, headersSet } = createMockReqRes({
        headers: { "x-admin-secret": "wrong-secret" },
      });

      await authController.generateAdminKey(req, res);

      expect(headersSet["Cache-Control"]).toBe("no-store");
    });

    test("generates 32-byte hex key, stores in Redis with 300s TTL, and returns 200 via x-admin-secret header", async () => {
      redis.set.mockResolvedValue("OK");
      const { req, res, headersSet } = createMockReqRes({
        headers: { "x-admin-secret": TEST_ADMIN_KEY },
      });

      await authController.generateAdminKey(req, res);

      expect(headersSet["Cache-Control"]).toBe("no-store");
      expect(res.statusCode).toBe(200);
      expect(res.body.message).toBe("✅ One-time key generated (valid for 5 minutes)");
      expect(typeof res.body.key).toBe("string");
      // 32 bytes represented in hex is exactly 64 hexadecimal characters
      expect(res.body.key).toMatch(/^[0-9a-f]{64}$/);
      expect(new Date(res.body.timestamp).toISOString()).toBe(res.body.timestamp);

      // Verify Redis persistence
      expect(redis.set).toHaveBeenCalledTimes(1);
      const [redisKey, redisVal, exFlag, ttl] = redis.set.mock.calls[0];
      expect(redisKey).toBe(`admin_key:${res.body.key}`);
      expect(redisVal).toBe("valid");
      expect(exFlag).toBe("EX");
      expect(ttl).toBe(300);
    });

    test("accepts valid secret from req.query.adminSecret fallback", async () => {
      redis.set.mockResolvedValue("OK");
      const { req, res } = createMockReqRes({
        query: { adminSecret: TEST_ADMIN_KEY },
      });

      await authController.generateAdminKey(req, res);

      expect(res.statusCode).toBe(200);
      expect(res.body.key).toMatch(/^[0-9a-f]{64}$/);
      expect(redis.set).toHaveBeenCalledTimes(1);
      expect(redis.set).toHaveBeenCalledWith(`admin_key:${res.body.key}`, "valid", "EX", 300);
    });

    test("returns 503 when Redis fails during key persistence", async () => {
      redis.set.mockRejectedValue(new Error("Redis connection ECONNREFUSED"));
      const { req, res } = createMockReqRes({
        headers: { "x-admin-secret": TEST_ADMIN_KEY },
      });

      await authController.generateAdminKey(req, res);

      expect(res.statusCode).toBe(503);
      expect(res.body).toEqual({
        message: "Service temporarily unavailable, try again shortly.",
      });
    });
  });

  // =========================================================================
  // 2. verifyAdminKey(req, res) - Unit Tests
  // =========================================================================
  describe("2. verifyAdminKey(req, res)", () => {
    test("returns 400 when body is missing", async () => {
      const { req, res } = createMockReqRes({ body: null });

      await authController.verifyAdminKey(req, res);

      expect(res.statusCode).toBe(400);
      expect(res.body).toEqual({ error: "Missing key" });
    });

    test("returns 400 when key is missing or empty in body", async () => {
      const testCases = [{}, { key: "" }, { key: "    " }, { key: null }, { key: undefined }];

      for (const body of testCases) {
        const { req, res } = createMockReqRes({ body });
        await authController.verifyAdminKey(req, res);
        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ error: "Missing key" });
      }
    });

    test("authenticates master ADMIN_KEY, sets 24h signed cookie, and bypasses Redis", async () => {
      const { req, res, cookiesSet } = createMockReqRes({
        body: { key: `  ${TEST_ADMIN_KEY}  ` }, // Test trim behavior
      });

      await authController.verifyAdminKey(req, res);

      // Fast-path: Redis should not be touched
      expect(redis.get).not.toHaveBeenCalled();
      expect(redis.del).not.toHaveBeenCalled();

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ role: "admin" });

      expect(cookiesSet.length).toBe(1);
      const cookie = cookiesSet[0];
      expect(cookie.name).toBe("mrn_role");
      expect(cookie.value).toBe("admin");
      expect(cookie.opts).toEqual({
        httpOnly: true,
        secure: false, // in test env
        sameSite: "lax",
        path: "/",
        maxAge: 24 * 60 * 60 * 1000,
        signed: true,
      });
    });

    test("enforces secure cookie flag in production environment for master key", async () => {
      process.env.NODE_ENV = "production";
      const { req, res, cookiesSet } = createMockReqRes({
        body: { key: TEST_ADMIN_KEY },
      });

      await authController.verifyAdminKey(req, res);

      expect(cookiesSet.length).toBe(1);
      expect(cookiesSet[0].opts.secure).toBe(true);
    });

    test("authenticates valid one-time key from Redis, consumes key, and sets signed cookie", async () => {
      const oneTimeKey = "a".repeat(64);
      redis.get.mockResolvedValue("valid");
      redis.del.mockResolvedValue(1);

      const { req, res, cookiesSet } = createMockReqRes({
        body: { key: oneTimeKey },
      });

      await authController.verifyAdminKey(req, res);

      expect(redis.get).toHaveBeenCalledWith(`admin_key:${oneTimeKey}`);
      expect(redis.del).toHaveBeenCalledWith(`admin_key:${oneTimeKey}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ role: "admin" });

      expect(cookiesSet.length).toBe(1);
      expect(cookiesSet[0]).toEqual({
        name: "mrn_role",
        value: "admin",
        opts: {
          httpOnly: true,
          secure: false,
          sameSite: "lax",
          path: "/",
          maxAge: 86400000,
          signed: true,
        },
      });
    });

    test("returns 200 { role: 'user' } without cookie when key is neither master nor in Redis", async () => {
      const invalidKey = "invalid-or-expired-key";
      redis.get.mockResolvedValue(null); // Key expired or not found

      const { req, res, cookiesSet } = createMockReqRes({
        body: { key: invalidKey },
      });

      await authController.verifyAdminKey(req, res);

      expect(redis.get).toHaveBeenCalledWith(`admin_key:${invalidKey}`);
      expect(redis.del).not.toHaveBeenCalled();
      expect(cookiesSet.length).toBe(0);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ role: "user" });
    });

    test("gracefully returns { role: 'user' } when Redis lookup throws an error", async () => {
      const someKey = "some-lookup-key";
      redis.get.mockRejectedValue(new Error("Redis read timeout"));

      const { req, res, cookiesSet } = createMockReqRes({
        body: { key: someKey },
      });

      await authController.verifyAdminKey(req, res);

      expect(cookiesSet.length).toBe(0);
      expect(res.statusCode).toBe(200);
      expect(res.body).toEqual({ role: "user" });
    });

    test("returns 500 when an unexpected exception is thrown in the handler", async () => {
      const { req, res } = createMockReqRes({
        body: { key: TEST_ADMIN_KEY },
      });
      // Force res.cookie to throw an unexpected error
      res.cookie = () => {
        throw new Error("Cookie serialization failed unexpectedly");
      };

      await authController.verifyAdminKey(req, res);

      expect(res.statusCode).toBe(500);
      expect(res.body).toEqual({ error: "Server error verifying key" });
    });
  });

  // =========================================================================
  // 3. secretJobsScheduler(req, res) - Unit Tests
  // =========================================================================
  describe("3. secretJobsScheduler(req, res)", () => {
    describe("IP Restriction Check", () => {
      test("rejects unauthorized client IP with 403 when NODE_ENV === 'development'", async () => {
        process.env.NODE_ENV = "development";
        const { req, res } = createMockReqRes({
          ip: "192.168.1.100",
          query: { key: "some-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ message: "❌ Forbidden: Unauthorized IP" });
        expect(redis.get).not.toHaveBeenCalled();
      });

      test("allows 127.0.0.1 in development", async () => {
        process.env.NODE_ENV = "development";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.scheduleAllJobs.mockResolvedValue();

        const { req, res } = createMockReqRes({
          ip: "127.0.0.1",
          query: { key: "some-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ message: "✅ All cron jobs scheduled and running." });
      });

      test("allows ::1 in development", async () => {
        process.env.NODE_ENV = "development";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.scheduleAllJobs.mockResolvedValue();

        const { req, res } = createMockReqRes({
          ip: "::1",
          query: { key: "some-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(200);
      });

      test("falls back to req.socket.remoteAddress when req.ip is undefined", async () => {
        process.env.NODE_ENV = "development";
        const { req, res } = createMockReqRes({
          ip: undefined,
          socket: { remoteAddress: "10.0.0.5" },
          query: { key: "some-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ message: "❌ Forbidden: Unauthorized IP" });
      });

      test("does NOT enforce IP restriction when NODE_ENV is 'test' or 'production'", async () => {
        process.env.NODE_ENV = "production";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.scheduleAllJobs.mockResolvedValue();

        const { req, res } = createMockReqRes({
          ip: "203.0.113.195", // Public non-localhost IP
          query: { key: "prod-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(200);
      });
    });

    describe("Key Validation & Redis Lookup", () => {
      test("returns 400 when ?key is missing from both headers and query", async () => {
        const { req, res } = createMockReqRes({
          query: { action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(400);
        expect(res.body).toEqual({ message: "Missing ?key parameter" });
        expect(redis.get).not.toHaveBeenCalled();
      });

      test("returns 503 when Redis lookup throws an error", async () => {
        redis.get.mockRejectedValue(new Error("Redis connection dropped"));
        const { req, res } = createMockReqRes({
          query: { key: "valid-looking-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(503);
        expect(res.body).toEqual({
          message: "Service temporarily unavailable, try again shortly.",
        });
        expect(emailScheduler.scheduleAllJobs).not.toHaveBeenCalled();
      });

      test("returns 403 when key is expired or not found in Redis", async () => {
        redis.get.mockResolvedValue(null);
        const { req, res } = createMockReqRes({
          query: { key: "expired-key", action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(403);
        expect(res.body).toEqual({ message: "❌ Invalid or expired key" });
        expect(redis.del).not.toHaveBeenCalled();
        expect(emailScheduler.scheduleAllJobs).not.toHaveBeenCalled();
      });
    });

    describe("Action Dispatching & Single-Use Key Consumption", () => {
      test("action 'start' consumes one-time key, calls scheduleAllJobs, and returns 200", async () => {
        const secretKey = "scheduler-start-key";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.scheduleAllJobs.mockResolvedValue();

        const { req, res } = createMockReqRes({
          headers: { "x-api-key": secretKey },
          query: { action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(redis.get).toHaveBeenCalledWith(`admin_key:${secretKey}`);
        expect(redis.del).toHaveBeenCalledWith(`admin_key:${secretKey}`);
        expect(emailScheduler.scheduleAllJobs).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({
          message: "✅ All cron jobs scheduled and running.",
        });
      });

      test("action 'stop' consumes one-time key, calls stopAllJobs, and returns 200", async () => {
        const secretKey = "scheduler-stop-key";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);

        const { req, res } = createMockReqRes({
          query: { key: secretKey, action: "stop" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(redis.del).toHaveBeenCalledWith(`admin_key:${secretKey}`);
        expect(emailScheduler.stopAllJobs).toHaveBeenCalledTimes(1);
        expect(res.statusCode).toBe(200);
        expect(res.body).toEqual({ message: "🛑 All cron jobs stopped." });
      });

      test("returns 400 when action parameter is missing or invalid, but key is consumed", async () => {
        const secretKey = "scheduler-invalid-action-key";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);

        const invalidActions = ["restart", "status", "pause", "", undefined];

        for (const action of invalidActions) {
          jest.clearAllMocks();
          redis.get.mockResolvedValue("valid");

          const { req, res } = createMockReqRes({
            query: { key: secretKey, ...(action !== undefined ? { action } : {}) },
          });

          await authController.secretJobsScheduler(req, res);

          // Key must be consumed immediately upon validation
          expect(redis.del).toHaveBeenCalledWith(`admin_key:${secretKey}`);
          expect(emailScheduler.scheduleAllJobs).not.toHaveBeenCalled();
          expect(emailScheduler.stopAllJobs).not.toHaveBeenCalled();
          expect(res.statusCode).toBe(400);
          expect(res.body).toEqual({
            message: "Invalid or missing ?action=start|stop parameter.",
          });
        }
      });

      test("returns 500 when emailScheduler.scheduleAllJobs throws an error", async () => {
        const secretKey = "scheduler-err-key";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.scheduleAllJobs.mockRejectedValue(
          new Error("Cron engine initialization failure"),
        );

        const { req, res } = createMockReqRes({
          query: { key: secretKey, action: "start" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({
          message: "Internal server error.",
          error: "Cron engine initialization failure",
        });
      });

      test("returns 500 when emailScheduler.stopAllJobs throws an error", async () => {
        const secretKey = "scheduler-stop-err-key";
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.stopAllJobs.mockImplementation(() => {
          throw new Error("Failed to abort running background jobs");
        });

        const { req, res } = createMockReqRes({
          query: { key: secretKey, action: "stop" },
        });

        await authController.secretJobsScheduler(req, res);

        expect(res.statusCode).toBe(500);
        expect(res.body).toEqual({
          message: "Internal server error.",
          error: "Failed to abort running background jobs",
        });
      });
    });
  });

  // =========================================================================
  // 4. Integration Tests (Express + Supertest + Auth Routes)
  // =========================================================================
  describe("4. Integration Tests via Express Router", () => {
    let app;

    beforeEach(() => {
      app = express();
      app.use(express.json());
      app.use(cookieParser(TEST_ADMIN_KEY));
      app.use(authRoutes);
    });

    describe("GET /generate-admin-key", () => {
      test("rejects unauthorized request with 403", async () => {
        const res = await request(app).get("/generate-admin-key");
        expect(res.status).toBe(403);
        expect(res.body).toEqual({ message: "Forbidden: Invalid admin secret" });
      });

      test("generates one-time key with valid x-admin-secret header", async () => {
        redis.set.mockResolvedValue("OK");

        const res = await request(app)
          .get("/generate-admin-key")
          .set("x-admin-secret", TEST_ADMIN_KEY);

        expect(res.status).toBe(200);
        expect(res.headers["cache-control"]).toBe("no-store");
        expect(res.body.key).toMatch(/^[0-9a-f]{64}$/);
        expect(redis.set).toHaveBeenCalledTimes(1);
      });
    });

    describe("POST /verify-admin-key", () => {
      test("verifies master ADMIN_KEY and sets signed mrn_role cookie in HTTP response", async () => {
        const res = await request(app).post("/verify-admin-key").send({ key: TEST_ADMIN_KEY });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ role: "admin" });

        const setCookieHeader = res.headers["set-cookie"];
        expect(setCookieHeader).toBeDefined();
        const cookieString = Array.isArray(setCookieHeader)
          ? setCookieHeader.join(";")
          : setCookieHeader;

        // Express cookieParser signs cookies with 's:' prefix
        expect(cookieString).toContain("mrn_role=s%3A");
        expect(cookieString).toContain("HttpOnly");
        expect(cookieString).toContain("SameSite=Lax");
        expect(cookieString).toContain("Path=/");
      });

      test("verifies valid one-time key and consumes it", async () => {
        const oneTimeKey = "b".repeat(64);
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);

        const res = await request(app).post("/verify-admin-key").send({ key: oneTimeKey });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ role: "admin" });
        expect(redis.get).toHaveBeenCalledWith(`admin_key:${oneTimeKey}`);
        expect(redis.del).toHaveBeenCalledWith(`admin_key:${oneTimeKey}`);
      });

      test("returns role 'user' without cookie for an unknown key", async () => {
        redis.get.mockResolvedValue(null);

        const res = await request(app).post("/verify-admin-key").send({ key: "random-fake-key" });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ role: "user" });
        expect(res.headers["set-cookie"]).toBeUndefined();
      });
    });

    describe("POST /secret-jobs-scheduler", () => {
      test("executes 'start' action through Express router with header key", async () => {
        const oneTimeKey = "c".repeat(64);
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);
        emailScheduler.scheduleAllJobs.mockResolvedValue();

        const res = await request(app)
          .post("/secret-jobs-scheduler?action=start")
          .set("x-api-key", oneTimeKey);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
          message: "✅ All cron jobs scheduled and running.",
        });
        expect(emailScheduler.scheduleAllJobs).toHaveBeenCalledTimes(1);
        expect(redis.del).toHaveBeenCalledWith(`admin_key:${oneTimeKey}`);
      });

      test("executes 'stop' action through Express router with query key", async () => {
        const oneTimeKey = "d".repeat(64);
        redis.get.mockResolvedValue("valid");
        redis.del.mockResolvedValue(1);

        const res = await request(app).post(`/secret-jobs-scheduler?key=${oneTimeKey}&action=stop`);

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ message: "🛑 All cron jobs stopped." });
        expect(emailScheduler.stopAllJobs).toHaveBeenCalledTimes(1);
        expect(redis.del).toHaveBeenCalledWith(`admin_key:${oneTimeKey}`);
      });
    });

    describe("Full Lifecycle Flow: Generate -> Verify -> Re-verify Rejection", () => {
      test("single-use key cannot be verified twice", async () => {
        // Step 1: Generate one-time key
        redis.set.mockResolvedValue("OK");
        const genRes = await request(app)
          .get("/generate-admin-key")
          .set("x-admin-secret", TEST_ADMIN_KEY);

        expect(genRes.status).toBe(200);
        const generatedKey = genRes.body.key;

        // Step 2: Verify one-time key (first use)
        redis.get.mockResolvedValueOnce("valid");
        redis.del.mockResolvedValueOnce(1);

        const verifyRes1 = await request(app).post("/verify-admin-key").send({ key: generatedKey });

        expect(verifyRes1.status).toBe(200);
        expect(verifyRes1.body).toEqual({ role: "admin" });
        expect(redis.del).toHaveBeenCalledWith(`admin_key:${generatedKey}`);

        // Step 3: Attempt second verification with the same consumed key
        redis.get.mockResolvedValueOnce(null); // Key no longer exists in Redis

        const verifyRes2 = await request(app).post("/verify-admin-key").send({ key: generatedKey });

        expect(verifyRes2.status).toBe(200);
        expect(verifyRes2.body).toEqual({ role: "user" });
      });
    });
  });
});
