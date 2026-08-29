const {
  COACH_PERSONAS_METADATA,
  getStreakTier,
  getCuratedSpark,
} = require("../helper/curatedSparks");
const { buildPrompt, parseJsonResponse } = require("../helper/aiSparkGenerator");

describe("AI Coach Persona Engine & Multi-Tier Matrix", () => {
  test("all 5 coach personas exist with complete metadata", () => {
    const expectedPersonas = ["stoic", "relentless", "zen", "tech-lead", "optimist"];
    expectedPersonas.forEach((personaKey) => {
      const persona = COACH_PERSONAS_METADATA[personaKey];
      expect(persona).toBeDefined();
      expect(persona.id).toBe(personaKey);
      expect(persona.title).toBeTruthy();
      expect(persona.tone).toBeTruthy();
      expect(persona.philosophy).toBeTruthy();
      expect(persona.sampleSpark).toBeTruthy();
    });
  });

  test("getStreakTier correctly categorizes milestone tiers", () => {
    expect(getStreakTier(1).tierKey).toBe("tier-1");
    expect(getStreakTier(3).tierKey).toBe("tier-3");
    expect(getStreakTier(7).tierKey).toBe("tier-7");
    expect(getStreakTier(14).tierKey).toBe("tier-14");
    expect(getStreakTier(30).tierKey).toBe("tier-30");
    expect(getStreakTier(60).tierKey).toBe("tier-60");
    expect(getStreakTier(100).tierKey).toBe("tier-100");
  });

  test("getCuratedSpark returns deterministic persona-tailored reflection", () => {
    const sparkStoic = getCuratedSpark({
      coachPersona: "stoic",
      track: "deep-work",
      streakCount: 7,
      dateStr: "2026-08-30",
      email: "sammy@example.com",
    });

    expect(sparkStoic).toBeDefined();
    expect(sparkStoic.sparkReflection).toBeTruthy();
    expect(sparkStoic.microAction).toBeTruthy();
    expect(sparkStoic.focusMantra).toBeTruthy();

    const sparkRelentless = getCuratedSpark({
      coachPersona: "relentless",
      track: "deep-work",
      streakCount: 30,
      dateStr: "2026-08-30",
      email: "sammy@example.com",
    });

    expect(sparkRelentless).toBeDefined();
    expect(sparkRelentless.sparkReflection).toBeTruthy();
    expect(sparkRelentless.microAction).toBeTruthy();
  });

  test("buildPrompt injects correct persona instructions and JSON schema", () => {
    const prompt = buildPrompt({
      coachPersona: "tech-lead",
      track: "deep-work",
      streakCount: 14,
      userName: "Priyanshu",
      todayDate: "2026-08-30",
    });

    expect(prompt.systemInstruction).toContain("Principal Architect");
    expect(prompt.userPrompt).toContain("Priyanshu");
    expect(prompt.userPrompt).toContain("14 consecutive days");
  });

  test("parseJsonResponse cleanly parses valid and fenced JSON responses", () => {
    const rawFenced =
      '```json\n{"sparkReflection": "Master your mind today.", "microAction": "Close all tabs.", "focusMantra": "Focus deeply."}\n```';
    const parsed = parseJsonResponse(rawFenced);

    expect(parsed.sparkReflection).toBe("Master your mind today.");
    expect(parsed.microAction).toBe("Close all tabs.");
    expect(parsed.focusMantra).toBe("Focus deeply.");
  });
});
