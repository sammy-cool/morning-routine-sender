// helper/shared-data.js
require("dotenv").config();
const logger = require("../logger");
const db = require("../db/knex");

const MAX_CACHE_SIZE = 100;
const cache = new Map();

function updateCache(key, value) {
  if (cache.size >= MAX_CACHE_SIZE && !cache.has(key)) {
    const oldestKey = cache.keys().next().value;
    if (oldestKey) cache.delete(oldestKey);
  }
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
      "Clear your desk, close all messaging apps, open documentation, and enter a dedicated 60-minute Flow State session.",
    ],
    checklist: [
      "Hydrate (500ml water)",
      "Review Today's #1 Priority",
      "Silence Notifications (90 min)",
      "Complete Flow State Sprint",
    ],
    quotes: [
      "Deep work is the ability to focus without distraction on a cognitively demanding task. - Cal Newport",
      "Action is the foundational key to all success. - Pablo Picasso",
      "Simplicity is prerequisite for reliability. - Edsger W. Dijkstra",
      "Focus is a muscle. The more you practice single-tasking, the stronger it becomes.",
    ],
  },
  mindfulness: {
    name: "Mindfulness & Stoic",
    badge: "🧘 Mindfulness & Stoic",
    tagline: "Mental clarity, breathwork & emotional resilience",
    rituals: [
      "Practice 4-7-8 Box Breathing for 3 minutes before checking your phone or reading emails.",
      "Write down 3 specific moments or people you are genuinely grateful for this morning.",
      "Stoic Reflection: Identify one external factor outside your control today and consciously choose equanimity.",
      "Take a mindful 5-minute silent morning walk with zero digital inputs or earbuds.",
    ],
    checklist: [
      "3-Min Box Breathing",
      "Gratitude Journaling (3 items)",
      "Stoic Equanimity Check",
      "Mindful Morning Walk",
    ],
    quotes: [
      "You have power over your mind - not outside events. Realize this, and you will find strength. - Marcus Aurelius",
      "We suffer more often in imagination than in reality. - Seneca",
      "Peace comes from within. Do not seek it without. - Buddha",
      "Almost everything will work again if you unplug it for a few minutes, including you. - Anne Lamott",
    ],
  },
  executive: {
    name: "High-Performance Executive",
    badge: "💼 High-Performance Executive",
    tagline: "Strategic leverage, energy management & decisive execution",
    rituals: [
      "Define your 3 Non-Negotiable High-Leverage Outcomes for today before touching reactive messages.",
      "Prime your physical energy: drink 500ml water, complete 2 minutes of mobility stretches, and review your top quarterly goal.",
      "Audit your calendar: Eliminate, delegate, or shorten at least one low-value meeting today.",
      "Perform a 2-minute decision audit: What is the single highest-leverage decision you need to make today?",
    ],
    checklist: [
      "Drink 500ml Water & Stretch",
      "Define 3 Non-Negotiables",
      "Calendar Optimization Audit",
      "Top Strategic Goal Review",
    ],
    quotes: [
      "The key is not to prioritize what's on your schedule, but to schedule your priorities. - Stephen Covey",
      "Focusing on the vital few rather than the trivial many is how extraordinary results are achieved.",
      "Discipline equals freedom. - Jocko Willink",
      "Your time is limited, don't waste it living someone else's life. - Steve Jobs",
    ],
  },
  learning: {
    name: "Lifelong Learner",
    badge: "📚 Lifelong Learner",
    tagline: "Mental models, active recall & rapid knowledge synthesis",
    rituals: [
      "Active Recall: Teach yesterday's new concept out loud in 60 seconds as if explaining to a 10-year-old (Feynman Technique).",
      "Read 10 pages of a non-fiction or engineering book before opening social media.",
      "Identify one mental model (e.g. First Principles, Inversion, Pareto) and apply it to a current challenge.",
      "Note down one intriguing thesis or question to explore deeply during your break.",
    ],
    checklist: [
      "60-Sec Feynman Recall",
      "Read 10 Book Pages",
      "Apply 1 Mental Model",
      "Capture 1 Curiosity Note",
    ],
    quotes: [
      "Live as if you were to die tomorrow. Learn as if you were to live forever. - Mahatma Gandhi",
      "An investment in knowledge pays the best interest. - Benjamin Franklin",
      "The beautiful thing about learning is that no one can take it away from you. - B.B. King",
      "In a world of constant change, the learners will inherit the earth.",
    ],
  },
  classic: {
    name: "Morning Energizer",
    badge: "🌅 Morning Energizer",
    tagline: "Daily momentum, positive intention & energized mornings",
    rituals: [
      "Hydrate with 500ml water, get natural sunlight in your eyes for 5 minutes, and set a positive intention.",
      "Do 20 jumping jacks or a brisk stretch to wake up your nervous system and increase blood flow.",
      "Write down your single proudest intention for how you want to show up today.",
      "Take 3 deep breaths, smile, and commit to making today 1% better than yesterday.",
    ],
    checklist: [
      "Hydrate & Sunlight (5 min)",
      "Quick Physical Activation",
      "Set Proud Intention",
      "3 Deep Breaths & Smile",
    ],
    quotes: [
      "The secret of your future is hidden in your daily routine. - Mike Murdock",
      "Every morning we are born again. What we do today is what matters most. - Buddha",
      "Rise and shine with intentionality and joy.",
      "Today is full of unlimited possibilities. Make it count.",
    ],
  },
  career: {
    name: "Career & Executive Growth",
    badge: "💼 Career & Executive Growth",
    tagline: "Strategic leverage, professional mastery & high-impact leadership",
    rituals: [
      "Identify your highest-leverage career deliverable and block uninterrupted morning focus.",
      "Review your top quarterly career objectives and align today's priorities accordingly.",
      "Prepare key communication points for today's high-stakes discussions.",
      "Dedicate 15 minutes to deliberate skill refinement and industry mastery.",
    ],
    checklist: [
      "Review Top Career Milestone",
      "Plan High-Impact Deliverables",
      "Streamline Calendar Commitments",
      "Execute Focused Deep Sprint",
    ],
    quotes: [
      "The best way to predict the future is to create it. - Peter Drucker",
      "Opportunities don't happen, you create them. - Chris Grosser",
      "Continuous learning is the minimum requirement for success in any field. - Brian Tracy",
      "Focus on being productive instead of busy. - Tim Ferriss",
    ],
  },
  reflection: {
    name: "Evening & Daily Reflection",
    badge: "🌙 Daily Reflection & Wind-Down",
    tagline: "Thoughtful self-review, gratitude & intentional closure",
    rituals: [
      "Record your top 3 wins and personal breakthroughs from today.",
      "Reflect on one lesson learned and how you can apply it tomorrow.",
      "Write down 3 moments of gratitude before disconnecting for the evening.",
      "Organize your workspace and set your top priority for tomorrow morning.",
    ],
    checklist: [
      "Log Daily Wins & Progress",
      "Record 1 Key Lesson Learned",
      "Evening Gratitude Journaling",
      "Prepare Tomorrow's #1 Focus",
    ],
    quotes: [
      "We do not learn from experience... we learn from reflecting on experience. - John Dewey",
      "Reflect upon your present blessings, of which every man has many. - Charles Dickens",
      "Self-reflection is the gateway to intentional living and mastery.",
      "Close the day with a grateful heart and a clear mind.",
    ],
  },
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
  maxRetries = 10,
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
  let streakFreezes = subscriber.streakFreezes !== undefined ? Number(subscriber.streakFreezes) : 2;
  const freezeHistory = Array.isArray(subscriber.freezeHistory)
    ? [...subscriber.freezeHistory]
    : [];

  if (lastCheckin === todayStr) {
    return {
      success: true,
      email,
      streak: currentStreak,
      streakCount: currentStreak,
      alreadyCheckedInToday: true,
      today: todayStr,
      streakFreezes,
      freezeUsed: false,
    };
  }

  let newStreak = 1;
  let freezeUsed = false;

  if (lastCheckin === yesterdayStr) {
    newStreak = currentStreak + 1;
  } else if (lastCheckin) {
    const dLast = new Date(lastCheckin + "T00:00:00Z");
    const dToday = new Date(todayStr + "T00:00:00Z");
    const diffDays = Math.round((dToday - dLast) / (24 * 60 * 60 * 1000));

    if (diffDays === 2 && streakFreezes > 0) {
      streakFreezes -= 1;
      freezeUsed = true;
      newStreak = currentStreak + 1;
      freezeHistory.push({
        date: yesterdayStr,
        usedAt: new Date().toISOString(),
        reason: "auto-freeze-gap",
      });
      logger.info("🛡️ Streak freeze auto-consumed to preserve streak", {
        email,
        missedDate: yesterdayStr,
        freezesRemaining: streakFreezes,
        preservedStreak: newStreak,
      });
    } else {
      newStreak = 1;
    }
  }

  try {
    await db("subscribers")
      .where("email", email)
      .update({
        streak_count: newStreak,
        last_checkin_date: todayStr,
        streak_freezes: streakFreezes,
        freeze_history: JSON.stringify(freezeHistory),
        updated_at: db.fn.now(),
      });

    logger.info("🔥 Streak checkin recorded", {
      email,
      newStreak,
      todayStr,
      freezeUsed,
      streakFreezes,
    });
    return {
      success: true,
      email,
      streak: newStreak,
      streakCount: newStreak,
      alreadyCheckedInToday: false,
      isNewStreak: newStreak > 1,
      today: todayStr,
      freezeUsed,
      streakFreezes,
      freezeHistory,
      shieldBadge: freezeUsed ? "🛡️ Streak Shield Saved Your Streak!" : undefined,
    };
  } catch (err) {
    logger.error("Error recording checkin", { error: err.message, email });
    return {
      success: true,
      email,
      streak: newStreak,
      streakCount: newStreak,
      alreadyCheckedInToday: false,
      today: todayStr,
      freezeUsed,
      streakFreezes,
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
        "routine_track as routineTrack",
      );
    logger.info(`📋 Found ${rows.length} active subscribers`);
    return rows.map((r) => ({
      ...r,
      isActive: r.isActive !== false && r.isActive !== 0 && r.isActive !== "false",
      streakCount: Number(r.streakCount) || 0,
      routineTrack: r.routineTrack || r.templateType || "deep-work",
    }));
  } catch (_err) {
    // Fallback if migration hasn't run yet
    const rows = await db("subscribers")
      .where("is_active", true)
      .select(
        "email",
        "template_type as templateType",
        "cron_pattern as cronPattern",
        "timezone",
        "is_active as isActive",
      );
    return rows.map((r) => ({
      ...r,
      isActive: r.isActive !== false && r.isActive !== 0 && r.isActive !== "false",
      streakCount: 0,
      routineTrack: r.templateType || "deep-work",
    }));
  }
}

