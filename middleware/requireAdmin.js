const logger = require("../logger");

// Same check as pages.controller.js's adminDashboard() route -- reusing it
// here as real middleware so new routes (starting with subscribers) don't
// end up on the unauthenticated pattern that admin.routes.js's
// cleanup-database/database-stats/cleanup-logs currently use (a
// pre-existing gap, not fixed here, but not repeated going forward either).
function requireAdmin(req, res, next) {
  const role = req.signedCookies?.mrn_role || req.cookies?.mrn_role;
  if (role !== "admin") {
    logger.warn("Blocked unauthenticated admin route access", {
      path: req.originalUrl,
      ip: req.ip,
    });
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }
  next();
}

module.exports = { requireAdmin };
