const fs = require("node:fs");
const path = require("node:path");
const logger = require("../logger");

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

// In-Memory Template Cache for High-Throughput / Zero-Disk-I/O Performance
const templateCache = new Map();

function getCachedTemplate(relativePath) {
  if (process.env.NODE_ENV === "production" && templateCache.has(relativePath)) {
    return templateCache.get(relativePath);
  }
  try {
    const fullPath = path.join(ROOT_DIR, relativePath);
    if (fs.existsSync(fullPath)) {
      const content = fs.readFileSync(fullPath, "utf8");
      templateCache.set(relativePath, content);
      return content;
    }
  } catch (err) {
    logger.warn(`Could not read template from disk: ${relativePath}`, { error: err.message });
  }
  return "";
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
  let html = getCachedTemplate("admin-renderer/views/admin-dashboard.html");
  html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
  return res.send(html);
}

// GET /health
async function health(req, res) {
  const isDeepCheck = Boolean(req?.query?.deep === "true" || req?.path === "/health/ready");

  const payload = {
    status: "ok",
    timestamp: new Date().toISOString(),
    mode: "auto-scheduling-enabled",
    uptimeSeconds: Math.floor(process.uptime()),
    environment: process.env.NODE_ENV || "development",
    memoryUsageMB: Math.round(process.memoryUsage().rss / 1024 / 1024),
  };

  if (!isDeepCheck) {
    return res.json(payload);
  }

  // Deep inspection
  const db = require("../db/knex");
  const redis = require("../config/redisClient");

  const checks = {
    database: { status: "unknown", latencyMs: null },
    redis: { status: "unknown", latencyMs: null },
  };

  let isHealthy = true;

  try {
    const dbStart = Date.now();
    await db.raw("SELECT 1");
    checks.database = { status: "healthy", latencyMs: Date.now() - dbStart };
  } catch (dbErr) {
    isHealthy = false;
    checks.database = { status: "unhealthy", error: dbErr.message };
  }

  try {
    const redisStart = Date.now();
    if (redis && typeof redis.ping === "function") {
      await redis.ping();
      checks.redis = { status: "healthy", latencyMs: Date.now() - redisStart };
    } else {
      checks.redis = { status: "skipped", reason: "no_client" };
    }
  } catch (redisErr) {
    isHealthy = false;
    checks.redis = { status: "unhealthy", error: redisErr.message };
  }

  payload.status = isHealthy ? "ok" : "degraded";
  payload.checks = checks;

  return res.status(isHealthy ? 200 : 503).json(payload);
}

// GET /offline
function offline(req, res) {
  const domain = getDomain(req, res);
  logger.info("Landed in sleeping night", { domain, ip: req.ip });
  let html = getCachedTemplate("public/offline.html");
  html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
  return res.send(html);
}

// GET /manifest.json
function manifest(req, res) {
  res.set("Cache-Control", "public, max-age=86400");
  res.sendFile(path.join(ROOT_DIR, "public", "manifest.json"));
}

// GET /sw.js
function serviceWorker(req, res) {
  setNoCacheHeaders(res);
  res.set("Service-Worker-Allowed", "/");
  res.sendFile(path.join(ROOT_DIR, "public", "sw.js"));
}

// GET /robots.txt
function robots(req, res) {
  res.set("Content-Type", "text/plain; charset=utf-8");
  res.set("Cache-Control", "public, max-age=86400");
  const domain = getDomain(req, res);
  let content = getCachedTemplate("public/robots.txt");
  content = content
    .replaceAll("__DOMAIN__", domain)
    .replaceAll("https://morning-routine-sender.onrender.com", domain);
  return res.send(content);
}

// GET /sitemap.xml
function sitemap(req, res) {
  res.set("Content-Type", "application/xml; charset=utf-8");
  res.set("Cache-Control", "public, max-age=86400, stale-while-revalidate=3600");
  const domain = getDomain(req, res);
  let content = getCachedTemplate("public/sitemap.xml");
  content = content
    .replaceAll("__DOMAIN__", domain)
    .replaceAll("https://morning-routine-sender.onrender.com", domain);
  return res.send(content);
}

// GET /llms.txt & /.well-known/llms.txt
function llmsTxt(req, res) {
  res.set("Content-Type", "text/markdown; charset=utf-8");
  res.set("Cache-Control", "public, max-age=86400");
  const domain = getDomain(req, res);
  let content = getCachedTemplate("public/llms.txt");
  content = content
    .replaceAll("__DOMAIN__", domain)
    .replaceAll("https://morning-routine-sender.onrender.com", domain);
  return res.send(content);
}

// GET /llms-full.txt
function llmsFullTxt(req, res) {
  res.set("Content-Type", "text/markdown; charset=utf-8");
  res.set("Cache-Control", "public, max-age=86400");
  const domain = getDomain(req, res);
  let content = getCachedTemplate("public/llms-full.txt");
  content = content
    .replaceAll("__DOMAIN__", domain)
    .replaceAll("https://morning-routine-sender.onrender.com", domain);
  return res.send(content);
}

// GET /user-dashboard
async function userDashboard(req, res) {
  setNoCacheHeaders(res);

  const { getSessionEmail } = require("../middleware/subscriberSession");
  const email = await getSessionEmail(req);
  if (!email) {
    return res.redirect(302, "/");
  }

  const domain = getDomain(req, res);
  logger.info("User Dashboard accessed", { domain, ip: req.ip, email });
  let html = getCachedTemplate("public/user-dashboard.html");
  html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
  res.send(html);
}

// GET /  (root -- role-based redirect + high performance template delivery)
function root(req, res) {
  setNoCacheHeaders(res);
  const domain = getDomain(req, res);

  try {
    const role = req.signedCookies?.mrn_role || req.cookies?.mrn_role;
    if (role === "admin") {
      logger.info("Admin Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/admin-dashboard");
    } else if (role === "user") {
      logger.info("User Dashboard accessed", { domain, ip: req.ip });
      return res.redirect("/user-dashboard");
    } else {
      logger.info("Landing page accessed", { domain, ip: req.ip });
      let html = getCachedTemplate("public/main-index.html");
      html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
      return res.send(html);
    }
  } catch (err) {
    logger.error("Failed to serve dashboard: redirecting back to main view page", err);
    let html = getCachedTemplate("public/main-index.html");
    html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
    return res.send(html);
  }
}

// GET /about
function about(req, res) {
  setNoCacheHeaders(res);
  const domain = getDomain(req, res);
  logger.info("About page accessed", { domain, ip: req.ip });
  let html = getCachedTemplate("public/about.html");
  html = html.replaceAll("__DOMAIN__", escapeHtml(domain));
  return res.send(html);
}

module.exports = {
  adminDashboard,
  health,
  offline,
  about,
  manifest,
  serviceWorker,
  robots,
  sitemap,
  llmsTxt,
  llmsFullTxt,
  userDashboard,
  root,
};
