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

// GET /streak/:handleOrEmail
async function streakShare(req, res) {
  try {
    const rawInput = (req.params?.handleOrEmail || "").trim();
    if (!rawInput) {
      return res.redirect(302, "/");
    }

    const domain = getDomain(req, res);
    const officialDomain =
      req.app?.locals?.officialDomain ||
      process.env.RENDER_URL ||
      domain ||
      "https://morning-routine-sender.onrender.com";

    const sharedData = require("../helper/shared-data");
    const db = require("../db/knex");

    let subscriber = null;
    const cleanInput = rawInput.toLowerCase();

    if (cleanInput.includes("@")) {
      subscriber = await sharedData.getUserByEmail(cleanInput);
    } else {
      try {
        const row = await db("subscribers")
          .where("email", cleanInput)
          .orWhere("email", "like", `${cleanInput}@%`)
          .first();
        if (row) {
          subscriber = {
            ...row,
            streakCount: Number(row.streak_count) || 0,
            routineTrack: row.routine_track || row.template_type || "deep-work",
          };
        }
      } catch (dbErr) {
        logger.warn("Failed to query subscriber by handle prefix", { error: dbErr.message });
      }
    }

    const streak = subscriber ? Math.max(subscriber.streakCount || 0, 1) : 1;
    const trackKey = subscriber?.routineTrack || subscriber?.templateType || "deep-work";
    const trackConfig = sharedData.TRACK_CONFIGS?.[trackKey] ||
      sharedData.TRACK_CONFIGS?.["deep-work"] || {
        name: "Deep Work & Builder",
        badge: "⚡ Deep Work & Builder",
        tagline: "High-focus engineering rituals & distraction-free flow states",
      };

    const resolvedEmail = subscriber?.email || rawInput;
    const rawName = (subscriber?.email || rawInput).split("@")[0];
    const displayName = rawName
      ? rawName.charAt(0).toUpperCase() + rawName.slice(1)
      : "Morning Builder";

    const pageTitle = `${displayName}'s ${streak}-Day Morning Routine Streak`;
    const pageDescription =
      "Building unshakable discipline and morning focus with Morning Routine Sender.";
    const streakImageUrl = `${officialDomain}/api/streak-card/${encodeURIComponent(resolvedEmail)}/card.svg`;
    const canonicalUrl = `${officialDomain}/streak/${encodeURIComponent(rawInput)}`;

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="theme-color" content="#07090e">
  <title>${escapeHtml(pageTitle)} • Morning Routine Sender</title>
  <meta name="description" content="${escapeHtml(pageDescription)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">

  <!-- OpenGraph Social Metadata -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="${escapeHtml(pageTitle)}">
  <meta property="og:description" content="${escapeHtml(pageDescription)}">
  <meta property="og:image" content="${escapeHtml(streakImageUrl)}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:image:alt" content="${escapeHtml(pageTitle)}">
  <meta property="og:site_name" content="Morning Routine Sender">

  <!-- Twitter Card Metadata -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(pageTitle)}">
  <meta name="twitter:description" content="${escapeHtml(pageDescription)}">
  <meta name="twitter:image" content="${escapeHtml(streakImageUrl)}">
  <meta name="twitter:image:alt" content="${escapeHtml(pageTitle)}">

  <!-- Fonts & Favicon -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/mrn-brand-ico.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">

  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(15, 23, 42, 0.75);
      --primary: #6366f1;
      --primary-hover: #4f46e5;
      --cyan: #06b6d4;
      --emerald: #10b981;
      --amber: #f59e0b;
      --border: rgba(255, 255, 255, 0.1);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.2) 0%, transparent 60%),
        radial-gradient(circle at 85% 40%, rgba(6, 182, 212, 0.15) 0%, transparent 50%),
        radial-gradient(circle at 15% 80%, rgba(16, 185, 129, 0.1) 0%, transparent 45%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 32px 16px;
    }
    .share-container {
      width: 100%;
      max-width: 820px;
      margin: 0 auto;
    }
    .brand-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      padding: 0 4px;
    }
    .brand-logo {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-main);
    }
    .brand-icon {
      width: 38px;
      height: 38px;
      border-radius: 10px;
      background: linear-gradient(135deg, var(--primary), var(--cyan));
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 18px;
      color: #fff;
    }
    .brand-title {
      font-size: 17px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .badge-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--emerald);
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 28px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.5), 0 0 40px rgba(99, 102, 241, 0.1);
    }
    .streak-preview-wrap {
      width: 100%;
      border-radius: 16px;
      overflow: hidden;
      margin-bottom: 24px;
      border: 1px solid rgba(255, 255, 255, 0.12);
      background: #07090e;
    }
    .streak-card-img {
      width: 100%;
      height: auto;
      display: block;
    }
    .streak-meta-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
      gap: 16px;
      margin-bottom: 24px;
    }
    .meta-box {
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid rgba(255, 255, 255, 0.06);
      border-radius: 14px;
      padding: 16px;
    }
    .meta-label {
      font-size: 12px;
      font-weight: 600;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 4px;
    }
    .meta-value {
      font-size: 18px;
      font-weight: 800;
      color: #fff;
    }
    .cta-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 14px;
    }
    .btn {
      flex: 1 1 220px;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      padding: 14px 24px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--primary), #4f46e5);
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 20px rgba(99, 102, 241, 0.35);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 6px 25px rgba(99, 102, 241, 0.5);
    }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.08);
      color: #f8fafc;
      border: 1px solid rgba(255, 255, 255, 0.15);
    }
    .btn-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      transform: translateY(-2px);
    }
    .footer-note {
      text-align: center;
      margin-top: 24px;
      font-size: 13px;
      color: var(--text-muted);
    }
    @media (max-width: 640px) {
      .card { padding: 18px; }
      .cta-actions { flex-direction: column; }
      .btn { width: 100%; }
    }
  </style>
