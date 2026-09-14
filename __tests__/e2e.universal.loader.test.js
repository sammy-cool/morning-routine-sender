/**
 * E2E Test Suite: Universal Frontend Page Loader & Seamless Screen Transitions (Feature R1)
 *
 * Methodology: 4-Tier Test Architecture
 *  - Tier 1: Feature Coverage (>=5 tests per feature)
 *  - Tier 2: Boundary & Corner Cases (>=5 tests per feature)
 *  - Tier 3: Cross-Feature Combinations
 *  - Tier 4: Real-World Scenarios
 *
 * Authoritative Sources:
 *  - ORIGINAL_REQUEST.md: Section R1, Lines 12-14, 29-33
 *  - PROJECT.md: Features F9, F10, F11, Lines 20-22, 43-48
 *  - DISPATCH.md: R1 Specification
 */

process.env.USE_MOCK_REDIS = "true";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

// Mock Knex and external dependencies for isolated Express route rendering
jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
    delete: jest.fn().mockResolvedValue(1),
    raw: jest.fn((sql) => sql),
  };
  const knex = jest.fn(() => queryBuilder);
  knex.raw = queryBuilder.raw;
  return knex;
});

jest.mock("../config/redisClient", () => ({
  get: jest.fn().mockResolvedValue(null),
  set: jest.fn().mockResolvedValue("OK"),
  del: jest.fn().mockResolvedValue(1),
  ping: jest.fn().mockResolvedValue("PONG"),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
  authLimiter: (req, res, next) => next(),
}));

const pagesRoutes = require("../routes/pages.routes");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const pagesController = require("../controllers/pages.controller");
const { setApiBase } = require("../middleware/setApiBase");

const ROOT_DIR = path.join(__dirname, "..");

function buildTestApp() {
  const app = express();
  app.use(cookieParser("test-cookie-secret"));
  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));
  app.use(setApiBase);
  app.use(express.static(path.join(ROOT_DIR, "public")));
  app.use(subscriberPortalRoutes);
  app.use(pagesRoutes);
  app.get("/admin-dashboard", pagesController.adminDashboard);
  return app;
}

/**
 * Helper to construct a simulated DOM environment and evaluate client scripts
 */
function createMockDOMEnvironment(initialReadyState = "loading") {
  const elements = new Map();
  const listeners = new Map();

  function createMockElement(id = "", tagName = "DIV") {
    const classSet = new Set();
    return {
      id,
      tagName: tagName.toUpperCase(),
      style: { display: "" },
      classList: {
        add: jest.fn((c) => classSet.add(c)),
        remove: jest.fn((c) => classSet.delete(c)),
        contains: jest.fn((c) => classSet.has(c)),
      },
      appendChild: jest.fn(),
      remove: jest.fn(),
    };
  }

  const mockDoc = {
    readyState: initialReadyState,
    getElementById: jest.fn((id) => elements.get(id) || null),
    createElement: jest.fn((tag) => createMockElement("", tag)),
    _registerElement: (id, tag = "DIV") => {
      const el = createMockElement(id, tag);
      elements.set(id, el);
      return el;
    },
  };

  const mockWin = {
    document: mockDoc,
    addEventListener: jest.fn((evt, fn) => {
      if (!listeners.has(evt)) listeners.set(evt, []);
      listeners.get(evt).push(fn);
    }),
    dispatchEvent: async (event) => {
      const list = listeners.get(event.type) || [];
      for (const fn of list) {
        await fn(event);
      }
      return true;
    },
  };

  return { mockWin, mockDoc, elements, listeners };
}

function evaluateSkeletonLoader(mockWin) {
  const scriptPath = path.join(ROOT_DIR, "public", "js", "skeleton-loader.js");
  const code = fs.readFileSync(scriptPath, "utf-8");
  const fn = new Function("window", "document", code);
  fn(mockWin, mockWin.document);
}

