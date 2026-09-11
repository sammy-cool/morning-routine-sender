// controllers/analytics.controller.js
const db = require("../db/knex");
const sharedData = require("../helper/shared-data");
const logger = require("../logger");

/**
 * GET /api/me/analytics
 * Retrieve comprehensive habit performance, day-of-week consistency, and time-of-day insights
 */
async function getSubscriberAnalytics(req, res) {
  const email = (
    req.subscriber?.email ||
    req.subscriberEmail ||
    req.user?.email ||
    (typeof req.query?.email === "string" ? req.query.email : null) ||
    ""
  )
    .trim()
    .toLowerCase();

  if (!email) {
    return res.status(401).json({ success: false, error: "Authentication required" });
  }

  try {
    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ success: false, error: "Subscriber not found" });
    }

    const tz = subscriber.timezone || "UTC";

    // 1. Fetch all journal entries for this subscriber
    const entries = await db("journal_entries")
      .where("subscriber_email", email)
      .orderBy("entry_date", "desc");

    const currentStreak = Number(subscriber.streakCount) || 0;
    const streakFreezes = Number(subscriber.streakFreezes) || 0;
    const freezeHistory = Array.isArray(subscriber.freezeHistory) ? subscriber.freezeHistory : [];

    // Calculate 7-day and 30-day date boundaries in subscriber's timezone
    const now = new Date();
    const dates7 = [];
    const dates30 = [];

    for (let i = 0; i < 7; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dates7.push(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d));
    }
    for (let i = 0; i < 30; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      dates30.push(new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d));
    }

    const entryDateSet = new Set(entries.map((e) => e.entry_date));
    // Include last_checkin_date
    if (subscriber.lastCheckinDate) {
      entryDateSet.add(subscriber.lastCheckinDate);
    }

    const checkinsLast7 = dates7.filter((d) => entryDateSet.has(d)).length;
    const rate7 = Math.round((checkinsLast7 / 7) * 100);

    const checkinsLast30 = dates30.filter((d) => entryDateSet.has(d)).length;
    const rate30 = Math.round((checkinsLast30 / 30) * 100);

    // 2. Day-of-week consistency (Mon, Tue, Wed, Thu, Fri, Sat, Sun)
    const dayCounts = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };
    const dayTotals = { Mon: 0, Tue: 0, Wed: 0, Thu: 0, Fri: 0, Sat: 0, Sun: 0 };

    // Examine past 4 weeks (28 days)
    for (let i = 0; i < 28; i++) {
      const d = new Date(now.getTime() - i * 24 * 60 * 60 * 1000);
      const dayName = new Intl.DateTimeFormat("en-US", {
        weekday: "short",
        timeZone: tz,
      }).format(d);
      const dateStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(d);

      if (dayTotals[dayName] !== undefined) {
        dayTotals[dayName]++;
        if (entryDateSet.has(dateStr)) {
          dayCounts[dayName]++;
        }
      }
    }

    const weekdayBreakdown = Object.keys(dayCounts).map((day) => {
      const total = dayTotals[day] || 4;
      const count = dayCounts[day] || 0;
      return {
        day,
        completed: count,
        total,
        percentage: Math.round((count / total) * 100),
      };
    });

    // 3. Time-of-day distribution based on journal entry creation timestamps
    const timeOfDay = {
      earlyBird: 0, // 05:00 - 06:59
      primeFocus: 0, // 07:00 - 08:59
      midMorning: 0, // 09:00 - 11:59
      afternoonEvening: 0, // 12:00+
    };

    entries.forEach((e) => {
      if (e.created_at) {
        const entryDate = new Date(e.created_at);
        const hour = Number(
          new Intl.DateTimeFormat("en-US", {
            hour: "numeric",
            hour12: false,
            timeZone: tz,
          }).format(entryDate),
        );

        if (hour >= 5 && hour < 7) timeOfDay.earlyBird++;
        else if (hour >= 7 && hour < 9) timeOfDay.primeFocus++;
        else if (hour >= 9 && hour < 12) timeOfDay.midMorning++;
        else timeOfDay.afternoonEvening++;
      }
    });

    // Determine peak habit window
    let peakWindow = "07:00 AM - 09:00 AM";
    let maxBucket = timeOfDay.primeFocus;
    if (timeOfDay.earlyBird > maxBucket) {
      peakWindow = "05:00 AM - 07:00 AM";
      maxBucket = timeOfDay.earlyBird;
    }
    if (timeOfDay.midMorning > maxBucket) {
      peakWindow = "09:00 AM - 12:00 PM";
      maxBucket = timeOfDay.midMorning;
    }

    // 4. Mood and Focus Metrics
    const moodScores = entries
      .filter((e) => typeof e.mood_score === "number" && e.mood_score >= 1)
      .map((e) => e.mood_score);
    const avgMood =
      moodScores.length > 0
        ? Number((moodScores.reduce((a, b) => a + b, 0) / moodScores.length).toFixed(1))
        : 4.8;

    return res.json({
      success: true,
      analytics: {
        currentStreak,
        streakFreezes,
        freezeUsedCount: freezeHistory.filter((f) => f.reason === "auto-freeze-gap").length,
        completionRate7d: rate7,
        completionRate30d: rate30,
        totalEntriesLogged: entries.length,
        avgMoodScore: avgMood,
        peakFocusWindow: peakWindow,
        weekdayBreakdown,
        timeOfDayDistribution: {
          earlyBird: timeOfDay.earlyBird,
          primeFocus: timeOfDay.primeFocus,
          midMorning: timeOfDay.midMorning,
          afternoonEvening: timeOfDay.afternoonEvening,
        },
      },
    });
  } catch (err) {
    logger.error("Error generating subscriber analytics", { error: err.message, email });
    return res.status(500).json({
      success: false,
      error: "Unable to generate analytics. Please try again.",
    });
  }
}

module.exports = {
  getSubscriberAnalytics,
};
