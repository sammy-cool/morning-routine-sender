// helper/aiSparkGenerator.js
const logger = require("../logger");
const redis = require("../config/redisClient");
const { getCuratedSpark, getStreakTier } = require("./curatedSparks");

const AI_CONFIG = {
  provider: process.env.LLM_PROVIDER || "auto", // 'gemini', 'openai', 'ollama', 'curated', 'auto'
  timeoutMs: parseInt(process.env.AI_TIMEOUT_MS, 10) || 3500,
  gemini: {
    apiKey: process.env.GEMINI_API_KEY,
    model: process.env.GEMINI_MODEL || "gemini-1.5-flash",
  },
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || "gpt-4o-mini",
  },
  ollama: {
    host: process.env.OLLAMA_HOST || "http://localhost:11434",
    model: process.env.OLLAMA_MODEL || "llama3.2",
  },
};

const PERSONA_INSTRUCTIONS = {
  "deep-work": {
    name: "Deep Work & Builder",
    archetype: "Elite software engineer, builder, and deep thinker",
    tone: "Laser-focused, rigorous, high-signal, anti-distraction, craft-oriented",
    focusDomains:
      "Deep architecture sprints, 90-minute uninterrupted flow states, minimizing context switches, elegant craftsmanship",
  },
  mindfulness: {
    name: "Mindfulness & Stoic",
    archetype: "Modern Stoic practitioner and mindful thinker",
    tone: "Calm, grounded, introspective, resilient, centered",
    focusDomains:
      "Equanimity under pressure, morning breathwork, gratitude, controlling the controllable, presence over anxiety",
  },
  executive: {
    name: "High-Performance Executive",
    archetype: "Decisive leader, operator, and strategic builder",
    tone: "Decisive, high-leverage, macro-strategic, energetic, no-fluff",
    focusDomains:
      "The vital 20% high-leverage outcomes, calendar defense, energy management, clear decisive execution",
  },
  learning: {
    name: "Lifelong Learner",
    archetype: "Curious polymath, researcher, and knowledge craftsman",
    tone: "Inquisitive, analytical, growth-minded, synthetic",
    focusDomains:
      "Mental models, active recall (Feynman technique), high-value reading, synthesis of complex principles",
  },
  classic: {
    name: "Morning Energizer",
    archetype: "Vibrant, disciplined, and optimistic momentum builder",
    tone: "Uplifting, action-oriented, positive, empowering, energizing",
    focusDomains:
      "Hydration and morning sunlight, physical activation, positive daily intentions, 1% daily compounding",
  },
};

/**
 * Generate dynamic prompt with persona context and psychological streak stage
 */
function buildPrompt({ track, streakCount, userName, todayDate }) {
  const normalizedTrack = (track || "deep-work").toLowerCase().trim();
  const persona = PERSONA_INSTRUCTIONS[normalizedTrack] || PERSONA_INSTRUCTIONS["deep-work"];
  const streak = parseInt(streakCount, 10) || 0;
  const tier = getStreakTier(streak);

  const streakContext = `
Subscriber Name: ${userName || "Builder"}
Track: ${persona.name} (Archetype: ${persona.archetype})
Track Focus: ${persona.focusDomains}
Current Morning Habit Streak: ${streak} consecutive days
Milestone Tier: ${tier.title} (${tier.stageDescription})
Today's Date: ${todayDate}
`;

  const systemInstruction = `You are the AI Morning Spark engine for high-performing subscribers.
Your mission is to generate a personalized, high-signal, ultra-concise morning kickoff reflection and micro-action for today.

Strict Guidelines:
1. Tone must match the ${persona.tone}.
2. Acknowledge their current habit streak (${streak} days - ${tier.title}) seamlessly to fuel psychological momentum.
3. Output MUST be valid JSON only. No markdown fences, no explanatory preambles.
4. Schema:
{
  "sparkReflection": "1-2 sentences of punchy, memorable kickoff reflection tailored to their persona and streak stage.",
  "microAction": "1 clear, immediately actionable morning micro-task (completable in under 2 minutes or kickoff sprint).",
  "focusMantra": "3 to 6 words anchor mantra (e.g., 'Silence the noise, build the craft')."
}`;

  return { systemInstruction, userPrompt: streakContext };
}

/**
 * Clean & parse LLM output
 */
function parseJsonResponse(rawText) {
  if (!rawText) throw new Error("Empty response from LLM");
  let cleaned = rawText.trim();
  if (cleaned.startsWith("```json")) {
    cleaned = cleaned.replace(/^```json\s*/i, "").replace(/\s*```$/, "");
  } else if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```\s*/i, "").replace(/\s*```$/, "");
  }
  const parsed = JSON.parse(cleaned);
  if (!parsed.sparkReflection || !parsed.microAction || !parsed.focusMantra) {
    throw new Error("Missing required JSON schema fields");
  }
  return {
    sparkReflection: String(parsed.sparkReflection).trim(),
    microAction: String(parsed.microAction).trim(),
    focusMantra: String(parsed.focusMantra).trim(),
  };
}