const userExtensionsCache = new Map();

/**
 * Retrieve dynamic subscriber extensions (custom habits, custom focus duration)
 */
async function getUserExtensions(email) {
  if (!email) return {};
  const cleanEmail = String(email).toLowerCase().trim();
  if (userExtensionsCache.has(cleanEmail)) {
    return userExtensionsCache.get(cleanEmail);
  }
  try {
    const redis = require("../config/redisClient");
    const raw = await redis.get(`subscriber:ext:${cleanEmail}`);
    if (raw) {
      const parsed = JSON.parse(raw);
      userExtensionsCache.set(cleanEmail, parsed);
      return parsed;
    }
  } catch (_err) {
    // Redis unavailable fallback
  }
  return {};
}

/**
 * Persist dynamic subscriber extensions
 */
async function saveUserExtensions(email, extensions) {
  if (!email) return;
  const cleanEmail = String(email).toLowerCase().trim();
  const existing = await getUserExtensions(cleanEmail);
  const updated = { ...existing, ...extensions };
  userExtensionsCache.set(cleanEmail, updated);
  try {
    const redis = require("../config/redisClient");
    await redis.set(`subscriber:ext:${cleanEmail}`, JSON.stringify(updated));
  } catch (_err) {
    // Redis unavailable fallback
  }
}

