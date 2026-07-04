const Redis = require("ioredis");
const logger = require("../logger");

// Moved out of index.js verbatim -- same connection string, same TLS option.
// Shared here so auth.controller.js (and index.js, if still needed) use the
// exact same connected client instead of opening a second connection.
const redis = new Redis(process.env.REDIS_LEAP_URL || "redis://127.0.0.1:6379", {
  tls: {}, // Required for Render Redis (enables SSL)
  // maxRetriesPerRequest: null, // prevents retry limit errors
  // enableReadyCheck: false,    // avoids ready check errors
});

redis.on("connect", () => {
  logger.info("✅ Redis connected");
});

redis.on("error", (err) => {
  logger.error("❌ Redis connection error:", err.message);
});

module.exports = redis;
