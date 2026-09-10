const logger = require("../logger");
const validator = require("validator");
const emailTracker = require("../email-core/emailTracker");
const emailScheduler = require("../email-core/emailScheduler");
const sharedData = require("../helper/shared-data");
const { verifyUnsubscribeToken, generateUnsubscribeToken } = require("../helper/unsubscribeToken");
const { getTransporter } = require("../config/mailTransporter");
const { safeCompare } = require("../helper/util");

function escapeHtml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// POST /send-test-email
async function sendTestEmail(req, res) {
  try {
    const { email } = req.body;
    const templateType = req.body.templateType || "basic";

    const isAdminSession = req.signedCookies?.mrn_role === "admin";
    const apiKey = req.get("x-cron-key") || req.get("x-admin-secret") || req.query.key;
    const isKeyValid =
      Boolean(apiKey) &&
      ((Boolean(process.env.CRON_API_KEY) && safeCompare(apiKey, process.env.CRON_API_KEY)) ||
        (Boolean(process.env.ADMIN_KEY) && safeCompare(apiKey, process.env.ADMIN_KEY)));

    if (!isAdminSession && !isKeyValid) {
      logger.error("Forbidden: admin access or valid API key required");
      return res.status(403).json({ error: "Forbidden: admin access required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailService = require("../email-core/emailService");

    const result = await emailService.sendRoutineEmail(getTransporter(), req.app.locals, {
      email,
      templateType,
      routineTrack: templateType,
      name: "Test User",
      dayNumber: "01",
      streakCount: 1,
    });

    try {
      await emailTracker.recordSend(email, templateType, result?.messageId || "test-msg-id");
      logger.info(`Test email recorded in DB for ${email}`);
    } catch (dbError) {
      logger.warn(`Could not record test email in DB: ${dbError.message}`);
    }

    res.json({
      success: true,
      message: `Test email sent to ${email}`,
      data: result,
    });
  } catch (error) {
    logger.error("Send test email failed:", { error: error.message || error });
    res.status(500).json({
      success: false,
      error: error.message || error,
    });
  }
}

// GET /unsubscribe
async function unsubscribe(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  const token = req.query.token;

  res.set("Content-Type", "text/html; charset=utf-8");
  res.set("Cache-Control", "no-cache, no-store, must-revalidate");

  function renderPage(title, message, isSuccess = false, _emailParam = "") {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(title)} • Morning Routine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050608;
      --card-bg: rgba(12, 17, 29, 0.82);
      --primary: #7c3aed;
      --primary-glow: rgba(124, 58, 237, 0.4);
      --border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.18) 0%, transparent 60%),
        radial-gradient(circle at 85% 30%, rgba(34, 211, 238, 0.12) 0%, transparent 45%);
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
      max-width: 480px;
      width: 100%;
      padding: 40px 32px;
      text-align: center;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 35px var(--primary-glow);
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 18px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
    }
    h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 10px; }
    p { font-size: 14px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; }
    .btn-group { display: flex; flex-direction: column; gap: 10px; }
    .btn {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      padding: 12px 20px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, var(--primary), #4f46e5);
      color: #fff;
      box-shadow: 0 4px 12px var(--primary-glow);
    }
    .btn-primary:hover { transform: translateY(-1px); }
    .btn-secondary {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-main);
      border: 1px solid var(--border);
    }
    .btn-secondary:hover { background: rgba(255, 255, 255, 0.1); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">${isSuccess ? "✅" : "📬"}</div>
    <h1>${escapeHtml(title)}</h1>
    <p>${escapeHtml(message)}</p>
    <div class="btn-group">
      <a href="/" class="btn btn-primary">Return to Home</a>
      <a href="/user-dashboard" class="btn btn-secondary">Manage Routine Preferences</a>
    </div>
  </div>
</body>
</html>`);
  }

  // Direct visit without email -> Show Self-Service Portal
  if (!email) {
    return res.send(`<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Manage Subscription &amp; Unsubscribe • Morning Routine</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap" rel="stylesheet">
  <style>
    :root {
      --bg: #050608;
      --card-bg: rgba(12, 17, 29, 0.82);
      --primary: #7c3aed;
      --primary-glow: rgba(124, 58, 237, 0.4);
      --border: rgba(255, 255, 255, 0.08);
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', sans-serif; }
    body {
      background-color: var(--bg);
      background-image: 
        radial-gradient(circle at 50% 0%, rgba(124, 58, 237, 0.18) 0%, transparent 60%),
        radial-gradient(circle at 85% 30%, rgba(34, 211, 238, 0.12) 0%, transparent 45%);
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
      max-width: 480px;
      width: 100%;
      padding: 40px 32px;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 35px var(--primary-glow);
    }
    .icon {
      width: 56px;
      height: 56px;
      margin: 0 auto 18px;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.05);
      border: 1px solid var(--border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 26px;
    }
    h1 { font-size: 24px; font-weight: 800; letter-spacing: -0.02em; margin-bottom: 8px; text-align: center; }
    p.subtitle { font-size: 14px; color: var(--text-muted); line-height: 1.6; margin-bottom: 24px; text-align: center; }
    label { font-size: 13px; font-weight: 600; color: var(--text-muted); display: block; margin-bottom: 6px; }
    input[type="email"] {
      width: 100%;
      background: rgba(10, 15, 29, 0.8);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 12px 14px;
      color: #fff;
      font-size: 14px;
      outline: none;
      margin-bottom: 16px;
      transition: all 0.2s;
    }
    input[type="email"]:focus {
      border-color: var(--primary);
      box-shadow: 0 0 15px -3px var(--primary-glow);
    }
    .btn {
      width: 100%;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 12px 20px;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      cursor: pointer;
      border: none;
      transition: all 0.2s;
    }
    .btn-danger {
      background: rgba(239, 68, 68, 0.15);
      color: #f87171;
      border: 1px solid rgba(239, 68, 68, 0.3);
      margin-bottom: 10px;
    }
    .btn-danger:hover {
      background: rgba(239, 68, 68, 0.25);
      color: #fff;
    }
    .btn-ghost {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--border);
    }
    .btn-ghost:hover {
      background: rgba(255, 255, 255, 0.1);
      color: #fff;
    }
    #statusMsg {
      font-size: 13px;
      margin-top: 12px;
      text-align: center;
      min-height: 20px;
    }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">⚙️</div>
    <h1>Manage Subscription</h1>
    <p class="subtitle">Enter your email address to receive a secure 1-click link to unsubscribe or pause your daily routine.</p>

    <form id="unsubForm">
      <input type="text" name="website" style="display:none" tabindex="-1" autocomplete="off" />
      <label for="userEmail">Your Subscribed Email</label>
      <input type="email" id="userEmail" placeholder="your.email@example.com" required />
      <button type="submit" class="btn btn-danger" id="submitBtn">
        Send 1-Click Unsubscribe Link
      </button>
      <a href="/user-dashboard" class="btn btn-ghost">
        Manage / Pause Routine in Dashboard
      </a>
      <div id="statusMsg"></div>
    </form>
  </div>

  <script>
    document.getElementById('unsubForm').addEventListener('submit', async function(e) {
      e.preventDefault();
      const email = document.getElementById('userEmail').value.trim();
      const btn = document.getElementById('submitBtn');
      const msg = document.getElementById('statusMsg');
      
      btn.disabled = true;
      btn.textContent = 'Sending request...';
      msg.textContent = '';

      try {
        const resp = await fetch('/unsubscribe/request', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
        });
        const data = await resp.json();
        msg.style.color = '#34d399';
        msg.textContent = data.message || 'If subscribed, a secure link has been sent to your inbox.';
      } catch (err) {
        msg.style.color = '#f87171';
        msg.textContent = 'Network error. Please try again.';
      } finally {
        btn.disabled = false;
        btn.textContent = 'Send 1-Click Unsubscribe Link';
      }
    });
  </script>
