/**
 * helper/wallpaperGenerator.js
 * High-Resolution (1080x1920) 9:16 Mobile Wallpaper Generator
 * Morning Routine Sender - Deep Obsidian Glassmorphism System
 */

const { getMilestoneTitle, getTrackDetails } = require("./streakCardGenerator");

/**
 * Safely escapes XML/SVG special characters.
 */
function escapeXml(str) {
  return String(str || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/**
 * Intelligent text wrapping utility for SVG <tspan> elements.
 * @param {string} text - Text to wrap
 * @param {number} maxChars - Maximum characters per line
 * @returns {string[]} Array of wrapped lines
 */
function wrapText(text, maxChars = 34) {
  if (!text || typeof text !== "string") return [];
  const words = text.trim().split(/\s+/);
  const lines = [];
  let currentLine = "";

  for (const word of words) {
    if (!currentLine) {
      currentLine = word;
    } else if ((currentLine + " " + word).length <= maxChars) {
      currentLine += " " + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  }
  if (currentLine) {
    lines.push(currentLine);
  }
  return lines;
}

/**
 * Returns milestone tier level for rank formatting.
 */
function getMilestoneTier(streak) {
  const count = Number(streak) || 0;
  if (count >= 100) return { rank: "TIER VII", label: "CENTURION MASTER" };
  if (count >= 60) return { rank: "TIER VI", label: "TITAN HABIT" };
  if (count >= 30) return { rank: "TIER V", label: "UNBREAKABLE MOMENTUM" };
  if (count >= 14) return { rank: "TIER IV", label: "IRON CONSISTENCY" };
  if (count >= 7) return { rank: "TIER III", label: "WEEKLY CHAMPION" };
  if (count >= 3) return { rank: "TIER II", label: "KINETIC MOMENTUM" };
  return { rank: "TIER I", label: "FIRST LIGHT" };
}

/**
 * Main SVG Wallpaper Generator (9:16 Canvas - 1080 x 1920)
 */
function generateWallpaperSvg({
  name = "Morning Builder",
  streak = 7,
  track = "deep-work",
  weatherSpark = "24°C • Clear Skies in New Delhi",
  quote = "Deep work is the ability to focus without distraction on a cognitively demanding task.",
  author = "Cal Newport",
  habits = [
    "Hydrate with 500ml water & morning light",
    "Review #1 priority & execute deep sprint",
    "Mindful breathwork & reflection session",
  ],
  lifetimeCheckins = 21,
  timezone = null,
  date = null,
} = {}) {
  const parsedStreak = Number(streak);
  const safeStreak =
    Number.isFinite(parsedStreak) && parsedStreak >= 0 ? Math.floor(parsedStreak) : 0;
  const parsedLifetime = Number(lifetimeCheckins);
  const safeLifetime =
    Number.isFinite(parsedLifetime) && parsedLifetime >= safeStreak
      ? Math.floor(parsedLifetime)
      : safeStreak;
  const milestone = escapeXml(getMilestoneTitle(safeStreak));
  const milestoneTier = getMilestoneTier(safeStreak);
  const trackInfo = getTrackDetails(track);
  const safeTrackLabel = escapeXml(trackInfo.label);
  const safeTrackIcon = escapeXml(trackInfo.icon);
  const safeTrackColor = escapeXml(trackInfo.color || "#06b6d4");

  const cleanName = String(name || "builder").trim();
  const safeHandle = escapeXml(cleanName.startsWith("@") ? cleanName : `@${cleanName}`);
  const userInitial = escapeXml((cleanName.replace(/[^a-zA-Z0-9]/g, "")[0] || "M").toUpperCase());

  let resolvedDate = date;
  if (!resolvedDate) {
    try {
      resolvedDate = new Date().toLocaleDateString("en-US", {
        timeZone: timezone || "UTC",
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      resolvedDate = new Date().toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
  }
  const safeDate = escapeXml(String(resolvedDate).toUpperCase());
  const safeWeather = escapeXml(weatherSpark || "22°C • Clear & Serene Morning");
  const safeAuthor = escapeXml(author || "Morning Focus Protocol");
  const streakUnit = safeStreak === 1 ? "DAY" : "DAYS";

  // Top 3 Habits Normalization
  const defaultHabits = [
    "Hydrate with 500ml water & morning light",
    "Review #1 priority & execute deep sprint",
    "Mindful breathwork & reflection session",
  ];
  const habitItems =
    Array.isArray(habits) && habits.length > 0 ? habits.slice(0, 3) : defaultHabits;
  while (habitItems.length < 3) {
    habitItems.push(defaultHabits[habitItems.length] || "Daily Focus & Intentionality");
  }

  // Wrap Quote lines for clean SVG layout
  const quoteLines = wrapText(quote, 32).slice(0, 4);
  const quoteLineHeight = 44;
  const quoteStartY = 580 - ((quoteLines.length - 1) * quoteLineHeight) / 2;
  const quoteTspans = quoteLines
    .map(
      (line, i) =>
        `<tspan x="540" y="${quoteStartY + i * quoteLineHeight}" text-anchor="middle">${escapeXml(line)}</tspan>`,
    )
    .join("\n      ");

  // Habit category badges
  const habitCategories = ["CORE RITUAL", "FLOW BLOCK", "MINDFULNESS"];

  // Habit checklist cards rendering
  const habitCardsSvg = habitItems
    .map((habitText, idx) => {
      const y = 920 + idx * 145;
      const num = String(idx + 1).padStart(2, "0");
      const category = habitCategories[idx] || "ROUTINE";
      return `
    <!-- Habit Card ${idx + 1} -->
    <g transform="translate(60, ${y})">
      <!-- Glass Card Background -->
      <rect x="0" y="0" width="960" height="125" rx="24" fill="rgba(14, 20, 34, 0.72)" stroke="url(#glassBorder)" stroke-width="1.4" />
      
      <!-- Checkmark Glowing Button -->
      <g transform="translate(30, 32)">
        <circle cx="30" cy="30" r="28" fill="url(#cyanPurple)" filter="url(#softGlow)" opacity="0.9" />
        <circle cx="30" cy="30" r="28" fill="rgba(12, 17, 29, 0.35)" />
        <path d="M21 30l6 6 12-12" stroke="#ffffff" stroke-width="3.2" stroke-linecap="round" stroke-linejoin="round" />
      </g>

      <!-- Numeric Index -->
      <text x="110" y="44" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#64748b" letter-spacing="1.5">STEP ${num} • ${category}</text>
      
      <!-- Habit Title -->
      <text x="110" y="78" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="22" font-weight="700" fill="#f8fafc">${escapeXml(habitText)}</text>

      <!-- Status Pill -->
      <g transform="translate(830, 42)">
        <rect x="0" y="0" width="95" height="38" rx="19" fill="rgba(34, 211, 238, 0.12)" stroke="rgba(34, 211, 238, 0.35)" stroke-width="1" />
        <text x="47" y="24" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="800" fill="#38bdf8">ACTIVE</text>
      </g>
    </g>`;
    })
    .join("\n");

  return `<svg width="1080" height="1920" viewBox="0 0 1080 1920" fill="none" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Morning Routine Lockscreen Wallpaper">
  <defs>
    <!-- Obsidian Canvas Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050608" />
      <stop offset="35%" stop-color="#0c111d" />
      <stop offset="70%" stop-color="#070a12" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>

    <!-- Glassmorphic Border Gradient -->
    <linearGradient id="glassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.22)" />
      <stop offset="40%" stop-color="rgba(124, 58, 237, 0.45)" />
      <stop offset="80%" stop-color="rgba(34, 211, 238, 0.28)" />
      <stop offset="100%" stop-color="rgba(255, 255, 255, 0.08)" />
    </linearGradient>

    <!-- Card Subtle Gradient -->
    <linearGradient id="cardSurface" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(18, 24, 38, 0.85)" />
      <stop offset="100%" stop-color="rgba(10, 14, 24, 0.75)" />
    </linearGradient>

    <!-- Flame Streak Glow Gradient -->
    <linearGradient id="flameGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff4500" />
      <stop offset="45%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>

    <!-- Cyberpunk Accent Gradient -->
    <linearGradient id="cyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#22d3ee" />
    </linearGradient>

    <!-- Neon Emerald Gradient -->
    <linearGradient id="emeraldGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#059669" />
      <stop offset="100%" stop-color="#34d399" />
    </linearGradient>

    <!-- Glow & Soft Filters -->
    <filter id="glowEffect" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="80" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="softGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="24" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="textGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="12" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>

    <!-- Embedded High-Definition Fonts -->
    <style>
      @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500;600;700;800&amp;family=Plus+Jakarta+Sans:ital,wght@0,500;0,600;0,700;0,800;0,900;1,600;1,700&amp;display=swap');
      text {
        text-rendering: optimizeLegibility;
        -webkit-font-smoothing: antialiased;
      }
    </style>
  </defs>

  <!-- Canvas Background -->
  <rect width="1080" height="1920" fill="url(#bgGrad)" />

  <!-- Ambient Glowing Orbs -->
  <circle cx="940" cy="280" r="380" fill="#7c3aed" opacity="0.28" filter="url(#glowEffect)" />
  <circle cx="120" cy="860" r="360" fill="#06b6d4" opacity="0.22" filter="url(#glowEffect)" />
  <circle cx="980" cy="1320" r="340" fill="#8b5cf6" opacity="0.20" filter="url(#glowEffect)" />
  <circle cx="180" cy="1680" r="380" fill="#0ea5e9" opacity="0.22" filter="url(#glowEffect)" />

  <!-- Subtle Cyber Grid Overlay -->
  <g opacity="0.04" stroke="#ffffff" stroke-width="1.2">
    <line x1="60" y1="200" x2="1020" y2="200" />
    <line x1="60" y1="460" x2="1020" y2="460" />
    <line x1="60" y1="890" x2="1020" y2="890" />
    <line x1="60" y1="1400" x2="1020" y2="1400" />
    <line x1="60" y1="1780" x2="1020" y2="1780" />
    <line x1="260" y1="120" x2="260" y2="1820" />
    <line x1="540" y1="120" x2="540" y2="1820" />
    <line x1="820" y1="120" x2="820" y2="1820" />
  </g>

  <!-- ========================================== -->
  <!-- SECTION 1: HEADER (y: 160 - 370)           -->
  <!-- ========================================== -->

  <!-- Top Brand Insignia -->
  <g transform="translate(60, 160)">
    <!-- Sun / Lightning Logo Badge -->
    <rect x="0" y="0" width="56" height="56" rx="16" fill="url(#cyanPurple)" />
    <path d="M28 17v4m0 14v4m-11-11h4m14 0h4m-9.5-8.5l2.8 2.8m-10.6 10.6l2.8 2.8m0-16.2l-2.8 2.8m10.6 10.6l-2.8 2.8M28 22a6 6 0 100 12 6 6 0 000-12z" stroke="#ffffff" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" />
    
    <text x="74" y="27" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="20" font-weight="900" fill="#ffffff" letter-spacing="2">MORNING ROUTINE SENDER</text>
    <text x="74" y="49" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="600" fill="#94a3b8" letter-spacing="1">SYSTEM DISCIPLINE &amp; FOCUS LOCKSCREEN</text>
  </g>

  <!-- User Handle Pill (Top Right) -->
  <g transform="translate(770, 166)">
    <rect x="0" y="0" width="250" height="46" rx="23" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.14)" stroke-width="1.2" />
    <circle cx="23" cy="23" r="15" fill="#7c3aed" />
    <text x="23" y="29" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="800" fill="#ffffff">${userInitial}</text>
    <text x="48" y="29" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700" fill="#f8fafc">${safeHandle}</text>
    <!-- Verified Badge -->
    <circle cx="225" cy="23" r="9" fill="#34d399" />
    <path d="M221 23l2.8 2.8 5.6-5.6" stroke="#ffffff" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Date & Weather Glass Pill Bar -->
  <g transform="translate(60, 245)">
    <rect x="0" y="0" width="960" height="74" rx="22" fill="rgba(12, 17, 29, 0.65)" stroke="url(#glassBorder)" stroke-width="1.4" />
    
    <!-- Date Side -->
    <g transform="translate(30, 26)">
      <text x="0" y="20" font-family="'JetBrains Mono', monospace" font-size="15" font-weight="700" fill="#38bdf8" letter-spacing="1">📅 ${safeDate}</text>
    </g>

    <!-- Center Separator -->
    <line x1="490" y1="18" x2="490" y2="56" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1.5" />

    <!-- Localized Weather Spark -->
    <g transform="translate(520, 26)">
      <text x="0" y="20" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="700" fill="#e2e8f0">${safeWeather}</text>
    </g>
  </g>

  <!-- ========================================== -->
  <!-- SECTION 2: HERO MOTIVATION & TRACK (350-840) -->
  <!-- ========================================== -->

  <!-- Track Pill Badge -->
  <g transform="translate(365, 345)">
    <rect x="0" y="0" width="350" height="46" rx="23" fill="rgba(6, 182, 212, 0.12)" stroke="${safeTrackColor}" stroke-width="1.8" />
    <text x="175" y="29" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="800" fill="#67e8f9" letter-spacing="1.2">${safeTrackIcon} ${safeTrackLabel}</text>
  </g>

  <!-- Hero Daily Motivation Glass Card -->
  <g transform="translate(60, 415)">
    <!-- Container -->
    <rect x="0" y="0" width="960" height="425" rx="32" fill="url(#cardSurface)" stroke="url(#glassBorder)" stroke-width="1.8" />

    <!-- Top Neon Accent Line -->
    <rect x="360" y="0" width="240" height="3.5" rx="1.7" fill="url(#cyanPurple)" filter="url(#softGlow)" />

    <!-- Decorative Quotation Glyphs -->
    <text x="45" y="110" font-family="'Plus Jakarta Sans', Georgia, serif" font-size="120" font-weight="900" fill="#7c3aed" opacity="0.22">“</text>
    <text x="890" y="360" text-anchor="end" font-family="'Plus Jakarta Sans', Georgia, serif" font-size="120" font-weight="900" fill="#22d3ee" opacity="0.18">”</text>

    <!-- Subtitle Label -->
    <text x="480" y="55" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#94a3b8" letter-spacing="2.5">DAILY MOTIVATION &amp; PROTOCOL</text>

    <!-- Dynamic Wrapped Quote Lines -->
    <text font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="28" font-style="italic" font-weight="700" fill="#f8fafc">
      ${quoteTspans}
    </text>

    <!-- Author Attribution Glass Pill -->
    <g transform="translate(330, 345)">
      <rect x="0" y="0" width="300" height="44" rx="22" fill="rgba(124, 58, 237, 0.18)" stroke="rgba(124, 58, 237, 0.45)" stroke-width="1.2" />
      <text x="150" y="27" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="800" fill="#c4b5fd" letter-spacing="0.5">— ${safeAuthor}</text>
    </g>
  </g>

  <!-- ========================================== -->
  <!-- SECTION 3: HABIT CHECKLIST (y: 860 - 1380) -->
  <!-- ========================================== -->

  <!-- Checklist Section Heading -->
  <g transform="translate(60, 878)">
    <text x="0" y="22" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="900" fill="#ffffff" letter-spacing="2">TODAY&apos;S HABIT CHECKLIST</text>
    <text x="960" y="22" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#22d3ee" letter-spacing="1">TOP 3 DAILY RITUALS</text>
  </g>

  <!-- 3 Habit Cards -->
  ${habitCardsSvg}

  <!-- ========================================== -->
  <!-- SECTION 4: BOTTOM STATS (y: 1390 - 1750)   -->
  <!-- ========================================== -->

  <!-- Stats Section Heading -->
  <g transform="translate(60, 1400)">
    <text x="0" y="20" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="900" fill="#ffffff" letter-spacing="1.5">CONSISTENCY &amp; DISCIPLINE RECORD</text>
  </g>

  <!-- Metric 1: Current Streak Card -->
  <g transform="translate(60, 1435)">
    <rect x="0" y="0" width="465" height="155" rx="26" fill="rgba(14, 20, 34, 0.75)" stroke="url(#glassBorder)" stroke-width="1.5" />
    <text x="35" y="38" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#94a3b8" letter-spacing="1.5">CURRENT STREAK</text>
    <text x="35" y="95" font-family="'Plus Jakarta Sans', sans-serif" font-size="44" font-weight="900" fill="url(#flameGlow)" filter="url(#textGlow)">🔥 ${safeStreak} ${streakUnit}</text>
    <text x="35" y="128" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="600" fill="#94a3b8">Unbroken Morning Momentum</text>
  </g>

  <!-- Metric 2: Lifetime Check-ins Card -->
  <g transform="translate(555, 1435)">
    <rect x="0" y="0" width="465" height="155" rx="26" fill="rgba(14, 20, 34, 0.75)" stroke="url(#glassBorder)" stroke-width="1.5" />
    <text x="35" y="38" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#94a3b8" letter-spacing="1.5">LIFETIME CHECK-INS</text>
    <text x="35" y="95" font-family="'JetBrains Mono', monospace" font-size="44" font-weight="800" fill="#22d3ee" filter="url(#textGlow)">⚡ ${safeLifetime}</text>
    <text x="35" y="128" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="600" fill="#94a3b8">Verified Routine Logs</text>
  </g>

  <!-- Milestone Achievement Banner Card -->
  <g transform="translate(60, 1615)">
    <rect x="0" y="0" width="960" height="115" rx="26" fill="rgba(24, 18, 48, 0.78)" stroke="url(#glassBorder)" stroke-width="1.8" />
    
    <!-- Trophy Icon Box -->
    <g transform="translate(25, 23)">
      <rect x="0" y="0" width="68" height="68" rx="20" fill="rgba(251, 191, 36, 0.15)" stroke="#fbbf24" stroke-width="1.5" />
      <text x="34" y="44" text-anchor="middle" font-size="32">🏆</text>
    </g>

    <!-- Milestone Title & Tier -->
    <text x="115" y="50" font-family="'Plus Jakarta Sans', sans-serif" font-size="24" font-weight="900" fill="#fde047" letter-spacing="0.5">${milestone}</text>
    <text x="115" y="78" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="700" fill="#c4b5fd" letter-spacing="1.5">${milestoneTier.rank} • ${milestoneTier.label}</text>

    <!-- Milestone Pill Badge -->
    <g transform="translate(760, 37)">
      <rect x="0" y="0" width="165" height="42" rx="21" fill="rgba(251, 191, 36, 0.2)" stroke="#fbbf24" stroke-width="1.4" />
      <text x="82" y="26" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" fill="#fef08a">UNLOCKED</text>
    </g>
  </g>

  <!-- ========================================== -->
  <!-- SECTION 5: FOOTER WATERMARK (1770 - 1860)  -->
  <!-- ========================================== -->
  <g transform="translate(540, 1800)">
    <text x="0" y="0" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="700" fill="#64748b" letter-spacing="1">MORNING ROUTINE SENDER • DAILY DISCIPLINE COMPANION</text>
    <text x="0" y="24" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="500" fill="#475569" letter-spacing="1">VERIFIED DISCIPLINE RECORD • 1080 × 1920 LOCKSCREEN HD</text>
  </g>
</svg>`;
}

module.exports = {
  escapeXml,
  wrapText,
  getMilestoneTier,
  generateWallpaperSvg,
};
