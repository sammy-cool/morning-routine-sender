process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const cookieParser = require("cookie-parser");

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    orWhere: jest.fn().mockReturnThis(),
    whereIn: jest.fn().mockReturnThis(),
    count: jest.fn().mockResolvedValue([{ count: 12 }]),
    first: jest.fn().mockResolvedValue(null),
  };
  const fn = jest.fn(() => queryBuilder);
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
const { generateRadarChartSvg, PILLARS } = require("../helper/radarChartGenerator");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const subscriberEnhancementsRoutes = require("../routes/subscriberEnhancements.routes");

function buildPortalApp(mockEmail = null) {
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

function buildEnhancementsApp(mockEmail = null) {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (mockEmail) {
      req.subscriberEmail = mockEmail;
    }
    next();
  });
  app.use(subscriberEnhancementsRoutes);
  return app;
}

describe("5-Pillar Consistency Radar Chart Generator", () => {
  test("generates valid standalone SVG with correct dimensions, viewBox, and background", () => {
    const svg = generateRadarChartSvg({
      subscriberName: "Morning Hero",
      trackName: "deep-work",
      streakCount: 21,
      scores: {
        riseTime: 95,
        physical: 90,
        deepWork: 92,
        reflection: 88,
        grit: 95,
      },
      grade: "A+",
    });

    expect(svg).toContain('<svg width="800" height="800" viewBox="0 0 800 800"');
    expect(svg).toContain('xmlns="http://www.w3.org/2000/svg"');
    expect(svg).toContain("</svg>");
    expect(svg).toContain('linearGradient id="radarBgGrad"');
    expect(svg).toContain('linearGradient id="radarPolyGrad"');
    expect(svg).toContain('stop-color="#06080e"');
    expect(svg).toContain('stop-color="#0d121f"');
    expect(svg).toContain('stop-color="#38bdf8"');
    expect(svg).toContain('stop-color="#6366f1"');
  });

  test("contains all 5 pillar labels, emojis, and styling in SVG", () => {
    const svg = generateRadarChartSvg();

    expect(svg).toContain("Rise Time Precision");
    expect(svg).toContain("Physical Grounding");
    expect(svg).toContain("Deep Work Sprint");
    expect(svg).toContain("Reflection Depth");
    expect(svg).toContain("Streak Grit");

    expect(svg).toContain("🌅");
    expect(svg).toContain("⚡");
    expect(svg).toContain("🎯");
    expect(svg).toContain("📖");
    expect(svg).toContain("🔥");

    expect(svg).toContain("Plus Jakarta Sans");
    expect(svg).toContain("JetBrains Mono");
  });

  test("renders 5 concentric polygon rings and 5 radial axis lines", () => {
    const svg = generateRadarChartSvg();

    // 5 concentric rings + 1 data polygon = at least 6 <polygon> tags
    const polygonMatches = svg.match(/<polygon/g);
    expect(polygonMatches).not.toBeNull();
    expect(polygonMatches.length).toBeGreaterThanOrEqual(6);

    // 5 radial lines
    const lineMatches = svg.match(/<line/g);
    expect(lineMatches).not.toBeNull();
    expect(lineMatches.length).toBeGreaterThanOrEqual(5);

    // Percentage scale labels along concentric rings
    expect(svg).toContain("20%");
    expect(svg).toContain("40%");
    expect(svg).toContain("60%");
    expect(svg).toContain("80%");
    expect(svg).toContain("100%");
  });

  test("calculates math coordinates accurately for zero and max scores", () => {
    // Zero scores: all coordinates should collapse to center (400, 400)
    const zeroSvg = generateRadarChartSvg({
      scores: {
        riseTime: 0,
        physical: 0,
        deepWork: 0,
        reflection: 0,
        grit: 0,
      },
    });
    expect(zeroSvg).toContain(
      'points="400.0,400.0 400.0,400.0 400.0,400.0 400.0,400.0 400.0,400.0"',
    );

    // 100% scores: top vertex at theta = -PI/2 should be at (400, 400 - 230) = (400.0, 170.0)
    const maxSvg = generateRadarChartSvg({
      scores: {
        riseTime: 100,
        physical: 100,
        deepWork: 100,
        reflection: 100,
        grit: 100,
      },
    });
    expect(maxSvg).toContain("400.0,170.0");
  });

  test("clamps scores below 0 and above 100 correctly", () => {
    const svg = generateRadarChartSvg({
      scores: {
        riseTime: -50,
        physical: 150,
        deepWork: 100,
        reflection: 0,
        grit: 999,
      },
    });

    expect(svg).toContain(">0%<");
    expect(svg).toContain(">100%<");
    expect(svg).not.toContain(">-50%<");
    expect(svg).not.toContain(">150%<");
    expect(svg).not.toContain(">999%<");
  });

  test("displays consistency grade and momentum badge watermark accurately", () => {
    const svg = generateRadarChartSvg({
      scores: {
        riseTime: 95,
        physical: 90,
        deepWork: 92,
        reflection: 88,
        grit: 95,
      },
      grade: "A+",
    });

    expect(svg).toContain("GRADE: A+ • 92% MOMENTUM");
  });

  test("escapes special characters in subscriber name to ensure XML safety", () => {
    const svg = generateRadarChartSvg({
      subscriberName: "Alex <CEO> & 'Pro'",
      trackName: "executive",
    });

    expect(svg).not.toContain("<CEO>");
    expect(svg).toContain("&lt;CEO&gt;");
    expect(svg).toContain("&amp;");
  });
});

