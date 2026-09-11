// helper/aiSparkGenerator.js
const logger = require("../logger");
const redis = require("../config/redisClient");
const { getCuratedSpark, getStreakTier, COACH_PERSONAS_METADATA } = require("./curatedSparks");

const AI_CONFIG = {
  provider: process.env.LLM_PROVIDER || "auto",
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

/**
 * Generate dynamic tailored system prompt combining Coach Persona voice with Routine Track & Streak Milestone
 */
function buildPrompt({
  coachPersona = "stoic",
  customCoachPrompt = null,
  track = "deep-work",
  streakCount = 0,
  userName = "Builder",
  todayDate = "",
}) {
  const normPersona = (coachPersona || "stoic").toLowerCase().trim();
  const persona = COACH_PERSONAS_METADATA[normPersona] || COACH_PERSONAS_METADATA["stoic"];
  const streak = parseInt(streakCount, 10) || 0;
  const tier = getStreakTier(streak);

  const subscriberContext = `
Subscriber Name: ${userName || "Builder"}
AI Coach Persona: ${persona.name} (${persona.title})
Coach Archetype: ${persona.archetype}
Coach Tone & Voice: ${persona.tone}
Core Coaching Philosophy: ${persona.philosophy}${customCoachPrompt ? `\nCustom Subscriber Coaching Directives: ${customCoachPrompt}` : ""}
Active Routine Track: ${track || "deep-work"}
Current Morning Habit Streak: ${streak} consecutive days
Milestone Tier: ${tier.title} (${tier.stageDescription})
Today's Date: ${todayDate || new Date().toISOString().split("T")[0]}
`;

  const systemInstruction = `You are the ${persona.title} AI Morning Coach for high-performing morning routine subscribers.
Your mission is to generate a personalized, high-signal, ultra-concise morning kickoff reflection, micro-action, and focus mantra for today.

Strict Persona & Style Guidelines:
1. Speak purely in the voice and archetype of the ${persona.name}.
2. Tone must strictly reflect: ${persona.tone}.
3. Anchor your guidance in this core philosophy: "${persona.philosophy}".
4. Seamlessly incorporate psychological reinforcement of their ${streak}-day morning habit streak (${tier.title}).${customCoachPrompt ? `\n5. Adhere strictly to the subscriber's custom coaching directives: "${customCoachPrompt}".` : ""}
6. Output MUST be valid JSON only. No markdown fences, no explanatory preambles.
7. JSON Schema:
{
  "sparkReflection": "1-2 sentences of punchy, memorable kickoff reflection tailored strictly to your coach persona voice and streak tier.",
  "microAction": "1 clear, immediately actionable morning micro-task (completable in under 2 minutes or sprint start).",
  "focusMantra": "3 to 6 words anchor mantra capturing the essence of this coach persona (e.g., 'Master the mind, own the day')."
}`;

  return { systemInstruction, userPrompt: subscriberContext };
}

/**
 * Clean & parse LLM output safely
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
            {
              text: `${promptData.systemInstruction}\n\nSubscriber Context:\n${promptData.userPrompt}`,
            },
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
 * Main AI Morning Spark Generator Entrypoint
 * Zero failures with Redis caching and deterministic Curated Fallback Matrix.
 */
async function getDailyMorningSpark({
  email = "",
  coachPersona = "stoic",
  customCoachPrompt = null,
  routineTrack = "deep-work",
  streakCount = 0,
  timezone = "UTC",
  name = "",
}) {
  const normPersona = (coachPersona || "stoic").toLowerCase().trim();
  const normTrack = (routineTrack || "deep-work").toLowerCase().trim();
  const streak = parseInt(streakCount, 10) || 0;
  const todayDate = new Intl.DateTimeFormat("en-CA", { timeZone: timezone || "UTC" }).format(
    new Date(),
  );

  const cacheKey = `spark:${email ? email.toLowerCase().trim() : normTrack}:${normPersona}:${todayDate}`;

  // 1. Check Redis Cache
  try {
    const cached = await redis.get(cacheKey);
    if (cached) {
      const parsedCache = JSON.parse(cached);
      return { ...parsedCache, cached: true };
    }
  } catch (cacheErr) {
    logger.debug("Redis spark cache read bypassed", { error: cacheErr.message });
  }

  const promptData = buildPrompt({
    coachPersona: normPersona,
    customCoachPrompt,
    track: normTrack,
    streakCount: streak,
    userName: name,
    todayDate,
  });

  let sparkResult = null;
  let source = "curated";

  // 2. Execute LLM Provider
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
      logger.warn("⚠️ AI generation fallback triggered to Curated Matrix", {
        provider,
        persona: normPersona,
        streak,
        error: llmErr.message,
      });
      sparkResult = null;
    }
  }

  // 3. Fallback to Curated Deterministic Persona Engine
  if (!sparkResult) {
    sparkResult = getCuratedSpark({
      coachPersona: normPersona,
      track: normTrack,
      streakCount: streak,
      dateStr: todayDate,
      email,
    });
    source = "curated";
  }

  const finalPayload = {
    ...sparkResult,
    coachPersona: normPersona,
    source,
    streakTier: getStreakTier(streak).title,
    date: todayDate,
  };

  // 4. Save into Redis Cache (TTL 24 hours)
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
