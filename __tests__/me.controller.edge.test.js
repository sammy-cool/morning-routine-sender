process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

jest.mock("../db/knex", () => ({}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "msg-test-1" });
jest.mock("../config/mailTransporter", () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

jest.mock("../helper/journalService", () => ({
  getAllEntries: jest.fn(),
  generateCsvExport: jest.fn(),
  generateMarkdownExport: jest.fn(),
}));

const sharedData = require("../helper/shared-data");
const journalService = require("../helper/journalService");
const redis = require("../config/redisClient");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Subscriber /me Controller Validation & Edge Cases", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
  });

  async function getAuthenticatedAgent(email) {
    sharedData.getUserByEmail.mockResolvedValue({
      email,
      cronPattern: "0 8 * * *",
      timezone: "UTC",
      routineTrack: "deep-work",
      isActive: true,
    });

    const agent = request.agent(app);
    await agent.post("/login").send({ email });
    const lastCall = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1];
    const token = lastCall[0].html.match(/token=([a-f0-9]+)/)[1];
    await agent.get(`/verify-login?token=${token}`);
    return agent;
  }

  test("rejects unauthenticated PATCH /me with 401", async () => {
    const res = await request(app).patch("/me").send({ routineTrack: "mindfulness" });
    expect(res.status).toBe(401);
  });

  test("accepts all 5 valid routine tracks", async () => {
    const agent = await getAuthenticatedAgent("tracks@example.com");
    const validTracks = ["deep-work", "mindfulness", "executive", "learning", "classic"];

    for (const track of validTracks) {
      sharedData.updateUser.mockResolvedValue();
      sharedData.getUserByEmail.mockResolvedValue({
        email: "tracks@example.com",
        routineTrack: track,
        isActive: true,
      });

      const res = await agent.patch("/me").send({ routineTrack: track });
      expect(res.status).toBe(200);
      expect(sharedData.updateUser).toHaveBeenCalledWith(
        "tracks@example.com",
        expect.objectContaining({ routineTrack: track }),
      );
    }
  });

  test("rejects invalid routineTrack with 400 Bad Request", async () => {
    const agent = await getAuthenticatedAgent("invalidtrack@example.com");

    const res = await agent.patch("/me").send({ routineTrack: "ultra-gamer-mode" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/routineTrack must be one of/i);
  });

  test("rejects invalid timezone with 400 Bad Request", async () => {
    const agent = await getAuthenticatedAgent("invalidtz@example.com");

    const res = await agent.patch("/me").send({ timezone: "Mars/Olympus_Mons" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("Invalid timezone");
  });

  test("rejects invalid cronPattern with 400 Bad Request", async () => {
    const agent = await getAuthenticatedAgent("invalidcron@example.com");

    const res = await agent.patch("/me").send({ cronPattern: "every single minute please" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("cronPattern is not a valid cron expression");
  });

  test("allows pausing and resuming via isActive boolean", async () => {
    const agent = await getAuthenticatedAgent("pause-resume@example.com");

    // Pause
    sharedData.setUserActive.mockResolvedValue();
    sharedData.getUserByEmail.mockResolvedValue({
      email: "pause-resume@example.com",
      isActive: false,
    });
    const pauseRes = await agent.patch("/me").send({ isActive: false });
    expect(pauseRes.status).toBe(200);
    expect(sharedData.setUserActive).toHaveBeenCalledWith("pause-resume@example.com", false);

    // Resume
    sharedData.getUserByEmail.mockResolvedValue({
      email: "pause-resume@example.com",
      isActive: true,
    });
    const resumeRes = await agent.patch("/me").send({ isActive: true });
    expect(resumeRes.status).toBe(200);
    expect(sharedData.setUserActive).toHaveBeenCalledWith("pause-resume@example.com", true);
  });

  describe("Discipline Data Export (GET /api/me/export and GET /me/export)", () => {
    test("rejects unauthenticated GET /api/me/export and GET /me/export with 401", async () => {
      const res1 = await request(app).get("/api/me/export");
      expect(res1.status).toBe(401);

      const res2 = await request(app).get("/me/export");
      expect(res2.status).toBe(401);
    });

    test("returns 404 when authenticated subscriber record does not exist", async () => {
      const agent = await getAuthenticatedAgent("ghost@example.com");
      sharedData.getUserByEmail.mockResolvedValue(null);

      const res = await agent.get("/api/me/export");
      expect(res.status).toBe(404);
      expect(res.body.error).toBe("Subscriber not found");
    });

    test("exports full structured payload as JSON by default and format=json", async () => {
      const testEmail = "discipline.architect@example.com";
      const agent = await getAuthenticatedAgent(testEmail);

      const mockUser = {
        email: testEmail,
        name: "Discipline Master",
        timezone: "America/New_York",
        cronPattern: "30 6 * * 1-5",
        routineTrack: "executive",
        isActive: true,
        coachPersona: "marcus-aurelius",
        streakCount: 21,
        streakFreezes: 3,
        freezeHistory: [
          { date: "2026-09-01", reason: "auto-freeze-gap", usedAt: "2026-09-01T12:00:00.000Z" },
        ],
        customHabits: ["Hydrate 1L", "Cold Plunge 3min", "Review Strategic OKRs"],
      };
      sharedData.getUserByEmail.mockResolvedValue(mockUser);

      const mockEntries = [
        {
          entry_date: "2026-09-13",
          track_key: "executive",
          mood_score: 5,
          one_big_thing: "Launch Data Export Architecture",
          gratitude: "Grateful for relentless focus",
          reflection_text: "Flawless morning ritual execution",
          verified_wakeup: true,
          streak: 21,
          created_at: "2026-09-13T10:30:00.000Z",
        },
        {
          entry_date: "2026-09-12",
          track_key: "executive",
          mood_score: 4,
          one_big_thing: "Plan Sprint Velocity",
          gratitude: "Healthy family and coffee",
          reflection_text: "Steady progress on roadmap",
          verified_wakeup: true,
          streak: 20,
          created_at: "2026-09-12T10:45:00.000Z",
        },
      ];
      journalService.getAllEntries.mockResolvedValue(mockEntries);

      const res = await agent.get("/api/me/export");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/application\/json/);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="morning-routine-export-\d{4}-\d{2}-\d{2}\.json"/,
      );

      expect(res.body.success).toBe(true);
      expect(res.body.subscriber).toBe(testEmail);
      expect(res.body.track).toBe("executive");
      expect(res.body.streakCount).toBe(21);
      expect(res.body.streakFreezes).toBe(3);
      expect(res.body.freezeHistory).toEqual(mockUser.freezeHistory);
      expect(res.body.customHabits).toEqual(mockUser.customHabits);
      expect(res.body.profile).toMatchObject({
        email: testEmail,
        name: "Discipline Master",
        timezone: "America/New_York",
        cronPattern: "30 6 * * 1-5",
        isActive: true,
        coachPersona: "marcus-aurelius",
      });
      expect(res.body.totalEntries).toBe(2);
      expect(res.body.entries).toHaveLength(2);
      expect(res.body.entries[0].one_big_thing).toBe("Launch Data Export Architecture");
    });

    test("exports comprehensive CSV with Date, Streak, Verified Wakeup, Priority Goal, Mood, Gratitude, Reflection", async () => {
      const testEmail = "csv.export@example.com";
      const agent = await getAuthenticatedAgent(testEmail);

      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        routineTrack: "deep-work",
        streakCount: 15,
        streakFreezes: 2,
        freezeHistory: [],
        customHabits: ["Code Sprint 90m"],
      });

      const mockEntries = [
        {
          entry_date: "2026-09-13",
          track_key: "deep-work",
          mood_score: 5,
          one_big_thing: "Build unit test matrix",
          gratitude: "Green tests",
          reflection_text: "High velocity day",
          verified_wakeup: true,
          streak: 15,
        },
        {
          entry_date: "2026-09-12",
          track_key: "deep-work",
          mood_score: 3,
          one_big_thing: "=cmd|' /C calc'!A0", // Test CSV formula injection defense
          gratitude: "+SUM(1,2)",
          reflection_text: 'Quote: "Deep Work Mastery"',
          verified_wakeup: false,
          streak: 14,
        },
      ];
      journalService.getAllEntries.mockResolvedValue(mockEntries);

      const res = await agent.get("/api/me/export?format=csv");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/csv/);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="morning-routine-export-\d{4}-\d{2}-\d{2}\.csv"/,
      );

      const csv = res.text;
      // Header check
      expect(csv).toContain(
        '"Date","Streak","Verified Wakeup","Priority Goal","Mood","Gratitude","Reflection"',
      );
      // Row 1 checks
      expect(csv).toContain('"2026-09-13"');
      expect(csv).toContain('"15"');
      expect(csv).toContain('"true"');
      expect(csv).toContain('"Build unit test matrix"');
      expect(csv).toContain('"5"');
      expect(csv).toContain('"Green tests"');
      expect(csv).toContain('"High velocity day"');
      // Formula injection defense checks
      expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
      expect(csv).toContain('"\'+SUM(1,2)"');
      expect(csv).toContain('""Deep Work Mastery""');
    });

    test("exports Notion/Obsidian compatible Markdown with frontmatter and daily logs", async () => {
      const testEmail = "obsidian.notion@example.com";
      const agent = await getAuthenticatedAgent(testEmail);

      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        routineTrack: "mindfulness",
        streakCount: 10,
        streakFreezes: 2,
        freezeHistory: [],
        customHabits: ["15m Meditation", "Tea Ceremony"],
      });

      const mockEntries = [
        {
          entry_date: "2026-09-13",
          track_key: "mindfulness",
          mood_score: 5,
          one_big_thing: "Mindful presence throughout morning sprints",
          gratitude: "Fresh morning breeze",
          reflection_text: "Calm and centered start to the week",
          verified_wakeup: true,
          streak: 10,
        },
      ];
      journalService.getAllEntries.mockResolvedValue(mockEntries);

      const res = await agent.get("/me/export?format=markdown");
      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toMatch(/text\/markdown/);
      expect(res.headers["content-disposition"]).toMatch(
        /attachment; filename="morning-routine-export-\d{4}-\d{2}-\d{2}\.md"/,
      );

      const md = res.text;
      // Frontmatter checks
      expect(md).toMatch(/^---\ntitle: Morning Routine & Discipline Archive/);
      expect(md).toContain(`subscriber: ${testEmail}`);
      expect(md).toContain("track: mindfulness");
      expect(md).toContain("streak_count: 10");
      expect(md).toContain("streak_freezes: 2");
      expect(md).toContain("total_entries: 1");
      expect(md).toContain('  - "15m Meditation"');
      expect(md).toContain('  - "Tea Ceremony"');
      expect(md).toContain("tags:\n  - discipline\n  - morning-routine\n  - habit-tracker");
      // Markdown Body checks
      expect(md).toContain("# 🌅 Morning Routine & Discipline Archive");
      expect(md).toContain("## 🎯 Custom Habits");
      expect(md).toContain("- [ ] 15m Meditation");
      expect(md).toContain("- [ ] Tea Ceremony");
      expect(md).toContain("## 📅 Daily Discipline Logs");
      expect(md).toContain("### #1 • 📅 2026-09-13");
      expect(md).toContain("- **Streak:** 🔥 10 Days");
      expect(md).toContain("- **Verified Wakeup:** ☀️ Yes");
      expect(md).toContain("- **Priority Goal:** Mindful presence throughout morning sprints");
      expect(md).toContain("- **Mood:** ⚡ Peak Flow & Momentum (5/5)");
      expect(md).toContain("- **Gratitude:** Fresh morning breeze");
      expect(md).toContain("- **Reflection:** Calm and centered start to the week");
    });

    test("handles empty journal entries gracefully across JSON, CSV, and Markdown", async () => {
      const testEmail = "empty.logs@example.com";
      const agent = await getAuthenticatedAgent(testEmail);

      sharedData.getUserByEmail.mockResolvedValue({
        email: testEmail,
        routineTrack: "classic",
        streakCount: 0,
        streakFreezes: 2,
        freezeHistory: [],
        customHabits: [],
      });
      journalService.getAllEntries.mockResolvedValue([]);

      // JSON
      const jsonRes = await agent.get("/api/me/export?format=json");
      expect(jsonRes.status).toBe(200);
      expect(jsonRes.body.totalEntries).toBe(0);
      expect(jsonRes.body.entries).toEqual([]);

      // CSV
      const csvRes = await agent.get("/api/me/export?format=csv");
      expect(csvRes.status).toBe(200);
      expect(csvRes.text.trim()).toBe(
        '"Date","Streak","Verified Wakeup","Priority Goal","Mood","Gratitude","Reflection"',
      );

      // Markdown
      const mdRes = await agent.get("/api/me/export?format=markdown");
      expect(mdRes.status).toBe(200);
      expect(mdRes.text).toContain("No discipline logs recorded yet");
    });
  });
});
