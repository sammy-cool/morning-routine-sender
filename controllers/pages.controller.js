const fs = require("node:fs");
const path = require("node:path");
const logger = require("../logger");

// All __dirname-based paths here go up one level (..) since this file
// lives in controllers/, but the original index.js used __dirname at the
// project root -- same target files, adjusted relative path only.
const ROOT_DIR = path.join(__dirname, "..");

function getDomain(req) {
  return req.app.locals.apiBase || `${req.protocol}://${req.get("host")}`;
}

// GET /admin-dashboard
function adminDashboard(req, res) {
  res.set("Cache-Control", "no-store");
  if (req.cookies?.mrn_role !== "admin") {
    return res.redirect(302, "/");
  }

  const domain = getDomain(req);
  logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
  let html = fs.readFileSync(
    path.join(ROOT_DIR, "admin-renderer/views", "admin-dashboard.html"),
    "utf8",
  );
  html = html.replaceAll("__DOMAIN__", domain);
  return res.send(html);
}

// GET /health
function health(req, res) {
  res.json({
    status: "ok",
    timestamp: new Date().toISOString(),
    mode: "auto-scheduling-enabled",
  });
}

// GET /offline
function offline(req, res) {
  const domain = getDomain(req);
  logger.info("Landed in sleeping night", { domain, ip: req.ip });
  let html = fs.readFileSync(path.join(ROOT_DIR, "public", "offline.html"), "utf8");
  html = html.replaceAll("__DOMAIN__", domain);
  return res.send(html);
}

// GET /manifest.json
function manifest(req, res) {
  res.sendFile(path.join(ROOT_DIR, "public", "manifest.json"));
}

// GET /sw.js
function serviceWorker(req, res) {
  res.sendFile(path.join(ROOT_DIR, "public", "sw.js"));
}

// GET /user-dashboard
function userDashboard(req, res) {
  const domain = getDomain(req);
  logger.info("User Dashboard accessed", { domain, ip: req.ip });
  let html = fs.readFileSync(
    path.join(ROOT_DIR, "public", "user-dashboard.html"),
    "utf8",
  );
  html = html.replace("__DOMAIN__", domain);
  res.send(html);
}

// GET /  (root -- skeleton + role-based redirect)
function root(req, res) {
  res.set("Cache-Control", "no-store");
  const domain = getDomain(req);

  try {
    if (req.cookies?.mrn_role === "admin") {
      logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/admin-dashboard");
    } else if (req.cookies?.mrn_role === "user") {
      logger.info("User Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/user-dashboard");
    } else {
      logger.info("Landing page accessed", { domain, ip: req.ip });

      let html = fs.readFileSync(
        path.join(ROOT_DIR, "public", "main-index.html"),
        "utf8",
      );
      html = html.replaceAll("__DOMAIN__", domain);
      return res.send(html);
    }
  } catch (err) {
    logger.error(
      "Failed to serve dashboard: redirecting back to main view page",
      err,
    );
    let html = fs.readFileSync(
      path.join(ROOT_DIR, "public", "main-index.html"),
      "utf8",
    );
    html = html.replaceAll("__DOMAIN__", domain);
    return res.send(html);
  }
}

module.exports = {
  adminDashboard,
  health,
  offline,
  manifest,
  serviceWorker,
  userDashboard,
  root,
};
