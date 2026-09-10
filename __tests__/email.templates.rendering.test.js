process.env.USE_MOCK_REDIS = "true";

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "<mock-msg@test>" });
const mockTransporterInstance = { sendMail: mockSendMail };

jest.mock("mjml", () =>
  jest.fn((content) => ({ html: `<!doctype html><html><body>${content}</body></html>` })),
);

jest.mock("../db/knex", () => {
  const queryBuilder = {
    where: jest.fn().mockReturnThis(),
    whereBetween: jest.fn().mockReturnThis(),
    whereRaw: jest.fn().mockReturnThis(),
    orderBy: jest.fn().mockReturnThis(),
    select: jest.fn().mockReturnThis(),
    first: jest.fn().mockResolvedValue(null),
    insert: jest.fn().mockResolvedValue([1]),
    update: jest.fn().mockResolvedValue(1),
  };
  return jest.fn(() => queryBuilder);
});

jest.mock("../config/mailTransporter", () => {
  return {
    getTransporter: jest.fn(() => ({
      sendMail: mockSendMail,
    })),
  };
});

jest.mock("../helper/util", () => {
  const actual = jest.requireActual("../helper/util");
  return {
    ...actual,
    dailyDevNews: jest.fn().mockResolvedValue({
      title: "Tech News Headline",
      description: "Summary of latest developer updates",
      url: "https://news.example.com",
    }),
  };
});

jest.mock("../helper/aiSparkGenerator", () => ({
  getDailyMorningSpark: jest.fn().mockResolvedValue({
    sparkReflection: "Master your internal focus.",
    microAction: "Define one critical task.",
    focusMantra: "Deep work wins.",
    isCurated: true,
  }),
}));

const sharedData = require("../helper/shared-data");
const emailService = require("../email-core/emailService");
const weeklyDigestService = require("../helper/weeklyDigestService");

describe("📧 Email Templates, Cross-ESP & Plain-Text Fallback Test Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("1. Daily Morning Routine Emails (All 7 Tracks)", () => {
    const allTracks = [
      "deep-work",
      "mindfulness",
      "executive",
      "learning",
      "classic",
      "career",
      "reflection",
    ];

    test.each(allTracks)("renders HTML & plain-text fallback for track: %s", async (track) => {
      const mockUser = {
        email: `tester.${track}@example.com`,
        routineTrack: track,
        templateType: track,
        streakCount: 5,
        timezone: "America/New_York",
        coachPersona: "stoic",
      };

      const result = await emailService.sendRoutineEmail(
        mockTransporterInstance,
        "https://routine.test",
        mockUser,
      );
      expect(result.success).toBe(true);

      expect(mockSendMail).toHaveBeenCalled();
      const sendArgs = mockSendMail.mock.calls[0][0];

      // HTML validations
      expect(sendArgs.html).toContain("Morning Routine");
      expect(sendArgs.html).toContain("<!doctype html>");
      expect(sendArgs.subject).toMatch(/Day \d+ Morning Routine/i);

      // Headers validations (RFC Bulk, Unsubscribe & Threading)
      expect(sendArgs.headers).toHaveProperty("Precedence", "bulk");
      expect(sendArgs.headers).toHaveProperty("Auto-Submitted", "auto-generated");
      expect(sendArgs.headers).toHaveProperty("X-Entity-Ref-ID");
      expect(sendArgs.headers).toHaveProperty("List-Unsubscribe");
      expect(sendArgs.headers).toHaveProperty(
        "List-Unsubscribe-Post",
        "List-Unsubscribe=One-Click",
      );

      // Plain-text Fallback validations
      expect(sendArgs.text).toBeDefined();
      expect(sendArgs.text).toContain("Good morning");
      expect(sendArgs.text).toContain("Quote:");
      expect(sendArgs.text).toContain("Today's Habit Checklist:");
      expect(sendArgs.text).toContain("[ ]");
      expect(sendArgs.text).toContain("Open Live Routine & Timer:");
      expect(sendArgs.text).toContain("1-Click Streak Check-in:");
      expect(sendArgs.text).toContain("Unsubscribe:");
    });
  });

  describe("2. Weekly Consistency Digest Metrics & Configs", () => {
    test("sharedData provides weekly digest configs for all 7 tracks", () => {
      const allTracks = [
        "deep-work",
        "mindfulness",
        "executive",
        "learning",
        "classic",
        "career",
        "reflection",
      ];

      allTracks.forEach((track) => {
        const config = sharedData.getWeeklyDigestContent(track);
        expect(config).toBeDefined();
        expect(config.weeklyReflectionGuidance).toBeTruthy();
        expect(Array.isArray(config.weeklyPrepItems)).toBe(true);
        expect(config.weeklyPrepItems.length).toBeGreaterThanOrEqual(3);
        expect(config.weeklyEncouragement).toBeTruthy();
      });
    });

    test("weekly digest sends successfully with calculated metrics and plain-text fallback", async () => {
      const mockUser = {
        email: "digest.subscriber@example.com",
        routineTrack: "deep-work",
        streakCount: 14,
        timezone: "UTC",
      };

      const result = await weeklyDigestService.sendWeeklyDigestToSubscriber(
        mockUser,
        "https://routine.test",
        { force: true },
      );
      expect(result.status).toBe("success");

      expect(mockSendMail).toHaveBeenCalled();
      const sendArgs = mockSendMail.mock.calls[0][0];

      expect(sendArgs.subject).toMatch(/Weekly.*Digest/i);
      expect(sendArgs.html).toContain("<!doctype html>");
      expect(sendArgs.text).toBeDefined();
      expect(sendArgs.text).toContain("Weekly");
      expect(sendArgs.headers).toHaveProperty("X-Campaign", "weekly-performance-digest");
    });
  });
});
