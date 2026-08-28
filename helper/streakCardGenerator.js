// helper/streakCardGenerator.js

function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function getMilestoneTitle(streak) {
  const count = Number(streak) || 0;
  if (count >= 100) return "Master of Morning";
  if (count >= 60) return "Titan Habit";
  if (count >= 30) return "Unbreakable Flow";
  if (count >= 14) return "Iron Consistency";
  if (count >= 7) return "Weekly Champion";
  if (count >= 3) return "Kinetic Momentum";
  return "First Light";
}

function generateStreakSvg({ name = "Morning Builder", streak = 1, track = "Deep Work" }) {
  const safeStreak = parseInt(streak, 10) || 1;
  const milestone = escapeXml(getMilestoneTitle(safeStreak));
  const trackLabel = escapeXml(String(track).replace(/-/g, " ").toUpperCase());
  const safeName = escapeXml(name);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" xmlns="http://www.w3.org/2000/svg">
    <defs>
      <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#07090e"/>
        <stop offset="50%" stop-color="#0f172a"/>
        <stop offset="100%" stop-color="#07090e"/>
      </linearGradient>
      <linearGradient id="primaryGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#6366f1"/>
        <stop offset="100%" stop-color="#06b6d4"/>
      </linearGradient>
      <linearGradient id="flameGlow" x1="0%" y1="0%" x2="100%" y2="100%">
        <stop offset="0%" stop-color="#f43f5e"/>
        <stop offset="100%" stop-color="#f59e0b"/>
      </linearGradient>
    </defs>
    
    <!-- Background -->
    <rect width="1200" height="630" fill="url(#bgGrad)"/>
    <circle cx="1050" cy="150" r="300" fill="#6366f1" opacity="0.18" filter="blur(80px)"/>
    <circle cx="150" cy="500" r="250" fill="#10b981" opacity="0.12" filter="blur(80px)"/>

    <!-- Glass Card Container -->
    <rect x="80" y="70" width="1040" height="490" rx="32" fill="rgba(17, 24, 39, 0.75)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="2"/>

    <!-- Brand Header -->
    <text x="140" y="150" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="22" font-weight="700" fill="#94a3b8" letter-spacing="3">MORNING ROUTINE SENDER</text>

    <!-- Streak Large Display -->
    <text x="140" y="270" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="92" font-weight="800" fill="url(#flameGlow)">🔥 ${streak} DAYS</text>
    <text x="140" y="325" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="28" font-weight="600" fill="#f8fafc">Daily Morning Kickoff &amp; Habit Streak</text>

    <!-- Milestone Badge Pill -->
    <rect x="140" y="365" width="340" height="46" rx="23" fill="rgba(99, 102, 241, 0.2)" stroke="#6366f1" stroke-width="1.5"/>
    <text x="310" y="395" text-anchor="middle" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="18" font-weight="700" fill="#a5b4fc">🏆 ${milestone}</text>

    <!-- User & Track Info -->
    <text x="140" y="475" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="22" font-weight="600" fill="#94a3b8">Focus Track: <tspan fill="#f8fafc">${trackLabel}</tspan></text>
    <text x="140" y="510" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="18" fill="#64748b">Consistency builds mastery • morningroutine.app</text>
  </svg>`;
}

module.exports = {
  getMilestoneTitle,
  generateStreakSvg,
};
