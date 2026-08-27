// shared-data.js
const fs = require("fs");
const path = require("path");
const logger = require("../logger");

let cache = new Map();

function updateCache(key, value) {
  cache.set(key, value);
}

function getCacheValue(key) {
  return cache.get(key);
}

async function getNewRandomQuote(
  lastSentQuote = getCacheValue("lastSentQuote") || "",
  maxRetries = 10
) {
  try {
    const quotes = [
      "Rise and shine.",
      "Smile, it's a new day.",
      "You got this.",
      "Happiness is a choice.",
      "Today is full of possibilities.",
      "Make today amazing.",
      "Embrace the new day with a smile.",
      "Start fresh, stay positive.",
      "You are capable of great things.",
      "New day, new opportunities.",
      "Believe in yourself and all that you are.",
      "The future is yours to create.",
      "Every day is a chance to be better.",
      "Let your light shine bright.",
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
    throw error;
  }
}

// Function to fetch a quote from FavQs API
async function getDailyQuote() {
  try {
    const response = await fetch("https://favqs.com/api/qotd");
    if (!response.ok) {
      throw new Error(`HTTP error ${response.status}`);
    }
    const data = await response.json();
    return data.quote.body + " - " + data.quote.author;
  } catch (error) {
    logger.warn("Error fetching daily quote from FavQs API, using fallback", {
      error: error.message || error,
    });
    return "Make today amazing and full of possibilities.";
  }
}

// 1. Choose a routine based on the day
function getRoutineType() {
  const day = new Date().getDay(); // 0 = Sunday, 1 = Monday, ...
  const map = {
    1: "email-template",
    2: "routine-deep-work",
    3: "routine-learning",
    4: "routine-mindfulness",
    5: "routine-career",
    6: "routine-reflection",
    0: "routine-default",
  };
  return map[day] || "email-template";
}

async function getEmailHtmlTemplateAndUpdate(unsubscribeLink) {
  // Email Template Changes before sending it!
  const emailTemplatePath = path.join(__dirname, '..', 'email-templates', `${getRoutineType()}.html`);
  let emailTemplate = fs.readFileSync(emailTemplatePath, "utf8");

  const htmlTemplateQuote = await getDailyQuote();
  const daysOfWeek = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const currentDay = daysOfWeek[new Date().getDay()];
  const themes = {
    Monday: {
      gradient: "linear-gradient(135deg, #FF0000, #FFD700)", // Red to gold
      themeMessage: "Motivational Start!",
    },
    Tuesday: {
      gradient: "linear-gradient(135deg, #6DD5FA, #2980B9, #1E90FF)", // Sky blue, deep blue
      themeMessage: "Energizing Vibes!",
    },
    Wednesday: {
      gradient: "linear-gradient(135deg, #000000, #FFFFFF)", // Black to white
      themeMessage: "Midweek Boost!",
    },
    Thursday: {
      gradient: "linear-gradient(135deg, #FFA500, #FFD700, #FFFF00)", // Pure orange, pure golden, pure yellow
      themeMessage: "Positive Momentum!",
    },
    Friday: {
      gradient: "linear-gradient(135deg, #FF5722, #FF9800, #FFC107)", // Vibrant oranges and yellow
      themeMessage: "Finish Strong!",
    },
    Saturday: {
      gradient: "linear-gradient(135deg, #20B2AA, #3CB371, #2E8B57)", // Teal, medium green
      themeMessage: "Relax & Reflect!",
    },
    Sunday: {
      gradient: "linear-gradient(135deg, #FFD700, #FFC107, #FFB600)", // Gold, golden yellow
      themeMessage: "Prepare & Plan!",
    },
  };
  const { gradient, themeMessage } = themes[currentDay];
  emailTemplate = emailTemplate.replaceAll("header_footer_gradient", gradient);
  emailTemplate = emailTemplate.replace("{{currentDay}}", currentDay);
  emailTemplate = emailTemplate.replace("{{themeMessage}}", themeMessage);
  emailTemplate = emailTemplate.replace("{{dailyQuotes}}", htmlTemplateQuote);
  emailTemplate = emailTemplate.replace("{{unsubscribeLink}}", unsubscribeLink);

  return emailTemplate;
}

// helper/shared-data.js
require("dotenv").config();
const db = require("../db/knex");
const logger = require("../logger");

/**
 * Subscriber management, backed by the `subscribers` table
 * (see db/migrations/20260711172620_create_subscribers_table.js).
 *
 * Previously this was a hardcoded array of real email addresses committed
 * directly to source control (a real exposure, given this repo is public).
 * addUser/removeUser/updateUser existed before too, but only mutated an
 * in-memory array -- never actually called from anywhere. This replaces
 * all five with DB-backed versions, same function names so callers
 * (emailScheduler.js) only need `await` added, not a rewrite.
 *
 * getUsers() is now async -- this is a real, necessary signature change
 * from the in-memory version. Every call site was checked and updated.
 */

/**
 * Get all active subscribers
 * @returns {Promise<Array>} Array of subscriber objects
 */
async function getUsers() {
  const rows = await db("subscribers")
    .where("is_active", true)
    .select("email", "template_type as templateType", "cron_pattern as cronPattern", "timezone", "is_active as isActive");
  logger.info(`📋 Found ${rows.length} active subscribers`);
  return rows;
}

/**
 * Get subscriber by email
 * @param {string} email
 * @returns {Promise<object|null>}
 */
async function getUserByEmail(email) {
  email = email?.toLowerCase().trim();
  const row = await db("subscribers")
    .where("email", email)
    .select("email", "template_type as templateType", "cron_pattern as cronPattern", "timezone", "is_active as isActive")
    .first();
  return row || null;
}

/**
 * Add a new subscriber
 * @param {object} user - { email, templateType, cronPattern, timezone }
 * @returns {Promise<{created: boolean, email: string}>}
 */
async function addUser(user) {
  try {
    await db("subscribers").insert({
      email: user.email,
      template_type: user.templateType || "basic",
      cron_pattern: user.cronPattern || "0 8 * * *",
      timezone: user.timezone || "Asia/Kolkata",
      is_active: true,
    });
    logger.info(`✅ Subscriber added: ${user.email}`);
    return { created: true, email: user.email };
  } catch (error) {
    logger.warn(`⚠️  Subscriber already exists: ${user.email}`);
    return { created: false, email: user.email };
  }
}

/**
 * Permanently remove a subscriber
 * @param {string} email
 * @returns {Promise<boolean>} true if a row was deleted
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
 * Update subscriber preferences (template, cron pattern, timezone).
 * For pausing/resuming, use setUserActive() instead -- kept separate so
 * the intent (pause vs. edit) is explicit at the call site.
 * @param {string} email
 * @param {object} updates - any of { templateType, cronPattern, timezone }
 * @returns {Promise<boolean>} true if a row was updated
 */
async function updateUser(email, updates) {
  email = email?.toLowerCase().trim();
  const patch = { updated_at: db.fn.now() };
  if (updates.templateType !== undefined) patch.template_type = updates.templateType;
  if (updates.cronPattern !== undefined) patch.cron_pattern = updates.cronPattern;
  if (updates.timezone !== undefined) patch.timezone = updates.timezone;

  const updated = await db("subscribers").where("email", email).update(patch);
  if (updated) {
    logger.info(`✏️  Subscriber updated: ${email}`);
  }
  return updated > 0;
}

/**
 * Pause or resume a subscriber without deleting their record.
 * @param {string} email
 * @param {boolean} isActive
 * @returns {Promise<boolean>} true if a row was updated
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
 * Get every subscriber regardless of active status -- for the admin UI,
 * which needs to show paused subscribers too, not just active ones.
 * @returns {Promise<Array>}
 */
async function getAllUsers() {
  return db("subscribers")
    .select("id", "email", "template_type as templateType", "cron_pattern as cronPattern", "timezone", "is_active as isActive", "created_at as createdAt")
    .orderBy("created_at", "desc");
}

module.exports = {
  cache,
  updateCache,
  getCacheValue,
  getNewRandomQuote,
  getEmailHtmlTemplateAndUpdate,
  getUsers,
  getUserByEmail,
  addUser,
  removeUser,
  updateUser,
  setUserActive,
  getAllUsers,
};

