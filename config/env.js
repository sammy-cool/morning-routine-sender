const logger = require("../logger");

// Vars the app cannot meaningfully function without. This list mirrors
// what's actually read in config/email-config.js, knexfile.js, and
// config/redisClient.js -- not a guess.
const REQUIRED = [
  "FROM_USER",
  "PASSWORD",
  "TRANSPORTER_HOST",
  "TRANSPORTER_PORT",
  "DB_HOST",
  "DB_USER",
  "DB_PASSWORD",
  "DB_NAME",
  "ADMIN_KEY",
  "CRON_API_KEY",
];

// Deliberately warn-only, not throw/exit: some of these (e.g. DB_HOST) are
// only needed once a request actually touches that subsystem, and several
// commands (npm run test:smtp, one-off scripts) don't need the full set.
// Failing hard here would be a behavior change beyond what "centralize env
// validation" was asked for -- this only makes missing config visible
// immediately in the logs instead of surfacing as a confusing error deep
// inside a route later.
function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    logger.warn(
      `⚠️  Missing environment variables (app will still start, but related features may fail): ${missing.join(", ")}`,
    );
  } else {
    logger.info("✅ All required environment variables are present");
  }

  return missing;
}

module.exports = { validateEnv, REQUIRED };
