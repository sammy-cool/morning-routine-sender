const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const emailTracker = require("../email-core/emailTracker");
const { validateSubscriberInput } = require("../helper/validateSubscriber");

// GET /me
async function getMe(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      // Session was valid but the row is gone (e.g. an admin deleted them
      // after they logged in). Treat as logged-out rather than a 500.
      return res.status(404).json({ error: "Subscriber not found" });
    }
    res.json(subscriber);
  } catch (error) {
    logger.error("Failed to load own subscriber record", { error: error.message });
    res.status(500).json({ error: "Failed to load your subscription" });
  }
}

// GET /me/history
async function getMyHistory(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
    const history = await emailTracker.getHistory(req.subscriberEmail, limit);
    res.json({ history });
  } catch (error) {
    logger.error("Failed to load own send history", { error: error.message });
    res.status(500).json({ error: "Failed to load your history" });
  }
}

// PATCH /me  { templateType?, routineTrack?, cronPattern?, timezone?, isActive? }
async function updateMe(req, res) {
  const { templateType, routineTrack, cronPattern, timezone, isActive } = req.body || {};

  if (
    templateType === undefined &&
    routineTrack === undefined &&
    cronPattern === undefined &&
    timezone === undefined &&
    isActive === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  // requireEmail: false -- identity here comes from the session
  // (req.subscriberEmail), never from the request body.
  const errors = validateSubscriberInput(
    { templateType, routineTrack, cronPattern, timezone },
    { requireEmail: false },
  );
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const updates = {};
    if (templateType !== undefined) updates.templateType = templateType;
    if (routineTrack !== undefined) updates.routineTrack = routineTrack;
    if (cronPattern !== undefined) updates.cronPattern = cronPattern;
    if (timezone !== undefined) updates.timezone = timezone;

    if (Object.keys(updates).length > 0) {
      await sharedData.updateUser(req.subscriberEmail, updates);
    }
    if (isActive !== undefined) {
      await sharedData.setUserActive(req.subscriberEmail, Boolean(isActive));
    }

    const updated = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!updated) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    logger.info("Subscriber updated their own preferences", {
      email: req.subscriberEmail,
    });
    res.json(updated);
  } catch (error) {
    logger.error("Failed to update own subscriber record", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to update your subscription" });
  }
}

module.exports = { getMe, getMyHistory, updateMe };
