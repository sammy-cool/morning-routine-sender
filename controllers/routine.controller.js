const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const { verifyActionToken, verifyUnsubscribeToken } = require("../helper/unsubscribeToken");
const { getSessionEmail } = require("../middleware/subscriberSession");

function escapeHtml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/**
 * GET /checkin?email=...&token=...
 * 1-Click Streak & Habit Check-in from Email or Web
 */
async function checkin(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  const token = req.query.token;

  if (!email || !token) {
    return renderCheckinPage(res, {
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
    return renderCheckinPage(res, {
      success: false,
      title: "Link Expired or Invalid",
      message: "We couldn't verify this check-in link. Please use the button in your latest morning routine email.",
      badge: "Security Check",
    });
  }

  try {
    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return renderCheckinPage(res, {
        success: false,
        title: "Subscriber Not Found",
        message: "No active subscription was found for this address.",
        badge: "Not Found",
      });
    }

    const checkinResult = await sharedData.recordCheckin(email, subscriber.timezone);
    const trackInfo = sharedData.getTrackContent(subscriber.routineTrack || subscriber.templateType);

    if (checkinResult.alreadyCheckedInToday) {
      return renderCheckinPage(res, {
        success: true,
        streak: checkinResult.streak,
        title: `🔥 ${checkinResult.streak}-Day Streak Maintained!`,
        message: "You've already recorded your morning check-in for today. Keep this incredible momentum going!",
        badge: "Already Checked In",
        quote: trackInfo.quote,
        email,
        token,
      });
    }

    return renderCheckinPage(res, {
      success: true,
      streak: checkinResult.streak,
      title: `🎉 Day ${checkinResult.streak} Complete!`,
      message: "Morning routine checked off. You're building an unstoppable daily habit.",
      badge: `${checkinResult.streak}-Day Active Streak`,
      quote: trackInfo.quote,
      email,
      token,
    });
  } catch (err) {
    logger.error("Checkin handler error", { error: err.message, email });
    return renderCheckinPage(res, {
      success: false,
      title: "Check-in Temporarily Unavailable",
      message: "We encountered a hiccup recording your check-in. Your streak is safe!",
      badge: "System Notice",
    });
  }
}

/**
 * Renders Obsidian Glassmorphism Celebration Page for Habit Check-in
 */
function renderCheckinPage(res, { success, title, message, badge, streak, quote, email, token }) {
  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} • Morning Routine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(17, 24, 39, 0.75);
      --primary: #6366f1;
      --primary-glow: rgba(99, 102, 241, 0.35);
      --emerald: #10b981;
      --amber: #f59e0b;
      --border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.18) 0%, transparent 60%),
        radial-gradient(circle at 85% 30%, rgba(16, 185, 129, 0.12) 0%, transparent 45%);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px 16px;
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
      background: ${success ? 'rgba(16, 185, 129, 0.15)' : 'rgba(239, 68, 68, 0.15)'};
      color: ${success ? '#34d399' : '#f87171'};
      border: 1px solid ${success ? 'rgba(16, 185, 129, 0.3)' : 'rgba(239, 68, 68, 0.3)'};
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
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #ffffff;
      box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
    }
    .btn-primary:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 24px -5px rgba(99, 102, 241, 0.6);
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
    <div class="badge">${escapeHtml(badge || "Habit Check-in")}</div>
    ${streak ? `<div class="streak-hero">🔥</div>` : `<div style="font-size:48px; margin-bottom:12px;">${success ? '✨' : '⚠️'}</div>`}
    <h1>${escapeHtml(title)}</h1>
    <p class="lead">${escapeHtml(message)}</p>

    ${quote ? `<div class="quote-box">“${escapeHtml(quote)}”</div>` : ""}

    <div class="btn-group">
      <a href="/routine${email ? `?email=${encodeURIComponent(email)}&token=${token}` : ''}" class="btn btn-primary">
        ⚡ Open Live Routine Companion
      </a>
      <a href="/user-dashboard" class="btn btn-ghost">
        ⚙️ Manage Routine Preferences
      </a>
    </div>
  </div>
