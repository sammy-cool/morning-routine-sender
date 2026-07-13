const validator = require("validator");
const cron = require("node-cron");
const logger = require("../logger");
const sharedData = require("../helper/shared-data");

const VALID_TEMPLATE_TYPES = ["basic"]; // only one exists in email-templates/ today

function validateSubscriberInput({ email, templateType, cronPattern, timezone }) {
  const errors = [];

  if (!email || !validator.isEmail(email)) {
    errors.push("A valid email is required");
  }
  if (templateType !== undefined && !VALID_TEMPLATE_TYPES.includes(templateType)) {
    errors.push(`templateType must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}`);
  }
  if (cronPattern !== undefined && !cron.validate(cronPattern)) {
    errors.push("cronPattern is not a valid cron expression");
  }
  if (timezone !== undefined && (typeof timezone !== "string" || !timezone.trim())) {
    errors.push("timezone must be a non-empty string");
  }

  return errors;
}

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
    const result = await sharedData.addUser({
      email: email.trim().toLowerCase(),
      templateType,
      cronPattern,
      timezone,
    });

    if (!result.created) {
      return res.status(409).json({ error: "Subscriber already exists" });
    }

    res.status(201).json(result);
  } catch (error) {
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
      updated = (await sharedData.updateUser(email, { templateType, cronPattern, timezone })) || updated;
    }
    if (isActive !== undefined) {
      updated = (await sharedData.setUserActive(email, Boolean(isActive))) || updated;
    }

    if (!updated) {
      return res.status(404).json({ error: "Subscriber not found" });
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
    res.json({ email, deleted: true });
  } catch (error) {
    logger.error("Failed to delete subscriber", { error: error.message });
    res.status(500).json({ error: "Failed to delete subscriber" });
  }
}

module.exports = { listSubscribers, addSubscriber, updateSubscriber, deleteSubscriber };
