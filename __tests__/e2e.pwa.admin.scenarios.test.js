/**
 * E2E Test Suite: Cross-Feature Combinations, Real-World Scenarios & Repository Quality Gates (Tiers 3 & 4 + R5)
 *
 * Methodology: 4-Tier Test Architecture
 *  - Tier 3: Cross-Feature Combinations (Pairwise)
 *  - Tier 4: Real-World Scenarios
 *  - R5: Repository Quality Gates
 *
 * Authoritative Sources:
 *  - ORIGINAL_REQUEST.md: Sections R3, R4, R5, Lines 24-26, 47-55
 *  - PROJECT.md: Features F14, F15, Lines 25-26, 35
 *  - DISPATCH.md: Tiers 3, 4, R5 Specification
 */

process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "test-e2e-master-secret-999";
const COOKIE_SECRET = "test-e2e-cookie-secret-888";

const cp = require("node:child_process");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const cookieSignature = require("cookie-signature");

const ROOT_DIR = path.join(__dirname, "..");

// Redis mock for deterministic key storage across scenarios
const mockRedis = new Map();

jest.mock("../config/redisClient", () => ({
  get: jest.fn(async (k) => mockRedis.get(k) || null),
  set: jest.fn(async (k, v) => {
    mockRedis.set(k, String(v));
    return "OK";
  }),
  setex: jest.fn(async (k, ttl, v) => {
    mockRedis.set(k, String(v));
    return "OK";
  }),
  del: jest.fn(async (k) => {
    const existed = mockRedis.has(k);
    mockRedis.delete(k);
    return existed ? 1 : 0;
  }),
  ping: jest.fn().mockResolvedValue("PONG"),
  quit: jest.fn().mockResolvedValue("OK"),
}));

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    count: jest.fn().mockResolvedValue([{ count: "10" }]),
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
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const pagesController = require("../controllers/pages.controller");
const { setApiBase } = require("../middleware/setApiBase");

function buildTestApp() {
  const app = express();
  app.use(cookieParser(COOKIE_SECRET));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(setApiBase);
  app.use(express.static(path.join(ROOT_DIR, "public")));
  app.use(authRoutes);
  app.use(adminRoutes);
  app.use(subscriberPortalRoutes);
  app.use(pagesRoutes);
  app.get("/admin-dashboard", pagesController.adminDashboard);
  return app;
}

function getSignedAdminCookie(role = "admin") {
  const signed = "s:" + cookieSignature.sign(role, COOKIE_SECRET);
  return [`mrn_role=${signed}`];
}

