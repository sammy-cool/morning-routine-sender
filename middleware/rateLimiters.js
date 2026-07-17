const rateLimit = require("express-rate-limit");

// Shared limiter for endpoints that trigger real email sends / DB reads.
// Moved out of index.js so route modules can import it without a circular
// dependency back on index.js. Behavior is unchanged from the original.
const sendEmailLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: process.env.ALLOWED_RATE_LIMITER, // Allow N requests per IP
  message: "Too many requests from this IP, please try again after 15 minutes.",
});

module.exports = { sendEmailLimiter };
