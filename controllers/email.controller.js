const logger = require("../logger");
const validator = require("validator");
const emailTracker = require("../email-core/emailTracker");
const emailScheduler = require("../email-core/emailScheduler");
const sharedData = require("../helper/shared-data");
const { verifyUnsubscribeToken } = require("../helper/unsubscribeToken");
const { getTransporter } = require("../config/mailTransporter");
const { safeCompare } = require("../helper/util");

// POST /send-test-email
async function sendTestEmail(req, res) {
  try {
    const { email } = req.body;
    let templateType = req.body.templateType || "basic";

    const isAdminSession = req.signedCookies?.mrn_role === "admin";
    const expectedKey = process.env.CRON_API_KEY || process.env.ADMIN_KEY;
    const apiKey = req.get("x-cron-key") || req.get("x-admin-secret") || req.query.key;
    const isKeyValid = expectedKey && apiKey && safeCompare(apiKey, expectedKey);

    if (!isAdminSession && !isKeyValid) {
      logger.error("Forbidden: admin access or valid API key required");
      return res.status(403).json({ error: "Forbidden: admin access required" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    const emailService = require("../email-core/emailService");

    const result = await emailService.sendRoutineEmail(
      getTransporter(),
      req.app.locals,
      {
        email,
        templateType,
      },
    );

    await emailTracker.recordSend(email, templateType, result.messageId, {
      manual: true,
    });

    logger.info("✅ Email sent successfully manually.", {
      email,
      messageId: result.messageId,
      templateType,
    });

    return res.status(200).json({
      success: true,
      messageId: result.messageId,
      email,
      templateType,
    });
  } catch (error) {
    logger.error("❌ Failed to send test email", {
      error: error.message,
    });

    return res.status(500).json({
      success: false,
      error: error.message || "Unknown error occurred",
      details: process.env.NODE_ENV === "development" ? error.stack : undefined,
    });
  }
}

// GET /unsubscribe?email=...&token=...
//
// Previously called unsubscribeUser() from lib/myLib.js, which invoked a
// browser-DOM toast library from server-side code and never touched the
// database at all -- clicking "unsubscribe" did nothing except return a
// fake success string. Rewritten to actually update the subscriber's
// row, with a signed per-email token (see helper/unsubscribeToken.js) so
// this can't be used to unsubscribe someone else just by knowing their
// email address.
async function unsubscribe(req, res) {
  const email = (req.query.email || "").trim().toLowerCase();
  const token = req.query.token;

  function renderPage(title, message) {
    res.send(`<!DOCTYPE html>
<html lang="en" class="dark">
<head>
  <meta charset="UTF-8" />
  <title>${title} • Morning Routine</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <link rel="preconnect" href="https://fonts.googleapis.com" />
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin />
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;600;700;800&display=swap" rel="stylesheet" />
  <style>
    :root {
      --bg-main: #07090e;
      --bg-card: rgba(17, 24, 39, 0.85);
      --border-subtle: rgba(255, 255, 255, 0.08);
      --primary: #6366f1;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; font-family: 'Plus Jakarta Sans', -apple-system, sans-serif; }
    body {
      background-color: var(--bg-main);
      color: var(--text-main);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 24px;
      background-image: radial-gradient(at 50% 0%, rgba(99, 102, 241, 0.15) 0px, transparent 60%);
    }
    .card {
      background: var(--bg-card);
      backdrop-filter: blur(20px);
      border: 1px solid var(--border-subtle);
      border-radius: 20px;
      padding: 36px 28px;
      max-width: 460px;
      width: 100%;
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      box-shadow: 0 20px 40px rgba(0, 0, 0, 0.6);
    }
    .icon {
      width: 56px;
      height: 56px;
      border-radius: 50%;
      background: rgba(99, 102, 241, 0.15);
      border: 1px solid rgba(99, 102, 241, 0.3);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 24px;
      margin-bottom: 4px;
    }
    h1 { font-size: 22px; font-weight: 800; letter-spacing: -0.5px; }
    p { font-size: 14px; color: var(--text-muted); line-height: 1.6; }
    .btn {
      display: inline-block;
      margin-top: 8px;
      padding: 11px 22px;
      background: linear-gradient(135deg, var(--primary), #4f46e5);
      color: #fff;
      border-radius: 12px;
      text-decoration: none;
      font-weight: 600;
      font-size: 14px;
      transition: transform 0.2s;
    }
    .btn:hover { transform: translateY(-1px); }
  </style>
</head>
<body>
  <div class="card">
    <div class="icon">📬</div>
    <h1>${title}</h1>
    <p>${message}</p>
    <a href="/" class="btn">Return to Home</a>
  </div>
</body>
</html>`);
  }

  if (!email || !validator.isEmail(email)) {
    return renderPage("Invalid request", "That unsubscribe link looks malformed.");
  }

  if (!verifyUnsubscribeToken(email, token)) {
    logger.warn("Rejected unsubscribe with invalid/missing token", { email });
    return renderPage(
      "Link expired or invalid",
      "This unsubscribe link isn't valid. If you're trying to stop receiving emails, reply to any of our emails and we'll take care of it.",
    );
  }

  try {
    const updated = await sharedData.setUserActive(email, false);
    logger.info("Subscriber unsubscribed", { email });

    if (!updated) {
      return renderPage(
        "Already unsubscribed",
        `${email} isn't currently subscribed, or was already removed.`,
      );
    }

    return renderPage(
      "You're unsubscribed",
      `${email} won't receive any more routine emails. Changed your mind? Just subscribe again anytime.`,
    );
  } catch (error) {
    logger.error("Unsubscribe failed", { error: error.message, email });
    return renderPage(
      "Something went wrong",
      "We couldn't process this right now -- please try again shortly.",
    );
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
  const expectedKey = process.env.CRON_API_KEY || process.env.ADMIN_KEY;
  const apiKey = req.get("x-cron-key") || req.get("x-admin-secret") || req.query.key;
  const isKeyValid = expectedKey && apiKey && safeCompare(apiKey, expectedKey);

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

module.exports = { sendTestEmail, unsubscribe, scheduledJobs, sendBulkNow };
