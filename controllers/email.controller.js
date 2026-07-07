const logger = require("../logger");
const emailTracker = require("../email-core/emailTracker");
const emailScheduler = require("../email-core/emailScheduler");
const { unsubscribeUser } = require("../lib/myLib");
const { getTransporter } = require("../config/mailTransporter");

// POST /send-test-email
async function sendTestEmail(req, res) {
  try {
    const { email } = req.body;
    let templateType = req.body.templateType || "basic";

    if (
      email !== process.env.FROM_USER &&
      req.query.key !== process.env.CRON_API_KEY
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

// GET /unsubscribe
function unsubscribe(req, res) {
  logger.info("Unsubscribing user", {
    email: req.query.email || "Hurray 🎉 User Unsubscribed",
  });
  res.json(
    unsubscribeUser(req.query.email || "unknown@example.com", req.app.locals),
  );
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
  if (req.query.key !== process.env.CRON_API_KEY) {
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
