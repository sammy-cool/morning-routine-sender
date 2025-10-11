// config/redis-config.js
const Redis = require("ioredis");
const RedisMock = require("ioredis-mock");
require("dotenv").config();

/**
 * Create Redis connection with retry logic and error handling
 * @returns {Redis} Redis instance
 */
function createRedisConnection() {
  // Use mock Redis for local development without Redis server
  if (process.env.USE_MOCK_REDIS === "true") {
    console.log(
      "⚠️  Using Mock Redis (for development only - not for production!)"
    );
    const mockRedis = new RedisMock({
      data: {
        // Pre-populate with test data if needed
      },
    });

    mockRedis.on("connect", () => {
      console.log("✅ Mock Redis ready");
    });

    return mockRedis;
  }

  // Normal Redis connection for production
  const redisConfig = {
    host: process.env.REDIS_HOST || "localhost",
    port: parseInt(process.env.REDIS_PORT || "6379", 10),
    password: process.env.REDIS_PASSWORD || undefined,
    db: parseInt(process.env.REDIS_DB || "0", 10),

    // Connection settings
    maxRetriesPerRequest: null, // Required for BullMQ
    enableReadyCheck: false,
    retryStrategy: (times) => {
      if (times > 3) {
        console.error("❌ Redis connection failed after 3 retries");
        console.log(
          "💡 Tip: Set USE_MOCK_REDIS=true in .env for local testing"
        );
        return null; // Stop retrying
      }
      const delay = Math.min(times * 50, 2000);
      return delay;
    },

    // TLS for production (e.g., Redis Cloud, Heroku Redis)
    tls:
      process.env.REDIS_TLS === "true"
        ? {
            rejectUnauthorized: false,
          }
        : undefined,
  };

  const redis = new Redis(redisConfig);

  redis.on("connect", () => {
    console.log("✅ Redis connected successfully");
  });

  redis.on("error", (error) => {
    console.error("❌ Redis connection error:", error.message);
    console.log("💡 Tip: Set USE_MOCK_REDIS=true in .env for local testing");
  });

  redis.on("close", () => {
    console.log("📪 Redis connection closed");
  });

  return redis;
}

module.exports = { createRedisConnection };
