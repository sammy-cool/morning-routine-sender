// controllers/routine.controller.js
const { verifyUnsubscribeToken, verifyActionToken } = require("../helper/unsubscribeToken");
const sharedData = require("../helper/shared-data");
const logger = require("../logger");
const redis = require("../config/redisClient");

function escapeHtml(str) {
  if (!str) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * Helper to get subscriber email from redis session if available
 */
async function getSessionEmail(req) {
  const sessionToken = req.cookies?.mrn_session;
  if (!sessionToken) return null;
  try {
    return await redis.get(`subscriber_session:${sessionToken}`);
  } catch (_err) {
    return null;
  }
}

/**
 * GET /checkin & POST /checkin
 * 1-Click Habit Streak Check-in Endpoint (supports Web UI & PWA Background Sync)
 */
async function checkin(req, res) {
  const email = (req.query.email || req.body?.email || "").trim().toLowerCase();
  const token = req.query.token || req.body?.token;

  function sendResponse(data, statusCode = 200) {
    const isJson =
      req.xhr ||
      req.headers["x-offline-sync"] === "true" ||
      (req.headers.accept && req.headers.accept.includes("application/json")) ||
      req.query.format === "json";

    if (isJson) {
      return res
        .status(data.success ? statusCode : statusCode === 200 ? 400 : statusCode)
        .json(data);
    }
    return renderCheckinPage(res, data);
  }

  if (!email || !token) {
    return sendResponse({
      success: false,
      title: "Invalid Check-in Link",
      message: "This habit check-in link is missing required verification parameters.",
      badge: "Verification Error",
    });
  }

  const isValid =
    verifyActionToken(email, token, "checkin") ||
    verifyActionToken(email, token, "routine") ||
    verifyUnsubscribeToken(email, token);

  if (!isValid) {
    logger.warn("Invalid checkin token attempt", { email, ip: req.ip });
    return sendResponse({
      success: false,
      title: "Link Expired or Invalid",
      message:
        "We couldn't verify this check-in link. Please use the button in your latest morning routine email.",
      badge: "Security Check",
    });
  }

  try {
    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return sendResponse({
        success: false,
        title: "Subscriber Not Found",
        message: "No active subscription was found for this address.",
        badge: "Not Found",
      });
    }

    const checkinResult = await sharedData.recordCheckin(email, subscriber.timezone);
    const trackInfo = sharedData.getTrackContent(
      subscriber.routineTrack || subscriber.templateType,
    );
    const finalStreak =
      checkinResult.streakCount !== undefined
        ? checkinResult.streakCount
        : checkinResult.streak !== undefined
          ? checkinResult.streak
          : 1;

    if (checkinResult.alreadyCheckedInToday) {
      return sendResponse({
        success: true,
        streakCount: finalStreak,
        title: "Already Checked In Today! ⚡",
        message: `You've already logged your routine for today. Your streak is safe at ${finalStreak} days!`,
        quote: trackInfo.quote,
        badge: `${finalStreak}-Day Streak Maintained 🔥`,
        routineUrl: `/routine?email=${encodeURIComponent(email)}&token=${token}`,
      });
    }

    logger.info("Habit check-in recorded successfully", {
      email,
      streakCount: finalStreak,
      timezone: subscriber.timezone,
    });

    // Non-blocking trigger of routine.completed outbound webhook
    const outboundWebhookDispatcher = require("../helper/outboundWebhookDispatcher");
    outboundWebhookDispatcher
      .dispatchWebhookForSubscriber(subscriber, "routine.completed", {
        streak: finalStreak,
        alreadyCheckedInToday: Boolean(checkinResult.alreadyCheckedInToday),
        checkedInAt: new Date().toISOString(),
        track: subscriber.routineTrack || subscriber.templateType || "deep-work",
        quote: trackInfo.quote,
      })
      .catch((err) => {
        logger.error("Outbound webhook trigger failed on routine checkin", {
          error: err.message,
          email,
        });
      });

    return sendResponse({
      success: true,
      streakCount: finalStreak,
      title: `Day ${finalStreak} Complete! 🔥`,
      message: `Great job completing your morning routine. You have maintained a ${finalStreak}-day streak!`,
      quote: trackInfo.quote,
      badge: `${finalStreak}-Day Active Streak`,
      routineUrl: `/routine?email=${encodeURIComponent(email)}&token=${token}`,
    });
  } catch (err) {
    logger.error("Check-in controller error", { error: err.message, email });
    return sendResponse({
      success: false,
      title: "Server Error",
      message: "We encountered an issue saving your check-in. Please try again in a few moments.",
      badge: "Error",
    });
  }
}

