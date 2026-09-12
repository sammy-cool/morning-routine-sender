// emailService.js
const handlebars = require("handlebars");
let mjml2html;
try {
  mjml2html = require("mjml");
} catch (_err) {
  mjml2html = (content) => ({ html: `<html><body>${content}</body></html>`, errors: [] });
}
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const { dailyDevNews } = require("../helper/util");
const { generateUnsubscribeToken, generateActionToken } = require("../helper/unsubscribeToken");
const { getDailyMorningSpark } = require("../helper/aiSparkGenerator");

// Load MJML template
const mjmlTemplatePath = path.join(__dirname, "..", "email-templates", "email-template.mjml");
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
    const newsCategory = userData.newsCategory || "all";
    const trendingNews = await dailyDevNews(newsCategory);
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

    // Check Vacation / Paused Mode
    if (userData.vacationUntil && new Date() < new Date(userData.vacationUntil)) {
      logger.info("Subscriber on vacation mode, skipping routine email dispatch", {
        email: userData.email,
        vacationUntil: userData.vacationUntil,
      });
      return { status: "skipped", reason: "vacation_mode" };
    }

    const dayOfWeek = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      weekday: "short",
    }).format(now);
    const isWeekend = dayOfWeek === "Sat" || dayOfWeek === "Sun";
    const trackKey =
      isWeekend && userData.weekendRoutineTrack
        ? userData.weekendRoutineTrack
        : userData.routineTrack || userData.templateType || "deep-work";

    const { getWeatherSpark } = require("../helper/weatherSpark");
    const weatherSpark = getWeatherSpark(userData.locationCity, userTimezone, now);

    const { getActiveAnnouncement } = require("../helper/announcementService");
    const announcement = await getActiveAnnouncement(trackKey);

    const emailDensity = userData.emailDensity || "standard";
    const isBiteDensity = emailDensity === "bite";
    const isDeepDensity = emailDensity === "deep";

    const userStreak = Number(userData.streakCount) || 0;

    const trackInfo = sharedData.getTrackContent(trackKey, {
      dateStr: dayNumber,
      seed: `${userStreak}_${userData.email}`,
      email: userData.email,
      customQuote: userData.customQuote,
      customRitual: userData.customRitual,
    });

    const streakBadge = userStreak > 0 ? `${userStreak}-Day Streak` : "Day 1 Streak";
    const trackBadge = trackInfo.badge;

    const dailyQuote = userData.customQuote || userData.dailyQuote || trackInfo.quote;
    const dailyTip = userData.customRitual || userData.dailyTip || trackInfo.ritual;

    // Generate dynamic AI Morning Spark (with instant curated fallback)
    const morningSpark = await getDailyMorningSpark({
      email: userData.email,
      routineTrack: trackKey,
      coachPersona: userData.coachPersona || "stoic",
      customCoachPrompt: userData.customCoachPrompt || null,
      streakCount: userStreak,
      timezone: userTimezone,
      name: userData.name || (userData.email ? userData.email.split("@")[0] : "Subscriber"),
    });

    const checkinToken = generateActionToken(userData.email, "checkin");
    const routineToken = generateActionToken(userData.email, "routine");

    const activeChecklist =
      Array.isArray(userData.customHabits) && userData.customHabits.length > 0
        ? userData.customHabits
        : trackInfo.checklist || [];

    const focusDuration = Number(userData.focusDurationMinutes) || 25;
    const routineQueryDuration = focusDuration !== 25 ? `&duration=${focusDuration}` : "";

    const data = {
      logoUrl: process.env.LOGO_URL || `${baseUrl}/assets/logo.png`,
      userName: userData.name || (userData.email ? userData.email.split("@")[0] : "Subscriber"),
      dayNumber: dayNumber,
      year: templateYear,
      streakBadge: streakBadge,
      trackBadge: trackBadge,
      dailyQuote: dailyQuote,
      dailyTip: dailyTip,
      checklist: activeChecklist,
      focusDurationMinutes: focusDuration,
      coachPersona: userData.coachPersona || "stoic",
      aiSparkReflection: morningSpark.sparkReflection,
      aiMicroAction: morningSpark.microAction,
      aiFocusMantra: morningSpark.focusMantra,
      aiSourceBadge: morningSpark.source === "curated" ? "Curated Spark" : "AI Spark",
      streakTier: morningSpark.streakTier,
      ctaUrl: `${baseUrl}/routine?email=${encodeURIComponent(userData.email)}&token=${routineToken}${routineQueryDuration}`,
      ctaText: `⚡ Open Interactive Routine & ${focusDuration}-Min Focus Timer`,
      checkinUrl: `${baseUrl}/checkin?email=${encodeURIComponent(userData.email)}&token=${checkinToken}`,
      preferencesUrl: `${baseUrl}/user-dashboard`,
      trendingNews,
      weatherSpark,
      announcement,
      isBiteDensity,
      isDeepDensity,
      isWeekend,
      unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(
        userData.email,
      )}&token=${generateUnsubscribeToken(userData.email)}`,
    };

    const renderedMjml = template(data);
    const mjmlResult = await mjml2html(renderedMjml, {
      validationLevel: "strict",
    });
    let html = mjmlResult?.html || "";
    const errors = mjmlResult?.errors || [];

    if (errors && errors.length) {
      logger.error("MJML Errors:", errors);
      throw new Error("Email template rendering error");
    }

    // Google Schema.org 1-Click Action Markup for Gmail
    const schemaOrgJsonLd = JSON.stringify({
      "@context": "http://schema.org",
      "@type": "EmailMessage",
      description: "Log your morning routine and maintain your active streak",
      potentialAction: {
        "@type": "ViewAction",
        target: data.checkinUrl,
        name: "🔥 1-Click Check-in",
      },
      publisher: {
        "@type": "Organization",
        name: "Morning Routine Sender",
        url: baseUrl,
      },
    });
    const schemaScript = `\n  <script type="application/ld+json">\n  ${schemaOrgJsonLd}\n  </script>\n`;
    if (html.includes("</head>")) {
      html = html.replace("</head>", `${schemaScript}</head>`);
    } else {
      html = `${schemaScript}${html}`;
    }

    const textChecklist = (trackInfo.checklist || []).map((item) => `[ ] ${item}`).join("\n");
    const text = `Good morning ${data.userName},