</head>
<body>
  <div class="share-container">
    <header class="brand-header">
      <a href="/" class="brand-logo">
        <div class="brand-icon"><i class="fas fa-sun"></i></div>
        <span class="brand-title">Morning Routine Sender</span>
      </a>
      <span class="badge-pill"><i class="fas fa-certificate"></i> Verified Habit Streak</span>
    </header>

    <main class="card">
      <div class="streak-preview-wrap">
        <img
          src="${escapeHtml(streakImageUrl)}"
          alt="${escapeHtml(pageTitle)}"
          class="streak-card-img"
          loading="eager"
        />
      </div>

      <div class="streak-meta-grid">
        <div class="meta-box">
          <div class="meta-label">Discipline Track</div>
          <div class="meta-value">${escapeHtml(trackConfig.badge || trackConfig.name)}</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Current Momentum</div>
          <div class="meta-value">🔥 ${streak} Unbroken Days</div>
        </div>
        <div class="meta-box">
          <div class="meta-label">Routine Focus</div>
          <div class="meta-value" style="font-size: 14px; font-weight: 600; color: var(--cyan);">${escapeHtml(trackConfig.tagline)}</div>
        </div>
      </div>

      <div class="cta-actions">
        <a href="/" class="btn btn-primary">
          <i class="fas fa-bolt"></i> Start Your Routine
        </a>
        <a href="/routine" class="btn btn-secondary">
          <i class="fas fa-compass"></i> View Live Companion
        </a>
      </div>
    </main>

    <footer class="footer-note">
      Morning Routine Sender • Automated Daily Habits &amp; Peak Performance Architecture
    </footer>
  </div>
</body>
</html>`;

    return res.send(html);
  } catch (error) {
    logger.error("Failed to render streak share page", { error: error.message });
    return res.redirect(302, "/");
  }
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
  streakShare,
};
