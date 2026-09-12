const validator = require("validator");
const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const { validateSubscriberInput } = require("../helper/validateSubscriber");
const emailScheduler = require("../email-core/emailScheduler");

// GET /admin/subscribers -- list everyone, including paused subscribers
// (the admin UI needs to show and toggle paused ones, not just active).
async function listSubscribers(req, res) {
  try {
    const subscribers = await sharedData.getAllUsers();
    res.json({ count: subscribers.length, subscribers });
  } catch (error) {
    logger.error("Failed to list subscribers", { error: error.message });
    res.status(500).json({ error: "Failed to list subscribers" });
  }
}

// POST /admin/subscribers
async function addSubscriber(req, res) {
  const { email, templateType, cronPattern, timezone } = req.body || {};
  const errors = validateSubscriberInput({ email, templateType, cronPattern, timezone });

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const normalizedEmail = email.trim().toLowerCase();
    const result = await sharedData.addUser({
      email: normalizedEmail,
      templateType,
      cronPattern,
      timezone,
    });

    if (result && result.created === false) {
      return res.status(409).json({ error: "Subscriber already exists" });
    }

    // Dynamic Hot-Reload: Schedule job immediately in running cron engine
    if (typeof emailScheduler.rescheduleUserJob === "function") {
      await emailScheduler.rescheduleUserJob(normalizedEmail);
    }

    res.status(201).json(result);
  } catch (error) {
    if (
      error.code === "23505" ||
      error.code === "SQLITE_CONSTRAINT" ||
      (error.message && error.message.toLowerCase().includes("already"))
    ) {
      return res.status(409).json({ error: "Subscriber already exists" });
    }
    logger.error("Failed to add subscriber", { error: error.message });
    res.status(500).json({ error: "Failed to add subscriber" });
  }
}

// PATCH /admin/subscribers/:email
// Accepts any combination of { templateType, cronPattern, timezone, isActive }.
// isActive is handled via setUserActive() (pause/resume) separately from
// the other fields via updateUser() -- kept as two distinct DB calls so the
// intent (editing preferences vs. pausing) stays explicit in shared-data.js,
// matching how those two functions were designed in the DB layer.
async function updateSubscriber(req, res) {
  // Normalized the same way addSubscriber stores it -- Postgres text
  // comparison is case-sensitive by default, so an un-normalized email
  // here could silently miss a real row and return a false 404.
  const email = (req.params.email || "").trim().toLowerCase();
  const { templateType, cronPattern, timezone, isActive } = req.body || {};

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: "Invalid email in URL" });
  }

  const errors = validateSubscriberInput({
    email, // already validated above, re-checked here for consistency
    templateType,
    cronPattern,
    timezone,
  });
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  const hasPreferenceUpdate =
    templateType !== undefined || cronPattern !== undefined || timezone !== undefined;

  if (!hasPreferenceUpdate && isActive === undefined) {
    return res.status(400).json({
      error: "Provide at least one of templateType, cronPattern, timezone, isActive",
    });
  }

  try {
    let updated = false;

    if (hasPreferenceUpdate) {
      updated =
        (await sharedData.updateUser(email, { templateType, cronPattern, timezone })) || updated;
    }
    if (isActive !== undefined) {
      updated = (await sharedData.setUserActive(email, Boolean(isActive))) || updated;
    }

    if (!updated) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    // Dynamic Hot-Reload: Re-synchronize running cron schedule for this subscriber
    if (typeof emailScheduler.rescheduleUserJob === "function") {
      await emailScheduler.rescheduleUserJob(email);
    }

    res.json({ email, updated: true });
  } catch (error) {
    logger.error("Failed to update subscriber", { error: error.message });
    res.status(500).json({ error: "Failed to update subscriber" });
  }
}

// DELETE /admin/subscribers/:email
async function deleteSubscriber(req, res) {
  const email = (req.params.email || "").trim().toLowerCase();

  if (!validator.isEmail(email)) {
    return res.status(400).json({ error: "Invalid email in URL" });
  }

  try {
    const deleted = await sharedData.removeUser(email);
    if (!deleted) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    // Dynamic Hot-Reload: Remove running cron job immediately from in-memory scheduler
    if (typeof emailScheduler.stopUserJob === "function") {
      emailScheduler.stopUserJob(email);
    }

    res.json({ email, deleted: true });
  } catch (error) {
    logger.error("Failed to delete subscriber", { error: error.message });
    res.status(500).json({ error: "Failed to delete subscriber" });
  }
}

module.exports = { listSubscribers, addSubscriber, updateSubscriber, deleteSubscriber };
