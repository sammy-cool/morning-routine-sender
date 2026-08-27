process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");

jest.mock("../db/knex", () => ({}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockImplementation((track) => {
    const map = {
      "deep-work": { keyword: "Deep Work & Builder", ritual: "critical deliverable" },
      "mindfulness": { keyword: "Mindfulness & Stoic", ritual: "Box Breathing" },
      "executive": { keyword: "High-Performance Executive", ritual: "top 3 high-leverage priorities" },
      "learning": { keyword: "Lifelong Learner", ritual: "Feynman" },
      "classic": { keyword: "Morning Energizer", ritual: "Morning affirmations" },
    };
    const c = map[track] || map["deep-work"];
    return {
      track: track || "deep-work",
      name: c.keyword,
      badge: `⚡ ${c.keyword}`,
      tagline: "Tailored morning focus",
      ritual: c.ritual,
      quote: "Routine creates greatness.",
      checklist: ["Hydrate (500ml)", "Focus Sprint"],
    };
  }),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const { generateActionToken } = require("../helper/unsubscribeToken");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Live Routine Companion Edge Cases (/routine)", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  const TRACKS = [
    { track: "deep-work", keyword: "Deep Work", ritual: "critical deliverable" },
    { track: "mindfulness", keyword: "Mindfulness", ritual: "Box Breathing" },
    { track: "executive", keyword: "High-Performance Executive", ritual: "top 3 high-leverage priorities" },
    { track: "learning", keyword: "Lifelong Learner", ritual: "Feynman" },
    { track: "classic", keyword: "Morning Energizer", ritual: "Morning affirmations" },
  ];

  TRACKS.forEach(({ track, keyword, ritual }) => {
    test(`renders tailored focus ritual for '${track}' track persona`, async () => {
      const email = `${track}@example.com`;
      const token = generateActionToken(email, "routine");

      sharedData.getUserByEmail.mockResolvedValue({
        email,
        streakCount: 3,
        routineTrack: track,
        timezone: "Asia/Kolkata",
      });

      const res = await request(app).get(`/routine?email=${encodeURIComponent(email)}&token=${token}`);
      expect(res.status).toBe(200);
      expect(res.text).toContain(keyword);
      expect(res.text).toContain("Focus Sprint Timer");
      expect(res.text).toContain("Morning Habit Checklist");
      expect(res.text).toMatch(new RegExp(ritual, "i"));
    });
  });

  test("direct visit to /routine without token falls back to interactive morning companion", async () => {
    const res = await request(app).get("/routine");
    expect(res.status).toBe(200);
    expect(res.text).toMatch(/Today's Morning Routine/i);
    expect(res.text).toMatch(/Focus Sprint Timer/i);
  });
});
