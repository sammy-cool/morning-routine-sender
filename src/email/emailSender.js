const fs = require("fs");
const path = require("path");
const mjml2html = require("mjml");
const handlebars = require("handlebars");
const logger = require("../../logger");
const { dailyDevNews, todayUTCYYYYMMDD } = require("../../helper/util");

const mjmlTemplatePath = path.join(
  __dirname,
  "..",
  "..",
  "email-templates",
  "email-template.mjml"
);
const mjmlSource = fs.readFileSync(mjmlTemplatePath, "utf-8");
const template = handlebars.compile(mjmlSource);

/**
 * Send Routine Email function
 * @param {Object} userData - user details {name, email, dayNumber, dailyTip, ctaUrl}
 * @param {Array} trendingNews - array of news objects
 * @param {Object} appLocals - app.locals object from Express for apiBase etc.
 */
async function sendRoutineEmail(transporter, appLocals, userData) {
  try {
    const trendingNews = await dailyDevNews();
    const baseUrl = appLocals.officialDomain;
    const dayNumber = todayUTCYYYYMMDD().split("-").at(-1);

    const data = {
      logoUrl: `${process.env.LOGO_URL}`,
      userName: userData.name || "Priyanshu",
      dayNumber: dayNumber,
      dailyTip: userData.dailyTip || "Something to be get curious today!",
      ctaUrl: `${baseUrl}`,
      ctaText: "View Your Routine",
      trendingNews,
      unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(
        userData.email
      )}`,
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

    const info = await transporter.sendMail({
      from: '"Morning Routine" <no-reply@gmail.com>',
      to: userData.email,
      subject: `Day ${data.dayNumber} Morning Routine Update`,
      html,
      text,
    });

    logger.info(`Email sent successfully to ${userData.email}`);
    return {
      success: true,
      messageId: info.messageId,
      response: info.response,
    };
  } catch (err) {
    logger.error("Failed to send email:", err);
    throw err;
  }
}

module.exports = { sendRoutineEmail };
