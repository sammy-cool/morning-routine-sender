/**
 * controllers/wallpaper.controller.js
 * Dynamic 9:16 Mobile Wallpaper Controller
 * Morning Routine Sender
 */

const sharedData = require("../helper/shared-data");
const { generateWallpaperSvg } = require("../helper/wallpaperGenerator");
const { getWeatherSpark } = require("../helper/weatherSpark");
const { verifyActionToken, verifyCalendarToken } = require("../helper/unsubscribeToken");
const logger = require("../logger");

/**
 * Resolves or extracts quote and author from track config or subscriber extensions
 */
function resolveQuoteAndAuthor(subscriber, trackKey, queryQuote, queryAuthor) {
  if (queryQuote) {
    return {
      quote: queryQuote,
      author: queryAuthor || "Daily Stoic",
    };
  }

  if (subscriber?.customQuote) {
    const parts = subscriber.customQuote.split(/\s*—\s*|\s*-\s*/);
    return {
      quote: parts[0] || subscriber.customQuote,
      author: parts[1] || queryAuthor || "Personal Routine",
    };
  }

  const trackContent = sharedData.getTrackContent(trackKey);
  const trackQuote =
    trackContent?.quote || "Action is the foundational key to all success. — Pablo Picasso";
  const parts = trackQuote.split(/\s*—\s*|\s*-\s*/);
  return {
    quote: parts[0] || trackQuote,
    author: parts[1] || "Daily Focus",
  };
}

/**
 * Resolves subscriber record from email, handle, or token
 */
async function resolveSubscriber(identifier) {
  if (!identifier || typeof identifier !== "string") return null;
  let cleanId = identifier
    .trim()
    .toLowerCase()
    .replace(/\.svg$/, "");

  const isHandle = cleanId.startsWith("@");
  if (isHandle) {
    cleanId = cleanId.slice(1);
  }

  // 1. Direct Email lookup (if not a pure handle and contains @)
  if (!isHandle && cleanId.includes("@")) {
    try {
      const user = await sharedData.getUserByEmail(cleanId);
      if (user) return user;
    } catch (_e) {
      // Database not available or subscriber not found
    }
  }

  // 2. Handle / username prefix search in Knex
  try {
    const db = require("../db/knex");
    const row = await db("subscribers")
      .where("email", cleanId)
      .orWhere("email", "like", `${cleanId}@%`)
      .first();

    if (row && row.email) {
      try {
        const user = await sharedData.getUserByEmail(row.email);
        if (user) return user;
      } catch (_e) {
        return row;
      }
    }
  } catch (err) {
    logger.warn("Wallpaper handle lookup database error", { identifier, error: err.message });
  }

  return null;
}

/**
 * Verifies wallpaper token (base64url email:hmac or calendar token or Redis session)
 */
async function resolveEmailFromToken(tokenParam) {
  if (!tokenParam || typeof tokenParam !== "string") return null;
  const cleanToken = tokenParam.trim().replace(/\.svg$/, "");

  // 1. Check custom wallpaper token base64url(email:hmac)
  try {
    const decoded = Buffer.from(cleanToken, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      const email = decoded.slice(0, colonIdx);
      const hmac = decoded.slice(colonIdx + 1);
      if (
        email &&
        hmac &&
        (verifyActionToken(email, hmac, "wallpaper") || verifyActionToken(email, hmac, "routine"))
      ) {
        return email;
      }
    }
  } catch (_e) {
    // Continue to next check
  }

  // 2. Check calendar webcal token fallback
  const calEmail = verifyCalendarToken(cleanToken);
  if (calEmail) return calEmail;

  // 3. Check Redis session
  try {
    const redis = require("../config/redisClient");
    const sessionEmail = await redis.get(`subscriber_session:${cleanToken}`).catch(() => null);
    if (sessionEmail) return sessionEmail;
  } catch (_e) {
    // Redis unavailable fallback
  }

  return null;
}

/**
 * Helper to fetch verified lifetime check-ins count
 */
async function getLifetimeCheckins(email, streakCount = 1) {
  if (!email) return Math.max(Number(streakCount) || 1, 1);
  try {
    const db = require("../db/knex");
    const [{ count }] = await db("journal_entries")
      .where("subscriber_email", email.toLowerCase().trim())
      .count("* as count");
    return Math.max(Number(count) || 0, Number(streakCount) || 1);
  } catch (_e) {
    return Math.max(Number(streakCount) || 1, 1);
  }
}

/**
 * GET /wallpaper/:handleOrEmail & GET /wallpaper
 */
