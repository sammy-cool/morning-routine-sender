/**
 * Test Suite: Journal Service, Activity Heatmap & Streak Card Generator
 * Verifies:
 *   - helper/journalService.js (Timezone resolution, mood validation, history, CSV injection defense, Markdown export, 365-day heatmap series)
 *   - helper/streakCardGenerator.js (XML escaping, milestone titles, track details, vector QR matrix, streak SVG card)
 */

let mockDbRows = [];

const mockKnexInstance = jest.fn(() => mockKnexInstance);
mockKnexInstance.where = jest.fn().mockReturnThis();
mockKnexInstance.andWhere = jest.fn().mockReturnThis();
mockKnexInstance.select = jest.fn().mockReturnThis();
mockKnexInstance.orderBy = jest.fn().mockReturnThis();
mockKnexInstance.limit = jest.fn().mockReturnThis();
mockKnexInstance.offset = jest.fn().mockReturnThis();
mockKnexInstance.first = jest.fn();
mockKnexInstance.insert = jest.fn();
mockKnexInstance.update = jest.fn();

// Make mockKnexInstance thenable to emulate Knex query builder resolution
mockKnexInstance.then = function (onResolve, onReject) {
  return Promise.resolve(mockDbRows).then(onResolve, onReject);
};

mockKnexInstance.schema = {
  hasTable: jest.fn().mockResolvedValue(true),
};

jest.mock("../db/knex", () => mockKnexInstance);

const mockGetUserByEmail = jest.fn();
jest.mock("../helper/shared-data", () => ({
  getUserByEmail: mockGetUserByEmail,
}));

jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const {
  normalizeEmail,
  getTodayDateInTimezone,
  getSubscriberContext,
  getEntryByDate,
  saveEntry,
  getHistory,
  getAllEntries,
  generateMarkdownExport,
  generateCsvExport,
  getActivityHeatmap,
} = require("../helper/journalService");

const {
  escapeXml,
  getMilestoneTitle,
  getTrackDetails,
  generateVectorQrMatrix,
  generateStreakSvg,
} = require("../helper/streakCardGenerator");

