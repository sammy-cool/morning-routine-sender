const fs = require("node:fs");
const path = require("node:path");
const logger = require("../logger");

// All __dirname-based paths here go up one level (..) since this file
// lives in controllers/, but the original index.js used __dirname at the
// project root -- same target files, adjusted relative path only.
const ROOT_DIR = path.join(__dirname, "..");

function escapeHtml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#x60;");
}

function getDomain(req, res) {
  return res.locals.apiBase || `${req.protocol}://${req.get("host")}`;
}

function setNoCacheHeaders(res) {
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");
  res.set("Pragma", "no-cache");
  res.set("Expires", "0");
}

// GET /admin-dashboard
function adminDashboard(req, res) {
  setNoCacheHeaders(res);
  const role = req.signedCookies?.mrn_role;
  if (role !== "admin") {
    return res.redirect(302, "/");
  }

  const domain = getDomain(req, res);
  logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
  let html = fs.readFileSync(
    path.join(ROOT_DIR, "admin-renderer/views", "admin-dashboard.html"),
    "utf8",
  );
  html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
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
  const domain = getDomain(req, res);
  logger.info("Landed in sleeping night", { domain, ip: req.ip });
  let html = fs.readFileSync(path.join(ROOT_DIR, "public", "offline.html"), "utf8");
  html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
  return res.send(html);
}

// GET /manifest.json
function manifest(req, res) {
  res.set("Cache-Control", "public, max-age=3600");
  res.sendFile(path.join(ROOT_DIR, "public", "manifest.json"));
}

// GET /sw.js
function serviceWorker(req, res) {
  setNoCacheHeaders(res);
  res.set("Service-Worker-Allowed", "/");
  res.sendFile(path.join(ROOT_DIR, "public", "sw.js"));
}

// GET /user-dashboard
async function userDashboard(req, res) {
  setNoCacheHeaders(res);

  // Deliberately required here, not at top of file: a top-level import
  // would pull in config/redisClient.js (a real Redis connection attempt)
  // on every load of this module, including tests that only exercise
  // unrelated functions like health() -- breaking the dependency-free
  // unit test design the rest of __tests__/ relies on.
  const { getSessionEmail } = require("../middleware/subscriberSession");
  const email = await getSessionEmail(req);
  if (!email) {
    return res.redirect(302, "/");
  }

  const domain = getDomain(req, res);
  logger.info("User Dashboard accessed", { domain, ip: req.ip, email });
  let html = fs.readFileSync(
    path.join(ROOT_DIR, "public", "user-dashboard.html"),
    "utf8",
  );
  html = html.replace("__DOMAIN__", escapeHtml(domain));
  res.send(html);
}

// GET /  (root -- skeleton + role-based redirect)
function root(req, res) {
  setNoCacheHeaders(res);
  const domain = getDomain(req, res);

  try {
    const role = req.signedCookies?.mrn_role;
    if (role === "admin") {
      logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/admin-dashboard");
    } else if (role === "user") {
      logger.info("User Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/user-dashboard");
    } else {
      logger.info("Landing page accessed", { domain, ip: req.ip });

      let html = fs.readFileSync(
        path.join(ROOT_DIR, "public", "main-index.html"),
        "utf8",
      );
      html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
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
    html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
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
