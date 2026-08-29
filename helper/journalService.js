// helper/journalService.js
const db = require("../db/knex");
const logger = require("../logger");
const sharedData = require("./shared-data");

/**
 * Normalizes email address
 */
function normalizeEmail(email) {
  return (email || "").toLowerCase().trim();
}

/**
 * Gets today's date in subscriber's timezone (YYYY-MM-DD)
 */
function getTodayDateInTimezone(timezone = "UTC") {
  try {
    return new Intl.DateTimeFormat("en-CA", { timeZone: timezone }).format(new Date());
  } catch (_err) {
    return new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
  }
}

/**
 * Retrieves subscriber context and resolved date
 */
async function getSubscriberContext(email, requestedDate = null) {
  const normalizedEmail = normalizeEmail(email);
  const subscriber = await sharedData.getUserByEmail(normalizedEmail);
  const timezone = subscriber?.timezone || "UTC";
  const trackKey = subscriber?.routineTrack || subscriber?.templateType || "deep-work";

  const date =
    requestedDate && /^\d{4}-\d{2}-\d{2}$/.test(requestedDate)
      ? requestedDate
      : getTodayDateInTimezone(timezone);

  return {
    subscriber,
    timezone,
    trackKey,
    date,
  };
}

/**
 * Loads a single journal entry for a given subscriber and date
 */
