process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");

jest.mock("../db/knex", () => ({}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  updateUser: jest.fn(),
  setUserActive: jest.fn(),
}));

const mockSendMail = jest.fn().mockResolvedValue({ messageId: "msg-test-1" });
jest.mock("../config/mailTransporter", () => ({
  getTransporter: () => ({ sendMail: mockSendMail }),
}));

jest.mock("../middleware/rateLimiters", () => ({
  sendEmailLimiter: (req, res, next) => next(),
}));

const sharedData = require("../helper/shared-data");
const redis = require("../config/redisClient");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Subscriber /me Controller Validation & Edge Cases", () => {
  let app;

  beforeEach(() => {
    app = buildApp();
    jest.clearAllMocks();
  });

  afterAll(async () => {
    await redis.quit();
  });

  async function getAuthenticatedAgent(email) {
    sharedData.getUserByEmail.mockResolvedValue({
      email,
      cronPattern: "0 8 * * *",
      timezone: "UTC",
      routineTrack: "deep-work",
      isActive: true,
    });

    const agent = request.agent(app);
    await agent.post("/login").send({ email });
    const lastCall = mockSendMail.mock.calls[mockSendMail.mock.calls.length - 1];
    const token = lastCall[0].html.match(/token=([a-f0-9]+)/)[1];
    await agent.get(`/verify-login?token=${token}`);
    return agent;
  }

  test("rejects unauthenticated PATCH /me with 401", async () => {
    const res = await request(app).patch("/me").send({ routineTrack: "mindfulness" });
    expect(res.status).toBe(401);
  });

  test("accepts all 5 valid routine tracks", async () => {
    const agent = await getAuthenticatedAgent("tracks@example.com");
    const validTracks = ["deep-work", "mindfulness", "executive", "learning", "classic"];

    for (const track of validTracks) {
      sharedData.updateUser.mockResolvedValue();
      sharedData.getUserByEmail.mockResolvedValue({
        email: "tracks@example.com",
        routineTrack: track,
        isActive: true,
      });

      const res = await agent.patch("/me").send({ routineTrack: track });
      expect(res.status).toBe(200);
      expect(sharedData.updateUser).toHaveBeenCalledWith(
        "tracks@example.com",
        expect.objectContaining({ routineTrack: track }),
      );
    }
  });

  test("rejects invalid routineTrack with 400 Bad Request", async () => {
    const agent = await getAuthenticatedAgent("invalidtrack@example.com");

    const res = await agent.patch("/me").send({ routineTrack: "ultra-gamer-mode" });
    expect(res.status).toBe(400);
    expect(res.body.errors[0]).toMatch(/routineTrack must be one of/i);
  });

  test("rejects invalid timezone with 400 Bad Request", async () => {
    const agent = await getAuthenticatedAgent("invalidtz@example.com");

    const res = await agent.patch("/me").send({ timezone: "Mars/Olympus_Mons" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("Invalid timezone");
  });

  test("rejects invalid cronPattern with 400 Bad Request", async () => {
    const agent = await getAuthenticatedAgent("invalidcron@example.com");

    const res = await agent.patch("/me").send({ cronPattern: "every single minute please" });
    expect(res.status).toBe(400);
    expect(res.body.errors).toContain("cronPattern is not a valid cron expression");
  });

  test("allows pausing and resuming via isActive boolean", async () => {
    const agent = await getAuthenticatedAgent("pause-resume@example.com");

    // Pause
    sharedData.setUserActive.mockResolvedValue();
    sharedData.getUserByEmail.mockResolvedValue({
      email: "pause-resume@example.com",
      isActive: false,
    });
    const pauseRes = await agent.patch("/me").send({ isActive: false });
    expect(pauseRes.status).toBe(200);
    expect(sharedData.setUserActive).toHaveBeenCalledWith("pause-resume@example.com", false);

    // Resume
    sharedData.getUserByEmail.mockResolvedValue({
      email: "pause-resume@example.com",
      isActive: true,
    });
    const resumeRes = await agent.patch("/me").send({ isActive: true });
    expect(resumeRes.status).toBe(200);
    expect(sharedData.setUserActive).toHaveBeenCalledWith("pause-resume@example.com", true);
  });
});
