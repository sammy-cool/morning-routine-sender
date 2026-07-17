const crypto = require("node:crypto");
const logger = require("../logger");
const redis = require("../config/redisClient");
const emailScheduler = require("../email-core/emailScheduler");

const KEY_EXPIRY_SECONDS = 300; // 5 minutes

// ⚠️ Carried over as-is from index.js: "YOUR_SERVER_IP" is a literal
// placeholder that was never replaced, so this allowlist only ever matches
// localhost. Flagging again here since it moved, but not changing behavior
// in this commit -- that's a decision for you to make deliberately.
// Only enforced when NODE_ENV === "development" (see below) -- this is a
// local-testing guard, not a production security boundary. Production
// protection for this route is the ADMIN_KEY + one-time Redis key flow
// above it, not this IP check. "YOUR_SERVER_IP" was a never-filled-in
// placeholder that did nothing (this check doesn't even run in prod);
// removed rather than guessed at. If IP-restriction should matter in
// production too, that's a deliberate follow-up: drop the NODE_ENV guard
// below and add your actual trusted IP(s) here.
const allowedIPs = new Set(["127.0.0.1", "::1"]);

// GET /generate-admin-key (protected route)
async function generateAdminKey(req, res) {
  logger.info("🔑 Generating one-time key 🔹 (protected route)");

  res.set("Cache-Control", "no-store");
  const adminSecret = req.get("x-admin-secret") || req.query.adminSecret;

  if (adminSecret !== process.env.ADMIN_KEY) {
    logger.error("Forbidden: Invalid admin secret");
    return res.status(403).json({ message: "Forbidden: Invalid admin secret" });
  }

  const key = crypto.randomBytes(32).toString("hex");
  try {
    await redis.set(`admin_key:${key}`, "valid", "EX", KEY_EXPIRY_SECONDS);
  } catch (error) {
    logger.error("❌ Redis unavailable while generating admin key", {
      error: error.message,
    });
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable, try again shortly." });
  }

  logger.info(`🔑 New one-time key generated 🔹: GG!`);
  res.json({
    message: "✅ One-time key generated (valid for 5 minutes)",
    key,
    timestamp: new Date().toISOString(),
  });
}

// POST /verify-admin-key
async function verifyAdminKey(req, res) {
  try {
    const key = req.body?.key ? String(req.body.key).trim() : null;
    if (!key) return res.status(400).json({ error: "Missing key" });

    const keyExists = await redis.get(`admin_key:${key}`);
    if (!keyExists) {
      // not an admin key — return 200 but role user (keeping UX simple)
      return res.status(200).json({ role: "user" });
    }

    // valid one-time key -> delete it (one-time use)
    await redis.del(`admin_key:${key}`);

    // Optional: set short-lived secure cookie so admin view is accessible for a few minutes
    // NOTE: set 'secure: true' in production (HTTPS)
    const isProd = process.env.NODE_ENV === "production";

    res.cookie("mrn_role", "admin", {
      httpOnly: true,
      secure: isProd, // true on production
      sameSite: isProd ? "none" : "lax",
      path: "/", // required
      maxAge: 5 * 60 * 1000,
    });

    return res.json({ role: "admin" });
  } catch (err) {
    logger.error("verify-admin-key error", { error: err.message || err });
    return res.status(500).json({ error: "Server error verifying key" });
  }
}

// POST /secret-jobs-scheduler
async function secretJobsScheduler(req, res) {
  const clientIP = req.ip || req.socket.remoteAddress;
  const { key, action } = req.query;

  //IP Restriction
  if (process.env.NODE_ENV === "development") {
    if (!allowedIPs.has(clientIP)) {
      logger.error("❌ Forbidden: Unauthorized IP");
      return res.status(403).json({ message: "❌ Forbidden: Unauthorized IP" });
    }
  }

  if (!key) return res.status(400).json({ message: "Missing ?key parameter" });

  let keyExists;
  try {
    keyExists = await redis.get(`admin_key:${key}`);
  } catch (error) {
    logger.error("❌ Redis unavailable while verifying key", {
      error: error.message,
    });
    return res
      .status(503)
      .json({ message: "Service temporarily unavailable, try again shortly." });
  }

  if (!keyExists) {
    return res.status(403).json({ message: "❌ Invalid or expired key" });
  }

  try {
    // Valid key → delete immediately (one-time use)
    await redis.del(`admin_key:${key}`);

    if (action === "start") {
      emailScheduler.scheduleAllJobs();
      return res.json({ message: "✅ All cron jobs scheduled and running." });
    } else if (action === "stop") {
      emailScheduler.stopAllJobs();
      return res.json({ message: "🛑 All cron jobs stopped." });
    } else {
      return res
        .status(400)
        .json({ message: "Invalid or missing ?action=start|stop parameter." });
    }
  } catch (error) {
    logger.error("Error managing cron jobs:", error);
    return res
      .status(500)
      .json({ message: "Internal server error.", error: error.message });
  }
}

module.exports = { generateAdminKey, verifyAdminKey, secretJobsScheduler };
