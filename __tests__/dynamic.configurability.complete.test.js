/**
 * Complete Dynamic Configurability & Flexibility Test Suite
 *
 * Covers:
 * 1. Expanded quotes (8+) & rituals (8+) across all 7 tracks with deterministic rotation
 * 2. Custom quote & custom ritual user overrides
 * 3. Categorized morning news & distraction-free 'off' mode
 * 4. Custom AI Coach persona with customizable prompt injection
 * 5. Weekly consistency digest opt-in / opt-out controls
 * 6. UXCore ambient binaural beat frequency tuning & volume calibration
 * 7. Multi-channel track colors parity (career, reflection) & custom quote inheritance
 * 8. Dynamic email subject line generation & weekly digest day parity
 */

jest.mock("mjml", () => jest.fn((content) => ({ html: `<html><body>${content}</body></html>` })));

const sharedData = require("../helper/shared-data");
const { dailyDevNews } = require("../helper/util");
const { COACH_PERSONAS_METADATA, getCuratedSpark } = require("../helper/curatedSparks");
const { buildPrompt } = require("../helper/aiSparkGenerator");
const { sendWeeklyDigestToSubscriber } = require("../helper/weeklyDigestService");
const { TRACK_COLORS } = require("../helper/channelDispatcher");
const emailService = require("../email-core/emailService");

describe("1. Dynamic Track Content & Custom Mantras", () => {
  const tracks = [
    "deep-work",
    "mindfulness",
    "executive",
    "learning",
    "classic",
    "career",
    "reflection",
  ];

  test("all 7 tracks have 8+ quotes and 8+ rituals", () => {
    tracks.forEach((trackKey) => {
      const config = sharedData.TRACK_CONFIGS[trackKey];
      expect(config).toBeDefined();
      expect(Array.isArray(config.quotes)).toBe(true);
      expect(config.quotes.length).toBeGreaterThanOrEqual(8);
      expect(Array.isArray(config.rituals)).toBe(true);
      expect(config.rituals.length).toBeGreaterThanOrEqual(8);
    });
  });

  test("deterministic daily quote and ritual rotation varies across dates and emails", () => {
    const day1 = sharedData.getTrackContent("deep-work", {
      dateStr: "2026-09-01",
      email: "alice@example.com",
    });
    const day2 = sharedData.getTrackContent("deep-work", {
      dateStr: "2026-09-02",
      email: "alice@example.com",
    });
    const user2 = sharedData.getTrackContent("deep-work", {
      dateStr: "2026-09-01",
      email: "bob@example.com",
    });

    expect(day1.quote).toBeTruthy();
    expect(day1.ritual).toBeTruthy();
    expect(day2.quote).toBeTruthy();
    expect(day2.ritual).toBeTruthy();
    const day1Ident = day1.quote + day1.ritual;
    const day2Ident = day2.quote + day2.ritual;
    const user2Ident = user2.quote + user2.ritual;
    expect(day1Ident !== day2Ident || day1Ident !== user2Ident).toBe(true);
  });

  test("subscriber custom quote and custom ritual override track defaults", () => {
    const customQuote = "He who has a why to live can bear almost any how. — Nietzsche";
    const customRitual = "15 minutes breathwork & cold plunge before coffee";

    const content = sharedData.getTrackContent("deep-work", {
      customQuote,
      customRitual,
      dateStr: "2026-09-01",
      email: "subscriber@example.com",
    });

    expect(content.quote).toBe(customQuote);
    expect(content.ritual).toBe(customRitual);
  });
});

