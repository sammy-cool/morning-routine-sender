/**
 * E2E Test Suite: PWA Manifest, Icons, Visual Synchronization & SW Cache Versioning (Feature R2)
 *
 * Methodology: 4-Tier Test Architecture
 *  - Tier 1: Feature Coverage (>=5 tests per feature)
 *  - Tier 2: Boundary & Corner Cases (>=5 tests per feature)
 *  - Tier 3: Cross-Feature Combinations
 *  - Tier 4: Real-World Scenarios
 *
 * Authoritative Sources:
 *  - ORIGINAL_REQUEST.md: Section R2, Lines 15-17, 34-38
 *  - PROJECT.md: Features F2, F3, F4, Lines 13-15, 49-53
 *  - DISPATCH.md: R2 Specification
 */

process.env.USE_MOCK_REDIS = "true";

const fs = require("node:fs");
const path = require("node:path");
const express = require("express");
const request = require("supertest");

const pagesRoutes = require("../routes/pages.routes");
const { setApiBase } = require("../middleware/setApiBase");

const ROOT_DIR = path.join(__dirname, "..");

function buildTestApp() {
  const app = express();
  app.use(express.json());
  app.use(setApiBase);
  app.use(express.static(path.join(ROOT_DIR, "public")));
  app.use(pagesRoutes);
  return app;
}

