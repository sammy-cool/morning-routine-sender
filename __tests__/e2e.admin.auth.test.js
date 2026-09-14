/**
 * E2E Test Suite: Standalone PWA Admin Authentication & Session Continuity (Feature R3)
 *
 * Methodology: 4-Tier Test Architecture
 *  - Tier 1: Feature Coverage (>=5 tests per feature)
 *  - Tier 2: Boundary & Corner Cases (>=5 tests per feature)
 *  - Tier 3: Cross-Feature Combinations
 *  - Tier 4: Real-World Scenarios
 *
 * Authoritative Sources:
 *  - ORIGINAL_REQUEST.md: Section R3, Lines 18-20, 39-42
 *  - PROJECT.md: Features F5, F6, F7, F8, Lines 16-19, 38-42, 50-52
 *  - DISPATCH.md: R3 Specification
 */

process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "test-master-secret-key-xyz789";
process.env.ADMIN_SKIP_KEY = "SKIP!";
const COOKIE_SECRET = "test-admin-cookie-secret-123";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const cookieSignature = require("cookie-signature");

// In-memory Redis store mock for deterministic key testing
const mockRedisStore = new Map();

jest.mock("../config/redisClient", () => ({
  get: jest.fn(async (k) => mockRedisStore.get(k) || null),
  set: jest.fn(async (k, v) => {
    mockRedisStore.set(k, String(v));
    return "OK";
  }),
  setex: jest.fn(async (k, ttl, v) => {
    mockRedisStore.set(k, String(v));
    return "OK";
  }),
  del: jest.fn(async (k) => {
    const existed = mockRedisStore.has(k);
    mockRedisStore.delete(k);
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
    count: jest.fn().mockResolvedValue([{ count: "42" }]),
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

const ROOT_DIR = path.join(__dirname, "..");

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

describe("Standalone PWA Admin Authentication & Session Continuity E2E Suite (R3)", () => {
  let app;

  beforeEach(() => {
    mockRedisStore.clear();
    app = buildTestApp();
  });

  // =========================================================================
  // TIER 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage - SW Dynamic Passthrough, Dual Auth & Route Alias", () => {
    test("R3-T1-1: public/sw.js isDynamicApi includes /generate-admin-key, /verify-admin-key, /admin-dashboard, and /admin", () => {
      const swPath = path.join(ROOT_DIR, "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);
      const sw = fs.readFileSync(swPath, "utf-8");

      // Verify that dynamic API regex / checks include admin authentication routes
      expect(sw).toMatch(/\/generate-admin-key/);
      expect(sw).toMatch(/\/verify-admin-key/);
      expect(sw).toMatch(/\/admin-dashboard/);
      expect(sw).toMatch(/\/admin/);
    });

    test("R3-T1-2: GET /generate-admin-key generates one-time admin key with master secret", async () => {
      const res = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);

      expect(res.status).toBe(200);
      expect(res.body).toHaveProperty("key");
      expect(typeof res.body.key).toBe("string");
      expect(res.body.key.length).toBeGreaterThanOrEqual(16);
    });

    test("R3-T1-3: POST /verify-admin-key sets secure signed mrn_role=admin cookie with proper attributes", async () => {
      // First generate a valid key
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const adminKey = genRes.body.key;

      const verifyRes = await request(app).post("/verify-admin-key").send({ key: adminKey });

      expect(verifyRes.status).toBe(200);
      expect(verifyRes.body.role).toBe("admin");

      const cookies = verifyRes.headers["set-cookie"];
      expect(cookies).toBeDefined();

      const roleCookie = cookies.find((c) => c.startsWith("mrn_role="));
      expect(roleCookie).toBeDefined();
      expect(roleCookie).toMatch(/HttpOnly/i);
      expect(roleCookie).toMatch(/Path=\//i);
      expect(roleCookie).toMatch(/SameSite=Lax/i);
    });

    test("R3-T1-4: requireAdmin grants access to protected admin route when valid signed mrn_role=admin cookie is provided", async () => {
      const cookie = getSignedAdminCookie("admin");

      const res = await request(app).get("/admin/database-stats").set("Cookie", cookie);

      expect(res.status).toBe(200);
    });

    test("R3-T1-5: requireAdmin grants access with Authorization: Bearer <key> header (PWA standalone fallback)", async () => {
      // Generate active admin key in redis
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const adminKey = genRes.body.key;

      // Access admin endpoint WITHOUT cookies, using Authorization: Bearer
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${adminKey}`);

      expect(res.status).toBe(200);
    });

    test("R3-T1-6: requireAdmin grants access with x-admin-key: <key> header", async () => {
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const adminKey = genRes.body.key;

      // Access admin endpoint WITHOUT cookies, using x-admin-key
      const res = await request(app).get("/admin/database-stats").set("x-admin-key", adminKey);

      expect(res.status).toBe(200);
    });

    test("R3-T1-7: Admin Route Alias - GET /admin redirects (302) to /admin-dashboard (or renders dashboard)", async () => {
      const res = await request(app).get("/admin");

      // Per F7: /admin should route to adminDashboard or redirect (302) to /admin-dashboard, NOT 404
      expect(res.status).not.toBe(404);
      if (res.status === 302) {
        expect(res.headers.location).toBe("/admin-dashboard");
      } else {
        expect(res.status).toBe(200);
      }
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases - Missing Auth, Malformed Headers & Key Lifecycle", () => {
    test("R3-T2-1: requireAdmin rejects unauthenticated requests with 403 Forbidden", async () => {
      const res = await request(app).get("/admin/database-stats");
      expect(res.status).toBe(403);
      expect(res.body).toHaveProperty("error");
      expect(res.body.error).toMatch(/admin access required/i);
    });

    test("R3-T2-2: requireAdmin rejects malformed Authorization headers (empty Bearer, Basic auth, invalid tokens)", async () => {
      const malformedHeaders = [
        "Bearer ",
        "Bearer",
        "Basic dXNlcjpwYXNz",
        "Token invalid-token",
        "Bearer undefined",
        "Bearer null",
      ];

      for (const header of malformedHeaders) {
        const res = await request(app).get("/admin/database-stats").set("Authorization", header);

        expect(res.status).toBe(403);
      }
    });

    test("R3-T2-3: requireAdmin rejects non-existent or expired admin keys with 403 Forbidden", async () => {
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", "Bearer invalid-hex-nonexistent-key-9999");

      expect(res.status).toBe(403);
    });

    test("R3-T2-4: requireAdmin rejects cookie with non-admin role (mrn_role=subscriber / guest)", async () => {
      const cookieSubscriber = getSignedAdminCookie("subscriber");

      const res = await request(app).get("/admin/database-stats").set("Cookie", cookieSubscriber);

      expect(res.status).toBe(403);
    });

    test("R3-T2-5: GET /generate-admin-key rejects unauthorized requests with missing or invalid secret", async () => {
      // 1. Missing secret
      const resMissing = await request(app).get("/generate-admin-key");
      expect([401, 403]).toContain(resMissing.status);

      // 2. Wrong secret
      const resWrong = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", "completely-wrong-secret");
      expect([401, 403]).toContain(resWrong.status);
    });

    test("R3-T2-6: POST /verify-admin-key rejects empty key with 400 and invalid key with role user and no admin cookie", async () => {
      // 1. Missing key
      const resMissing = await request(app).post("/verify-admin-key").send({});
      expect(resMissing.status).toBe(400);

      // 2. Nonexistent / invalid key
      const resInvalid = await request(app)
        .post("/verify-admin-key")
        .send({ key: "non-existent-or-expired-key" });

      expect(resInvalid.status).toBe(200);
      expect(resInvalid.body.role).toBe("user");
      // Cookie mrn_role should not be set
      const cookies = resInvalid.headers["set-cookie"] || [];
      expect(cookies.some((c) => c.startsWith("mrn_role="))).toBe(false);
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations - Webview Cookie Drop Recovery", () => {
    test("R3-T3-1: Standalone PWA recovery - request with corrupted/dropped cookie but valid Authorization header succeeds", async () => {
      // Generate active admin key in redis
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const adminKey = genRes.body.key;

      // Provide invalid cookie (e.g. dropped/corrupted session) along with valid Bearer header
      const res = await request(app)
        .get("/admin/database-stats")
        .set("Cookie", ["mrn_role=corrupted_unsigned_value"])
        .set("Authorization", `Bearer ${adminKey}`);

      expect(res.status).toBe(200);
    });

    test("R3-T3-2: Admin key permits sequential protected endpoint executions without requiring re-authentication", async () => {
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const adminKey = genRes.body.key;

      // First call
      const res1 = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${adminKey}`);
      expect(res1.status).toBe(200);

      // Second call
      const res2 = await request(app)
        .post("/admin/cleanup-logs")
        .set("Authorization", `Bearer ${adminKey}`);
      expect(res2.status).toBe(200);
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================
  describe("Tier 4: Real-World Scenarios - Full Standalone PWA Admin Journey", () => {
    test("R3-T4-1: Complete Standalone PWA Admin Journey: generate key -> verify -> session storage -> route alias -> protected action", async () => {
      // Step 1: Admin generates one-time key with master secret
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      expect(genRes.status).toBe(200);
      const { key: adminKey } = genRes.body;

      // Step 2: Admin verifies one-time key
      const verifyRes = await request(app).post("/verify-admin-key").send({ key: adminKey });
      expect(verifyRes.status).toBe(200);

      // Step 3: Admin navigates to /admin (PWA bookmark / shortcut)
      const aliasRes = await request(app).get("/admin");
      expect(aliasRes.status).not.toBe(404);

      // Step 4: Standalone PWA client calls protected diagnostic API with Authorization header fallback
      const actionRes = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${adminKey}`);
      expect(actionRes.status).toBe(200);
    });
  });
});
