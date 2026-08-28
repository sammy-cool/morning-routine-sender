const {
  health,
  robots,
  sitemap,
  llmsTxt,
  llmsFullTxt,
  about,
} = require("../controllers/pages.controller");

describe("pages.controller endpoints", () => {
  test("health responds with status ok and a timestamp", async () => {
    const req = {};
    const res = { json: jest.fn() };

    await health(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];

    expect(payload.status).toBe("ok");
    expect(payload.mode).toBe("auto-scheduling-enabled");
    expect(() => new Date(payload.timestamp).toISOString()).not.toThrow();
  });

  test("deep health check returns status and checks object", async () => {
    const req = { query: { deep: "true" } };
    const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

    await health(req, res);

    expect(res.json).toHaveBeenCalledTimes(1);
    const payload = res.json.mock.calls[0][0];
    expect(payload.checks).toBeDefined();
    expect(payload.checks.database).toBeDefined();
    expect(payload.checks.redis).toBeDefined();
  });

  test("robots responds with valid robots.txt directives and domain replacement", () => {
    const req = { protocol: "https", get: () => "routine.example.com" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    robots(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "text/plain; charset=utf-8");
    expect(res.send).toHaveBeenCalledTimes(1);
    const text = res.send.mock.calls[0][0];
    expect(text).toContain("User-agent: *");
    expect(text).toContain("Allow: /css/");
    expect(text).toContain("Sitemap: https://routine.example.com/sitemap.xml");
  });

  test("sitemap responds with XML and replaced domain", () => {
    const req = { protocol: "https", get: () => "routine.example.com" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    sitemap(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "application/xml; charset=utf-8");
    expect(res.send).toHaveBeenCalledTimes(1);
    const xml = res.send.mock.calls[0][0];
    expect(xml).toContain("https://routine.example.com/");
    expect(xml).toContain("<urlset");
  });

  test("llmsTxt responds with markdown AI context", () => {
    const req = { protocol: "https", get: () => "routine.example.com" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    llmsTxt(req, res);

    expect(res.set).toHaveBeenCalledWith("Content-Type", "text/markdown; charset=utf-8");
    expect(res.send).toHaveBeenCalledTimes(1);
    const md = res.send.mock.calls[0][0];
    expect(md).toContain("# Morning Routine Sender");
    expect(md).toContain("https://routine.example.com/");
  });

  test("about responds with rendered HTML containing creator profile and replaced domain", () => {
    const req = { protocol: "https", get: () => "routine.example.com", ip: "127.0.0.1" };
    const res = {
      set: jest.fn(),
      locals: { apiBase: "https://routine.example.com" },
      send: jest.fn(),
    };

    about(req, res);

    expect(res.set).toHaveBeenCalledWith("Cache-Control", "no-cache, no-store, must-revalidate");
    expect(res.send).toHaveBeenCalledTimes(1);
    const html = res.send.mock.calls[0][0];
    expect(html).toContain("Priyanshu Patel");
    expect(html).toContain("priyanshu.alt191@gmail.com");
    expect(html).toContain("https://github.com/sammy-cool");
    expect(html).toContain("https://www.linkedin.com/in/eureka-priyanshu-persona/");
    expect(html).toContain("https://routine.example.com/about");
  });

  test("GET /sitemap.xml via Express app never contains un-replaced __DOMAIN__ placeholder", async () => {
    const request = require("supertest");
    const express = require("express");
    const { setApiBase } = require("../middleware/setApiBase");
    const pagesRoutes = require("../routes/pages.routes");

    const app = express();
    app.use(setApiBase);
    app.use(pagesRoutes);

    const res = await request(app)
      .get("/sitemap.xml")
      .set("Host", "morning-routine-sender.onrender.com");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("__DOMAIN__");
    expect(res.text).toMatch(/<loc>https?:\/\/[^<]+\/<\/loc>/);
    expect(res.text).toMatch(/<loc>https?:\/\/[^<]+\/about<\/loc>/);
  });

  test("GET /robots.txt via Express app never contains un-replaced __DOMAIN__ placeholder", async () => {
    const request = require("supertest");
    const express = require("express");
    const { setApiBase } = require("../middleware/setApiBase");
    const pagesRoutes = require("../routes/pages.routes");

    const app = express();
    app.use(setApiBase);
    app.use(pagesRoutes);

    const res = await request(app)
      .get("/robots.txt")
      .set("Host", "morning-routine-sender.onrender.com");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("__DOMAIN__");
    expect(res.text).toMatch(/Sitemap:\s+https?:\/\/[^\s]+\/sitemap\.xml/);
  });

  test("GET /llms.txt via Express app never contains un-replaced __DOMAIN__ placeholder", async () => {
    const request = require("supertest");
    const express = require("express");
    const { setApiBase } = require("../middleware/setApiBase");
    const pagesRoutes = require("../routes/pages.routes");

    const app = express();
    app.use(setApiBase);
    app.use(pagesRoutes);

    const res = await request(app)
      .get("/llms.txt")
      .set("Host", "morning-routine-sender.onrender.com");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("__DOMAIN__");
    expect(res.text).toContain("# Morning Routine Sender");
    expect(res.text).toMatch(/https?:\/\/[^/]+\/about/);
  });

  test("GET /llms-full.txt via Express app never contains un-replaced __DOMAIN__ placeholder", async () => {
    const request = require("supertest");
    const express = require("express");
    const { setApiBase } = require("../middleware/setApiBase");
    const pagesRoutes = require("../routes/pages.routes");

    const app = express();
    app.use(setApiBase);
    app.use(pagesRoutes);

    const res = await request(app)
      .get("/llms-full.txt")
      .set("Host", "morning-routine-sender.onrender.com");

    expect(res.status).toBe(200);
    expect(res.text).not.toContain("__DOMAIN__");
    expect(res.text).toContain("Morning Routine Sender");
  });
});
