// controllers/briefing.controller.js
const sharedData = require("../helper/shared-data");
const { getCuratedSpark } = require("../helper/curatedSparks");
const { verifyCalendarToken, verifyActionToken } = require("../helper/unsubscribeToken");
const logger = require("../logger");

const PERSONA_VOICE_CONFIG = {
  stoic: {
    title: "🏛️ Stoic Sage",
    pitch: 0.92,
    rate: 0.95,
    introStyle: "Good morning. Rise with purpose and deliberate resolve.",
    outroStyle: "Master your morning, master your mind. Begin now.",
  },
  energetic: {
    title: "⚡ High-Performance Coach",
    pitch: 1.05,
    rate: 1.1,
    introStyle: "Wake up champion! Today is an extraordinary opportunity to win.",
    outroStyle: "No excuses, pure execution! Let's get after it!",
  },
  monk: {
    title: "🧘 Mindfulness Guide",
    pitch: 0.9,
    rate: 0.88,
    introStyle: "Take a deep breath. Arrive fully in this fresh, unburdened moment.",
    outroStyle: "Carry stillness and intentional presence through everything you do.",
  },
  ruthless: {
    title: "🎯 Essentialist Leader",
    pitch: 0.96,
    rate: 1.02,
    introStyle:
      "Good morning. Cut through the noise. What is the one thing that truly matters today?",
    outroStyle: "Ruthless focus on the vital few. Protect your deep work time.",
  },
  visionary: {
    title: "🚀 Visionary Strategist",
    pitch: 1.0,
    rate: 1.02,
    introStyle:
      "Good morning. Great leaders architect their day before the world demands their attention.",
    outroStyle: "Think in decades, execute in minutes. Let's make history today.",
  },
  custom: {
    title: "🧠 Personalized Mentor",
    pitch: 1.0,
    rate: 1.0,
    introStyle: "Good morning. Your personal mentor is here to help you conquer your goals.",
    outroStyle: "Stay committed to your craft and trust your momentum.",
  },
};

/**
 * GET /api/me/briefing
 * Generate personalized daily audio briefing script for SpeechSynthesis and audio companion
 */
async function getDailyBriefing(req, res) {
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

    const personaKey = subscriber.coachPersona || "stoic";
    const personaConfig = PERSONA_VOICE_CONFIG[personaKey] || PERSONA_VOICE_CONFIG.stoic;
    const track = subscriber.routineTrack || subscriber.templateType || "deep-work";
    const trackInfo = sharedData.getTrackContent(track);
    const streak = Number(subscriber.streakCount) || 0;
    const name = subscriber.name || email.split("@")[0];

    const todayDate = new Date();
    const dateStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: subscriber.timezone || "UTC",
    }).format(todayDate);

    const spark =
      getCuratedSpark({
        coachPersona: personaKey,
        track,
        streakCount: streak,
        dateStr,
        email,
      }) || {};

    const introText = `${personaConfig.introStyle} Welcome, ${name}, to Day ${streak > 0 ? streak : 1} of your morning routine journey.`;
    const streakText =
      streak > 1
        ? `You have locked in ${streak} consecutive days of unbroken discipline. Protect that momentum today.`
        : "Today is Day 1 to establish your daily morning focus anchor.";

    const ritualText = `Your core ritual for today: ${trackInfo.ritual}`;
    const quoteText = `Wisdom of the morning: "${trackInfo.quote}".`;
    const sparkText = spark.focusMantra
      ? `Your focal mantra: "${spark.focusMantra}". ${spark.sparkReflection || ""}`
      : "";
    const outroText = personaConfig.outroStyle;

    const sections = [
      { type: "intro", label: "Morning Welcome", text: introText },
      { type: "streak", label: "Consistency Momentum", text: streakText },
      { type: "ritual", label: "Focus Ritual", text: ritualText },
      { type: "quote", label: "Core Wisdom", text: quoteText },
    ];

    if (sparkText) {
      sections.push({ type: "spark", label: "Daily Spark", text: sparkText });
    }
    sections.push({ type: "outro", label: "Call to Action", text: outroText });

    const fullScript = sections.map((s) => s.text).join(" ");
    const words = fullScript.split(/\s+/).length;
    // Average speech rate is ~140 words per minute
    const estimatedDurationSec = Math.max(30, Math.round((words / 140) * 60));

    return res.json({
      success: true,
      briefing: {
        title: `🌅 Morning Focus Briefing • ${trackInfo.name}`,
        persona: personaKey,
        coachTitle: personaConfig.title,
        trackName: trackInfo.name,
        streak,
        pitch: personaConfig.pitch,
        rate: personaConfig.rate,
        estimatedDurationSec,
        sections,
        fullScript,
      },
    });
  } catch (err) {
    logger.error("Error generating daily briefing", { error: err.message, email });
    return res.status(500).json({
      success: false,
      error: "Unable to generate daily briefing",
    });
  }
}