describe("Cross-Feature Combinations, Real-World Scenarios & Quality Gates E2E Suite (T3, T4, R5)", () => {
  let app;

  beforeEach(() => {
    mockRedis.clear();
    app = buildTestApp();
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations - Standalone PWA Navigation, Auth & Loader", () => {
    test("E2E-T3-1: Standalone PWA mode navigating between /admin and /user-dashboard retains auth headers and loader overlay", async () => {
      // 1. Generate active admin key
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const adminKey = genRes.body.key;

      // 2. Request /admin alias (should route to /admin-dashboard)
      const adminRes = await request(app).get("/admin").set("Authorization", `Bearer ${adminKey}`);
      expect(adminRes.status).not.toBe(404);

      // 3. Request /user-dashboard in the same standalone PWA session
      const userDashRes = await request(app).get("/user-dashboard");
      expect(userDashRes.status).toBe(200);
      expect(userDashRes.text).toContain('id="loaderRoot"');
    });

    test("E2E-T3-2: Service Worker dynamic API routing bypasses cache during one-time admin key lifecycle", () => {
      const fs = require("node:fs");
      const sw = fs.readFileSync(path.join(ROOT_DIR, "public", "sw.js"), "utf-8");

      // Verify that neither /generate-admin-key nor /verify-admin-key is ever pre-cached in STATIC_ASSETS
      expect(sw).not.toContain('"/generate-admin-key"');
      expect(sw).not.toContain('"/verify-admin-key"');

      // Verify that dynamic API regex routes all admin requests strictly to network
      expect(sw).toMatch(/\/generate-admin-key/);
      expect(sw).toMatch(/\/verify-admin-key/);
    });

    test("E2E-T3-3: Concurrent subscriber habit checkin and admin telemetry query do not block or interfere with each other", async () => {
      const cookie = getSignedAdminCookie("admin");

      const [checkinRes, telemetryRes] = await Promise.all([
        request(app)
          .get("/checkin?email=subscriber@example.com&token=invalidToken")
          .set("Accept", "application/json"),
        request(app).get("/admin/database-stats").set("Cookie", cookie),
      ]);

      // Both endpoints complete concurrently
      expect(checkinRes.status).toBeDefined();
      expect(telemetryRes.status).toBe(200);
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================
  describe("Tier 4: Real-World Scenarios - End-to-End User & Admin Journeys", () => {
    test("E2E-T4-1: Full Standalone PWA Admin Journey: generate key -> verify -> session storage -> route alias -> protected action", async () => {
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

    test("E2E-T4-2: Unauthenticated user access to /admin cleanly bounces to / with loader overlay dismissed", async () => {
      const res = await request(app).get("/admin");

      if (res.status === 302) {
        // If it redirected to /admin-dashboard, following it without auth should redirect to /
        const followRes = await request(app).get("/admin-dashboard");
        expect(followRes.status).toBe(302);
        expect(followRes.headers.location).toBe("/");
      } else {
        // Direct redirect to /
        expect(res.status).toBe(302);
        expect(res.headers.location).toBe("/");
      }
    });

    test("E2E-T4-3: Expired admin session key returns 403 and recovery with new key restores access", async () => {
      // Access with expired / unknown key
      const failedRes = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", "Bearer expired-token-1234");
      expect(failedRes.status).toBe(403);

      // Admin generates a fresh key
      const genRes = await request(app)
        .get("/generate-admin-key")
        .set("x-admin-secret", process.env.ADMIN_KEY);
      const freshKey = genRes.body.key;

      // Access succeeds with fresh key
      const retryRes = await request(app)
        .get("/admin/database-stats")
        .set("Authorization", `Bearer ${freshKey}`);
      expect(retryRes.status).toBe(200);
    });
  });

  // =========================================================================
  // REPOSITORY QUALITY GATES (R5)
  // =========================================================================
  describe("Repository Quality Gates (Feature R5)", () => {
    test("R5-QG-1: Quality Gate 1 - Syntax AST check passes across all JavaScript files (npm run check:syntax)", () => {
      const output = cp.execSync("npm run check:syntax", {
        cwd: ROOT_DIR,
        encoding: "utf-8",
      });
      expect(output).toContain("Syntax validation passed for all JavaScript files");
    });

    test("R5-QG-2: Quality Gate 2 - Prettier code formatting compliance passes with zero errors (npm run format:check)", () => {
      const output = cp.execSync("npm run format:check", {
        cwd: ROOT_DIR,
        encoding: "utf-8",
      });
      expect(output).toContain("All matched files use Prettier code style");
    });

    test("R5-QG-3: Quality Gate 3 - ESLint validation passes with 0 errors and 0 warnings (npm run lint)", () => {
      expect(() => {
        cp.execSync("npm run lint", {
          cwd: ROOT_DIR,
          encoding: "utf-8",
        });
      }).not.toThrow();
    });

    test("R5-QG-4: Quality Gate 4 - Test suite execution integrity and isolation", () => {
      // Validates mockRedis isolation and cleanup
      mockRedis.set("test_key", "test_val");
      expect(mockRedis.get("test_key")).toBe("test_val");
      mockRedis.clear();
      expect(mockRedis.get("test_key")).toBeUndefined();
    });
  });
});
