process.env.USE_MOCK_REDIS = "true";

jest.mock("mjml", () =>
  jest.fn((xml) => ({ html: `<html><body>${xml}</body></html>`, errors: [] })),
);

const { runWeeklyDigestJob } = require("../email-core/emailJobs");
const emailTracker = require("../email-core/emailTracker");
const weeklyDigestService = require("../helper/weeklyDigestService");
const sharedData = require("../helper/shared-data");

describe("Sunday Weekly Digest Automated Scheduler & Job Engine", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("runWeeklyDigestJob processes active subscribers and respects weekly idempotency", async () => {
    jest.spyOn(sharedData, "getUsers").mockResolvedValue([
      { email: "subscriber1@example.com", isActive: true, routineTrack: "deep-work" },
      { email: "subscriber2@example.com", isActive: false, routineTrack: "mindfulness" },
      { email: "subscriber3@example.com", isActive: true, routineTrack: "exec" },
    ]);

    jest.spyOn(emailTracker, "wasEmailSentThisWeek").mockImplementation(async (email) => {
      return email === "subscriber3@example.com";
    });

    jest.spyOn(weeklyDigestService, "dispatchWeeklyDigest").mockResolvedValue({
      success: true,
      messageId: "msg-12345",
    });

    const result = await runWeeklyDigestJob({ force: false });

    expect(result.total).toBe(3);
    expect(result.sent.length).toBe(1);
    expect(result.sent[0].email).toBe("subscriber1@example.com");
    expect(
      result.skipped.some((s) => s.email === "subscriber2@example.com" && s.reason === "paused"),
    ).toBe(true);
    expect(
      result.skipped.some(
        (s) => s.email === "subscriber3@example.com" && s.reason === "already_sent_this_week",
      ),
    ).toBe(true);
  });

  test("runWeeklyDigestJob dispatches when force=true even if already sent", async () => {
    jest
      .spyOn(sharedData, "getUsers")
      .mockResolvedValue([
        { email: "subscriber1@example.com", isActive: true, routineTrack: "deep-work" },
      ]);

    jest.spyOn(weeklyDigestService, "dispatchWeeklyDigest").mockResolvedValue({
      success: true,
      messageId: "msg-99999",
    });

    const result = await runWeeklyDigestJob({ force: true });
    expect(result.sent.length).toBe(1);
    expect(result.sent[0].email).toBe("subscriber1@example.com");
  });
});
