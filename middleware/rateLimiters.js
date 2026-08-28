const rateLimit = require("express-rate-limit");

// Shared limiter for endpoints that trigger real email sends / DB reads.
// Moved out of index.js so route modules can import it without a circular
// dependency back on index.js. Behavior is unchanged from the original.
const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.ALLOWED_RATE_LIMITER, 10) || 100, // Allow N requests per IP
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: "Too many attempts, try again later" },
});

module.exports = { sendEmailLimiter, authLimiter };
