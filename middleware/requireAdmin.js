const logger = require("../logger");
const redis = require("../config/redisClient");
const { safeCompare } = require("../helper/util");

// Admin authorization guard supporting signed cookie (mrn_role=admin)
// and dual-auth header fallback (Authorization: Bearer <key>, x-admin-key, x-admin-secret)
// for PWA standalone webviews and API automation.
async function requireAdmin(req, res, next) {
  const role = req.signedCookies?.mrn_role;
  if (role === "admin") {
    return next();
  }

  const authHeader =
    typeof req.get === "function" ? req.get("authorization") : req.headers?.authorization;
  const xAdminKey =
    typeof req.get === "function" ? req.get("x-admin-key") : req.headers?.["x-admin-key"];
  const xAdminSecret =
    typeof req.get === "function" ? req.get("x-admin-secret") : req.headers?.["x-admin-secret"];

  let token = null;
  if (authHeader && typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    const candidate = authHeader.slice(7).trim();
    if (candidate && candidate !== "undefined" && candidate !== "null") {
      token = candidate;
    }
  }

  if (!token && xAdminKey && typeof xAdminKey === "string") {
    const candidate = xAdminKey.trim();
    if (candidate && candidate !== "undefined" && candidate !== "null") {
      token = candidate;
    }
  }

  if (!token && xAdminSecret && typeof xAdminSecret === "string") {
    const candidate = xAdminSecret.trim();
    if (candidate && candidate !== "undefined" && candidate !== "null") {
      token = candidate;
    }
  }

  if (!token) {
    logger.warn("Blocked unauthenticated admin route access", {
      path: req.originalUrl || req.url,
      ip: req.ip,
    });
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }

  // Check active master admin secret
  const masterKey = process.env.ADMIN_KEY;
  if (masterKey && safeCompare(token, masterKey)) {
    return next();
  }

  // Verify against active Redis admin keys (supports admin_key:* and admin:key:*)
  try {
    const [key1, key2] = await Promise.all([
      redis.get(`admin_key:${token}`),
      redis.get(`admin:key:${token}`),
    ]);
    if (key1 || key2) {
      return next();
    }
  } catch (err) {
    logger.warn("Redis lookup failed in requireAdmin", { error: err.message });
  }

  logger.warn("Blocked unauthenticated admin route access", {
    path: req.originalUrl || req.url,
    ip: req.ip,
  });
  return res.status(403).json({ error: "Forbidden: admin access required" });
}

module.exports = { requireAdmin };
