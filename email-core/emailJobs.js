const validator = require("validator");

const logger = require("../logger");
const { createTransporter } = require("../config/email-config");
const { shouldSendEmail, updateTracker } = require("./emailTracker");
const { sendEmailFn } = require("./emailService");

// Email Configuration
const transporter = createTransporter();
const adminEmail = process.env.ADMIN_EMAIL;

async function alertAdmin(failedRecipients, type) {
  if (failedRecipients.length === 0) return;

  const message =
    `Failed to send ${type} emails to:\n` + failedRecipients.join("\n");

  try {
    await transporter.sendMail({
      from: `Server! ${process.env.FROM_USER}`,
      to: `Admin! ${adminEmail}`,
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
    "priyanshu.alt191@gmail.com", // Valid
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

    if (!shouldSendEmail(email, type)) {
      logger.info(`Skipped: ${type} already sent successfully to ${email}`);
      results.skipped.push(email);
      continue;
    }

    try {
      await sendEmailFn(email);
      updateTracker(email, type, "success");
      results.sent.push({ email, success: `${type}_success` });
      logger.info(`✅ Email sent to ${email}`);
    } catch (err) {
      updateTracker(email, type, "failed", err.message);
      failedRecipients.push(email);
      results.failed.push({ email, error: err.message });
      logger.error(`❌ Failed to send email to ${email}: ${err.message}`);
    }
  }

  await alertAdmin(failedRecipients, type);
  return results;
}

module.exports = { runEmailJob };
