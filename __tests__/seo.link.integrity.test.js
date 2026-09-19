const fs = require("node:fs");
const path = require("node:path");
const request = require("supertest");
const express = require("express");
const { setApiBase } = require("../middleware/setApiBase");

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    select: jest.fn().mockReturnThis(),
    limit: jest.fn().mockResolvedValue([]),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
  };
  return jest.fn(() => queryBuilder);
});

jest.mock("../helper/shared-data", () => {
  const actual = jest.requireActual("../helper/shared-data");
  return {
    ...actual,
    getUserByEmail: jest.fn().mockResolvedValue(null),
  };
});

const pagesRoutes = require("../routes/pages.routes");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const pagesController = require("../controllers/pages.controller");

describe("🔍 SEO, Social Metadata, Discovery & Link Integrity Suite", () => {
  let app;
  const ROOT = path.join(__dirname, "..");

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(setApiBase);
    app.use(pagesRoutes);
    app.use(subscriberPortalRoutes);
    app.use(pagesController.notFound);
  });

  describe("1. Static Asset File Integrity", () => {
    const requiredFiles = [
      "public/assets/logo.svg",
      "public/assets/logo.png",
      "public/assets/logo-email.png",
      "public/assets/mrn-brand-ico.png",
      "public/assets/screenshot-desktop.png",
      "public/assets/screenshot-mobile.png",
      "public/404.html",
      "public/favicon.ico",
      "public/manifest.json",
      "public/robots.txt",
      "public/sitemap.xml",
      "public/llms.txt",
      "public/llms-full.txt",
      "public/css/loader.css",
      "public/css/responsive-layout.css",
      "public/js/landing-page-modal.js",
      "public/js/subscriber-login.js",
      "public/js/subscriber-signup.js",
      "public/js/pwa-install.js",
      "public/js/offline-sync.js",
      "public/js/app-badging.js",
      "public/js/ux-core.js",
      "public/js/user-dashboard.js",
      "public/vendor/fontawesome/css/all.min.css",
      "public/vendor/js/chart.umd.min.js",
    ];

    test.each(requiredFiles)("Asset exists on disk and has content: %s", (relPath) => {
      const fullPath = path.join(ROOT, relPath);
      expect(fs.existsSync(fullPath)).toBe(true);
      expect(fs.statSync(fullPath).size).toBeGreaterThan(0);
    });
  });

  describe("2. Meta Tags & Social Sharing Verification", () => {
    test("Landing page (GET /) has complete SEO and OG meta tags", async () => {
      const res = await request(app).get("/").set("Host", "routine.example.com");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("__DOMAIN__");
      expect(res.text).toContain("<title>Morning Routine Sender");
      expect(res.text).toContain('name="description"');
      expect(res.text).toContain('name="keywords"');
      expect(res.text).toContain('name="robots"');
      expect(res.text).toContain('name="theme-color"');
      expect(res.text).toContain('property="og:title"');
      expect(res.text).toContain('property="og:image"');
      expect(res.text).toMatch(/property="og:url" content="https?:\/\/[^"]+\/"/);
      expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
    });

    test("About page (GET /about) has complete SEO, OG, and valid JSON-LD graph", async () => {
      const res = await request(app).get("/about").set("Host", "routine.example.com");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("__DOMAIN__");
      expect(res.text).toContain("<title>About Morning Routine Sender");
      expect(res.text).toContain('property="og:title"');
      expect(res.text).toContain('property="og:image"');

      // Verify JSON-LD parse
      const match = res.text.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
      expect(match).not.toBeNull();
      const parsed = JSON.parse(match[1]);
      expect(parsed["@graph"]).toBeDefined();
      expect(parsed["@graph"].length).toBeGreaterThanOrEqual(3);
    });

    test("Live routine companion (GET /routine) has canonical and social tags", async () => {
      const res = await request(app).get("/routine").set("Host", "routine.example.com");
      expect(res.status).toBe(200);
      expect(res.text).toContain("<title>Today's Morning Routine");
      expect(res.text).toContain('name="robots" content="index, follow"');
      expect(res.text).toContain('link rel="canonical"');
      expect(res.text).toContain('property="og:title"');
    });

    test("Streak share page (GET /streak/:handle) has dynamic OG and Twitter metadata", async () => {
      const res = await request(app).get("/streak/alex").set("Host", "routine.example.com");
      expect(res.status).toBe(200);
      expect(res.text).toContain('property="og:title"');
      expect(res.text).toContain('property="og:image"');
      expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
    });
  });

  describe("3. Crawling & LLM Discovery Assets", () => {
    test("GET /robots.txt disallows private routes and permits LLM agents", async () => {
      const res = await request(app).get("/robots.txt").set("Host", "routine.example.com");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("__DOMAIN__");
      expect(res.text).toContain("Disallow: /admin");
      expect(res.text).toContain("Disallow: /user-dashboard");
      expect(res.text).toContain("User-agent: GPTBot");
      expect(res.text).toMatch(/Sitemap: https?:\/\/[^/]+\/sitemap\.xml/);
    });

    test("GET /sitemap.xml returns valid XML without __DOMAIN__", async () => {
      const res = await request(app).get("/sitemap.xml").set("Host", "routine.example.com");
      expect(res.status).toBe(200);
      expect(res.text).not.toContain("__DOMAIN__");
      expect(res.text).toContain("<urlset");
      expect(res.text).toMatch(/<loc>https?:\/\/[^/]+\/<\/loc>/);
      expect(res.text).toMatch(/<loc>https?:\/\/[^/]+\/about<\/loc>/);
      expect(res.text).toMatch(/<loc>https?:\/\/[^/]+\/routine<\/loc>/);
    });

    test("GET /llms.txt and /.well-known/llms.txt return markdown context", async () => {
      const res1 = await request(app).get("/llms.txt").set("Host", "routine.example.com");
      const res2 = await request(app)
        .get("/.well-known/llms.txt")
        .set("Host", "routine.example.com");
      expect(res1.status).toBe(200);
      expect(res2.status).toBe(200);
      expect(res1.headers["content-type"]).toContain("text/markdown");
      expect(res1.text).not.toContain("__DOMAIN__");
      expect(res1.text).toContain("# Morning Routine Sender");
    });

    test("GET /manifest.json returns valid web app manifest", async () => {
      const res = await request(app).get("/manifest.json");
      expect(res.status).toBe(200);
      expect(res.body.name).toBe("Morning Routine Sender");
      expect(res.body.icons).toBeDefined();
      expect(res.body.icons.length).toBeGreaterThan(0);
    });
  });

  describe("4. 404 Error Routing & SEO Protection", () => {
    test("GET /404 returns HTTP 404, noindex headers, and obsidian glassmorphism page", async () => {
      const res = await request(app).get("/404").set("Host", "routine.example.com");
      expect(res.status).toBe(404);
      expect(res.headers["x-robots-tag"]).toBe("noindex, follow");
      expect(res.text).not.toContain("__DOMAIN__");
      expect(res.text).toContain("<title>404 • Page Not Found | Morning Routine Sender</title>");
      expect(res.text).toContain('name="robots" content="noindex, follow"');
      expect(res.text).toContain("Ritual Not Found");
      expect(res.text).toContain("Return to Main Flow");
    });

    test("GET non-existent page returns HTTP 404 with HTML and noindex directive", async () => {
      const res = await request(app)
        .get("/non-existent-subpage-abc-123")
        .set("Host", "routine.example.com")
        .set("Accept", "text/html,application/xhtml+xml");
      expect(res.status).toBe(404);
      expect(res.headers["x-robots-tag"]).toBe("noindex, follow");
      expect(res.text).toContain("Ritual Not Found");
      expect(res.text).not.toContain("__DOMAIN__");
    });

    test("GET non-existent API route returns JSON with HTTP 404", async () => {
      const res = await request(app)
        .get("/api/unknown-service-endpoint")
        .set("Host", "routine.example.com");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Not found");
    });
  });
});
