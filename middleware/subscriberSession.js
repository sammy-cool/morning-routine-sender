const logger = require("../logger");
const redis = require("../config/redisClient");

const SESSION_PREFIX = "subscriber_session:";
// 30 days -- a personal dashboard someone might check occasionally, not a
// banking app. Long-lived on purpose so people aren't asked to re-request
// a login link constantly.
const SESSION_TTL_SECONDS = 30 * 24 * 60 * 60;

/**
 * Look up the mrn_session cookie against Redis and return the email it
 * belongs to, or null if missing/expired/invalid. Read-only -- does not
 * reject the request itself, callers decide what "no session" means for
 * their context (401 for an API route, redirect for a page route).
 */
async function getSessionEmail(req) {
  const token = req.cookies?.mrn_session;
  if (!token) return null;

  try {
    return await redis.get(SESSION_PREFIX + token);
  } catch (error) {
    logger.error("❌ Redis unavailable while checking subscriber session", {
      error: error.message,
    });
    return null;
  }
}

/**
 * Creates a new session for the given email, sets the cookie on res, and
 * returns the raw token (rarely needed directly, mostly for tests).
 */
async function createSession(res, email) {
  const token = require("node:crypto").randomBytes(32).toString("hex");
  await redis.set(SESSION_PREFIX + token, email, "EX", SESSION_TTL_SECONDS);

  const isProd = process.env.NODE_ENV === "production";
  res.cookie("mrn_session", token, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_SECONDS * 1000,
  });

  return token;
}

async function destroySession(req, res) {
  const token = req.cookies?.mrn_session;
  if (token) {
    try {
      await redis.del(SESSION_PREFIX + token);
    } catch (error) {
      logger.error("❌ Redis unavailable while destroying session", {
        error: error.message,
      });
    }
  }
  res.clearCookie("mrn_session", { path: "/" });
  res.clearCookie("mrn_role", { path: "/" });
}

// Express middleware for API routes under /me/*: rejects with 401 if
// there's no valid session, attaches req.subscriberEmail if there is.
async function requireSubscriberSession(req, res, next) {
  const email = await getSessionEmail(req);
  if (!email) {
    return res.status(401).json({ error: "Not logged in" });
  }
  req.subscriberEmail = email;
  next();
}

module.exports = {
  getSessionEmail,
  createSession,
  destroySession,
  requireSubscriberSession,
  SESSION_TTL_SECONDS,
};
