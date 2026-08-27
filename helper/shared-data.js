// helper/shared-data.js
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const logger = require("../logger");
const db = require("../db/knex");

let cache = new Map();

function updateCache(key, value) {
  cache.set(key, value);
}

function getCacheValue(key) {
  return cache.get(key);
}

const TRACK_CONFIGS = {
  "deep-work": {
    name: "Deep Work & Builder",
    badge: "⚡ Deep Work & Builder",
    tagline: "High-focus engineering rituals & distraction-free flow states",
    rituals: [
      "Select your #1 most critical architecture or coding deliverable. Silence all alerts for a 90-minute Deep Work sprint.",
      "Apply the 5-Minute Rule: Dive straight into your hardest engineering problem for 5 minutes without context switching.",
      "Review yesterday's git commits, map today's 3 core technical outcomes, and block out uninterrupted morning momentum.",
      "Clear your desk, close all messaging apps, open documentation, and enter a dedicated 60-minute Flow State session."
    ],
    checklist: [
      "Hydrate (500ml water)",
      "Review Today's #1 Priority",
      "Silence Notifications (90 min)",
      "Complete Flow State Sprint"
    ],
    quotes: [
      "Deep work is the ability to focus without distraction on a cognitively demanding task. - Cal Newport",
      "Action is the foundational key to all success. - Pablo Picasso",
      "Simplicity is prerequisite for reliability. - Edsger W. Dijkstra",
      "Focus is a muscle. The more you practice single-tasking, the stronger it becomes."
    ]
  },
  "mindfulness": {
    name: "Mindfulness & Stoic",
    badge: "🧘 Mindfulness & Stoic",
    tagline: "Mental clarity, breathwork & emotional resilience",
    rituals: [
      "Practice 4-7-8 Box Breathing for 3 minutes before checking your phone or reading emails.",
      "Write down 3 specific moments or people you are genuinely grateful for this morning.",
      "Stoic Reflection: Identify one external factor outside your control today and consciously choose equanimity.",
      "Take a mindful 5-minute silent morning walk with zero digital inputs or earbuds."
    ],
    checklist: [
      "3-Min Box Breathing",
      "Gratitude Journaling (3 items)",
      "Stoic Equanimity Check",
      "Mindful Morning Walk"
    ],
    quotes: [
      "You have power over your mind - not outside events. Realize this, and you will find strength. - Marcus Aurelius",
      "We suffer more often in imagination than in reality. - Seneca",
      "Peace comes from within. Do not seek it without. - Buddha",
      "Almost everything will work again if you unplug it for a few minutes, including you. - Anne Lamott"
    ]
  },
  "executive": {
    name: "High-Performance Executive",
    badge: "💼 High-Performance Executive",
    tagline: "Strategic leverage, energy management & decisive execution",
    rituals: [
      "Define your 3 Non-Negotiable High-Leverage Outcomes for today before touching reactive messages.",
      "Prime your physical energy: drink 500ml water, complete 2 minutes of mobility stretches, and review your top quarterly goal.",
      "Audit your calendar: Eliminate, delegate, or shorten at least one low-value meeting today.",
      "Perform a 2-minute decision audit: What is the single highest-leverage decision you need to make today?"
    ],
    checklist: [
      "Drink 500ml Water & Stretch",
      "Define 3 Non-Negotiables",
      "Calendar Optimization Audit",
      "Top Strategic Goal Review"
    ],
    quotes: [
      "The key is not to prioritize what's on your schedule, but to schedule your priorities. - Stephen Covey",
      "Focusing on the vital few rather than the trivial many is how extraordinary results are achieved.",
      "Discipline equals freedom. - Jocko Willink",
      "Your time is limited, don't waste it living someone else's life. - Steve Jobs"
    ]
  },
  "learning": {
    name: "Lifelong Learner",
    badge: "📚 Lifelong Learner",
    tagline: "Mental models, active recall & rapid knowledge synthesis",
    rituals: [
      "Active Recall: Teach yesterday's new concept out loud in 60 seconds as if explaining to a 10-year-old (Feynman Technique).",
      "Read 10 pages of a non-fiction or engineering book before opening social media.",
      "Identify one mental model (e.g. First Principles, Inversion, Pareto) and apply it to a current challenge.",
      "Note down one intriguing thesis or question to explore deeply during your break."
    ],
    checklist: [
      "60-Sec Feynman Recall",
      "Read 10 Book Pages",
      "Apply 1 Mental Model",
      "Capture 1 Curiosity Note"
    ],
    quotes: [
      "Live as if you were to die tomorrow. Learn as if you were to live forever. - Mahatma Gandhi",
      "An investment in knowledge pays the best interest. - Benjamin Franklin",
      "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
      "In a world of constant change, the learners will inherit the earth."
    ]
  },
  "classic": {
    name: "Morning Energizer",
    badge: "🌅 Morning Energizer",
    tagline: "Daily momentum, positive intention & energized mornings",
    rituals: [
      "Hydrate with 500ml water, get natural sunlight in your eyes for 5 minutes, and set a positive intention.",
      "Do 20 jumping jacks or a brisk stretch to wake up your nervous system and increase blood flow.",
      "Write down your single proudest intention for how you want to show up today.",
      "Take 3 deep breaths, smile, and commit to making today 1% better than yesterday."
    ],
    checklist: [
      "Hydrate & Sunlight (5 min)",
      "Quick Physical Activation",
      "Set Proud Intention",
      "3 Deep Breaths & Smile"
    ],
    quotes: [
      "The secret of your future is hidden in your daily routine. - Mike Murdock",
      "Every morning we are born again. What we do today is what matters most. - Buddha",
      "Rise and shine with intentionality and joy.",
      "Today is full of unlimited possibilities. Make it count."
    ]
  }
};

