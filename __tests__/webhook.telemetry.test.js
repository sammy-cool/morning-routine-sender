// __tests__/webhook.telemetry.test.js
const {
  verifyHmacSignature,
  parseResendPayload,
  parseSendGridPayload,
  parseBrevoPayload,
  parseGenericPayload,
} = require("../helper/webhookParsers");
const crypto = require("node:crypto");

describe("Webhook Parsers & Signature Verification Suite", () => {
  const secret = "test-secret-key-12345";

  test("verifyHmacSignature validates correct HMAC SHA-256 signatures", () => {
    const payload = { event: "delivered", email: "test@example.com" };
    const stringBody = JSON.stringify(payload);
    const signature = crypto.createHmac("sha256", secret).update(stringBody).digest("hex");

    expect(verifyHmacSignature(payload, signature, secret)).toBe(true);
    expect(verifyHmacSignature(payload, "invalid-sig", secret)).toBe(false);
  });

  test("parseResendPayload extracts delivered, bounced, and complaint events", () => {
    const deliveredPayload = {
      id: "evt_123",
      type: "email.delivered",
      created_at: "2026-08-28T08:00:00Z",
      data: {
        email_id: "msg_abc",
        to: ["alex@example.com"],
        ip: "192.0.2.1",
      },
    };
    const events = parseResendPayload(deliveredPayload);
    expect(events.length).toBe(1);
    expect(events[0].eventType).toBe("delivered");
    expect(events[0].recipientEmail).toBe("alex@example.com");
    expect(events[0].provider).toBe("resend");

    const bouncePayload = {
      id: "evt_456",
      type: "email.bounced",
      created_at: "2026-08-28T08:05:00Z",
      data: {
        email_id: "msg_def",
        to: ["invalid@example.com"],
        bounce_type: "permanent",
        bounce_code: "5.1.1",
        message: "User unknown",
      },
    };
    const bounceEvents = parseResendPayload(bouncePayload);
    expect(bounceEvents.length).toBe(1);
    expect(bounceEvents[0].eventType).toBe("hard_bounce");
    expect(bounceEvents[0].bounceCode).toBe("5.1.1");
  });

  test("parseSendGridPayload normalizes multiple events", () => {
    const sgEvents = [
      { event: "delivered", email: "user1@example.com", sg_event_id: "sg_1" },
      { event: "bounce", type: "bounce", email: "user2@example.com", status: "550", reason: "Blocked" },
      { event: "spamreport", email: "user3@example.com" },
    ];
    const parsed = parseSendGridPayload(sgEvents);
    expect(parsed.length).toBe(3);
    expect(parsed[0].eventType).toBe("delivered");
    expect(parsed[1].eventType).toBe("hard_bounce");
    expect(parsed[2].eventType).toBe("spam_complaint");
  });

  test("parseBrevoPayload normalizes Brevo webhook", () => {
    const brevoPayload = {
      event: "hard_bounce",
      email: "bounced@example.com",
      "message-id": "<msg123@smtp.brevo.com>",
      code: "550",
      reason: "Mailbox not found",
    };
    const parsed = parseBrevoPayload(brevoPayload);
    expect(parsed.length).toBe(1);
    expect(parsed[0].eventType).toBe("hard_bounce");
    expect(parsed[0].recipientEmail).toBe("bounced@example.com");
  });

  test("parseGenericPayload parses standard objects and arrays", () => {
    const generic = {
      email: "test@domain.org",
      eventType: "delivered",
      messageId: "m_99",
    };
    const parsed = parseGenericPayload(generic);
    expect(parsed.length).toBe(1);
    expect(parsed[0].recipientEmail).toBe("test@domain.org");
    expect(parsed[0].eventType).toBe("delivered");
  });
});