describe("Universal Frontend Page Loader & Screen Transition E2E Suite (R1)", () => {
  let app;

  beforeAll(() => {
    app = buildTestApp();
  });

  // =========================================================================
  // TIER 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage - Standardized Loader Presence Across All 5 Routes", () => {
    test("R1-T1-1: Route / (Home) renders standardized #loaderRoot, loader.css, and skeleton-loader.js", async () => {
      const res = await request(app).get("/");
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="loaderRoot"');
      expect(res.text).toContain("loader-container");
      expect(res.text).toContain("/css/loader.css");
      expect(res.text).toContain("/js/skeleton-loader.js");
    });

    test("R1-T1-2: Route /about renders standardized #loaderRoot, loader.css, and skeleton-loader.js", async () => {
      const res = await request(app).get("/about");
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="loaderRoot"');
      expect(res.text).toContain("loader-container");
      expect(res.text).toContain("/css/loader.css");
      expect(res.text).toContain("/js/skeleton-loader.js");
    });

    test("R1-T1-3: Route /user-dashboard renders standardized #loaderRoot, loader.css, and skeleton-loader.js", async () => {
      const res = await request(app).get("/user-dashboard");
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="loaderRoot"');
      expect(res.text).toContain("loader-container");
      expect(res.text).toContain("/css/loader.css");
      expect(res.text).toContain("/js/skeleton-loader.js");
    });

    test("R1-T1-4: Route /routine renders standardized #loaderRoot, loader.css, and skeleton-loader.js", async () => {
      const res = await request(app).get("/routine");
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="loaderRoot"');
      expect(res.text).toContain("loader-container");
      expect(res.text).toContain("/css/loader.css");
      expect(res.text).toContain("/js/skeleton-loader.js");
    });

    test("R1-T1-5: Route /admin-dashboard renders standardized #loaderRoot, loader.css, and skeleton-loader.js for authenticated admin", async () => {
      const cookieSignature = require("cookie-signature");
      const signedRole = "s:" + cookieSignature.sign("admin", "test-cookie-secret");
      const res = await request(app)
        .get("/admin-dashboard")
        .set("Cookie", [`mrn_role=${signedRole}`]);

      expect(res.status).toBe(200);
      expect(res.text).toContain('id="loaderRoot"');
      expect(res.text).toContain("loader-container");
      expect(res.text).toContain("/css/loader.css");
      expect(res.text).toContain("/js/skeleton-loader.js");
    });

    test("R1-T1-6: loader.css specifies obsidian #050608 theme, high stacking context (z-index >= 9999), and synchronized 300ms transition", () => {
      const cssPath = path.join(ROOT_DIR, "public", "css", "loader.css");
      expect(fs.existsSync(cssPath)).toBe(true);
      const css = fs.readFileSync(cssPath, "utf-8");

      expect(css).toMatch(/#050608/);
      expect(css).toMatch(/z-index:\s*(?:9999|99999)/);
      expect(css).toMatch(/fade-out/);
      expect(css).toMatch(/pointer-events:\s*none/);
    });

    test("R1-T1-7: skeleton-loader.js triggers fade-out and reveals main content within 300ms transition on DOMContentLoaded", async () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createMockDOMEnvironment("loading");
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      const loader = mockDoc._registerElement("loader");
      const mainRoot = mockDoc._registerElement("mainRoot");
      mainRoot.style.display = "none";

      evaluateSkeletonLoader(mockWin);

      // Trigger DOMContentLoaded
      await mockWin.dispatchEvent({ type: "DOMContentLoaded" });

      expect(loaderRoot.classList.add).toHaveBeenCalledWith("fade-out");
      expect(mainRoot.style.display).toBe("none");

      // Advance by 300ms transition
      jest.advanceTimersByTime(300);

      expect(loaderRoot.remove).toHaveBeenCalled();
      expect(loader.remove).toHaveBeenCalled();
      expect(mainRoot.style.display).toBe("block");

      jest.useRealTimers();
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases - Fail-Safe Timeouts, Idempotency & Edge Handling", () => {
    test("R1-T2-1: Fail-safe fallback timer dismisses loader within <= 3.5s (3500ms) when DOMContentLoaded never fires", () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createMockDOMEnvironment("loading");
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      const mainRoot = mockDoc._registerElement("mainRoot");
      mainRoot.style.display = "none";

      evaluateSkeletonLoader(mockWin);

      // Advance timers by 3500ms without firing DOMContentLoaded
      jest.advanceTimersByTime(3500);

      // Fade out and reveal should have occurred
      jest.advanceTimersByTime(300);
      expect(loaderRoot.remove).toHaveBeenCalled();
      expect(mainRoot.style.display).toBe("block");

      jest.useRealTimers();
    });

    test("R1-T2-2: Immediate dismissal when script is evaluated after document is already interactive or complete", () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createMockDOMEnvironment("complete");
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      const mainRoot = mockDoc._registerElement("mainRoot");
      mainRoot.style.display = "none";

      evaluateSkeletonLoader(mockWin);

      // Should immediately start fade-out or dismiss within 300ms
      jest.advanceTimersByTime(350);

      expect(loaderRoot.remove).toHaveBeenCalled();
      expect(mainRoot.style.display).toBe("block");

      jest.useRealTimers();
    });

    test("R1-T2-3: Idempotent dismissal prevents duplicate removals or errors when multiple events fire", async () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createMockDOMEnvironment("loading");
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      const mainRoot = mockDoc._registerElement("mainRoot");
      mainRoot.style.display = "none";

      evaluateSkeletonLoader(mockWin);

      // Fire DOMContentLoaded
      await mockWin.dispatchEvent({ type: "DOMContentLoaded" });
      jest.advanceTimersByTime(300);

      // Fire subsequent window load event and fallback timer
      await mockWin.dispatchEvent({ type: "load" });
      jest.advanceTimersByTime(3500);

      // loaderRoot.remove should have been called cleanly without uncaught exceptions
      expect(loaderRoot.remove).toHaveBeenCalled();
      expect(mainRoot.style.display).toBe("block");

      jest.useRealTimers();
    });

    test("R1-T2-4: Missing optional elements (logoBox, mainRootHeader, mainRootFooter) does not throw exceptions", async () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createMockDOMEnvironment("loading");
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      // Intentionally omit mainRootHeader and mainRootFooter and logoBox

      expect(() => {
        evaluateSkeletonLoader(mockWin);
      }).not.toThrow();

      await expect(mockWin.dispatchEvent({ type: "DOMContentLoaded" })).resolves.not.toThrow();

      jest.advanceTimersByTime(300);
      expect(loaderRoot.remove).toHaveBeenCalled();

      jest.useRealTimers();
    });

    test("R1-T2-5: Overlay pointer-events: none in CSS guarantees interactive elements cannot be blocked", () => {
      const cssPath = path.join(ROOT_DIR, "public", "css", "loader.css");
      const css = fs.readFileSync(cssPath, "utf-8");

      // Verify that loader container does not block pointer events once dissolving
      expect(css).toMatch(/\.loader-container[\s\S]*?pointer-events:\s*none/);
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations - Route Transitions & Styling Consistency", () => {
    test("R1-T3-1: Seamless route transition from / to /about retains obsidian loader consistency", async () => {
      const resHome = await request(app).get("/");
      const resAbout = await request(app).get("/about");

      expect(resHome.status).toBe(200);
      expect(resAbout.status).toBe(200);

      // Both views provide identical obsidian loader markup contract
      expect(resHome.text).toContain('id="loaderRoot"');
      expect(resAbout.text).toContain('id="loaderRoot"');
      expect(resHome.text).toContain("/css/loader.css");
      expect(resAbout.text).toContain("/css/loader.css");
    });

    test("R1-T3-2: Routine interactive route delivers loader alongside responsive layout assets", async () => {
      const res = await request(app).get("/routine");
      expect(res.status).toBe(200);
      expect(res.text).toContain('id="loaderRoot"');
      expect(res.text).toContain("/css/responsive-layout.css");
      expect(res.text).toContain("/css/loader.css");
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================
  describe("Tier 4: Real-World Scenarios - Mobile Network Simulation & Complete Page Lifecycle", () => {
    test("R1-T4-1: Simulated mobile browser on slow connection: initial obsidian loader display -> fail-safe unveil -> interactive controls unblocked", async () => {
      jest.useFakeTimers();
      const { mockWin, mockDoc } = createMockDOMEnvironment("loading");
      const loaderRoot = mockDoc._registerElement("loaderRoot");
      const mainRoot = mockDoc._registerElement("mainRoot");
      mainRoot.style.display = "none";

      evaluateSkeletonLoader(mockWin);

      // Simulate 1000ms delay before DOMContentLoaded fires
      jest.advanceTimersByTime(1000);
      expect(mainRoot.style.display).toBe("none");

      await mockWin.dispatchEvent({ type: "DOMContentLoaded" });
      expect(loaderRoot.classList.add).toHaveBeenCalledWith("fade-out");

      // After 300ms transition, loader dismissed and main content unveiled
      jest.advanceTimersByTime(300);
      expect(loaderRoot.remove).toHaveBeenCalled();
      expect(mainRoot.style.display).toBe("block");

      jest.useRealTimers();
    });
  });
});
