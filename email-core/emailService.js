// emailService.js
const handlebars = require("handlebars");
const mjml2html = require("mjml");
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const { dailyDevNews } = require("../helper/util");
const { generateUnsubscribeToken, generateActionToken } = require("../helper/unsubscribeToken");

// Load MJML template
const mjmlTemplatePath = path.join(
  __dirname,
  "..",
  "email-templates",
  "email-template.mjml"
);
const mjmlSource = fs.readFileSync(mjmlTemplatePath, "utf8");
const template = handlebars.compile(mjmlSource);

/**
 * Send routine email
 * @param {Transporter} transporter - Nodemailer transporter
 * @param {Object} userData - user details {name, email, dayNumber, dailyTip, routineTrack, streakCount}
 * @param {Object} appLocals - app.locals object from Express for apiBase etc.
 */
async function sendRoutineEmail(transporter, appLocals, userData) {
  try {
    const trendingNews = await dailyDevNews();
    const baseUrl =
      typeof appLocals === "string"
        ? appLocals
        : appLocals?.officialDomain || process.env.RENDER_URL || "http://localhost:2900";
    const userTimezone = userData.timezone || "UTC";
    const now = new Date();
    const dayNumber = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      day: "2-digit",
    }).format(now);
    const templateYear = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      year: "numeric",
    }).format(now);

    const trackKey = userData.routineTrack || userData.templateType || "deep-work";
    const trackInfo = sharedData.getTrackContent(trackKey);

    const userStreak = Number(userData.streakCount) || 0;
    const streakBadge = userStreak > 0 ? `${userStreak}-Day Streak` : "Day 1 Streak";
    const trackBadge = trackInfo.badge;

    const dailyQuote = userData.dailyQuote || trackInfo.quote;
    const dailyTip = userData.dailyTip || trackInfo.ritual;

    const checkinToken = generateActionToken(userData.email, "checkin");
    const routineToken = generateActionToken(userData.email, "routine");

    const data = {
      logoUrl: process.env.LOGO_URL || `${baseUrl}/assets/logo.png`,
      userName: userData.name || (userData.email ? userData.email.split("@")[0] : "Subscriber"),
      dayNumber: dayNumber,
      year: templateYear,
      streakBadge: streakBadge,
      trackBadge: trackBadge,
      dailyQuote: dailyQuote,
      dailyTip: dailyTip,
      ctaUrl: `${baseUrl}/routine?email=${encodeURIComponent(userData.email)}&token=${routineToken}`,
      ctaText: "⚡ Open Interactive Routine & Focus Timer",
      checkinUrl: `${baseUrl}/checkin?email=${encodeURIComponent(userData.email)}&token=${checkinToken}`,
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

    const text = `Good morning ${data.userName},\n\n[${trackInfo.badge} • 🔥 ${streakBadge}]\n\nQuote: "${data.dailyQuote}"\n\nToday's Focus Ritual: ${data.dailyTip}\n\n⚡ Open Live Routine & Timer: ${data.ctaUrl}\n🔥 1-Click Streak Check-in: ${data.checkinUrl}\nManage Preferences: ${data.preferencesUrl}\nUnsubscribe: ${data.unsubscribeUrl}`;

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
          "X-App-Origin":
            typeof appLocals === "string"
              ? appLocals
              : appLocals?.officialDomain || "morning-routine-sender",
          "Message-ID": `<${crypto.randomUUID()}@morningroutine.app>`,
          "X-Trace-ID": `${crypto.randomBytes(6).toString("hex")}`,
          "X-Service": "morning-routine-sender",
          "X-Campaign": "daily-routine",
          "X-Template-Type": trackKey,
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
    logger.error("Email service error:", {
      error: error.message || error,
      email: userData.email,
    });
    throw error;
  }
}

module.exports = {
  sendRoutineEmail,
};
