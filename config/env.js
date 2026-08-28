const logger = require("../logger");

// Vars the app cannot meaningfully function without. This list mirrors
// what's actually read in config/email-config.js, knexfile.js, and
// config/redisClient.js -- not a guess.
const REQUIRED = [
  "FROM_USER",
  "PASSWORD",
  "TRANSPORTER_HOST",
  "TRANSPORTER_PORT",
  "ADMIN_KEY",
  "CRON_API_KEY",
];

function validateEnv() {
  const missing = REQUIRED.filter((key) => !process.env[key]);

  const hasDatabaseUrl = Boolean(process.env.DATABASE_URL);
  const hasDbParts = Boolean(process.env.DB_HOST && process.env.DB_USER && process.env.DB_NAME);

  if (!hasDatabaseUrl && !hasDbParts) {
    missing.push("DATABASE_URL (or DB_HOST, DB_USER, DB_NAME)");
  }

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
