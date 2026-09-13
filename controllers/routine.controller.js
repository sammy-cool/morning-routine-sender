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
  const verifiedWakeup = Boolean(req.body?.verified_wakeup ?? req.query.verified_wakeup === "true");
  const priorityGoal = (req.body?.priority_goal || req.query.priority_goal || "").trim();

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
        verifiedWakeup,
        priorityGoal: priorityGoal || undefined,
        morningVerified: verifiedWakeup,
        routineUrl: `/routine?email=${encodeURIComponent(email)}&token=${token}`,
      });
    }

    logger.info("Habit check-in recorded successfully", {
      email,
      streakCount: finalStreak,
      timezone: subscriber.timezone,
      verifiedWakeup,
      priorityGoal: priorityGoal || undefined,
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
        verifiedWakeup,
        priorityGoal: priorityGoal || undefined,
      })
      .catch((err) => {
        logger.error("Outbound webhook trigger failed on routine checkin", {
          error: err.message,
          email,
        });
      });

    // Trigger streak.milestone_reached on consistency milestones
    if ([3, 7, 14, 21, 30, 60, 100, 365].includes(finalStreak) || finalStreak % 7 === 0) {
      outboundWebhookDispatcher
        .dispatchWebhookForSubscriber(subscriber, "streak.milestone_reached", {
          milestone: finalStreak,
          streak: finalStreak,
          completedAt: new Date().toISOString(),
          track: subscriber.routineTrack || subscriber.templateType || "deep-work",
        })
        .catch((err) => {
          logger.error("Outbound webhook trigger failed on streak milestone", {
            error: err.message,
            email,
          });
        });
    }

    const badgeText = checkinResult.freezeEarned
      ? `${finalStreak}-Day Active Streak • 🛡️ +1 Freeze Shield Earned!`
      : `${finalStreak}-Day Active Streak`;

    return sendResponse({
      success: true,
      streakCount: finalStreak,
      title: `Day ${finalStreak} Complete! 🔥`,
      message: checkinResult.freezeEarned
        ? `Great job completing your morning routine. Consistency reward unlocked: +1 Streak Freeze Shield awarded!`
        : `Great job completing your morning routine. You have maintained a ${finalStreak}-day streak!`,
      quote: trackInfo.quote,
      badge: badgeText,
      verifiedWakeup,
      priorityGoal: priorityGoal || undefined,
      morningVerified: verifiedWakeup,
      freezeEarned: Boolean(checkinResult.freezeEarned),
      streakFreezes: checkinResult.streakFreezes,
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
  <link rel="stylesheet" href="/css/responsive-layout.css">
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
      min-height: 100dvh;
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
  <script src="https://cdn.jsdelivr.net/npm/customizable-toast-notification@latest/dist/index.umd.js" defer crossorigin="anonymous"></script>
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
          if (window.UXCore.toast) {
            window.UXCore.toast.show("${escapeHtml(data.badge || "Check-in logged!")}", "success", {
              duration: 5000,
              cta: {
                label: "Open Companion ⚡",
                href: "${data.routineUrl || "/routine"}",
                variant: "link"
              }
            });
          }
        } else if (window.UXCore.toast) {
          window.UXCore.toast.show("${escapeHtml(data.message || "Check-in failed")}", "error", {
            duration: 6000
          });
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
  <meta property="og:title" content="3-Minute Live Morning Ritual &amp; Habit Companion">
  <meta property="og:description" content="Box breathing, procedural ambient soundscapes, tactile wake-up challenge, and goal locks.">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${domain}/routine">
  <meta property="og:image" content="/assets/mrn-brand-ico.png">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="3-Minute Live Morning Ritual &amp; Habit Companion">
  <meta name="twitter:description" content="Box breathing, procedural ambient soundscapes, tactile wake-up challenge, and goal locks.">
  <meta name="twitter:image" content="/assets/mrn-brand-ico.png">
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
  <link rel="stylesheet" href="/css/responsive-layout.css">
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
      min-height: 100dvh;
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
      transition: all 0.3s ease;
    }
    .timer-card:fullscreen {
      display: flex;
      flex-direction: column;
      justify-content: center;
      align-items: center;
      background: #050608;
      width: 100vw;
      height: 100vh;
      border: none;
      border-radius: 0;
      padding: 32px;
    }
    .timer-card:fullscreen .timer-display {
      font-size: clamp(64px, 14vw, 150px);
      margin-bottom: 24px;
    }
    .timer-card:fullscreen .timer-progress-track {
      max-width: 500px;
      height: 8px;
    }
    .timer-mode-group {
      display: inline-flex;
      background: rgba(255, 255, 255, 0.04);
      padding: 4px;
      border-radius: 9999px;
      border: 1px solid var(--border);
      margin-bottom: 16px;
      gap: 4px;
    }
    .timer-mode-btn {
      background: transparent;
      border: none;
      color: var(--text-muted);
      border-radius: 9999px;
      padding: 6px 14px;
      font-size: 12px;
      font-weight: 700;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .timer-mode-btn.active {
      background: var(--primary);
      color: #fff;
      box-shadow: 0 0 12px var(--primary-glow);
    }
    .timer-progress-track {
      width: 100%;
      max-width: 320px;
      height: 6px;
      background: rgba(255, 255, 255, 0.08);
      border-radius: 9999px;
      margin: 0 auto 16px auto;
      overflow: hidden;
    }
    .timer-progress-fill {
      width: 100%;
      height: 100%;
      background: linear-gradient(90deg, var(--primary), var(--emerald));
      border-radius: 9999px;
      transition: width 0.3s ease;
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
    .btn-fullscreen {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-muted);
      border: 1px solid var(--border);
      padding: 6px 12px;
      font-size: 12px;
    }
    .btn-fullscreen:hover {
      background: rgba(255, 255, 255, 0.14);
      color: #fff;
    }
    .binaural-layer-box {
      margin-top: 16px;
      padding: 14px 16px;
      background: rgba(255, 255, 255, 0.03);
      border: 1px solid var(--border);
      border-radius: 12px;
      text-align: left;
    }
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

    /* ==========================================================================
       Live 3-Minute Morning Ritual & Tactile Wake-Up Challenge Styles
       ========================================================================== */
    .morning-ritual-panel {
      background: linear-gradient(135deg, rgba(15, 23, 42, 0.85) 0%, rgba(30, 27, 75, 0.6) 100%);
      border: 1px solid rgba(99, 102, 241, 0.35);
      border-radius: 20px;
      padding: 24px;
      margin-bottom: 24px;
      position: relative;
      overflow: hidden;
      box-shadow: 0 16px 36px -10px rgba(0, 0, 0, 0.5);
    }
    .morning-ritual-panel::before {
      content: '';
      position: absolute;
      top: -80px;
      right: -80px;
      width: 180px;
      height: 180px;
      background: radial-gradient(circle, rgba(124, 58, 237, 0.25) 0%, transparent 70%);
      pointer-events: none;
    }
    .ritual-header-row {
      display: flex;
      justify-content: space-between;
      align-items: center;
      flex-wrap: wrap;
      gap: 10px;
      margin-bottom: 16px;
    }
    .ritual-badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      background: rgba(99, 102, 241, 0.2);
      border: 1px solid rgba(99, 102, 241, 0.4);
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 11px;
      font-weight: 800;
      color: #a5b4fc;
      text-transform: uppercase;
      letter-spacing: 0.05em;
    }
    .ritual-status-pill {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 4px 12px;
      border-radius: 9999px;
      font-size: 12px;
      font-weight: 700;
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .ritual-status-pill.verified {
      background: rgba(16, 185, 129, 0.2);
      border-color: rgba(16, 185, 129, 0.5);
      color: #34d399;
      box-shadow: 0 0 14px rgba(16, 185, 129, 0.3);
    }

    /* Phase Progress Stepper */
    .ritual-phase-steps {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-bottom: 20px;
    }
    .phase-step {
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 8px 10px;
      text-align: center;
      transition: all 0.3s ease;
    }
    .phase-step.active {
      background: rgba(99, 102, 241, 0.22);
      border-color: #818cf8;
      box-shadow: 0 0 12px rgba(99, 102, 241, 0.3);
    }
    .phase-step.completed {
      background: rgba(16, 185, 129, 0.15);
      border-color: #10b981;
    }
    .phase-step-title {
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #cbd5e1;
    }
    .phase-step.active .phase-step-title { color: #818cf8; }
    .phase-step.completed .phase-step-title { color: #34d399; }
    .phase-step-time {
      font-family: 'JetBrains Mono', monospace;
      font-size: 11px;
      color: var(--text-muted);
      margin-top: 2px;
    }

    /* Box Breathing Visualizer */
    .breathing-ring-container {
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      padding: 16px 0;
      position: relative;
    }
    .breathing-orb {
      width: 140px;
      height: 140px;
      border-radius: 50%;
      background: radial-gradient(circle, rgba(99, 102, 241, 0.4) 0%, rgba(124, 58, 237, 0.1) 70%);
      border: 2px solid rgba(129, 140, 248, 0.6);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      transition: transform 4s cubic-bezier(0.4, 0, 0.2, 1), border-color 0.5s ease, box-shadow 4s ease;
      box-shadow: 0 0 20px rgba(99, 102, 241, 0.3);
      position: relative;
    }
    .breathing-orb.inhale {
      transform: scale(1.32);
      border-color: #34d399;
      box-shadow: 0 0 35px rgba(52, 211, 153, 0.5);
    }
    .breathing-orb.hold {
      transform: scale(1.32);
      border-color: #38bdf8;
      box-shadow: 0 0 30px rgba(56, 189, 248, 0.5);
    }
    .breathing-orb.exhale {
      transform: scale(0.92);
      border-color: #818cf8;
      box-shadow: 0 0 15px rgba(129, 140, 248, 0.3);
    }
    .breathing-orb.hold-empty {
      transform: scale(0.92);
      border-color: #a78bfa;
      box-shadow: 0 0 15px rgba(167, 139, 250, 0.3);
    }
    .breathing-text {
      font-size: 15px;
      font-weight: 800;
      color: #ffffff;
      text-shadow: 0 2px 8px rgba(0,0,0,0.6);
    }
    .breathing-subtext {
      font-size: 11px;
      color: #cbd5e1;
      font-family: 'JetBrains Mono', monospace;
      margin-top: 4px;
    }

    /* Tactile Wake-Up Cards */
    .tactile-challenge-box {
      background: rgba(0, 0, 0, 0.3);
      border: 1px solid var(--border);
      border-radius: 16px;
      padding: 16px;
      margin-top: 16px;
    }
    .hydration-taps-row {
      display: flex;
      align-items: center;
      justify-content: space-between;
      gap: 12px;
      flex-wrap: wrap;
    }
    .water-tap-btn {
      flex: 1;
      min-width: 100px;
      padding: 12px 14px;
      background: rgba(14, 165, 233, 0.12);
      border: 1px solid rgba(14, 165, 233, 0.3);
      border-radius: 12px;
      color: #e0f2fe;
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s ease;
      touch-action: manipulation;
    }
    .water-tap-btn:hover {
      background: rgba(14, 165, 233, 0.24);
      transform: translateY(-2px);
    }
    .water-tap-btn:active {
      transform: scale(0.96);
    }
    .water-progress-track {
      display: flex;
      gap: 6px;
    }
    .water-drop-badge {
      font-size: 20px;
      opacity: 0.25;
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .water-drop-badge.active {
      opacity: 1;
      transform: scale(1.22);
      filter: drop-shadow(0 0 8px #38bdf8);
    }

    /* Mental Spark arithmetic pills */
    .math-options-grid {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 8px;
      margin-top: 10px;
    }
    .math-opt-btn {
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      border-radius: 10px;
      color: #fff;
      padding: 10px;
      font-size: 14px;
      font-weight: 700;
      font-family: 'JetBrains Mono', monospace;
      cursor: pointer;
      transition: all 0.2s ease;
    }
    .math-opt-btn:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: #818cf8;
    }
    .math-opt-btn.correct {
      background: rgba(16, 185, 129, 0.3) !important;
      border-color: #10b981 !important;
      color: #34d399 !important;
      box-shadow: 0 0 12px rgba(16, 185, 129, 0.4);
    }
    .math-opt-btn.wrong {
      background: rgba(239, 68, 68, 0.25) !important;
      border-color: #ef4444 !important;
      color: #f87171 !important;
    }

    /* Priority Lock Field */
    .priority-lock-box {
      margin-top: 14px;
      display: flex;
      gap: 8px;
    }
    .priority-lock-input {
      flex: 1;
      background: rgba(0, 0, 0, 0.35);
      border: 1px solid rgba(129, 140, 248, 0.4);
      border-radius: 12px;
      padding: 12px 14px;
      font-size: 14px;
      color: #fff;
      outline: none;
      transition: all 0.2s ease;
    }
    .priority-lock-input:focus {
      border-color: #818cf8;
      box-shadow: 0 0 0 2px rgba(99, 102, 241, 0.3);
    }
    .btn-lock-priority {
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      border: none;
      color: #fff;
      font-weight: 700;
      font-size: 13px;
      padding: 0 18px;
      border-radius: 12px;
      cursor: pointer;
      display: inline-flex;
      align-items: center;
      gap: 6px;
      transition: all 0.2s ease;
      white-space: nowrap;
    }
    .btn-lock-priority:hover {
      filter: brightness(1.15);
      transform: translateY(-1px);
    }
    .btn-lock-priority.locked {
      background: rgba(16, 185, 129, 0.2);
      border: 1px solid #10b981;
      color: #34d399;
      cursor: default;
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

      <!-- Interactive 3-Minute Live Morning Ritual & Tactile Wake-Up Challenge -->
      <div class="morning-ritual-panel" id="morningRitualPanel">
        <div class="ritual-header-row">
          <div class="ritual-badge">
            ⚡ 3-Minute Live Morning Ritual
          </div>
          <div class="ritual-status-pill" id="ritualStatusPill">
            <span id="ritualStatusDot">⚪</span> <span id="ritualStatusText">Ready to Begin</span>
          </div>
        </div>

        <!-- 3-Phase Stepper Tracker -->
        <div class="ritual-phase-steps">
          <div class="phase-step active" id="phaseStep1">
            <div class="phase-step-title">1. Hydrate & Breathe</div>
            <div class="phase-step-time" id="phaseStep1Time">01:00</div>
          </div>
          <div class="phase-step" id="phaseStep2">
            <div class="phase-step-title">2. Daily Spark</div>
            <div class="phase-step-time" id="phaseStep2Time">01:00</div>
          </div>
          <div class="phase-step" id="phaseStep3">
            <div class="phase-step-title">3. Lock #1 Goal</div>
            <div class="phase-step-time" id="phaseStep3Time">01:00</div>
          </div>
        </div>

        <!-- Phase 1 Container: Box Breathing & Hydration -->
        <div id="ritualPhase1Content">
          <div class="breathing-ring-container">
            <div class="breathing-orb inhale" id="breathingOrb">
              <span class="breathing-text" id="breathingActionText">Inhale</span>
              <span class="breathing-subtext" id="breathingCount">4s</span>
            </div>
          </div>
          <p style="text-align: center; font-size: 13px; color: var(--text-muted); margin: 12px 0 4px 0;">
            Follow the 4-4-4-4 rhythm. Calm your vagus nerve and hydrate your mind.
          </p>
        </div>

        <!-- Phase 2 Container: Daily Focus & AI Spark -->
        <div id="ritualPhase2Content" style="display: none; padding: 12px 0;">
          <div style="background: rgba(99, 102, 241, 0.12); border-left: 3px solid #818cf8; border-radius: 12px; padding: 14px 16px; margin-bottom: 12px;">
            <div style="font-size: 11px; font-weight: 800; color: #a5b4fc; text-transform: uppercase; letter-spacing: 0.5px;">Today's Strategic Mantra</div>
            <div style="font-size: 16px; font-weight: 700; color: #fff; margin-top: 4px;">"${escapeHtml(spark.focusMantra)}"</div>
          </div>
          <div style="font-size: 14px; color: #e2e8f0; line-height: 1.6; background: rgba(0,0,0,0.25); border-radius: 12px; padding: 14px; border: 1px solid var(--border);">
            ${escapeHtml(spark.sparkReflection)}
          </div>
        </div>

        <!-- Phase 3 Container: Lock Priority Goal -->
        <div id="ritualPhase3Content" style="display: none; padding: 8px 0;">
          <label for="livePriorityInput" style="display: block; font-size: 13px; font-weight: 700; color: #cbd5e1; margin-bottom: 6px;">
            🎯 What is your #1 Priority Goal today?
          </label>
          <div class="priority-lock-box">
            <input type="text" id="livePriorityInput" class="priority-lock-input" placeholder="e.g. Ship core module without distractions" maxlength="120">
            <button type="button" class="btn-lock-priority" id="btnLockPriority" onclick="lockPriorityGoal()">
              🔒 Lock Goal
            </button>
          </div>
        </div>

        <!-- Tactile Wake-Up Challenge Section -->
        <div class="tactile-challenge-box" id="tactileChallengeBox">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <div style="font-size: 12px; font-weight: 800; color: #38bdf8; text-transform: uppercase; letter-spacing: 0.5px;">
              ⚡ Tactile Wake-Up Challenge
            </div>
            <div class="water-progress-track" id="waterProgressTrack" title="Hydration Progress">
              <span class="water-drop-badge" id="drop1">💧</span>
              <span class="water-drop-badge" id="drop2">💧</span>
              <span class="water-drop-badge" id="drop3">💧</span>
            </div>
          </div>

          <div class="hydration-taps-row">
            <button type="button" class="water-tap-btn" id="waterTapBtn" onclick="handleWaterTap()">
              <span>💧</span> <span id="waterTapLabel">I drank a full glass of water (Tap 1/3)</span>
            </button>
          </div>

          <!-- Quick Mental Arithmetic Spark -->
          <div id="mentalSparkContainer" style="margin-top: 14px; padding-top: 12px; border-top: 1px solid var(--border);">
            <div style="display: flex; justify-content: space-between; align-items: center; font-size: 12px; font-weight: 700; color: #cbd5e1;">
              <span>🧠 Mental Wake-Up: <span id="mathQuestionLabel">17 + 28 = ?</span></span>
              <span id="mathResultBadge" style="font-size: 11px; color: var(--text-muted);">Select answer:</span>
            </div>
            <div class="math-options-grid" id="mathOptionsGrid">
              <!-- Rendered via JS -->
            </div>
          </div>
        </div>

        <!-- Ritual Controls -->
        <div style="display: flex; gap: 10px; justify-content: space-between; align-items: center; margin-top: 18px; flex-wrap: wrap;">
          <div style="display: flex; gap: 8px; align-items: center;">
            <button type="button" class="btn btn-start" id="btnStartRitual" onclick="startMorningRitual()">
              ▶ Start 3-Min Ritual
            </button>
            <button type="button" class="btn btn-pause" id="btnPauseRitual" onclick="pauseMorningRitual()" style="display: none;">
              ⏸ Pause
            </button>
          </div>
          <div style="font-family: 'JetBrains Mono', monospace; font-size: 18px; font-weight: 800; color: #f8fafc;" id="ritualTotalCountdown">
            03:00
          </div>
        </div>
      </div>

      <div class="checklist-title">Morning Habit Checklist</div>
      <div class="checklist">
        ${checklistHtml}
      </div>

      <!-- Focus Sprint Timer -->
      <div class="timer-card" id="focusTimerCard">
        <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
          <div style="font-size: 13px; color: var(--text-muted); font-weight: 700; letter-spacing: 0.5px;">
            ⏱️ <span id="sprintDurationLabel">${initialDurationMins}</span>-MINUTE FOCUS SPRINT TIMER
          </div>
          <button type="button" class="btn btn-fullscreen" id="fullscreenToggleBtn" onclick="toggleFullscreen()" title="Fullscreen Focus Mode (F)" aria-label="Toggle Fullscreen Focus">
            <span id="fullscreenIcon">⛶</span> Fullscreen
          </button>
        </div>

        <div class="timer-mode-group" role="tablist" aria-label="Timer modes">
          <button type="button" class="timer-mode-btn active" id="modeFocusBtn" onclick="setTimerMode('focus')">🎯 Focus</button>
          <button type="button" class="timer-mode-btn" id="modeShortBreakBtn" onclick="setTimerMode('short-break')">☕ Short Break (5m)</button>
          <button type="button" class="timer-mode-btn" id="modeLongBreakBtn" onclick="setTimerMode('long-break')">🧘 Long Break (15m)</button>
        </div>

        <div class="timer-presets" id="timerPresetsRow" style="display: flex; justify-content: center; gap: 8px; margin-bottom: 16px; flex-wrap: wrap;">
          <button type="button" class="duration-pill ${initialDurationMins === 15 ? "active" : ""}" onclick="setSprintDuration(15)">15m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 25 ? "active" : ""}" onclick="setSprintDuration(25)">25m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 45 ? "active" : ""}" onclick="setSprintDuration(45)">45m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 50 ? "active" : ""}" onclick="setSprintDuration(50)">50m</button>
          <button type="button" class="duration-pill ${initialDurationMins === 60 ? "active" : ""}" onclick="setSprintDuration(60)">60m</button>
        </div>

        <div class="timer-display" id="timerDisplay">${String(initialDurationMins).padStart(2, "0")}:00</div>

        <div class="timer-progress-track">
          <div class="timer-progress-fill" id="timerProgressFill"></div>
        </div>

        <div class="timer-controls">
          <button class="btn btn-start" id="startBtn" onclick="startTimer()">Start Sprint</button>
          <button class="btn btn-pause" id="pauseBtn" onclick="pauseTimer()" style="display:none;">Pause</button>
          <button class="btn btn-reset" onclick="resetTimer()">Reset</button>
        </div>
        <div style="font-size: 11px; color: var(--text-muted); margin-top: 12px; opacity: 0.7;">
          Hotkeys: <kbd style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">Space</kbd> Start/Pause • <kbd style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">R</kbd> Reset • <kbd style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">M</kbd> Mute • <kbd style="background:rgba(255,255,255,0.1); padding:2px 5px; border-radius:4px;">F</kbd> Fullscreen
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

        <div class="binaural-layer-box">
          <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 8px;">
            <label style="display: flex; align-items: center; gap: 8px; font-size: 12px; font-weight: 700; color: #cbd5e1; cursor: pointer;">
              <input type="checkbox" id="binauralOverlayToggle" onchange="toggleBinauralOverlay()">
              <span>🧠 Layer Binaural Beats with Soundscape</span>
            </label>
            <select id="binauralBeatSelect" onchange="updateBinauralFrequency()" style="background: #0f1423; color: #fff; border: 1px solid var(--border); border-radius: 6px; padding: 4px 8px; font-size: 12px; outline: none;">
              <option value="40">40Hz Gamma (Deep Flow & Focus)</option>
              <option value="18">18Hz Beta (Active Problem Solving)</option>
              <option value="10" selected>10Hz Alpha (Relaxed Alertness)</option>
              <option value="6">6Hz Theta (Creative Meditation)</option>
            </select>
          </div>
        </div>
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
    function showRoutineToast(message, type = 'info', options = {}) {
      if (typeof customizableToast !== 'undefined' && typeof customizableToast.createToast === 'function') {
        const defaultProgress = type === 'success' ? '#10b981' : type === 'error' ? '#f43f5e' : type === 'warning' ? '#f59e0b' : '#7c3aed';
        return customizableToast.createToast({
          message: String(message || ''),
          type: type === 'warn' ? 'warning' : type,
          position: options.position || 'top-center',
          fontFamily: "'Plus Jakarta Sans', sans-serif",
          borderRadius: options.borderRadius || '16px',
          backgroundColor: options.backgroundColor || 'rgba(12, 17, 29, 0.96)',
          textColor: options.textColor || '#f8fafc',
          showProgressBar: options.showProgressBar !== false,
          progressPosition: options.progressPosition || 'bottom',
          progressColor: options.progressColor || defaultProgress,
          pauseOnHover: options.pauseOnHover !== false,
          duration: options.duration || (options.cta ? 6000 : 3500),
          allowHtml: options.allowHtml !== false,
          ...options
        });
      }
    }

    function toggleItem(idx) {
      const el = document.getElementById('item-' + idx);
      if (!el) return;
      const isDone = el.classList.toggle('done');
      if (isDone) {
        showRoutineToast("✅ Habit step marked complete!", "success", {
          duration: 5000,
          cta: {
            label: "Undo ↺",
            variant: "button",
            onClick: () => {
              el.classList.remove('done');
              const cb = el.querySelector('input[type="checkbox"]');
              if (cb) cb.checked = false;
              showRoutineToast("↺ Habit step unmarked", "info", { duration: 2500 });
            }
          }
        });
      }
    }

    let timerMode = 'focus';
    let durationMinutes = ${initialDurationMins};
    let totalDurationSeconds = durationMinutes * 60;
    let timeLeft = totalDurationSeconds;
    let timerInterval = null;

    function formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    function updateProgressBar() {
      const fill = document.getElementById('timerProgressFill');
      if (fill && totalDurationSeconds > 0) {
        const pct = Math.max(0, Math.min(100, (timeLeft / totalDurationSeconds) * 100));
        fill.style.width = pct + '%';
      }
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

    let binauralActiveNodes = [];
    let isBinauralOverlayActive = false;

    function buildBinauralLayer(ctx, outNode, hz = 10) {
      const layerMaster = ctx.createGain();
      layerMaster.gain.setValueAtTime(0.001, ctx.currentTime);
      layerMaster.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.3);
      layerMaster.connect(outNode);

      const carrier = 200;
      const leftOsc = ctx.createOscillator();
      leftOsc.type = 'sine';
      leftOsc.frequency.setValueAtTime(carrier, ctx.currentTime);

      const rightOsc = ctx.createOscillator();
      rightOsc.type = 'sine';
      rightOsc.frequency.setValueAtTime(carrier + hz, ctx.currentTime);

      const pannerLeft = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pannerLeft) {
        pannerLeft.pan.setValueAtTime(-0.8, ctx.currentTime);
        leftOsc.connect(pannerLeft);
        pannerLeft.connect(layerMaster);
      } else {
        leftOsc.connect(layerMaster);
      }

      const pannerRight = ctx.createStereoPanner ? ctx.createStereoPanner() : null;
      if (pannerRight) {
        pannerRight.pan.setValueAtTime(0.8, ctx.currentTime);
        rightOsc.connect(pannerRight);
        pannerRight.connect(layerMaster);
      } else {
        rightOsc.connect(layerMaster);
      }

      leftOsc.start();
      rightOsc.start();
      return [leftOsc, rightOsc, layerMaster];
    }

    function stopBinauralLayer() {
      if (binauralActiveNodes.length === 0) return;
      const nodes = [...binauralActiveNodes];
      binauralActiveNodes = [];
      nodes.forEach(n => {
        try { if (n.stop) n.stop(); if (n.disconnect) n.disconnect(); } catch(_e) {}
      });
    }

    function toggleBinauralOverlay() {
      const toggle = document.getElementById('binauralOverlayToggle');
      if (!toggle) return;
      const ctx = getAudioContext();
      if (toggle.checked) {
        const select = document.getElementById('binauralBeatSelect');
        const hz = Number(select?.value) || 10;
        stopBinauralLayer();
        binauralActiveNodes = buildBinauralLayer(ctx, masterGainNode, hz);
        isBinauralOverlayActive = true;
        showRoutineToast("🧠 Binaural Waves Layer Active (" + hz + "Hz)", "info", { duration: 3000, progressColor: "#7c3aed" });
      } else {
        stopBinauralLayer();
        isBinauralOverlayActive = false;
        showRoutineToast("Binaural Waves Layer Off", "info", { duration: 2200 });
      }
    }

    function updateBinauralFrequency() {
      if (!isBinauralOverlayActive) return;
      toggleBinauralOverlay();
    }

    function stopSoundNodes(duration = 0.15) {
      stopBinauralLayer();
      const toggle = document.getElementById('binauralOverlayToggle');
      if (toggle) toggle.checked = false;
      isBinauralOverlayActive = false;

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
      showRoutineToast("🎵 Soundscape: " + preset.charAt(0).toUpperCase() + preset.slice(1), "info", { duration: 2500, progressColor: "#7c3aed" });
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

    function updateTimerDisplay() {
      document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
      updateProgressBar();
    }

    function startTimer() {
      if (timerInterval) return;
      document.getElementById('startBtn').style.display = 'none';
      document.getElementById('pauseBtn').style.display = 'inline-block';

      const autoStart = document.getElementById('autoStartSound')?.checked;
      if (autoStart && !isSoundPlaying) {
        startSoundscape(currentPreset);
      }
      showRoutineToast("⏱ Focus Sprint Started (" + durationMinutes + "m)", "info", { duration: 2500, progressColor: "#7c3aed" });

      timerInterval = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          updateTimerDisplay();
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          if (isSoundPlaying) {
            stopSoundNodes(0.8);
            isSoundPlaying = false;
            updateSoundUI();
          }
          const isBreak = timerMode.includes('break');
          showRoutineToast(
            isBreak
              ? "☕ <b>Break completed!</b> Ready to dive back into deep work?"
              : "🎉 <b>Focus sprint completed!</b> Great job maintaining morning momentum.",
            "success",
            {
              duration: 8000,
              progressColor: "#10b981",
              cta: {
                label: "🔥 1-Click Check-in",
                variant: "link",
                href: "${checkinHref}"
              }
            }
          );
        }
      }, 1000);
    }

    function pauseTimer() {
      clearInterval(timerInterval);
      timerInterval = null;
      document.getElementById('startBtn').style.display = 'inline-block';
      document.getElementById('pauseBtn').style.display = 'none';
      showRoutineToast("⏸ Focus Sprint Paused (" + formatTime(timeLeft) + " left)", "warning", { duration: 2500 });
    }

    function setTimerMode(mode) {
      pauseTimer();
      timerMode = mode;
      const presetsRow = document.getElementById('timerPresetsRow');
      const label = document.getElementById('sprintDurationLabel');

      document.querySelectorAll('.timer-mode-btn').forEach(btn => btn.classList.remove('active'));
      const activeBtn = document.getElementById(
        mode === 'focus' ? 'modeFocusBtn' : mode === 'short-break' ? 'modeShortBreakBtn' : 'modeLongBreakBtn'
      );
      if (activeBtn) activeBtn.classList.add('active');

      if (mode === 'focus') {
        if (presetsRow) presetsRow.style.display = 'flex';
        totalDurationSeconds = durationMinutes * 60;
        timeLeft = totalDurationSeconds;
        if (label) label.textContent = durationMinutes;
      } else if (mode === 'short-break') {
        if (presetsRow) presetsRow.style.display = 'none';
        totalDurationSeconds = 5 * 60;
        timeLeft = totalDurationSeconds;
        if (label) label.textContent = '5';
      } else if (mode === 'long-break') {
        if (presetsRow) presetsRow.style.display = 'none';
        totalDurationSeconds = 15 * 60;
        timeLeft = totalDurationSeconds;
        if (label) label.textContent = '15';
      }
      const modeNames = {
        focus: '🎯 Focus Sprint',
        'short-break': '☕ Short Break (5m)',
        'long-break': '🧘 Long Break (15m)'
      };
      showRoutineToast("Switched to " + (modeNames[mode] || mode), "info", { duration: 2500, progressColor: "#7c3aed" });
      updateTimerDisplay();
    }

    function setSprintDuration(mins) {
      pauseTimer();
      timerMode = 'focus';
      document.querySelectorAll('.timer-mode-btn').forEach(btn => btn.classList.remove('active'));
      document.getElementById('modeFocusBtn')?.classList.add('active');
      const presetsRow = document.getElementById('timerPresetsRow');
      if (presetsRow) presetsRow.style.display = 'flex';

      durationMinutes = Math.max(5, Math.min(Number(mins) || 25, 180));
      totalDurationSeconds = durationMinutes * 60;
      timeLeft = totalDurationSeconds;
      const label = document.getElementById('sprintDurationLabel');
      if (label) label.textContent = durationMinutes;
      document.querySelectorAll('.duration-pill').forEach(btn => {
        btn.classList.toggle('active', btn.textContent.trim() === durationMinutes + 'm');
      });
      updateTimerDisplay();
      try {
        localStorage.setItem('mrn_focus_duration', String(durationMinutes));
      } catch (_e) {}
    }

    function resetTimer() {
      pauseTimer();
      timeLeft = totalDurationSeconds;
      updateTimerDisplay();
      showRoutineToast("↺ Timer reset to " + durationMinutes + "m", "info", { duration: 2200 });
    }

    function toggleFullscreen() {
      const card = document.getElementById('focusTimerCard');
      if (!card) return;
      if (!document.fullscreenElement) {
        if (card.requestFullscreen) {
          card.requestFullscreen().catch(() => {});
          showRoutineToast("⛶ Fullscreen Focus Mode Activated", "info", { duration: 2200, progressColor: "#7c3aed" });
        }
      } else {
        if (document.exitFullscreen) {
          document.exitFullscreen().catch(() => {});
          showRoutineToast("Exited Fullscreen Focus", "info", { duration: 2000 });
        }
      }
    }

    document.addEventListener('fullscreenchange', () => {
      const isFs = !!document.fullscreenElement;
      const fsIcon = document.getElementById('fullscreenIcon');
      if (fsIcon) fsIcon.textContent = isFs ? '✕' : '⛶';
    });

    window.addEventListener('keydown', (e) => {
      if (['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target?.tagName)) return;
      if (e.code === 'Space') {
        e.preventDefault();
        if (timerInterval) pauseTimer();
        else startTimer();
      } else if (e.key === 'r' || e.key === 'R') {
        resetTimer();
      } else if (e.key === 'm' || e.key === 'M') {
        toggleSound();
      } else if (e.key === 'f' || e.key === 'F') {
        toggleFullscreen();
      }
    });

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
          showRoutineToast("✨ <b>Reflection Saved!</b> Your morning intention is locked in.", "success", {
            duration: 4500,
            progressColor: "#10b981"
          });
        } else {
          if (syncStatus) syncStatus.textContent = 'Save Failed';
          showRoutineToast(data.error || "Could not save reflection. Please check your connection.", "warning", {
            duration: 5000,
            progressColor: "#f59e0b"
          });
        }
      } catch (err) {
        if (globalThis.OfflineSync?.queueJournal) {
          await globalThis.OfflineSync.queueJournal(payload, {
            email: subscriberEmail,
            token: subscriberToken,
          });
        }
        if (syncStatus) syncStatus.textContent = 'Offline Saved ✓';
        showRoutineToast("📶 <b>Offline Mode:</b> Reflection saved locally and queued for auto-sync!", "warning", {
          duration: 5500,
          progressColor: "#f59e0b"
        });
      } finally {
        if (saveBtn) {
          saveBtn.disabled = false;
          saveBtn.innerHTML = '💾 Save Reflection';
        }
      }
    }

    // =========================================================================
    // Web Audio Procedural Chimes, Ocean Drone & Fanfare Synthesizers
    // =========================================================================
    function triggerHaptic(pattern) {
      if (typeof window !== "undefined" && "vibrate" in navigator && typeof navigator.vibrate === "function") {
        try {
          navigator.vibrate(pattern);
        } catch (_e) {}
      }
    }

    let ritualAudioNodes = [];
    let ritualTimerInterval = null;
    let ritualSecondsLeft = 180; // 3 minutes total
    let ritualPhase = 1;
    let breathingCycleTick = 0;
    let waterTapCount = 0;
    let mathChallengeCompleted = false;
    let priorityGoalLocked = false;
    let correctMathAnswer = 45;

    /**
     * Synthesizes warm harmonic ocean drone for Phase 1 box breathing.
     */
    function startRitualBreathingDrone() {
      stopRitualAudio();
      const ctx = getAudioContext();
      if (!ctx) return;

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.001, ctx.currentTime);
      master.gain.exponentialRampToValueAtTime(0.35, ctx.currentTime + 0.8);
      if (typeof masterGainNode !== 'undefined' && masterGainNode) {
        master.connect(masterGainNode);
      } else {
        master.connect(ctx.destination);
      }

      // Pink noise filtered ocean wave
      const pinkSrc = ctx.createBufferSource();
      pinkSrc.buffer = createPinkNoiseBuffer(ctx, 6);
      pinkSrc.loop = true;

      const waveFilter = ctx.createBiquadFilter();
      waveFilter.type = 'lowpass';
      waveFilter.frequency.setValueAtTime(260, ctx.currentTime);
      waveFilter.Q.setValueAtTime(1.8, ctx.currentTime);

      const waveGain = ctx.createGain();
      waveGain.gain.setValueAtTime(0.3, ctx.currentTime);

      // 16s LFO matching 4s inhale / 4s hold / 4s exhale / 4s hold cycle (0.0625 Hz)
      const lfo = ctx.createOscillator();
      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.0625, ctx.currentTime);

      const lfoFilterMod = ctx.createGain();
      lfoFilterMod.gain.setValueAtTime(180, ctx.currentTime);
      lfo.connect(lfoFilterMod);
      lfoFilterMod.connect(waveFilter.frequency);

      // Warm calming 108Hz + 162Hz drones
      const drone1 = ctx.createOscillator();
      drone1.type = 'sine';
      drone1.frequency.setValueAtTime(108, ctx.currentTime);
      const droneGain1 = ctx.createGain();
      droneGain1.gain.setValueAtTime(0.14, ctx.currentTime);

      const drone2 = ctx.createOscillator();
      drone2.type = 'sine';
      drone2.frequency.setValueAtTime(162, ctx.currentTime);
      const droneGain2 = ctx.createGain();
      droneGain2.gain.setValueAtTime(0.09, ctx.currentTime);

      pinkSrc.connect(waveFilter);
      waveFilter.connect(waveGain);
      waveGain.connect(master);

      drone1.connect(droneGain1);
      droneGain1.connect(master);
      drone2.connect(droneGain2);
      droneGain2.connect(master);

      pinkSrc.start();
      drone1.start();
      drone2.start();
      lfo.start();

      ritualAudioNodes = [pinkSrc, drone1, drone2, lfo, master];
    }

    function stopRitualAudio(fadeDuration = 0.5) {
      if (ritualAudioNodes.length === 0) return;
      const nodes = [...ritualAudioNodes];
      ritualAudioNodes = [];
      const ctx = typeof audioCtx !== 'undefined' ? audioCtx : null;
      if (ctx) {
        nodes.forEach(n => {
          if (n instanceof GainNode) {
            try { n.gain.linearRampToValueAtTime(0.0001, ctx.currentTime + fadeDuration); } catch(e){}
          }
        });
      }
      setTimeout(() => {
        nodes.forEach(n => {
          try { if (n.stop) n.stop(); if (n.disconnect) n.disconnect(); } catch(e){}
        });
      }, fadeDuration * 1000 + 20);
    }

    /**
     * Procedural 528Hz Solfeggio singing bowl chime for Phase transitions.
     */
    function playRitualPhaseChime(freq = 528) {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.28, now + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.5);

      osc.connect(gain);
      if (typeof masterGainNode !== 'undefined' && masterGainNode) {
        gain.connect(masterGainNode);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 2.6);
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch(_e){}
      };
    }

    /**
     * Water bubble/droplet audio tone for hydration taps.
     */
    function playWaterDropletSound() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;

      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(600, now);
      osc.frequency.exponentialRampToValueAtTime(1350, now + 0.045);

      gain.gain.setValueAtTime(0.001, now);
      gain.gain.linearRampToValueAtTime(0.25, now + 0.006);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.06);

      osc.connect(gain);
      if (typeof masterGainNode !== 'undefined' && masterGainNode) {
        gain.connect(masterGainNode);
      } else {
        gain.connect(ctx.destination);
      }

      osc.start(now);
      osc.stop(now + 0.07);
      osc.onended = () => {
        try { osc.disconnect(); gain.disconnect(); } catch(_e){}
      };
    }

    /**
     * Uplifting major confirmation chime for Goal Locking.
     */
    function playPriorityLockChime() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const notes = [
        { f: 739.99, t: 0.00, d: 0.25 }, // F#5
        { f: 932.33, t: 0.07, d: 0.28 }, // A#5
        { f: 1108.73, t: 0.14, d: 0.32 }, // C#6
        { f: 1479.98, t: 0.22, d: 0.65 }  // F#6
      ];
      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.f, now + n.t);

        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.linearRampToValueAtTime(0.18, now + n.t + 0.015);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

        osc.connect(gain);
        if (typeof masterGainNode !== 'undefined' && masterGainNode) {
          gain.connect(masterGainNode);
        } else {
          gain.connect(ctx.destination);
        }
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.05);
      });
    }

    /**
     * Triumphant Victory Fanfare on Ritual & Challenge completion.
     */
    function playVictoryFanfare() {
      const ctx = getAudioContext();
      if (!ctx) return;
      const now = ctx.currentTime;
      const chordNotes = [
        { f: 523.25, t: 0.00, d: 0.18, type: 'triangle' }, // C5
        { f: 659.25, t: 0.12, d: 0.18, type: 'sine' },     // E5
        { f: 783.99, t: 0.24, d: 0.22, type: 'sine' },     // G5
        { f: 1046.50, t: 0.38, d: 0.85, type: 'triangle' }, // C6
        { f: 1318.51, t: 0.44, d: 0.85, type: 'sine' }      // E6
      ];

      chordNotes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        osc.type = n.type;
        osc.frequency.setValueAtTime(n.f, now + n.t);

        gain.gain.setValueAtTime(0.0001, now + n.t);
        gain.gain.linearRampToValueAtTime(0.24, now + n.t + 0.02);
        gain.gain.exponentialRampToValueAtTime(0.0001, now + n.t + n.d);

        osc.connect(gain);
        if (typeof masterGainNode !== 'undefined' && masterGainNode) {
          gain.connect(masterGainNode);
        } else {
          gain.connect(ctx.destination);
        }
        osc.start(now + n.t);
        osc.stop(now + n.t + n.d + 0.05);
      });
    }

    // =========================================================================
    // Ritual Timing, Breathing Engine & Challenge Flow
    // =========================================================================
    function updateRitualDisplay() {
      const mins = Math.floor(ritualSecondsLeft / 60).toString().padStart(2, '0');
      const secs = (ritualSecondsLeft % 60).toString().padStart(2, '0');
      const cd = document.getElementById('ritualTotalCountdown');
      if (cd) cd.textContent = mins + ':' + secs;

      // Phase calculation
      const elapsed = 180 - ritualSecondsLeft;
      if (elapsed < 60) {
        setRitualPhase(1, 60 - elapsed);
      } else if (elapsed < 120) {
        setRitualPhase(2, 120 - elapsed);
      } else {
        setRitualPhase(3, 180 - elapsed);
      }
    }

    function setRitualPhase(phase, phaseTimeLeft) {
      if (ritualPhase !== phase) {
        ritualPhase = phase;
        playRitualPhaseChime(phase === 2 ? 528 : 659.25);
        if (phase === 2) {
          stopRitualAudio(0.8);
          const p1 = document.getElementById('ritualPhase1Content');
          const p2 = document.getElementById('ritualPhase2Content');
          const p3 = document.getElementById('ritualPhase3Content');
          if (p1) p1.style.display = 'none';
          if (p2) p2.style.display = 'block';
          if (p3) p3.style.display = 'none';
          showRoutineToast("💡 <b>Phase 2: Daily Focus & AI Spark</b>", "info", { duration: 3000, progressColor: "#818cf8" });
        } else if (phase === 3) {
          const p1 = document.getElementById('ritualPhase1Content');
          const p2 = document.getElementById('ritualPhase2Content');
          const p3 = document.getElementById('ritualPhase3Content');
          if (p1) p1.style.display = 'none';
          if (p2) p2.style.display = 'none';
          if (p3) p3.style.display = 'block';
          const inp = document.getElementById('livePriorityInput');
          if (inp) inp.focus();
          showRoutineToast("🎯 <b>Phase 3: Lock Your #1 Priority Goal</b>", "info", { duration: 3500, progressColor: "#10b981" });
        }
      }

      const p1 = document.getElementById('phaseStep1');
      const p2 = document.getElementById('phaseStep2');
      const p3 = document.getElementById('phaseStep3');
      const t1 = document.getElementById('phaseStep1Time');
      const t2 = document.getElementById('phaseStep2Time');
      const t3 = document.getElementById('phaseStep3Time');

      if (phase === 1) {
        if (p1) p1.className = 'phase-step active';
        if (p2) p2.className = 'phase-step';
        if (p3) p3.className = 'phase-step';
        if (t1) t1.textContent = '00:' + String(phaseTimeLeft).padStart(2, '0');
      } else if (phase === 2) {
        if (p1) p1.className = 'phase-step completed';
        if (p2) p2.className = 'phase-step active';
        if (p3) p3.className = 'phase-step';
        if (t1) t1.textContent = 'Done ✓';
        if (t2) t2.textContent = '00:' + String(phaseTimeLeft).padStart(2, '0');
      } else {
        if (p1) p1.className = 'phase-step completed';
        if (p2) p2.className = 'phase-step completed';
        if (p3) p3.className = 'phase-step active';
        if (t1) t1.textContent = 'Done ✓';
        if (t2) t2.textContent = 'Done ✓';
        if (t3) t3.textContent = '00:' + String(phaseTimeLeft).padStart(2, '0');
      }
    }

    function tickBreathingOrb() {
      const orb = document.getElementById('breathingOrb');
      const txt = document.getElementById('breathingActionText');
      const cnt = document.getElementById('breathingCount');
      if (!orb || !txt || !cnt) return;

      breathingCycleTick = (breathingCycleTick + 1) % 16;
      if (breathingCycleTick < 4) {
        orb.className = 'breathing-orb inhale';
        txt.textContent = 'Inhale';
        cnt.textContent = (4 - breathingCycleTick) + 's';
        if (breathingCycleTick === 0) triggerHaptic(40);
      } else if (breathingCycleTick < 8) {
        orb.className = 'breathing-orb hold';
        txt.textContent = 'Hold';
        cnt.textContent = (8 - breathingCycleTick) + 's';
        if (breathingCycleTick === 4) triggerHaptic(20);
      } else if (breathingCycleTick < 12) {
        orb.className = 'breathing-orb exhale';
        txt.textContent = 'Exhale';
        cnt.textContent = (12 - breathingCycleTick) + 's';
        if (breathingCycleTick === 8) triggerHaptic(40);
      } else {
        orb.className = 'breathing-orb hold-empty';
        txt.textContent = 'Hold';
        cnt.textContent = (16 - breathingCycleTick) + 's';
        if (breathingCycleTick === 12) triggerHaptic(20);
      }
    }

    function startMorningRitual() {
      if (ritualTimerInterval) return;
      const bStart = document.getElementById('btnStartRitual');
      const bPause = document.getElementById('btnPauseRitual');
      const sDot = document.getElementById('ritualStatusDot');
      const sTxt = document.getElementById('ritualStatusText');
      if (bStart) bStart.style.display = 'none';
      if (bPause) bPause.style.display = 'inline-block';
      if (sDot) sDot.textContent = '🟢';
      if (sTxt) sTxt.textContent = 'Ritual Active';

      if (ritualPhase === 1) {
        startRitualBreathingDrone();
        if (breathingCycleTick === 0) triggerHaptic(40);
      }

      ritualTimerInterval = setInterval(() => {
        if (ritualSecondsLeft > 0) {
          ritualSecondsLeft--;
          updateRitualDisplay();
          if (ritualPhase === 1) tickBreathingOrb();
        } else {
          completeMorningRitual();
        }
      }, 1000);
    }

    function pauseMorningRitual() {
      clearInterval(ritualTimerInterval);
      ritualTimerInterval = null;
      const bStart = document.getElementById('btnStartRitual');
      const bPause = document.getElementById('btnPauseRitual');
      const sDot = document.getElementById('ritualStatusDot');
      const sTxt = document.getElementById('ritualStatusText');
      if (bStart) bStart.style.display = 'inline-block';
      if (bPause) bPause.style.display = 'none';
      if (sDot) sDot.textContent = '🟡';
      if (sTxt) sTxt.textContent = 'Ritual Paused';
      stopRitualAudio(0.3);
    }

    // --- Tactile Hydration Counter ---
    function handleWaterTap() {
      waterTapCount = Math.min(3, waterTapCount + 1);
      playWaterDropletSound();
      triggerHaptic(25);
      if (window.UXCore?.haptics) window.UXCore.haptics.light();

      for (let i = 1; i <= 3; i++) {
        const drop = document.getElementById('drop' + i);
        if (drop) drop.classList.toggle('active', i <= waterTapCount);
      }

      const label = document.getElementById('waterTapLabel');
      if (label) {
        if (waterTapCount === 1) label.textContent = 'Full glass of water: 1/3 drank';
        else if (waterTapCount === 2) label.textContent = 'Hydration almost full: 2/3 drank';
        else label.textContent = 'Hydration Complete: 100% ✓';
      }

      if (waterTapCount === 3) {
        const btn = document.getElementById('waterTapBtn');
        if (btn) {
          btn.style.background = 'rgba(16, 185, 129, 0.2)';
          btn.style.borderColor = '#10b981';
        }
        checkFullVerificationReady();
      }
    }

    // --- Quick Mental Spark (Math Challenge) ---
    function initMentalSpark() {
      const a = 14 + Math.floor(Math.random() * 18);
      const b = 16 + Math.floor(Math.random() * 22);
      correctMathAnswer = a + b;

      const qLabel = document.getElementById('mathQuestionLabel');
      if (qLabel) qLabel.textContent = a + ' + ' + b + ' = ?';

      const answers = [correctMathAnswer, correctMathAnswer - 3, correctMathAnswer + 4]
        .sort(() => Math.random() - 0.5);

      const grid = document.getElementById('mathOptionsGrid');
      if (!grid) return;
      grid.innerHTML = answers.map(ans => '<button type="button" class="math-opt-btn" onclick="submitMathAnswer(' + ans + ', this)">' + ans + '</button>').join('');
    }

    function submitMathAnswer(chosen, btn) {
      if (mathChallengeCompleted) return;
      if (chosen === correctMathAnswer) {
        mathChallengeCompleted = true;
        btn.classList.add('correct');
        const badge = document.getElementById('mathResultBadge');
        if (badge) {
          badge.textContent = 'Awake & Verified ✓';
          badge.style.color = '#34d399';
        }
        playWaterDropletSound();
        if (window.UXCore?.haptics) window.UXCore.haptics.success();
        checkFullVerificationReady();
      } else {
        btn.classList.add('wrong');
        setTimeout(() => btn.classList.remove('wrong'), 800);
      }
    }

    // --- Phase 3 Priority Goal Lock ---
    function lockPriorityGoal() {
      const inp = document.getElementById('livePriorityInput');
      const btn = document.getElementById('btnLockPriority');
      const val = inp?.value.trim();
      if (!val) {
        if (inp) inp.focus();
        showRoutineToast("Please enter your #1 priority goal before locking", "warning");
        return;
      }

      priorityGoalLocked = true;
      inp.disabled = true;
      btn.classList.add('locked');
      btn.innerHTML = 'Locked ✓';
      playPriorityLockChime();
      triggerHaptic(35);
      if (window.UXCore?.haptics) window.UXCore.haptics.success();

      // Mirror into reflection input
      const bigThing = document.getElementById('oneBigThingInput');
      if (bigThing) bigThing.value = val;

      checkFullVerificationReady();
    }

    function checkFullVerificationReady() {
      if (waterTapCount >= 3 && mathChallengeCompleted && priorityGoalLocked) {
        completeMorningRitual();
      }
    }

    /**
     * Completes Ritual, triggers Victory Fanfare, Confetti, and POST /routine/checkin.
     */
    async function completeMorningRitual() {
      pauseMorningRitual();
      stopRitualAudio(0.3);

      const statusPill = document.getElementById('ritualStatusPill');
      if (statusPill) {
        statusPill.className = 'ritual-status-pill verified';
        statusPill.innerHTML = '<span>☀️</span> <span>Morning Verified ✓</span>';
      }

      playVictoryFanfare();
      fireCelebrationConfetti();
      triggerHaptic([60, 60, 60, 60, 140]);

      const priorityGoal = document.getElementById('livePriorityInput')?.value.trim() || '';

      showRoutineToast(
        "🏆 <b>Morning Verified!</b> Ritual & Wake-Up Challenge successfully conquered.",
        "success",
        { duration: 8000, progressColor: "#10b981" }
      );

      // Call Checkin Endpoint with verified_wakeup & priority_goal
      try {
        const payload = {
          email: subscriberEmail,
          token: subscriberToken,
          verified_wakeup: true,
          priority_goal: priorityGoal
        };

        const res = await fetch('/routine/checkin', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Accept': 'application/json'
          },
          body: JSON.stringify(payload)
        });

        // Fallback to /checkin if /routine/checkin is routed to base checkin
        if (!res.ok && res.status === 404) {
          await fetch('/checkin', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'application/json'
            },
            body: JSON.stringify(payload)
          });
        }

        const btnCheckin = document.getElementById('routineCheckinBtn');
        if (btnCheckin) {
          btnCheckin.style.background = 'linear-gradient(135deg, #10b981, #059669)';
          btnCheckin.innerHTML = '☀️ Morning Verified & Streak Maintained ✓';
        }
      } catch (err) {
        // Safe offline fallback
        if (globalThis.OfflineSync?.queueCheckin) {
          await globalThis.OfflineSync.queueCheckin({
            email: subscriberEmail,
            token: subscriberToken,
            verified_wakeup: true,
            priority_goal: priorityGoal
          });
        }
      }
    }

    // Auto-load journal and mental spark on page load
    document.addEventListener('DOMContentLoaded', function () {
      loadTodayJournal();
      initMentalSpark();
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