function getTrackContent(trackKey = "deep-work") {
  const normalized = (trackKey || "deep-work").toLowerCase().trim();
  const config = TRACK_CONFIGS[normalized] || TRACK_CONFIGS["deep-work"];
  
  const ritualIndex = Math.floor(Math.random() * config.rituals.length);
  const quoteIndex = Math.floor(Math.random() * config.quotes.length);

  return {
    track: normalized,
    name: config.name,
    badge: config.badge,
    tagline: config.tagline,
    ritual: config.rituals[ritualIndex],
    quote: config.quotes[quoteIndex],
    checklist: config.checklist,
  };
}

async function getNewRandomQuote(
  lastSentQuote = getCacheValue("lastSentQuote") || "",
  maxRetries = 10
) {
  try {
    const quotes = [
      "The secret of your future is hidden in your daily routine. - Mike Murdock",
      "You have power over your mind - not outside events. Realize this, and you will find strength. - Marcus Aurelius",
      "Deep work is the ability to focus without distraction on a cognitively demanding task. - Cal Newport",
      "Action is the foundational key to all success. - Pablo Picasso",
      "Simplicity is prerequisite for reliability. - Edsger W. Dijkstra",
      "Focus is a muscle. The more you practice single-tasking, the stronger it becomes.",
      "Discipline equals freedom. - Jocko Willink",
      "We suffer more often in imagination than in reality. - Seneca",
      "Live as if you were to die tomorrow. Learn as if you were to live forever. - Mahatma Gandhi",
      "Today is full of possibilities. Make it count.",
    ];
    const randomIndex = Math.floor(Math.random() * quotes.length);
    const randomQuote = quotes[randomIndex];

    if (randomQuote === lastSentQuote && maxRetries > 0) {
      return getNewRandomQuote(lastSentQuote, maxRetries - 1);
    }

    updateCache("lastSentQuote", randomQuote);
    return randomQuote;
  } catch (error) {
    logger.error("Error getting new random quote", { error: error.message || error });
    return "The secret of your future is hidden in your daily routine.";
  }
}

