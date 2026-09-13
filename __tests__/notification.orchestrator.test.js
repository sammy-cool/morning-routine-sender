// __tests__/notification.orchestrator.test.js
const {
  DEFAULT_QUIET_HOURS,
  DEFAULT_ESCALATION_LADDER,
  NOTIFICATION_TONES,
  isQuietHours,
  getNotificationTone,
  getEscalationStep,
  shouldSendNotification,
  buildOrchestrationPlan,
} = require("../helper/notificationOrchestrator");

describe("Notification Orchestrator", () => {
  describe("Constants & Config", () => {
    test("has valid DEFAULT_QUIET_HOURS", () => {
      expect(DEFAULT_QUIET_HOURS.start).toBeDefined();
      expect(DEFAULT_QUIET_HOURS.end).toBeDefined();
      expect(DEFAULT_QUIET_HOURS.start).toBeGreaterThan(DEFAULT_QUIET_HOURS.end);
    });

    test("has valid DEFAULT_ESCALATION_LADDER", () => {
      expect(Array.isArray(DEFAULT_ESCALATION_LADDER)).toBe(true);
      expect(DEFAULT_ESCALATION_LADDER.length).toBe(4);
      expect(DEFAULT_ESCALATION_LADDER[0].channel).toBe("push");
      expect(DEFAULT_ESCALATION_LADDER[1].channel).toBe("telegram");
      expect(DEFAULT_ESCALATION_LADDER[2].channel).toBe("discord");
      expect(DEFAULT_ESCALATION_LADDER[3].channel).toBe("email");
    });

    test("has complete NOTIFICATION_TONES presets", () => {
      expect(NOTIFICATION_TONES["gentle-nudge"]).toBeDefined();
      expect(NOTIFICATION_TONES["drill-sergeant"]).toBeDefined();
      expect(NOTIFICATION_TONES["marcus-aurelius"]).toBeDefined();
      expect(NOTIFICATION_TONES["zen-master"]).toBeDefined();
      expect(NOTIFICATION_TONES["default"]).toBeDefined();
    });
  });

  describe("isQuietHours()", () => {
    test("returns a boolean for valid timezones", () => {
      const result = isQuietHours("America/New_York");
      expect(typeof result).toBe("boolean");
    });

    test("handles non-wrapping quiet hours (e.g. 1 to 5)", () => {
      const result = isQuietHours("UTC", { start: 1, end: 5 });
      expect(typeof result).toBe("boolean");
    });

    test("handles invalid timezone gracefully without throwing", () => {
      const result = isQuietHours("Invalid/Timezone_That_Does_Not_Exist");
      expect(result).toBe(false);
    });
  });

  describe("getNotificationTone()", () => {
    test("returns gentle-nudge tone", () => {
      const tone = getNotificationTone("gentle-nudge");
      expect(tone.urgency).toBe("low");
      expect(tone.title).toContain("Good morning");
    });

    test("returns drill-sergeant tone", () => {
      const tone = getNotificationTone("drill-sergeant");
      expect(tone.urgency).toBe("high");
      expect(tone.title).toContain("WAKE UP");
    });

    test("returns marcus-aurelius stoic tone", () => {
      const tone = getNotificationTone("marcus-aurelius");
      expect(tone.urgency).toBe("normal");
      expect(tone.title).toContain("The obstacle is the way");
    });

    test("falls back to default for unrecognized persona", () => {
      const tone = getNotificationTone("unknown-persona");
      expect(tone).toEqual(NOTIFICATION_TONES.default);
    });

    test("handles null or empty persona", () => {
      expect(getNotificationTone(null)).toEqual(NOTIFICATION_TONES.default);
      expect(getNotificationTone("")).toEqual(NOTIFICATION_TONES.default);
    });
  });

  describe("getEscalationStep()", () => {
    test("returns push for 0 minutes elapsed", () => {
      const step = getEscalationStep(0);
      expect(step.channel).toBe("push");
    });

    test("returns telegram for 15 minutes elapsed", () => {
      const step = getEscalationStep(15);
      expect(step.channel).toBe("telegram");
    });

    test("returns discord for 30 minutes elapsed", () => {
      const step = getEscalationStep(45);
      expect(step.channel).toBe("discord");
    });

    test("returns email for 60+ minutes elapsed", () => {
      const step = getEscalationStep(75);
      expect(step.channel).toBe("email");
    });

    test("handles negative elapsed time gracefully", () => {
      const step = getEscalationStep(-10);
      expect(step.channel).toBe("push");
    });
  });

  describe("shouldSendNotification()", () => {
    test("returns false if already checked in today", () => {
      const result = shouldSendNotification({
        alreadyCheckedInToday: true,
      });
      expect(result.shouldSend).toBe(false);
      expect(result.reason).toContain("Already checked in");
    });

    test("returns false if subscriber is inactive", () => {
      const result = shouldSendNotification({
        isActive: false,
      });
      expect(result.shouldSend).toBe(false);
      expect(result.reason).toContain("inactive");
    });

    test("returns false if subscriber is on vacation", () => {
      const futureDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
      const result = shouldSendNotification({
        vacationPausedUntil: futureDate,
      });
      expect(result.shouldSend).toBe(false);
      expect(result.reason).toContain("vacation");
    });

    test("returns true for active subscriber not on vacation and not checked in", () => {
      const result = shouldSendNotification({
        alreadyCheckedInToday: false,
        isActive: true,
        timezone: "Pacific/Midway", // safe timezone outside quiet hours or testable
        quietHours: { start: 0, end: 0 }, // disabled quiet hours for test
        coachPersona: "marcus-aurelius",
      });
      expect(result.shouldSend).toBe(true);
      expect(result.reason).toBe("OK");
      expect(result.tone.title).toContain("obstacle");
    });
  });

  describe("buildOrchestrationPlan()", () => {
    test("returns full plan when notification should be sent", () => {
      const plan = buildOrchestrationPlan(
        {
          alreadyCheckedInToday: false,
          isActive: true,
          quietHours: { start: 0, end: 0 },
          coachPersona: "drill-sergeant",
        },
        20,
      );

      expect(plan.shouldSend).toBe(true);
      expect(plan.channel).toBe("telegram"); // 20m elapsed -> telegram
      expect(plan.tone.urgency).toBe("high");
      expect(plan.escalationStep.delayMinutes).toBe(15);
    });

    test("returns shouldSend: false when throttled", () => {
      const plan = buildOrchestrationPlan({
        alreadyCheckedInToday: true,
      });

      expect(plan.shouldSend).toBe(false);
      expect(plan.channel).toBeNull();
      expect(plan.reason).toContain("Already checked in");
    });
  });
});
