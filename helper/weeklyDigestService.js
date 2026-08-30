// helper/weeklyDigestService.js
const fs = require("fs");
const path = require("path");
const crypto = require("node:crypto");
const handlebars = require("handlebars");
const db = require("../db/knex");
const logger = require("../logger");
const sharedData = require("./shared-data");
const emailTracker = require("../email-core/emailTracker");
const suppressionService = require("../email-core/suppressionService");
const { getTransporter } = require("../config/mailTransporter");
const { retryWithBackoff } = require("./retryUtil");
const { isRetryableError } = require("./errorClassifier");
const { generateUnsubscribeToken, generateActionToken } = require("./unsubscribeToken");
const { getDailyMorningSpark } = require("./aiSparkGenerator");
const { maskEmail } = require("./util");

let mjml2html = null;
function getMjmlCompiler() {
  if (!mjml2html) {
    try {
      mjml2html = require("mjml");
    } catch (_e) {
      mjml2html = (xml) => ({ html: xml, errors: [] });
    }
  }
  return mjml2html;
}

// Compile Handlebars MJML Template
const templatePath = path.join(__dirname, "..", "email-templates", "weekly-digest.mjml");
let compiledDigestTemplate = null;

function getCompiledTemplate() {
  if (!compiledDigestTemplate && fs.existsSync(templatePath)) {
    const rawMjml = fs.readFileSync(templatePath, "utf8");
    compiledDigestTemplate = handlebars.compile(rawMjml);
  }
  return compiledDigestTemplate;
}

/**
 * Computes past 7 dates in subscriber's timezone (YYYY-MM-DD)
 */
function getPast7Dates(timezone = "UTC") {
  const dates = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(d);
    const dayLabel = new Intl.DateTimeFormat("en-US", { timeZone: timezone, weekday: "short" })
      .format(d)
      .slice(0, 1);
    dates.push({ dateStr, dayLabel, fullDate: d });
  }
  return dates;
}

/**
 * Queries Knex for subscriber's past 7-day journal entries and email dispatches
 */
async function getSubscriberWeeklyMetrics(email, timezone = "UTC") {
  const normalizedEmail = (email || "").toLowerCase().trim();
  const past7 = getPast7Dates(timezone);
  const dateStrings = past7.map((p) => p.dateStr);

  let journalEntries = [];
  let emailDispatches = [];

  try {
    const hasJournalTable = await db.schema.hasTable("journal_entries");
    if (hasJournalTable) {
      const res = await db("journal_entries")
        .where({ subscriber_email: normalizedEmail })
        .whereIn("entry_date", dateStrings)
        .orderBy("entry_date", "asc");
      if (Array.isArray(res)) journalEntries = res;
    }
  } catch (err) {
    logger.warn("Could not query journal_entries for weekly metrics", { error: err.message });
  }

  try {
    const hasTrackerTable = await db.schema.hasTable("email_tracker");
    if (hasTrackerTable) {
      const res = await db("email_tracker")
        .where({ recipient_email: normalizedEmail, status: "success" })
        .where("sent_at", ">=", new Date(Date.now() - 7 * 24 * 60 * 60 * 1000));
      if (Array.isArray(res)) emailDispatches = res;
    }
  } catch (err) {
    logger.warn("Could not query email_tracker for weekly metrics", { error: err.message });
  }

  if (!Array.isArray(journalEntries)) journalEntries = [];
  if (!Array.isArray(emailDispatches)) emailDispatches = [];

  const journalMap = new Map();
  journalEntries.forEach((entry) => journalMap.set(entry.entry_date, entry));

  // Build 7-day completion calendar
  let completedCount = 0;
  const completionCalendar = past7.map((day) => {
    const entry = journalMap.get(day.dateStr);
    const hasJournal = Boolean(entry);
    const hasDispatch = emailDispatches.some((dispatch) => {
      try {
        const dispatchDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(
          new Date(dispatch.sent_at),
        );
        return dispatchDate === day.dateStr;
      } catch (_e) {
        return false;
      }
    });

    const isCompleted = hasJournal || hasDispatch;
    if (isCompleted) completedCount++;

    return {
      date: day.dateStr,
      dayLabel: day.dayLabel,
      completed: isCompleted,
      moodScore: entry?.mood_score || null,
      oneBigThing: entry?.one_big_thing || null,
    };
  });

  // Calculate mood scores
  const scoredEntries = journalEntries.filter(
    (e) => typeof e.mood_score === "number" && e.mood_score >= 1 && e.mood_score <= 5,
  );
  let avgMood;
  let moodTrendLabel;
  let moodSummaryText;

  if (scoredEntries.length > 0) {
    const sum = scoredEntries.reduce((acc, curr) => acc + curr.mood_score, 0);
    avgMood = Number((sum / scoredEntries.length).toFixed(1));

    if (avgMood >= 4.5) {
      moodTrendLabel = "⚡ Peak Flow & Momentum";
      moodSummaryText = `Outstanding consistency! You logged ${scoredEntries.length} reflection(s) at peak energy.`;
    } else if (avgMood >= 3.8) {
      moodTrendLabel = "🚀 Energized & Focused";
      moodSummaryText = `Strong performance across ${scoredEntries.length} reflection sessions this week.`;
    } else if (avgMood >= 2.8) {
      moodTrendLabel = "⚖️ Steady & Balanced";
      moodSummaryText = `Consistent grounding across ${scoredEntries.length} journal sessions.`;
    } else {
      moodTrendLabel = "🌱 Resilient Growth";
      moodSummaryText = `Tough sessions acknowledged. Use Sunday to recharge and recalibrate.`;
    }
  } else {
    avgMood = 4.5;
    moodTrendLabel = "🌟 Ready for Momentum";
    moodSummaryText =
      "Log daily reflections in the Routine companion to populate personalized mindset analytics.";
  }

  // Extract top wins (One Big Thing)
  const topWins = journalEntries
    .filter((e) => e.one_big_thing && e.one_big_thing.trim().length > 0)
    .map((e) => ({
      date: e.entry_date,
      text: e.one_big_thing.trim(),
    }));

  const completionRate = Math.round((completedCount / 7) * 100);

  return {
    completionCalendar,
    completedDaysCount: completedCount,
    completionRate,
    avgMoodScore: avgMood,
    moodTrendLabel,
    moodSummaryText,
    topWins,
    hasWins: topWins.length > 0,
  };
}