/**
 * Record a streak check-in for a subscriber
 */
async function recordCheckin(email, timezone = "UTC") {
  email = (email || "").toLowerCase().trim();
  const subscriber = await getUserByEmail(email);
  if (!subscriber) {
    return { success: false, error: "Subscriber not found" };
  }

  const tz = subscriber.timezone || timezone || "UTC";
  const now = new Date();
  
  // Format today's and yesterday's dates in subscriber timezone
  const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(now); // YYYY-MM-DD
  
  const yesterdayDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
  const yesterdayStr = new Intl.DateTimeFormat("en-CA", { timeZone: tz }).format(yesterdayDate);

  const lastCheckin = subscriber.lastCheckinDate;
  const currentStreak = Number(subscriber.streakCount) || 0;

  if (lastCheckin === todayStr) {
    return {
      success: true,
      email,
      streak: currentStreak,
      alreadyCheckedInToday: true,
      today: todayStr,
    };
  }

  let newStreak = 1;
  if (lastCheckin === yesterdayStr) {
    newStreak = currentStreak + 1;
  } else if (!lastCheckin) {
    newStreak = 1;
  } else {
    // Check if yesterday was missed
    newStreak = 1;
  }

  try {
    await db("subscribers")
      .where("email", email)
      .update({
        streak_count: newStreak,
        last_checkin_date: todayStr,
        updated_at: db.fn.now(),
      });

    logger.info("🔥 Streak checkin recorded", { email, newStreak, todayStr });
    return {
      success: true,
      email,
      streak: newStreak,
      alreadyCheckedInToday: false,
      isNewStreak: newStreak > 1,
      today: todayStr,
    };
  } catch (err) {
    logger.error("Error recording checkin", { error: err.message, email });
    return {
      success: true,
      email,
      streak: newStreak,
      alreadyCheckedInToday: false,
      today: todayStr,
    };
  }
}

/**
 * Get all active subscribers
 */
async function getUsers() {
  try {
    const rows = await db("subscribers")
      .where("is_active", true)
      .select(
        "email",
        "template_type as templateType",
        "cron_pattern as cronPattern",
        "timezone",
        "is_active as isActive",
        "streak_count as streakCount",
        "last_checkin_date as lastCheckinDate",
        "routine_track as routineTrack"
      );
    logger.info(`📋 Found ${rows.length} active subscribers`);
    return rows;
  } catch (err) {
    // Fallback if migration hasn't run yet
    const rows = await db("subscribers")
      .where("is_active", true)
      .select("email", "template_type as templateType", "cron_pattern as cronPattern", "timezone", "is_active as isActive");
    return rows.map((r) => ({ ...r, streakCount: 0, routineTrack: r.templateType || "deep-work" }));
  }
}

/**
 * Get subscriber by email
 */
async function getUserByEmail(email) {
  email = email?.toLowerCase().trim();
  try {
    const row = await db("subscribers")
      .where("email", email)
      .select(
        "email",
        "template_type as templateType",
        "cron_pattern as cronPattern",
        "timezone",
        "is_active as isActive",
        "streak_count as streakCount",
        "last_checkin_date as lastCheckinDate",
        "routine_track as routineTrack"
      )
      .first();
    return row || null;
  } catch (err) {
    const row = await db("subscribers")
      .where("email", email)
      .select("email", "template_type as templateType", "cron_pattern as cronPattern", "timezone", "is_active as isActive")
      .first();
    if (!row) return null;
    return { ...row, streakCount: 0, routineTrack: row.templateType || "deep-work" };
  }
}

/**
 * Add a new subscriber
 */
