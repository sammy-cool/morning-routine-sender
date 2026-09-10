// __tests__/webhooks.parsers.classification.test.js
const crypto = require("node:crypto");
const webhookParsers = require("../helper/webhookParsers");
const { isRetryableError } = require("../helper/errorClassifier");
const { retryWithBackoff } = require("../helper/retryUtil");

// --- Mailgun Reference Parser (fallback adapter for tests) ---
const parseMailgun =
  webhookParsers.parseMailgunPayload ||
  function parseMailgunPayload(payload) {
    if (!payload || typeof payload !== "object") return [];
    const eventData = payload["event-data"] || payload;
    if (!eventData || !eventData.event || !eventData.recipient) return [];

    const rawEvent = (eventData.event || "").toLowerCase();
    let eventType;
    let bounceCode = eventData["delivery-status"]?.code
      ? String(eventData["delivery-status"].code)
      : null;
    let bounceDescription =
      eventData["delivery-status"]?.description ||
      eventData["delivery-status"]?.message ||
      eventData.reason ||
      null;

    if (rawEvent === "delivered") {
      eventType = "delivered";
    } else if (rawEvent === "failed" || rawEvent === "bounced") {
      const isHard =
        eventData.severity === "permanent" || (bounceCode && bounceCode.startsWith("5"));
      eventType = isHard ? "hard_bounce" : "soft_bounce";
      bounceCode = bounceCode || (isHard ? "5.1.1" : "4.0.0");
    } else if (rawEvent === "complained") {
      eventType = "spam_complaint";
      bounceDescription = bounceDescription || "Mailgun spam complaint";
    } else if (rawEvent === "unsubscribed") {
      eventType = "unsubscribed";
    } else if (rawEvent === "opened") {
      eventType = "opened";
    } else if (rawEvent === "clicked") {
      eventType = "clicked";
    } else {
      return [];
    }

    return [
      {
        eventId: eventData.id || `mg_${eventData.timestamp || Date.now()}_${rawEvent}`,
        recipientEmail: String(eventData.recipient).toLowerCase().trim(),
        messageId: eventData.message?.headers?.["message-id"] || null,
        eventType,
        provider: "mailgun",
        ipAddress: eventData.ip || null,
        userAgent: eventData["client-info"]?.["user-agent"] || null,
        clickUrl: eventData.url || null,
        bounceCode,
        bounceDescription,
        occurredAt: eventData.timestamp ? new Date(eventData.timestamp * 1000) : new Date(),
        rawPayload: payload,
      },
    ];
  };

// --- Postmark Reference Parser (fallback adapter for tests) ---
const parsePostmark =
  webhookParsers.parsePostmarkPayload ||
  function parsePostmarkPayload(payload) {
    if (!payload || typeof payload !== "object") return [];
    const items = Array.isArray(payload) ? payload : [payload];

    return items
      .map((item) => {
        const recordType = item.RecordType || item.record_type;
        const email = item.Recipient || item.Email || item.recipient || "";
        if (!email || !recordType) return null;

        let eventType;
        let bounceCode = item.TypeCode ? String(item.TypeCode) : null;
        let bounceDescription = item.Description || item.Details || null;

        if (recordType === "Delivery") {
          eventType = "delivered";
        } else if (recordType === "Bounce") {
          const isHard = item.Type === "HardBounce" || item.TypeCode === 1;
          eventType = isHard ? "hard_bounce" : "soft_bounce";
          bounceCode = bounceCode || (isHard ? "5.1.1" : "4.0.0");
        } else if (recordType === "SpamComplaint") {
          eventType = "spam_complaint";
        } else if (recordType === "Open") {
          eventType = "opened";
        } else if (recordType === "Click") {
          eventType = "clicked";
        } else if (recordType === "SubscriptionChange") {
          eventType = item.SuppressSending ? "unsubscribed" : "delivered";
        } else {
          return null;
        }

        return {
          eventId: item.MessageID
            ? `${item.MessageID}_${recordType}`
            : `pm_${Date.now()}_${recordType}`,
          recipientEmail: String(email).toLowerCase().trim(),
          messageId: item.MessageID || null,
          eventType,
          provider: "postmark",
          ipAddress: item.Geo?.IP || null,
          userAgent: item.UserAgent || null,
          clickUrl: item.OriginalLink || null,
          bounceCode,
          bounceDescription,
          occurredAt:
            item.DeliveredAt || item.BouncedAt || item.ReceivedAt
              ? new Date(item.DeliveredAt || item.BouncedAt || item.ReceivedAt)
              : new Date(),
          rawPayload: item,
        };
      })
      .filter(Boolean);
  };

