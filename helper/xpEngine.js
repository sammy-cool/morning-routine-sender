// helper/xpEngine.js
// Gamification XP & Level-Up Engine for Morning Routine Sender

/**
 * XP reward constants for each trackable action.
 */
const XP_REWARDS = {
  CHECKIN: 50,
  JOURNAL_ENTRY: 30,
  VERIFIED_WAKEUP: 25,
  HARDWARE_CHECKIN: 75,
  STREAK_MILESTONE_3: 100,
  STREAK_MILESTONE_7: 200,
  STREAK_MILESTONE_14: 300,
  STREAK_MILESTONE_21: 400,
  STREAK_MILESTONE_30: 500,
  STREAK_MILESTONE_50: 750,
  STREAK_MILESTONE_100: 1500,
  SQUAD_DUEL_WIN: 100,
  SQUAD_JOIN: 50,
  REFLECTION_DEEP: 40,
  MOOD_LOG: 15,
  GRATITUDE_LOG: 20,
  FIRST_LOGIN: 100,
  PODCAST_LISTEN: 20,
  EXPORT_DATA: 10,
  SHARE_STREAK: 25,
};

/**
 * Level tier definitions with XP thresholds.
 * Tiers are ordered by ascending XP requirement.
 */
const LEVEL_TIERS = [
  {
    level: 1,
    name: "Rookie",
    icon: "🌱",
    minXp: 0,
    color: "#94a3b8",
    description: "Just getting started on the morning journey.",
  },
  {
    level: 2,
    name: "Apprentice",
    icon: "⚡",
    minXp: 200,
    color: "#38bdf8",
    description: "Building the foundations of morning discipline.",
  },
  {
    level: 3,
    name: "Warrior",
    icon: "⚔️",
    minXp: 600,
    color: "#6366f1",
    description: "Consistent morning warrior with growing momentum.",
  },
  {
    level: 4,
    name: "Master",
    icon: "🛡️",
    minXp: 1500,
    color: "#10b981",
    description: "Mastered the art of morning ritual execution.",
  },
  {
    level: 5,
    name: "Grandmaster",
    icon: "👑",
    minXp: 4000,
    color: "#f59e0b",
    description: "Elite discipline across all 5 pillars of consistency.",
  },
  {
    level: 6,
    name: "Legend",
    icon: "💎",
    minXp: 10000,
    color: "#ec4899",
    description: "A true morning routine legend. Unbreakable will.",
  },
];

/**
 * Calculates total XP from subscriber activity data.
 *
 * @param {Object} params
 * @param {number} [params.streakCount=0]
 * @param {number} [params.totalCheckins=0]
 * @param {number} [params.journalEntries=0]
 * @param {number} [params.verifiedWakeups=0]
 * @param {number} [params.hardwareCheckins=0]
 * @param {number} [params.duelWins=0]
 * @param {number} [params.moodLogs=0]
 * @param {number} [params.gratitudeLogs=0]
 * @param {number} [params.reflections=0]
 * @returns {number}
 */
function calculateTotalXp({
  streakCount = 0,
  totalCheckins = 0,
  journalEntries = 0,
  verifiedWakeups = 0,
  hardwareCheckins = 0,
  duelWins = 0,
  moodLogs = 0,
  gratitudeLogs = 0,
  reflections = 0,
} = {}) {
  let xp = 0;

  xp += Math.max(0, Number(totalCheckins) || 0) * XP_REWARDS.CHECKIN;
  xp += Math.max(0, Number(journalEntries) || 0) * XP_REWARDS.JOURNAL_ENTRY;
  xp += Math.max(0, Number(verifiedWakeups) || 0) * XP_REWARDS.VERIFIED_WAKEUP;
  xp += Math.max(0, Number(hardwareCheckins) || 0) * XP_REWARDS.HARDWARE_CHECKIN;
  xp += Math.max(0, Number(duelWins) || 0) * XP_REWARDS.SQUAD_DUEL_WIN;
  xp += Math.max(0, Number(moodLogs) || 0) * XP_REWARDS.MOOD_LOG;
  xp += Math.max(0, Number(gratitudeLogs) || 0) * XP_REWARDS.GRATITUDE_LOG;
  xp += Math.max(0, Number(reflections) || 0) * XP_REWARDS.REFLECTION_DEEP;

  // Streak milestone bonuses (non-cumulative: only the highest achieved)
  const streak = Math.max(0, Number(streakCount) || 0);
  if (streak >= 100) xp += XP_REWARDS.STREAK_MILESTONE_100;
  else if (streak >= 50) xp += XP_REWARDS.STREAK_MILESTONE_50;
  else if (streak >= 30) xp += XP_REWARDS.STREAK_MILESTONE_30;
  else if (streak >= 21) xp += XP_REWARDS.STREAK_MILESTONE_21;
  else if (streak >= 14) xp += XP_REWARDS.STREAK_MILESTONE_14;
  else if (streak >= 7) xp += XP_REWARDS.STREAK_MILESTONE_7;
  else if (streak >= 3) xp += XP_REWARDS.STREAK_MILESTONE_3;

  return xp;
}