</body>
</html>`);
  }

  // Token is provided -> Verify and Unsubscribe
  if (!validator.isEmail(email)) {
    return renderPage("Invalid Request", "That email address format is not valid.");
  }

  if (!token || !verifyUnsubscribeToken(email, token)) {
    logger.warn("Rejected unsubscribe with invalid/missing token", { email });
    return renderPage(
      "Link Expired or Invalid",
      "This unsubscribe link is no longer valid or missing a token. If you're trying to stop receiving emails, use the button in your latest morning routine email.",
    );
  }

  try {
    const updated = await sharedData.setUserActive(email, false);
    logger.info("Subscriber unsubscribed", { email });

    if (!updated) {
      return renderPage(
        "Already Unsubscribed",
        `${email} isn't currently subscribed or was already removed.`,
        true,
        email,
      );
    }

    return renderPage(
      "You're Unsubscribed",
      `${email} will no longer receive daily routine emails. Changed your mind? You can re-subscribe anytime!`,
      true,
      email,
    );
  } catch (error) {
    logger.error("Unsubscribe failed", { error: error.message, email });
    return renderPage(
      "Something went wrong",
      "We couldn't process this right now. Please try again shortly.",
    );
  }
}

// POST /unsubscribe/request
// Send secure 1-click unsubscribe email link without leaking subscriber status
async function requestUnsubscribe(req, res) {
  const email = (req.body?.email || "").trim().toLowerCase();
  const GENERIC_RESPONSE = {
    message: "If that email is subscribed, a secure 1-click unsubscribe link has been sent.",
  };

  if (!email || !validator.isEmail(email)) {
    return res.json(GENERIC_RESPONSE);
  }

  try {
    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.json(GENERIC_RESPONSE);
    }

    const token = generateUnsubscribeToken(email);
    const baseUrl =
      res.locals.apiBase || process.env.RENDER_URL || `${req.protocol}://${req.get("host")}`;
    const unsubscribeLink = `${baseUrl}/unsubscribe?email=${encodeURIComponent(
      email,
    )}&token=${token}`;

    const transporter = getTransporter();
    await transporter.sendMail({
      from: process.env.FROM_NAME
        ? `"${process.env.FROM_NAME}" <${process.env.FROM_USER}>`
        : process.env.FROM_USER,
      to: email,
      subject: "Unsubscribe from Morning Routine 📬",
      html: `
        <div style="font-family: sans-serif; max-width: 480px; margin: 0 auto; color: #1e293b;">
          <h2>Confirm Unsubscription</h2>
          <p>We received a request to unsubscribe ${email} from Morning Routine.</p>
          <p style="margin: 24px 0;">
            <a href="${unsubscribeLink}" style="background-color: #ef4444; color: #ffffff; padding: 12px 24px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">
              Unsubscribe Now
            </a>
          </p>
          <p style="color: #64748b; font-size: 13px;">If you didn't request this, you can safely ignore this email — your daily routine will remain active.</p>
        </div>
      `,
    });

    logger.info("Unsubscribe link sent", { email });
    return res.json(GENERIC_RESPONSE);
  } catch (error) {
    logger.error("Failed to send unsubscribe link", { error: error.message, email });
    return res.json(GENERIC_RESPONSE);
  }
}