/**
 * Escapes special XML characters to prevent malformed RSS feeds
 */
function escapeXml(unsafe) {
  if (unsafe === undefined || unsafe === null) return "";
  return String(unsafe)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Resolves subscriber email from token (calendar token, base64url action token, redis session, or email)
 */
async function resolveEmailFromToken(tokenParam) {
  if (!tokenParam || typeof tokenParam !== "string") return null;
  const cleanToken = tokenParam.trim().replace(/\.xml$/i, "");
  if (!cleanToken) return null;

  // 1. Check calendar token (base64url email:hmac)
  const calEmail = verifyCalendarToken(cleanToken);
  if (calEmail) return calEmail;

  // 2. Check custom base64url(email:hmac) with podcast/routine/calendar/action scopes
  try {
    const decoded = Buffer.from(cleanToken, "base64url").toString("utf8");
    const colonIdx = decoded.indexOf(":");
    if (colonIdx !== -1) {
      const email = decoded.slice(0, colonIdx);
      const hmac = decoded.slice(colonIdx + 1);
      if (
        email &&
        hmac &&
        (verifyActionToken(email, hmac, "podcast") ||
          verifyActionToken(email, hmac, "routine") ||
          verifyActionToken(email, hmac, "calendar") ||
          verifyActionToken(email, hmac, "action"))
      ) {
        return email;
      }
    }
  } catch (_e) {
    // Continue
  }

  // 3. Check Redis session
  try {
    const redis = require("../config/redisClient");
    const sessionEmail = await redis.get(`subscriber_session:${cleanToken}`).catch(() => null);
    if (sessionEmail) return sessionEmail;
  } catch (_e) {
    // Redis unavailable
  }

  // 4. Direct email fallback
  if (cleanToken.includes("@")) {
    return cleanToken.toLowerCase();
  }

  return null;
}

/**
 * GET /feed/podcast/:token
 * GET /feed/podcast/:token.xml
 * GET /api/me/podcast-feed
 * Generates personalized RSS 2.0 podcast feed with iTunes tags
 */
async function getPodcastFeed(req, res) {
  try {
    let email = req.subscriberEmail || req.subscriber?.email || req.user?.email || null;

    // Check session cookie if email not already present
    if (!email) {
      const sessionToken = req.cookies?.mrn_session;
      if (sessionToken) {
        try {
          const redis = require("../config/redisClient");
          email = await redis.get(`subscriber_session:${sessionToken}`).catch(() => null);
        } catch (_e) {
          // Redis lookup failed
        }
      }
    }

    // Check token from params or query
    if (!email) {
      const token = req.params?.token || req.query?.token;
      if (token) {
        email = await resolveEmailFromToken(token);
      }
    }

    // Check email + token from query params
    if (!email && req.query?.email && req.query?.token) {
      const qEmail = req.query.email.trim().toLowerCase();
      const qToken = req.query.token.trim();
      if (
        verifyActionToken(qEmail, qToken, "podcast") ||
        verifyActionToken(qEmail, qToken, "routine") ||
        verifyActionToken(qEmail, qToken, "calendar") ||
        verifyActionToken(qEmail, qToken, "action")
      ) {
        email = qEmail;
      }
    }

    if (!email) {
      return res.status(401).json({
        success: false,
        error: "Authentication required (missing or invalid podcast feed token)",
      });
    }

    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: "Subscriber not found",
      });
    }

    const baseUrl = (
      res.locals?.apiBase ||
      `${req.protocol}://${req.get("host")}` ||
      process.env.APP_BASE_URL ||
      process.env.RENDER_URL ||
      "https://morningroutine.io"
    ).replace(/\/+$/, "");

    const subscriberName =
      subscriber.name || (subscriber.email ? subscriber.email.split("@")[0] : "Subscriber");
    const track = subscriber.routineTrack || subscriber.templateType || "deep-work";
    const trackInfo = sharedData.getTrackContent(track);

    const personaKey = subscriber.coachPersona || "stoic";
    const personaConfig = PERSONA_VOICE_CONFIG[personaKey] || PERSONA_VOICE_CONFIG.stoic;
    const streak = Number(subscriber.streakCount) || 0;

    const todayDate = new Date();
    const pubDate = todayDate.toUTCString();
    const dateStr = todayDate.toISOString().slice(0, 10);

    const spark =
      getCuratedSpark({
        coachPersona: personaKey,
        track,
        streakCount: streak,
        dateStr,
        email: subscriber.email,
      }) || {};

    const introText = `${personaConfig.introStyle} Welcome, ${subscriberName}, to Day ${streak > 0 ? streak : 1} of your morning routine journey.`;
    const streakText =
      streak > 1
        ? `You have locked in ${streak} consecutive days of unbroken discipline. Protect that momentum today.`
        : "Today is Day 1 to establish your daily morning focus anchor.";

    const ritualText = `Your core ritual for today: ${trackInfo.ritual}`;
    const quoteText = `Wisdom of the morning: "${trackInfo.quote}".`;
    const sparkText = spark.focusMantra
      ? `Your focal mantra: "${spark.focusMantra}". ${spark.sparkReflection || ""}`
      : "";
    const outroText = personaConfig.outroStyle;

    const fullScript = [introText, streakText, ritualText, quoteText, sparkText, outroText]
      .filter(Boolean)
      .join(" ");
    const words = fullScript.split(/\s+/).length;
    const estimatedDurationSec = Math.max(30, Math.round((words / 140) * 60));

    const itemTitle = `🌅 Morning Focus Briefing • ${trackInfo.name}`;
    const itemDescription = `Personalized morning kickoff with daily habit rituals, consistency momentum, and stoic focus wisdom. Core ritual: ${trackInfo.ritual}`;

    const enclosureUrl = `${baseUrl}/api/me/briefing?email=${escapeXml(subscriber.email)}&amp;format=audio`;
    const dashboardUrl = `${baseUrl}/me/dashboard`;
    const logoUrl = `${baseUrl}/assets/mrn-brand-ico.png`;

    const xml = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
  <channel>
    <title>Morning Routine Audio Briefing • ${escapeXml(subscriberName)}</title>
    <description>Personalized morning kickoff with daily habit rituals, consistency momentum, and stoic focus wisdom.</description>
    <link>${dashboardUrl}</link>
    <language>en-us</language>
    <itunes:author>Morning Routine Sender</itunes:author>
    <itunes:image href="${logoUrl}"/>
    <item>
      <title>${escapeXml(itemTitle)}</title>
      <description>${escapeXml(itemDescription)}</description>
      <pubDate>${pubDate}</pubDate>
      <guid isPermaLink="false">morning-briefing-${escapeXml(subscriber.email)}-${dateStr}</guid>
      <enclosure url="${enclosureUrl}" length="1024000" type="audio/mpeg"/>
      <itunes:duration>${estimatedDurationSec}</itunes:duration>
    </item>
  </channel>
</rss>`;

    res.setHeader("Content-Type", "application/rss+xml; charset=utf-8");
    return res.status(200).send(xml);
  } catch (err) {
    logger.error("Error generating podcast feed", { error: err.message });
    return res.status(500).json({
      success: false,
      error: "Unable to generate podcast feed",
    });
  }
}

module.exports = {
  getDailyBriefing,
  getPodcastFeed,
  resolveEmailFromToken,
  escapeXml,
  PERSONA_VOICE_CONFIG,
};
