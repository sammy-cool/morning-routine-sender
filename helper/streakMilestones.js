// helper/streakMilestones.js

const MILESTONE_TIERS = [
  {
    id: "bronze-ignition",
    name: "Bronze Ignition",
    days: 3,
    icon: "🔥",
    badgeColor: "#f97316",
    description: "Built the spark of consistency for 3 consecutive days.",
  },
  {
    id: "momentum-builder",
    name: "Momentum Builder",
    days: 7,
    icon: "🥉",
    badgeColor: "#cd7f32",
    description: "Completed a full 7-day week of uninterrupted morning rituals.",
  },
  {
    id: "fortitude-pioneer",
    name: "Fortitude Pioneer",
    days: 14,
    icon: "⚡",
    badgeColor: "#38bdf8",
    description: "14 consecutive days of morning mastery and deliberate focus.",
  },
  {
    id: "habit-alchemist",
    name: "Habit Alchemist",
    days: 21,
    icon: "🥈",
    badgeColor: "#a855f7",
    description: "21 days: Scientifically established a neural habit loop.",
  },
  {
    id: "golden-architect",
    name: "Golden Architect",
    days: 30,
    icon: "🥇",
    badgeColor: "#fbbf24",
    description: "30-day champion: Architected a bulletproof morning discipline.",
  },
  {
    id: "iron-will",
    name: "Iron Will",
    days: 50,
    icon: "🛡️",
    badgeColor: "#10b981",
    description: "50 days: Unshakeable resilience and relentless execution.",
  },
  {
    id: "centurion-legend",
    name: "Centurion Legend",
    days: 100,
    icon: "💎",
    badgeColor: "#ec4899",
    description: "100 days of absolute consistency. A true routine centurion.",
  },
];

/**
 * Calculate unlocked milestones and next target for a given streak
 * @param {number} streakCount
 * @returns {Object}
 */
function getStreakMilestones(streakCount = 0) {
  const streak = Math.max(0, Number(streakCount) || 0);

  const milestones = MILESTONE_TIERS.map((tier) => {
    const isUnlocked = streak >= tier.days;
    return {
      ...tier,
      unlocked: isUnlocked,
    };
  });

  // Highest unlocked tier
  const highestUnlocked = [...milestones].reverse().find((m) => m.unlocked) || null;

  // Next upcoming tier
  const nextMilestone = milestones.find((m) => !m.unlocked) || null;

  let progressPct = 100;
  let daysRemaining = 0;

  if (nextMilestone) {
    const prevDays = highestUnlocked ? highestUnlocked.days : 0;
    const range = nextMilestone.days - prevDays;
    const progressIntoRange = streak - prevDays;
    progressPct = Math.min(100, Math.max(0, Math.round((progressIntoRange / range) * 100)));
    daysRemaining = Math.max(0, nextMilestone.days - streak);
  }

  return {
    streakCount: streak,
    highestUnlocked,
    nextMilestone,
    progressPct,
    daysRemaining,
    milestones,
  };
}

module.exports = {
  MILESTONE_TIERS,
  getStreakMilestones,
};