</body>
</html>`);
}

/**
 * GET /routine
 * Interactive Live Routine View & Focus Companion
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
  const timezone = subscriber?.timezone || "UTC";

  res.set("Content-Type", "text/html; charset=utf-8");
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Today's Morning Routine • ${escapeHtml(trackContent.name)}</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #07090e;
      --card-bg: rgba(17, 24, 39, 0.8);
      --primary: #6366f1;
      --primary-glow: rgba(99, 102, 241, 0.35);
      --emerald: #10b981;
      --amber: #f59e0b;
      --border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(99, 102, 241, 0.2) 0%, transparent 60%),
        radial-gradient(circle at 100% 50%, rgba(6, 182, 212, 0.1) 0%, transparent 50%);
      color: var(--text-main);
      min-height: 100vh;
      padding: 32px 16px;
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
      backdrop-filter: blur(24px);
      -webkit-backdrop-filter: blur(24px);
      border: 1px solid var(--border);
      border-radius: 24px;
      padding: 32px;
      margin-bottom: 24px;
      box-shadow: 0 20px 40px -15px rgba(0, 0, 0, 0.5);
    }
    .track-badge {
      display: inline-block;
      font-size: 12px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #818cf8;
      background: rgba(99, 102, 241, 0.12);
      padding: 4px 12px;
      border-radius: 9999px;
      margin-bottom: 12px;
    }
    h1 {
      font-size: 28px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin-bottom: 8px;
    }
    .tagline {
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
      background: linear-gradient(135deg, #6366f1, #4f46e5);
      color: #fff;
      border: none;
      cursor: pointer;
      box-shadow: 0 10px 20px -5px rgba(99, 102, 241, 0.4);
      display: flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      text-decoration: none;
    }
    .btn-checkin:hover {
      transform: translateY(-2px);
      box-shadow: 0 14px 28px -5px rgba(99, 102, 241, 0.6);
    }
  </style>
</head>
<body>
  <div class="container">
    <div class="header">
      <a href="/" class="brand">
        <span>🌅</span> Morning Routine
      </a>
      <div class="streak-pill">
        🔥 ${streakCount}-Day Streak
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

      <div class="checklist-title">Morning Habit Checklist</div>
      <div class="checklist">
        ${trackContent.checklist.map((item, idx) => `
          <label class="checklist-item" id="item-${idx}">
            <input type="checkbox" onchange="toggleItem(${idx})">
            <span>${escapeHtml(item)}</span>
          </label>
        `).join('')}
      </div>

      <!-- Focus Sprint Timer -->
      <div class="timer-card">
        <div style="font-size: 13px; color: var(--text-muted); margin-bottom: 8px;">25-MINUTE FOCUS SPRINT TIMER</div>
        <div class="timer-display" id="timerDisplay">25:00</div>
        <div class="timer-controls">
          <button class="btn btn-start" id="startBtn" onclick="startTimer()">Start Sprint</button>
          <button class="btn btn-pause" id="pauseBtn" onclick="pauseTimer()" style="display:none;">Pause</button>
          <button class="btn btn-reset" onclick="resetTimer()">Reset</button>
        </div>
      </div>

      <a href="${activeEmail ? `/checkin?email=${encodeURIComponent(activeEmail)}&token=${token || ''}` : '/user-dashboard'}" class="btn-checkin">
        ⚡ Complete Routine & Maintain Streak
      </a>
    </div>
  </div>

  <script>
    function toggleItem(idx) {
      const el = document.getElementById('item-' + idx);
      el.classList.toggle('done');
    }

    let timeLeft = 25 * 60;
    let timerInterval = null;

    function formatTime(seconds) {
      const m = Math.floor(seconds / 60).toString().padStart(2, '0');
      const s = (seconds % 60).toString().padStart(2, '0');
      return m + ':' + s;
    }

    function startTimer() {
      if (timerInterval) return;
      document.getElementById('startBtn').style.display = 'none';
      document.getElementById('pauseBtn').style.display = 'inline-block';
      timerInterval = setInterval(() => {
        if (timeLeft > 0) {
          timeLeft--;
          document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
        } else {
          clearInterval(timerInterval);
          timerInterval = null;
          alert('🎉 Focus sprint completed! Time for a short break.');
        }
      }, 1000);
    }

    function pauseTimer() {
      clearInterval(timerInterval);
      timerInterval = null;
      document.getElementById('startBtn').style.display = 'inline-block';
      document.getElementById('pauseBtn').style.display = 'none';
    }

    function resetTimer() {
      pauseTimer();
      timeLeft = 25 * 60;
      document.getElementById('timerDisplay').innerText = formatTime(timeLeft);
    }
  </script>
</body>
</html>`);
}

module.exports = { checkin, liveRoutine };
