// shared-data.js
const fs = require("fs");
const path = require("path");
const axios = require("axios");

let cache = new Map();

function updateCache(key, value) {
  cache.set(key, value);
}

function getCacheValue(key) {
  return cache.get(key);
}

async function getNewRandomQuote(
  lastSentQuote = getCacheValue("lastSentQuote") || ""
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

    if (randomQuote === lastSentQuote) {
      return getNewRandomQuote();
    }

    updateCache("lastSentQuote", randomQuote);
    return randomQuote;
  } catch (error) {
    console.log("Error getting new random quote:", error);
    throw error;
  }
}

// Function to fetch a quote from FavQs API
async function getDailyQuote() {
  try {
    const response = await axios.get("https://favqs.com/api/qotd");
    return response.data.quote.body + " - " + response.data.quote.author;
  } catch (error) {
    console.error("Error fetching quote:", error);
    throw error;
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
  const __dirname = "email-html-template";
  const emailTemplatePath = path.join(__dirname, `${getRoutineType()}.html`);
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

module.exports = {
  cache,
  updateCache,
  getCacheValue,
  getNewRandomQuote,
  getEmailHtmlTemplateAndUpdate,
};

// helper/shared-data.js
require("dotenv").config();

/**
 * Shared data for users and their routine preferences
 * In production, this should come from a database
 */
const USERS = [
  {
    email: process.env.TEST_EMAIL || "test@example.com",
    templateType: "basic",
    cronPattern: "0 8 * * *", // 8 AM daily
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  // Add more test users if needed
  {
    email: process.env.TEST_EMAIL_2 || "test2@example.com",
    templateType: "basic",
    cronPattern: "30 7 * * *", // 7:30 AM daily
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: "lordsmobile.007ishq@gmail.com",
    templateType: "basic",
    cronPattern: "30 7 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: "lordsmobile.999ishq@gmail.com",
    templateType: "basic",
    cronPattern: "0 7 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: "ishqyt007@gmail.com",
    templateType: "basic",
    cronPattern: "30 6 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
];

/**
 * Get all active users
 * @returns {Array} Array of user objects
 */
function getUsers() {
  const activeUsers = USERS.filter((user) => user.isActive !== false);
  console.log(`📋 Found ${activeUsers.length} active users in shared data`);
  return activeUsers;
}

/**
 * Get user by email
 * @param {string} email - User email
 * @returns {object|null} User object or null
 */
function getUserByEmail(email) {
  return USERS.find((user) => user.email === email) || null;
}

/**
 * Add new user (in-memory for now)
 * @param {object} user - User object
 */
function addUser(user) {
  const userExists = USERS.find(
    (u) => u.email.toLowerCase() === user.email.toLowerCase()
  );

  if (userExists) {
    console.log(`⚠️  User already exists: ${user.email}`);
    return;
  }

  USERS.push({
    email: user.email,
    templateType: user.templateType || "basic",
    cronPattern: user.cronPattern || "0 8 * * *",
    timezone: user.timezone || "Asia/Kolkata",
    isActive: true,
  });
  console.log(`✅ User added: ${user.email}`);
}

/**
 * Remove user
 * @param {string} email - User email
 */
function removeUser(email) {
  const index = USERS.findIndex((u) => u.email === email);
  if (index > -1) {
    USERS.splice(index, 1);
    console.log(`🗑️  User removed: ${email}`);
  }
}

/**
 * Update user preferences
 * @param {string} email - User email
 * @param {object} updates - Updates to apply
 */
function updateUser(email, updates) {
  const user = USERS.find((u) => u.email === email);
  if (user) {
    Object.assign(user, updates);
    console.log(`✏️  User updated: ${email}`);
  }
}

module.exports = {
  getUsers,
  getUserByEmail,
  addUser,
  removeUser,
  updateUser,
  USERS, // Export for direct access if needed
};
