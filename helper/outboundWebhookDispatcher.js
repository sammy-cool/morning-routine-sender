const crypto = require("node:crypto");
const logger = require("../logger");
const db = require("../db/knex");

const DEFAULT_TIMEOUT_MS = 5000;

/**
 * Calculates HMAC-SHA256 signature for payload string
 * @param {string} payloadString
 * @param {string} secret
 * @returns {string} Signature in `sha256=<hex>` format
 */
function computeSignature(payloadString, secret) {
  if (!secret) return "";
  const hmac = crypto.createHmac("sha256", secret).update(payloadString).digest("hex");
  return `sha256=${hmac}`;
}

/**
 * Sends a single outbound webhook HTTP POST request with 5000ms timeout
 *
 * @param {Object} options
 * @param {string} options.webhookUrl Destination webhook URL
 * @param {string} [options.webhookSecret] Shared secret for HMAC-SHA256 signature
 * @param {string} options.event Event name ('routine.completed', 'journal.logged', 'test.ping')
 * @param {number} [options.streak=0] Current streak count
 * @param {string} [options.track='deep-work'] Subscriber persona track
 * @param {Object} [options.data={}] Payload data specific to event
 * @param {string} [options.timestamp] ISO-8601 timestamp string
 * @returns {Promise<{ success: boolean, status?: number, error?: string, event?: string, timestamp?: string }>}
 */
async function sendOutboundWebhook({
  webhookUrl,
  webhookSecret,
  event,
  streak = 0,
  track = "deep-work",
  data = {},
  timestamp = new Date().toISOString(),
}) {
  if (!webhookUrl || typeof webhookUrl !== "string") {
    return { success: false, error: "Missing or invalid webhook endpoint URL" };
  }

  const payload = {
    event,
    timestamp,
    streak: Number(streak) || 0,
    track: String(track || "deep-work"),
    data: data || {},
  };

  const payloadString = JSON.stringify(payload);
  const headers = {
    "Content-Type": "application/json",
    "User-Agent": "MorningRoutineSender-OutboundWebhook/1.0",
    "X-MorningRoutine-Event": event,
    "X-MorningRoutine-Timestamp": timestamp,
  };

  if (webhookSecret) {
    headers["X-MorningRoutine-Signature"] = computeSignature(payloadString, webhookSecret);
  }

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT_MS);

    const response = await fetch(webhookUrl, {
      method: "POST",
      headers,
      body: payloadString,
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const responseBody = await response.text().catch(() => "");

    if (!response.ok) {
      logger.warn("Outbound webhook destination returned non-2xx status", {
        url: webhookUrl,
        event,
        status: response.status,
        response: responseBody.slice(0, 500),
      });
      return {
        success: false,
        status: response.status,
        error: `HTTP ${response.status}: ${responseBody.slice(0, 200)}`,
      };
    }

    logger.info("✅ Outbound webhook delivered successfully", {
      url: webhookUrl,
      event,
      status: response.status,
    });

    return {
      success: true,
      status: response.status,
      event,
      timestamp,
    };
  } catch (error) {
    const isTimeout = error.name === "AbortError";
    const errorMessage = isTimeout
      ? `Webhook delivery timed out after ${DEFAULT_TIMEOUT_MS}ms`
      : error.message;

    logger.error("❌ Outbound webhook delivery failed", {
      url: webhookUrl,
      event,
      error: errorMessage,
    });

    return {
      success: false,
      error: errorMessage,
      isTimeout,
    };
  }
}

/**
 * Dispatches outbound webhook for a subscriber record or email (non-blocking)
 *
 * @param {Object|string} subscriberOrEmail
 * @param {string} event
 * @param {Object} [customData={}]
 * @returns {Promise<{ dispatched: boolean, success?: boolean, reason?: string, error?: string }>}
 */
async function dispatchWebhookForSubscriber(subscriberOrEmail, event, customData = {}) {
  try {
    let subscriber = subscriberOrEmail;
    if (typeof subscriberOrEmail === "string") {
      subscriber = await db("subscribers")
        .where({ email: subscriberOrEmail.toLowerCase().trim() })
        .first();
    } else if (
      subscriber &&
      subscriber.webhook_endpoint_url === undefined &&
      subscriber.webhookEndpointUrl === undefined
    ) {
      const email = subscriber.email;
      if (email) {
        const fullSub = await db("subscribers")
          .where({ email: email.toLowerCase().trim() })
          .first();
        if (fullSub) subscriber = { ...subscriber, ...fullSub };
      }
    }

    if (!subscriber) {
      return { dispatched: false, reason: "subscriber_not_found" };
    }

    const webhookUrl = subscriber.webhook_endpoint_url || subscriber.webhookEndpointUrl;
    const webhookSecret = subscriber.webhook_secret || subscriber.webhookSecret;
    const isEnabled =
      subscriber.webhook_enabled !== undefined
        ? Boolean(subscriber.webhook_enabled)
        : Boolean(subscriber.webhookEnabled);

    if (!isEnabled || !webhookUrl) {
      return { dispatched: false, reason: "webhook_disabled_or_missing_url" };
    }

    const streak =
      subscriber.streak_count !== undefined
        ? Number(subscriber.streak_count)
        : Number(subscriber.streakCount) || 0;
    const track =
      subscriber.routine_track ||
      subscriber.routineTrack ||
      subscriber.template_type ||
      subscriber.templateType ||
      "deep-work";

    const result = await sendOutboundWebhook({
      webhookUrl,
      webhookSecret,
      event,
      streak,
      track,
      data: {
        subscriberEmail: subscriber.email,
        ...customData,
      },
    });

    return { dispatched: true, ...result };
  } catch (error) {
    logger.error("Non-blocking error in dispatchWebhookForSubscriber", {
      event,
      error: error.message,
    });
    return { dispatched: false, success: false, error: error.message };
  }
}

/**
 * Sends a test ping to verify an endpoint URL and secret configuration
 *
 * @param {Object} options
 * @param {string} options.webhookUrl
 * @param {string} [options.webhookSecret]
 * @param {string} [options.subscriberEmail]
 */
async function testOutboundWebhook({ webhookUrl, webhookSecret, subscriberEmail }) {
  const dummyData = {
    test: true,
    message: "Morning Routine Outbound Webhook Verification Ping",
    subscriberEmail: subscriberEmail || "subscriber@example.com",
    pingedAt: new Date().toISOString(),
  };

  return await sendOutboundWebhook({
    webhookUrl,
    webhookSecret,
    event: "test.ping",
    streak: 7,
    track: "deep-work",
    data: dummyData,
  });
}

module.exports = {
  computeSignature,
  sendOutboundWebhook,
  dispatchWebhookForSubscriber,
  testOutboundWebhook,
};