// GET /scheduled-jobs
function scheduledJobs(req, res) {
  const jobs = emailScheduler.getScheduledJobsStatus();
  res.json({
    count: jobs.length,
    jobs,
  });
}

// POST /send-bulk-now
async function sendBulkNow(req, res) {
  const isAdminSession = req.signedCookies?.mrn_role === "admin";
  const apiKey = req.get("x-cron-key") || req.get("x-admin-secret") || req.query.key;
  const isKeyValid =
    Boolean(apiKey) &&
    ((Boolean(process.env.CRON_API_KEY) && safeCompare(apiKey, process.env.CRON_API_KEY)) ||
      (Boolean(process.env.ADMIN_KEY) && safeCompare(apiKey, process.env.ADMIN_KEY)));

  if (!isAdminSession && !isKeyValid) {
    logger.error("Forbidden: admin access or valid API key required");
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }

  try {
    const adminSkip = req.query.adminSkip;
    const appLocals = req.app.locals;
    const result = await emailScheduler.sendBulkEmails(adminSkip, appLocals);
    res.json({
      success: true,
      ...result,
    });
  } catch (error) {
    logger.error("❌ Bulk send failed", { error: error.message || error });
    res.status(500).json({
      success: false,
      error: error.message || error || "Unknown error occurred",
    });
  }
}

module.exports = {
  sendTestEmail,
  unsubscribe,
  requestUnsubscribe,
  scheduledJobs,
  sendBulkNow,
};
