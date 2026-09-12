process.env.USE_MOCK_REDIS = "true";

const express = require("express");
const request = require("supertest");
const cookieParser = require("cookie-parser");

const { getWeatherSpark } = require("../helper/weatherSpark");
const { getStreakMilestones, MILESTONE_TIERS } = require("../helper/streakMilestones");
const {
  setAnnouncement,
  getActiveAnnouncement,
  clearAnnouncement,
} = require("../helper/announcementService");

jest.mock("../db/knex", () => {
  const mKnex = function (table) {
    if (table === "suppression_list") {
      return {
        orderBy: jest.fn().mockReturnThis(),
        limit: jest.fn().mockResolvedValue([
          {
            email: "bounced@example.com",
            reason: "hard_bounce",
            created_at: new Date().toISOString(),
          },
        ]),
      };
    }
    return {
      select: jest.fn().mockReturnThis(),
      where: jest.fn().mockReturnThis(),
      first: jest.fn().mockResolvedValue(null),
    };
  };
  mKnex.raw = jest.fn();
  return mKnex;
});

jest.mock("../email-core/emailTracker", () => ({
  getHistory: jest.fn().mockResolvedValue([]),
  recordSentEmail: jest.fn().mockResolvedValue({}),
  recordSend: jest.fn().mockResolvedValue({}),
  recordFailure: jest.fn().mockResolvedValue({}),
}));

jest.mock("../email-core/suppressionService", () => ({
  checkPreSendEligibility: jest.fn().mockResolvedValue({ isSuppressed: false }),
  removeSuppression: jest.fn().mockResolvedValue(true),
}));

jest.mock("../helper/shared-data", () => {
  const users = [
    {
      email: "active-user@example.com",
      routineTrack: "deep-work",
      timezone: "Asia/Kolkata",
      cronPattern: "0 7 * * *",
      streakCount: 15,
      isActive: true,
      weekendRoutineTrack: "mindfulness",
      weekendCronPattern: "0 9 * * 0,6",
      emailDensity: "standard",
      locationCity: "Bengaluru",
      vacationUntil: null,
      vacationReason: null,
    },
  ];

  return {
    getUserByEmail: jest.fn().mockImplementation(async (email) => {
      return users.find((u) => u.email === email) || null;
    }),
    updateUser: jest.fn().mockImplementation(async (email, updates) => {
      const user = users.find((u) => u.email === email);
      if (user) {
        Object.assign(user, updates);
        return { ...user };
      }
      return null;
    }),
    recordCheckin: jest.fn().mockImplementation(async (email) => {
      const user = users.find((u) => u.email === email);
      if (user) {
        user.streakCount = (user.streakCount || 0) + 1;
        return { success: true, streak: user.streakCount };
      }
      return { success: false };
    }),
    getTrackContent: jest.fn().mockReturnValue({
      name: "Deep Work & Builder",
      ritual: "Morning Code Sprint",
      checklist: ["Hydrate", "Focus"],
    }),
  };
});

const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const adminRoutes = require("../routes/admin.routes");

function buildUserApp(email = "active-user@example.com") {
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use((req, _res, next) => {
    if (email) req.subscriberEmail = email;
    next();
  });
  app.use(subscriberPortalRoutes);
  return app;
}

function buildAdminApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser("test-secret"));
  app.use((req, _res, next) => {
    req.signedCookies = { mrn_role: "admin" };
    req.adminAuthenticated = true;
    next();
  });
  app.use(adminRoutes);
  return app;
}

describe("Weather Spark Generator", () => {
  test("generates deterministic weather spark for given city and date", () => {
    const spark1 = getWeatherSpark("Tokyo", "UTC", new Date("2026-10-15"));
    const spark2 = getWeatherSpark("Tokyo", "UTC", new Date("2026-10-15"));

    expect(spark1.city).toBe("Tokyo");
    expect(spark1.condition).toBeTruthy();
    expect(spark1.tempC).toBe(spark2.tempC);
    expect(spark1.formattedSpark).toContain("Tokyo");
  });

  test("returns null when city is empty or invalid", () => {
    const spark = getWeatherSpark(null);
    expect(spark).toBeNull();
  });
});