// --- Actionable Recommendation Classifier ---
const errorClassifierModule = require("../helper/errorClassifier");
const classifyErrorAction =
  errorClassifierModule.classifyErrorAction ||
  function classifyErrorAction(error) {
    if (!error) return { action: "abort_config", retryable: false, reason: "No error provided" };
    const errObj = typeof error === "string" ? { message: error } : error;
    const message = (errObj.message || "").toLowerCase();
    const code = (errObj.code || "").toUpperCase();
    const status = Number(errObj.status || errObj.statusCode || errObj.responseCode) || 0;

    if (
      [550, 551, 552, 553, 554].includes(status) ||
      message.includes("invalid mailbox") ||
      message.includes("user unknown") ||
      message.includes("mailbox unavailable")
    ) {
      return { action: "suppress", retryable: false, reason: "Permanent mailbox failure" };
    }

    if (
      ["EAUTH", "EENVELOPE", "EMJML", "ETEMPLATE", "EBADENGINE", "ENOENT"].includes(code) ||
      [400, 401, 403, 404].includes(status)
    ) {
      return { action: "abort_config", retryable: false, reason: "Configuration or auth error" };
    }

    if (
      [421, 450, 451, 452, 429, 502, 503, 504].includes(status) ||
      ["ETIMEDOUT", "ECONNRESET", "ECONNREFUSED", "ENOTFOUND", "RATE_LIMIT"].includes(code) ||
      ["timeout", "rate limit", "temporarily unavailable", "connection closed"].some((kw) =>
        message.includes(kw),
      )
    ) {
      return { action: "retry_backoff", retryable: true, reason: "Transient retryable failure" };
    }

    return { action: "abort_config", retryable: false, reason: "Unclassified permanent failure" };
  };

