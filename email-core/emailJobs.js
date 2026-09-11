const validator = require("validator");

const logger = require("../logger");
const { getTransporter } = require("../config/mailTransporter");
const emailTracker = require("./emailTracker");
const { sendRoutineEmail } = require("./emailService");

// Email Configuration
const adminEmail = process.env.ADMIN_EMAIL;

async function alertAdmin(failedRecipients, type) {
  if (failedRecipients.length === 0) return;

  const message = `Failed to send ${type} emails to:\n` + failedRecipients.join("\n");

  try {
    await getTransporter().sendMail({
      from: `"Server Alert" <${process.env.FROM_USER}>`,
      to: process.env.ADMIN_EMAIL || adminEmail,
      subject: `Alert: Failed ${type} emails`,
      text: message,
    });
    logger.info("Admin alerted about failed emails.");
  } catch (err) {
    logger.error("Failed to send admin alert:", err);
  }
}

// Function to send an email
async function runEmailJob() {
  const recipients = [
    process.env.TEST_EMAIL || "test@example.com", // Valid
    // "invalid@", // Invalid
    // "not-an-email", // Invalid
  ];
  const type = "daily_report";
  const failedRecipients = [];
  const results = {
    sent: [],
    skipped: [],
    failed: [],
    invalid: [],
  };

  for (const email of recipients) {
    if (!validator.isEmail(email)) {
      logger.error(`Invalid email address: ${email}`);
      results.invalid.push(email);
      failedRecipients.push(email);
      continue;
    }

    if (await emailTracker.wasEmailSentToday(email, type)) {
      logger.info(`Skipped: ${type} already sent successfully to ${email}`);
      results.skipped.push(email);
      continue;
    }

    try {
      await sendRoutineEmail(getTransporter(), {}, { email, templateType: type });
      await emailTracker.recordSend(email, type, `test-id-${Date.now()}`);
      results.sent.push({ email, success: `${type}_success` });
      logger.info(`✅ Email sent to ${email}`);
    } catch (err) {
      await emailTracker.recordFailure(email, type, err.message);
      failedRecipients.push(email);
      results.failed.push({ email, error: err.message });
      logger.error(`❌ Failed to send email to ${email}: ${err.message}`);
    }
  }

  await alertAdmin(failedRecipients, type);
  return results;
}

// Function to run batch Sunday weekly digest for subscribers
async function runWeeklyDigestJob(options = {}) {
  const sharedData = require("../helper/shared-data");
  const weeklyDigestService = require("../helper/weeklyDigestService");
  const db = require("../db/knex");

  const force = Boolean(options.force);
  const targetEmail = options.email ? options.email.trim().toLowerCase() : null;

  let subscribers = [];
  if (targetEmail) {
    const user = await sharedData.getUserByEmail(targetEmail);
    if (user) subscribers = [user];
  } else {
    subscribers = await sharedData.getUsers();
  }

  const results = {
    total: subscribers.length,
    sent: [],
    skipped: [],
    failed: [],
    invalid: [],
  };
  const failedRecipients = [];

  for (const subscriber of subscribers) {
    const email = subscriber.email;
    if (!email || !validator.isEmail(email)) {
      results.invalid.push(email || "unknown");
      continue;
    }

    if (!subscriber.isActive && !targetEmail) {
      results.skipped.push({ email, reason: "paused" });
      continue;
    }

    if (subscriber.weeklyDigestEnabled === false && !force) {
      results.skipped.push({ email, reason: "opted_out" });
      continue;
    }

    if (!force) {
      const alreadySent = await emailTracker.wasEmailSentThisWeek(email, "weekly_digest");
      if (alreadySent) {
        results.skipped.push({ email, reason: "already_sent_this_week" });
        continue;
      }
    }

    try {
      const dispatchResult = await weeklyDigestService.dispatchWeeklyDigest(subscriber);
      if (dispatchResult.success) {
        results.sent.push({ email, messageId: dispatchResult.messageId });
        logger.info(`✅ Weekly Digest sent to ${email}`);
      } else {
        results.failed.push({ email, error: dispatchResult.error });
        failedRecipients.push(email);
      }
    } catch (err) {
      results.failed.push({ email, error: err.message });
      failedRecipients.push(email);
      logger.error(`❌ Failed to send Weekly Digest to ${email}:`, err);
    }
  }

  // Update last run timestamp in database
  try {
    const hasLastRun = await db.schema.hasTable("job_last_run");
    if (hasLastRun) {
      const existing = await db("job_last_run").where({ job_name: "weekly_digest" }).first();
      if (existing) {
        await db("job_last_run")
          .where({ job_name: "weekly_digest" })
          .update({ last_run_at: new Date() });
      } else {
        await db("job_last_run").insert({ job_name: "weekly_digest", last_run_at: new Date() });
      }
    }
  } catch (dbErr) {
    logger.warn("Could not record last_run for weekly_digest", { error: dbErr.message });
  }

  if (failedRecipients.length > 0) {
    await alertAdmin(failedRecipients, "weekly_digest");
  }

  return results;
}

module.exports = { runEmailJob, runWeeklyDigestJob };