describe("Streak Milestones Helper", () => {
  test("calculates milestone status for 0-day streak", () => {
    const result = getStreakMilestones(0);
    expect(result.streakCount).toBe(0);
    expect(result.nextMilestone.id).toBe("bronze-ignition");
    expect(result.daysRemaining).toBe(3);
    expect(result.highestUnlocked).toBeNull();
  });

  test("calculates milestone status for 15-day streak", () => {
    const result = getStreakMilestones(15);
    expect(result.streakCount).toBe(15);
    expect(result.highestUnlocked.id).toBe("fortitude-pioneer"); // 14d
    expect(result.nextMilestone.id).toBe("habit-alchemist"); // 21d
    expect(result.daysRemaining).toBe(6);
  });

  test("calculates milestone status when all milestones unlocked", () => {
    const result = getStreakMilestones(150);
    expect(result.highestUnlocked.id).toBe("centurion-legend");
    expect(result.nextMilestone).toBeNull();
    expect(result.daysRemaining).toBe(0);
  });
});

describe("Announcement Service", () => {
  beforeEach(async () => {
    await clearAnnouncement();
  });

  test("sets, retrieves, and clears global routine announcement", async () => {
    expect(await getActiveAnnouncement()).toBeNull();

    await setAnnouncement({
      title: "Community Sprint",
      message: "Join the 7-day focus challenge starting Monday!",
      targetTrack: "all",
      priority: "high",
    });

    const active = await getActiveAnnouncement("deep-work");
    expect(active).not.toBeNull();
    expect(active.title).toBe("Community Sprint");
    expect(active.priority).toBe("high");

    await clearAnnouncement();
    expect(await getActiveAnnouncement()).toBeNull();
  });

  test("filters announcement by target track", async () => {
    await setAnnouncement({
      title: "Mindfulness Masterclass",
      message: "New breathing guide released.",
      targetTrack: "mindfulness",
    });

    const deepWorkActive = await getActiveAnnouncement("deep-work");
    const mindfulnessActive = await getActiveAnnouncement("mindfulness");

    expect(deepWorkActive).toBeNull();
    expect(mindfulnessActive).not.toBeNull();
    expect(mindfulnessActive.title).toBe("Mindfulness Masterclass");
  });
});

describe("Subscriber Portal - Vacation Mode & Milestones Endpoints", () => {
  test("POST /me/vacation/pause sets future vacation return date", async () => {
    const app = buildUserApp();
    const futureDate = new Date();
    futureDate.setDate(futureDate.getDate() + 10);
    const dateStr = futureDate.toISOString().split("T")[0];

    const res = await request(app)
      .post("/me/vacation/pause")
      .send({ untilDate: dateStr, reason: "Summer Holiday" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.vacationUntil).toContain(dateStr);
  });

  test("POST /me/vacation/pause rejects past return date", async () => {
    const app = buildUserApp();
    const res = await request(app)
      .post("/me/vacation/pause")
      .send({ untilDate: "2020-01-01", reason: "Past" });

    expect(res.status).toBe(400);
    expect(res.body.error).toContain("future");
  });

  test("POST /me/vacation/resume clears vacation mode", async () => {
    const app = buildUserApp();
    const res = await request(app).post("/me/vacation/resume");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.subscriber.vacationUntil).toBeNull();
  });

  test("GET /me/milestones returns streak milestone badges", async () => {
    const app = buildUserApp();
    const res = await request(app).get("/me/milestones");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.milestones)).toBe(true);
    expect(res.body.milestones.length).toBe(7);
  });
});

describe("Admin Telemetry - Queue, Suppressions & Announcements", () => {
  test("GET /admin/api/scheduler/queue returns upcoming dispatch queue", async () => {
    const app = buildAdminApp();
    const res = await request(app).get("/admin/api/scheduler/queue");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.queue)).toBe(true);
  });

  test("GET /admin/api/suppressions returns suppressed email list", async () => {
    const app = buildAdminApp();
    const res = await request(app).get("/admin/api/suppressions");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(Array.isArray(res.body.suppressions)).toBe(true);
  });

  test("POST /admin/api/suppressions/unsuppress unblocks an email", async () => {
    const app = buildAdminApp();
    const res = await request(app)
      .post("/admin/api/suppressions/unsuppress")
      .send({ email: "bounced@example.com" });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });

  test("POST /admin/api/announcements creates announcement", async () => {
    const app = buildAdminApp();
    const res = await request(app).post("/admin/api/announcements").send({
      title: "Test Announcement",
      message: "System upgrade tonight",
      targetTrack: "all",
    });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.announcement.title).toBe("Test Announcement");
  });

  test("DELETE /admin/api/announcements clears active announcement", async () => {
    const app = buildAdminApp();
    const res = await request(app).delete("/admin/api/announcements");

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
  });
});