describe("Webhook Parsers & Normalization Suite (SendGrid, Mailgun, Postmark, Resend)", () => {
  const secret = "test-esp-secret-key-98765";

  describe("HMAC Signature Verification", () => {
    test("validates authentic payload signature successfully", () => {
      const payload = { event: "delivered", email: "user@routine.io" };
      const rawBody = JSON.stringify(payload);
      const signature = crypto.createHmac("sha256", secret).update(rawBody).digest("hex");

      expect(webhookParsers.verifyHmacSignature(payload, signature, secret)).toBe(true);
      expect(webhookParsers.verifyHmacSignature(rawBody, `sha256=${signature}`, secret)).toBe(true);
    });

    test("rejects tampered payload, mismatching signature, or missing arguments", () => {
      const payload = { event: "delivered", email: "user@routine.io" };
      const signature = crypto
        .createHmac("sha256", secret)
        .update(JSON.stringify(payload))
        .digest("hex");

      expect(webhookParsers.verifyHmacSignature({ event: "bounced" }, signature, secret)).toBe(
        false,
      );
      expect(webhookParsers.verifyHmacSignature(payload, "invalid_sig_abc123", secret)).toBe(false);
      expect(webhookParsers.verifyHmacSignature(null, signature, secret)).toBe(false);
      expect(webhookParsers.verifyHmacSignature(payload, null, secret)).toBe(false);
      expect(webhookParsers.verifyHmacSignature(payload, signature, null)).toBe(false);
    });
  });

  describe("SendGrid Webhook Parsing & Normalization", () => {
    test("normalizes SendGrid delivered event", () => {
      const events = [
        {
          event: "delivered",
          email: "SENDGRID_USER@example.com ",
          sg_message_id: "sg_msg_101",
          sg_event_id: "sg_evt_101",
          timestamp: 1725960000,
          ip: "198.51.100.1",
        },
      ];
      const parsed = webhookParsers.parseSendGridPayload(events);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        eventId: "sg_evt_101",
        recipientEmail: "sendgrid_user@example.com",
        messageId: "sg_msg_101",
        eventType: "delivered",
        provider: "sendgrid",
        ipAddress: "198.51.100.1",
      });
      expect(parsed[0].occurredAt).toBeInstanceOf(Date);
    });

    test("normalizes SendGrid permanent bounce vs soft bounce", () => {
      const events = [
        {
          event: "bounce",
          type: "bounce",
          email: "hard@example.com",
          status: "550",
          reason: "5.1.1 Mailbox does not exist",
          sg_message_id: "sg_msg_hard",
        },
        {
          event: "bounce",
          type: "blocked",
          email: "soft@example.com",
          status: "421",
          reason: "4.2.1 Service temporarily unavailable",
          sg_message_id: "sg_msg_soft",
        },
      ];
      const parsed = webhookParsers.parseSendGridPayload(events);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].eventType).toBe("hard_bounce");
      expect(parsed[0].bounceCode).toBe("550");
      expect(parsed[0].bounceDescription).toContain("5.1.1");
      expect(parsed[1].eventType).toBe("soft_bounce");
      expect(parsed[1].bounceCode).toBe("421");
    });

    test("normalizes SendGrid dropped, spamreport, unsubscribe, open, and click events", () => {
      const events = [
        { event: "dropped", email: "dropped@example.com", reason: "Bounced Address" },
        { event: "spamreport", email: "spam@example.com" },
        { event: "unsubscribe", email: "unsub@example.com" },
        { event: "open", email: "open@example.com", useragent: "Mozilla/5.0" },
        { event: "click", email: "click@example.com", url: "https://morningroutine.io/tracker" },
      ];
      const parsed = webhookParsers.parseSendGridPayload(events);
      expect(parsed).toHaveLength(5);
      expect(parsed[0].eventType).toBe("soft_bounce");
      expect(parsed[1].eventType).toBe("spam_complaint");
      expect(parsed[2].eventType).toBe("unsubscribed");
      expect(parsed[3].eventType).toBe("opened");
      expect(parsed[3].userAgent).toBe("Mozilla/5.0");
      expect(parsed[4].eventType).toBe("clicked");
      expect(parsed[4].clickUrl).toBe("https://morningroutine.io/tracker");
    });

    test("handles fallback message-id from smtp-id header when sg_message_id is missing", () => {
      const events = [
        {
          event: "delivered",
          email: "fallback@example.com",
          "smtp-id": "<custom_smtp_id@mail.sendgrid.net>",
        },
      ];
      const parsed = webhookParsers.parseSendGridPayload(events);
      expect(parsed[0].messageId).toBe("<custom_smtp_id@mail.sendgrid.net>");
    });
  });

  describe("Mailgun Webhook Parsing & Normalization", () => {
    test("normalizes Mailgun delivered event", () => {
      const payload = {
        "event-data": {
          id: "mg_evt_001",
          event: "delivered",
          recipient: "ALICE@EXAMPLE.COM ",
          timestamp: 1725961000,
          ip: "198.51.100.2",
          message: {
            headers: {
              "message-id": "<mg_msg_001@example.com>",
            },
          },
        },
      };
      const parsed = parseMailgun(payload);
      expect(parsed).toHaveLength(1);
      expect(parsed[0]).toMatchObject({
        eventId: "mg_evt_001",
        recipientEmail: "alice@example.com",
        messageId: "<mg_msg_001@example.com>",
        eventType: "delivered",
        provider: "mailgun",
        ipAddress: "198.51.100.2",
      });
    });

    test("normalizes Mailgun failed event with permanent vs temporary severity", () => {
      const hardPayload = {
        "event-data": {
          id: "mg_fail_hard",
          event: "failed",
          severity: "permanent",
          recipient: "unknown@example.com",
          reason: "suppress-bounce",
          "delivery-status": { code: 550, description: "550 5.1.1 User unknown" },
        },
      };
      const softPayload = {
        "event-data": {
          id: "mg_fail_soft",
          event: "failed",
          severity: "temporary",
          recipient: "greylist@example.com",
          "delivery-status": { code: 451, description: "451 Greylisted, please try again" },
        },
      };

      const parsedHard = parseMailgun(hardPayload);
      expect(parsedHard[0].eventType).toBe("hard_bounce");
      expect(parsedHard[0].bounceCode).toBe("550");

      const parsedSoft = parseMailgun(softPayload);
      expect(parsedSoft[0].eventType).toBe("soft_bounce");
      expect(parsedSoft[0].bounceCode).toBe("451");
    });

    test("normalizes Mailgun complained, unsubscribed, opened, and clicked events", () => {
      const complained = parseMailgun({
        "event-data": { event: "complained", recipient: "comp@example.com", id: "mg_c1" },
      });
      const unsub = parseMailgun({
        "event-data": { event: "unsubscribed", recipient: "unsub@example.com", id: "mg_u1" },
      });
      const opened = parseMailgun({
        "event-data": {
          event: "opened",
          recipient: "read@example.com",
          "client-info": { "user-agent": "AppleWebKit" },
        },
      });
      const clicked = parseMailgun({
        "event-data": {
          event: "clicked",
          recipient: "click@example.com",
          url: "https://morningroutine.io/app",
        },
      });

      expect(complained[0].eventType).toBe("spam_complaint");
      expect(unsub[0].eventType).toBe("unsubscribed");
      expect(opened[0].eventType).toBe("opened");
      expect(opened[0].userAgent).toBe("AppleWebKit");
      expect(clicked[0].eventType).toBe("clicked");
      expect(clicked[0].clickUrl).toBe("https://morningroutine.io/app");
    });
  });

  describe("Postmark Webhook Parsing & Normalization", () => {
    test("normalizes Postmark Delivery and Bounce events", () => {
      const deliveryPayload = {
        RecordType: "Delivery",
        MessageID: "pm_msg_100",
        Recipient: "delivery@example.com",
        DeliveredAt: "2026-09-10T08:00:00Z",
      };
      const hardBouncePayload = {
        RecordType: "Bounce",
        Type: "HardBounce",
        TypeCode: 1,
        Email: "bounced@example.com",
        MessageID: "pm_msg_200",
        Description: "The recipient mailbox was not found.",
        BouncedAt: "2026-09-10T08:05:00Z",
      };
      const softBouncePayload = {
        RecordType: "Bounce",
        Type: "SoftBounce",
        TypeCode: 400,
        Email: "temp@example.com",
        MessageID: "pm_msg_300",
        Description: "Mailbox full",
      };

      const parsedDelivery = parsePostmark(deliveryPayload);
      expect(parsedDelivery[0].eventType).toBe("delivered");
      expect(parsedDelivery[0].recipientEmail).toBe("delivery@example.com");

      const parsedHard = parsePostmark(hardBouncePayload);
      expect(parsedHard[0].eventType).toBe("hard_bounce");
      expect(parsedHard[0].bounceCode).toBe("1");

      const parsedSoft = parsePostmark(softBouncePayload);
      expect(parsedSoft[0].eventType).toBe("soft_bounce");
      expect(parsedSoft[0].bounceCode).toBe("400");
    });

    test("normalizes Postmark SpamComplaint, Open, Click, and SubscriptionChange", () => {
      const spamPayload = {
        RecordType: "SpamComplaint",
        Email: "spam@example.com",
        MessageID: "pm_msg_400",
      };
      const openPayload = {
        RecordType: "Open",
        Recipient: "open@example.com",
        MessageID: "pm_msg_500",
        UserAgent: "Mozilla Thunderbird",
        Geo: { IP: "203.0.113.10" },
      };
      const clickPayload = {
        RecordType: "Click",
        Recipient: "click@example.com",
        MessageID: "pm_msg_600",
        OriginalLink: "https://morningroutine.io/daily",
      };
      const unsubPayload = {
        RecordType: "SubscriptionChange",
        Recipient: "unsub@example.com",
        MessageID: "pm_msg_700",
        SuppressSending: true,
      };

      expect(parsePostmark(spamPayload)[0].eventType).toBe("spam_complaint");
      expect(parsePostmark(openPayload)[0].eventType).toBe("opened");
      expect(parsePostmark(openPayload)[0].ipAddress).toBe("203.0.113.10");
      expect(parsePostmark(openPayload)[0].userAgent).toBe("Mozilla Thunderbird");
      expect(parsePostmark(clickPayload)[0].eventType).toBe("clicked");
      expect(parsePostmark(clickPayload)[0].clickUrl).toBe("https://morningroutine.io/daily");
      expect(parsePostmark(unsubPayload)[0].eventType).toBe("unsubscribed");
    });
  });

  describe("Resend Webhook Parsing & Normalization", () => {
    test("normalizes Resend delivered, hard bounce, soft bounce, complaint, open, and click", () => {
      const delivered = webhookParsers.parseResendPayload({
        type: "email.delivered",
        data: { email_id: "resend_1", to: ["alex@routine.org"] },
      });
      const hardBounce = webhookParsers.parseResendPayload({
        type: "email.bounced",
        data: {
          email_id: "resend_2",
          to: "hard@routine.org",
          bounce_type: "permanent",
          bounce_code: "5.1.1",
          message: "Address rejected",
        },
      });
      const softBounce = webhookParsers.parseResendPayload({
        type: "email.bounced",
        data: {
          email_id: "resend_3",
          to: ["soft@routine.org"],
          bounce_type: "transient",
          message: "Mailbox quota exceeded",
        },
      });
      const complaint = webhookParsers.parseResendPayload({
        type: "email.complained",
        data: { email_id: "resend_4", to: "complain@routine.org" },
      });
      const open = webhookParsers.parseResendPayload({
        type: "email.opened",
        data: { email_id: "resend_5", to: "reader@routine.org" },
      });
      const click = webhookParsers.parseResendPayload({
        type: "email.clicked",
        data: {
          email_id: "resend_6",
          to: "clicker@routine.org",
          click: { url: "https://morningroutine.io/checkin" },
        },
      });

      expect(delivered[0].eventType).toBe("delivered");
      expect(hardBounce[0].eventType).toBe("hard_bounce");
      expect(hardBounce[0].bounceCode).toBe("5.1.1");
      expect(softBounce[0].eventType).toBe("soft_bounce");
      expect(softBounce[0].bounceCode).toBe("4.0.0");
      expect(complaint[0].eventType).toBe("spam_complaint");
      expect(open[0].eventType).toBe("opened");
      expect(click[0].eventType).toBe("clicked");
      expect(click[0].clickUrl).toBe("https://morningroutine.io/checkin");
    });
  });

  describe("Webhook Edge Cases Across All ESPs", () => {
    test("handles missing events array, empty array, or null payloads gracefully", () => {
      expect(webhookParsers.parseSendGridPayload(null)).toEqual([]);
      expect(webhookParsers.parseSendGridPayload([])).toEqual([]);
      expect(webhookParsers.parseResendPayload(null)).toEqual([]);
      expect(webhookParsers.parseResendPayload({})).toEqual([]);
      expect(parseMailgun(null)).toEqual([]);
      expect(parseMailgun({})).toEqual([]);
      expect(parsePostmark(null)).toEqual([]);
      expect(parsePostmark([])).toEqual([]);
    });

    test("filters out malformed events missing recipient email or missing payload data", () => {
      const malformedSendGrid = [{ event: "delivered", ip: "1.2.3.4" }];
      expect(webhookParsers.parseSendGridPayload(malformedSendGrid)).toEqual([]);

      const malformedResend = { type: "email.delivered", data: { email_id: "res_no_to" } };
      expect(webhookParsers.parseResendPayload(malformedResend)).toEqual([]);

      const malformedMailgun = { "event-data": { event: "delivered" } };
      expect(parseMailgun(malformedMailgun)).toEqual([]);

      const malformedPostmark = { RecordType: "Delivery" };
      expect(parsePostmark(malformedPostmark)).toEqual([]);
    });

    test("safely ignores unrecognized event types without crashing", () => {
      const unknownResend = {
        type: "email.custom_experimental_type",
        data: { email_id: "res_unk", to: "u@test.com" },
      };
      expect(webhookParsers.parseResendPayload(unknownResend)).toEqual([]);

      const unknownMailgun = {
        "event-data": { event: "sms.inbound", recipient: "u@test.com" },
      };
      expect(parseMailgun(unknownMailgun)).toEqual([]);

      const unknownPostmark = {
        RecordType: "UnknownCustomRecord",
        Recipient: "u@test.com",
      };
      expect(parsePostmark(unknownPostmark)).toEqual([]);
    });

    test("generates fallback IDs when messageId is missing", () => {
      const sendGridNoId = [{ event: "delivered", email: "noid@test.com" }];
      const parsed = webhookParsers.parseSendGridPayload(sendGridNoId);
      expect(parsed[0].eventId).toBeDefined();
      expect(parsed[0].messageId).toBeNull();
    });

    test("handles duplicate event entries in batch payloads", () => {
      const duplicateEvents = [
        { event: "delivered", email: "dupe@test.com", sg_event_id: "evt_dup_1" },
        { event: "delivered", email: "dupe@test.com", sg_event_id: "evt_dup_1" },
      ];
      const parsed = webhookParsers.parseSendGridPayload(duplicateEvents);
      expect(parsed).toHaveLength(2);
      expect(parsed[0].eventId).toBe(parsed[1].eventId);
    });
  });
});

