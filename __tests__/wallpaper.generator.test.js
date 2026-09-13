const request = require("supertest");
const express = require("express");
const {
  escapeXml,
  wrapText,
  getMilestoneTier,
  generateWallpaperSvg,
} = require("../helper/wallpaperGenerator");
const wallpaperController = require("../controllers/wallpaper.controller");
const wallpaperRoutes = require("../routes/wallpaper.routes");

describe("Dynamic 9:16 Mobile Wallpaper Generator & Controller", () => {
  describe("helper/wallpaperGenerator.js unit tests", () => {
    test("wrapText splits quotes cleanly within character limits", () => {
      const text =
        "Deep work is the ability to focus without distraction on a cognitively demanding task.";
      const lines = wrapText(text, 30);
      expect(lines.length).toBeGreaterThan(1);
      lines.forEach((l) => expect(l.length).toBeLessThanOrEqual(35));
    });

    test("wrapText handles empty or invalid strings safely", () => {
      expect(wrapText("")).toEqual([]);
      expect(wrapText(null)).toEqual([]);
      expect(wrapText(undefined)).toEqual([]);
    });

    test("escapeXml handles special characters properly", () => {
      expect(escapeXml('foo & "bar" <baz>')).toBe("foo &amp; &quot;bar&quot; &lt;baz&gt;");
    });

    test("getMilestoneTier escalates milestone ranks across streak counts", () => {
      expect(getMilestoneTier(1).rank).toBe("TIER I");
      expect(getMilestoneTier(3).rank).toBe("TIER II");
      expect(getMilestoneTier(7).rank).toBe("TIER III");
      expect(getMilestoneTier(14).rank).toBe("TIER IV");
      expect(getMilestoneTier(30).rank).toBe("TIER V");
      expect(getMilestoneTier(60).rank).toBe("TIER VI");
      expect(getMilestoneTier(100).rank).toBe("TIER VII");
    });

    test("generateWallpaperSvg produces standalone standards-compliant 1080x1920 SVG", () => {
      const svg = generateWallpaperSvg({
        name: "alex",
        streak: 14,
        track: "deep-work",
        weatherSpark: "24°C • Clear Skies in New Delhi",
        quote: "Simplicity is prerequisite for reliability.",
        author: "Edsger W. Dijkstra",
        habits: [
          "Hydrate with 500ml cold water",
          "Deep Work 90-min Sprint",
          "Stoic Evening Reflection",
        ],
        lifetimeCheckins: 42,
      });

      // Verification of dimensions & SVG headers
      expect(svg).toContain('<svg width="1080" height="1920" viewBox="0 0 1080 1920"');
      expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');

      // Section 1: Header checks
      expect(svg).toContain("MORNING ROUTINE SENDER");
      expect(svg).toContain("@alex");
      expect(svg).toContain("24°C • Clear Skies in New Delhi");

      // Section 2: Center Hero checks
      expect(svg).toContain("DEEP WORK &amp; BUILDER");
      expect(svg).toContain("Simplicity is prerequisite for");
      expect(svg).toContain("reliability.");
      expect(svg).toContain("Edsger W. Dijkstra");

      // Section 3: Habit Checklist checks
      expect(svg).toContain("TODAY&apos;S HABIT CHECKLIST");
      expect(svg).toContain("Hydrate with 500ml cold water");
      expect(svg).toContain("Deep Work 90-min Sprint");
      expect(svg).toContain("Stoic Evening Reflection");

      // Section 4: Bottom Stats checks
      expect(svg).toContain("🔥 14 DAYS");
      expect(svg).toContain("⚡ 42");
      expect(svg).toContain("Iron Consistency");
      expect(svg).toContain("TIER IV");

      // Section 5: Footer Watermark checks
      expect(svg).toContain("1080 × 1920 LOCKSCREEN HD");
      expect(svg).toContain("</svg>");
    });

    test("generateWallpaperSvg falls back gracefully when options are missing or partial", () => {
      const svg = generateWallpaperSvg({});
      expect(svg).toContain('<svg width="1080" height="1920"');
      expect(svg).toContain("Morning Builder");
      expect(svg).toContain("🔥 7 DAYS");
      expect(svg).toContain("</svg>");

      const customSvg = generateWallpaperSvg({ streak: 1 });
      expect(customSvg).toContain("🔥 1 DAYS");
    });
  });

  describe("controllers/wallpaper.controller.js and routes", () => {
    let app;

    beforeAll(() => {
      app = express();
      app.use(express.json());
      app.use((req, _res, next) => {
        // Mock subscriber session for /me routes
        req.subscriberEmail = "builder@example.com";
        next();
      });
      app.use(wallpaperRoutes);
    });

    test("GET /wallpaper/:handleOrEmail returns 200 with SVG content-type", async () => {
      const res = await request(app).get("/wallpaper/@testuser?streak=5&track=mindfulness");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/svg+xml");
      const text = res.text || (res.body ? res.body.toString("utf8") : "");
      expect(text).toContain('<svg width="1080" height="1920"');
      expect(text).toContain("@testuser");
    });

    test("GET /wallpaper supports download header query param", async () => {
      const res = await request(app).get("/wallpaper/alex?download=1");
      expect(res.status).toBe(200);
      expect(res.headers["content-disposition"]).toContain("attachment");
    });

    test("GET /me/wallpaper returns wallpaper for authenticated subscriber", async () => {
      const res = await request(app).get("/me/wallpaper");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("image/svg+xml");
      const text = res.text || (res.body ? res.body.toString("utf8") : "");
      expect(text).toContain("builder");
    });

    test("resolveEmailFromToken handles invalid token gracefully", async () => {
      const res = await request(app).get("/api/wallpaper/invalid-token-xyz");
      expect(res.status).toBe(401);
      const text = res.text || (res.body ? res.body.toString("utf8") : "");
      expect(text).toContain("Invalid or Expired Wallpaper Token");
    });

    test("GET /s/:handle returns 200 with HTML, OpenGraph tags, and action buttons", async () => {
      const res = await request(app).get("/s/alex");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");

      // User handle, flame, and track badge
      expect(res.text).toContain("@alex");
      expect(res.text).toContain("🔥");
      expect(res.text).toContain("Deep Work &amp; Builder");

      // OpenGraph tags
      expect(res.text).toContain('property="og:title"');
      expect(res.text).toContain("@alex's Morning Momentum");
      expect(res.text).toContain('property="og:description"');
      expect(res.text).toContain(
        "Check out @alex's unbroken morning streak and routine on Morning Routine Sender!",
      );
      expect(res.text).toContain('property="og:image"');
      expect(res.text).toContain("/wallpaper/alex.svg");

      // Twitter Card tags
      expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
      expect(res.text).toContain('name="twitter:image"');
      expect(res.text).toContain("/wallpaper/alex.svg");

      // Action buttons
      expect(res.text).toContain("📱 Download Lockscreen Wallpaper");
      expect(res.text).toContain("/wallpaper/alex?download=1");
      expect(res.text).toContain("⚡ Start Your Own Morning Routine");
      expect(res.text).toContain("⚔️ Challenge to Morning Duel");
      expect(res.text).toContain('href="/"');
    });

    test("GET /s/:handle supports @handle and GET /share/:handle alias", async () => {
      const resAt = await request(app).get("/s/@alex?streak=14&track=mindfulness");
      expect(resAt.status).toBe(200);
      expect(resAt.text).toContain("@alex");
      expect(resAt.text).toContain("14 Day Streak");
      expect(resAt.text).toContain("Mindfulness &amp; Stoic");
      expect(resAt.text).toContain("/wallpaper/alex.svg");

      const resShare = await request(app).get("/share/alex");
      expect(resShare.status).toBe(200);
      expect(resShare.headers["content-type"]).toContain("text/html");
      expect(resShare.text).toContain("@alex's Morning Momentum");
    });

    test("renderSocialShareCard is exported from wallpaper.controller.js", () => {
      expect(typeof wallpaperController.renderSocialShareCard).toBe("function");
    });
  });
});