/**
 * Get subscriber by email
 */
async function getUserByEmail(email) {
  email = email?.toLowerCase().trim();
  const ext = await getUserExtensions(email);
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
        "routine_track as routineTrack",
        "coach_persona as coachPersona",
        "discord_webhook_url as discordWebhookUrl",
        "telegram_chat_id as telegramChatId",
        "channels_enabled as channelsEnabled",
        "webhook_endpoint_url as webhookEndpointUrl",
        "webhook_secret as webhookSecret",
        "webhook_enabled as webhookEnabled",
        "streak_freezes as streakFreezes",
        "freeze_history as freezeHistory",
      )
      .first();
    if (!row) return null;

    let parsedFreezeHistory = [];
    try {
      parsedFreezeHistory =
        typeof row.freezeHistory === "string"
          ? JSON.parse(row.freezeHistory || "[]")
          : row.freezeHistory || [];
    } catch (_e) {
      parsedFreezeHistory = [];
    }

    return {
      ...row,
      ...ext,
      focusDurationMinutes: Number(ext.focusDurationMinutes) || 25,
      customHabits: Array.isArray(ext.customHabits) ? ext.customHabits : [],
      isActive: row.isActive !== false && row.isActive !== 0 && row.isActive !== "false",
      streakCount: Number(row.streakCount) || 0,
      streakFreezes:
        row.streakFreezes !== undefined && row.streakFreezes !== null
          ? Number(row.streakFreezes)
          : 2,
      freezeHistory: parsedFreezeHistory,
      routineTrack: row.routineTrack || row.templateType || "deep-work",
      coachPersona: row.coachPersona || "stoic",
      channelsEnabled: row.channelsEnabled || "email",
      webhookEnabled: Boolean(row.webhookEnabled),
    };
  } catch (_err) {
    const row = await db("subscribers")
      .where("email", email)
      .select(
        "email",
        "template_type as templateType",
        "cron_pattern as cronPattern",
        "timezone",
        "is_active as isActive",
      )
      .first();
    if (!row) return null;
    return {
      ...row,
      ...ext,
      focusDurationMinutes: Number(ext.focusDurationMinutes) || 25,
      customHabits: Array.isArray(ext.customHabits) ? ext.customHabits : [],
      isActive: row.isActive !== false && row.isActive !== 0 && row.isActive !== "false",
      streakCount: 0,
      streakFreezes: 2,
      freezeHistory: [],
      routineTrack: row.templateType || "deep-work",
      coachPersona: "stoic",
      channelsEnabled: "email",
      webhookEnabled: false,
    };
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
      coach_persona: user.coachPersona || "stoic",
      streak_freezes: user.streakFreezes !== undefined ? user.streakFreezes : 2,
      freeze_history: JSON.stringify(user.freezeHistory || []),
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
        logger.error(`Error adding user ${user.email}`, { error: inner.message });
        throw inner;
      }
    }
    logger.error(`Error adding user ${user.email}`, { error: error.message });
    throw error;
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
  if (updates.coachPersona !== undefined) patch.coach_persona = updates.coachPersona;
  if (updates.discordWebhookUrl !== undefined)
    patch.discord_webhook_url = updates.discordWebhookUrl;
  if (updates.telegramChatId !== undefined) patch.telegram_chat_id = updates.telegramChatId;
  if (updates.channelsEnabled !== undefined) {
    patch.channels_enabled = Array.isArray(updates.channelsEnabled)
      ? updates.channelsEnabled.join(",")
      : updates.channelsEnabled;
  }
  if (updates.webhookEndpointUrl !== undefined)
    patch.webhook_endpoint_url = updates.webhookEndpointUrl;
  if (updates.webhookSecret !== undefined) patch.webhook_secret = updates.webhookSecret;
  if (updates.webhookEnabled !== undefined) patch.webhook_enabled = updates.webhookEnabled;
  if (updates.streakFreezes !== undefined) patch.streak_freezes = updates.streakFreezes;
  if (updates.freezeHistory !== undefined) {
    patch.freeze_history =
      typeof updates.freezeHistory === "string"
        ? updates.freezeHistory
        : JSON.stringify(updates.freezeHistory);
  }

  if (updates.focusDurationMinutes !== undefined || updates.customHabits !== undefined) {
    await saveUserExtensions(email, {
      ...(updates.focusDurationMinutes !== undefined
        ? { focusDurationMinutes: Number(updates.focusDurationMinutes) }
        : {}),
      ...(updates.customHabits !== undefined ? { customHabits: updates.customHabits } : {}),
    });
  }

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
      delete patch.coach_persona;
      delete patch.discord_webhook_url;
      delete patch.telegram_chat_id;
      delete patch.channels_enabled;
      delete patch.webhook_endpoint_url;
      delete patch.webhook_secret;
      delete patch.webhook_enabled;
      delete patch.streak_freezes;
      delete patch.freeze_history;
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
        "coach_persona as coachPersona",
        "created_at as createdAt",
      )
      .orderBy("created_at", "desc");
  } catch (_err) {
    return await db("subscribers")
      .select(
        "id",
        "email",
        "template_type as templateType",
        "cron_pattern as cronPattern",
        "timezone",
        "is_active as isActive",
        "created_at as createdAt",
      )
      .orderBy("created_at", "desc");
  }
}

