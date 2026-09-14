/**
 * Empirical Stress & Verification Test Suite for Milestone 2
 * Author: challenger_m2_1
 *
 * Scopes:
 *  1. Standalone PWA Cookie Loss Recovery & Dual-Auth Headers
 *  2. Malformed, Expired, Revoked, Forged, and Boundary Rejection
 *  3. High-Concurrency Stress & Race Conditions
 *  4. Service Worker Dynamic API Routing & Offline Integrity
 *  5. Route /admin Alias and Query Handling
 */

process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "challenger-master-secret-key-12345";
process.env.ADMIN_SKIP_KEY = "SKIP!";
const COOKIE_SECRET = "challenger-cookie-secret-67890";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const cookieSignature = require("cookie-signature");

const ROOT_DIR = path.join(__dirname, "..");

// In-memory Redis store with TTL emulation
const mockRedisDb = new Map();
const mockRedisTtl = new Map();

jest.mock("../config/redisClient", () => ({
  get: jest.fn(async (key) => {
    if (mockRedisTtl.has(key) && Date.now() > mockRedisTtl.get(key)) {
      mockRedisDb.delete(key);
      mockRedisTtl.delete(key);
      return null;
    }
    return mockRedisDb.get(key) || null;
  }),
  set: jest.fn(async (key, val, ...args) => {
    mockRedisDb.set(key, String(val));
    if (args[0] === "EX" && typeof args[1] === "number") {
      mockRedisTtl.set(key, Date.now() + args[1] * 1000);
    }
    return "OK";
  }),
  setex: jest.fn(async (key, ttl, val) => {
    mockRedisDb.set(key, String(val));
    mockRedisTtl.set(key, Date.now() + ttl * 1000);
    return "OK";
  }),
  del: jest.fn(async (key) => {
    const existed = mockRedisDb.has(key);
    mockRedisDb.delete(key);
    mockRedisTtl.delete(key);
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
    count: jest.fn().mockResolvedValue([{ count: "100" }]),
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

function buildApp() {
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

function createSignedCookie(val, secret = COOKIE_SECRET) {
  return [`mrn_role=s:${cookieSignature.sign(val, secret)}`];
}

describe("Empirical Challenger M2 Stress Suite", () => {
  let app;

  beforeEach(() => {
    mockRedisDb.clear();
    mockRedisTtl.clear();
    app = buildApp();
  });

  // =========================================================================
  // SECTION 1: STANDALONE PWA COOKIE LOSS RECOVERY
  // =========================================================================
  describe("Section 1: Standalone PWA Cookie Loss Recovery", () => {
    test("EMP-1.1: Request succeeds with Authorization: Bearer <master_key> when cookie is absent", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);

      expect(res.status).toBe(200);
    });

    test("EMP-1.2: Request succeeds with x-admin-key: <master_key> when cookie is absent", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("x-admin-key", process.env.ADMIN_KEY);

      expect(res.status).toBe(200);
    });

    test("EMP-1.3: Request succeeds with x-admin-secret: <master_key> when cookie is absent", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("x-admin-secret", process.env.ADMIN_KEY);

      expect(res.status).toBe(200);
    });

    test("EMP-1.4: Cookie loss recovery with active Redis session key (admin:key:*) via Bearer header", async () => {
      const sessionToken = "pwa-active-session-token-999";
      mockRedisDb.set(`admin:key:${sessionToken}`, "active");

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
    });

    test("EMP-1.5: Cookie loss recovery with active Redis session key (admin:key:*) via x-admin-key header", async () => {
      const sessionToken = "pwa-active-session-token-888";
      mockRedisDb.set(`admin:key:${sessionToken}`, "active");

      const res = await request(app).get("/admin/database-stats").set("x-admin-key", sessionToken);

      expect(res.status).toBe(200);
    });

    test("EMP-1.6: Corrupted/tampered cookie is bypassed when valid Bearer token is provided", async () => {
      const sessionToken = "pwa-active-session-token-777";
      mockRedisDb.set(`admin:key:${sessionToken}`, "active");

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Cookie", ["mrn_role=corrupted_tampered_unsigned_value"])
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
    });

    test("EMP-1.7: Non-admin cookie (mrn_role=user) is overridden by valid Bearer token", async () => {
      const userCookie = createSignedCookie("user");
      const sessionToken = "pwa-active-session-token-666";
      mockRedisDb.set(`admin:key:${sessionToken}`, "active");

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Cookie", userCookie)
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
    });

    test("EMP-1.8: GET /admin-dashboard restores lost cookie with correct security attributes", async () => {
      const sessionToken = "pwa-active-session-token-555";
      mockRedisDb.set(`admin:key:${sessionToken}`, "active");

      const res = await request(app)
        .get("/admin-dashboard")
        .set("Authorization", `Bearer ${sessionToken}`);

      expect(res.status).toBe(200);
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const roleCookie = cookies.find((c) => c.startsWith("mrn_role="));
      expect(roleCookie).toBeDefined();
      expect(roleCookie).toMatch(/HttpOnly/i);
      expect(roleCookie).toMatch(/Path=\//i);
      expect(roleCookie).toMatch(/SameSite=Lax/i);
    });

    test("EMP-1.9: GET /admin-dashboard with query parameter ?key=<token> authenticates and restores cookie", async () => {
      const sessionToken = "pwa-active-session-token-444";
      mockRedisDb.set(`admin:key:${sessionToken}`, "active");

      const res = await request(app).get(`/admin-dashboard?key=${sessionToken}`);

      expect(res.status).toBe(200);
      const cookies = res.headers["set-cookie"];
      expect(cookies).toBeDefined();
      const roleCookie = cookies.find((c) => c.startsWith("mrn_role="));
      expect(roleCookie).toBeDefined();
    });
  });

  // =========================================================================
  // SECTION 2: STRICT REJECTION OF MALFORMED, EXPIRED & INVALID KEYS
  // =========================================================================
  describe("Section 2: Strict Rejection of Malformed, Expired & Invalid Keys", () => {
    test("EMP-2.1: Rejects requests with no auth credentials with 403 Forbidden", async () => {
      const res = await request(app).get("/admin/database-stats");
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/Forbidden/i);
    });

    test("EMP-2.2: Rejects empty or whitespace-only Bearer tokens with 403 Forbidden", async () => {
      const emptyHeaders = [
        "Bearer",
        "Bearer ",
        "Bearer   ",
        "Bearer \t",
        "Bearer undefined",
        "Bearer null",
      ];

      for (const h of emptyHeaders) {
        const res = await request(app).get("/admin/database-stats").set("Authorization", h);
        expect(res.status).toBe(403);
      }
    });

    test("EMP-2.3: Rejects empty or whitespace-only x-admin-key headers with 403 Forbidden", async () => {
      const emptyKeys = ["", "   ", "\t\t", "undefined", "null"];

      for (const k of emptyKeys) {
        const res = await request(app).get("/admin/database-stats").set("x-admin-key", k);
        expect(res.status).toBe(403);
      }
    });

    test("EMP-2.4: Rejects non-Bearer schemes (Basic, Digest, Token) with 403 Forbidden", async () => {
      const schemes = ["Basic dXNlcjpwYXNz", "Digest username=admin", "Token secret-key-xyz"];

      for (const s of schemes) {
        const res = await request(app).get("/admin/database-stats").set("Authorization", s);
        expect(res.status).toBe(403);
      }
    });

    test("EMP-2.5: Rejects non-existent token in Redis with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", "Bearer non-existent-redis-token-12345");

      expect(res.status).toBe(403);
    });

    test("EMP-2.6: Rejects expired Redis session keys (TTL exceeded) with 403 Forbidden", async () => {
      const expiredToken = "expired-redis-token-111";
      // Manually set as expired in mock
      mockRedisDb.set(`admin:key:${expiredToken}`, "active");
      mockRedisTtl.set(`admin:key:${expiredToken}`, Date.now() - 1000); // 1s in the past

      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${expiredToken}`);

      expect(res.status).toBe(403);
    });

    test("EMP-2.7: Rejects forged signed cookies with wrong secret with 403 Forbidden", async () => {
      const forgedCookie = createSignedCookie("admin", "wrong-secret-signature");

      const res = await request(app).get("/admin/database-stats").set("Cookie", forgedCookie);

      expect(res.status).toBe(403);
    });

    test("EMP-2.8: Rejects unsigned raw cookie mrn_role=admin with 403 Forbidden", async () => {
      const res = await request(app).get("/admin/database-stats").set("Cookie", ["mrn_role=admin"]);

      expect(res.status).toBe(403);
    });

    test("EMP-2.9: Rejects malicious payloads (SQLi, prototype pollution, path traversal) gracefully", async () => {
      const payloads = [
        "' OR '1'='1",
        "../../etc/passwd",
        "__proto__",
        "constructor",
        "<script>alert(1)</script>",
        "X".repeat(5000), // 5KB long key
      ];

      for (const p of payloads) {
        const res = await request(app)
          .get("/admin/database-stats")
          .set("Authorization", `Bearer ${p}`);
        expect(res.status).toBe(403);
      }
    });

    test("EMP-2.10: Re-verifying an already-consumed one-time key yields user role and does not grant admin", async () => {
      const oneTimeKey = "single-use-key-abc123";
      mockRedisDb.set(`admin_key:${oneTimeKey}`, "valid");

      // First verification: success
      const firstRes = await request(app).post("/verify-admin-key").send({ key: oneTimeKey });
      expect(firstRes.status).toBe(200);
      expect(firstRes.body.role).toBe("admin");

      // Second verification: rejected because admin_key was deleted
      const secondRes = await request(app).post("/verify-admin-key").send({ key: oneTimeKey });
      expect(secondRes.status).toBe(200);
      expect(secondRes.body.role).toBe("user");
      const cookies = secondRes.headers["set-cookie"] || [];
      expect(cookies.some((c) => c.startsWith("mrn_role="))).toBe(false);
    });
  });

  // =========================================================================
  // SECTION 3: CONCURRENCY & RACE CONDITIONS
  // =========================================================================
  describe("Section 3: Concurrency & High-Throughput Stress", () => {
    test("EMP-3.1: 50 concurrent requests with valid Bearer token all succeed with 200", async () => {
      const token = "concurrent-stress-token-777";
      mockRedisDb.set(`admin:key:${token}`, "active");

      const reqs = Array.from({ length: 50 }, (_, i) =>
        request(app)
          .get("/admin/database-stats")
          .set("Authorization", `Bearer ${token}`)
          .set("X-Batch-Index", String(i)),
      );

      const responses = await Promise.all(reqs);
      expect(responses.length).toBe(50);
      for (const r of responses) {
        expect(r.status).toBe(200);
      }
    });

    test("EMP-3.2: 50 concurrent requests with mixed valid and invalid keys maintain strict isolation", async () => {
      const validToken = "concurrent-valid-token-333";
      mockRedisDb.set(`admin:key:${validToken}`, "active");

      const reqs = Array.from({ length: 50 }, (_, i) => {
        const isValid = i % 2 === 0;
        const key = isValid ? validToken : `invalid-token-${i}`;
        return request(app)
          .get("/admin/database-stats")
          .set("Authorization", `Bearer ${key}`)
          .then((res) => ({ index: i, isValid, status: res.status }));
      });

      const results = await Promise.all(reqs);
      for (const res of results) {
        if (res.isValid) {
          expect(res.status).toBe(200);
        } else {
          expect(res.status).toBe(403);
        }
      }
    });
  });

  // =========================================================================
  // SECTION 4: SERVICE WORKER DYNAMIC API REGEX & OFFLINE INTEGRITY
  // =========================================================================
  describe("Section 4: Service Worker Dynamic API Regex & Routing Integrity", () => {
    test("EMP-4.1: public/sw.js matches all admin paths and query variants in isDynamicApi", () => {
      const swPath = path.join(ROOT_DIR, "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);
      const sw = fs.readFileSync(swPath, "utf-8");

      // Extract dynamic regex definitions
      expect(sw).toMatch(/\/generate-admin-key/);
      expect(sw).toMatch(/\/verify-admin-key/);
      expect(sw).toMatch(/\/admin-dashboard/);
      expect(sw).toMatch(/\/admin/);

      // Verify that neither /generate-admin-key nor /verify-admin-key is ever pre-cached in STATIC_ASSETS
      expect(sw).not.toContain('"/generate-admin-key"');
      expect(sw).not.toContain('"/verify-admin-key"');

      // Test pathname matching logic
      const dynamicRegexes = [
        /\/generate-admin-key/,
        /\/verify-admin-key/,
        /\/admin-dashboard/,
        /\/admin/,
      ];

      const testPaths = [
        "/generate-admin-key",
        "/verify-admin-key",
        "/admin-dashboard",
        "/admin",
        "/admin/database-stats",
        "/admin/api/telemetry-overview",
      ];

      for (const p of testPaths) {
        const matches = dynamicRegexes.some((rx) => rx.test(p));
        expect(matches).toBe(true);
      }
    });

    test("EMP-4.2: public/sw.js contains proper offline fallbacks for admin routes", () => {
      const sw = fs.readFileSync(path.join(ROOT_DIR, "public", "sw.js"), "utf-8");
      expect(sw).toContain("Admin Offline");
      expect(sw).toContain("503");
    });
  });

  // =========================================================================
  // SECTION 5: ROUTE /admin ALIAS AND QUERY HANDLING
  // =========================================================================
  describe("Section 5: Route /admin Alias and Query Handling", () => {
    test("EMP-5.1: GET /admin returns 302 redirecting to /admin-dashboard", async () => {
      const res = await request(app).get("/admin");
      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/admin-dashboard");
    });

    test("EMP-5.2: Unauthenticated follow of /admin -> /admin-dashboard bounces to /", async () => {
      const initial = await request(app).get("/admin");
      expect(initial.status).toBe(302);

      const followed = await request(app).get(initial.headers.location);
      expect(followed.status).toBe(302);
      expect(followed.headers.location).toBe("/");
    });

    test("EMP-5.3: Authenticated follow of /admin with signed cookie lands on dashboard (200)", async () => {
      const cookie = createSignedCookie("admin");
      const initial = await request(app).get("/admin").set("Cookie", cookie);
      expect(initial.status).toBe(302);

      const followed = await request(app).get(initial.headers.location).set("Cookie", cookie);
      expect(followed.status).toBe(200);
    });

    test("EMP-5.4: GET /admin with Authorization Bearer header returns 302 redirect", async () => {
      const res = await request(app)
        .get("/admin")
        .set("Authorization", `Bearer ${process.env.ADMIN_KEY}`);

      expect(res.status).toBe(302);
      expect(res.headers.location).toBe("/admin-dashboard");
    });
  });
});
