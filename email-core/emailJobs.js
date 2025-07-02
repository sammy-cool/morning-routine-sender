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

// Function || Endpoint to send an email
async function runEmailJob() {
  const recipients = [
    "priyanshu.alt191@gmail.com", // Valid
    // "invalid@", // Invalid
    // "not-an-email", // Invalid
  ];
  const type = "daily_report";
  const failedRecipients = [];

  for (const email of recipients) {
    if (!validator.isEmail(email)) {
      logger.error(`Invalid email address: ${email}`);
      failedRecipients.push(email);
      continue; // Skip to the next email
    }

    if (!shouldSendEmail(email, type)) {
      logger.info(`Skipped: ${type} already sent successfully to ${email}`);
      continue;
    }

    try {
      await sendEmailFn(email);
      updateTracker(email, type, "success");
      logger.info(`✅ Email sent to ${email}`);
    } catch (err) {
      updateTracker(email, type, "failed", err.message);
      failedRecipients.push(email);
      logger.error(`❌ Failed to send email to ${email}: ${err.message}`);
    }
  }

  await alertAdmin(failedRecipients, type);
}

module.exports = { runEmailJob };