async function getEntryByDate(email, date) {
  const normalizedEmail = normalizeEmail(email);
  try {
    const row = await db("journal_entries")
      .where({
        subscriber_email: normalizedEmail,
        entry_date: date,
      })
      .first();

    return row || null;
  } catch (error) {
    logger.error("Failed to load journal entry by date", {
      email: normalizedEmail,
      date,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Upserts a journal entry for a subscriber on a given date
 */
async function saveEntry(email, data = {}) {
  const normalizedEmail = normalizeEmail(email);
  const { subscriber, trackKey, date } = await getSubscriberContext(
    normalizedEmail,
    data.entry_date || data.entryDate,
  );

  let moodScore = null;
  if (data.mood_score !== undefined && data.mood_score !== null && data.mood_score !== "") {
    const parsed = parseInt(data.mood_score, 10);
    if (isNaN(parsed) || parsed < 1 || parsed > 5) {
      throw new Error("mood_score must be an integer between 1 and 5");
    }
    moodScore = parsed;
  }

  let subscriberId = null;
  if (subscriber?.id) {
    subscriberId = subscriber.id;
  } else {
    try {
      const subRow = await db("subscribers").where({ email: normalizedEmail }).select("id").first();
      if (subRow) subscriberId = subRow.id;
    } catch (_err) {
      // Ignore if table schema lookup fails
    }
  }

  const record = {
    subscriber_id: subscriberId,
    subscriber_email: normalizedEmail,
    entry_date: date,
    track_key: (data.track_key || data.trackKey || trackKey || "deep-work").trim(),
    one_big_thing:
      data.one_big_thing !== undefined
        ? data.one_big_thing
        : data.oneBigThing !== undefined
          ? data.oneBigThing
          : null,
    gratitude: data.gratitude !== undefined ? data.gratitude : null,
    reflection_text:
      data.reflection_text !== undefined
        ? data.reflection_text
        : data.reflectionText !== undefined
          ? data.reflectionText
          : data.reflection !== undefined
            ? data.reflection
            : null,
    mood_score: moodScore,
    updated_at: new Date(),
  };

  try {
    const existing = await db("journal_entries")
      .where({ subscriber_email: normalizedEmail, entry_date: date })
      .first();

    if (existing) {
      await db("journal_entries")
        .where({ subscriber_email: normalizedEmail, entry_date: date })
        .update(record);
      logger.info("Updated existing journal entry", { email: normalizedEmail, date });
    } else {
      record.created_at = new Date();
      await db("journal_entries").insert(record);
      logger.info("Created new journal entry", { email: normalizedEmail, date });
    }

    const saved = await db("journal_entries")
      .where({ subscriber_email: normalizedEmail, entry_date: date })
      .first();

    return saved;
  } catch (error) {
    logger.error("Failed to save journal entry", {
      email: normalizedEmail,
      date,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Loads recent journal history (default 30 entries)
 */
async function getHistory(email, limit = 30, offset = 0) {
  const normalizedEmail = normalizeEmail(email);
  const parsedLimit = Math.min(Math.max(parseInt(limit, 10) || 30, 1), 100);
  const parsedOffset = Math.max(parseInt(offset, 10) || 0, 0);

  try {
    const rows = await db("journal_entries")
      .where({ subscriber_email: normalizedEmail })
      .orderBy("entry_date", "desc")
      .orderBy("created_at", "desc")
      .limit(parsedLimit)
      .offset(parsedOffset);

    return rows;
  } catch (error) {
    logger.error("Failed to load journal history", {
      email: normalizedEmail,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Loads all journal entries for export
 */
async function getAllEntries(email) {
  const normalizedEmail = normalizeEmail(email);
  try {
    return await db("journal_entries")
      .where({ subscriber_email: normalizedEmail })
      .orderBy("entry_date", "desc")
      .orderBy("created_at", "desc");
  } catch (error) {
    logger.error("Failed to export all journal entries", {
      email: normalizedEmail,
      error: error.message,
    });
    throw error;
  }
}

/**
 * Generates formatted Markdown journal export
 */
function generateMarkdownExport(email, entries = [], subscriber = null) {
  const todayStr = new Date().toISOString().split("T")[0];
  const streak = subscriber?.streakCount || 0;
  const track = subscriber?.routineTrack || subscriber?.templateType || "deep-work";
  const timezone = subscriber?.timezone || "UTC";

  let md = "# 🌅 Morning Reflection & Journal Archive\n\n";
  md += `* **Subscriber:** \`${email}\`\n`;
  md += `* **Active Persona Track:** \`${track}\`\n`;
  md += `* **Current Habit Streak:** 🔥 **${streak} Days**\n`;
  md += `* **Timezone:** \`${timezone}\`\n`;
  md += `* **Total Entries:** **${entries.length}**\n`;
  md += `* **Export Date:** ${todayStr}\n\n`;
  md += "---\n\n";

  if (!entries || entries.length === 0) {
    md +=
      "*No journal entries recorded yet. Begin your morning reflection ritual to populate your personal log!*\n";
    return md;
  }

  const scoredEntries = entries.filter((e) => typeof e.mood_score === "number" && e.mood_score > 0);
  if (scoredEntries.length > 0) {
    const avgMood = (
      scoredEntries.reduce((sum, e) => sum + e.mood_score, 0) / scoredEntries.length
    ).toFixed(1);
    md += `> **📊 Reflection Insights:** Average Mood: **${avgMood} / 5.0** across ${scoredEntries.length} logged sessions.\n\n---\n\n`;
  }

  md += "## 📜 Reflection Logs\n\n";

  const moodEmojis = {
    1: "😫 Challenging (1/5)",
    2: "😕 Low Energy (2/5)",
    3: "😐 Steady / Balanced (3/5)",
    4: "🙂 Energized & Focused (4/5)",
    5: "⚡ Peak Flow & Momentum (5/5)",
  };

  entries.forEach((entry, idx) => {
    const entryNum = entries.length - idx;
    md += `### #${entryNum} • 📅 ${entry.entry_date} (${entry.track_key || track})\n\n`;

    if (entry.mood_score) {
      const moodLabel = moodEmojis[entry.mood_score] || `${entry.mood_score}/5`;
      md += `* **Mindset & Mood:** ${moodLabel}\n`;
    }
    if (entry.created_at) {
      md += `* **Logged At:** ${new Date(entry.created_at).toUTCString()}\n`;
    }
    md += "\n";

    if (entry.one_big_thing) {
      md += "#### 🎯 One Big Thing (Top Priority)\n";
      md += `${entry.one_big_thing.trim()}\n\n`;
    }

    if (entry.gratitude) {
      md += "#### 🙏 Gratitude & Appreciation\n";
      md += `${entry.gratitude.trim()}\n\n`;
    }

    if (entry.reflection_text) {
      md += "#### 💭 Morning Mindset & Reflection Notes\n";
      md += `${entry.reflection_text.trim()}\n\n`;
    }

    md += "---\n\n";
  });

  return md;
}

module.exports = {
  normalizeEmail,
  getTodayDateInTimezone,
  getSubscriberContext,
  getEntryByDate,
  saveEntry,
  getHistory,
  getAllEntries,
  generateMarkdownExport,
};
