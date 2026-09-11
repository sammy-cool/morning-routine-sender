process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const cookieParser = require("cookie-parser");

jest.mock("../db/knex", () => ({}));
jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn(),
  recordSentEmail: jest.fn(),
}));
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: jest.fn(),
  recordCheckin: jest.fn(),
  getTrackContent: jest.fn().mockImplementation((track) => ({
    name: track === "mindfulness" ? "Mindfulness & Stoic" : "Deep Work & Builder",
    ritual: track === "mindfulness" ? "Box Breathing & Mindful Walking" : "Deep Work Sprint",
    checklist: ["Hydrate 500ml", "Focus Sprint"],
  })),
}));

const sharedData = require("../helper/shared-data");
const { generateActionToken, generateCalendarToken } = require("../helper/unsubscribeToken");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");

function buildApp(mockEmail = "test@example.com") {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (mockEmail) {
      req.subscriberEmail = mockEmail;
    }
    next();
  });
  app.use(subscriberPortalRoutes);
  return app;
}

describe("Live iCalendar (.ics) Feed & Webcal Integration", () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  test("GET /me/calendar.ics returns RFC 5545 compliant calendar for authenticated subscriber", async () => {
    const email = "focus-builder@example.com";
    sharedData.getUserByEmail.mockResolvedValue({
      email,
      routineTrack: "deep-work",
      timezone: "America/New_York",
      preferredTime: "06:45",
      focusDurationMinutes: 45,
    });

    const app = buildApp(email);
    const res = await request(app).get("/me/calendar.ics");

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.headers["content-disposition"]).toContain("morning-routine.ics");
    expect(res.text).toContain("BEGIN:VCALENDAR");
    expect(res.text).toContain("VERSION:2.0");
    expect(res.text).toContain("PRODID:-//Morning Routine Sender//EN");
    expect(res.text).toContain("RRULE:FREQ=DAILY");
    expect(res.text).toContain("X-WR-CALNAME:Morning Routine • Deep Work & Builder");
    expect(res.text).toContain("X-WR-TIMEZONE:America/New_York");
    expect(res.text).toContain("SUMMARY:⚡ Morning Routine: Deep Work & Builder");
    expect(res.text).toContain("BEGIN:VALARM");
    expect(res.text).toContain("TRIGGER:-PT10M");
    expect(res.text).toContain("END:VCALENDAR");
  });

  test("GET /me/calendar.ics returns 404 when subscriber record not found", async () => {
    sharedData.getUserByEmail.mockResolvedValue(null);
    const app = buildApp("nonexistent@example.com");
    const res = await request(app).get("/me/calendar.ics");

    expect(res.status).toBe(404);
    expect(res.body.error).toBe("Subscriber not found");
  });

  test("GET /calendar/feed/:token returns valid calendar when valid token provided", async () => {
    const email = "subscriber-webcal@example.com";
    const validToken = generateCalendarToken(email);

    sharedData.getUserByEmail.mockResolvedValue({
      email,
      routineTrack: "mindfulness",
      timezone: "Europe/London",
      preferredTime: "07:15",
      focusDurationMinutes: 30,
    });

    const app = buildApp(null);
    const res = await request(app).get(`/calendar/feed/${validToken}.ics`);

    expect(res.status).toBe(200);
    expect(res.headers["content-type"]).toContain("text/calendar");
    expect(res.text).toContain("BEGIN:VCALENDAR");
    expect(res.text).toContain("X-WR-CALNAME:Morning Routine • Mindfulness & Stoic");
    expect(res.text).toContain("X-WR-TIMEZONE:Europe/London");
    expect(res.text).toContain("SUMMARY:⚡ Morning Routine: Mindfulness & Stoic");
  });

  test("GET /calendar/feed/:token rejects invalid token with 401", async () => {
    const app = buildApp(null);
    const res = await request(app).get("/calendar/feed/invalid-or-tampered-token");

    expect(res.status).toBe(401);
    expect(res.text).toContain("Invalid or expired calendar feed token");
  });
});
