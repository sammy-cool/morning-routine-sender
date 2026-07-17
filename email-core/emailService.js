// email-core/emailService.js
const fs = require("node:fs");
const path = require("node:path");
const mjml2html = require("mjml");
const handlebars = require("handlebars");
const crypto = require("node:crypto");

const logger = require("../logger");
const { dailyDevNews, todayUTCYYYYMMDD } = require("../helper/util");
const { generateUnsubscribeToken } = require("../helper/unsubscribeToken");

const mjmlTemplatePath = path.join(
  __dirname,
  "..",
  "email-templates",
  "email-template.mjml"
);
const mjmlSource = fs.readFileSync(mjmlTemplatePath, "utf-8");
const template = handlebars.compile(mjmlSource);

/**
 * Send routine email
 * @param {Transporter} transporter - Nodemailer transporter
 * @param {Object} userData - user details {name, email, dayNumber, dailyTip, ctaUrl}
 * @param {Object} appLocals - app.locals object from Express for apiBase etc.
 * @param {string} templateType - Template type
 */
async function sendRoutineEmail(transporter, appLocals, userData) {
  try {
    const trendingNews = await dailyDevNews();
    const baseUrl = appLocals.officialDomain;
    const dayNumber = todayUTCYYYYMMDD().split("-").at(-1);
    const templateYear = todayUTCYYYYMMDD().split("-").at(0);

    const data = {
      logoUrl: `${process.env.LOGO_URL}`,
      userName: userData.name || "Priyanshu",
      dayNumber: dayNumber,
      year: templateYear,
      dailyTip: userData.dailyTip || "Something to be get curious about today!",
      ctaUrl: `${baseUrl}`,
      ctaText: "View Your Routine",
      trendingNews,
      unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(
        userData.email
      )}&token=${generateUnsubscribeToken(userData.email)}`,
    };

    const renderedMjml = template(data);
    const { html, errors } = mjml2html(renderedMjml, {
      validationLevel: "strict",
    });

    if (errors.length) {
      logger.error("MJML Errors:", errors);
      throw new Error("Email template rendering error");
    }

    const text = `Hello ${data.userName},\n\n${data.dailyTip}\n\nVisit here: ${data.ctaUrl}`;

    // Send email
    try {
      await transporter.verify();
      logger.info(
        `✅ Transporter verified successfully for email to %s,
        ${userData.email}`
      );
      const messageRef = crypto.randomBytes(8).toString("hex");

      const info = await transporter.sendMail({
        from: `"Morning Routine" <${process.env.FROM_USER}>`,
        replyTo: `${process.env.FROM_USER}`,
        to: userData.email,
        subject: `Day ${data.dayNumber} Morning Routine Update`,
        html,
        text,
        headers: {
          "X-App-Origin": appLocals,
          "Message-ID": `<${crypto.randomUUID()}@morningroutine.app>`,
          "X-Trace-ID": `${crypto.randomBytes(6).toString("hex")}`,
          "X-Service": "morning-routine-sender",
          "X-Campaign": "daily-routine",
          "X-Template-Type": userData.templateType,
          "X-Job-Type": "routine-email",
          "X-Message-Ref": messageRef,
          // "X-User-ID": userData.id || `temp-${crypto.randomBytes(4).toString("hex")}`,
        },
      });

      logger.info(
        `Email sent successfully to ${userData.email} - ${messageRef}`
      );
      return {
        success: true,
        messageId: info.messageId,
        response: info.response,
      };
    } catch (error) {
      logger.error("Transport error:", {
        error: error.message || error,
        email: userData.email,
      });
      throw error;
    }
  } catch (error) {
    logger.error("Failed to send email:", {
      error: error.message,
      email: userData.email,
      templateType: userData.templateType,
    });
    throw error;
  }
}

module.exports = { sendRoutineEmail };
