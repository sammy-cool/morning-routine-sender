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

async function getEmailHtmlTemplateAndUpdate() {
  // Email Template Changes before sending it!
  const folderName = "email-html-template";
  const emailTemplatePath = path.join(folderName, "email-template.html");
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
  emailTemplate = emailTemplate.replace("${{currentDay}}", currentDay);
  emailTemplate = emailTemplate.replace("${{themeMessage}}", themeMessage);
  emailTemplate = emailTemplate.replace("${{dailyQuotes}}", htmlTemplateQuote);

  return emailTemplate;
}

module.exports = {
  cache,
  updateCache,
  getCacheValue,
  getNewRandomQuote,
  getEmailHtmlTemplateAndUpdate,
};