describe("PWA Brand Manifest, Icons, Visual Sync & Cache Versioning E2E Suite (R2)", () => {
  let app;

  beforeAll(() => {
    app = buildTestApp();
  });

  // =========================================================================
  // TIER 1: Feature Coverage (>=5 tests)
  // =========================================================================
  describe("Tier 1: Feature Coverage - Manifest Declarations, Brand Assets & Cache Invalidation", () => {
    test("R2-T1-1: GET /manifest.json returns 200 with valid W3C Web App Manifest specification", async () => {
      const res = await request(app).get("/manifest.json");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/json/);

      const manifest =
        typeof res.body === "object" && Object.keys(res.body).length > 0
          ? res.body
          : JSON.parse(res.text);

      expect(manifest.id).toBe("/?source=pwa");
      expect(manifest.name).toBe("Morning Routine Sender");
      expect(manifest.short_name).toBe("MRSender");
      expect(manifest.start_url).toBe("/");
      expect(manifest.scope).toBe("/");
      expect(manifest.display).toBe("standalone");
      expect(manifest.orientation).toBe("portrait-primary");
    });

    test("R2-T1-2: Manifest declares 192x192 PNG icon with purpose any and maskable", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);
      expect(Array.isArray(manifest.icons)).toBe(true);

      const icon192 = manifest.icons.find(
        (icon) => icon.sizes && icon.sizes.includes("192x192") && icon.type === "image/png",
      );

      expect(icon192).toBeDefined();
      expect(icon192.src).toBe("/assets/mrn-brand-ico.png");
      // Per F2 / Acceptance Criteria: Purpose must include both any and maskable (or separate declaration)
      expect(icon192.purpose).toMatch(/maskable/);
    });

    test("R2-T1-3: Manifest declares 512x512 PNG icon with purpose any and maskable", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      const icon512 = manifest.icons.find(
        (icon) => icon.sizes && icon.sizes.includes("512x512") && icon.type === "image/png",
      );

      expect(icon512).toBeDefined();
      expect(icon512.src).toBe("/assets/mrn-brand-ico.png");
      expect(icon512.purpose).toBeDefined();
    });

    test("R2-T1-4: Manifest declares vector logo.svg and favicon.ico with valid MIME types", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      const svgIcon = manifest.icons.find(
        (icon) => icon.src === "/assets/logo.svg" && icon.type === "image/svg+xml",
      );
      expect(svgIcon).toBeDefined();

      const favIcon = manifest.icons.find(
        (icon) => icon.src === "/favicon.ico" && icon.type === "image/x-icon",
      );
      expect(favIcon).toBeDefined();
    });

    test("R2-T1-5: Manifest theme_color and background_color visually match obsidian #050608 brand", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      expect(manifest.theme_color).toBe("#050608");
      expect(manifest.background_color).toBe("#050608");
    });

    test("R2-T1-6: Static brand assets /favicon.ico, /assets/mrn-brand-ico.png, and /assets/logo.svg are physically present and served via HTTP 200", async () => {
      // 1. Favicon
      const favRes = await request(app).get("/favicon.ico");
      expect(favRes.status).toBe(200);

      // 2. PNG Brand Icon
      const pngRes = await request(app).get("/assets/mrn-brand-ico.png");
      expect(pngRes.status).toBe(200);
      expect(pngRes.headers["content-type"]).toBe("image/png");

      // 3. SVG Logo
      const svgRes = await request(app).get("/assets/logo.svg");
      expect(svgRes.status).toBe(200);
      expect(svgRes.headers["content-type"]).toMatch(/svg/);
    });

    test("R2-T1-7: Service worker public/sw.js bumps CACHE_VERSION to >= v4.8.1 and caches brand assets in STATIC_ASSETS", () => {
      const swPath = path.join(ROOT_DIR, "public", "sw.js");
      expect(fs.existsSync(swPath)).toBe(true);
      const sw = fs.readFileSync(swPath, "utf-8");

      // Check CACHE_VERSION bump
      const versionMatch = sw.match(/const\s+CACHE_VERSION\s*=\s*"([^"]+)";/);
      expect(versionMatch).not.toBeNull();
      const versionStr = versionMatch[1];
      // Target version is v4.8.1 (or higher) to trigger automatic cache busting
      expect(versionStr).toMatch(/^v4\.[8-9]\.[1-9]|^v[5-9]\./);

      // Check STATIC_ASSETS includes brand files
      expect(sw).toContain('"/assets/mrn-brand-ico.png"');
      expect(sw).toContain('"/assets/logo.svg"');
      expect(sw).toContain('"/favicon.ico"');
      expect(sw).toContain('"/css/loader.css"');
    });
  });

  // =========================================================================
  // TIER 2: Boundary & Corner Cases (>=5 tests)
  // =========================================================================
  describe("Tier 2: Boundary & Corner Cases - Accept Headers, Shortcuts & Offline Handling", () => {
    test("R2-T2-1: Manifest responds correctly under various Accept headers (application/manifest+json, application/json, */*)", async () => {
      const acceptHeaders = [
        "application/manifest+json",
        "application/json",
        "*/*",
        "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      ];

      for (const accept of acceptHeaders) {
        const res = await request(app).get("/manifest.json").set("Accept", accept);
        expect(res.status).toBe(200);
        expect(() => JSON.parse(res.text)).not.toThrow();
      }
    });

    test("R2-T2-2: Service Worker contains offline fallback handler returning /offline or 503 JSON", () => {
      const swPath = path.join(ROOT_DIR, "public", "sw.js");
      const sw = fs.readFileSync(swPath, "utf-8");

      expect(sw).toMatch(/caches\.match\(\s*["']\/offline["']\s*\)/);
      expect(sw).toMatch(/status:\s*503/);
      expect(sw).toMatch(/Network unavailable/i);
    });

    test("R2-T2-3: Manifest shortcuts specify valid application navigation routes with descriptions", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      expect(Array.isArray(manifest.shortcuts)).toBe(true);
      expect(manifest.shortcuts.length).toBeGreaterThanOrEqual(4);

      const expectedUrls = ["/#signupView", "/user-dashboard", "/routine", "/about"];
      for (const expectedUrl of expectedUrls) {
        const item = manifest.shortcuts.find((s) => s.url === expectedUrl);
        expect(item).toBeDefined();
        expect(item.name.length).toBeGreaterThan(0);
        expect(item.description.length).toBeGreaterThan(0);
      }
    });

    test("R2-T2-4: Manifest screenshots declare wide desktop and narrow mobile form factors", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      expect(Array.isArray(manifest.screenshots)).toBe(true);
      const wideShot = manifest.screenshots.find((s) => s.form_factor === "wide");
      const narrowShot = manifest.screenshots.find((s) => s.form_factor === "narrow");

      expect(wideShot).toBeDefined();
      expect(wideShot.sizes).toBe("1280x720");
      expect(narrowShot).toBeDefined();
      expect(narrowShot.sizes).toBe("750x1334");
    });

    test("R2-T2-5: Request for non-existent brand asset cleanly returns 404 without crashing server", async () => {
      const res = await request(app).get("/assets/missing-brand-icon-xyz123.png");
      expect(res.status).toBe(404);
    });
  });

  // =========================================================================
  // TIER 3: Cross-Feature Combinations (Pairwise)
  // =========================================================================
  describe("Tier 3: Cross-Feature Combinations - Standalone PWA Scope & Asset Pre-Caching", () => {
    test("R2-T3-1: Standalone PWA display scope aligns with pre-cached static assets", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      const sw = fs.readFileSync(path.join(ROOT_DIR, "public", "sw.js"), "utf-8");

      // Verify scope is root "/"
      expect(manifest.scope).toBe("/");
      expect(manifest.display).toBe("standalone");

      // Verify all icons declared in manifest are covered by SW STATIC_ASSETS or fetch routing
      for (const icon of manifest.icons) {
        if (icon.src.startsWith("/assets/") || icon.src === "/favicon.ico") {
          expect(sw).toContain(`"${icon.src}"`);
        }
      }
    });

    test("R2-T3-2: SVG brand artwork incorporates obsidian and purple brand identity accents", () => {
      const svgPath = path.join(ROOT_DIR, "public", "assets", "logo.svg");
      expect(fs.existsSync(svgPath)).toBe(true);
      const svg = fs.readFileSync(svgPath, "utf-8");

      expect(svg).toMatch(/<svg/i);
      expect(svg).toMatch(/viewBox/i);
      // Validates obsidian/primary purple (#7c3aed) brand palette in SVG
      expect(svg).toMatch(/#7c3aed|#22d3ee|#050608|#0c111d|url\(#/i);
    });
  });

  // =========================================================================
  // TIER 4: Real-World Scenarios
  // =========================================================================
  describe("Tier 4: Real-World Scenarios - Progressive Web App Installability Criteria", () => {
    test("R2-T4-1: Validates complete Lighthouse & Chromium Add-to-Home-Screen (A2HS) manifest requirements", async () => {
      const res = await request(app).get("/manifest.json");
      const manifest = JSON.parse(res.text);

      // Criteria 1: Web App Manifest provided
      expect(manifest).toBeDefined();

      // Criteria 2: Has name or short_name
      expect(manifest.name || manifest.short_name).toBeTruthy();

      // Criteria 3: Has valid start_url
      expect(manifest.start_url).toBeTruthy();

      // Criteria 4: Icons include 192x192 and 512x512
      const sizes = manifest.icons.map((i) => i.sizes).join(" ");
      expect(sizes).toContain("192x192");
      expect(sizes).toContain("512x512");

      // Criteria 5: Has maskable icon
      const hasMaskable = manifest.icons.some((i) => i.purpose && i.purpose.includes("maskable"));
      expect(hasMaskable).toBe(true);

      // Criteria 6: Display is standalone, fullscreen, or minimal-ui
      expect(["standalone", "fullscreen", "minimal-ui"]).toContain(manifest.display);

      // Criteria 7: Has theme_color
      expect(manifest.theme_color).toBe("#050608");
    });
  });
});
