// __tests__/binaural.beats.test.js
process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");

jest.mock("../db/knex", () => ({}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockImplementation((track) => ({
    track: track || "deep-work",
    name: "Deep Work & Builder",
    badge: "⚡ Deep Work",
    tagline: "Tailored morning focus",
    ritual: "critical deliverable",
    quote: "Routine creates greatness.",
    checklist: ["Hydrate (500ml)", "Focus Sprint"],
  })),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

const { generateActionToken } = require("../helper/unsubscribeToken");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Procedural Web Audio Binaural Beats Generator (/routine)", () => {
  let app;
  const testEmail = "audio-specialist@example.com";
  let routineToken;

  beforeEach(() => {
    app = buildApp();
    routineToken = generateActionToken(testEmail, "routine");
    jest.clearAllMocks();
  });

  test("renders procedural binaural beats generator studio in live companion", async () => {
    const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);
    expect(res.status).toBe(200);

    // Studio Container & Headers
    expect(res.text).toContain('id="binauralStudioBox"');
    expect(res.text).toContain("Procedural Binaural Beats Generator");
    expect(res.text).toContain("Pure Web Audio");
    expect(res.text).toContain('id="binauralVolumeSlider"');
    expect(res.text).toContain('id="binauralVolPercent"');
  });

  test("renders 4 interactive binaural mode buttons with active states and labels", async () => {
    const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);
    expect(res.status).toBe(200);

    // Buttons: [None, ⚡ Gamma 40Hz, 🌊 Alpha 10Hz, 🧘 Theta 6Hz]
    expect(res.text).toContain('id="binaural-btn-none"');
    expect(res.text).toContain("None");

    expect(res.text).toContain('id="binaural-btn-gamma"');
    expect(res.text).toContain("⚡ Gamma 40Hz");

    expect(res.text).toContain('id="binaural-btn-alpha"');
    expect(res.text).toContain("🌊 Alpha 10Hz");

    expect(res.text).toContain('id="binaural-btn-theta"');
    expect(res.text).toContain("🧘 Theta 6Hz");
  });

  test("includes scientific cognitive tooltips and descriptions for each frequency", async () => {
    const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);
    expect(res.status).toBe(200);

    // Gamma 40 Hz tooltip: Peak cognitive processing & problem solving
    expect(res.text).toContain(
      "Gamma Focus (40 Hz): Peak cognitive processing and intense problem solving",
    );
    expect(res.text).toContain("Left ear = 200 Hz, Right ear = 240 Hz");

    // Alpha 10 Hz tooltip: Relaxed alertness & creative flow
    expect(res.text).toContain(
      "Alpha Flow (10 Hz): Relaxed alertness, flow state, and creative planning",
    );
    expect(res.text).toContain("Left ear = 200 Hz, Right ear = 210 Hz");

    // Theta 6 Hz tooltip: Morning visualization & calm
    expect(res.text).toContain(
      "Theta Calm (6 Hz): Morning visualization, meditation, and anxiety reduction",
    );
    expect(res.text).toContain("Left ear = 200 Hz, Right ear = 206 Hz");
  });

  test("renders pure Web Audio stereo panning architecture and fallback channel merger logic", async () => {
    const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);
    expect(res.status).toBe(200);

    // Function definition and presets
    expect(res.text).toContain("function createBinauralBeats(type, volume)");
    expect(res.text).toContain("const BINAURAL_PRESETS =");
    expect(res.text).toContain("baseFreq: 200");
    expect(res.text).toContain("diff: 40");
    expect(res.text).toContain("diff: 10");
    expect(res.text).toContain("diff: 6");

    // Stereo Panning & Fallback
    expect(res.text).toContain("StereoPannerNode");
    expect(res.text).toContain("pan: -1");
    expect(res.text).toContain("pan: 1");
    expect(res.text).toContain("createChannelMerger(2)");

    // Connection to master companion gain
    expect(res.text).toContain("binauralGain.connect(masterGainNode)");
    expect(res.text).toContain("function stopBinauralBeats()");
    expect(res.text).toContain("function setBinauralVolume(val)");
  });

  test("implements mobile battery friendliness and clean lifecycle teardown", async () => {
    const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);
    expect(res.status).toBe(200);

    // Reduced motion media query
    expect(res.text).toContain("@media (prefers-reduced-motion: reduce)");

    // Lifecycle handlers
    expect(res.text).toContain("beforeunload");
    expect(res.text).toContain("pagehide");
    expect(res.text).toContain("visibilitychange");
    expect(res.text).toContain("audioCtx.suspend()");
  });

  test("maintains backwards compatibility with legacy binauralOverlayToggle elements", async () => {
    const res = await request(app).get(`/routine?email=${testEmail}&token=${routineToken}`);
    expect(res.status).toBe(200);

    expect(res.text).toContain('id="binauralOverlayToggle"');
    expect(res.text).toContain('id="binauralBeatSelect"');
    expect(res.text).toContain("toggleBinauralOverlay()");
  });
});
