// config/email-config.js
const nodemailer = require("nodemailer");
require("dotenv").config();
const logger = require("../logger");

/**
 * Validates required SMTP environment variables
 * @throws {Error} If required env vars are missing
 */
function validateSmtpConfig() {
  const required = ["TRANSPORTER_HOST", "FROM_USER", "PASSWORD"];
  const missing = required.filter((key) => !process.env[key]);

  if (missing.length > 0) {
    throw new Error(
      `Missing required SMTP environment variables: ${missing.join(", ")}\n` +
        `Please check your .env file and ensure all variables are set.`
    );
  }
}

/**
 * Creates a secure, production-ready nodemailer transporter
 * @returns {nodemailer.Transporter} Configured transporter instance
 */
function createTransporter() {
  // Validate configuration first
  validateSmtpConfig();

  const config = {
    // Host and port
    host: process.env.TRANSPORTER_HOST,
    port: Number(process.env.TRANSPORTER_PORT || 587),

    // Security settings
    secure: process.env.TRANSPORTER_SECURE === "true", // true for 465, false for other ports
    requireTLS: process.env.TRANSPORTER_REQUIRE_TLS !== "false", // Force STARTTLS

    // Authentication
    auth: {
      user: process.env.FROM_USER,
      pass: process.env.PASSWORD,
    },

    // TLS/SSL configuration
    tls: {
      // Reject unauthorized certificates (prevent MITM attacks)
      rejectUnauthorized: process.env.SMTP_REJECT_UNAUTHORIZED !== "false",

      // Minimum TLS version
      minVersion: "TLSv1.2",

      // Cipher suites (prioritize modern, secure ciphers)
      ciphers: "HIGH:!aNULL:!eNULL:!EXPORT:!DES:!RC4:!MD5:!PSK:!SRP:!CAMELLIA",

      // Optional: Specify servername for TLS validation if host is an IP
      // servername: process.env.TRANSPORTER_HOST,
    },

    // Connection timeouts (prevent hanging connections)
    connectionTimeout: parseInt(
      process.env.SMTP_CONNECTION_TIMEOUT || "10000",
      10
    ), // 10s
    greetingTimeout: parseInt(process.env.SMTP_GREETING_TIMEOUT || "10000", 10), // 10s
    socketTimeout: parseInt(process.env.SMTP_SOCKET_TIMEOUT || "15000", 10), // 15s

    // Connection pooling (for better performance with multiple sends)
    pool: process.env.SMTP_POOL_ENABLED !== "false", // Enable by default
    maxConnections: parseInt(process.env.SMTP_MAX_CONNECTIONS || "3", 10), // Reduced
    maxMessages: parseInt(process.env.SMTP_MAX_MESSAGES || "50", 10),

    // FIX: Add idle timeout to close unused connections
    idleTimeout: 5000, // Close idle connections after 5 seconds

    // Rate limiting (messages per connection per minute)
    rateDelta: 1000, // 1 second
    rateLimit: 5, // max 5 messages per rateDelta

    // Logging (disable in production, enable for debugging)
    logger: process.env.SMTP_DEBUG === "true",
    debug: process.env.SMTP_DEBUG === "true",
  };

  const transporter = nodemailer.createTransport(config);

  // Verify connection configuration on startup (optional but recommended)
  if (process.env.SMTP_VERIFY_ON_STARTUP !== "false") {
    transporter.verify((error, success) => {
      if (error) {
        logger.error("❌ SMTP configuration error:", error.message);
        logger.error("Please verify your SMTP settings in .env file");
        // In production, you might want to exit process here
        if (process.env.NODE_ENV === "production") {
          logger.info(
            "⚠️  App will start but emails may fail. Consider using API instead."
          );
        }
      } else {
        logger.info("✅ SMTP transporter is ready to send emails");
        logger.info(`   Host: ${config.host}:${config.port}`);
        logger.info(`   Secure: ${config.secure}`);
        logger.info(`   Pool: ${config.pool ? "enabled" : "disabled"}`);
      }
    });
  }

  return transporter;
}

/**
 * Gracefully closes the transporter and its connection pool
 * Call this during application shutdown
 * @param {nodemailer.Transporter} transporter - The transporter to close
 * @returns {Promise<void>}
 */
async function closeTransporter(transporter) {
  if (transporter?.close) {
    return new Promise((resolve, reject) => {
      transporter.close();
      logger.info("📪 SMTP transporter closed");
      resolve();
    });
  }
}

module.exports = {
  createTransporter,
  closeTransporter,
  validateSmtpConfig,
};
