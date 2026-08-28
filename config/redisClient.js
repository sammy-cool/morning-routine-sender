const Redis = require("ioredis");
const RedisMock = require("ioredis-mock");
const logger = require("../logger");

// Consolidated from two previously-separate files:
//   - config/redisClient.js (the one actually wired into the app --
//     single-URL connection, always-on TLS, no mock/retry support)
//   - config/redis-config.js (never actually called anywhere, but had
//     USE_MOCK_REDIS support -- already documented in .env.example
//     despite silently not working -- plus retry backoff logic)
// This keeps the single-URL style (the right choice for a managed
// provider like Render Redis, which hands you one connection string) and
// absorbs the mock/retry features from the dead file.

function buildRedisClient() {
  if (process.env.USE_MOCK_REDIS === "true") {
    logger.info("⚠️  Using Mock Redis (development only -- not for production)");
    const mockRedis = new RedisMock();
    mockRedis.on("connect", () => logger.info("✅ Mock Redis ready"));
    return mockRedis;
  }

  // REDIS_URL is the current name. REDIS_LEAP_URL is the old Leapcell-era
  // name this app used to use -- kept as a fallback so an existing Render
  // deployment that hasn't renamed its env var yet doesn't break on
  // deploy. Rename to REDIS_URL in your Render dashboard when convenient;
  // this fallback (and warning) can be removed once that's done.
  const connectionUrl = process.env.REDIS_URL || process.env.REDIS_LEAP_URL;

  if (!connectionUrl) {
    logger.warn(
      "⚠️  No REDIS_URL (or legacy REDIS_LEAP_URL) set -- falling back to redis://127.0.0.1:6379",
    );
  } else if (!process.env.REDIS_URL && process.env.REDIS_LEAP_URL) {
    logger.warn(
      "⚠️  Using legacy REDIS_LEAP_URL -- rename this to REDIS_URL in your environment when convenient",
    );
  }

  const options = {
    retryStrategy: (times) => {
      if (times > 3) {
        logger.error("❌ Redis connection failed after 3 retries");
        return null; // stop retrying
      }
      return Math.min(times * 50, 2000);
    },
  };

  if (connectionUrl && connectionUrl.startsWith("rediss://")) {
    options.tls = {};
  }

  const redis = new Redis(connectionUrl || "redis://127.0.0.1:6379", options);

  redis.on("connect", () => {
    logger.info("✅ Redis connected");
  });

  redis.on("error", (err) => {
    logger.error("❌ Redis connection error:", err.message);
  });

  redis.on("close", () => {
    logger.info("📪 Redis connection closed");
  });

  return redis;
}

module.exports = buildRedisClient();