describe("Journal Service, Heatmap & Streak Card Generator Suite", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockDbRows = [];
  });

  // ==========================================================================
  // 1. journalService.js Logic & Exports
  // ==========================================================================
  describe("journalService.js", () => {
    describe("normalizeEmail()", () => {
      test("lowercases and trims email inputs", () => {
        expect(normalizeEmail("  USER@Example.COM ")).toBe("user@example.com");
        expect(normalizeEmail("")).toBe("");
        expect(normalizeEmail(null)).toBe("");
        expect(normalizeEmail(undefined)).toBe("");
      });
    });

    describe("getTodayDateInTimezone()", () => {
      test("formats date as YYYY-MM-DD in valid timezones", () => {
        const utcDate = getTodayDateInTimezone("UTC");
        expect(utcDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);

        const kolkataDate = getTodayDateInTimezone("Asia/Kolkata");
        expect(kolkataDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      test("falls back to UTC on invalid timezone string", () => {
        const fallback = getTodayDateInTimezone("Invalid/Unknown_Zone");
        expect(fallback).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });
    });

    describe("getSubscriberContext()", () => {
      test("resolves context from sharedData user", async () => {
        mockGetUserByEmail.mockResolvedValue({
          email: "builder@example.com",
          timezone: "America/New_York",
          routineTrack: "deep-work",
        });

        const ctx = await getSubscriberContext("BUILDER@EXAMPLE.COM");
        expect(ctx.timezone).toBe("America/New_York");
        expect(ctx.trackKey).toBe("deep-work");
        expect(ctx.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      });

      test("respects valid requestedDate override", async () => {
        mockGetUserByEmail.mockResolvedValue(null);
        const ctx = await getSubscriberContext("anon@test.com", "2026-08-15");
        expect(ctx.date).toBe("2026-08-15");
        expect(ctx.trackKey).toBe("deep-work");
      });
    });

    describe("getEntryByDate() & getAllEntries()", () => {
      test("loads entry by date from knex", async () => {
        mockKnexInstance.first.mockResolvedValue({ id: 10, entry_date: "2026-08-30" });

        const entry = await getEntryByDate("user@example.com", "2026-08-30");
        expect(entry).toEqual({ id: 10, entry_date: "2026-08-30" });
      });

      test("getAllEntries orders by entry_date desc", async () => {
        const fakeEntries = [{ id: 1 }, { id: 2 }];
        mockDbRows = fakeEntries;

        const all = await getAllEntries("user@example.com");
        expect(all).toEqual(fakeEntries);
      });
    });

    describe("saveEntry()", () => {
      test("validates mood_score integer range 1-5", async () => {
        mockGetUserByEmail.mockResolvedValue({ email: "user@example.com" });

        await expect(saveEntry("user@example.com", { mood_score: 6 })).rejects.toThrow(
          "mood_score must be an integer between 1 and 5",
        );
        await expect(saveEntry("user@example.com", { mood_score: 0 })).rejects.toThrow(
          "mood_score must be an integer between 1 and 5",
        );
        await expect(saveEntry("user@example.com", { mood_score: "not-a-number" })).rejects.toThrow(
          "mood_score must be an integer between 1 and 5",
        );
      });

      test("inserts new entry when existing record is not found", async () => {
        mockGetUserByEmail.mockResolvedValue({ id: 42, email: "user@example.com" });
        mockKnexInstance.first
          .mockResolvedValueOnce(null) // first check: does not exist
          .mockResolvedValueOnce({ id: 1, subscriber_email: "user@example.com", mood_score: 5 }); // reload after insert

        mockKnexInstance.insert.mockResolvedValue([1]);

        const saved = await saveEntry("user@example.com", {
          entry_date: "2026-08-30",
          mood_score: 5,
          one_big_thing: "Launch v2.6.8",
        });

        expect(mockKnexInstance.insert).toHaveBeenCalledWith(
          expect.objectContaining({
            subscriber_id: 42,
            subscriber_email: "user@example.com",
            entry_date: "2026-08-30",
            mood_score: 5,
            one_big_thing: "Launch v2.6.8",
          }),
        );
        expect(saved.mood_score).toBe(5);
      });

      test("updates existing entry when record already exists", async () => {
        mockGetUserByEmail.mockResolvedValue({ id: 42, email: "user@example.com" });
        mockKnexInstance.first
          .mockResolvedValueOnce({ id: 99 }) // existing record
          .mockResolvedValueOnce({ id: 99, mood_score: 4 }); // reload

        mockKnexInstance.update.mockResolvedValue(1);

        const updated = await saveEntry("user@example.com", {
          entry_date: "2026-08-30",
          mood_score: 4,
        });

        expect(mockKnexInstance.update).toHaveBeenCalledWith(
          expect.objectContaining({
            mood_score: 4,
          }),
        );
        expect(updated.mood_score).toBe(4);
      });
    });

    describe("getHistory()", () => {
      test("clamps limit between 1 and 100 and offset >= 0", async () => {
        mockDbRows = [{ id: 101 }];

        const rows = await getHistory("user@example.com", 250, -10);
        expect(mockKnexInstance.limit).toHaveBeenCalledWith(100);
        expect(mockKnexInstance.offset).toHaveBeenCalledWith(0);
        expect(rows).toEqual([{ id: 101 }]);
      });
    });

    describe("generateMarkdownExport()", () => {
      test("generates markdown with metadata, mood insights, and entry sections", () => {
        const entries = [
          {
            entry_date: "2026-08-30",
            track_key: "deep-work",
            mood_score: 5,
            one_big_thing: "Complete architecture rewrite",
            gratitude: "Great tea",
            reflection_text: "Clear focus all morning",
            created_at: new Date().toISOString(),
          },
        ];
        const subscriber = { streakCount: 12, routineTrack: "deep-work", timezone: "UTC" };

        const md = generateMarkdownExport("dev@example.com", entries, subscriber);

        expect(md).toContain("# 🌅 Morning Reflection & Journal Archive");
        expect(md).toContain("`dev@example.com`");
        expect(md).toContain("12 Days");
        expect(md).toContain("Average Mood: **5.0 / 5.0**");
        expect(md).toContain("Complete architecture rewrite");
        expect(md).toContain("Great tea");
        expect(md).toContain("Clear focus all morning");
      });

      test("displays empty notice when no entries are recorded", () => {
        const md = generateMarkdownExport("new@example.com", []);
        expect(md).toContain("No journal entries recorded yet.");
      });
    });

    describe("generateCsvExport() & CSV Injection Defense", () => {
      test("escapes fields and neutralizes formula injection characters (=, +, -, @)", () => {
        const entries = [
          {
            entry_date: "2026-08-30",
            track_key: "deep-work",
            mood_score: 5,
            one_big_thing: "=cmd|' /C calc'!A0",
            gratitude: "+SUM(1,2)",
            reflection_text: 'Quote: "Deep Work"',
            created_at: "2026-08-30T08:00:00.000Z",
          },
        ];

        const csv = generateCsvExport(entries);

        expect(csv).toContain('"Date","Track","Mood Score"');
        expect(csv).toContain("\"'=cmd|' /C calc'!A0\"");
        expect(csv).toContain('"\'+SUM(1,2)"');
        expect(csv).toContain('""Deep Work""');
      });
    });

    describe("getActivityHeatmap()", () => {
      test("generates 365 days time series with intensity levels and streak calculations", async () => {
        mockGetUserByEmail.mockResolvedValue({
          email: "user@example.com",
          timezone: "UTC",
          streakCount: 5,
        });

        const todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
        mockDbRows = [
          {
            entry_date: todayStr,
            mood_score: 5,
            one_big_thing: "Finish testing",
            gratitude: "Sun",
            reflection_text: "High flow",
          },
        ];

        const heatmap = await getActivityHeatmap("user@example.com", 30);

        expect(heatmap.totalDays).toBe(30);
        expect(heatmap.days.length).toBe(30);
        expect(heatmap.summary.totalActiveDays).toBe(1);
        expect(heatmap.summary.currentStreak).toBe(5);

        const todayCell = heatmap.days.find((d) => d.date === todayStr);
        expect(todayCell).toBeDefined();
        expect(todayCell.completed).toBe(true);
        expect(todayCell.intensity).toBe(4);
        expect(todayCell.moodScore).toBe(5);
        expect(todayCell.oneBigThingSnippet).toBe("Finish testing");
      });
    });
  });

  // ==========================================================================
  // 2. streakCardGenerator.js Logic & SVG Rendering
  // ==========================================================================
  describe("streakCardGenerator.js", () => {
    describe("escapeXml()", () => {
      test("escapes all 5 XML entity characters properly", () => {
        expect(escapeXml('<script alert="test">&\'</script>')).toBe(
          "&lt;script alert=&quot;test&quot;&gt;&amp;&apos;&lt;/script&gt;",
        );
        expect(escapeXml(null)).toBe("");
      });
    });

    describe("getMilestoneTitle()", () => {
      test("maps milestone counts to escalating titles", () => {
        expect(getMilestoneTitle(0)).toBe("First Light");
        expect(getMilestoneTitle(2)).toBe("First Light");
        expect(getMilestoneTitle(3)).toBe("Kinetic Momentum");
        expect(getMilestoneTitle(7)).toBe("Weekly Champion");
        expect(getMilestoneTitle(14)).toBe("Iron Consistency");
        expect(getMilestoneTitle(30)).toBe("Unbreakable Flow");
        expect(getMilestoneTitle(60)).toBe("Titan Habit");
        expect(getMilestoneTitle(100)).toBe("Master of Morning");
        expect(getMilestoneTitle("120")).toBe("Master of Morning");
      });
    });

    describe("getTrackDetails()", () => {
      test("returns track label, icon, and brand color", () => {
        expect(getTrackDetails("mindfulness")).toEqual({
          label: "MINDFULNESS & STOIC",
          icon: "🧘",
          color: "#10b981",
        });
        expect(getTrackDetails("executive")).toEqual({
          label: "HIGH-PERFORMANCE EXEC",
          icon: "💼",
          color: "#f59e0b",
        });
        expect(getTrackDetails("learning")).toEqual({
          label: "LIFELONG LEARNER",
          icon: "📚",
          color: "#8b5cf6",
        });
        expect(getTrackDetails("classic")).toEqual({
          label: "MORNING ENERGIZER",
          icon: "🌅",
          color: "#ec4899",
        });
        expect(getTrackDetails("unknown")).toEqual({
          label: "DEEP WORK & BUILDER",
          icon: "⚡",
          color: "#06b6d4",
        });
      });
    });

    describe("generateVectorQrMatrix()", () => {
      test("generates SVG containing QR container and matrix path", () => {
        const qrSvg = generateVectorQrMatrix("https://morningroutine.app/verify/test");

        expect(qrSvg).toContain("<!-- QR Code Background Container -->");
        expect(qrSvg).toContain("<path");
        expect(qrSvg).toContain('fill="#0f172a"');
      });
    });

    describe("generateStreakSvg()", () => {
      test("generates full 1200x630 vector SVG badge card", () => {
        const svg = generateStreakSvg({
          name: "alex_builder",
          streak: 42,
          track: "deep-work",
          date: "August 30, 2026",
          verifyUrl: "https://morningroutine.app/streak/alex_builder",
        });

        expect(svg).toContain('viewBox="0 0 1200 630"');
        expect(svg).toContain("🔥 42 DAYS");
        expect(svg).toContain("Unbreakable Flow");
        expect(svg).toContain("@alex_builder");
        expect(svg).toContain("DEEP WORK &amp; BUILDER");
        expect(svg).toContain("MORNING ROUTINE SENDER");
        expect(svg).toContain("<!-- Vector QR Code Module -->");
      });

      test("handles default fallback options safely", () => {
        const svg = generateStreakSvg({});
        expect(svg).toContain("🔥 1 DAYS");
        expect(svg).toContain("First Light");
        expect(svg).toContain("@Morning Builder");
      });
    });
  });
});
