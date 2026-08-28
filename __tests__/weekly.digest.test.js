process.env.USE_MOCK_REDIS = "true";

jest.mock("../db/knex", () => ({}));
jest.mock("mjml", () => jest.fn((content) => ({ html: `<html><body>${content}</body></html>` })));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSend: jest.fn().mockResolvedValue(),
  recordFailure: jest.fn().mockResolvedValue(),
  wasEmailSentToday: jest.fn().mockResolvedValue(false),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "weekly-digest-msg-123" });
const mockTransporter = { sendMail: mockSendMail };

jest.mock("../config/mailTransporter", () => ({
  getTransporter: jest.fn(() => mockTransporter),
  closeTransporterConnection: jest.fn().mockResolvedValue(),
}));

const sharedData = require("../helper/shared-data");
const emailService = require("../email-core/emailService");
const emailScheduler = require("../email-core/emailScheduler");

describe("Sunday Weekly Streak Digest System", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  const TRACKS = ["deep-work", "mindfulness", "executive", "learning", "classic"];

  TRACKS.forEach((track) => {
    test(`generates tailored Sunday reflection and week prep for '${track}' track`, async () => {
      const digestContent = sharedData.getWeeklyDigestContent(track);
      expect(digestContent.name).toBeDefined();
      expect(digestContent.weeklyReflectionGuidance).toBeDefined();
      expect(digestContent.weeklyPrepItems.length).toBeGreaterThan(1);
      expect(digestContent.weeklyEncouragement).toBeDefined();

      const user = {
        email: `${track}-digest@example.com`,
        name: "Test Builder",
        routineTrack: track,
        streakCount: 5,
        timezone: "Asia/Kolkata",
      };

      const result = await emailService.sendWeeklyDigestEmail(
        mockTransporter,
        "http://localhost:2900",
        user,
      );
      expect(result.success).toBe(true);
      expect(mockSendMail).toHaveBeenCalled();

      const mailOptions = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1][0];
      expect(mailOptions.to).toBe(user.email);
      const expectedTitleEscaped = digestContent.weeklyPrepItems[0].title.replace(/'/g, "&#x27;");
      expect(mailOptions.html).toContain(expectedTitleEscaped);
    });
  });

  test("sendUserWeeklyDigest sends and tracks Sunday digest record", async () => {
    const user = {
      email: "weekly-streak@example.com",
      routineTrack: "deep-work",
      streakCount: 7,
      timezone: "UTC",
    };

    const sendRes = await emailScheduler.sendUserWeeklyDigest(user, "GG!", "http://localhost:2900");
    expect(sendRes.status).toBe("success");
    expect(sendRes.messageId).toBeDefined();
  });
});
