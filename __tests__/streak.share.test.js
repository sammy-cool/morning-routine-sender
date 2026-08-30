const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const { setApiBase } = require("../middleware/setApiBase");
const pagesRoutes = require("../routes/pages.routes");

describe("OpenGraph & Dynamic Social Share Landing Page", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser("test-secret"));
    app.use(setApiBase);
    app.use(pagesRoutes);
  });

  test("GET /streak/:handleOrEmail returns 200 with complete OpenGraph and Twitter card meta tags", async () => {
    const res = await request(app)
      .get("/streak/priyanshu")
      .set("Host", "morning-routine-sender.onrender.com");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/html");
    expect(res.text).toContain('property="og:title"');
    expect(res.text).toContain('property="og:image"');
    expect(res.text).toContain('name="twitter:card" content="summary_large_image"');
    expect(res.text).toContain('name="twitter:image"');
    expect(res.text).toContain("Start Your Routine");
    expect(res.text).toContain("View Live Companion");
  });

  test("GET /streak/ redirects to root if handle is missing or empty", async () => {
    const res = await request(app).get("/streak/%20");
    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("/");
  });
});
