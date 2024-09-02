// shared-data.js
const crypto = require("crypto");
let cache = new Map();

function updateCache(key, value) {
  cache.set(key, value);
}

function getCacheValue(key) {
  console.log("key", key);
  console.log("cache", cache);
  return cache.get(key);
}

function getNewRandomQuote(lastSentQuote = getCacheValue("lastSentQuote") || "") {
  const quotes = [
    "Rise and shine.",
    "Smile, it's a new day.",
    "You got this.",
    "Happiness is a choice.",
  ];
  const randomIndex = Math.floor(Math.random() * quotes.length);
  const randomQuote = quotes[randomIndex];

  if (randomQuote === lastSentQuote) {
    return getNewRandomQuote();
  }

  updateCache("lastSentQuote", randomQuote);
  return randomQuote;
}

module.exports = { updateCache, getCacheValue, getNewRandomQuote, cache };