const WEEKLY_DIGEST_CONFIGS = {
  "deep-work": {
    reflection:
      "Review the code, architectures, and features built over the past 7 days. Where did context switching steal the most momentum?",
    prepItems: [
      {
        title: "Identify Monday's Single #1 Deliverable",
        description:
          "Define the core technical outcome you will complete during your first 90-minute block.",
      },
      {
        title: "Calendar Defense Audit",
        description:
          "Protect your prime morning hours (08:00 - 11:00) by declining or rescheduling non-essential check-ins.",
      },
      {
        title: "Tidy Workspace & Tools",
        description:
          "Commit any lingering branches, clean your desktop, and stage your IDE for instant morning flow.",
      },
    ],
    encouragement:
      "Consistency in deep work compounds exponentially. You're building world-class engineering focus.",
  },
  mindfulness: {
    reflection:
      "Look back at the week's highest pressure moments. Where were you able to respond with equanimity instead of reacting with stress?",
    prepItems: [
      {
        title: "Set a Gentle Week Tone",
        description:
          "Choose one overarching virtue for the week (e.g. Patience, Clarity, Presence).",
      },
      {
        title: "Digital Sunset Sunday",
        description:
          "Power down screens 60 minutes before bed tonight to prime deep restorative sleep.",
      },
      {
        title: "Plan 3 Mindful Micro-Breaks",
        description:
          "Schedule three 5-minute calendar pauses throughout the week for intentional breathwork.",
      },
    ],
    encouragement: "Inner peace is not an accident—it's a daily discipline you are mastering.",
  },
  executive: {
    reflection:
      "Audit your high-leverage vs low-leverage hours this week. What meetings or recurring tasks should be eliminated or delegated?",
    prepItems: [
      {
        title: "Define the 3 Macro Outcomes",
        description:
          "Lock down the top 3 needle-moving strategic deliverables for your team/business this week.",
      },
      {
        title: "Meeting Pruning",
        description:
          "Shorten 30-min meetings to 20-min and 60-min meetings to 45-min across your calendar.",
      },
      {
        title: "Energy & Recovery Review",
        description: "Schedule non-negotiable slots for workout, nutrition, and deep sleep.",
      },
    ],
    encouragement:
      "High performers don't manage time; they manage energy and focus on the vital few.",
  },
  learning: {
    reflection:
      "Which key mental model or concept created the biggest breakthrough in your thinking this week?",
    prepItems: [
      {
        title: "Queue This Week's Reading",
        description:
          "Select 1 primary book chapter or technical paper to read in morning 15-minute bursts.",
      },
      {
        title: "Active Recall Synthesis",
        description:
          "Write a 3-bullet summary of your biggest lesson learned from the past 7 days.",
      },
      {
        title: "Weekly Curiosity Question",
        description: "Formulate one compelling question you aim to answer by Friday.",
      },
    ],
    encouragement: "Continuous daily learning creates an unbeatable competitive advantage.",
  },
  classic: {
    reflection:
      "Celebrate your wins from the past week and acknowledge how far your morning consistency has brought you!",
    prepItems: [
      {
        title: "Prepare Your Morning Launchpad",
        description:
          "Set out workout clothes, fill your water bottle, and write tomorrow's top 3 tasks.",
      },
      {
        title: "Set Your Wake-Up Intent",
        description:
          "Visualize waking up refreshed, energized, and ready to conquer Monday morning.",
      },
      {
        title: "Positive Sunday Affirmation",
        description: "Commit to bringing energy, positivity, and enthusiasm into the new week.",
      },
    ],
    encouragement:
      "Every great week starts with an intentional Sunday evening and energized morning!",
  },
  career: {
    reflection:
      "Review your high-stakes career conversations and professional milestones from this past week. Where did you create maximum strategic leverage?",
    prepItems: [
      {
        title: "Identify Top Career Milestone for the Week",
        description:
          "Define the single most impactful project deliverable that elevates your visibility and leadership.",
      },
      {
        title: "Stakeholder Alignment Check",
        description:
          "Map key stakeholders you need to proactively update or sync with before Wednesday.",
      },
      {
        title: "Block 3 Skill Mastery Sessions",
        description:
          "Reserve 20 minutes on Monday, Wednesday, and Friday for deliberate skill refinement.",
      },
    ],
    encouragement:
      "Professional mastery is forged through relentless daily intentionality and high-leverage execution.",
  },
  reflection: {
    reflection:
      "Look back at your wins, lessons learned, and moments of gratitude over the last 7 days. How did self-awareness shape your decisions?",
    prepItems: [
      {
        title: "Set Weekly Gratitude Theme",
        description:
          "Choose an anchor value (e.g., Compassion, Humility, Stillness) to guide your evening reviews.",
      },
      {
        title: "Reset Physical & Mental Space",
        description:
          "Clean your workspace and journal entry queue to enter Monday with zero mental baggage.",
      },
      {
        title: "Schedule Sunday Wind-Down",
        description:
          "Commit to powering down all electronic devices 60 minutes before bedtime tonight.",
      },
    ],
    encouragement:
      "Reflection turns experience into insight, and insight into compounding personal growth.",
  },
};

function getWeeklyDigestContent(trackKey = "deep-work") {
  const normalized = (trackKey || "deep-work").toLowerCase().trim();
  const baseTrack = getTrackContent(normalized);
  const digestConfig = WEEKLY_DIGEST_CONFIGS[normalized] || WEEKLY_DIGEST_CONFIGS["deep-work"];
  return {
    ...baseTrack,
    weeklyReflectionGuidance: digestConfig.reflection,
    weeklyPrepItems: digestConfig.prepItems,
    weeklyEncouragement: digestConfig.encouragement,
    weeklyQuote: baseTrack.quote,
  };
}

module.exports = {
  cache,
  updateCache,
  getCacheValue,
  getNewRandomQuote,
  TRACK_CONFIGS,
  WEEKLY_DIGEST_CONFIGS,
  getTrackContent,
  getWeeklyDigestContent,
  recordCheckin,
  getUsers,
  getUserByEmail,
  addUser,
  removeUser,
  updateUser,
  setUserActive,
  getAllUsers,
  getUserExtensions,
  saveUserExtensions,
};
