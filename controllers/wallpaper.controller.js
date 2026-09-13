/**
 * controllers/wallpaper.controller.js
 * Dynamic 9:16 Mobile Wallpaper Controller
 * Morning Routine Sender
 */

const sharedData = require("../helper/shared-data");
const { generateWallpaperSvg } = require("../helper/wallpaperGenerator");
const { getWeatherSpark } = require("../helper/weatherSpark");
const { verifyActionToken, verifyCalendarToken } = require("../helper/unsubscribeToken");
const logger = require("../logger");

/**
 * Resolves or extracts quote and author from track config or subscriber extensions
 */
function resolveQuoteAndAuthor(subscriber, trackKey, queryQuote, queryAuthor) {
  if (queryQuote) {
    return {
      quote: queryQuote,
      author: queryAuthor || "Daily Stoic",
    };
  }

  if (subscriber?.customQuote) {
    const parts = subscriber.customQuote.split(/\s*—\s*|\s*-\s*/);
    return {
      quote: parts[0] || subscriber.customQuote,
      author: parts[1] || queryAuthor || "Personal Routine",
    };
  }

  const trackContent = sharedData.getTrackContent(trackKey);
  const trackQuote =
    trackContent?.quote || "Action is the foundational key to all success. — Pablo Picasso";
  const parts = trackQuote.split(/\s*—\s*|\s*-\s*/);
  return {
    quote: parts[0] || trackQuote,
    author: parts[1] || "Daily Focus",
  };
}

/**
 * Resolves subscriber record from email, handle, or token
 */
async function resolveSubscriber(identifier) {
  if (!identifier || typeof identifier !== "string") return null;
  let cleanId = identifier
    .trim()
    .toLowerCase()
    .replace(/\.svg$/, "");

  const isHandle = cleanId.startsWith("@");
  if (isHandle) {
    cleanId = cleanId.slice(1);
  }

  // 1. Direct Email lookup (if not a pure handle and contains @)
  if (!isHandle && cleanId.includes("@")) {
    try {
      const user = await sharedData.getUserByEmail(cleanId);
      if (user) return user;
    } catch (_e) {
      // Database not available or subscriber not found
    }
  }

  // 2. Handle / username prefix search in Knex
  try {
    const db = require("../db/knex");
    const row = await db("subscribers")
      .where("email", cleanId)
      .orWhere("email", "like", `${cleanId}@%`)
      .first();

    if (row && row.email) {
      try {
        const user = await sharedData.getUserByEmail(row.email);
        if (user) return user;
      } catch (_e) {
        return row;
      }
    }
  } catch (err) {
    logger.warn("Wallpaper handle lookup database error", { identifier, error: err.message });
  }

  return null;
}

/**
 * Verifies wallpaper token (base64url email:hmac or calendar token or Redis session)
 */
async function resolveEmailFromToken(tokenParam) {
  if (!tokenParam || typeof tokenParam !== "string") return null;
  const cleanToken = tokenParam.trim().replace(/\.svg$/, "");

  // 1. Check custom wallpaper token base64url(email:hmac)
  try {
    const decoded = Buffer.from(cleanToken, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      const email = decoded.slice(0, colonIdx);
      const hmac = decoded.slice(colonIdx + 1);
      if (
        email &&
        hmac &&
        (verifyActionToken(email, hmac, "wallpaper") || verifyActionToken(email, hmac, "routine"))
      ) {
        return email;
      }
    }
  } catch (_e) {
    // Continue to next check
  }

  // 2. Check calendar webcal token fallback
  const calEmail = verifyCalendarToken(cleanToken);
  if (calEmail) return calEmail;

  // 3. Check Redis session
  try {
    const redis = require("../config/redisClient");
    const sessionEmail = await redis.get(`subscriber_session:${cleanToken}`).catch(() => null);
    if (sessionEmail) return sessionEmail;
  } catch (_e) {
    // Redis unavailable fallback
  }

  return null;
}

/**
 * Helper to fetch verified lifetime check-ins count
 */
async function getLifetimeCheckins(email, streakCount = 1) {
  if (!email) return Math.max(Number(streakCount) || 1, 1);
  try {
    const db = require("../db/knex");
    const [{ count }] = await db("journal_entries")
      .where("subscriber_email", email.toLowerCase().trim())
      .count("* as count");
    return Math.max(Number(count) || 0, Number(streakCount) || 1);
  } catch (_e) {
    return Math.max(Number(streakCount) || 1, 1);
  }
}