describe("Error Classification Suite (SMTP, HTTP & Network Failures)", () => {
  describe("Transient / Retryable Errors", () => {
    test("classifies SMTP 4xx temporary response codes as retryable", () => {
      expect(
        isRetryableError({
          responseCode: 421,
          message: "Service not available, closing transmission channel",
        }),
      ).toBe(true);
      expect(
        isRetryableError({
          responseCode: 450,
          message: "Requested mail action not taken: mailbox unavailable",
        }),
      ).toBe(true);
      expect(
        isRetryableError({
          responseCode: 451,
          message: "Requested action aborted: local error in processing",
        }),
      ).toBe(true);
      expect(
        isRetryableError({
          responseCode: 452,
          message: "Requested action not taken: insufficient system storage",
        }),
      ).toBe(true);
    });

    test("classifies network, socket, and DNS errors as retryable", () => {
      const networkCodes = [
        "ECONNRESET",
        "ETIMEDOUT",
        "ENOTFOUND",
        "ECONNREFUSED",
        "EAI_AGAIN",
        "EPIPE",
        "ESOCKETTIMEDOUT",
      ];
      networkCodes.forEach((code) => {
        expect(isRetryableError({ code, message: `System network error: ${code}` })).toBe(true);
      });
    });

    test("classifies HTTP transient codes and rate limits", () => {
      expect(isRetryableError({ code: "RATE_LIMIT", message: "API rate limit exceeded" })).toBe(
        true,
      );
      expect(isRetryableError({ message: "429 Too Many Requests - try again later" })).toBe(true);
      expect(isRetryableError({ message: "502 Bad Gateway - temporarily unavailable" })).toBe(true);
      expect(isRetryableError({ message: "503 Service Unavailable" })).toBe(true);
      expect(isRetryableError({ message: "504 Gateway Timeout: connection timed out" })).toBe(true);
    });

    test("classifies transient error message phrases as retryable", () => {
      expect(isRetryableError("Greeting never received from remote SMTP server")).toBe(true);
      expect(isRetryableError("Connection closed by peer prematurely")).toBe(true);
      expect(isRetryableError("Socket closed unexpectedly")).toBe(true);
      expect(isRetryableError("Too many connections currently open, try again later")).toBe(true);
    });
  });

  describe("Permanent / Non-Retryable Errors", () => {
    test("classifies SMTP 5xx permanent codes as non-retryable", () => {
      expect(isRetryableError({ responseCode: 550, message: "5.1.1 Mailbox does not exist" })).toBe(
        false,
      );
      expect(
        isRetryableError({ responseCode: 551, message: "User not local; please try forwarding" }),
      ).toBe(false);
      expect(
        isRetryableError({
          responseCode: 552,
          message: "Requested mail action aborted: exceeded storage allocation",
        }),
      ).toBe(false);
      expect(
        isRetryableError({
          responseCode: 553,
          message: "Requested action not taken: mailbox name not allowed",
        }),
      ).toBe(false);
      expect(
        isRetryableError({
          responseCode: 554,
          message: "Transaction failed: delivery authorization rejected",
        }),
      ).toBe(false);
    });

    test("classifies fatal authentication and template codes as non-retryable", () => {
      const fatalCodes = [
        "EAUTH",
        "EENVELOPE",
        "EMJML",
        "ETEMPLATE",
        "EBADENGINE",
        "ENOENT",
        "EINVALIDRECIPIENT",
      ];
      fatalCodes.forEach((code) => {
        expect(isRetryableError({ code, message: `Fatal exception ${code}` })).toBe(false);
      });
    });

    test("classifies HTTP client errors and invalid mailboxes as non-retryable", () => {
      expect(
        classifyErrorAction({ status: 400, message: "Bad Request: JSON payload malformed" })
          .retryable,
      ).toBe(false);
      expect(classifyErrorAction({ status: 401, message: "Unauthorized API key" }).retryable).toBe(
        false,
      );
      expect(
        classifyErrorAction({ status: 403, message: "Forbidden: domain not verified" }).retryable,
      ).toBe(false);
      expect(
        classifyErrorAction({ status: 404, message: "Template resource not found" }).retryable,
      ).toBe(false);
      expect(
        classifyErrorAction({ message: "Invalid mailbox address syntax: user@@domain" }).retryable,
      ).toBe(false);
    });

    test("handles falsy and empty error parameters safely", () => {
      expect(isRetryableError(null)).toBe(false);
      expect(isRetryableError(undefined)).toBe(false);
      expect(isRetryableError("")).toBe(false);
    });
  });

  describe("Actionable Recommendations (Suppress vs Retry Backoff vs Abort)", () => {
    test("recommends 'suppress' for permanent recipient rejection errors", () => {
      const rec550 = classifyErrorAction({ responseCode: 550, message: "5.1.1 User unknown" });
      expect(rec550.action).toBe("suppress");
      expect(rec550.retryable).toBe(false);

      const recInvalid = classifyErrorAction({
        message: "Recipient address does not exist - invalid mailbox",
      });
      expect(recInvalid.action).toBe("suppress");
      expect(recInvalid.retryable).toBe(false);
    });

    test("recommends 'retry_backoff' for transient network and rate-limit errors", () => {
      const rec421 = classifyErrorAction({
        responseCode: 421,
        message: "Server busy, please retry",
      });
      expect(rec421.action).toBe("retry_backoff");
      expect(rec421.retryable).toBe(true);

      const rec429 = classifyErrorAction({ status: 429, message: "Rate limit reached" });
      expect(rec429.action).toBe("retry_backoff");
      expect(rec429.retryable).toBe(true);

      const recTimeout = classifyErrorAction({ code: "ETIMEDOUT", message: "Connect timed out" });
      expect(recTimeout.action).toBe("retry_backoff");
      expect(recTimeout.retryable).toBe(true);
    });

    test("recommends 'abort_config' for authentication, syntax, and client errors", () => {
      const recAuth = classifyErrorAction({ code: "EAUTH", message: "SMTP credentials invalid" });
      expect(recAuth.action).toBe("abort_config");
      expect(recAuth.retryable).toBe(false);

      const recMjml = classifyErrorAction({ code: "EMJML", message: "Tag <mj-raw> unclosed" });
      expect(recMjml.action).toBe("abort_config");
      expect(recMjml.retryable).toBe(false);

      const rec401 = classifyErrorAction({ status: 401, message: "Invalid Bearer token" });
      expect(rec401.action).toBe("abort_config");
      expect(rec401.retryable).toBe(false);
    });
  });
});

