// __tests__/streak.generator.test.js
const { getMilestoneTitle, generateStreakSvg } = require("../helper/streakCardGenerator");

describe("Streak Milestone & SVG Generator Tests", () => {
  test("getMilestoneTitle returns escalating titles based on streak days", () => {
    expect(getMilestoneTitle(0)).toBe("First Light");
    expect(getMilestoneTitle(3)).toBe("Kinetic Momentum");
    expect(getMilestoneTitle(7)).toBe("Weekly Champion");
    expect(getMilestoneTitle(14)).toBe("Iron Consistency");
    expect(getMilestoneTitle(30)).toBe("Unbreakable Flow");
    expect(getMilestoneTitle(60)).toBe("Titan Habit");
    expect(getMilestoneTitle(100)).toBe("Master of Morning");
  });

  test("generateStreakSvg outputs valid SVG string with streak and track info", () => {
    const svg = generateStreakSvg({
      name: "Priyanshu",
      streak: 42,
      track: "Deep Work",
    });

    expect(typeof svg).toBe("string");
    expect(svg).toContain("<svg");
    expect(svg).toContain("</svg>");
    expect(svg).toContain("🔥 42 DAYS");
    expect(svg).toContain("DEEP WORK");
    expect(svg).toContain("Unbreakable Flow");
  });
});