async function addUser(user) {
  try {
    const track = user.routineTrack || user.templateType || "deep-work";
    await db("subscribers").insert({
      email: user.email,
      template_type: user.templateType || track || "basic",
      cron_pattern: user.cronPattern || "0 8 * * *",
      timezone: user.timezone || "Asia/Kolkata",
      is_active: true,
      routine_track: track,
      streak_count: user.streakCount || 0,
    });
    logger.info(`✅ Subscriber added: ${user.email}`);
    return { created: true, email: user.email };
  } catch (error) {
    // Retry without new columns if table not migrated yet
    if (error.message && error.message.includes("column")) {
      try {
        await db("subscribers").insert({
          email: user.email,
          template_type: user.templateType || "basic",
          cron_pattern: user.cronPattern || "0 8 * * *",
          timezone: user.timezone || "Asia/Kolkata",
          is_active: true,
        });
        return { created: true, email: user.email };
      } catch (inner) {
        return { created: false, email: user.email };
      }
    }
    logger.warn(`⚠️  Subscriber already exists: ${user.email}`);
    return { created: false, email: user.email };
  }
}

/**
 * Permanently remove a subscriber
 */
async function removeUser(email) {
  email = email?.toLowerCase().trim();
  const deleted = await db("subscribers").where("email", email).del();
  if (deleted) {
    logger.info(`🗑️  Subscriber removed: ${email}`);
  }
  return deleted > 0;
}

/**
 * Update subscriber preferences
 */
async function updateUser(email, updates) {
  email = email?.toLowerCase().trim();
  const patch = { updated_at: db.fn.now() };
  if (updates.templateType !== undefined) patch.template_type = updates.templateType;
  if (updates.cronPattern !== undefined) patch.cron_pattern = updates.cronPattern;
  if (updates.timezone !== undefined) patch.timezone = updates.timezone;
  if (updates.routineTrack !== undefined) {
    patch.routine_track = updates.routineTrack;
    if (updates.templateType === undefined) patch.template_type = updates.routineTrack;
  }
  if (updates.streakCount !== undefined) patch.streak_count = updates.streakCount;
  if (updates.lastCheckinDate !== undefined) patch.last_checkin_date = updates.lastCheckinDate;

  try {
    const updated = await db("subscribers").where("email", email).update(patch);
    if (updated) {
      logger.info(`✏️  Subscriber updated: ${email}`);
    }
    return updated > 0;
  } catch (err) {
    if (err.message && err.message.includes("column")) {
      delete patch.routine_track;
      delete patch.streak_count;
      delete patch.last_checkin_date;
      const updated = await db("subscribers").where("email", email).update(patch);
      return updated > 0;
    }
    throw err;
  }
}

/**
 * Pause or resume a subscriber
 */
async function setUserActive(email, isActive) {
  email = email?.toLowerCase().trim();
  const updated = await db("subscribers")
    .where("email", email)
    .update({ is_active: isActive, updated_at: db.fn.now() });
  if (updated) {
    logger.info(`${isActive ? "▶️  Resumed" : "⏸️  Paused"} subscriber: ${email}`);
  }
  return updated > 0;
}

/**
 * Get every subscriber
 */
async function getAllUsers() {
  try {
    return await db("subscribers")
      .select(
        "id",
        "email",
        "template_type as templateType",
        "cron_pattern as cronPattern",
        "timezone",
        "is_active as isActive",
        "streak_count as streakCount",
        "last_checkin_date as lastCheckinDate",
        "routine_track as routineTrack",
        "created_at as createdAt"
      )
      .orderBy("created_at", "desc");
  } catch (err) {
    return await db("subscribers")
      .select("id", "email", "template_type as templateType", "cron_pattern as cronPattern", "timezone", "is_active as isActive", "created_at as createdAt")
      .orderBy("created_at", "desc");
  }
}

module.exports = {
  cache,
  updateCache,
  getCacheValue,
  getNewRandomQuote,
  TRACK_CONFIGS,
  getTrackContent,
  recordCheckin,
  getUsers,
  getUserByEmail,
  addUser,
  removeUser,
  updateUser,
  setUserActive,
  getAllUsers,
};
