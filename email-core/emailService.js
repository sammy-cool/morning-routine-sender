// email-core/emailService.js
const fs = require("fs").promises;
const path = require("path");
const logger = require("../logger");

/**
 * Send routine email
 * @param {Transporter} transporter - Nodemailer transporter
 * @param {string} recipient - Recipient email
 * @param {string} templateType - Template type
 */
async function sendRoutineEmail(
  transporter,
  recipient,
  templateType = "default"
) {
  try {
    // Load HTML template
    const templatePath = path.join(
      __dirname,
      "..",
      "email-html-template",
      `routine-${templateType}.html`
    );

    let htmlContent;
    try {
      htmlContent = await fs.readFile(templatePath, "utf-8");
    } catch (error) {
      logger.warn(`Template ${templateType} not found, using default`, {
        templateType,
      });
      const defaultPath = path.join(
        __dirname,
        "..",
        "email-html-template",
        "routine-default.html"
      );
      htmlContent = await fs.readFile(defaultPath, "utf-8");
    }

    // Replace variables in template (if any)
    htmlContent = htmlContent.replace(/{{email}}/g, recipient);
    htmlContent = htmlContent.replace(
      /{{date}}/g,
      new Date().toLocaleDateString()
    );

    // Send email
    const info = await transporter.sendMail({
      from: `"${process.env.FROM_NAME || "Morning Routine"}" <${
        process.env.FROM_USER
      }>`,
      to: recipient,
      subject: `Your Morning Routine - ${templateType
        .replace("-", " ")
        .toUpperCase()}`,
      html: htmlContent,
      headers: {
        "X-Template-Type": templateType,
        "X-Job-Type": "routine-email",
      },
    });

    logger.info("Email sent", { recipient, templateType });
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (error) {
    logger.error("Email send error", {
      error: error.message,
      recipient,
      templateType,
    });
    throw error;
  }
}

module.exports = { sendRoutineEmail };