describe("2. Dynamic Morning News & Knowledge Digest", () => {
  const originalFetch = global.fetch;

  afterEach(() => {
    global.fetch = originalFetch;
  });

  test("dailyDevNews returns null when category is 'off' or 'disabled' (distraction-free)", async () => {
    expect(await dailyDevNews("off")).toBeNull();
    expect(await dailyDevNews("disabled")).toBeNull();
    expect(await dailyDevNews("none")).toBeNull();
  });

  test("dailyDevNews fetches categorized news with selected category parameters", async () => {
    let capturedUrl = "";
    global.fetch = jest.fn((url) => {
      capturedUrl = url;
      return Promise.resolve({
        ok: true,
        json: async () => ({
          data: [
            {
              title: "Breakthrough in Artificial General Intelligence",
              description: "Researchers announce novel reasoning model.",
              url: "https://example.com/ai-news",
              published_at: "2026-09-11T05:00:00Z",
              source: "Global AI Chronicle",
            },
          ],
        }),
      });
    });

    const news = await dailyDevNews("ai");
    expect(news).not.toBeNull();
    expect(Array.isArray(news)).toBe(true);
    expect(news[0].title).toBe("Breakthrough in Artificial General Intelligence");
    expect(capturedUrl).toContain("artificial%20intelligence");
  });
});

describe("3. Custom AI Coach Persona & System Instructions", () => {
  test("custom persona exists in COACH_PERSONAS_METADATA", () => {
    const custom = COACH_PERSONAS_METADATA["custom"];
    expect(custom).toBeDefined();
    expect(custom.id).toBe("custom");
    expect(custom.title).toBe("The Personalized Mentor");
    expect(custom.badge).toContain("Personalized Mentor");
  });

  test("getCuratedSpark generates valid fallback spark for custom persona", () => {
    const spark = getCuratedSpark({
      coachPersona: "custom",
      track: "deep-work",
      streakCount: 5,
      dateStr: "2026-09-01",
      email: "user@example.com",
    });

    expect(spark).toBeDefined();
    expect(spark.sparkReflection).toBeTruthy();
    expect(spark.microAction).toBeTruthy();
    expect(spark.focusMantra).toBeTruthy();
  });

  test("buildPrompt incorporates customCoachPrompt into system instructions and prompt", () => {
    const customInstruction = "Emphasize shipping MVP before noon and extreme physical fitness.";
    const prompt = buildPrompt({
      coachPersona: "custom",
      customCoachPrompt: customInstruction,
      track: "deep-work",
      streakCount: 21,
      userName: "Alex",
      todayDate: "2026-09-01",
    });

    expect(prompt.systemInstruction).toContain(customInstruction);
    expect(prompt.userPrompt).toContain(customInstruction);
    expect(prompt.userPrompt).toContain("Alex");
    expect(prompt.userPrompt).toContain("21 consecutive days");
  });
});

describe("4. Dynamic Weekly Consistency Digest Controls", () => {
  test("sendWeeklyDigestToSubscriber skips subscriber when weeklyDigestEnabled is false and force is false", async () => {
    const subscriber = {
      email: "optout@example.com",
      timezone: "UTC",
      streakCount: 10,
      weeklyDigestEnabled: false,
    };

    const res = await sendWeeklyDigestToSubscriber(subscriber, null, { force: false });
    expect(res).toBeDefined();
    expect(res.status).toBe("skipped");
    expect(res.reason).toBe("opted_out");
  });
});

