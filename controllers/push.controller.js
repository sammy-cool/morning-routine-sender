// controllers/push.controller.js
const pushService = require("../push-core/pushService");
const logger = require("../logger");
const db = require("../db/knex");

// GET /api/push/vapid-public-key
function getVapidPublicKey(req, res) {
  const publicKey = process.env.VAPID_PUBLIC_KEY;
  if (!publicKey) {
    return res.status(503).json({
      error: "Web Push not configured on this server.",
    });
  }

  res.setHeader("Cache-Control", "public, max-age=86400"); // Cache 24 hours
  return res.json({ publicKey });
}

// POST /api/push/subscribe
async function subscribe(req, res) {
  const email = req.subscriberEmail;
  const { subscription } = req.body || {};

  if (!subscription || !subscription.endpoint || !subscription.keys) {
    return res.status(400).json({ error: "Invalid subscription payload." });
  }

  try {
    const userAgent = req.headers["user-agent"] || "";
    await pushService.registerSubscription(email, subscription, userAgent);

    return res.status(201).json({
      success: true,
      message: "Push notification subscription active.",
    });
  } catch (error) {
    logger.error("Failed to save push subscription", { error: error.message, email });
    return res.status(500).json({ error: "Failed to register push subscription." });
  }
}

// POST /api/push/unsubscribe
async function unsubscribe(req, res) {
  const { endpoint } = req.body || {};
  if (!endpoint) {
    return res.status(400).json({ error: "Subscription endpoint required." });
  }

  try {
    await pushService.unsubscribeEndpoint(endpoint);
    return res.json({ success: true, message: "Push notifications unsubscribed." });
  } catch (error) {
    logger.error("Failed to remove push subscription", { error: error.message });
    return res.status(500).json({ error: "Failed to unsubscribe." });
  }
}

// POST /api/push/send-test
async function sendTestPush(req, res) {
  const email = req.subscriberEmail;
  const sharedData = require("../helper/shared-data");

  try {
    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found." });
    }

    const testPayload = {
      title: "🌅 Morning Routine Test Notification",
      body: "Instant notification link active! Click to open your live morning routine ritual.",
      icon: "/assets/mrn-brand-ico.png",
      badge: "/assets/mrn-brand-ico.png",
      tag: "morning-routine-test",
      renotify: true,
      data: {
        url: "/routine",
        dashboardUrl: "/user-dashboard",
      },
      actions: [
        { action: "open_routine", title: "⚡ Start Ritual" },
        { action: "open_dashboard", title: "👤 Dashboard" },
      ],
    };

    const subscriptions = await db("push_subscriptions").where({
      subscriber_email: email.toLowerCase().trim(),
      is_active: true,
    });

    if (subscriptions.length === 0) {
      return res.status(400).json({ error: "No active push subscriptions found on this account." });
    }

    const results = await Promise.all(
      subscriptions.map((sub) => pushService.sendToSubscriptionRecord(sub, testPayload)),
    );

    return res.json({ success: true, sent: results.length, results });
  } catch (error) {
    logger.error("Failed to send test push", { error: error.message, email });
    return res.status(500).json({ error: "Failed to trigger test push." });
  }
}

module.exports = {
  getVapidPublicKey,
  subscribe,
  unsubscribe,
  sendTestPush,
};