/**
 * Determines the current level tier for a given XP total.
 *
 * @param {number} totalXp
 * @returns {Object} { level, name, icon, color, description, minXp, nextTier, progressPct, xpToNextLevel }
 */
function getLevelForXp(totalXp) {
  const xp = Math.max(0, Number(totalXp) || 0);

  let currentTier = LEVEL_TIERS[0];
  for (const tier of LEVEL_TIERS) {
    if (xp >= tier.minXp) {
      currentTier = tier;
    }
  }

  const currentIdx = LEVEL_TIERS.indexOf(currentTier);
  const nextTier = currentIdx < LEVEL_TIERS.length - 1 ? LEVEL_TIERS[currentIdx + 1] : null;

  let progressPct = 100;
  let xpToNextLevel = 0;

  if (nextTier) {
    const range = nextTier.minXp - currentTier.minXp;
    const progressIntoRange = xp - currentTier.minXp;
    progressPct = Math.min(100, Math.max(0, Math.round((progressIntoRange / range) * 100)));
    xpToNextLevel = Math.max(0, nextTier.minXp - xp);
  }

  return {
    level: currentTier.level,
    name: currentTier.name,
    icon: currentTier.icon,
    color: currentTier.color,
    description: currentTier.description,
    minXp: currentTier.minXp,
    totalXp: xp,
    nextTier: nextTier
      ? { level: nextTier.level, name: nextTier.name, icon: nextTier.icon, minXp: nextTier.minXp }
      : null,
    progressPct,
    xpToNextLevel,
  };
}

/**
 * Computes the full XP profile for a subscriber.
 *
 * @param {Object} subscriberData
 * @returns {Object}
 */
function getXpProfile(subscriberData = {}) {
  const totalXp = calculateTotalXp(subscriberData);
  const levelInfo = getLevelForXp(totalXp);

  return {
    ...levelInfo,
    breakdown: {
      checkins: (Number(subscriberData.totalCheckins) || 0) * XP_REWARDS.CHECKIN,
      journalEntries: (Number(subscriberData.journalEntries) || 0) * XP_REWARDS.JOURNAL_ENTRY,
      verifiedWakeups: (Number(subscriberData.verifiedWakeups) || 0) * XP_REWARDS.VERIFIED_WAKEUP,
      hardwareCheckins:
        (Number(subscriberData.hardwareCheckins) || 0) * XP_REWARDS.HARDWARE_CHECKIN,
      duelWins: (Number(subscriberData.duelWins) || 0) * XP_REWARDS.SQUAD_DUEL_WIN,
      moodLogs: (Number(subscriberData.moodLogs) || 0) * XP_REWARDS.MOOD_LOG,
      gratitudeLogs: (Number(subscriberData.gratitudeLogs) || 0) * XP_REWARDS.GRATITUDE_LOG,
      reflections: (Number(subscriberData.reflections) || 0) * XP_REWARDS.REFLECTION_DEEP,
    },
  };
}

module.exports = {
  XP_REWARDS,
  LEVEL_TIERS,
  calculateTotalXp,
  getLevelForXp,
  getXpProfile,
};
