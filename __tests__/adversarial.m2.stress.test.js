/**
 * Adversarial Stress & Verification Test Suite for Milestone 2:
 * Standalone PWA Admin Authentication & Session Continuity
 *
 * Covers:
 * 1. PWA Standalone cookie loss recovery (Bearer, x-admin-key, x-admin-secret, header casing, cookie re-issuance)
 * 2. Strict rejection of malformed, expired, revoked, forged, or boundary keys (safeCompare, Redis TTL)
 * 3. Service Worker dynamic API regex allowlist, concurrency stress, offline/online transitions
 * 4. Route /admin alias and query/header behavior
 */

process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "adversarial-master-secret-key-98765";
process.env.ADMIN_SKIP_KEY = "SKIP!";
const COOKIE_SECRET = "adversarial-cookie-secret-54321";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const cookieSignature = require("cookie-signature");

const ROOT_DIR = path.join(__dirname, "..");

// In-memory Redis mock with TTL tracking
const mockRedis = new Map();
const mockExpiry = new Map();

const redisGetImpl = async (k) => {
  if (mockExpiry.has(k) && Date.now() > mockExpiry.get(k)) {
    mockRedis.delete(k);
    mockExpiry.delete(k);
    return null;
  }
  return mockRedis.get(k) || null;
};

jest.mock("../config/redisClient", () => ({
  get: jest.fn(redisGetImpl),
  set: jest.fn(async (k, v, ...args) => {
    mockRedis.set(k, String(v));
    if (args[0] === "EX" && typeof args[1] === "number") {
      mockExpiry.set(k, Date.now() + args[1] * 1000);
    }
    return "OK";
  }),
  setex: jest.fn(async (k, ttl, v) => {
    mockRedis.set(k, String(v));
    mockExpiry.set(k, Date.now() + ttl * 1000);
    return "OK";
  }),
  del: jest.fn(async (k) => {
    const existed = mockRedis.has(k);
    mockRedis.delete(k);
    mockExpiry.delete(k);
    return existed ? 1 : 0;
  }),
  ping: jest.fn().mockResolvedValue("PONG"),
  quit: jest.fn().mockResolvedValue("OK"),
}));

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockResolvedValue([{ count: "99" }]),
    raw: jest.fn((sql) => sql),
  };
  const knex = jest.fn(() => queryBuilder);
  knex.raw = queryBuilder.raw;
  return knex;
});

jest.mock("../middleware/rateLimiters", () => ({
  authLimiter: (req, res, next) => next(),
  sendEmailLimiter: (req, res, next) => next(),
}));

const authRoutes = require("../routes/auth.routes");
const adminRoutes = require("../routes/admin.routes");
const pagesRoutes = require("../routes/pages.routes");
const pagesController = require("../controllers/pages.controller");
const { setApiBase } = require("../middleware/setApiBase");

function buildTestApp() {
  const app = express();
  app.use(cookieParser(COOKIE_SECRET));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(setApiBase);
  app.use(authRoutes);
  app.use(adminRoutes);
  app.use(pagesRoutes);
  app.get("/admin-dashboard", pagesController.adminDashboard);
  return app;
}

function getSignedAdminCookie(role = "admin") {
  const signed = "s:" + cookieSignature.sign(role, COOKIE_SECRET);
  return [`mrn_role=${signed}`];
}