async function getWallpaper(req, res) {
  try {
    const identifier =
      req.params.handleOrEmail || req.query.email || req.query.handle || req.subscriberEmail;
    const subscriber = await resolveSubscriber(identifier);

    const track =
      subscriber?.routineTrack || subscriber?.templateType || req.query.track || "deep-work";
    const streak = req.query.streak ? Number(req.query.streak) : (subscriber?.streakCount ?? 1);

    const lifetimeCheckins = req.query.checkins
      ? Number(req.query.checkins)
      : await getLifetimeCheckins(subscriber?.email, streak);

    const city = req.query.city || subscriber?.locationCity || "New Delhi";
    const tz = subscriber?.timezone || "UTC";
    const weatherResult = getWeatherSpark(city, tz, new Date());
    const weatherSparkFormatted = weatherResult
      ? `${weatherResult.tempC}°C • ${weatherResult.condition} in ${weatherResult.city}`
      : `${req.query.weather || "24°C • Clear Skies in " + city}`;

    const { quote, author } = resolveQuoteAndAuthor(
      subscriber,
      track,
      req.query.quote,
      req.query.author,
    );

    let habits = subscriber?.customHabits;
    if (req.query.habits) {
      habits = req.query.habits.split(",").map((h) => h.trim());
    }

    const name = subscriber?.email
      ? subscriber.email.split("@")[0]
      : req.query.name ||
        (identifier ? identifier.replace(/^@/, "").split("@")[0] : "Morning Builder");

    const svg = generateWallpaperSvg({
      name,
      streak,
      track,
      weatherSpark: weatherSparkFormatted,
      quote,
      author,
      habits,
      lifetimeCheckins,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    );

    if (req.query.download === "true" || req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-routine-wallpaper-${streak}-days.svg"`,
      );
    }

    return res.send(svg);
  } catch (error) {
    logger.error("Failed to render dynamic mobile wallpaper", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
      .send(
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <rect width="1080" height="1920" fill="#050608"/>
        <text x="540" y="960" fill="#f43f5e" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="32" font-weight="700">Failed to render mobile wallpaper</text>
      </svg>`,
      );
  }
}

/**
 * GET /api/wallpaper/:token.svg & GET /api/wallpaper/:token
 */
async function getWallpaperByToken(req, res) {
  try {
    const token = req.params.token;
    const verifiedEmail = await resolveEmailFromToken(token);

    if (!verifiedEmail) {
      return res
        .status(401)
        .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
        .send(
          `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
          <rect width="1080" height="1920" fill="#050608"/>
          <text x="540" y="960" fill="#f43f5e" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="30" font-weight="700">Invalid or Expired Wallpaper Token</text>
        </svg>`,
        );
    }

    req.params.handleOrEmail = verifiedEmail;
    return getWallpaper(req, res);
  } catch (error) {
    logger.error("Failed to render wallpaper by token", { error: error.message });
    return res
      .status(500)
      .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
      .send(
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <rect width="1080" height="1920" fill="#050608"/>
        <text x="540" y="960" fill="#f43f5e" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="30" font-weight="700">Internal Wallpaper Error</text>
      </svg>`,
      );
  }
}

/**
 * GET /me/wallpaper.svg & GET /me/wallpaper (Authenticated subscriber session)
 */
async function getMyWallpaper(req, res) {
  try {
    const email = req.subscriberEmail || req.subscriber?.email;
    if (!email) {
      return res.status(401).json({ error: "Subscriber authentication required" });
    }
    req.params.handleOrEmail = email;
    return getWallpaper(req, res);
  } catch (error) {
    logger.error("Failed to serve authenticated wallpaper", { error: error.message });
    return res.status(500).json({ error: "Failed to render wallpaper" });
  }
}

function escapeHtml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/**
 * GET /s/:handle and GET /share/:handle
 * Renders an aesthetic mobile-first Obsidian Glassmorphism landing preview
 */
async function renderSocialShareCard(req, res) {
  try {
    const rawParam = (req.params?.handle || req.query?.handle || "").trim();
    if (!rawParam) {
      return res.redirect(302, "/");
    }

    const cleanHandle = rawParam
      .replace(/^@/, "")
      .replace(/\.svg$/, "")
      .trim();
    const handle = cleanHandle || "alex";

    const subscriber = await resolveSubscriber(rawParam);

    const streak = subscriber
      ? Math.max(Number(subscriber.streakCount ?? subscriber.streak_count) || 1, 1)
      : req.query.streak
        ? Math.max(Number(req.query.streak) || 1, 1)
        : 1;

    const trackKey =
      subscriber?.routineTrack ||
      subscriber?.templateType ||
      subscriber?.routine_track ||
      req.query.track ||
      "deep-work";

    const trackConfig = sharedData.TRACK_CONFIGS?.[trackKey] ||
      sharedData.TRACK_CONFIGS?.["deep-work"] || {
        name: "Deep Work & Builder",
        badge: "⚡ Deep Work & Builder",
        tagline: "High-focus engineering rituals & distraction-free flow states",
      };

    const trackBadge = trackConfig.badge || trackConfig.name || "⚡ Deep Work & Builder";

    const protocol = req.protocol || "http";
    const host =
      (typeof req.get === "function" ? req.get("host") : req?.headers?.host) || "localhost:3000";
    const baseUrl = (
      res?.locals?.apiBase ||
      process.env.RENDER_URL ||
      `${protocol}://${host}`
    ).replace(/\/+$/, "");

    const ogTitle = `@${handle}'s Morning Momentum & Habit Routine`;
    const ogDescription = `Check out @${handle}'s unbroken morning streak and routine on Morning Routine Sender!`;
    const ogImageUrl = `${baseUrl}/wallpaper/${handle}.svg`;
    const canonicalUrl = `${baseUrl}/s/${encodeURIComponent(handle)}`;
    const downloadUrl = `/wallpaper/${encodeURIComponent(handle)}?download=1`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=600");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#06080e">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <title>@${escapeHtml(handle)}'s Morning Momentum &amp; Habit Routine • Morning Routine Sender</title>
  <meta name="description" content="${escapeHtml(ogDescription)}">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">

  <!-- OpenGraph Social Metadata -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:site_name" content="Morning Routine Sender">
  <meta property="og:title" content="@${escapeHtml(handle)}'s Morning Momentum &amp; Habit Routine">
  <meta property="og:description" content="${escapeHtml(ogDescription)}">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:width" content="1080">
  <meta property="og:image:height" content="1920">
  <meta property="og:image:alt" content="@${escapeHtml(handle)}'s Lockscreen Routine Wallpaper">

  <!-- Twitter Card Metadata -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@MorningRoutine">
  <meta name="twitter:title" content="@${escapeHtml(handle)}'s Morning Momentum &amp; Habit Routine">
  <meta name="twitter:description" content="${escapeHtml(ogDescription)}">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">
  <meta name="twitter:image:alt" content="@${escapeHtml(handle)}'s Lockscreen Routine Wallpaper">

  <!-- Favicon & Touch Icons -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/mrn-brand-ico.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/responsive-layout.css">

  <style>
    :root {
      --bg: #06080e;
      --card-bg: rgba(10, 14, 26, 0.85);
      --border: rgba(255, 255, 255, 0.08);
      --border-hover: rgba(99, 102, 241, 0.4);
      --primary: #6366f1;
      --cyan: #38bdf8;
      --cyan-glow: rgba(56, 189, 248, 0.25);
      --emerald: #10b981;
      --amber: #f59e0b;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    *, *::before, *::after {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
      -webkit-tap-highlight-color: transparent;
    }
    html {
      scroll-behavior: smooth;
      -webkit-text-size-adjust: 100%;
    }
    body {
      background-color: var(--bg);
      background-image:
        radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.22) 0%, transparent 60%),
        radial-gradient(circle at 85% 30%, rgba(56, 189, 248, 0.16) 0%, transparent 50%),
        radial-gradient(circle at 15% 75%, rgba(16, 185, 129, 0.12) 0%, transparent 45%);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, sans-serif;
      min-height: 100vh;
      min-height: 100dvh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
      overflow-x: hidden;
    }
    .share-wrapper {
      width: 100%;
      max-width: 480px;
      margin: 0 auto;
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .brand-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 0 4px;
    }
    .brand-link {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      color: var(--text-main);
      font-weight: 800;
      font-size: 15px;
      letter-spacing: -0.02em;
      transition: opacity 0.2s ease;
    }
    .brand-link:hover {
      opacity: 0.9;
    }
    .brand-logo-img {
      width: 32px;
      height: 32px;
      border-radius: 8px;
    }
    .glass-card {
      background: var(--card-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 24px 20px;
      box-shadow: 0 20px 50px rgba(0, 0, 0, 0.6), 0 0 35px rgba(99, 102, 241, 0.12);
      display: flex;
      flex-direction: column;
      gap: 20px;
    }
    .user-profile-header {
      display: flex;
      flex-direction: column;
      gap: 12px;
      text-align: center;
      align-items: center;
    }
    .handle-title {
      font-size: clamp(1.5rem, 5vw, 1.85rem);
      font-weight: 800;
      color: #fff;
      letter-spacing: -0.02em;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
    }
    .badges-row {
      display: flex;
      align-items: center;
      justify-content: center;
      flex-wrap: wrap;
      gap: 10px;
    }
    .streak-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.4);
      color: var(--amber);
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 0 12px rgba(245, 158, 11, 0.2);
    }
    .track-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 14px;
      border-radius: 9999px;
      background: rgba(56, 189, 248, 0.14);
      border: 1px solid rgba(56, 189, 248, 0.35);
      color: var(--cyan);
      font-weight: 700;
      font-size: 13px;
      box-shadow: 0 0 12px var(--cyan-glow);
    }
    .wallpaper-preview-container {
      position: relative;
      width: 100%;
      border-radius: 18px;
      overflow: hidden;
      border: 1px solid var(--border);
      background: #050608;
      box-shadow: 0 12px 36px rgba(0, 0, 0, 0.7);
      aspect-ratio: 9 / 16;
      max-height: 440px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .wallpaper-preview-img {
      width: 100%;
      height: 100%;
      object-fit: cover;
      display: block;
    }
    .actions-list {
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .action-btn {
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 10px;
      width: 100%;
      min-height: 48px;
      padding: 12px 20px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      text-align: center;
      cursor: pointer;
      transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
      border: 1px solid transparent;
    }
    .action-btn:active {
      transform: scale(0.975);
    }
    .btn-download {
      background: linear-gradient(135deg, #6366f1, #38bdf8);
      color: #ffffff;
      box-shadow: 0 4px 18px rgba(99, 102, 241, 0.38);
    }
    .btn-download:hover {
      box-shadow: 0 6px 24px rgba(99, 102, 241, 0.55);
      transform: translateY(-1px);
    }
    .btn-routine {
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid rgba(255, 255, 255, 0.12);
      color: #f8fafc;
    }
    .btn-routine:hover {
      background: rgba(255, 255, 255, 0.1);
      border-color: rgba(255, 255, 255, 0.22);
      transform: translateY(-1px);
    }
    .btn-duel {
      background: rgba(244, 63, 94, 0.12);
      border: 1px solid rgba(244, 63, 94, 0.3);
      color: #fb7185;
    }
    .btn-duel:hover {
      background: rgba(244, 63, 94, 0.2);
      border-color: rgba(244, 63, 94, 0.5);
      transform: translateY(-1px);
    }
    .share-footer {
      text-align: center;
      font-size: 12px;
      color: var(--text-muted);
      line-height: 1.5;
    }
    .share-footer a {
      color: var(--cyan);
      text-decoration: none;
    }
    .share-footer a:hover {
      text-decoration: underline;
    }
    @media (prefers-reduced-motion: reduce) {
      *, ::before, ::after {
        animation-duration: 0.01ms !important;
        animation-iteration-count: 1 !important;
        transition-duration: 0.01ms !important;
        scroll-behavior: auto !important;
      }
    }
  </style>
</head>
<body>
  <main class="share-wrapper">
    <header class="brand-header">
      <a href="/" class="brand-link">
        <img src="/assets/logo.svg" alt="Morning Routine Sender" class="brand-logo-img" width="32" height="32" />
        <span>Morning Routine Sender</span>
      </a>
      <span class="track-badge">${escapeHtml(trackBadge)}</span>
    </header>

    <article class="glass-card">
      <header class="user-profile-header">
        <h1 class="handle-title" data-title="${escapeHtml(ogTitle)}">
          <span>@${escapeHtml(handle)}</span>
        </h1>
        <div class="badges-row">
          <div class="streak-badge">
            <span>🔥</span>
            <span>${streak} Day Streak</span>
          </div>
          <div class="track-badge">
            <span>${escapeHtml(trackBadge)}</span>
          </div>
        </div>
      </header>

      <div class="wallpaper-preview-container">
        <img
          src="/wallpaper/${encodeURIComponent(handle)}.svg"
          alt="@${escapeHtml(handle)}'s Lockscreen Routine Wallpaper"
          class="wallpaper-preview-img"
          width="1080"
          height="1920"
          loading="eager"
        />
      </div>

      <nav class="actions-list" aria-label="Social share actions">
        <a href="${downloadUrl}" class="action-btn btn-download" download>
          <span>📱 Download Lockscreen Wallpaper</span>
        </a>
        <a href="/" class="action-btn btn-routine">
          <span>⚡ Start Your Own Morning Routine</span>
        </a>
        <a href="/" class="action-btn btn-duel">
          <span>⚔️ Challenge to Morning Duel</span>
        </a>
      </nav>
    </article>

    <footer class="share-footer">
      <p>Powered by <a href="/">Morning Routine Sender</a> • Unshakable Daily Discipline</p>
    </footer>
  </main>
</body>
</html>`;

    return res.send(html);
  } catch (error) {
    logger.error("Failed to render social share card", {
      handle: req.params?.handle,
      error: error.message,
      stack: error.stack,
    });
    return res.status(500).send("Failed to render social share preview");
  }
}

module.exports = {
  getWallpaper,
  getWallpaperByToken,
  getMyWallpaper,
  renderSocialShareCard,
  resolveSubscriber,
  resolveEmailFromToken,
  resolveQuoteAndAuthor,
  getLifetimeCheckins,
};
