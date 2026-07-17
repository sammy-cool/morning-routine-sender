const crypto = require("node:crypto");

// UNSUBSCRIBE_SECRET falls back to ADMIN_KEY if not set, same
// backward-compatible pattern used for the REDIS_URL rename -- works
// immediately on an existing deployment, can be given its own dedicated
// secret later without breaking anything.
function getSecret() {
  return process.env.UNSUBSCRIBE_SECRET || process.env.ADMIN_KEY || "";
}

/**
 * Deterministic per-email token -- same email always produces the same
 * token, so it can be embedded once in every email sent to that address
 * and keeps working indefinitely, with no server-side storage needed.
 */
function generateUnsubscribeToken(email) {
  return crypto
    .createHmac("sha256", getSecret())
    .update(email.toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

/**
 * Constant-time comparison (crypto.timingSafeEqual) rather than ===,
 * so this can't be brute-forced faster by timing how quickly a wrong
 * guess is rejected.
 */
function verifyUnsubscribeToken(email, token) {
  if (!token || typeof token !== "string") return false;

  const expected = generateUnsubscribeToken(email);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(token);

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

module.exports = { generateUnsubscribeToken, verifyUnsubscribeToken };