/**
 * Builds the data model for the weekly digest template
 */
async function buildWeeklyDigestPayload(subscriber, appLocals = process.env.RENDER_URL) {
  const baseUrl =
    typeof appLocals === "string"
      ? appLocals
      : appLocals?.officialDomain || process.env.RENDER_URL || "http://localhost:2900";

  const timezone = subscriber.timezone || "UTC";
  const email = subscriber.email;
  const trackKey = subscriber.routineTrack || subscriber.templateType || "deep-work";
  const digestInfo = sharedData.getWeeklyDigestContent(trackKey);
  const streakCount = Number(subscriber.streakCount) || 0;
  const streakBadge = streakCount > 0 ? `${streakCount}-Day Streak Active` : "Ignite Your Streak";

  const metrics = await getSubscriberWeeklyMetrics(email, timezone);

  // Generate tailored AI kickoff spark
  const aiSpark = await getDailyMorningSpark({
    email,
    routineTrack: trackKey,
    streakCount,
    timezone,
    name: subscriber.name || email.split("@")[0],
  });

  const checkinToken = generateActionToken(email, "checkin");
  const routineToken = generateActionToken(email, "routine");
  const unsubscribeToken = generateUnsubscribeToken(email);

  return {
    userName: subscriber.name || (email ? email.split("@")[0] : "Subscriber"),
    year: new Intl.DateTimeFormat("en-US", { timeZone: timezone, year: "numeric" }).format(
      new Date(),
    ),
    trackName: digestInfo.name,
    trackBadge: digestInfo.badge,
    streakCount,
    streakBadge,
    streakEncouragement: digestInfo.weeklyEncouragement,
    weeklyQuote: digestInfo.weeklyQuote,
    weeklyPrepItems: digestInfo.weeklyPrepItems,
    completionCalendar: metrics.completionCalendar,
    completedDaysCount: metrics.completedDaysCount,
    completionRate: metrics.completionRate,
    avgMoodScore: metrics.avgMoodScore,
    moodTrendLabel: metrics.moodTrendLabel,
    moodSummaryText: metrics.moodSummaryText,
    topWins: metrics.topWins,
    hasWins: metrics.hasWins,
    aiSparkReflection: aiSpark.sparkReflection,
    aiMicroAction: aiSpark.microAction,
    aiFocusMantra: aiSpark.focusMantra,
    ctaUrl: `${baseUrl}/routine?email=${encodeURIComponent(email)}&token=${routineToken}&source=weekly_digest`,
    checkinUrl: `${baseUrl}/checkin?email=${encodeURIComponent(email)}&token=${checkinToken}&source=weekly_digest`,
    preferencesUrl: `${baseUrl}/user-dashboard`,
    unsubscribeUrl: `${baseUrl}/unsubscribe?email=${encodeURIComponent(email)}&token=${unsubscribeToken}`,
  };
}

/**
 * Compiles and renders the MJML Weekly Digest
 */
async function renderWeeklyDigestHtml(payload) {
  const tpl = getCompiledTemplate();
  if (!tpl) {
    throw new Error("Weekly digest MJML template not found");
  }

  const renderedMjml = tpl(payload);
  const compiler = getMjmlCompiler();
  const mjmlResult = await compiler(renderedMjml, { validationLevel: "strict" });

  if (mjmlResult.errors && mjmlResult.errors.length > 0) {
    logger.error("MJML Weekly Digest syntax errors:", mjmlResult.errors);
  }

  const html = mjmlResult.html || "";
  const text =
    `Weekly Performance & Habit Digest for ${payload.userName}\n\n` +
    `Streak: ${payload.streakBadge}\n` +
    `7-Day Completion: ${payload.completedDaysCount}/7 Days (${payload.completionRate}%)\n` +
    `Average Mood: ${payload.avgMoodScore}/5.0 (${payload.moodTrendLabel})\n\n` +
    `AI Kickoff Spark: "${payload.aiSparkReflection}"\n` +
    `Monday Micro-Action: ${payload.aiMicroAction}\n` +
    `Anchor Mantra: ${payload.aiFocusMantra}\n\n` +
    `Open Live Routine: ${payload.ctaUrl}\n` +
    `Checkin: ${payload.checkinUrl}\n` +
    `Unsubscribe: ${payload.unsubscribeUrl}`;

  return { html, text };
}

