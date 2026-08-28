const validator = require("validator");
const cron = require("node-cron");

const VALID_TEMPLATE_TYPES = [
  "basic",
  "default",
  "deep-work",
  "career",
  "learning",
  "mindfulness",
  "reflection",
  "executive",
  "classic",
];

const VALID_TRACKS = ["deep-work", "mindfulness", "executive", "learning", "classic"];

/**
 * Shared validator for subscriber inputs
 */
function validateSubscriberInput(
  { email, templateType, routineTrack, cronPattern, timezone },
  { requireEmail = true } = {},
) {
  const errors = [];

  if (requireEmail && (!email || !validator.isEmail(email))) {
    errors.push("A valid email is required");
  }
  if (templateType !== undefined && !VALID_TEMPLATE_TYPES.includes(templateType)) {
    errors.push(`templateType must be one of: ${VALID_TEMPLATE_TYPES.join(", ")}`);
  }
  if (
    routineTrack !== undefined &&
    !VALID_TRACKS.includes(routineTrack) &&
    !VALID_TEMPLATE_TYPES.includes(routineTrack)
  ) {
    errors.push(`routineTrack must be one of: ${VALID_TRACKS.join(", ")}`);
  }
  if (cronPattern !== undefined && !cron.validate(cronPattern)) {
    errors.push("cronPattern is not a valid cron expression");
  }

  function isValidTimezone(tz) {
    try {
      Intl.DateTimeFormat(undefined, { timeZone: tz });
      return true;
    } catch (e) {
      return false;
    }
  }

  if (timezone !== undefined && (typeof timezone !== "string" || !timezone.trim())) {
    errors.push("timezone must be a non-empty string");
  } else if (timezone && !isValidTimezone(timezone)) {
    errors.push("Invalid timezone");
  }

  return errors;
}

module.exports = { VALID_TEMPLATE_TYPES, VALID_TRACKS, validateSubscriberInput };