/**
 * Gemini REST Generator
 */
async function callGemini(promptData, timeoutMs) {
  const { apiKey, model } = AI_CONFIG.gemini;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");

  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      contents: [
        {
          role: "user",
          parts: [
            { text: `${promptData.systemInstruction}\n\nContext:\n${promptData.userPrompt}` },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 250,
        responseMimeType: "application/json",
      },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Gemini API error [${response.status}]: ${errBody.slice(0, 150)}`);
  }

  const json = await response.json();
  const text = json.candidates?.[0]?.content?.parts?.[0]?.text;
  return parseJsonResponse(text);
}

/**
 * OpenAI REST Generator
 */
async function callOpenAI(promptData, timeoutMs) {
  const { apiKey, model } = AI_CONFIG.openai;
  if (!apiKey) throw new Error("OPENAI_API_KEY is not set");

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: promptData.systemInstruction },
        { role: "user", content: promptData.userPrompt },
      ],
      temperature: 0.7,
      max_tokens: 250,
      response_format: { type: "json_object" },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`OpenAI API error [${response.status}]: ${errBody.slice(0, 150)}`);
  }

  const json = await response.json();
  const text = json.choices?.[0]?.message?.content;
  return parseJsonResponse(text);
}

/**
 * Ollama Local REST Generator
 */
async function callOllama(promptData, timeoutMs) {
  const { host, model } = AI_CONFIG.ollama;
  const url = `${host.replace(/\/$/, "")}/api/chat`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    signal: AbortSignal.timeout(timeoutMs),
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: promptData.systemInstruction },
        { role: "user", content: promptData.userPrompt },
      ],
      format: "json",
      stream: false,
      options: { temperature: 0.7, num_predict: 200 },
    }),
  });

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Ollama API error [${response.status}]: ${errBody.slice(0, 150)}`);
  }

  const json = await response.json();
  const text = json.message?.content;
  return parseJsonResponse(text);
}

/**
 * Main Dynamic Generator Entrypoint
 * Guarantees zero failures and sub-millisecond cache hits.
 */
async function getDailyMorningSpark({
  email = "",
  routineTrack = "deep-work",
  streakCount = 0,
  timezone = "UTC",
  name = "",
}) {
  const normalizedTrack = (routineTrack || "deep-work").toLowerCase().trim();
  const streak = parseInt(streakCount, 10) || 0;
  const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(
    new Date(),
  );

  const cacheKey = `spark:${email ? email.toLowerCase().trim() : normalizedTrack}:${todayDate}`;

  // 1. Check Redis Cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      return { ...parsedCache, cached: true };
    }
  } catch (cacheErr) {
    logger.debug("Redis cache read bypassed", { error: cacheErr.message });
  }

  const promptData = buildPrompt({
    track: normalizedTrack,
    streakCount: streak,
    userName: name,
    todayDate,
  });

  let sparkResult = null;
  let source = "curated";

  // 2. Determine and execute provider
  const provider = AI_CONFIG.provider;

  if (provider !== "curated") {
    try {
      if (provider === "gemini" || (provider === "auto" && AI_CONFIG.gemini.apiKey)) {
        sparkResult = await callGemini(promptData, AI_CONFIG.timeoutMs);
        source = "gemini";
      } else if (provider === "openai" || (provider === "auto" && AI_CONFIG.openai.apiKey)) {
        sparkResult = await callOpenAI(promptData, AI_CONFIG.timeoutMs);
        source = "openai";
      } else if (provider === "ollama") {
        sparkResult = await callOllama(promptData, AI_CONFIG.timeoutMs);
        source = "ollama";
      }
    } catch (llmErr) {
      logger.warn("⚠️ AI generation fallback triggered", {
        provider,
        track: normalizedTrack,
        streak,
        error: llmErr.message,
      });
      sparkResult = null;
    }
  }

  // 3. Fallback to Curated Deterministic Engine if LLM is unconfigured, timed out, or threw
  if (!sparkResult) {
    sparkResult = getCuratedSpark({
      track: normalizedTrack,
      streakCount: streak,
      dateStr: todayDate,
      email,
    });
    source = "curated";
  }

  const finalPayload = {
    ...sparkResult,
    source,
    streakTier: getStreakTier(streak).title,
    date: todayDate,
  };

  // 4. Save into Redis (TTL 24 hours)
  try {
    await redis.set(cacheKey, JSON.stringify(finalPayload), "EX", 86400);
  } catch (setCacheErr) {
    logger.debug("Failed saving spark to Redis", { error: setCacheErr.message });
  }

  return finalPayload;
}

module.exports = {
  getDailyMorningSpark,
  buildPrompt,
  parseJsonResponse,
  AI_CONFIG,
};
