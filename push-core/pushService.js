// push-core/pushService.js
const webpush = require("web-push");
const logger = require("../logger");
const db = require("../db/knex");
const sharedData = require("../helper/shared-data");

// Initialize web-push VAPID details
function initVapid() {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  const subject = process.env.VAPID_SUBJECT || "mailto:admin@morningroutinesender.com";

  if (!publicKey || !privateKey) {
    logger.info(
      "ℹ️  VAPID keys not configured. Web push notifications disabled or running in local mode.",
    );
    return false;
  }

  try {
    webpush.setVapidDetails(subject, publicKey, privateKey);
    return true;
  } catch (err) {
    logger.warn("⚠️ Failed initializing VAPID configuration", { error: err.message });
    return false;
  }
}

/**
 * Register or update a browser push subscription
 */
async function registerSubscription(subscriberEmail, subscription, userAgent = "") {
  if (!subscriberEmail || typeof subscriberEmail !== "string") {
    throw new Error("Valid subscriber email is required for push registration");
  }

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    throw new Error("Invalid push subscription object");
  }

  const { endpoint, keys, expirationTime } = subscription;
  const { p256dh, auth } = keys;

  if (!p256dh || !auth) {
    throw new Error("Missing p256dh or auth subscription keys");
  }

  const normalizedEmail = subscriberEmail.toLowerCase().trim();
  let subscriberId = null;
  try {
    const subscriber = await db("subscribers").where("email", normalizedEmail).first();
    if (subscriber) subscriberId = subscriber.id;
  } catch (_err) {
    // Database query error fallback
  }

  const row = {
    subscriber_id: subscriberId,
    subscriber_email: normalizedEmail,
    endpoint,
    p256dh,
    auth,
    expiration_time: expirationTime ? new Date(expirationTime) : null,
    user_agent: userAgent || null,
    is_active: true,
    failed_attempts: 0,
    last_error_status: null,
    updated_at: db.fn.now(),
  };

  // Upsert on endpoint conflict
  await db("push_subscriptions").insert(row).onConflict("endpoint").merge({
    subscriber_id: row.subscriber_id,
    subscriber_email: row.subscriber_email,
    p256dh: row.p256dh,
    auth: row.auth,
    expiration_time: row.expiration_time,
    user_agent: row.user_agent,
    is_active: true,
    failed_attempts: 0,
    last_error_status: null,
    updated_at: db.fn.now(),
  });

  logger.info("📱 Push subscription registered/updated", {
    email: subscriberEmail,
    endpoint: endpoint.substring(0, 45) + "...",
  });

  return { success: true };
}

/**
 * Unsubscribe / deactivate a push subscription endpoint
 */
async function unsubscribeEndpoint(endpoint) {
  const count = await db("push_subscriptions")
    .where("endpoint", endpoint)
    .update({ is_active: false, updated_at: db.fn.now() });

  return count > 0;
}

/**
 * Build contextual notification content based on subscriber track & streak
 */
function buildRoutinePushPayload(subscriber) {
  const track = subscriber.routineTrack || subscriber.templateType || "deep-work";
  const streak = Number(subscriber.streakCount) || 0;
  const trackInfo = sharedData.getTrackContent(track);

  const streakBadge = streak > 0 ? ` 🔥 ${streak}d streak` : "";
  const title = `🌅 ${trackInfo.name}${streakBadge}`;
  const body = `${trackInfo.ritual}\nClick to start today's focus timer!`;

  return {
    title,
    body,
    icon: "/assets/mrn-brand-ico.png",
    badge: "/assets/mrn-brand-ico.png",
    tag: `morning-routine-${track}`,
    renotify: true,
    requireInteraction: true,
    data: {
      url: "/routine",
      track,
      streak,
      dashboardUrl: "/user-dashboard",
      timestamp: Date.now(),
    },
    actions: [
      { action: "open_routine", title: "⚡ Start Ritual" },
      { action: "checkin", title: "🔥 Check-in" },
      { action: "open_dashboard", title: "👤 Dashboard" },
    ],
  };
}

/**
 * Send push notification to a single subscription record with dead-endpoint pruning
 */
async function sendToSubscriptionRecord(subRecord, payloadObj) {
  const pushSubscription = {
    endpoint: subRecord.endpoint,
    keys: {
      p256dh: subRecord.p256dh,
      auth: subRecord.auth,
    },
  };

  const payloadString = JSON.stringify(payloadObj);
  const options = {
    TTL: 86400, // 24 hours time to live on push server
    urgency: "high",
  };

  try {
    await webpush.sendNotification(pushSubscription, payloadString, options);

    await db("push_subscriptions").where("id", subRecord.id).update({
      last_pushed_at: db.fn.now(),
      failed_attempts: 0,
      last_error_status: null,
    });

    return { status: "sent", id: subRecord.id };
  } catch (error) {
    const statusCode = error.statusCode || (error.endpoint && 500);
    logger.warn("⚠️ Push send failure", {
      subscriptionId: subRecord.id,
      email: subRecord.subscriber_email,
      statusCode,
      message: error.message,
    });

    // 404 Not Found or 410 Gone means the client unregistered the subscription
    if (statusCode === 404 || statusCode === 410) {
      logger.info("🗑️ Deactivating dead push subscription", {
        subscriptionId: subRecord.id,
        statusCode,
      });
      await db("push_subscriptions").where("id", subRecord.id).update({
        is_active: false,
        last_error_status: statusCode,
        updated_at: db.fn.now(),
      });
      return { status: "pruned", statusCode, id: subRecord.id };
    }

    await db("push_subscriptions")
      .where("id", subRecord.id)
      .update({
        failed_attempts: db.raw("failed_attempts + 1"),
        last_error_status: statusCode || 500,
        updated_at: db.fn.now(),
      });

    return { status: "failed", statusCode, error: error.message, id: subRecord.id };
  }
}

/**
 * Morning Wake-Up Push Dispatcher for a single subscriber
 */
async function dispatchMorningPushForSubscriber(subscriber) {
  if (!initVapid()) return { status: "skipped", reason: "vapid_not_configured" };

  const subscriptions = await db("push_subscriptions").where({
    subscriber_email: subscriber.email.toLowerCase().trim(),
    is_active: true,
  });

  if (!subscriptions || subscriptions.length === 0) {
    return { status: "skipped", reason: "no_active_push_subscriptions" };
  }

  const payload = buildRoutinePushPayload(subscriber);
  const results = await Promise.all(
    subscriptions.map((sub) => sendToSubscriptionRecord(sub, payload)),
  );

  logger.info("📱 Dispatched morning routine push alerts", {
    email: subscriber.email,
    deviceCount: subscriptions.length,
    results: results.map((r) => r.status),
  });

  return { status: "dispatched", count: subscriptions.length, results };
}

module.exports = {
  get isConfigured() {
    return initVapid();
  },
  initVapid,
  registerSubscription,
  unsubscribeEndpoint,
  buildRoutinePushPayload,
  sendToSubscriptionRecord,
  dispatchMorningPushForSubscriber,
};
