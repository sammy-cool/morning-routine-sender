// __tests__/aiSparkGenerator.test.js
const {
  getDailyMorningSpark,
  buildPrompt,
  parseJsonResponse,
} = require("../helper/aiSparkGenerator");
const { getStreakTier, getCuratedSpark } = require("../helper/curatedSparks");

describe("AI Morning Spark & Curated Sparks Engine", () => {
  describe("getStreakTier", () => {
    test("correctly maps streak numbers to milestone tiers", () => {
      expect(getStreakTier(0).title).toBe("First Light");
      expect(getStreakTier(2).title).toBe("First Light");
      expect(getStreakTier(3).title).toBe("Kinetic Momentum");
      expect(getStreakTier(7).title).toBe("Weekly Champion");
      expect(getStreakTier(14).title).toBe("Iron Consistency");
      expect(getStreakTier(30).title).toBe("Unbreakable Flow");
      expect(getStreakTier(60).title).toBe("Titan Habit");
      expect(getStreakTier(100).title).toBe("Master of Morning");
      expect(getStreakTier(365).title).toBe("Master of Morning");
    });
  });

  describe("getCuratedSpark", () => {
    test("returns non-empty reflection, microAction, and focusMantra across all tracks", () => {
      const tracks = ["deep-work", "mindfulness", "executive", "learning", "classic"];
      const streaks = [1, 5, 7, 14, 30, 60, 100];

      for (const track of tracks) {
        for (const streak of streaks) {
          const spark = getCuratedSpark({
            track,
            streakCount: streak,
            dateStr: "2026-08-28",
            email: "test@example.com",
          });

          expect(spark).toBeDefined();
          expect(typeof spark.sparkReflection).toBe("string");
          expect(spark.sparkReflection.length).toBeGreaterThan(10);
          expect(typeof spark.microAction).toBe("string");
          expect(spark.microAction.length).toBeGreaterThan(10);
          expect(typeof spark.focusMantra).toBe("string");
          expect(spark.focusMantra.length).toBeGreaterThan(3);
        }
      }
    });
  });

  describe("buildPrompt", () => {
    test("constructs valid prompt and persona instructions", () => {
      const prompt = buildPrompt({
        track: "deep-work",
        streakCount: 7,
        userName: "Priyanshu",
        todayDate: "2026-08-28",
      });

      expect(prompt.systemInstruction).toContain("AI Morning Spark engine");
      expect(prompt.userPrompt).toContain("Priyanshu");
      expect(prompt.userPrompt).toContain("7 consecutive days");
      expect(prompt.userPrompt).toContain("Weekly Champion");
    });
  });

  describe("parseJsonResponse", () => {
    test("correctly parses raw json string", () => {
      const raw = JSON.stringify({
        sparkReflection: "Deep builders conquer the morning.",
        microAction: "Open your test suite first.",
        focusMantra: "Silence the noise.",
      });

      const parsed = parseJsonResponse(raw);
      expect(parsed.sparkReflection).toBe("Deep builders conquer the morning.");
      expect(parsed.microAction).toBe("Open your test suite first.");
      expect(parsed.focusMantra).toBe("Silence the noise.");
    });

    test("correctly handles markdown json code fences", () => {
      const raw = `\`\`\`json
{
  "sparkReflection": "Stoic calm leads to deep clarity.",
  "microAction": "Take 3 deep breaths.",
  "focusMantra": "Present in this moment."
}
\`\`\``;

      const parsed = parseJsonResponse(raw);
      expect(parsed.sparkReflection).toBe("Stoic calm leads to deep clarity.");
      expect(parsed.microAction).toBe("Take 3 deep breaths.");
      expect(parsed.focusMantra).toBe("Present in this moment.");
    });

    test("throws on invalid or missing fields", () => {
      expect(() => parseJsonResponse("")).toThrow();
      expect(() => parseJsonResponse("{}")).toThrow();
    });
  });

  describe("getDailyMorningSpark", () => {
    test("returns complete spark with guaranteed curated fallback", async () => {
      const spark = await getDailyMorningSpark({
        email: "test.subscriber@example.com",
        routineTrack: "deep-work",
        streakCount: 14,
        timezone: "Asia/Kolkata",
        name: "Priyanshu",
      });

      expect(spark).toBeDefined();
      expect(spark.sparkReflection).toBeDefined();
      expect(spark.microAction).toBeDefined();
      expect(spark.focusMantra).toBeDefined();
      expect(spark.streakTier).toBe("Iron Consistency");
      expect(["curated", "gemini", "openai", "ollama"]).toContain(spark.source);
    });
  });
});
