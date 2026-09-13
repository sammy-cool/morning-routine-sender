// __tests__/leaderboard.halloffame.test.js
process.env.USE_MOCK_REDIS = "true";

const { newDb } = require("pg-mem");
const express = require("express");
const request = require("supertest");
const subscribersMigration = require("../db/migrations/20260711172620_create_subscribers_table");
const streaksMigration = require("../db/migrations/20260828000000_add_streaks_and_track_to_subscribers");
const squadsMigration = require("../db/migrations/20260912000000_create_accountability_squads_tables");

let mockKnexInstance;
jest.mock("../db/knex", () => {
  const handler = (table) => mockKnexInstance(table);
  handler.transaction = async (cb) => cb(mockKnexInstance);
  handler.fn = { now: () => new Date() };
  handler.raw = (str) => str;
  Object.defineProperty(handler, "schema", {
    get: () => mockKnexInstance.schema,
  });
  return handler;
});

const leaderboardController = require("../controllers/leaderboard.controller");
const pagesRoutes = require("../routes/pages.routes");

describe("Community Leaderboard & Hall of Fame", () => {
  let app;
  let memDb;

  beforeEach(async () => {
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex(0);

    // Apply database migrations
    await subscribersMigration.up(mockKnexInstance);
    await streaksMigration.up(mockKnexInstance);
    await squadsMigration.up(mockKnexInstance);

    // Seed test subscribers with varying streaks and tracks
    await mockKnexInstance("subscribers").insert([
      {
        id: 1,
        email: "alexander.hamilton@example.com",
        cron_pattern: "0 8 * * *",
        streak_count: 120,
        routine_track: "deep-work",
        is_active: true,
      },
      {
        id: 2,
        email: "marcus.aurelius@stoic.org",
        cron_pattern: "0 7 * * *",
        streak_count: 45,
        routine_track: "mindfulness",
        is_active: true,
      },
      {
        id: 3,
        email: "ada.lovelace@tech.io",
        cron_pattern: "0 6 * * *",
        streak_count: 32,
        routine_track: "deep-work",
        is_active: true,
      },
      {
        id: 4,
        email: "inactive.user@secret.com",
        cron_pattern: "0 8 * * *",
        streak_count: 999,
        routine_track: "deep-work",
        is_active: false,
      },
      {
        id: 5,
        email: "serena.williams@champion.com",
        cron_pattern: "0 5 * * *",
        streak_count: 15,
        routine_track: "fitness",
        is_active: true,
      },
      {
        id: 6,
        email: "leonardo.davinci@art.it",
        cron_pattern: "0 9 * * *",
        streak_count: 8,
        routine_track: "creative",
        is_active: true,
      },
    ]);

    // Seed test accountability squads
    await mockKnexInstance("accountability_squads").insert([
      {
        id: 10,
        name: "Morning Titans",
        invite_code: "SQUAD-TITN",
        creator_email: "alexander.hamilton@example.com",
        max_members: 5,
        squad_streak: 42,
      },
      {
        id: 20,
        name: "Deep Flow Guild",
        invite_code: "SQUAD-FLOW",
        creator_email: "ada.lovelace@tech.io",
        max_members: 5,
        squad_streak: 28,
      },
    ]);

    // Seed squad members
    await mockKnexInstance("squad_members").insert([
      { squad_id: 10, subscriber_email: "alexander.hamilton@example.com", role: "leader" },
      { squad_id: 10, subscriber_email: "marcus.aurelius@stoic.org", role: "member" },
      { squad_id: 10, subscriber_email: "ada.lovelace@tech.io", role: "member" },
      { squad_id: 20, subscriber_email: "ada.lovelace@tech.io", role: "leader" },
    ]);

    app = express();
    app.use(express.json());
    app.use(pagesRoutes);
  });

  describe("API Endpoint (JSON response)", () => {
    test("GET /api/leaderboard returns success with leaders and squads array", async () => {
      const res = await request(app).get("/api/leaderboard");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(Array.isArray(res.body.leaders)).toBe(true);
      expect(Array.isArray(res.body.squads)).toBe(true);
      expect(res.body.leaders.length).toBe(5); // Inactive user excluded

      // Sorted descending by streak count
      expect(res.body.leaders[0].streakCount).toBe(120);
      expect(res.body.leaders[1].streakCount).toBe(45);
      expect(res.body.leaders[2].streakCount).toBe(32);
      expect(res.body.leaders[3].streakCount).toBe(15);
      expect(res.body.leaders[4].streakCount).toBe(8);

      // Verify squads ranking
      expect(res.body.squads.length).toBe(2);
      expect(res.body.squads[0].name).toBe("Morning Titans");
      expect(res.body.squads[0].memberCount).toBe(3);
    });

    test("GET /leaderboard with Accept: application/json returns JSON", async () => {
      const res = await request(app).get("/leaderboard").set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leaders).toBeDefined();
      expect(res.body.squads).toBeDefined();
    });

    test("GET /hall-of-fame with Accept: application/json returns JSON", async () => {
      const res = await request(app).get("/hall-of-fame").set("Accept", "application/json");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leaders).toBeDefined();
    });

    test("Filters leaders by routine track (?track=deep-work)", async () => {
      const res = await request(app).get("/api/leaderboard?track=deep-work");

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.leaders.length).toBe(2); // Only Alexander and Ada

      res.body.leaders.forEach((leader) => {
        expect(leader.routineTrack).toBe("deep-work");
      });
    });

    test("Excludes inactive subscribers (isActive = false)", async () => {
      const res = await request(app).get("/api/leaderboard?track=all");

      expect(res.status).toBe(200);
      const emails = res.body.leaders.map((l) => l.email + l.anonymizedEmail);
      expect(emails.join(" ")).not.toContain("inactive.user@secret.com");
      expect(emails.join(" ")).not.toContain("inactive");
    });

    test("Anonymizes sensitive raw email addresses strictly", async () => {
      const res = await request(app).get("/api/leaderboard");

      expect(res.status).toBe(200);
      const jsonString = JSON.stringify(res.body);

      // Raw unmasked emails must never appear anywhere in the output
      expect(jsonString).not.toContain("alexander.hamilton@example.com");
      expect(jsonString).not.toContain("marcus.aurelius@stoic.org");
      expect(jsonString).not.toContain("ada.lovelace@tech.io");
      expect(jsonString).not.toContain("serena.williams@champion.com");

      // Verify masked formats
      const leader1 = res.body.leaders[0];
      expect(leader1.anonymizedEmail).toContain("****@");
      expect(leader1.handle).toContain("****");
      expect(leader1.email).toContain("****@");
    });

    test("Computes milestone badges and consistency grades correctly", async () => {
      const res = await request(app).get("/api/leaderboard");

      expect(res.status).toBe(200);
      const centurionLeader = res.body.leaders[0]; // 120 days
      expect(centurionLeader.milestoneBadges).toContain("Century Club");
      expect(centurionLeader.milestoneBadges).toContain("30-Day Master");
      expect(centurionLeader.consistencyGrade).toBe("A+");

      const masterLeader = res.body.leaders[1]; // 45 days
      expect(masterLeader.milestoneBadges).toContain("30-Day Master");
      expect(masterLeader.consistencyGrade).toBe("A");

      const pioneerLeader = res.body.leaders[3]; // 15 days
      expect(pioneerLeader.milestoneBadges).toContain("14-Day Pioneer");
      expect(pioneerLeader.consistencyGrade).toBe("A-");
    });
  });

  describe("HTML Rendering (Obsidian Glassmorphic Web Page)", () => {
    test("GET /leaderboard returns 200 with <!DOCTYPE html> and OpenGraph SEO tags", async () => {
      const res = await request(app).get("/leaderboard").set("Accept", "text/html");

      expect(res.status).toBe(200);
      expect(res.headers["content-type"]).toContain("text/html");
      expect(res.text).toContain("<!DOCTYPE html>");
      expect(res.text).toContain('<html lang="en">');

      // SEO & Social OpenGraph Tags
      expect(res.text).toContain('property="og:title"');
      expect(res.text).toContain('property="og:description"');
      expect(res.text).toContain('property="og:image"');
      expect(res.text).toContain('property="og:url"');
      expect(res.text).toContain('name="twitter:card"');

      // Hero Title
      expect(res.text).toContain(
        "🏆 Morning Routine Hall of Fame — Unbroken Streaks &amp; Community Leaderboard",
      );

      // Routine Track Filter Tabs
      expect(res.text).toContain("All Tracks");
      expect(res.text).toContain("Deep Work");
      expect(res.text).toContain("Stoic Mindset");
      expect(res.text).toContain("Fitness");
      expect(res.text).toContain("Creative");

      // Podium Top 3 badges & neon rings
      expect(res.text).toContain("podium-container");
      expect(res.text).toContain("avatar-neon-ring");
      expect(res.text).toContain("🥇");
      expect(res.text).toContain("🥈");
      expect(res.text).toContain("🥉");

      // Leaderboard Table Structure
      expect(res.text).toContain('<table class="leaderboard-table"');
      expect(res.text).toContain("<th>Rank</th>");
      expect(res.text).toContain("<th>Ritualist</th>");
      expect(res.text).toContain("<th>Track</th>");
      expect(res.text).toContain("<th>Streak</th>");
      expect(res.text).toContain("<th>Milestone Badges</th>");
      expect(res.text).toContain("<th>Grade</th>");

      // Squad Rankings Card
      expect(res.text).toContain("Top Squads");
      expect(res.text).toContain("Morning Titans");

      // Viral CTAs
      expect(res.text).toContain("Start Your Unbroken Streak Today");
      expect(res.text).toContain("Challenge to Morning Duel");

      // Anonymization in HTML
      expect(res.text).not.toContain("alexander.hamilton@example.com");
      expect(res.text).not.toContain("marcus.aurelius@stoic.org");
    });

    test("GET /hall-of-fame renders HTML view identically", async () => {
      const res = await request(app).get("/hall-of-fame").set("Accept", "text/html");

      expect(res.status).toBe(200);
      expect(res.text).toContain("<!DOCTYPE html>");
      expect(res.text).toContain("Hall of Fame");
    });
  });

  describe("Helper Functions Unit Tests", () => {
    test("anonymizeEmail masks correctly for short and long emails", () => {
      expect(leaderboardController.anonymizeEmail("alex@gmail.com")).toBe("al****@gmail.com");
      expect(leaderboardController.anonymizeEmail("alexander@gmail.com")).toBe(
        "alex****@gmail.com",
      );
      expect(leaderboardController.anonymizeEmail("a@b.com")).toBe("a****@b.com");
      expect(leaderboardController.anonymizeEmail(null)).toBe("anonymous@user.net");
    });

    test("getDisplayHandle generates @prefix****", () => {
      expect(leaderboardController.getDisplayHandle("alex@gmail.com")).toBe("@al****");
      expect(leaderboardController.getDisplayHandle("developer@company.org")).toBe("@deve****");
      expect(leaderboardController.getDisplayHandle("")).toBe("@builder");
    });

    test("getConsistencyGrade maps streaks correctly", () => {
      expect(leaderboardController.getConsistencyGrade(100)).toBe("A+");
      expect(leaderboardController.getConsistencyGrade(60)).toBe("A+");
      expect(leaderboardController.getConsistencyGrade(30)).toBe("A");
      expect(leaderboardController.getConsistencyGrade(14)).toBe("A-");
      expect(leaderboardController.getConsistencyGrade(7)).toBe("B+");
      expect(leaderboardController.getConsistencyGrade(3)).toBe("B");
      expect(leaderboardController.getConsistencyGrade(1)).toBe("B-");
      expect(leaderboardController.getConsistencyGrade(0)).toBe("C");
    });

    test("getMilestoneBadges unlocks escalating milestones", () => {
      expect(leaderboardController.getMilestoneBadges(2)).toEqual([]);
      expect(leaderboardController.getMilestoneBadges(3)).toEqual(["3-Day Spark"]);
      expect(leaderboardController.getMilestoneBadges(30)).toEqual([
        "3-Day Spark",
        "7-Day Momentum",
        "14-Day Pioneer",
        "21-Day Habit Loop",
        "30-Day Master",
      ]);
      expect(leaderboardController.getMilestoneBadges(100)).toContain("Century Club");
      expect(leaderboardController.getMilestoneBadges(365)).toContain("Solar Legend");
    });

    test("renderLeaderboardHtml handles empty leaders and squads gracefully", () => {
      const html = leaderboardController.renderLeaderboardHtml({
        leaders: [],
        squads: [],
        track: "all",
        host: "test.com",
      });
      expect(html).toContain("<!DOCTYPE html>");
      expect(html).toContain("No active streaks recorded in this track yet");
      expect(html).toContain("No accountability squads formed yet");
    });
  });
});
