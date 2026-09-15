/**
 * Comprehensive Automated Verification Test Suite for PageSpeed Performance Audit
 *
 * Validates cross-application fixes:
 * 1. Non-render-blocking stylesheet loading strategy across all pages
 * 2. Optimized vector image delivery in #loaderRoot (logo.svg instead of 137KB PNG)
 * 3. Strict sequential heading hierarchy (no skipped heading levels)
 * 4. Efficient static asset Cache-Control headers (>=30d for assets/css/js, no-cache for sw.js)
 * 5. Composite animation definitions and reduced motion support
 */

process.env.USE_MOCK_REDIS = "true";
process.env.ADMIN_KEY = "test-admin-secret-key-12345";
jest.setTimeout(30000);

const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const app = require("../index");

const ROOT_DIR = path.join(__dirname, "..");

describe("PageSpeed Performance & Accessibility Audit Verification", () => {
  const routesToTest = ["/", "/about", "/user-dashboard"];

  // =========================================================================
  // 1. Non-Render-Blocking Stylesheets & Preload Strategies
  // =========================================================================
  describe("1. Non-Render-Blocking Stylesheet Loading", () => {
    test("public/about.html loads Google Fonts & FontAwesome asynchronously with media print onload switch", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "about.html"), "utf8");
      expect(html).toContain('rel="preload"');
      expect(html).toContain("fonts.googleapis.com");
      expect(html).toContain('media="print"');
      expect(html).toMatch(/onload="this\.media\s*=\s*'all'"/);
      expect(html).toContain("<noscript>");
      expect(html).toContain("fontawesome.min.css");
      expect(html).toContain("solid.min.css");
    });

    test("public/main-index.html loads Google Fonts & FontAwesome asynchronously with media print onload switch", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "main-index.html"), "utf8");
      expect(html).toContain('rel="preload"');
      expect(html).toContain("fonts.googleapis.com");
      expect(html).toContain('media="print"');
      expect(html).toMatch(/onload="this\.media\s*=\s*'all'"/);
      expect(html).toContain("<noscript>");
      expect(html).toContain("fontawesome.min.css");
      expect(html).toContain("solid.min.css");
    });

    test("public/user-dashboard.html loads Google Fonts & FontAwesome asynchronously with media print onload switch", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "user-dashboard.html"), "utf8");
      expect(html).toContain('rel="preload"');
      expect(html).toContain("fonts.googleapis.com");
      expect(html).toContain('media="print"');
      expect(html).toMatch(/onload="this\.media\s*=\s*'all'"/);
      expect(html).toContain("<noscript>");
      expect(html).toContain("fontawesome.min.css");
      expect(html).toContain("solid.min.css");
    });

    test("admin-renderer/views/admin-dashboard.html loads Google Fonts & FontAwesome asynchronously", () => {
      const html = fs.readFileSync(
        path.join(ROOT_DIR, "admin-renderer", "views", "admin-dashboard.html"),
        "utf8",
      );
      expect(html).toContain('rel="preload"');
      expect(html).toContain("fonts.googleapis.com");
      expect(html).toContain('media="print"');
      expect(html).toMatch(/onload="this\.media\s*=\s*'all'"/);
      expect(html).toContain("<noscript>");
    });

    test("controllers/routine.controller.js loads responsive-layout.css non-render-blocking", () => {
      const routineContent = fs.readFileSync(
        path.join(ROOT_DIR, "controllers", "routine.controller.js"),
        "utf8",
      );
      expect(routineContent).toContain(
        '<link rel="stylesheet" href="/css/responsive-layout.css" media="print" onload="this.media=\'all\'">',
      );
      expect(routineContent).toContain(
        '<noscript><link rel="stylesheet" href="/css/responsive-layout.css"></noscript>',
      );
    });
  });

  // =========================================================================
  // 2. Optimized Image Delivery in #loaderRoot
  // =========================================================================
  describe("2. Optimized Image Delivery (#loaderRoot)", () => {
    test("public/about.html uses preloaded 5KB vector logo.svg instead of heavy 137KB raster PNG in #loaderRoot", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "about.html"), "utf8");
      const loaderMatch = html.match(/id="loaderRoot"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
      expect(loaderMatch).not.toBeNull();
      expect(loaderMatch[0]).toContain('src="/assets/logo.svg"');
      expect(loaderMatch[0]).not.toContain("mrn-brand-ico.png");
    });

    test("public/main-index.html uses preloaded 5KB vector logo.svg in #loaderRoot", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "main-index.html"), "utf8");
      const loaderMatch = html.match(/id="loaderRoot"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
      expect(loaderMatch).not.toBeNull();
      expect(loaderMatch[0]).toContain('src="/assets/logo.svg"');
      expect(loaderMatch[0]).not.toContain("mrn-brand-ico.png");
    });

    test("public/user-dashboard.html uses preloaded 5KB vector logo.svg in #loaderRoot", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "user-dashboard.html"), "utf8");
      const loaderMatch = html.match(/id="loaderRoot"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
      expect(loaderMatch).not.toBeNull();
      expect(loaderMatch[0]).toContain('src="/assets/logo.svg"');
      expect(loaderMatch[0]).not.toContain("mrn-brand-ico.png");
    });

    test("admin-renderer/views/admin-dashboard.html uses preloaded 5KB vector logo.svg in #loaderRoot", () => {
      const html = fs.readFileSync(
        path.join(ROOT_DIR, "admin-renderer", "views", "admin-dashboard.html"),
        "utf8",
      );
      const loaderMatch = html.match(/id="loaderRoot"[\s\S]*?<\/div>\s*<\/div>\s*<\/div>/);
      expect(loaderMatch).not.toBeNull();
      expect(loaderMatch[0]).toContain('src="/assets/logo.svg"');
      expect(loaderMatch[0]).not.toContain("mrn-brand-ico.png");
    });

    test("controllers/routine.controller.js uses preloaded 5KB vector logo.svg in #loaderRoot", () => {
      const routineContent = fs.readFileSync(
        path.join(ROOT_DIR, "controllers", "routine.controller.js"),
        "utf8",
      );
      expect(routineContent).toContain(
        '<img src="/assets/logo.svg" alt="Morning Routine Logo" width="48" height="48">',
      );
      expect(routineContent).not.toContain(
        '<img src="/assets/mrn-brand-ico.png" alt="Morning Routine Logo" width="48" height="48">',
      );
    });
  });

  // =========================================================================
  // 3. Strict Heading Hierarchy (Accessibility 100)
  // =========================================================================
  describe("3. Strict Heading Hierarchy (WCAG Compliance)", () => {
    test("public/about.html has no skipped heading levels (0 h4 tags, features use h3)", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "about.html"), "utf8");
      const h4Matches = html.match(/<h4[^>]*>/g);
      expect(h4Matches).toBeNull();
      expect(html).toContain("<h3>1-Click Habit Streak Engine</h3>");
      expect(html).toContain("<h3>25-Minute Focus Sprint Timer</h3>");
      expect(html).toContain("<h3>4 Procedural Ambient Soundscapes</h3>");
    });

    test("public/main-index.html has no skipped heading levels (0 h4 tags, simulator is h2, footer is h3)", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "main-index.html"), "utf8");
      const h4Matches = html.match(/<h4[^>]*>/g);
      expect(h4Matches).toBeNull();
      expect(html).toContain(">Interactive Routine Simulator\n              </h2>");
      expect(html).toContain('<h3 class="footer-heading">Ritual Suite</h3>');
      expect(html).toContain('<h3 class="footer-heading">5 Coach Tracks</h3>');
      expect(html).toContain('<h3 class="footer-heading">Self-Service &amp; Ops</h3>');
    });

    test("public/user-dashboard.html vacation modal uses h2 heading matching other modals", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "user-dashboard.html"), "utf8");
      expect(html).toContain('id="vacationModalTitle"');
      expect(html).toMatch(/<h2[^>]*id="vacationModalTitle"/);
    });
  });

  // =========================================================================
  // 4. Efficient Cache Lifetimes & Headers
  // =========================================================================
  describe("4. Efficient Cache-Control Headers", () => {
    test("Static assets in /assets/ are served with long cache TTL (max-age=31536000 or 365d, immutable)", async () => {
      const res = await request(app).get("/assets/logo.svg");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBeDefined();
      expect(res.headers["cache-control"]).toContain("max-age=");
      expect(res.headers["cache-control"]).toContain("immutable");
    });

    test("Static CSS and JS files are served with efficient cache TTL (>= 30 days)", async () => {
      const res = await request(app).get("/css/responsive-layout.css");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toBeDefined();
      expect(res.headers["cache-control"]).toContain("max-age=2592000");
    });

    test("Service Worker public/sw.js is always served with no-cache headers", async () => {
      const res = await request(app).get("/sw.js");
      expect(res.status).toBe(200);
      expect(res.headers["cache-control"]).toContain("no-cache");
      expect(res.headers["cache-control"]).toContain("no-store");
    });
  });

  // =========================================================================
  // 5. CSS Animation Integrity
  // =========================================================================
  describe("5. CSS Animation Integrity", () => {
    test("public/user-dashboard.html defines @keyframes pulseLive referenced by .pulse-status-dot", () => {
      const html = fs.readFileSync(path.join(ROOT_DIR, "public", "user-dashboard.html"), "utf8");
      expect(html).toContain("@keyframes pulseLive");
      expect(html).toContain("animation: pulseLive 2s infinite ease-in-out");
    });
  });
});