describe("5. UXCore Tunable Binaural Beat Soundscape Frequency & Volume", () => {
  test("UXCore sets and retrieves custom binaural frequencies and volume", () => {
    const originalWindow = global.window;
    const originalDoc = global.document;

    global.window = {
      addEventListener: jest.fn(),
      removeEventListener: jest.fn(),
      dispatchEvent: jest.fn(),
    };
    global.document = {
      readyState: "complete",
      addEventListener: jest.fn(),
      getElementById: jest.fn(() => null),
      querySelectorAll: jest.fn(() => []),
      querySelector: jest.fn(() => null),
      body: { appendChild: jest.fn() },
      createElement: jest.fn(() => ({
        style: {},
        setAttribute: jest.fn(),
        appendChild: jest.fn(),
        classList: { add: jest.fn(), remove: jest.fn() },
      })),
      documentElement: {
        setAttribute: jest.fn(),
        style: {},
        classList: { remove: jest.fn(), add: jest.fn(), contains: jest.fn(() => false) },
      },
    };

    jest.isolateModules(() => {
      require("../public/js/ux-core");
      const UXCore = global.window.UXCore || global.UXCore;

      expect(UXCore).toBeDefined();
      expect(UXCore.ambient).toBeDefined();
      expect(typeof UXCore.ambient.setBinauralBeat).toBe("function");
      expect(typeof UXCore.ambient.getBinauralBeat).toBe("function");
      expect(typeof UXCore.ambient.setVolume).toBe("function");
      expect(typeof UXCore.ambient.getVolume).toBe("function");

      // Default is 10Hz Alpha
      expect(UXCore.ambient.getBinauralBeat()).toBe(10);

      // Tune to Theta 6Hz
      UXCore.ambient.setBinauralBeat(6);
      expect(UXCore.ambient.getBinauralBeat()).toBe(6);

      // Tune to Beta 18Hz
      UXCore.ambient.setBinauralBeat(18);
      expect(UXCore.ambient.getBinauralBeat()).toBe(18);

      // Tune to Gamma 40Hz
      UXCore.ambient.setBinauralBeat(40);
      expect(UXCore.ambient.getBinauralBeat()).toBe(40);

      // Clamps frequency between 1 and 60Hz
      UXCore.ambient.setBinauralBeat(999);
      expect(UXCore.ambient.getBinauralBeat()).toBe(60);

      UXCore.ambient.setBinauralBeat(-10);
      expect(UXCore.ambient.getBinauralBeat()).toBe(1);

      UXCore.ambient.setBinauralBeat("invalid");
      expect(UXCore.ambient.getBinauralBeat()).toBe(10);

      // Volume calibration and clamping between 0.0 and 1.0
      UXCore.ambient.setVolume(0.75);
      expect(UXCore.ambient.getVolume()).toBe(0.75);

      UXCore.ambient.setVolume(2.5);
      expect(UXCore.ambient.getVolume()).toBe(1);

      UXCore.ambient.setVolume(-0.5);
      expect(UXCore.ambient.getVolume()).toBe(0);
    });

    global.window = originalWindow;
    global.document = originalDoc;
  });
});

describe("6. Multi-Channel Dispatcher Parity", () => {
  test("TRACK_COLORS includes all 7 tracks with distinct color codes", () => {
    expect(TRACK_COLORS["career"]).toBeDefined();
    expect(TRACK_COLORS["career"]).toBe(0x3b82f6);
    expect(TRACK_COLORS["reflection"]).toBeDefined();
    expect(TRACK_COLORS["reflection"]).toBe(0x8b5cf6);
    expect(TRACK_COLORS["deep-work"]).toBe(0x7c3aed);
    expect(TRACK_COLORS["mindfulness"]).toBe(0x10b981);
    expect(TRACK_COLORS["executive"]).toBe(0xf59e0b);
    expect(TRACK_COLORS["learning"]).toBe(0x22d3ee);
    expect(TRACK_COLORS["classic"]).toBe(0xec4899);
  });
});

describe("7. Dynamic Email Subject Lines & Day Parity", () => {
  test("sendWeeklyDigestEmail uses dynamic day in subject based on weeklyDigestDay", async () => {
    const mockTransporter = {
      sendMail: jest.fn().mockResolvedValue({ messageId: "test-digest-msg" }),
    };

    const userFriday = {
      email: "friday@example.com",
      name: "Friday Reviewer",
      routineTrack: "deep-work",
      streakCount: 12,
      weeklyDigestDay: "friday",
    };

    await emailService.sendWeeklyDigestEmail(mockTransporter, "http://localhost:3000", userFriday);

    expect(mockTransporter.sendMail).toHaveBeenCalled();
    const callArgs = mockTransporter.sendMail.mock.calls[0][0];
    expect(callArgs.subject).toContain("Friday Weekly Streak Digest");
    expect(callArgs.text).toContain("Friday Weekly Streak Digest");
  });
});
