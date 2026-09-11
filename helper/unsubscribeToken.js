const crypto = require("node:crypto");

// UNSUBSCRIBE_SECRET falls back to ADMIN_KEY if not set, same
// backward-compatible pattern used for the REDIS_URL rename -- works
// immediately on an existing deployment, can be given its own dedicated
// secret later without breaking anything.
function getSecret() {
  return (
    process.env.UNSUBSCRIBE_SECRET || process.env.ADMIN_KEY || "mrn-fallback-unsubscribe-secret"
  );
}

/**
 * Deterministic action-scoped token for email links (check-in, view-routine, etc.)
 */
function generateActionToken(email, action = "action") {
  return crypto
    .createHmac("sha256", getSecret())
    .update(`${action}:${(email || "").toLowerCase().trim()}`)
    .digest("hex")
    .slice(0, 32);
}

/**
 * Constant-time verification of action-scoped token.
 */
function verifyActionToken(email, token, action = "action") {
  if (!token || typeof token !== "string" || !email) return false;

  const expected = generateActionToken(email, action);
  const expectedBuf = Buffer.from(expected);
  const providedBuf = Buffer.from(token);

  if (expectedBuf.length !== providedBuf.length) return false;
  return crypto.timingSafeEqual(expectedBuf, providedBuf);
}

/**
 * Deterministic per-email token for legacy 1-click unsubscribe
 */
function generateUnsubscribeToken(email) {
  return crypto
    .createHmac("sha256", getSecret())
    .update((email || "").toLowerCase().trim())
    .digest("hex")
    .slice(0, 32);
}

/**
 * Constant-time comparison (crypto.timingSafeEqual) rather than ===,
 * supporting both legacy raw-email and action-scoped unsubscribe tokens.
 */
function verifyUnsubscribeToken(email, token) {
  if (!token || typeof token !== "string" || !email) return false;

  const expectedLegacy = generateUnsubscribeToken(email);
  const expectedAction = generateActionToken(email, "unsubscribe");

  const providedBuf = Buffer.from(token);
  const legacyBuf = Buffer.from(expectedLegacy);
  const actionBuf = Buffer.from(expectedAction);

  if (providedBuf.length === legacyBuf.length && crypto.timingSafeEqual(legacyBuf, providedBuf)) {
    return true;
  }
  if (providedBuf.length === actionBuf.length && crypto.timingSafeEqual(actionBuf, providedBuf)) {
    return true;
  }
  return false;
}

/**
 * Deterministic self-contained webcal token combining base64url(email:hmac)
 */
function generateCalendarToken(email) {
  const normEmail = (email || "").toLowerCase().trim();
  const hmac = generateActionToken(normEmail, "calendar");
  return Buffer.from(`${normEmail}:${hmac}`).toString("base64url");
}

function verifyCalendarToken(tokenStr) {
  if (!tokenStr || typeof tokenStr !== "string") return null;
  try {
    const decoded = Buffer.from(tokenStr, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx === -1) return null;
    const email = decoded.slice(0, colonIdx);
    const hmac = decoded.slice(colonIdx + 1);
    if (email && hmac && verifyActionToken(email, hmac, "calendar")) {
      return email;
    }
  } catch (_e) {
    return null;
  }
  return null;
}

module.exports = {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  generateActionToken,
  verifyActionToken,
  generateCalendarToken,
  verifyCalendarToken,
};
