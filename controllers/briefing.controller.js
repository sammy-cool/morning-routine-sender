// controllers/briefing.controller.js
const sharedData = require("../helper/shared-data");
const { getCuratedSpark } = require("../helper/curatedSparks");
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

module.exports = {
  getDailyBriefing,
  PERSONA_VOICE_CONFIG,
};