describe("Radar Chart HTTP Endpoints", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /api/me/radar.svg returns 200 with image/svg+xml Content-Type", async () => {
    const app = buildPortalApp(null);
    const res = await request(app).get("/api/me/radar.svg?name=Elena&streak=14&track=deep-work");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svg = res.text || (res.body ? res.body.toString("utf8") : "");
    expect(svg).toContain("<svg");
    expect(svg).toContain("Rise Time Precision");
    expect(svg).toContain("@Elena");
    expect(svg).toContain("🔥 14d");
  });

  test("GET /api/me/radar.svg with query scores customizes the radar visualization", async () => {
    const app = buildPortalApp(null);
    const res = await request(app).get(
      "/api/me/radar.svg?name=Marcus&streak=30&riseTime=98&physical=95&deepWork=90&reflection=85&grit=99&grade=A%2B",
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svg = res.text || (res.body ? res.body.toString("utf8") : "");
    expect(svg).toContain("@Marcus");
    expect(svg).toContain("GRADE: A+");
  });

  test("GET /radar/:token.svg returns 200 with image/svg+xml Content-Type", async () => {
    const app = buildPortalApp(null);
    const res = await request(app).get("/radar/sampleToken123.svg?streak=10");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svg = res.text || (res.body ? res.body.toString("utf8") : "");
    expect(svg).toContain("<svg");
    expect(svg).toContain("5-PILLAR CONSISTENCY RADAR");
  });

  test("GET /radar/:email/radar.svg resolves subscriber data and returns 200 SVG", async () => {
    sharedData.getUserByEmail.mockResolvedValue({
      email: "champion@example.com",
      streakCount: 42,
      routineTrack: "executive",
    });

    const app = buildPortalApp(null);
    const res = await request(app).get("/radar/champion@example.com/radar.svg");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svg = res.text || (res.body ? res.body.toString("utf8") : "");
    expect(svg).toContain("@champion");
    expect(svg).toContain("🔥 42d");
    expect(svg).toContain("HIGH-PERFORMANCE EXEC");
  });

  test("GET /api/me/radar.svg supports download attachment header", async () => {
    const app = buildPortalApp(null);
    const res = await request(app).get("/api/me/radar.svg?name=Dave&download=1");

    expect(res.status).toBe(200);
    expect(res.headers["content-disposition"]).toContain("attachment");
    expect(res.headers["content-disposition"]).toContain("consistency-radar-Dave.svg");
  });

  test("GET /api/me/radar.svg on subscriberEnhancements.routes returns 200 with image/svg+xml", async () => {
    const app = buildEnhancementsApp("enhancement-user@example.com");
    sharedData.getUserByEmail.mockResolvedValue({
      email: "enhancement-user@example.com",
      streakCount: 18,
      routineTrack: "mindfulness",
    });

    const res = await request(app).get("/api/me/radar.svg");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("image/svg+xml");
    const svg = res.text || (res.body ? res.body.toString("utf8") : "");
    expect(svg).toContain("<svg");
    expect(svg).toContain("MINDFULNESS &amp; STOIC");
  });
});