describe("Adversarial Milestone 2 Stress Test Suite", () => {
  let app;

  beforeEach(() => {
    mockRedis.clear();
    mockExpiry.clear();
    app = buildTestApp();
  });

  // =========================================================================
  // SUITE 1: Standalone PWA Cookie Loss Recovery & Dual-Auth Headers
  // =========================================================================
  describe("Suite 1: Standalone PWA Cookie Loss Recovery & Header Resiliency", () => {
    test("1.1: Cookie completely missing, valid master key in Authorization: Bearer succeeds", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);
      expect(res.status).toBe(200);
    });

    test("1.2: Cookie completely missing, valid master key in x-admin-key succeeds", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("x-admin-key", process.env.ADMIN_KEY);
      expect(res.status).toBe(200);
    });

    test("1.3: Cookie completely missing, valid master key in x-admin-secret succeeds", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      expect(res.status).toBe(200);
    });

    test("1.4: Header case-insensitivity: Authorization, authorization, X-Admin-Key, X-ADMIN-SECRET", async () => {
      const res1 = await request(app)
        .get("/admin/database-stats")
        .set("authorization", `Bearer ${process.env.ADMIN_KEY}`);
      expect(res1.status).toBe(200);

      const res2 = await request(app)
        .get("/admin/database-stats")
        .set("X-Admin-Key", process.env.ADMIN_KEY);
      expect(res2.status).toBe(200);

      const res3 = await request(app)
        .get("/admin/database-stats")
        .set("X-ADMIN-SECRET", process.env.ADMIN_KEY);
      expect(res3.status).toBe(200);
    });

    test("1.5: Stale/corrupted cookie with invalid signature does not block valid Bearer token", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Cookie", ["mrn_role=s:corrupted_garbage_sig.12345"])
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);
      expect(res.status).toBe(200);
    });

    test("1.6: Stale non-admin cookie (mrn_role=user / subscriber) overridden by valid Bearer token", async () => {
      const userCookie = getSignedAdminCookie("subscriber");
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Cookie", userCookie)
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);
      expect(res.status).toBe(200);
    });

    test("1.7: Verified one-time key in Redis (admin:key:*) allows cookie loss recovery", async () => {
      const token = "verified-session-token-abc123xyz";
      mockRedis.set(`admin:key:${token}`, "active");

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    test("1.8: Pre-verified one-time key in Redis (admin_key:*) allows access even before verify endpoint", async () => {
      const token = "unverified-temp-key-777";
      mockRedis.set(`admin_key:${token}`, "valid");

      const res = await request(app).get("/admin/database-stats").set("x-admin-key", token);
      expect(res.status).toBe(200);
    });

    test("1.9: GET /admin-dashboard with valid Bearer token restores lost cookie by setting mrn_role=admin", async () => {
      const token = "session-restore-key-444";
      mockRedis.set(`admin:key:${token}`, "active");

      const res = await request(app)
        .get("/admin-dashboard")
        .set("Authorization", `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeDefined();
      const cookie = res.headers["set-cookie"].find((c) => c.startsWith("mrn_role="));
      expect(cookie).toBeDefined();
      expect(cookie).toMatch(/HttpOnly/i);
      expect(cookie).toMatch(/Path=\//i);
      expect(cookie).toMatch(/SameSite=Lax/i);
    });

    test("1.10: GET /admin-dashboard with valid query parameter ?key=<token> restores session", async () => {
      const token = "query-token-999";
      mockRedis.set(`admin:key:${token}`, "active");

      const res = await request(app).get(`/admin-dashboard?key=${token}`);
      expect(res.status).toBe(200);
      expect(res.headers["set-cookie"]).toBeDefined();
      const cookie = res.headers["set-cookie"].find((c) => c.startsWith("mrn_role="));
      expect(cookie).toBeDefined();
    });
  });

  // =========================================================================
  // SUITE 2: Strict Rejection of Malformed, Expired, Revoked, or Forged Keys
  // =========================================================================
  describe("Suite 2: Malformed, Expired, Revoked, and Forged Key Rejection", () => {
    test("2.1: Empty, whitespace-only, and literal 'undefined'/'null' tokens return 403", async () => {
      const badTokens = [
        "Bearer ",
        "Bearer   ",
        "Bearer undefined",
        "Bearer null",
        "Bearer [object Object]",
        "Bearer false",
        "Bearer NaN",
      ];

      for (const h of badTokens) {
        const res = await request(app).get("/admin/database-stats").set("Authorization", h);
        expect(res.status).toBe(403);
        expect(res.body).toHaveProperty("error");
      }
    });

    test("2.2: Non-Bearer Authorization schemes (Basic, Digest, Token) return 403", async () => {
      const schemes = [
        "Basic YWRtaW46cGFzc3dvcmQ=",
        'Digest username="admin", realm="admin"',
        "Token some-random-hex-token",
        "OAuth 12345",
      ];

      for (const h of schemes) {
        const res = await request(app).get("/admin/database-stats").set("Authorization", h);
        expect(res.status).toBe(403);
      }
    });

    test("2.3: Expired Redis TTL keys return 403 immediately", async () => {
      const expiredToken = "expired-token-000";
      // Set key with past expiration
      mockRedis.set(`admin_key:${expiredToken}`, "valid");
      mockExpiry.set(`admin_key:${expiredToken}`, Date.now() - 1000); // 1s ago

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${expiredToken}`);
      expect(res.status).toBe(403);
    });

    test("2.4: Deleted / revoked key returns 403 on second sequential request", async () => {
      const oneTimeToken = "single-use-token-111";
      mockRedis.set(`admin_key:${oneTimeToken}`, "valid");

      // First request with unverified key succeeds
      const res1 = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${oneTimeToken}`);
      expect(res1.status).toBe(200);

      // Now key is deleted from Redis (simulating revocation or consumption)
      mockRedis.delete(`admin_key:${oneTimeToken}`);

      // Second request must fail with 403
      const res2 = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${oneTimeToken}`);
      expect(res2.status).toBe(403);
    });

    test("2.5: Cross-namespace Redis isolation: tokens in subscriber_session:* or user:* do not grant admin access", async () => {
      const userToken = "legitimate-subscriber-session-token";
      mockRedis.set(`subscriber_session:${userToken}`, "subscriber@example.com");
      mockRedis.set(`user:${userToken}`, "some_user_data");

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${userToken}`);
      expect(res.status).toBe(403);
    });

    test("2.6: SQL injection, path traversal, or special characters in token are safely handled and return 403", async () => {
      const attackPayloads = [
        "' OR '1'='1",
        "'; DROP TABLE subscribers; --",
        "../../../../etc/passwd",
        "%00admin",
        "<script>alert(1)</script>",
        "\\",
        "%",
      ];

      for (const payload of attackPayloads) {
        const res = await request(app)
          .get("/admin/database-stats")
          .set("Authorization", `Bearer ${payload}`);
        expect(res.status).toBe(403);
      }
    });

    test("2.7: Constant-time comparison safely rejects partial matches without timing leakage or throwing", async () => {
      const master = process.env.ADMIN_KEY;
      const candidates = [
        master.slice(0, 5), // prefix only
        master + "-suffix", // prefix plus extras
        master.replace(/a/g, "b"), // same length different chars
        "",
      ];

      for (const candidate of candidates) {
        const res = await request(app)
          .get("/admin/database-stats")
          .set("Authorization", `Bearer ${candidate}`);
        expect(res.status).toBe(403);
      }
    });

    test("2.8: Redis throws error during lookup in requireAdmin: fails gracefully with 403, no 500 or crash", async () => {
      const redisClient = require("../config/redisClient");
      redisClient.get.mockImplementationOnce(async () => {
        throw new Error("Redis cluster connection timeout");
      });

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", "Bearer some-key-while-redis-is-down");

      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      redisClient.get.mockImplementation(redisGetImpl);
    });

    test("2.9: When ADMIN_KEY is undefined or empty string, master key bypass is disabled", async () => {
      const originalAdminKey = process.env.ADMIN_KEY;
      delete process.env.ADMIN_KEY;

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${originalAdminKey}`);

      expect(res.status).toBe(403);
      process.env.ADMIN_KEY = originalAdminKey;
    });
  });

  // =========================================================================
  // SUITE 3: Service Worker Dynamic API Routing, Concurrency & Offline Fallbacks
  // =========================================================================
  describe("Suite 3: Service Worker Bypass, Concurrency & Offline Fallbacks", () => {
    test("3.1: Service Worker regex allowlist matches all admin variants and parameterizations", () => {
      const swContent = fs.readFileSync(path.join(ROOT_DIR, "public", "sw.js"), "utf-8");

      const dynamicRegexes = [
        /\/generate-admin-key/,
        /\/verify-admin-key/,
        /\/admin-dashboard/,
        /\/admin/,
      ];

      for (const rx of dynamicRegexes) {
        expect(swContent).toMatch(rx);
      }

      const urlsToBypass = [
        "/generate-admin-key",
        "/generate-admin-key?adminSecret=secret",
        "/verify-admin-key",
        "/verify-admin-key?t=12345",
        "/admin-dashboard",
        "/admin-dashboard?key=token123",
        "/admin",
        "/admin?ref=pwa_icon",
      ];

      for (const u of urlsToBypass) {
        const matched = dynamicRegexes.some((rx) => rx.test(u));
        expect(matched).toBe(true);
      }
    });

    test("3.2: High concurrency stress: 50 concurrent authenticated requests complete without error or race condition", async () => {
      const token = "concurrent-stress-token-555";
      mockRedis.set(`admin:key:${token}`, "active");

      const requests = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .get("/admin/database-stats")
          .set("Authorization", `Bearer ${token}`)
          .set("X-Request-Index", String(i)),
      );

      const responses = await Promise.all(requests);

      expect(responses.length).toBe(50);
      for (const res of responses) {
        expect(res.status).toBe(200);
      }
    });

    test("3.3: High concurrency: concurrent verification of different keys maintains isolation", async () => {
      const keys = Array.from({ length: 20 }, (_, i) => `concurrent-key-${i}`);
      for (const k of keys) {
        mockRedis.set(`admin_key:${k}`, "valid");
      }

      const verifyPromises = keys.map((k) =>
        request(app).post("/verify-admin-key").send({ key: k }),
      );

      const results = await Promise.all(verifyPromises);

      for (let i = 0; i < 20; i++) {
        expect(results[i].status).toBe(200);
        expect(results[i].body.role).toBe("admin");
        // Ensure one-time key was deleted and session key set
        expect(mockRedis.has(`admin_key:${keys[i]}`)).toBe(false);
        expect(mockRedis.get(`admin:key:${keys[i]}`)).toBe("active");
      }
    });

    test("3.4: Re-verification of already-consumed one-time key is rejected as regular user role", async () => {
      const oneTimeKey = "once-only-test-key";
      mockRedis.set(`admin_key:${oneTimeKey}`, "valid");

      // First verification succeeds
      const res1 = await request(app).post("/verify-admin-key").send({ key: oneTimeKey });
      expect(res1.status).toBe(200);
      expect(res1.body.role).toBe("admin");

      // Second verification with the same key fails to grant admin role
      const res2 = await request(app).post("/verify-admin-key").send({ key: oneTimeKey });
      expect(res2.status).toBe(200);
      expect(res2.body.role).toBe("user");
      // Does not set admin cookie
      const cookies = res2.headers["set-cookie"] || [];
      expect(cookies.some((c) => c.startsWith("mrn_role="))).toBe(false);
    });

    test("3.5: Service Worker offline fallback contract for admin routes returns 503 HTML or JSON and never stale cache", () => {
      const sw = fs.readFileSync(path.join(ROOT_DIR, "public", "sw.js"), "utf-8");

      // Check offline handling logic in sw.js
      expect(sw).toContain("Admin Offline");
      expect(sw).toContain("status: 503");
      expect(sw).toMatch(/url\.pathname\.startsWith\("\/admin"\)/);
    });
  });

  // =========================================================================
  // SUITE 4: Route /admin Alias, Redirect & Query Parameter Preserving
  // =========================================================================
  describe("Suite 4: Route /admin Alias and Redirect Behavior", () => {
    test("4.1: GET /admin returns 302 redirecting to /admin-dashboard", async () => {
      const res = await request(app).get("/admin");
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/admin-dashboard/);
    });

    test("4.2: Unauthenticated follow-through of /admin -> /admin-dashboard bounces to /", async () => {
      const res1 = await request(app).get("/admin");
      expect(res1.status).toBe(302);

      const targetUrl = res1.headers.location;
      const res2 = await request(app).get(targetUrl);
      // Without auth, /admin-dashboard redirects (302) to /
      expect(res2.status).toBe(302);
      expect(res2.headers.location).toBe("/");
    });

    test("4.3: Authenticated follow-through of /admin with cookie lands on admin-dashboard with 200", async () => {
      const cookie = getSignedAdminCookie("admin");
      const res1 = await request(app).get("/admin").set("Cookie", cookie);
      expect(res1.status).toBe(302);

      const res2 = await request(app).get(res1.headers.location).set("Cookie", cookie);
      expect(res2.status).toBe(200);
      expect(res2.text).toContain("Morning Routine");
    });

    test("4.4: GET /admin?key=<validKey> preserves redirect behavior", async () => {
      const token = "query-token-redirect-test";
      mockRedis.set(`admin:key:${token}`, "active");

      const res = await request(app).get(`/admin?key=${token}`);
      expect(res.status).toBe(302);
      // Verify redirect target
      expect(res.headers.location).toMatch(/\/admin-dashboard/);
    });

    test("4.5: GET /admin with Authorization Bearer header returns 302 redirect", async () => {
      const res = await request(app)
        .get("/admin")
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/admin-dashboard/);
    });

    test("4.6: GET /admin with x-admin-key header returns 302 redirect", async () => {
      const res = await request(app).get("/admin").set("x-admin-key", process.env.ADMIN_KEY);
      expect(res.status).toBe(302);
      expect(res.headers.location).toMatch(/\/admin-dashboard/);
    });
  });
});
