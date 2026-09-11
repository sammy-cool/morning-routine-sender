// __tests__/offline.sync.test.js
process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const routineController = require("../controllers/routine.controller");
const { generateActionToken } = require("../helper/unsubscribeToken");
const sharedData = require("../helper/shared-data");

jest.mock("../config/redisClient", () => ({
  get: jest.fn(() => Promise.resolve(null)),
  set: jest.fn(() => Promise.resolve("OK")),
  del: jest.fn(() => Promise.resolve(1)),
}));

jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn(() => ({
    name: "Deep Work & Builder",
    quote: "Focus is a superpower.",
  })),
}));

describe("Offline Sync & Habit Check-in Negotiation", () => {
  let app;

  beforeEach(() => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.get("/checkin", routineController.checkin);
    app.post("/checkin", routineController.checkin);
  });

  test("GET /checkin returns HTML by default for browser navigations", async () => {
    const email = "user@example.com";
    const token = generateActionToken(email, "checkin");

    sharedData.getUserByEmail.mockResolvedValue({
      email,
      timezone: "UTC",
      routineTrack: "deep-work",
    });

    sharedData.recordCheckin.mockResolvedValue({
      streakCount: 5,
      alreadyCheckedInToday: false,
    });

    const res = await request(app).get(
      `/checkin?email=${encodeURIComponent(email)}&token=${token}`,
    );

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/text\/html/);
    expect(res.text).toContain("Day 5 Complete! 🔥");
  });

  test("GET /checkin returns JSON when request has X-Offline-Sync header", async () => {
    const email = "user@example.com";
    const token = generateActionToken(email, "checkin");

    sharedData.getUserByEmail.mockResolvedValue({
      email,
      timezone: "UTC",
      routineTrack: "deep-work",
    });

    sharedData.recordCheckin.mockResolvedValue({
      streakCount: 6,
      alreadyCheckedInToday: false,
    });

    const res = await request(app)
      .get(`/checkin?email=${encodeURIComponent(email)}&token=${token}`)
      .set("X-Offline-Sync", "true");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toMatch(/application\/json/);
    expect(res.body.success).toBe(true);
    expect(res.body.streakCount).toBe(6);
  });

  test("POST /checkin handles background sync payload via POST body", async () => {
    const email = "user@example.com";
    const token = generateActionToken(email, "checkin");

    sharedData.getUserByEmail.mockResolvedValue({
      email,
      timezone: "America/New_York",
      routineTrack: "deep-work",
    });

    sharedData.recordCheckin.mockResolvedValue({
      streakCount: 7,
      alreadyCheckedInToday: true,
    });

    const res = await request(app)
      .post("/checkin")
      .send({ email, token })
      .set("Accept", "application/json");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.streakCount).toBe(7);
    expect(res.body.title).toContain("Already Checked In Today");
  });

  test("Service Worker defines sync-morning-journal tag and drainOfflineJournalQueue", () => {
    const fs = require("fs");
    const path = require("path");
    const swContent = fs.readFileSync(path.join(__dirname, "../public/sw.js"), "utf8");

    expect(swContent).toContain("sync-morning-journal");
    expect(swContent).toContain("drainOfflineJournalQueue");
    expect(swContent).toContain("journal_queue");
    expect(swContent).toContain("SYNC_JOURNAL_SUCCESS");
  });

  test("Offline sync script supports queueJournal, drainJournalQueue, and Background Sync tag", () => {
    const fs = require("fs");
    const path = require("path");
    const offlineSyncContent = fs.readFileSync(
      path.join(__dirname, "../public/js/offline-sync.js"),
      "utf8",
    );

    expect(offlineSyncContent).toContain("sync-morning-journal");
    expect(offlineSyncContent).toContain("queueJournal");
    expect(offlineSyncContent).toContain("drainJournalQueue");
    expect(offlineSyncContent).toContain("journal_queue");
    expect(offlineSyncContent).toContain("SYNC_JOURNAL_SUCCESS");
  });
});
