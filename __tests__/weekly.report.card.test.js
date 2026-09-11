process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const cookieParser = require("cookie-parser");

jest.mock("../db/knex", () => {
  const fn = jest.fn(() => ({
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
  }));
  fn.schema = {
    hasTable: jest.fn().mockResolvedValue(true),
  };
  return fn;
});

jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
}));

const sharedData = require("../helper/shared-data");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp(mockEmail = "test@example.com") {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (mockEmail) {
      req.subscriberEmail = mockEmail;
    }
    next();
  });
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Weekly Habit Consistency Report Card Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/weekly-report.svg returns SVG with default/query parameters", async () => {
    const app = buildApp(null);
    const res = await request(app).get(
      "/api/weekly-report.svg?name=Elena&streak=21&track=mindfulness&grade=A&rate=95",
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svgText = res.text || res.body.toString("utf8");
    expect(svgText).toContain('<svg width="1200" height="630"');
    expect(svgText).toContain("GRADE: A");
    expect(svgText).toContain("95% Weekly Consistency Rate");
    expect(svgText).toContain("@Elena");
    expect(svgText).toContain("🔥 21 Days");
    expect(svgText).toContain("</svg>");
  });

  test("GET /api/weekly-report/:email/card.svg resolves subscriber data and generates SVG", async () => {
    sharedData.getUserByEmail.mockResolvedValue({
      email: "champion@example.com",
      streakCount: 35,
      routineTrack: "deep-work",
      timezone: "America/Chicago",
    });

    const app = buildApp(null);
    const res = await request(app).get("/api/weekly-report/champion@example.com/card.svg");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svgText = res.text || res.body.toString("utf8");
    expect(svgText).toContain("@champion");
    expect(svgText).toContain("🔥 35 Days");
    expect(svgText).toContain("DEEP WORK &amp; BUILDER");
  });

  test("GET /me/weekly-report.svg serves authenticated subscriber report with download disposition", async () => {
    const email = "authenticated-pro@example.com";
    sharedData.getUserByEmail.mockResolvedValue({
      email,
      streakCount: 14,
      routineTrack: "learning",
      timezone: "UTC",
    });

    const app = buildApp(email);
    const res = await request(app).get("/me/weekly-report.svg?download=1");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    expect(res.headers["content-disposition"]).toContain(
      'attachment; filename="weekly-habit-report-authenticated-pro.svg"',
    );
    const svgText = res.text || res.body.toString("utf8");
    expect(svgText).toContain("@authenticated-pro");
    expect(svgText).toContain("GRADE:");
    expect(svgText).toContain("⚡");
  });

  test("GET /me/weekly-report serves report via session", async () => {
    const email = "session-member@example.com";
    sharedData.getUserByEmail.mockResolvedValue({
      email,
      streakCount: 7,
      routineTrack: "mindfulness",
      timezone: "UTC",
    });

    const app = buildApp(email);
    const res = await request(app).get("/me/weekly-report");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svgText = res.text || res.body.toString("utf8");
    expect(svgText).toContain("@session-member");
  });
});