/**
 * Dispatches weekly digest to a single subscriber with idempotency and retry backoff
 */
async function sendWeeklyDigestToSubscriber(subscriber, appLocals, options = {}) {
  const email = subscriber.email;
  const force = options.force || options.adminSkip === process.env.ADMIN_SKIP_KEY;

  try {
    // 1. Suppression eligibility check
    const eligibility = await suppressionService.checkPreSendEligibility(email);
    if (eligibility.isSuppressed && !force) {
      logger.warn("Subscriber suppressed, skipping weekly digest", {
        email: maskEmail(email),
        reason: eligibility.reason,
      });
      return { status: "skipped", reason: eligibility.reason };
    }

    // 2. Idempotency check
    const alreadySent = await emailTracker.wasEmailSentToday(
      email,
      "weekly-digest",
      subscriber.timezone,
    );
    if (alreadySent && !force) {
      logger.info("Weekly digest already sent today, skipping.", { email: maskEmail(email) });
      return { status: "skipped", reason: "already_sent_today" };
    }

    // 3. Build payload and render HTML
    const payload = await buildWeeklyDigestPayload(subscriber, appLocals);
    const { html, text } = await renderWeeklyDigestHtml(payload);

    // 4. Dispatch via Nodemailer with retry backoff
    const transporter = getTransporter();
    const messageRef = crypto.randomBytes(8).toString("hex");

    const { result, retries, totalAttempts } = await retryWithBackoff(
      async () => {
        return await transporter.sendMail({
          from: `"Morning Routine Digest" <${process.env.FROM_USER}>`,
          replyTo: `${process.env.FROM_USER}`,
          to: email,
          subject: `🔥 Weekly Performance & Streak Digest • ${payload.streakBadge} 📊`,
          html,
          text,
          headers: {
            "X-Service": "morning-routine-sender",
            "X-Campaign": "weekly-performance-digest",
            "X-Template-Type": "weekly-digest",
            "X-Job-Type": "weekly-digest-email",
            "X-Message-Ref": messageRef,
            "List-Unsubscribe": `<${payload.unsubscribeUrl}>`,
            "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
          },
        });
      },
      {
        maxRetries: 3,
        baseDelayMs: 1500,
        onRetry: async ({ error, attempt, nextDelayMs }) => {
          logger.warn(
            `⚠️ Weekly digest SMTP retry attempt ${attempt} for ${maskEmail(email)}. Waiting ${nextDelayMs}ms...`,
            { error: error.message },
          );
        },
      },
    );

    // 5. Record success in Knex email_tracker
    await emailTracker.recordSend(
      email,
      "weekly-digest",
      result.messageId,
      {
        scheduled: true,
        type: "weekly_digest",
        attempts: totalAttempts,
        recovered: retries > 0,
        completionRate: payload.completionRate,
        avgMood: payload.avgMoodScore,
      },
      retries,
    );

    logger.info("✅ Weekly Digest successfully dispatched", {
      email: maskEmail(email),
      messageId: result.messageId,
      retries,
    });

    return { status: "success", messageId: result.messageId, retries };
  } catch (error) {
    logger.error("❌ Failed to send Weekly Digest", {
      email: maskEmail(email),
      error: error.message,
    });

    await emailTracker.recordFailure(email, "weekly-digest", error, 0, {
      phase: "weekly_digest_dispatch",
      isRetryable: isRetryableError(error),
    });

    return { status: "failed", error: error.message };
  }
}

/**
 * Batch dispatch to all active subscribers
 */
async function dispatchWeeklyDigestBatch(appLocals, options = {}) {
  logger.info("🚀 Starting batch Weekly Performance Digest dispatch...");
  const subscribers = await sharedData.getUsers();

  let sent = 0;
  let skipped = 0;
  let failed = 0;

  for (const subscriber of subscribers) {
    if (!subscriber.isActive && !options.force) {
      skipped++;
      continue;
    }

    const res = await sendWeeklyDigestToSubscriber(subscriber, appLocals, options);
    if (res.status === "success") sent++;
    else if (res.status === "skipped") skipped++;
    else failed++;
  }

  logger.info("🏁 Batch Weekly Digest dispatch finished", {
    total: subscribers.length,
    sent,
    skipped,
    failed,
  });

  return { total: subscribers.length, sent, skipped, failed };
}

module.exports = {
  getPast7Dates,
  getSubscriberWeeklyMetrics,
  buildWeeklyDigestPayload,
  renderWeeklyDigestHtml,
  sendWeeklyDigestToSubscriber,
  dispatchWeeklyDigest: sendWeeklyDigestToSubscriber,
  dispatchWeeklyDigestBatch,
};
