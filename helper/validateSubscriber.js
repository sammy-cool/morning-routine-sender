const validator = require("validator");
const cron = require("node-cron");

const VALID_TEMPLATE_TYPES = ["basic"]; // only one exists in email-templates/ today

/**
 * Shared by controllers/subscribers.controller.js (admin, email required)
 * and controllers/me.controller.js (self-service, email comes from the
 * session, never from the request body -- pass requireEmail: false there).
 */
function validateSubscriberInput(
  { email, templateType, cronPattern, timezone },
  { requireEmail = true } = {},
) {
  const errors = [];

  if (requireEmail && (!email || !validator.isEmail(email))) {
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

module.exports = { VALID_TEMPLATE_TYPES, validateSubscriberInput };