function renderCheckinPage(res, data) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#050608">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>${escapeHtml(data.title)} • Morning Routine</title>
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/mrn-brand-ico.png">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="prefetch" href="/routine">
  <link rel="prefetch" href="/user-dashboard">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050608;
      --card-bg: rgba(12, 17, 29, 0.8);
      --primary: #7c3aed;
      --primary-glow: rgba(124, 58, 237, 0.4);
      --emerald: #34d399;
      --amber: #fbbf24;
      --border: rgba(255, 255, 255, 0.06);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.18) 0%, transparent 60%),
        radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.12) 0%, transparent 45%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: max(24px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(24px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid var(--border);
      border-radius: 24px;
      max-width: 520px;
      width: 100%;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 40px var(--primary-glow);
      position: relative;
      overflow: hidden;
      animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1);
    }
    @keyframes slideUp {
      from { opacity: 0; transform: translateY(20px) scale(0.98); }
      to { opacity: 1; transform: translateY(0) scale(1); }
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      background: ${data.success ? "rgba(16, 185, 129, 0.15)" : "rgba(239, 68, 68, 0.15)"};
      color: ${data.success ? "#34d399" : "#f87171"};
      border: 1px solid ${data.success ? "rgba(16, 185, 129, 0.3)" : "rgba(239, 68, 68, 0.3)"};
      margin-bottom: 24px;
    }
    .streak-hero {
      font-size: 64px;
      margin-bottom: 8px;
      display: inline-block;
      animation: pulse 2s infinite ease-in-out;
    }
    @keyframes pulse {
      0%, 100% { transform: scale(1); }
      50% { transform: scale(1.08); }
    }
    h1 {
      font-size: 26px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 12px;
      background: linear-gradient(135deg, #ffffff 30%, #94a3b8 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    p.lead {
      color: var(--text-muted);
      font-size: 15px;
      line-height: 1.6;
      margin-bottom: 24px;
    }
    .quote-box {
      background: rgba(255, 255, 255, 0.03);
      border-left: 3px solid var(--primary);
      border-radius: 12px;
      padding: 16px;
      font-size: 14px;
      font-style: italic;
      color: #cbd5e1;
      text-align: left;
      margin-bottom: 28px;
    }
    .btn-group {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 14px 24px;
      border-radius: 14px;
      font-size: 15px;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .btn-primary {
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #ffffff;
      box-shadow: 0 10px 20px -5px rgba(124, 58, 237, 0.4);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 24px -5px rgba(124, 58, 237, 0.6);
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #ffffff;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="badge">${escapeHtml(data.badge)}</div>
    ${
      data.success
        ? `
      <div>
        <span class="streak-hero">🔥</span>
        <div style="font-family:'JetBrains Mono',monospace; font-size:36px; font-weight:800; color:#fff; margin-bottom:12px;">
          ${data.streakCount || 1} <span style="font-size:18px; color:#fbbf24;">DAY STREAK</span>
        </div>
      </div>
    `
        : `
      <div style="font-size:48px; margin-bottom:12px;">⚠️</div>
    `
    }
    <h1>${escapeHtml(data.title)}</h1>
    <p class="lead">${escapeHtml(data.message)}</p>

    ${
      data.quote
        ? `
      <div class="quote-box">
        “${escapeHtml(data.quote)}”
      </div>
    `
        : ""
    }

    <div class="btn-group">
      <a href="${data.routineUrl || "/routine"}" class="btn btn-primary">
        ⚡ Open Live Routine Companion
      </a>
      <a href="/user-dashboard" class="btn btn-ghost">
        ⚙️ Manage Routine Preferences
      </a>
    </div>

    <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid var(--border); display: flex; justify-content: center; gap: 18px; font-size: 13px;">
      <a href="/" style="color: var(--text-muted); text-decoration: none; font-weight: 600;">🏠 Home</a>
      <a href="/about" style="color: var(--text-muted); text-decoration: none; font-weight: 600;">📖 About</a>
      <a href="/user-dashboard" style="color: var(--text-muted); text-decoration: none; font-weight: 600;">👤 Dashboard</a>
    </div>
  </div>
  <script src="/js/app-badging.js?v=4.3.0" defer></script>
  <script src="/js/ux-core.js?v=4.3.0" defer></script>
  <script>
    document.addEventListener("DOMContentLoaded", function () {
      if (window.AppBadging) {
        window.AppBadging.updateStreakBadge(${data.streakCount || 0});
      }
      if (window.UXCore) {
        if (${data.success ? "true" : "false"}) {
          if (window.UXCore.sound) window.UXCore.sound.playSuccess();
          if (window.UXCore.haptics) window.UXCore.haptics.success();
        }
      }
    });
  </script>
</body>
</html>`);
}

/**
 * GET /routine
 * Interactive Live Routine View & Focus Companion with Web Audio Ambient Soundscapes
 */
async function liveRoutine(req, res) {
  const sessionEmail = await getSessionEmail(req);
  const paramEmail = (req.query.email || "").trim().toLowerCase();
  const token = req.query.token;

  let activeEmail = sessionEmail;
  if (!activeEmail && paramEmail && token) {
    const isValid =
      verifyActionToken(paramEmail, token, "routine") ||
      verifyActionToken(paramEmail, token, "checkin") ||
      verifyUnsubscribeToken(paramEmail, token);
    if (isValid) {
      activeEmail = paramEmail;
    }
  }

  let subscriber = null;
  if (activeEmail) {
    subscriber = await sharedData.getUserByEmail(activeEmail);
  }

  const trackKey = subscriber?.routineTrack || subscriber?.templateType || "deep-work";
  const trackContent = sharedData.getTrackContent(trackKey);
  const streakCount = subscriber?.streakCount || 0;
  const { getDailyMorningSpark } = require("../helper/aiSparkGenerator");
  const spark = await getDailyMorningSpark({
    email: activeEmail || "",
    routineTrack: trackKey,
    streakCount: streakCount,
    timezone: subscriber?.timezone || "UTC",
    name: subscriber?.name || "",
  });

  const activeHabits =
    Array.isArray(subscriber?.customHabits) && subscriber.customHabits.length > 0
      ? subscriber.customHabits
      : trackContent.checklist || [];

  const rawDuration = Number(req.query.duration) || Number(subscriber?.focusDurationMinutes) || 25;
  const initialDurationMins = Math.max(5, Math.min(rawDuration, 180));

  const checkinHref = activeEmail
    ? "/checkin?email=" + encodeURIComponent(activeEmail) + "&token=" + (token || "")
    : "/user-dashboard";

  const checklistHtml = activeHabits
    .map(
      (item, idx) => `
          <label class="checklist-item" id="item-${idx}">
            <input type="checkbox" onchange="toggleItem(${idx})">
            <span>${escapeHtml(item)}</span>
          </label>`,
    )
    .join("\n");

  const domain = res.locals.apiBase || `${req.protocol}://${req.get("host")}`;

  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="index, follow">
  <meta name="description" content="Interactive 25-minute live morning routine focus companion with procedural soundscapes, ritual checklist, and daily inspiration.">
  <meta name="theme-color" content="#050608">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>Today's Morning Routine • ${escapeHtml(trackContent.name)}</title>
  <link rel="canonical" href="${domain}/routine">
  <meta property="og:title" content="Today's Morning Routine • ${escapeHtml(trackContent.name)}">
  <meta property="og:description" content="Interactive 25-minute live morning routine focus companion with procedural soundscapes, ritual checklist, and daily inspiration.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${domain}/routine">
  <meta property="og:image" content="${domain}/assets/screenshot-desktop.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="Today's Morning Routine • ${escapeHtml(trackContent.name)}">
  <meta name="twitter:description" content="Interactive 25-minute live morning routine focus companion with procedural soundscapes, ritual checklist, and daily inspiration.">
  <meta name="twitter:image" content="${domain}/assets/screenshot-desktop.png">
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="apple-touch-icon" href="/assets/mrn-brand-ico.png">
  <link rel="dns-prefetch" href="https://fonts.googleapis.com">
  <link rel="dns-prefetch" href="https://fonts.gstatic.com">
  <link rel="dns-prefetch" href="https://cdn.jsdelivr.net">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link rel="preconnect" href="https://cdn.jsdelivr.net" crossorigin>
  <link rel="preload" href="/assets/logo.svg" as="image" type="image/svg+xml" fetchpriority="high">
  <link rel="prefetch" href="/user-dashboard">
  <link rel="prefetch" href="/about">
  <script src="https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js" defer crossorigin="anonymous"></script>
  <script src="https://cdn.jsdelivr.net/npm/canvas-confetti@1.9.3/dist/confetti.browser.min.js" defer crossorigin="anonymous"></script>
  <script src="/js/offline-sync.js?v=4.3.0" defer></script>
  <script src="/js/app-badging.js?v=4.3.0" defer></script>
  <script src="/js/ux-core.js?v=4.3.0" defer></script>
  <style>
    :root {
      --bg: #050608;
      --card-bg: rgba(12, 17, 29, 0.8);
      --primary: #7c3aed;
      --primary-glow: rgba(124, 58, 237, 0.4);
      --emerald: #34d399;
      --amber: #fbbf24;
      --border: rgba(255, 255, 255, 0.06);
      --text-main: #f1f5f9;
      --text-muted: #94a3b8;
    }
    html.theme-solar, [data-theme="theme-solar"] {
      --bg: #0a0805;
      --card-bg: rgba(24, 18, 10, 0.8);
      --primary: #f59e0b;
      --primary-glow: rgba(245, 158, 11, 0.35);
      --border: rgba(245, 158, 11, 0.15);
    }
    html.theme-emerald, [data-theme="theme-emerald"] {
      --bg: #030806;
      --card-bg: rgba(8, 26, 18, 0.8);
      --primary: #10b981;
      --primary-glow: rgba(16, 185, 129, 0.35);
      --border: rgba(16, 185, 129, 0.15);
    }
    html.theme-cyberpunk, [data-theme="theme-cyberpunk"] {
      --bg: #07030f;
      --card-bg: rgba(18, 8, 32, 0.8);
      --primary: #d946ef;
      --primary-glow: rgba(217, 70, 239, 0.45);
      --border: rgba(217, 70, 239, 0.2);
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, var(--primary-glow) 0%, transparent 60%),
        radial-gradient(circle at 100% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%);
      color: var(--text-main);
      min-height: 100vh;
      transition: background-color 0.3s ease;
      padding: max(32px, env(safe-area-inset-top)) max(16px, env(safe-area-inset-right)) max(32px, env(safe-area-inset-bottom)) max(16px, env(safe-area-inset-left));
    }
    .container {
      max-width: 720px;
      margin: 0 auto;
    }
    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 24px;
      flex-wrap: wrap;
      gap: 12px;
    }
    .header-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      flex-wrap: wrap;
    }
    @media (max-width: 560px) {
      .header {
        flex-direction: column;
        align-items: flex-start;
        gap: 14px;
      }
      .header-actions {
        width: 100%;
        justify-content: space-between;
      }
      .card {
        padding: 24px 18px !important;
        border-radius: 20px !important;
      }
      .timer-display {
        font-size: 38px !important;
      }
    }
    .routine-footer {
      margin-top: 36px;
      padding: 24px 16px max(24px, env(safe-area-inset-bottom));
      text-align: center;
      border-top: 1px solid var(--border);
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
    }
    .routine-footer-links {
      display: flex;
      flex-wrap: wrap;
      justify-content: center;
      gap: 16px;
    }
    .routine-footer-link {
      color: var(--text-muted);
      text-decoration: none;
      font-size: 13px;
      font-weight: 600;
      transition: color 0.2s ease;
      display: inline-flex;
      align-items: center;
      gap: 5px;
    }
    .routine-footer-link:hover {
      color: #fff;
    }
    .routine-footer-note {
      font-size: 12px;
      color: var(--text-muted);
      opacity: 0.75;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 10px;
      font-size: 18px;
      font-weight: 800;
      color: #fff;
      text-decoration: none;
    }
    .streak-pill {
      background: rgba(245, 158, 11, 0.15);
      border: 1px solid rgba(245, 158, 11, 0.3);
      color: #fbbf24;
      padding: 6px 14px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }
    .card {
      background: var(--card-bg);
      backdrop-filter: blur(25px);
      -webkit-backdrop-filter: blur(25px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 36px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 30px var(--primary-glow);
    }
    .track-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(99, 102, 241, 0.15);
      color: #a5b4fc;
      border: 1px solid rgba(99, 102, 241, 0.3);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 13px;
      font-weight: 700;
      margin-bottom: 16px;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
      color: #fff;
    }
    p.tagline {
      color: var(--text-muted);
      font-size: 15px;
      margin-bottom: 20px;
    }
    .ritual-box {
      background: rgba(99, 102, 241, 0.08);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 16px;
      padding: 20px;
      margin-bottom: 24px;
    }
    .ritual-title {
      font-size: 14px;
      font-weight: 700;
      color: #a5b4fc;
      margin-bottom: 8px;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .ritual-text {
      font-size: 16px;
      line-height: 1.6;
      color: #f1f5f9;
      font-weight: 500;
    }
    .checklist-title {
      font-size: 14px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      margin-bottom: 12px;
    }
    .checklist {
      display: flex;
      flex-direction: column;
      gap: 10px;
      margin-bottom: 24px;
    }
    .checklist-item {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      padding: 12px 16px;
      border-radius: 12px;
      border: 1px solid var(--border);
      cursor: pointer;
      user-select: none;
      transition: all 0.2s;
    }
    .checklist-item:hover {
      background: rgba(255, 255, 255, 0.06);
    }
    .checklist-item input[type="checkbox"] {
      width: 18px;
      height: 18px;
      accent-color: var(--primary);
      cursor: pointer;
    }
    .checklist-item.done {
      text-decoration: line-through;
      color: var(--text-muted);
      opacity: 0.7;
    }
    .timer-card {
      text-align: center;
      background: rgba(0, 0, 0, 0.3);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
      border: 1px solid var(--border);
    }
    .timer-display {
      font-family: 'JetBrains Mono', monospace;
      font-size: 48px;
      font-weight: 700;
      color: #fff;
      margin-bottom: 16px;
      letter-spacing: 2px;
    }
    .timer-controls {
      display: flex;
      justify-content: center;
      gap: 10px;
    }
    .duration-pill {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      color: var(--text-muted);
      border-radius: 9999px;
      padding: 4px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .duration-pill:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    .duration-pill.active {
      background: var(--primary);
      border-color: var(--primary);
      color: #fff;
      box-shadow: 0 0 10px var(--primary-glow);
    }
    .btn {
      padding: 10px 20px;
      border-radius: 10px;
      font-size: 14px;
      font-weight: 700;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-start { background: var(--emerald); color: #fff; }
    .btn-pause { background: var(--amber); color: #fff; }
    .btn-reset { background: rgba(255, 255, 255, 0.1); color: #fff; }
    .btn-checkin {
      width: 100%;
      padding: 16px;
      border-radius: 14px;
      font-size: 16px;
      font-weight: 800;
      background: linear-gradient(135deg, #7c3aed, #6d28d9);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 20px -5px rgba(124, 58, 237, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
    }
    .btn-checkin:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px -5px rgba(124, 58, 237, 0.6);
    }
    /* Daily Journal & Reflection Styling */
    .journal-card {
      background: rgba(17, 24, 39, 0.75);
      border: 1px solid rgba(99, 102, 241, 0.2);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .mood-btn {
      padding: 8px;
      font-size: 20px;
      border: 1px solid var(--border);
      background: rgba(0, 0, 0, 0.25);
      border-radius: 10px;
      cursor: pointer;
      transition: all 0.2s;
    }
    .mood-btn:hover {
      background: rgba(99, 102, 241, 0.2);
      transform: scale(1.08);
    }
    .mood-btn.active {
      background: rgba(99, 102, 241, 0.35);
      border-color: var(--primary);
      box-shadow: 0 0 12px var(--primary-glow);
    }
    .journal-input:focus, .journal-textarea:focus {
      border-color: var(--primary) !important;
      box-shadow: 0 0 0 2px var(--primary-glow);
    }
    /* Ambient Soundscape Studio */
    .soundscape-card {
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid var(--border);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
    }
    .sound-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 16px;
      flex-wrap: wrap;
      gap: 8px;
    }
    .sound-title {
      font-size: 13px;
      font-weight: 700;
      color: var(--text-muted);
      text-transform: uppercase;
      letter-spacing: 0.05em;
      display: flex;
      align-items: center;
      gap: 6px;
    }
    .audio-visualizer {
      display: flex;
      align-items: flex-end;
      gap: 3px;
      height: 16px;
    }
    .audio-bar {
      width: 3px;
      height: 4px;
      background: #818cf8;
      border-radius: 2px;
      transition: height 0.2s ease;
    }
    .audio-visualizer.playing .audio-bar:nth-child(1) { animation: soundBar 0.8s infinite ease-in-out; }
    .audio-visualizer.playing .audio-bar:nth-child(2) { animation: soundBar 1.1s infinite ease-in-out 0.2s; }
    .audio-visualizer.playing .audio-bar:nth-child(3) { animation: soundBar 0.7s infinite ease-in-out 0.4s; }
    .audio-visualizer.playing .audio-bar:nth-child(4) { animation: soundBar 0.9s infinite ease-in-out 0.1s; }
    @keyframes soundBar {
      0%, 100% { height: 4px; }
      50% { height: 16px; background: #34d399; }
    }
    .preset-grid {
      display: grid;
      grid-template-columns: repeat(2, 1fr);
      gap: 10px;
      margin-bottom: 18px;
    }
    @media (max-width: 540px) {
      .preset-grid { grid-template-columns: 1fr; }
    }
    .preset-btn {
      display: flex;
      align-items: center;
      gap: 12px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 14px;
      padding: 12px 14px;
      cursor: pointer;
      text-align: left;
      transition: all 0.2s ease;
      color: var(--text-main);
    }
    .preset-btn:hover {
      background: rgba(255, 255, 255, 0.07);
      border-color: rgba(99, 102, 241, 0.4);
    }
    .preset-btn.active {
      background: rgba(99, 102, 241, 0.16);
      border-color: #6366f1;
      box-shadow: 0 0 15px rgba(99, 102, 241, 0.25);
    }
    .preset-icon {
      font-size: 24px;
      line-height: 1;
    }
    .preset-name {
      font-size: 14px;
      font-weight: 700;
      color: #fff;
    }
    .preset-desc {
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }
    .sound-controls {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 16px;
      flex-wrap: wrap;
      padding-top: 14px;
      border-top: 1px solid var(--border);
    }
    .sound-play-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .btn-sound-play {
      background: var(--primary);
      color: #fff;
      border: none;
      border-radius: 10px;
      padding: 8px 16px;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s;
    }
    .btn-sound-play:hover {
      filter: brightness(1.15);
    }
    .btn-sound-play.playing {
      background: #ef4444;
    }
    .vol-container {
      display: flex;
      align-items: center;
      gap: 10px;
      flex: 1;
      min-width: 160px;
      max-width: 240px;
    }
    .vol-slider {
      -webkit-appearance: none;
      appearance: none;
      width: 100%;
      height: 6px;
      background: rgba(255, 255, 255, 0.15);
      border-radius: 3px;
      outline: none;
      cursor: pointer;
    }
    .vol-slider::-webkit-slider-thumb {
      -webkit-appearance: none;
      appearance: none;
      width: 14px;
      height: 14px;
      border-radius: 50%;
      background: #818cf8;
      cursor: pointer;
      box-shadow: 0 0 8px rgba(99, 102, 241, 0.8);
    }
    .vol-label {
      font-family: 'JetBrains Mono', monospace;
      font-size: 12px;
      color: var(--text-muted);
      width: 38px;
    }
    .auto-sync-opt {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 12px;
      color: var(--text-muted);
      cursor: pointer;
      user-select: none;
      margin-top: 12px;
    }
    .auto-sync-opt input {
      accent-color: var(--primary);
      cursor: pointer;
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="/" class="brand" aria-label="Morning Routine Home">
        <img src="/assets/logo.svg" alt="Logo" width="28" height="28" style="border-radius: 8px;" loading="eager" decoding="async" fetchpriority="high"> Morning Routine
      </a>
      <div class="header-actions">
        <div class="streak-pill">
          🔥 ${streakCount}-Day Streak
        </div>
        <a href="/about" style="color: var(--text-muted); text-decoration: none; font-size: 13px; font-weight: 600; padding: 4px 8px;">
          About
        </a>
        <a href="/user-dashboard" style="color: #fff; background: rgba(255,255,255,0.08); text-decoration: none; font-size: 13px; font-weight: 600; padding: 6px 12px; border-radius: 9999px; border: 1px solid var(--border);">
          ⚙️ Dashboard
        </a>
      </div>
    </div>

    <div class="card">
      <div class="track-badge">${escapeHtml(trackContent.badge)}</div>
      <h1>Today's Action Ritual</h1>
      <p class="tagline">${escapeHtml(trackContent.tagline)}</p>

      <div class="ritual-box">
        <div class="ritual-title">🎯 Morning Focus</div>
        <div class="ritual-text">${escapeHtml(trackContent.ritual)}</div>
      </div>

      <!-- Dynamic AI Kickoff Spark & Focus Mantra Card -->
      <div style="background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(6, 182, 212, 0.1) 100%); border: 1px solid rgba(99, 102, 241, 0.3); border-radius: 16px; padding: 20px; margin-bottom: 24px;">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 10px; flex-wrap: wrap; gap: 8px;">
          <span style="font-size: 12px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.8px;">
            ⚡ Daily Kickoff Spark • ${escapeHtml(spark.source === "curated" ? "Curated Spark" : "AI Spark")}
          </span>
          <span style="font-size: 12px; font-weight: 700; color: #34d399; background: rgba(16, 185, 129, 0.15); border: 1px solid rgba(16, 185, 129, 0.3); padding: 3px 10px; border-radius: 9999px;">
            Mantra: "${escapeHtml(spark.focusMantra)}"
          </span>
        </div>
        <div style="font-size: 15px; color: #f8fafc; line-height: 1.6; font-weight: 500; margin-bottom: 12px;">
          ${escapeHtml(spark.sparkReflection)}
        </div>
        <div style="background: rgba(15, 23, 42, 0.6); border-left: 3px solid #10b981; border-radius: 8px; padding: 10px 14px;">
          <span style="font-size: 12px; font-weight: 800; color: #34d399; text-transform: uppercase;">🚀 2-Min Micro-Action:</span>
          <div style="font-size: 14px; color: #cbd5e1; margin-top: 2px; line-height: 1.5;">
            ${escapeHtml(spark.microAction)}
          </div>
        </div>
      </div>

      <div class="checklist-title">Morning Habit Checklist</div>
      <div class="checklist">
        ${checklistHtml}
      </div>

      <!-- Focus Sprint Timer -->
      <div class="timer-card">
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 12px; font-weight: 700; letter-spacing: 0.5px;">
          ⏱️ <span id="sprintDurationLabel">${initialDurationMins}</span>-MINUTE FOCUS SPRINT TIMER
        </div>
        <div class="timer-presets" style="display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <button type="button" class="duration-pill ${initialDurationMins === 15 ? "active" : ""}" onclick="setSprintDuration(15)">15m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 25 ? "active" : ""}" onclick="setSprintDuration(25)">25m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 45 ? "active" : ""}" onclick="setSprintDuration(45)">45m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 50 ? "active" : ""}" onclick="setSprintDuration(50)">50m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 60 ? "active" : ""}" onclick="setSprintDuration(60)">60m</button>
        </div>
        <div class="timer-display" id="timerDisplay">${String(initialDurationMins).padStart(2, "0")}:00</div>
        <div class="timer-controls">
          <button class="btn btn-start" id="startBtn" onclick="startTimer()">Start Sprint</button>
          <button class="btn btn-pause" id="pauseBtn" onclick="pauseTimer()" style="display:none;">Pause</button>
          <button class="btn btn-reset" onclick="resetTimer()">Reset</button>
        </div>
      </div>

      <!-- Ambient Focus Soundscape Studio -->
      <div class="soundscape-card">
        <div class="sound-header">
          <div class="sound-title">
            <span>🎧</span> Ambient Focus Soundscapes
          </div>
          <div class="audio-visualizer" id="audioVisualizer">
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
            <div class="audio-bar"></div>
          </div>
        </div>

        <div class="preset-grid">
          <button type="button" class="preset-btn active" id="preset-rain" onclick="selectPreset('rain')">
            <span class="preset-icon">🌧️</span>
            <div>
              <div class="preset-name">Rain & Storm</div>
              <div class="preset-desc">Lowpass White & Brown Noise</div>
            </div>
          </button>

          <button type="button" class="preset-btn" id="preset-waves" onclick="selectPreset('waves')">
            <span class="preset-icon">🌊</span>
            <div>
              <div class="preset-name">Ocean Waves</div>
              <div class="preset-desc">Pink Noise Periodic Swell</div>
            </div>
          </button>

          <button type="button" class="preset-btn" id="preset-binaural" onclick="selectPreset('binaural')">
            <span class="preset-icon">🧠</span>
            <div>
              <div class="preset-name">40Hz Binaural Beats</div>
              <div class="preset-desc">200Hz Carrier + 40Hz Focus</div>
            </div>
          </button>

          <button type="button" class="preset-btn" id="preset-flow" onclick="selectPreset('flow')">
            <span class="preset-icon">⚡</span>
            <div>
              <div class="preset-name">Deep Flow Tone</div>
              <div class="preset-desc">Harmonic Drone & Sub-Bass</div>
            </div>
          </button>

          <button type="button" class="preset-btn" id="preset-theta" onclick="selectPreset('theta')">
            <span class="preset-icon">🧘</span>
            <div>
              <div class="preset-name">Theta Waves</div>
              <div class="preset-desc">8Hz Binaural + 50Hz Sub Drone</div>
            </div>
          </button>

          <button type="button" class="preset-btn" id="preset-cafe" onclick="selectPreset('cafe')">
            <span class="preset-icon">☕</span>
            <div>
              <div class="preset-name">Cafe Ambience</div>
              <div class="preset-desc">650Hz Pink + Ceramic Pings</div>
            </div>
          </button>

          <button type="button" class="preset-btn" id="preset-forest" onclick="selectPreset('forest')">
            <span class="preset-icon">🌲</span>
            <div>
              <div class="preset-name">Forest Birds</div>
              <div class="preset-desc">Wind Brown Noise + FM Chirps</div>
            </div>
          </button>
        </div>

        <div class="sound-controls">
          <div class="sound-play-group">
            <button class="btn-sound-play" id="soundPlayBtn" onclick="toggleSound()">
              <span id="soundPlayIcon">▶</span> <span id="soundPlayText">Play Sound</span>
            </button>
          </div>

          <div class="vol-container">
            <span style="font-size: 14px;">🔈</span>
            <input type="range" class="vol-slider" id="volumeSlider" min="0" max="100" value="65" oninput="setMasterVolume(this.value)">
            <span class="vol-label" id="volPercent">65%</span>
          </div>
        </div>

        <label class="auto-sync-opt">
          <input type="checkbox" id="autoStartSound" checked>
          <span>Auto-start ambient soundscape when 25-min sprint timer starts</span>
        </label>
      </div>

      <!-- Daily Reflection & Morning Journal Card -->
      <div class="card journal-card" id="journalSection">
        <div class="card-title" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span style="font-weight:700; font-size:16px;">✍️ Morning Mindset & 3-Min Reflection</span>
          <span id="journalSyncStatus" style="font-size: 11px; color: var(--emerald); font-weight: 700; text-transform: uppercase; letter-spacing: 0.5px;">Auto-Saved</span>
        </div>
        <p style="font-size: 13px; color: var(--text-muted); margin-bottom: 16px; line-height: 1.5;">
          Capture your high-leverage focus, gratitude, and intentions before beginning your day.
        </p>

        <!-- Mood Selector -->
        <div style="margin-bottom: 16px;">
          <label style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 8px;">
            Current State & Energy
          </label>
          <div class="mood-selector" id="moodSelector" style="display: grid; grid-template-columns: repeat(5, 1fr); gap: 6px;">
            <button type="button" class="mood-btn" data-score="1" onclick="selectMood(1)">😫</button>
            <button type="button" class="mood-btn" data-score="2" onclick="selectMood(2)">😕</button>
            <button type="button" class="mood-btn" data-score="3" onclick="selectMood(3)">😐</button>
            <button type="button" class="mood-btn" data-score="4" onclick="selectMood(4)">🙂</button>
            <button type="button" class="mood-btn active" data-score="5" onclick="selectMood(5)">⚡</button>
          </div>
        </div>

        <!-- One Big Thing -->
        <div style="margin-bottom: 14px;">
          <label for="oneBigThingInput" style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
            🎯 My One Big Thing (Highest-Leverage Task)
          </label>
          <input type="text" id="oneBigThingInput" class="journal-input" placeholder="e.g., Deliver core architecture milestone without distractions" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px 12px; font-size: 13px; outline: none;">
        </div>

        <!-- Gratitude -->
        <div style="margin-bottom: 14px;">
          <label for="gratitudeInput" style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
            🙏 1 Thing I am Grateful For
          </label>
          <input type="text" id="gratitudeInput" class="journal-input" placeholder="e.g., Morning sunlight and deep mental clarity" style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px 12px; font-size: 13px; outline: none;">
        </div>

        <!-- Reflection Notes -->
        <div style="margin-bottom: 16px;">
          <label for="reflectionTextInput" style="display: block; font-size: 12px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
            💭 Mindset Notes & Intentions
          </label>
          <textarea id="reflectionTextInput" class="journal-textarea" rows="3" placeholder="Any thoughts, intentions, or Stoic reminders for today..." style="width: 100%; background: rgba(0,0,0,0.3); border: 1px solid var(--border); border-radius: 8px; color: #fff; padding: 10px 12px; font-size: 13px; outline: none; resize: vertical;"></textarea>
        </div>

        <div style="display: flex; gap: 8px; justify-content: space-between; align-items: center; flex-wrap: wrap;">
          <button type="button" class="btn" id="saveJournalBtn" onclick="saveMorningJournal()" style="background: var(--primary); color: #fff; border: none; border-radius: 8px; padding: 10px 18px; font-size: 13px; font-weight: 700; cursor: pointer; display: inline-flex; align-items: center; gap: 6px;">
            💾 Save Reflection
          </button>
          <a href="/api/journal/export?format=markdown${activeEmail ? "&email=" + encodeURIComponent(activeEmail) : ""}${token ? "&token=" + token : ""}" class="btn-export-journal" style="color: var(--text-muted); text-decoration: none; font-size: 12px; font-weight: 600; padding: 8px 12px; border: 1px solid var(--border); border-radius: 8px;">
            📥 Export Journal (.md)
          </a>
        </div>
      </div>

      <a href="${checkinHref}" class="btn-checkin" id="routineCheckinBtn" data-action="checkin" data-email="${escapeHtml(activeEmail || "")}" data-token="${escapeHtml(token || "")}">
        ⚡ Complete Routine & Maintain Streak
      </a>
    </div>

    <!-- Routine Companion Responsive Footer -->
    <footer class="routine-footer" role="contentinfo">
      <div class="routine-footer-links">
        <a href="/" class="routine-footer-link">🏠 Home</a>
        <a href="/user-dashboard" class="routine-footer-link">📊 Dashboard</a>
        <a href="/about" class="routine-footer-link">ℹ️ About</a>
        <a href="/unsubscribe" class="routine-footer-link">⚙️ Preferences</a>
      </div>
      <p class="routine-footer-note">Morning Routine Sender • Daily Focus Companion</p>
    </footer>
  </div>

  <script>
    function toggleItem(idx) {
      const el = document.getElementById('item-' + idx);
      el.classList.toggle('done');
    }

    let durationMinutes = ${initialDurationMins};
    let timeLeft = durationMinutes * 60;
    let timerInterval = null;

    function formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    // --- Web Audio Ambient Soundscape Generator Engine ---
    let audioCtx = null;
    let masterGainNode = null;
    let activeNodes = [];
    let currentPreset = 'rain';
    let isSoundPlaying = false;

    function getAudioContext() {
      if (!audioCtx) {
        const AudioCtxClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioCtxClass();
        masterGainNode = audioCtx.createGain();
        const initialVol = parseFloat(document.getElementById('volumeSlider').value) / 100;
        masterGainNode.gain.setValueAtTime(initialVol, audioCtx.currentTime);
        masterGainNode.connect(audioCtx.destination);
      }
      if (audioCtx.state === 'suspended') {
        audioCtx.resume();
      }
      return audioCtx;
    }

    let cachedWhite = null, cachedPink = null, cachedBrown = null;

    function createWhiteNoiseBuffer(ctx, duration = 5) {
      if (cachedWhite) return cachedWhite;
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        for (let i = 0; i < data.length; i++) {
          data[i] = Math.random() * 2 - 1;
        }
      }
      cachedWhite = buffer;
      return cachedWhite;
    }

    function createPinkNoiseBuffer(ctx, duration = 5) {
      if (cachedPink) return cachedPink;
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          b0 = 0.99886 * b0 + white * 0.0555179;
          b1 = 0.99332 * b1 + white * 0.0750759;
          b2 = 0.96900 * b2 + white * 0.1538520;
          b3 = 0.86650 * b3 + white * 0.3104856;
          b4 = 0.55000 * b4 + white * 0.5329522;
          b5 = -0.7616 * b5 - white * 0.0168980;
          data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
          b6 = white * 0.115926;
        }
      }
      cachedPink = buffer;
      return cachedPink;
    }

    function createBrownNoiseBuffer(ctx, duration = 5) {
      if (cachedBrown) return cachedBrown;
      const sampleRate = ctx.sampleRate;
      const buffer = ctx.createBuffer(2, sampleRate * duration, sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const data = buffer.getChannelData(ch);
        let lastOut = 0.0;
        for (let i = 0; i < data.length; i++) {
          const white = Math.random() * 2 - 1;
          data[i] = (lastOut + (0.02 * white)) / 1.02;
          lastOut = data[i];
          data[i] *= 3.5;
        }
      }
      cachedBrown = buffer;
      return cachedBrown;
    }

    function buildRain(ctx, outNode) {
      const rainGain = ctx.createGain();
      rainGain.gain.setValueAtTime(0.001, ctx.currentTime);
      rainGain.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.4);
      rainGain.connect(outNode);

      const whiteSrc = ctx.createBufferSource();
      whiteSrc.buffer = createWhiteNoiseBuffer(ctx, 5);
      whiteSrc.loop = true;
      const whiteFilter = ctx.createBiquadFilter();
      whiteFilter.type = 'lowpass';
      whiteFilter.frequency.setValueAtTime(950, ctx.currentTime);
      const whiteGain = ctx.createGain();
      whiteGain.gain.setValueAtTime(0.35, ctx.currentTime);
      whiteSrc.connect(whiteFilter);
      whiteFilter.connect(whiteGain);
      whiteGain.connect(rainGain);

      const brownSrc = ctx.createBufferSource();
      brownSrc.buffer = createBrownNoiseBuffer(ctx, 5);
      brownSrc.loop = true;
      const brownFilter = ctx.createBiquadFilter();
      brownFilter.type = 'lowpass';
      brownFilter.frequency.setValueAtTime(320, ctx.currentTime);
      const brownGain = ctx.createGain();
      brownGain.gain.setValueAtTime(0.65, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.18, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(0.2, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(brownGain.gain);

      brownSrc.connect(brownFilter);
      brownFilter.connect(brownGain);
      brownGain.connect(rainGain);

      whiteSrc.start();
      brownSrc.start();
      lfo.start();
      return [whiteSrc, brownSrc, lfo, rainGain];
    }

    function buildOcean(ctx, outNode) {
      const oceanGain = ctx.createGain();
      oceanGain.gain.setValueAtTime(0.001, ctx.currentTime);
      oceanGain.gain.exponentialRampToValueAtTime(0.8, ctx.currentTime + 0.4);
      oceanGain.connect(outNode);

      const pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = createPinkNoiseBuffer(ctx, 6);
      pinkSrc.loop = true;

      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'lowpass';
      waveFilter.frequency.setValueAtTime(450, ctx.currentTime);
      waveFilter.Q.setValueAtTime(1.5, ctx.currentTime);

      const waveGain = ctx.createGain();
      waveGain.gain.setValueAtTime(0.45, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.1, ctx.currentTime);

      const lfoGainMod = ctx.createGain();
      lfoGainMod.gain.setValueAtTime(0.35, ctx.currentTime);
      lfo.connect(lfoGainMod);
      lfoGainMod.connect(waveGain.gain);

      const lfoFilterMod = ctx.createGain();
      lfoFilterMod.gain.setValueAtTime(350, ctx.currentTime);
      lfo.connect(lfoFilterMod);
      lfoFilterMod.connect(waveFilter.frequency);

      pinkSrc.connect(waveFilter);
      waveFilter.connect(waveGain);
      waveGain.connect(oceanGain);

      pinkSrc.start();
      lfo.start();
      return [pinkSrc, lfo, oceanGain];
    }

    function buildBinaural(ctx, outNode) {
      const beatMaster = ctx.createGain();
      beatMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      beatMaster.gain.exponentialRampToValueAtTime(0.65, ctx.currentTime + 0.4);
      beatMaster.connect(outNode);

      const leftOsc = ctx.createOscillator();
      leftOsc.type = 'sine';
      leftOsc.frequency.setValueAtTime(200, ctx.currentTime);

      const rightOsc = ctx.createOscillator();
      rightOsc.type = 'sine';
      rightOsc.frequency.setValueAtTime(240, ctx.currentTime);

      const nodes = [leftOsc, rightOsc, beatMaster];

      if (ctx.createStereoPanner) {
        const leftPan = ctx.createStereoPanner();
        leftPan.pan.setValueAtTime(-1, ctx.currentTime);
        const rightPan = ctx.createStereoPanner();
        rightPan.pan.setValueAtTime(1, ctx.currentTime);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.4, ctx.currentTime);

        leftOsc.connect(leftPan);
        leftPan.connect(oscGain);
        rightOsc.connect(rightPan);
        rightPan.connect(oscGain);
        oscGain.connect(beatMaster);
        nodes.push(leftPan, rightPan, oscGain);
      } else {
        const merger = ctx.createChannelMerger(2);
        leftOsc.connect(merger, 0, 0);
        rightOsc.connect(merger, 0, 1);
        merger.connect(beatMaster);
        nodes.push(merger);
      }

      const pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = createPinkNoiseBuffer(ctx, 5);
      pinkSrc.loop = true;
      const pinkFilter = ctx.createBiquadFilter();
      pinkFilter.type = 'lowpass';
      pinkFilter.frequency.setValueAtTime(280, ctx.currentTime);
      const pinkGain = ctx.createGain();
      pinkGain.gain.setValueAtTime(0.15, ctx.currentTime);

      pinkSrc.connect(pinkFilter);
      pinkFilter.connect(pinkGain);
      pinkGain.connect(beatMaster);

      leftOsc.start();
      rightOsc.start();
      pinkSrc.start();
      nodes.push(pinkSrc);
      return nodes;
    }

    function buildFlow(ctx, outNode) {
      const flowMaster = ctx.createGain();
      flowMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      flowMaster.gain.exponentialRampToValueAtTime(0.6, ctx.currentTime + 0.4);
      flowMaster.connect(outNode);

      const osc1 = ctx.createOscillator(); osc1.type = 'sine'; osc1.frequency.setValueAtTime(110, ctx.currentTime);
      const osc2 = ctx.createOscillator(); osc2.type = 'sine'; osc2.frequency.setValueAtTime(110.8, ctx.currentTime);
      const oscSub = ctx.createOscillator(); oscSub.type = 'sine'; oscSub.frequency.setValueAtTime(55, ctx.currentTime);
      const oscHarm = ctx.createOscillator(); oscHarm.type = 'triangle'; oscHarm.frequency.setValueAtTime(165, ctx.currentTime);
      const oscHigh = ctx.createOscillator(); oscHigh.type = 'sine'; oscHigh.frequency.setValueAtTime(220, ctx.currentTime);

      const g1 = ctx.createGain(); g1.gain.setValueAtTime(0.28, ctx.currentTime);
      const g2 = ctx.createGain(); g2.gain.setValueAtTime(0.25, ctx.currentTime);
      const gSub = ctx.createGain(); gSub.gain.setValueAtTime(0.35, ctx.currentTime);
      const gHarm = ctx.createGain(); gHarm.gain.setValueAtTime(0.12, ctx.currentTime);
      const gHigh = ctx.createGain(); gHigh.gain.setValueAtTime(0.08, ctx.currentTime);

      const filter = ctx.createBiquadFilter();
      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(360, ctx.currentTime);
      filter.Q.setValueAtTime(2.2, ctx.currentTime);

      const lfo = ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.05, ctx.currentTime);
      const lfoGain = ctx.createGain();
      lfoGain.gain.setValueAtTime(140, ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      osc1.connect(g1); g1.connect(filter);
      osc2.connect(g2); g2.connect(filter);
      oscSub.connect(gSub); gSub.connect(filter);
      oscHarm.connect(gHarm); gHarm.connect(filter);
      oscHigh.connect(gHigh); gHigh.connect(filter);
      filter.connect(flowMaster);

      osc1.start(); osc2.start(); oscSub.start(); oscHarm.start(); oscHigh.start(); lfo.start();
      return [osc1, osc2, oscSub, oscHarm, oscHigh, lfo, flowMaster];
    }

    // --- Preset 5: Theta Waves (8Hz Binaural + 50Hz Sub Drone) ---
    function buildTheta(ctx, outNode) {
      const thetaMaster = ctx.createGain();
      thetaMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      thetaMaster.gain.exponentialRampToValueAtTime(0.65, ctx.currentTime + 0.4);
      thetaMaster.connect(outNode);

      const leftOsc = ctx.createOscillator();
      leftOsc.type = 'sine';
      leftOsc.frequency.setValueAtTime(200, ctx.currentTime);

      const rightOsc = ctx.createOscillator();
      rightOsc.type = 'sine';
      rightOsc.frequency.setValueAtTime(208, ctx.currentTime);

      const subOsc = ctx.createOscillator();
      subOsc.type = 'sine';
      subOsc.frequency.setValueAtTime(50, ctx.currentTime);

      const subGain = ctx.createGain();
      subGain.gain.setValueAtTime(0.28, ctx.currentTime);
      subOsc.connect(subGain);
      subGain.connect(thetaMaster);

      const nodes = [leftOsc, rightOsc, subOsc, subGain, thetaMaster];

      if (ctx.createStereoPanner) {
        const leftPan = ctx.createStereoPanner();
        leftPan.pan.setValueAtTime(-1, ctx.currentTime);
        const rightPan = ctx.createStereoPanner();
        rightPan.pan.setValueAtTime(1, ctx.currentTime);

        const oscGain = ctx.createGain();
        oscGain.gain.setValueAtTime(0.35, ctx.currentTime);

        leftOsc.connect(leftPan);
        leftPan.connect(oscGain);
        rightOsc.connect(rightPan);
        rightPan.connect(oscGain);
        oscGain.connect(thetaMaster);
        nodes.push(leftPan, rightPan, oscGain);
      } else {
        const merger = ctx.createChannelMerger(2);
        leftOsc.connect(merger, 0, 0);
        rightOsc.connect(merger, 0, 1);
        merger.connect(thetaMaster);
        nodes.push(merger);
      }

      const pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = createPinkNoiseBuffer(ctx, 5);
      pinkSrc.loop = true;
      const pinkFilter = ctx.createBiquadFilter();
      pinkFilter.type = 'lowpass';
      pinkFilter.frequency.setValueAtTime(220, ctx.currentTime);
      const pinkGain = ctx.createGain();
      pinkGain.gain.setValueAtTime(0.12, ctx.currentTime);

      pinkSrc.connect(pinkFilter);
      pinkFilter.connect(pinkGain);
      pinkGain.connect(thetaMaster);

      leftOsc.start();
      rightOsc.start();
      subOsc.start();
      pinkSrc.start();
      nodes.push(pinkSrc);
      return nodes;
    }

    // --- Preset 6: Cafe Ambience (Bandpassed Pink 650Hz + Stochastic Ceramic Pings) ---
    function buildCafe(ctx, outNode) {
      const cafeMaster = ctx.createGain();
      cafeMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      cafeMaster.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.4);
      cafeMaster.connect(outNode);

      const pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = createPinkNoiseBuffer(ctx, 6);
      pinkSrc.loop = true;

      const bpFilter = ctx.createBiquadFilter();
      bpFilter.type = 'bandpass';
      bpFilter.frequency.setValueAtTime(650, ctx.currentTime);
      bpFilter.Q.setValueAtTime(1.2, ctx.currentTime);

      const murmurLfo = ctx.createOscillator();
      murmurLfo.frequency.setValueAtTime(0.25, ctx.currentTime);
      const murmurLfoGain = ctx.createGain();
      murmurLfoGain.gain.setValueAtTime(120, ctx.currentTime);
      murmurLfo.connect(murmurLfoGain);
      murmurLfoGain.connect(bpFilter.frequency);

      const pinkGain = ctx.createGain();
      pinkGain.gain.setValueAtTime(0.55, ctx.currentTime);

      pinkSrc.connect(bpFilter);
      bpFilter.connect(pinkGain);
      pinkGain.connect(cafeMaster);

      const brownSrc = ctx.createBufferSource();
      brownSrc.buffer = createBrownNoiseBuffer(ctx, 5);
      brownSrc.loop = true;
      const rumbleFilter = ctx.createBiquadFilter();
      rumbleFilter.type = 'lowpass';
      rumbleFilter.frequency.setValueAtTime(180, ctx.currentTime);
      const rumbleGain = ctx.createGain();
      rumbleGain.gain.setValueAtTime(0.3, ctx.currentTime);
      brownSrc.connect(rumbleFilter);
      rumbleFilter.connect(rumbleGain);
      rumbleGain.connect(cafeMaster);

      let pingTimer = null;
      let isRunning = true;

      function scheduleNextPing() {
        if (!isRunning || !audioCtx || audioCtx.state === 'closed') return;
        const delay = 1200 + Math.random() * 3200;
        pingTimer = setTimeout(() => {
          if (!isRunning || !audioCtx || audioCtx.state === 'closed') return;
          try {
            const now = ctx.currentTime;
            const pingFreq = 2000 + Math.random() * 800;
            const pingDuration = 0.08 + Math.random() * 0.08;

            const pingOsc = ctx.createOscillator();
            const pingGain = ctx.createGain();
            pingOsc.type = 'sine';
            pingOsc.frequency.setValueAtTime(pingFreq, now);

            const pingHarm = ctx.createOscillator();
            const harmGain = ctx.createGain();
            pingHarm.type = 'triangle';
            pingHarm.frequency.setValueAtTime(pingFreq * 1.58, now);

            pingGain.gain.setValueAtTime(0.001, now);
            pingGain.gain.linearRampToValueAtTime(0.06 + Math.random() * 0.05, now + 0.003);
            pingGain.gain.exponentialRampToValueAtTime(0.0001, now + pingDuration);

            harmGain.gain.setValueAtTime(0.001, now);
            harmGain.gain.linearRampToValueAtTime(0.02 + Math.random() * 0.02, now + 0.002);
            harmGain.gain.exponentialRampToValueAtTime(0.0001, now + pingDuration * 0.7);

            pingOsc.connect(pingGain);
            pingGain.connect(cafeMaster);
            pingHarm.connect(harmGain);
            harmGain.connect(cafeMaster);

            pingOsc.onended = () => {
              try { pingOsc.disconnect(); pingGain.disconnect(); } catch (_e) {}
            };
            pingHarm.onended = () => {
              try { pingHarm.disconnect(); harmGain.disconnect(); } catch (_e) {}
            };

            pingOsc.start(now);
            pingHarm.start(now);
            pingOsc.stop(now + pingDuration + 0.02);
            pingHarm.stop(now + pingDuration + 0.02);
          } catch (_err) {}

          scheduleNextPing();
        }, delay);
      }

      scheduleNextPing();
      pinkSrc.start();
      brownSrc.start();
      murmurLfo.start();

      const timerHandle = {
        stop: () => {
          isRunning = false;
          if (pingTimer) clearTimeout(pingTimer);
        },
        disconnect: () => {
          isRunning = false;
          if (pingTimer) clearTimeout(pingTimer);
        }
      };

      return [pinkSrc, brownSrc, murmurLfo, timerHandle, cafeMaster];
    }

    // --- Preset 7: Forest Birds (Wind Brown Noise + Procedural FM Chirps) ---
    function buildForest(ctx, outNode) {
      const forestMaster = ctx.createGain();
      forestMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      forestMaster.gain.exponentialRampToValueAtTime(0.7, ctx.currentTime + 0.4);
      forestMaster.connect(outNode);

      const brownSrc = ctx.createBufferSource();
      brownSrc.buffer = createBrownNoiseBuffer(ctx, 6);
      brownSrc.loop = true;

      const windFilter = ctx.createBiquadFilter();
      windFilter.type = 'lowpass';
      windFilter.frequency.setValueAtTime(380, ctx.currentTime);
      windFilter.Q.setValueAtTime(2.0, ctx.currentTime);

      const windLfo = ctx.createOscillator();
      windLfo.type = 'sine';
      windLfo.frequency.setValueAtTime(0.12, ctx.currentTime);

      const windLfoGain = ctx.createGain();
      windLfoGain.gain.setValueAtTime(220, ctx.currentTime);
      windLfo.connect(windLfoGain);
      windLfoGain.connect(windFilter.frequency);

      const windGain = ctx.createGain();
      windGain.gain.setValueAtTime(0.42, ctx.currentTime);

      const windAmpLfo = ctx.createOscillator();
      windAmpLfo.frequency.setValueAtTime(0.08, ctx.currentTime);
      const windAmpGain = ctx.createGain();
      windAmpGain.gain.setValueAtTime(0.15, ctx.currentTime);
      windAmpLfo.connect(windAmpGain);
      windAmpGain.connect(windGain.gain);

      brownSrc.connect(windFilter);
      windFilter.connect(windGain);
      windGain.connect(forestMaster);

      const pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = createPinkNoiseBuffer(ctx, 5);
      pinkSrc.loop = true;
      const leafFilter = ctx.createBiquadFilter();
      leafFilter.type = 'bandpass';
      leafFilter.frequency.setValueAtTime(1400, ctx.currentTime);
      leafFilter.Q.setValueAtTime(0.8, ctx.currentTime);
      const leafGain = ctx.createGain();
      leafGain.gain.setValueAtTime(0.08, ctx.currentTime);
      pinkSrc.connect(leafFilter);
      leafFilter.connect(leafGain);
      leafGain.connect(forestMaster);

      let chirpTimer = null;
      let isRunning = true;

      function triggerBirdChirp() {
        if (!isRunning || !audioCtx || audioCtx.state === 'closed') return;
        try {
          const now = ctx.currentTime;
          const baseFreq = 2800 + Math.random() * 1200;
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();
          osc.type = 'sine';
          osc.frequency.setValueAtTime(baseFreq, now);
          osc.frequency.exponentialRampToValueAtTime(baseFreq + 600, now + 0.04);
          osc.frequency.exponentialRampToValueAtTime(baseFreq - 300, now + 0.12);

          gain.gain.setValueAtTime(0.001, now);
          gain.gain.linearRampToValueAtTime(0.12, now + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.14);

          osc.connect(gain);
          gain.connect(forestMaster);

          osc.onended = () => {
            try { osc.disconnect(); gain.disconnect(); } catch (_e) {}
          };

          osc.start(now);
          osc.stop(now + 0.15);
        } catch(_e) {}
      }

      function scheduleNextChirp() {
        if (!isRunning || !audioCtx || audioCtx.state === 'closed') return;
        const delay = 1800 + Math.random() * 3800;
        chirpTimer = setTimeout(() => {
          if (!isRunning || !audioCtx || audioCtx.state === 'closed') return;
          triggerBirdChirp();
          scheduleNextChirp();
        }, delay);
      }

      scheduleNextChirp();
      brownSrc.start();
      pinkSrc.start();
      windLfo.start();
      windAmpLfo.start();

      const timerHandle = {
        stop: () => {
          isRunning = false;
          if (chirpTimer) clearTimeout(chirpTimer);
        },
        disconnect: () => {
          isRunning = false;
          if (chirpTimer) clearTimeout(chirpTimer);
        }
      };

      return [brownSrc, pinkSrc, windLfo, windAmpLfo, timerHandle, forestMaster];
    }

    const PRESETS = ['rain', 'waves', 'binaural', 'flow', 'theta', 'cafe', 'forest'];

    function stopSoundNodes(duration = 0.15) {
      if (activeNodes.length === 0) return;
      const nodes = [...activeNodes];
      activeNodes = [];
      if (audioCtx) {
        nodes.forEach(n => {
          if (n instanceof GainNode) {
            try { n.gain.linearRampToValueAtTime(0.0001, audioCtx.currentTime + duration); } catch(e){}
          }
        });
      }
      setTimeout(() => {
        nodes.forEach(n => {
          try { if (n.stop) n.stop(); if (n.disconnect) n.disconnect(); } catch(e){}
        });
      }, duration * 1000 + 20);
    }

    function startSoundscape(preset) {
      const ctx = getAudioContext();
      stopSoundNodes(0.12);
      setTimeout(() => {
        if (preset === 'rain') activeNodes = buildRain(ctx, masterGainNode);
        else if (preset === 'waves') activeNodes = buildOcean(ctx, masterGainNode);
        else if (preset === 'binaural') activeNodes = buildBinaural(ctx, masterGainNode);
        else if (preset === 'flow') activeNodes = buildFlow(ctx, masterGainNode);
        else if (preset === 'theta') activeNodes = buildTheta(ctx, masterGainNode);
        else if (preset === 'cafe') activeNodes = buildCafe(ctx, masterGainNode);
        else if (preset === 'forest') activeNodes = buildForest(ctx, masterGainNode);
        isSoundPlaying = true;
        updateSoundUI();
      }, 160);
    }

    function selectPreset(preset) {
      currentPreset = preset;
      PRESETS.forEach(p => {
        const btn = document.getElementById('preset-' + p);
        if (btn) btn.classList.toggle('active', p === preset);
      });
      if (isSoundPlaying) {
        startSoundscape(preset);
      }
    }

    function toggleSound() {
      if (isSoundPlaying) {
        stopSoundNodes(0.3);
        isSoundPlaying = false;
        updateSoundUI();
      } else {
        startSoundscape(currentPreset);
      }
    }

    function setMasterVolume(val) {
      const vol = Math.max(0, Math.min(100, parseInt(val, 10))) / 100;
      document.getElementById('volPercent').innerText = Math.round(vol * 100) + '%';
      if (masterGainNode && audioCtx) {
        masterGainNode.gain.cancelScheduledValues(audioCtx.currentTime);
        masterGainNode.gain.linearRampToValueAtTime(vol, audioCtx.currentTime + 0.05);
      }
    }

    function updateSoundUI() {
      const playBtn = document.getElementById('soundPlayBtn');
      const icon = document.getElementById('soundPlayIcon');
      const text = document.getElementById('soundPlayText');
      const visualizer = document.getElementById('audioVisualizer');

      if (isSoundPlaying) {
        playBtn.classList.add('playing');
        icon.innerText = '⏸';
        text.innerText = 'Pause Sound';
        visualizer.classList.add('playing');
      } else {
        playBtn.classList.remove('playing');
        icon.innerText = '▶';
        text.innerText = 'Play Sound';
        visualizer.classList.remove('playing');
      }
    }

    function startTimer() {
      if (timerInterval) return;
      document.getElementById('startBtn').style.display = 'none';
      document.getElementById('pauseBtn').style.display = 'inline-block';

      const autoStart = document.getElementById('autoStartSound')?.checked;
      if (autoStart && !isSoundPlaying) {
        startSoundscape(currentPreset);
      }

      timerInterval = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          if (isSoundPlaying) {
            stopSoundNodes(0.8);
            isSoundPlaying = false;
            updateSoundUI();
          }
          if (typeof customizableToast !== "undefined" && typeof customizableToast.createToast === "function") {
            customizableToast.createToast({
              message: "🎉 <b>Focus sprint completed!</b> Great job maintaining morning momentum.",
              type: "success",
              allowHtml: true,
              showProgressBar: true,
              progressPosition: "bottom",
              progressColor: "#7c3aed",
              pauseOnHover: true,
              duration: 8000,
              fontFamily: "'Plus Jakarta Sans', sans-serif",
              borderRadius: "16px",
              cta: {
                label: "🔥 1-Click Check-in",
                variant: "link",
                href: "${checkinHref}"
              }
            });
          } else {
            alert('🎉 Focus sprint completed! Time for a short break.');
          }
        }
      }, 1000);
    }

    function pauseTimer() {
      clearInterval(timerInterval);
      timerInterval = null;
      document.getElementById('startBtn').style.display = 'inline-block';
      document.getElementById('pauseBtn').style.display = 'none';
    }

    function setSprintDuration(mins) {
      pauseTimer();
      durationMinutes = Math.max(5, Math.min(Number(mins) || 25, 180));
      timeLeft = durationMinutes * 60;
      document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
      const label = document.getElementById('sprintDurationLabel');
      if (label) label.textContent = durationMinutes;
      document.querySelectorAll('.duration-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === durationMinutes + 'm');
      });
      try {
        localStorage.setItem('mrn_focus_duration', String(durationMinutes));
      } catch (_e) {}
    }

    function resetTimer() {
      pauseTimer();
      timeLeft = durationMinutes * 60;
      document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
    }

    // --- Morning Mindset & Journaling State Manager ---
    let selectedMoodScore = 5;
    const subscriberEmail = "${escapeHtml(activeEmail || "")}";
    const subscriberToken = "${escapeHtml(token || "")}";

    function selectMood(score) {
      selectedMoodScore = score;
      document.querySelectorAll('.mood-btn').forEach(btn => {
        if (parseInt(btn.getAttribute('data-score'), 10) === score) {
          btn.classList.add('active');
        } else {
          btn.classList.remove('active');
        }
      });
    }

    function fireCelebrationConfetti() {
      if (typeof confetti === 'function') {
        confetti({
          particleCount: 80,
          spread: 70,
          origin: { y: 0.6 },
          colors: ['#7c3aed', '#22d3ee', '#34d399', '#fbbf24']
        });
      }
    }

    async function loadTodayJournal() {
      if (!subscriberEmail) return;
      try {
        const url = '/api/journal/today?email=' + encodeURIComponent(subscriberEmail) + (subscriberToken ? '&token=' + encodeURIComponent(subscriberToken) : '');
        const res = await fetch(url, {
          headers: { 'Accept': 'application/json' }
        });
        if (res.ok) {
          const data = await res.json();
          if (data.entry) {
            if (data.entry.mood_score) selectMood(data.entry.mood_score);
            if (data.entry.one_big_thing) document.getElementById('oneBigThingInput').value = data.entry.one_big_thing;
            if (data.entry.gratitude) document.getElementById('gratitudeInput').value = data.entry.gratitude;
            if (data.entry.reflection_text) document.getElementById('reflectionTextInput').value = data.entry.reflection_text;
            const syncStatus = document.getElementById('journalSyncStatus');
            if (syncStatus) syncStatus.textContent = 'Synced';
          }
        }
      } catch (_e) {}
    }

    async function saveMorningJournal() {
      const saveBtn = document.getElementById('saveJournalBtn');
      const syncStatus = document.getElementById('journalSyncStatus');
      const oneBigThing = document.getElementById('oneBigThingInput').value.trim();
      const gratitude = document.getElementById('gratitudeInput').value.trim();
      const reflectionText = document.getElementById('reflectionTextInput').value.trim();

      if (saveBtn) {
        saveBtn.disabled = true;
        saveBtn.innerHTML = '⏳ Saving…';
      }

      const payload = {
        mood_score: selectedMoodScore,
        one_big_thing: oneBigThing,
        gratitude: gratitude,
        reflection_text: reflectionText,
        track_key: "${escapeHtml(trackKey || "deep-work")}"
      };

      try {
        const url = '/api/journal/save' + (subscriberEmail ? '?email=' + encodeURIComponent(subscriberEmail) + (subscriberToken ? '&token=' + encodeURIComponent(subscriberToken) : '') : '');
        const res = await fetch(url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => ({}));
        if (res.ok && data.success) {
          if (syncStatus) syncStatus.textContent = 'Saved Just Now ✓';
          fireCelebrationConfetti();

          if (typeof customizableToast !== "undefined" && typeof customizableToast.createToast === "function") {
            customizableToast.createToast({
              message: "✨ <b>Reflection Saved!</b> Your morning intention and mindset are locked in.",
              type: "success",
              allowHtml: true,
              showProgressBar: true,
              progressPosition: "bottom",
              progressColor: "#7c3aed",
              borderRadius: "16px",
              duration: 4500
            });
          }
        } else {
          if (syncStatus) syncStatus.textContent = 'Save Failed';
          if (typeof customizableToast !== "undefined" && typeof customizableToast.createToast === "function") {
            customizableToast.createToast({
              message: data.error || "Could not save reflection. Please check your connection.",
              type: "warning",
              showProgressBar: true,
              progressPosition: "bottom",
              borderRadius: "16px",
              duration: 5000
            });
          }
        }
      } catch (err) {
        if (syncStatus) syncStatus.textContent = 'Offline Saved';
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Save Reflection';
        }
      }
    }

    // Auto-load journal on page load
    document.addEventListener('DOMContentLoaded', function () {
      loadTodayJournal();
      try {
        const savedDuration = parseInt(localStorage.getItem('mrn_focus_duration'), 10);
        if (savedDuration && savedDuration >= 5 && savedDuration <= 180 && !window.location.search.includes('duration=')) {
          setSprintDuration(savedDuration);
        }
      } catch (_e) {}
      if (window.AppBadging) {
        window.AppBadging.updateStreakBadge(${streakCount || 0});
      }
    });

    // Teardown audio and sprint timer on pagehide
    window.addEventListener('pagehide', function () {
      if (timerInterval) {
        clearInterval(timerInterval);
        timerInterval = null;
      }
      stopSoundNodes(0);
    });
  </script>
</body>
</html>`);
}

module.exports = { checkin, liveRoutine };
