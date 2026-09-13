// __tests__/xp.gamification.test.js
const {
  XP_REWARDS,
  LEVEL_TIERS,
  calculateTotalXp,
  getLevelForXp,
  getXpProfile,
} = require("../helper/xpEngine");

describe("XP & Gamification Engine", () => {
  describe("XP_REWARDS constants", () => {
    test("all XP reward values are positive integers", () => {
      for (const [key, value] of Object.entries(XP_REWARDS)) {
        expect(typeof value).toBe("number");
        expect(value).toBeGreaterThan(0);
        expect(Number.isInteger(value)).toBe(true);
      }
    });

    test("has required action reward keys", () => {
      expect(XP_REWARDS.CHECKIN).toBeDefined();
      expect(XP_REWARDS.JOURNAL_ENTRY).toBeDefined();
      expect(XP_REWARDS.HARDWARE_CHECKIN).toBeDefined();
      expect(XP_REWARDS.SQUAD_DUEL_WIN).toBeDefined();
      expect(XP_REWARDS.VERIFIED_WAKEUP).toBeDefined();
    });
  });

  describe("LEVEL_TIERS structure", () => {
    test("has at least 5 level tiers", () => {
      expect(LEVEL_TIERS.length).toBeGreaterThanOrEqual(5);
    });

    test("tiers are sorted by ascending minXp", () => {
      for (let i = 1; i < LEVEL_TIERS.length; i++) {
        expect(LEVEL_TIERS[i].minXp).toBeGreaterThan(LEVEL_TIERS[i - 1].minXp);
      }
    });

    test("first tier starts at 0 XP", () => {
      expect(LEVEL_TIERS[0].minXp).toBe(0);
    });

    test("each tier has required properties", () => {
      for (const tier of LEVEL_TIERS) {
        expect(tier.level).toBeDefined();
        expect(typeof tier.name).toBe("string");
        expect(typeof tier.icon).toBe("string");
        expect(typeof tier.color).toBe("string");
        expect(typeof tier.minXp).toBe("number");
      }
    });
  });

  describe("calculateTotalXp()", () => {
    test("returns 0 for empty input", () => {
      expect(calculateTotalXp()).toBe(0);
      expect(calculateTotalXp({})).toBe(0);
    });

    test("calculates XP from checkins", () => {
      const xp = calculateTotalXp({ totalCheckins: 10 });
      expect(xp).toBe(10 * XP_REWARDS.CHECKIN);
    });

    test("calculates XP from journal entries", () => {
      const xp = calculateTotalXp({ journalEntries: 5 });
      expect(xp).toBe(5 * XP_REWARDS.JOURNAL_ENTRY);
    });

    test("calculates XP from hardware checkins", () => {
      const xp = calculateTotalXp({ hardwareCheckins: 3 });
      expect(xp).toBe(3 * XP_REWARDS.HARDWARE_CHECKIN);
    });

    test("adds streak milestone bonus for 7-day streak", () => {
      const xp = calculateTotalXp({ streakCount: 7 });
      expect(xp).toBe(XP_REWARDS.STREAK_MILESTONE_7);
    });

    test("adds streak milestone bonus for 100-day streak", () => {
      const xp = calculateTotalXp({ streakCount: 100 });
      expect(xp).toBe(XP_REWARDS.STREAK_MILESTONE_100);
    });

    test("combines multiple action types correctly", () => {
      const xp = calculateTotalXp({
        totalCheckins: 5,
        journalEntries: 3,
        streakCount: 14,
        duelWins: 2,
      });
      const expected =
        5 * XP_REWARDS.CHECKIN +
        3 * XP_REWARDS.JOURNAL_ENTRY +
        XP_REWARDS.STREAK_MILESTONE_14 +
        2 * XP_REWARDS.SQUAD_DUEL_WIN;
      expect(xp).toBe(expected);
    });

    test("handles negative values gracefully (clamps to 0)", () => {
      const xp = calculateTotalXp({ totalCheckins: -5, streakCount: -10 });
      expect(xp).toBe(0);
    });

    test("handles NaN / undefined values gracefully", () => {
      const xp = calculateTotalXp({
        totalCheckins: NaN,
        journalEntries: undefined,
        streakCount: null,
      });
      expect(xp).toBe(0);
    });
  });

  describe("getLevelForXp()", () => {
    test("returns Rookie (level 1) for 0 XP", () => {
      const level = getLevelForXp(0);
      expect(level.level).toBe(1);
      expect(level.name).toBe("Rookie");
    });

    test("returns correct level for mid-range XP", () => {
      const level = getLevelForXp(2000);
      expect(level.level).toBeGreaterThanOrEqual(3);
      expect(level.name).toBeDefined();
    });

    test("returns highest level for very high XP", () => {
      const level = getLevelForXp(999999);
      expect(level.level).toBe(LEVEL_TIERS[LEVEL_TIERS.length - 1].level);
      expect(level.nextTier).toBeNull();
      expect(level.progressPct).toBe(100);
    });

    test("calculates progress percentage correctly", () => {
      // Apprentice starts at 200, Warrior at 600 -> midpoint = 400 -> 50%
      const level = getLevelForXp(400);
      expect(level.level).toBe(2);
      expect(level.progressPct).toBe(50);
      expect(level.xpToNextLevel).toBe(200);
    });

    test("includes nextTier info when not at max level", () => {
      const level = getLevelForXp(100);
      expect(level.nextTier).not.toBeNull();
      expect(level.nextTier.name).toBeDefined();
      expect(level.nextTier.minXp).toBeGreaterThan(level.minXp);
    });

    test("handles negative XP gracefully", () => {
      const level = getLevelForXp(-50);
      expect(level.level).toBe(1);
      expect(level.totalXp).toBe(0);
    });
  });

  describe("getXpProfile()", () => {
    test("returns complete profile with breakdown", () => {
      const profile = getXpProfile({
        totalCheckins: 10,
        journalEntries: 5,
        streakCount: 7,
      });

      expect(profile.level).toBeDefined();
      expect(profile.name).toBeDefined();
      expect(profile.totalXp).toBeGreaterThan(0);
      expect(profile.breakdown).toBeDefined();
      expect(profile.breakdown.checkins).toBe(10 * XP_REWARDS.CHECKIN);
      expect(profile.breakdown.journalEntries).toBe(5 * XP_REWARDS.JOURNAL_ENTRY);
    });

    test("returns empty breakdown for empty input", () => {
      const profile = getXpProfile();
      expect(profile.totalXp).toBe(0);
      expect(profile.level).toBe(1);
      expect(profile.breakdown.checkins).toBe(0);
    });
  });
});