/**
 * GET /wallpaper/:handleOrEmail & GET /wallpaper
 */
async function getWallpaper(req, res) {
  try {
    const identifier =
      req.params.handleOrEmail || req.query.email || req.query.handle || req.subscriberEmail;
    const subscriber = await resolveSubscriber(identifier);

    const track =
      subscriber?.routineTrack || subscriber?.templateType || req.query.track || "deep-work";
    const streak = req.query.streak ? Number(req.query.streak) : (subscriber?.streakCount ?? 1);

    const lifetimeCheckins = req.query.checkins
      ? Number(req.query.checkins)
      : await getLifetimeCheckins(subscriber?.email, streak);

    const city = req.query.city || subscriber?.locationCity || "New Delhi";
    const tz = subscriber?.timezone || "UTC";
    const weatherResult = getWeatherSpark(city, tz, new Date());
    const weatherSparkFormatted = weatherResult
      ? `${weatherResult.tempC}°C • ${weatherResult.condition} in ${weatherResult.city}`
      : `${req.query.weather || "24°C • Clear Skies in " + city}`;

    const { quote, author } = resolveQuoteAndAuthor(
      subscriber,
      track,
      req.query.quote,
      req.query.author,
    );

    let habits = subscriber?.customHabits;
    if (req.query.habits) {
      habits = req.query.habits.split(",").map((h) => h.trim());
    }

    const name = subscriber?.email
      ? subscriber.email.split("@")[0]
      : req.query.name ||
        (identifier ? identifier.replace(/^@/, "").split("@")[0] : "Morning Builder");

    const svg = generateWallpaperSvg({
      name,
      streak,
      track,
      weatherSpark: weatherSparkFormatted,
      quote,
      author,
      habits,
      lifetimeCheckins,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    );

    if (req.query.download === "true" || req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-routine-wallpaper-${streak}-days.svg"`,
      );
    }

    return res.send(svg);
  } catch (error) {
    logger.error("Failed to render dynamic mobile wallpaper", {
      error: error.message,
      stack: error.stack,
    });
    res
      .status(500)
      .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
      .send(
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <rect width="1080" height="1920" fill="#050608"/>
        <text x="540" y="960" fill="#f43f5e" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="32" font-weight="700">Failed to render mobile wallpaper</text>
      </svg>`,
      );
  }
}

/**
 * GET /api/wallpaper/:token.svg & GET /api/wallpaper/:token
 */
async function getWallpaperByToken(req, res) {
  try {
    const token = req.params.token;
    const verifiedEmail = await resolveEmailFromToken(token);

    if (!verifiedEmail) {
      return res
        .status(401)
        .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
        .send(
          `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
          <rect width="1080" height="1920" fill="#050608"/>
          <text x="540" y="960" fill="#f43f5e" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="30" font-weight="700">Invalid or Expired Wallpaper Token</text>
        </svg>`,
        );
    }

    req.params.handleOrEmail = verifiedEmail;
    return getWallpaper(req, res);
  } catch (error) {
    logger.error("Failed to render wallpaper by token", { error: error.message });
    return res
      .status(500)
      .setHeader("Content-Type", "image/svg+xml; charset=utf-8")
      .send(
        `<svg width="1080" height="1920" viewBox="0 0 1080 1920" xmlns="http://www.w3.org/2000/svg">
        <rect width="1080" height="1920" fill="#050608"/>
        <text x="540" y="960" fill="#f43f5e" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="30" font-weight="700">Internal Wallpaper Error</text>
      </svg>`,
      );
  }
}

/**
 * GET /me/wallpaper.svg & GET /me/wallpaper (Authenticated subscriber session)
 */
async function getMyWallpaper(req, res) {
  try {
    const email = req.subscriberEmail || req.subscriber?.email;
    if (!email) {
      return res.status(401).json({ error: "Subscriber authentication required" });
    }
    req.params.handleOrEmail = email;
    return getWallpaper(req, res);
  } catch (error) {
    logger.error("Failed to serve authenticated wallpaper", { error: error.message });
    return res.status(500).json({ error: "Failed to render wallpaper" });
  }
}

module.exports = {
  getWallpaper,
  getWallpaperByToken,
  getMyWallpaper,
  resolveSubscriber,
  resolveEmailFromToken,
  resolveQuoteAndAuthor,
  getLifetimeCheckins,
};
