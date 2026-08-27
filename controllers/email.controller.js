const logger = require("../logger");
const validator = require("validator");
const emailTracker = require("../email-core/emailTracker");
const emailScheduler = require("../email-core/emailScheduler");
const sharedData = require("../helper/shared-data");
const { verifyUnsubscribeToken } = require("../helper/unsubscribeToken");
const { getTransporter } = require("../config/mailTransporter");

// POST /send-test-email
async function sendTestEmail(req, res) {
  try {
    const { email } = req.body;
    let templateType = req.body.templateType || "basic";

    const expectedKey = process.env.CRON_API_KEY;
    if (
      email !== process.env.FROM_USER &&
      (!expectedKey || req.query.key !== expectedKey)
    ) {
      logger.error("Forbidden");
      return res.status(403).json({ error: "Forbidden" });
    }

    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }

    if (email === process.env.FROM_USER) {
      logger.info("⚡ Skipping API key check for ADMIN EMAIL!");
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
<html lang="en"><head><meta charset="UTF-8" />
<title>${title}</title>
<meta name="viewport" content="width=device-width, initial-scale=1.0" />
<style>
  body { font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: #f9fafb; margin: 0; display: flex; min-height: 100vh;
    align-items: center; justify-content: center; }
  .card { background: #fff; border-radius: 12px; box-shadow: 0 6px 20px rgba(2,6,23,.08);
    padding: 28px; max-width: 420px; text-align: center; }
  h1 { font-size: 18px; margin: 0 0 8px; }
  p { color: #6b7280; font-size: 14px; }
</style></head>
<body><div class="card"><h1>${title}</h1><p>${message}</p></div></body></html>`);
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
  const expectedKey = process.env.CRON_API_KEY;
  if (!expectedKey || req.query.key !== expectedKey) {
    logger.error("Forbidden");
    return res.status(403).json({ error: "Forbidden" });
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