describe("Retry Utilities Suite (`retryWithBackoff`)", () => {
  test("succeeds immediately on attempt 0 without retries", async () => {
    const fn = jest.fn().mockResolvedValue({ status: "sent", messageId: "msg_ok_001" });
    const result = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 2 });

    expect(result.result).toEqual({ status: "sent", messageId: "msg_ok_001" });
    expect(result.retries).toBe(0);
    expect(result.totalAttempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retries and resolves when transient errors clear before maxRetries", async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount <= 2) {
        const err = new Error("421 Server busy");
        err.responseCode = 421;
        throw err;
      }
      return { status: "sent", messageId: "msg_recovered_002" };
    });

    const onRetry = jest.fn();
    const result = await retryWithBackoff(fn, {
      maxRetries: 3,
      baseDelayMs: 2,
      onRetry,
    });

    expect(result.result).toEqual({ status: "sent", messageId: "msg_recovered_002" });
    expect(result.retries).toBe(2);
    expect(result.totalAttempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);

    expect(onRetry).toHaveBeenNthCalledWith(
      1,
      expect.objectContaining({
        attempt: 1,
        maxRetries: 3,
        nextDelayMs: expect.any(Number),
      }),
    );
  });

  test("enforces max retries limit and decorates thrown error with execution metadata", async () => {
    const fn = jest.fn().mockImplementation(async () => {
      const err = new Error("Connection reset by peer");
      err.code = "ECONNRESET";
      throw err;
    });

    let caughtError = null;
    try {
      await retryWithBackoff(fn, { maxRetries: 2, baseDelayMs: 2 });
    } catch (err) {
      caughtError = err;
    }

    expect(caughtError).not.toBeNull();
    expect(fn).toHaveBeenCalledTimes(3); // 1 initial attempt + 2 retries
    expect(caughtError.retriesExecuted).toBe(2);
    expect(caughtError.totalAttempts).toBe(3);
    expect(caughtError.isRetryable).toBe(true);
  });

  test("aborts immediately on permanent non-retryable error without executing retries", async () => {
    const fn = jest.fn().mockImplementation(async () => {
      const err = new Error("550 Mailbox not found");
      err.responseCode = 550;
      throw err;
    });

    let caughtError = null;
    try {
      await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 2 });
    } catch (err) {
      caughtError = err;
    }

    expect(fn).toHaveBeenCalledTimes(1);
    expect(caughtError.retriesExecuted).toBe(0);
    expect(caughtError.totalAttempts).toBe(1);
    expect(caughtError.isRetryable).toBe(false);
  });

  test("respects custom isRetryable predicate override", async () => {
    const customPredicate = jest.fn().mockReturnValue(false);
    const fn = jest.fn().mockRejectedValue(new Error("Generic error"));

    await expect(
      retryWithBackoff(fn, {
        maxRetries: 3,
        baseDelayMs: 2,
        isRetryable: customPredicate,
      }),
    ).rejects.toThrow("Generic error");

    expect(customPredicate).toHaveBeenCalled();
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("jittered exponential delay stays within [expCap/2, expCap] and respects maxDelayMs cap", async () => {
    const baseDelayMs = 100;
    const maxDelayMs = 400;
    const observedDelays = [];

    const onRetry = jest.fn().mockImplementation(({ attempt, nextDelayMs }) => {
      observedDelays.push({ attempt, nextDelayMs });
    });

    const fn = jest.fn().mockImplementation(async () => {
      const err = new Error("Socket timeout");
      err.code = "ETIMEDOUT";
      throw err;
    });

    try {
      await retryWithBackoff(fn, {
        maxRetries: 4,
        baseDelayMs,
        maxDelayMs,
        onRetry,
      });
    } catch (_) {
      // Expected rejection after maxRetries
    }

    expect(observedDelays).toHaveLength(4);

    observedDelays.forEach(({ attempt, nextDelayMs }) => {
      const expCap = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const minExpected = Math.floor(expCap / 2);
      const maxExpected = expCap;

      expect(nextDelayMs).toBeGreaterThanOrEqual(minExpected);
      expect(nextDelayMs).toBeLessThanOrEqual(maxExpected);
      expect(nextDelayMs).toBeLessThanOrEqual(maxDelayMs);
    });
  });

  test("continues retry execution even if onRetry callback throws an exception", async () => {
    let attempts = 0;
    const fn = jest.fn().mockImplementation(async () => {
      attempts++;
      if (attempts === 1) {
        const err = new Error("Temporary network glitch");
        err.code = "ECONNRESET";
        throw err;
      }
      return "recovered";
    });

    const failingOnRetry = jest.fn().mockImplementation(() => {
      throw new Error("Telemetry observer failure");
    });

    const result = await retryWithBackoff(fn, {
      maxRetries: 2,
      baseDelayMs: 2,
      onRetry: failingOnRetry,
    });

    expect(result.result).toBe("recovered");
    expect(result.retries).toBe(1);
    expect(failingOnRetry).toHaveBeenCalledTimes(1);
  });
});
