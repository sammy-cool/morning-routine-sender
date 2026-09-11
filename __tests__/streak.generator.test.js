const {
  escapeXml,
  getMilestoneTitle,
  getTrackDetails,
  generateStreakSvg,
} = require("../helper/streakCardGenerator");

describe("SVG Streak Share Card Generator", () => {
  test("escapeXml safely escapes SVG/XML characters", () => {
    expect(escapeXml("test & < > \" '")).toBe("test &amp; &lt; &gt; &quot; &apos;");
    expect(escapeXml(null)).toBe("");
  });

  test("getMilestoneTitle scales correctly with streak count", () => {
    expect(getMilestoneTitle(1)).toBe("First Light");
    expect(getMilestoneTitle(7)).toBe("Weekly Champion");
    expect(getMilestoneTitle(30)).toBe("Unbreakable Flow");
    expect(getMilestoneTitle(100)).toBe("Master of Morning");
  });

  test("getTrackDetails formats track and label", () => {
    const deepWork = getTrackDetails("deep-work");
    expect(deepWork.label).toContain("DEEP WORK");
    expect(deepWork.icon).toBe("⚡");

    const zen = getTrackDetails("mindfulness");
    expect(zen.label).toContain("MINDFULNESS");
  });

  test("generateStreakSvg returns valid standalone SVG string with vector QR matrix", () => {
    const svg = generateStreakSvg({
      name: "Priyanshu",
      streak: 42,
      track: "deep-work",
      verifyUrl: "https://morningroutine.app/routine",
    });

    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg width="1200" height="630"');
    expect(svg).toContain("🔥 42 DAYS");
    expect(svg).toContain("@Priyanshu");
    expect(svg).toContain("🏆 Unbreakable Flow");
    expect(svg).toContain("⚡ DEEP WORK &amp; BUILDER");
    expect(svg).toContain("SCAN QR TO VERIFY");
    expect(svg).toContain("</svg>");
  });

  test("generateWeeklyReportCardSvg returns valid weekly habit consistency SVG", () => {
    const { generateWeeklyReportCardSvg } = require("../helper/streakCardGenerator");
    const svg = generateWeeklyReportCardSvg({
      name: "Smarty",
      streak: 14,
      track: "mindfulness",
      grade: "A+",
      completionRate: "100%",
      activeDays: ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      dayStatuses: [true, true, true, true, true, true, false],
      focusMinutes: 150,
      journalsLogged: 6,
      verifyUrl: "https://morningroutine.app/routine",
    });

    expect(svg).toBeTruthy();
    expect(svg).toContain('<svg width="1200" height="630"');
    expect(svg).toContain("GRADE: A+");
    expect(svg).toContain("100% Weekly Consistency Rate");
    expect(svg).toContain("@Smarty");
    expect(svg).toContain("⚡ 150m");
    expect(svg).toContain("🔥 14 Days");
    expect(svg).toContain("✍️ 6 Logged");
    expect(svg).toContain("SCAN QR TO VERIFY");
    expect(svg).toContain("</svg>");
  });
});
