// email-core/emailService.js
const fs = require("node:fs");
const path = require("node:path");
const mjml2html = require("mjml");
const handlebars = require("handlebars");
const crypto = require("node:crypto");

const logger = require("../logger");
const sharedData = require("../helper/shared-data");
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
    const baseUrl = typeof appLocals === 'string' ? appLocals : (appLocals?.officialDomain || process.env.RENDER_URL || 'http://localhost:2900');
    const userTimezone = userData.timezone || 'UTC';
    const now = new Date();
    const dayNumber = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, day: '2-digit' }).format(now);
    const templateYear = new Intl.DateTimeFormat('en-US', { timeZone: userTimezone, year: 'numeric' }).format(now);

    let dailyQuote = "The secret of your future is hidden in your daily routine.";
    try {
      dailyQuote = await sharedData.getNewRandomQuote();
    } catch {
      dailyQuote = "The secret of your future is hidden in your daily routine.";
    }

    let dailyTip = userData.dailyTip || "Dedicate the first 30 minutes of your morning to your highest-impact priority.";

    const data = {
      logoUrl: process.env.LOGO_URL || `${baseUrl}/assets/logo.png`,
      userName: userData.name || (userData.email ? userData.email.split('@')[0] : "Subscriber"),
      dayNumber: dayNumber,
      year: templateYear,
      dailyQuote: dailyQuote,
      dailyTip: dailyTip,
      ctaUrl: `${baseUrl}`,
      ctaText: "View Your Routine",
      preferencesUrl: `${baseUrl}/user-dashboard`,
      trendingNews,
      unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(
        userData.email
      )}&token=${generateUnsubscribeToken(userData.email)}`,
    };

    const renderedMjml = template(data);
    const mjmlResult = await mjml2html(renderedMjml, {
      validationLevel: "strict",
    });
    const html = mjmlResult?.html || "";
    const errors = mjmlResult?.errors || [];

    if (errors && errors.length) {
      logger.error("MJML Errors:", errors);
      throw new Error("Email template rendering error");
    }

    const text = `Good morning ${data.userName},\n\nQuote: "${data.dailyQuote}"\n\nToday's Ritual: ${data.dailyTip}\n\nVisit: ${data.ctaUrl}\nPreferences: ${data.preferencesUrl}\nUnsubscribe: ${data.unsubscribeUrl}`;

    // Send email
    try {
      const messageRef = crypto.randomBytes(8).toString("hex");

      const info = await transporter.sendMail({
        from: `"Morning Routine" <${process.env.FROM_USER}>`,
        replyTo: `${process.env.FROM_USER}`,
        to: userData.email,
        subject: `Day ${data.dayNumber} Morning Routine Update 🌞`,
        html,
        text,
        headers: {
          "X-App-Origin": typeof appLocals === 'string' ? appLocals : (appLocals?.officialDomain || 'morning-routine-sender'),
          "Message-ID": `<${crypto.randomUUID()}@morningroutine.app>`,
          "X-Trace-ID": `${crypto.randomBytes(6).toString("hex")}`,
          "X-Service": "morning-routine-sender",
          "X-Campaign": "daily-routine",
          "X-Template-Type": userData.templateType,
          "X-Job-Type": "routine-email",
          "X-Message-Ref": messageRef,
          "List-Unsubscribe": `<${data.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
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
