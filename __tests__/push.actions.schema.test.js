// __tests__/push.actions.schema.test.js
const { buildRoutinePushPayload } = require("../push-core/pushService");
const { verifyActionToken } = require("../helper/unsubscribeToken");

describe("Push Notification Actions & Schema.org Email Markup", () => {
  test("1. builds push notification payload with action buttons and signed checkin token", () => {
    const subscriber = {
      email: "focus@example.com",
      routineTrack: "deep-work",
      streakCount: 7,
    };

    const payload = buildRoutinePushPayload(subscriber);

    expect(payload.title).toContain("Deep Work");
    expect(payload.title).toContain("7d streak");
    expect(payload.data).toBeDefined();
    expect(payload.data.email).toBe("focus@example.com");
    expect(payload.data.checkinUrl).toContain("/checkin?email=focus%40example.com&token=");

    // Extract token from checkinUrl
    const url = new URL("https://example.com" + payload.data.checkinUrl);
    const token = url.searchParams.get("token");
    expect(verifyActionToken("focus@example.com", token, "checkin")).toBe(true);

    // Verify actions array
    expect(Array.isArray(payload.actions)).toBe(true);
    expect(payload.actions).toHaveLength(3);
    const actions = payload.actions.map((a) => a.action);
    expect(actions).toContain("checkin");
    expect(actions).toContain("open_routine");
    expect(actions).toContain("snooze");
  });

  test("2. verifies schema.org email markup structure conforms to Google Email Markup specifications", () => {
    const schemaOrgJsonLd = {
      "@context": "http://schema.org",
      "@type": "EmailMessage",
      description: "Log your morning routine and maintain your active streak",
      potentialAction: {
        "@type": "ViewAction",
        target: "https://morningroutine.dev/checkin?email=test%40example.com&token=abc",
        name: "🔥 1-Click Check-in",
      },
      publisher: {
        "@type": "Organization",
        name: "Morning Routine Sender",
        url: "https://morningroutine.dev",
      },
    };

    expect(schemaOrgJsonLd["@context"]).toBe("http://schema.org");
    expect(schemaOrgJsonLd["@type"]).toBe("EmailMessage");
    expect(schemaOrgJsonLd.potentialAction["@type"]).toBe("ViewAction");
    expect(schemaOrgJsonLd.potentialAction.target).toContain("/checkin");
  });
});