[${trackInfo.badge} • 🔥 ${streakBadge}]

Quote: "${data.dailyQuote}"

Today's Focus Ritual:
${data.dailyTip}

⚡ Daily Kickoff (${data.aiSourceBadge}):
"${data.aiSparkReflection}"

🚀 2-Min Micro-Action:
${data.aiMicroAction}

⚓ Focus Mantra:
"${data.aiFocusMantra}"

📋 Today's Habit Checklist:
${textChecklist}

⚡ Open Live Routine & Timer: ${data.ctaUrl}
🔥 1-Click Streak Check-in: ${data.checkinUrl}
Manage Preferences: ${data.preferencesUrl}
Unsubscribe: ${data.unsubscribeUrl}`;

    // Send email
    try {
      const messageRef = crypto.randomBytes(8).toString("hex");

      const streak = Number(data.streakCount) || 1;
      let morningSubject;
      if ([3, 7, 14, 21, 30, 60, 100, 365].includes(streak) || streak % 7 === 0) {
        morningSubject = `🔥 Milestone: Day ${streak} Streak Active • Morning Focus Routine ⚡`;
      } else if (data.spark && data.spark.focusMantra) {
        const mantraPreview = data.spark.focusMantra.replace(/["']/g, "").slice(0, 45);
        morningSubject = `🌅 Day ${data.dayNumber}: "${mantraPreview}" • Morning Routine`;
      } else {
        morningSubject = `Day ${data.dayNumber} Morning Routine Update 🌞`;
      }

      let subjectPrefix = "";
      if (data.isBiteDensity) subjectPrefix += "[Quick Skim ⚡] ";
      else if (data.isDeepDensity) subjectPrefix += "[Deep Focus 🧘] ";
      if (data.isWeekend && userData.weekendRoutineTrack) subjectPrefix += "[Weekend Edition 🌿] ";
      morningSubject = `${subjectPrefix}${morningSubject}`;

      const info = await transporter.sendMail({
        from: `"Morning Routine" <${process.env.FROM_USER}>`,
        replyTo: `${process.env.FROM_USER}`,
        to: userData.email,
        subject: morningSubject,
        html,
        text,
        headers: {
          "X-App-Origin":
            typeof appLocals === "string"
              ? appLocals
              : appLocals?.officialDomain || "morning-routine-sender",
          "Message-ID": `<${crypto.randomUUID()}@morningroutine.app>`,
          "X-Entity-Ref-ID": messageRef,
          "X-Trace-ID": `${crypto.randomBytes(6).toString("hex")}`,
          "X-Service": "morning-routine-sender",
          "X-Campaign": "daily-routine",
          "X-Template-Type": trackKey,
          "X-Job-Type": "routine-email",
          "X-Message-Ref": messageRef,
          Precedence: "bulk",
          "Auto-Submitted": "auto-generated",
          "List-Unsubscribe": `<${data.unsubscribeUrl}>`,
          "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
        },
      });

      logger.info(`Email sent successfully to ${userData.email} - ${messageRef}`);
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

// Load Weekly Digest MJML template
const weeklyDigestPath = path.join(__dirname, "..", "email-templates", "weekly-digest.mjml");
let weeklyTemplate = null;
if (fs.existsSync(weeklyDigestPath)) {
  const source = fs.readFileSync(weeklyDigestPath, "utf8");
  weeklyTemplate = handlebars.compile(source);
}

/**
 * Send Sunday Weekly Streak Digest email
 * @param {Transporter} transporter - Nodemailer transporter
 * @param {Object} appLocals - app.locals object from Express
 * @param {Object} userData - user details
 */
async function sendWeeklyDigestEmail(transporter, appLocals, userData) {
  try {
    const baseUrl =
      typeof appLocals === "string"
        ? appLocals
        : appLocals?.officialDomain || process.env.RENDER_URL || "http://localhost:2900";
    const userTimezone = userData.timezone || "UTC";
    const now = new Date();
    const templateYear = new Intl.DateTimeFormat("en-US", {
      timeZone: userTimezone,
      year: "numeric",
    }).format(now);

    const trackKey = userData.routineTrack || userData.templateType || "deep-work";
    const digestInfo = sharedData.getWeeklyDigestContent(trackKey);
    const userStreak = Number(userData.streakCount) || 0;
    const streakBadge = userStreak > 0 ? `${userStreak}-Day Streak Active` : "Ignite Your Streak";

    const checkinToken = generateActionToken(userData.email, "checkin");
    const routineToken = generateActionToken(userData.email, "routine");

    const data = {
      userName: userData.name || (userData.email ? userData.email.split("@")[0] : "Subscriber"),
      year: templateYear,
      trackName: digestInfo.name,
      trackBadge: digestInfo.badge,
      streakCount: userStreak,
      streakBadge: streakBadge,
      streakEncouragement: digestInfo.weeklyEncouragement,
      weeklyQuote: digestInfo.weeklyQuote,
      weeklyReflectionGuidance: digestInfo.weeklyReflectionGuidance,
      weeklyPrepItems: digestInfo.weeklyPrepItems,
      ctaUrl: `${baseUrl}/routine?email=${encodeURIComponent(userData.email)}&token=${routineToken}&source=weekly_digest`,
      checkinUrl: `${baseUrl}/checkin?email=${encodeURIComponent(userData.email)}&token=${checkinToken}&source=weekly_digest`,
      preferencesUrl: `${baseUrl}/user-dashboard`,
      unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(
        userData.email,
      )}&token=${generateUnsubscribeToken(userData.email)}`,
    };

    const renderedMjml = weeklyTemplate ? weeklyTemplate(data) : "";
    const mjmlResult = await mjml2html(renderedMjml, { validationLevel: "strict" });
    const html = mjmlResult?.html || "";

    const dayCap = userData.weeklyDigestDay
      ? userData.weeklyDigestDay.charAt(0).toUpperCase() +
        userData.weeklyDigestDay.slice(1).toLowerCase()
      : "Sunday";

    const text = `${dayCap} Weekly Streak Digest for ${data.userName}\n\nStreak: ${data.streakBadge}\nPersona: ${digestInfo.name}\n\nWeekly Reflection: ${digestInfo.weeklyReflectionGuidance}\n\nUpcoming Week Prep:\n${digestInfo.weeklyPrepItems.map((p) => `- ${p.title}: ${p.description}`).join("\n")}\n\nOpen Routine: ${data.ctaUrl}\nCheck-in: ${data.checkinUrl}`;

    const messageRef = crypto.randomBytes(8).toString("hex");
    const info = await transporter.sendMail({
      from: `"Morning Routine Digest" <${process.env.FROM_USER}>`,
      replyTo: `${process.env.FROM_USER}`,
      to: userData.email,
      subject: `🔥 ${dayCap} Weekly Streak Digest • ${streakBadge} 📊`,
      html,
      text,
      headers: {
        "X-Service": "morning-routine-sender",
        "X-Campaign": "weekly-streak-digest",
        "X-Template-Type": "weekly-digest",
        "X-Job-Type": "weekly-digest-email",
        "X-Message-Ref": messageRef,
        "List-Unsubscribe": `<${data.unsubscribeUrl}>`,
        "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
      },
    });

    logger.info(`✅ ${dayCap} Weekly Digest sent to ${userData.email} - ${messageRef}`);
    return { success: true, messageId: info.messageId };
  } catch (error) {
    logger.error("Weekly digest send error:", { error: error.message, email: userData.email });
    throw error;
  }
}

module.exports = {
  sendRoutineEmail,
  sendWeeklyDigestEmail,
};
