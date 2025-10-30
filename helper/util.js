const crypto = require("node:crypto");
const logger = require("../logger");

function generateRandomMessageID() {
  const timestamp = Date.now().toString();
  const randomString = generateRandomString(10);
  const hash = crypto
    .createHash("sha256")
    .update(timestamp + randomString)
    .digest("hex");
  return hash.slice(0, 20);
}

function generateRandomString(length) {
  const characters =
    "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
  let randomString = "";

  for (let i = 0; i < length; i++) {
    const randomIndex = Math.floor(Math.random() * characters.length);
    randomString += characters.charAt(randomIndex);
  }

  return randomString;
}

function maskEmail(email) {
  const [local, domain] = email.split("@");
  const maskedLocal =
    local[0] + "*".repeat(Math.max(local.length - 2, 1)) + local.slice(-1);
  return `${maskedLocal}@${domain}`;
}

function todayUTCYYYYMMDD() {
  const d = new Date();
  const yyyy = d.getUTCFullYear();
  const mm = String(d.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(d.getUTCDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

async function dailyDevNews() {
  const params = {
    api_token: process.env.NEWS_API_KEY,
    categories: "technology,science,developer,space",
    limit: "1",
    language: "en",
    keywords: "dev,tech,space,science",
  };

  const esc = encodeURIComponent;
  const query = Object.keys(params)
    .map((k) => `${esc(k)}=${esc(params[k])}`)
    .join("&");

  try {
    const response = await fetch(
      `https://api.thenewsapi.com/v1/news/all?${query}`,
      {
        method: "GET",
      }
    );

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    const json = await response.json();
    const article = json?.data?.[0];

    if (!article) {
      logger.warn("⚠️ No news articles found for today.");
      return null;
    }

    const result = [
      {
        title: article.title,
        description: article.description,
        url: article.url,
        published_at: article.published_at,
        source: article.source,
      },
    ];

    logger.info("✅ Daily Dev News:", { todayNews: result[0].title });
    return result;
  } catch (error) {
    logger.error("❌ Error fetching daily dev news:", error);
    return null;
  }
}

module.exports = {
  generateRandomMessageID,
  maskEmail,
  todayUTCYYYYMMDD,
  dailyDevNews,
};
