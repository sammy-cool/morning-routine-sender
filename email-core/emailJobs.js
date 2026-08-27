const validator = require("validator");

const logger = require("../logger");
const { getTransporter } = require("../config/mailTransporter");
const emailTracker = require("./emailTracker");
const { sendRoutineEmail } = require("./emailService");

// Email Configuration
const adminEmail = process.env.ADMIN_EMAIL;

async function alertAdmin(failedRecipients, type) {
  if (failedRecipients.length === 0) return;

  const message =
    `Failed to send ${type} emails to:\n` + failedRecipients.join("\n");

  try {
    await getTransporter().sendMail({
      from: `"Server Alert" <${process.env.FROM_USER}>`,
      to: adminEmail,
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

module.exports = { runEmailJob };
