// helper/webhookParsers.js
const crypto = require("node:crypto");
const logger = require("../logger");

/**
 * Validates HMAC SHA-256 signatures for generic and provider webhooks
 */
function verifyHmacSignature(rawBody, signatureHeader, secret) {
  if (!rawBody || !signatureHeader || !secret) return false;
  try {
    const computed = crypto
      .createHmac("sha256", secret)
      .update(typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody))
      .digest("hex");

    const cleanSig = signatureHeader
      .replace(/^sha256=/, "")
      .replace(/^t=.*,v1=/, "")
      .trim();
    const signatureBuffer = Buffer.from(cleanSig, "hex");
    const computedBuffer = Buffer.from(computed, "hex");

    if (signatureBuffer.length !== computedBuffer.length) return false;
    return crypto.timingSafeEqual(signatureBuffer, computedBuffer);
  } catch (err) {
    logger.error("HMAC verification error", { error: err.message });
    return false;
  }
}

/**
 * Normalizes Resend Webhook Payloads
 */
function parseResendPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  const { type, data, created_at } = payload;
  if (!data || !data.to) return [];

  const recipient = Array.isArray(data.to) ? data.to[0] : data.to;
  let eventType;
  let bounceCode = null;
  let bounceDescription = null;

  if (type === "email.delivered") {
    eventType = "delivered";
  } else if (type === "email.bounced") {
    const isPermanent = data.bounce_type === "permanent" || data.sub_type === "hard_bounce";
    eventType = isPermanent ? "hard_bounce" : "soft_bounce";
    bounceCode = data.bounce_code || (isPermanent ? "5.1.1" : "4.0.0");
    bounceDescription = data.message || "Resend bounce reported";
  } else if (type === "email.complained") {
    eventType = "spam_complaint";
    bounceDescription = "Spam complaint reported by recipient";
  } else if (type === "email.opened") {
    eventType = "opened";
  } else if (type === "email.clicked") {
    eventType = "clicked";
  } else {
    return [];
  }

  return [
    {
      eventId: payload.id || `resend_${data.email_id || Date.now()}_${type}`,
      recipientEmail: String(recipient).toLowerCase().trim(),
      messageId: data.email_id || null,
      eventType,
      provider: "resend",
      ipAddress: data.ip || null,
      userAgent: data.user_agent || null,
      clickUrl: data.click?.url || null,
      bounceCode,
      bounceDescription,
      occurredAt: created_at ? new Date(created_at) : new Date(),
      rawPayload: payload,
    },
  ];
}

/**
 * Normalizes SendGrid Event Webhook Payloads
 */
function parseSendGridPayload(events) {
  if (!events) return [];
  const items = Array.isArray(events) ? events : [events];

  return items
    .map((ev) => {
      let eventType = "delivered";
      const bounceCode = ev.status || null;
      const bounceDescription = ev.reason || null;

      if (ev.event === "delivered") {
        eventType = "delivered";
      } else if (ev.event === "bounce") {
        const isHard = ev.type === "bounce" || (ev.status && String(ev.status).startsWith("5"));
        eventType = isHard ? "hard_bounce" : "soft_bounce";
      } else if (ev.event === "dropped" || ev.event === "deferred") {
        eventType = "soft_bounce";
      } else if (ev.event === "spamreport") {
        eventType = "spam_complaint";
      } else if (ev.event === "open") {
        eventType = "opened";
      } else if (ev.event === "click") {
        eventType = "clicked";
      } else if (ev.event === "unsubscribe") {
        eventType = "unsubscribed";
      }

      return {
        eventId: ev.sg_event_id || `sg_${ev.sg_message_id || Date.now()}_${ev.event}`,
        recipientEmail: (ev.email || "").toLowerCase().trim(),
        messageId: ev.sg_message_id || ev["smtp-id"] || null,
        eventType,
        provider: "sendgrid",
        ipAddress: ev.ip || null,
        userAgent: ev.useragent || null,
        clickUrl: ev.url || null,
        bounceCode,
        bounceDescription,
        occurredAt: ev.timestamp ? new Date(ev.timestamp * 1000) : new Date(),
        rawPayload: ev,
      };
    })
    .filter((e) => Boolean(e.recipientEmail));
}

/**
 * Normalizes Brevo (Sendinblue) Webhook Payloads
 */
function parseBrevoPayload(payload) {
  if (!payload || typeof payload !== "object") return [];
  const event = payload.event;
  const email = (payload.email || "").toLowerCase().trim();
  if (!email) return [];

  let eventType = "delivered";
  let bounceCode = payload.code || null;
  const bounceDescription = payload.reason || null;

  if (event === "delivered") {
    eventType = "delivered";
  } else if (event === "hard_bounce") {
    eventType = "hard_bounce";
    bounceCode = bounceCode || "5.1.1";
  } else if (event === "soft_bounce" || event === "deferred") {
    eventType = "soft_bounce";
    bounceCode = bounceCode || "4.2.2";
  } else if (event === "spam" || event === "complaint") {
    eventType = "spam_complaint";
  } else if (event === "opened" || event === "unique_opened") {
    eventType = "opened";
  } else if (event === "click") {
    eventType = "clicked";
  } else if (event === "unsubscribe") {
    eventType = "unsubscribed";
  }

  return [
    {
      eventId: payload.id
        ? String(payload.id)
        : `brevo_${payload["message-id"] || Date.now()}_${event}`,
      recipientEmail: email,
      messageId: payload["message-id"] || null,
      eventType,
      provider: "brevo",
      ipAddress: payload.ip || null,
      userAgent: payload.user_agent || null,
      clickUrl: payload.link || null,
      bounceCode,
      bounceDescription,
      occurredAt: payload.date ? new Date(payload.date) : new Date(),
      rawPayload: payload,
    },
  ];
}

/**
 * Normalizes Generic SMTP / Webhook Delivery Payloads
 */
function parseGenericPayload(payload) {
  if (!payload) return [];
  const items = Array.isArray(payload) ? payload : [payload];
  return items
    .map((item) => ({
      eventId: item.eventId || `gen_${crypto.randomUUID()}`,
      recipientEmail: (item.email || item.recipient || "").toLowerCase().trim(),
      messageId: item.messageId || null,
      eventType: item.eventType || item.event || "delivered",
      provider: item.provider || "generic",
      ipAddress: item.ip || null,
      userAgent: item.userAgent || null,
      clickUrl: item.url || null,
      bounceCode: item.code || item.bounceCode || null,
      bounceDescription: item.reason || item.description || null,
      occurredAt: item.timestamp ? new Date(item.timestamp) : new Date(),
      rawPayload: item,
    }))
    .filter((e) => Boolean(e.recipientEmail));
}

module.exports = {
  verifyHmacSignature,
  parseResendPayload,
  parseSendGridPayload,
  parseBrevoPayload,
  parseGenericPayload,
};
