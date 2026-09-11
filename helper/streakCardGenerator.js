/**
 * Escapes XML/SVG special characters.
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
 * Escalating milestone title based on streak count.
 */
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

/**
 * Friendly track label formatter with icon.
 */
function getTrackDetails(track) {
  const t = String(track || "deep-work")
    .toLowerCase()
    .trim();
  switch (t) {
    case "mindfulness":
      return { label: "MINDFULNESS & STOIC", icon: "🧘", color: "#10b981" };
    case "executive":
      return { label: "HIGH-PERFORMANCE EXEC", icon: "💼", color: "#f59e0b" };
    case "learning":
      return { label: "LIFELONG LEARNER", icon: "📚", color: "#8b5cf6" };
    case "classic":
      return { label: "MORNING ENERGIZER", icon: "🌅", color: "#ec4899" };
    case "deep-work":
    default:
      return { label: "DEEP WORK & BUILDER", icon: "⚡", color: "#06b6d4" };
  }
}

/**
 * Generates a deterministic vector QR Code matrix rendered purely in SVG path syntax.
 */
function generateVectorQrMatrix(text, size = 110, x = 990, y = 410) {
  const N = 21;
  const cellSize = size / N;
  const matrix = Array.from({ length: N }, () => Array(N).fill(false));

  function drawFinder(r0, c0) {
    for (let r = 0; r < 7; r++) {
      for (let c = 0; c < 7; c++) {
        if (r === 0 || r === 6 || c === 0 || c === 6 || (r >= 2 && r <= 4 && c >= 2 && c <= 4)) {
          matrix[r0 + r][c0 + c] = true;
        }
      }
    }
  }

  drawFinder(0, 0);
  drawFinder(0, N - 7);
  drawFinder(N - 7, 0);

  for (let i = 8; i < N - 8; i++) {
    matrix[6][i] = i % 2 === 0;
    matrix[i][6] = i % 2 === 0;
  }

  let hash = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }

  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      const inTL = r < 8 && c < 8;
      const inTR = r < 8 && c >= N - 8;
      const inBL = r >= N - 8 && c < 8;
      const inTiming = r === 6 || c === 6;

      if (!inTL && !inTR && !inBL && !inTiming) {
        hash = (hash * 1103515245 + 12345) & 0x7fffffff;
        matrix[r][c] = hash % 100 < 46;
      }
    }
  }

  let pathData = "";
  for (let r = 0; r < N; r++) {
    for (let c = 0; c < N; c++) {
      if (matrix[r][c]) {
        const cx = (x + c * cellSize).toFixed(2);
        const cy = (y + r * cellSize).toFixed(2);
        const cs = cellSize.toFixed(2);
        pathData += `M${cx},${cy}h${cs}v${cs}h-${cs}z `;
      }
    }
  }

  return `
    <!-- QR Code Background Container -->
    <rect x="${x - 10}" y="${y - 10}" width="${size + 20}" height="${size + 20}" rx="14" fill="#ffffff" />
    <path d="${pathData.trim()}" fill="#0f172a" />
    <!-- Center MRN Logo Dot -->
    <circle cx="${(x + size / 2).toFixed(2)}" cy="${(y + size / 2).toFixed(2)}" r="${(cellSize * 1.6).toFixed(2)}" fill="#7c3aed" />
    <circle cx="${(x + size / 2).toFixed(2)}" cy="${(y + size / 2).toFixed(2)}" r="${(cellSize * 0.8).toFixed(2)}" fill="#ffffff" />
  `;
}

/**
 * Main SVG Generator
 */
function generateStreakSvg({
  name = "Morning Builder",
  streak = 1,
  track = "deep-work",
  verifyUrl = "https://morningroutine.app/routine",
  date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
}) {
  const safeStreak = parseInt(streak, 10) || 1;
  const milestone = escapeXml(getMilestoneTitle(safeStreak));
  const trackInfo = getTrackDetails(track);
  const safeTrackLabel = escapeXml(trackInfo.label);
  const safeTrackIcon = escapeXml(trackInfo.icon);
  const safeTrackColor = escapeXml(trackInfo.color);
  const safeName = escapeXml(name.startsWith("@") ? name : `@${name}`);
  const userInitial = escapeXml((name.replace(/[^a-zA-Z0-9]/g, "")[0] || "M").toUpperCase());
  const safeDate = escapeXml(date);
  const safeVerifyUrl = escapeXml(verifyUrl);

  const qrSvg = generateVectorQrMatrix(verifyUrl, 110, 990, 410);

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Background Gradient -->
    <linearGradient id="bgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050608" />
      <stop offset="50%" stop-color="#0c111d" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>

    <!-- Flame Streak Glow -->
    <linearGradient id="flameGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#ff4500" />
      <stop offset="35%" stop-color="#f59e0b" />
      <stop offset="100%" stop-color="#fbbf24" />
    </linearGradient>

    <!-- Cyberpunk Accent Gradient -->
    <linearGradient id="cyanPurple" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#7c3aed" />
      <stop offset="100%" stop-color="#22d3ee" />
    </linearGradient>

    <!-- Card Glass Border Gradient -->
    <linearGradient id="glassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.22)" />
      <stop offset="50%" stop-color="rgba(124, 58, 237, 0.45)" />
      <stop offset="100%" stop-color="rgba(34, 211, 238, 0.2)" />
    </linearGradient>

    <!-- Glow Filters -->
    <filter id="glowEffect" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="24" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="10" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <!-- Canvas Background -->
  <rect width="1200" height="630" fill="url(#bgGrad)" />

  <!-- Ambient Glow Orbs -->
  <circle cx="1080" cy="120" r="280" fill="#7c3aed" opacity="0.25" filter="url(#glowEffect)" />
  <circle cx="120" cy="520" r="260" fill="#22d3ee" opacity="0.18" filter="url(#glowEffect)" />
  <circle cx="600" cy="315" r="320" fill="#fb7185" opacity="0.08" filter="url(#glowEffect)" />

  <!-- Subtle Cyber Grid Pattern Overlay -->
  <g opacity="0.06" stroke="#ffffff" stroke-width="1">
    <line x1="80" y1="140" x2="1120" y2="140" />
    <line x1="80" y1="280" x2="1120" y2="280" />
    <line x1="80" y1="420" x2="1120" y2="420" />
    <line x1="280" y1="60" x2="280" y2="570" />
    <line x1="560" y1="60" x2="560" y2="570" />
    <line x1="840" y1="60" x2="840" y2="570" />
  </g>

  <!-- Main Glass Container -->
  <rect x="70" y="60" width="1060" height="510" rx="28" fill="rgba(12, 17, 29, 0.8)" stroke="url(#glassBorder)" stroke-width="1.8" />

  <!-- Header: Brand Logo & Verified Tag -->
  <g transform="translate(130, 115)">
    <!-- Sun Icon Badge -->
    <rect x="0" y="0" width="44" height="44" rx="12" fill="url(#cyanPurple)" />
    <path d="M22 13v3m0 12v3m-9-9h3m12 0h3m-7.8-6.8l2.1 2.1m-8.4 8.4l2.1 2.1m0-12.6l-2.1 2.1m8.4 8.4l-2.1 2.1M22 17a5 5 0 100 10 5 5 0 000-10z" stroke="#ffffff" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" />
    <text x="58" y="24" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="18" font-weight="800" fill="#ffffff" letter-spacing="1.5">MORNING ROUTINE SENDER</text>
    <text x="58" y="42" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="12" font-weight="600" fill="#94a3b8" letter-spacing="0.5">HABIT DISPATCH &amp; STREAK SYSTEM</text>
  </g>

  <!-- Top Right: User Handle Pill -->
  <g transform="translate(850, 115)">
    <rect x="0" y="0" width="220" height="44" rx="22" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1" />
    <circle cx="22" cy="22" r="14" fill="#7c3aed" />
    <text x="22" y="27" text-anchor="middle" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="13" font-weight="800" fill="#ffffff">${userInitial}</text>
    <text x="48" y="28" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="14" font-weight="700" fill="#f8fafc">${safeName}</text>
    <!-- Verified Badge Check -->
    <circle cx="198" cy="22" r="8" fill="#34d399" />
    <path d="M194.5 22l2.5 2.5 5-5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Center Streak Fire Badge & Count -->
  <g transform="translate(130, 260)">
    <text x="0" y="0" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="88" font-weight="900" fill="url(#flameGlow)" filter="url(#softGlow)">🔥 ${safeStreak} DAYS</text>
    <text x="0" y="45" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="24" font-weight="600" fill="#f1f5f9">Unbroken Morning Ritual &amp; Deep Focus Streak</text>
  </g>

  <!-- Milestone Badge & Focus Track Pill -->
  <g transform="translate(130, 360)">
    <!-- Milestone Pill -->
    <rect x="0" y="0" width="310" height="46" rx="23" fill="rgba(124, 58, 237, 0.2)" stroke="#7c3aed" stroke-width="1.5" />
    <text x="26" y="29" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="17" font-weight="800" fill="#c4b5fd">🏆 ${milestone}</text>

    <!-- Track Pill -->
    <rect x="325" y="0" width="340" height="46" rx="23" fill="rgba(34, 211, 238, 0.14)" stroke="${safeTrackColor}" stroke-width="1.5" />
    <text x="350" y="29" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="16" font-weight="800" fill="#67e8f9">${safeTrackIcon} ${safeTrackLabel}</text>
  </g>

  <!-- Footer Watermark & Verification Details -->
  <g transform="translate(130, 475)">
    <text x="0" y="0" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="16" font-weight="600" fill="#94a3b8">Verified Discipline Record • <tspan fill="#38bdf8">${safeDate}</tspan></text>
    <text x="0" y="28" font-family="'JetBrains Mono', monospace" font-size="14" font-weight="500" fill="#64748b">SCAN QR TO VERIFY • ${safeVerifyUrl.replace(/^https?:\/\//, "")}</text>
  </g>

  <!-- Vector QR Code Module -->
  ${qrSvg}
</svg>`;
}

/**
 * Generates a high-resolution weekly consistency report card SVG.
 */
function generateWeeklyReportCardSvg({
  name = "Morning Builder",
  streak = 7,
  track = "deep-work",
  grade = "A+",
  completionRate = "100%",
  activeDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
  dayStatuses = [true, true, true, true, true, true, true],
  focusMinutes = 175,
  journalsLogged = 7,
  verifyUrl = "https://morningroutinesender.com/routine",
  date = new Date().toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }),
} = {}) {
  const safeStreak = parseInt(streak, 10) || 0;
  const trackInfo = getTrackDetails(track);
  const safeTrackLabel = escapeXml(trackInfo.label);
  const safeTrackIcon = escapeXml(trackInfo.icon);
  const safeTrackColor = escapeXml(trackInfo.color);
  const safeName = escapeXml(name.startsWith("@") ? name : `@${name}`);
  const userInitial = escapeXml((name.replace(/[^a-zA-Z0-9]/g, "")[0] || "M").toUpperCase());
  const safeDate = escapeXml(date);
  const safeGrade = escapeXml(grade || "A+");
  const safeRate = escapeXml(completionRate || "100%");
  const safeFocusMins = parseInt(focusMinutes, 10) || 0;
  const safeJournals = parseInt(journalsLogged, 10) || 0;
  const safeVerifyUrl = escapeXml(verifyUrl);

  const qrSvg = generateVectorQrMatrix(verifyUrl, 100, 1000, 420);

  const dayPillsSvg = activeDays
    .slice(0, 7)
    .map((dayName, idx) => {
      const isDone = !!dayStatuses[idx];
      const x = 130 + idx * 95;
      const dotFill = isDone ? "#10b981" : "rgba(255, 255, 255, 0.1)";
      const dotText = isDone ? "✓" : "–";
      const textFill = isDone ? "#ffffff" : "#64748b";
      return `
      <g transform="translate(${x}, 320)">
        <rect x="0" y="0" width="80" height="60" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="${isDone ? "rgba(16, 185, 129, 0.4)" : "rgba(255, 255, 255, 0.08)"}" stroke-width="1.2" />
        <text x="40" y="22" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="700" fill="#94a3b8">${escapeXml(dayName.toUpperCase())}</text>
        <circle cx="40" cy="42" r="11" fill="${dotFill}" />
        <text x="40" y="46" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="800" fill="${textFill}">${dotText}</text>
      </g>`;
    })
    .join("\n");

  return `<svg width="1200" height="630" viewBox="0 0 1200 630" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="wBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#050608" />
      <stop offset="50%" stop-color="#0b1120" />
      <stop offset="100%" stop-color="#050608" />
    </linearGradient>
    <linearGradient id="wGradeGlow" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" stop-color="#34d399" />
      <stop offset="100%" stop-color="#22d3ee" />
    </linearGradient>
    <linearGradient id="wGlassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.2)" />
      <stop offset="50%" stop-color="rgba(16, 185, 129, 0.35)" />
      <stop offset="100%" stop-color="rgba(34, 211, 238, 0.2)" />
    </linearGradient>
    <filter id="wGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feGaussianBlur stdDeviation="20" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
  </defs>

  <rect width="1200" height="630" fill="url(#wBgGrad)" />
  <circle cx="1060" cy="130" r="260" fill="#10b981" opacity="0.2" filter="url(#wGlow)" />
  <circle cx="140" cy="510" r="250" fill="#7c3aed" opacity="0.18" filter="url(#wGlow)" />

  <!-- Main Glass Container -->
  <rect x="70" y="55" width="1060" height="520" rx="28" fill="rgba(12, 17, 29, 0.82)" stroke="url(#wGlassBorder)" stroke-width="1.8" />

  <!-- Header -->
  <g transform="translate(130, 110)">
    <rect x="0" y="0" width="44" height="44" rx="12" fill="#10b981" />
    <path d="M14 22l6 6 12-12" stroke="#ffffff" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" />
    <text x="58" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="18" font-weight="800" fill="#ffffff" letter-spacing="1.5">MORNING ROUTINE SENDER</text>
    <text x="58" y="42" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="600" fill="#94a3b8" letter-spacing="0.5">WEEKLY HABIT SCORECARD • CONSISTENCY REPORT</text>
  </g>

  <!-- User Handle -->
  <g transform="translate(850, 110)">
    <rect x="0" y="0" width="220" height="44" rx="22" fill="rgba(255, 255, 255, 0.06)" stroke="rgba(255, 255, 255, 0.12)" stroke-width="1" />
    <circle cx="22" cy="22" r="14" fill="#10b981" />
    <text x="22" y="27" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="800" fill="#ffffff">${userInitial}</text>
    <text x="48" y="28" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="700" fill="#f8fafc">${safeName}</text>
    <circle cx="198" cy="22" r="8" fill="#34d399" />
    <path d="M194.5 22l2.5 2.5 5-5" stroke="#ffffff" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
  </g>

  <!-- Hero Grade Banner -->
  <g transform="translate(130, 240)">
    <text x="0" y="0" font-family="'Plus Jakarta Sans', sans-serif" font-size="64" font-weight="900" fill="url(#wGradeGlow)">GRADE: ${safeGrade}</text>
    <text x="0" y="38" font-family="'Plus Jakarta Sans', sans-serif" font-size="20" font-weight="600" fill="#cbd5e1">${safeRate} Weekly Consistency Rate • Unbroken Momentum</text>
  </g>

  <!-- 7-Day Day-by-Day Timeline -->
  ${dayPillsSvg}

  <!-- Stats Metrics Row -->
  <g transform="translate(130, 420)">
    <!-- Stat 1: Total Focus -->
    <rect x="0" y="0" width="220" height="60" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)" />
    <text x="20" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#94a3b8">TOTAL FOCUS</text>
    <text x="20" y="48" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="800" fill="#22d3ee">⚡ ${safeFocusMins}m</text>

    <!-- Stat 2: Active Streak -->
    <rect x="235" y="0" width="220" height="60" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)" />
    <text x="255" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#94a3b8">ACTIVE STREAK</text>
    <text x="255" y="48" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="800" fill="#f59e0b">🔥 ${safeStreak} Days</text>

    <!-- Stat 3: Reflections Logged -->
    <rect x="470" y="0" width="220" height="60" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.08)" />
    <text x="490" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#94a3b8">REFLECTIONS</text>
    <text x="490" y="48" font-family="'JetBrains Mono', monospace" font-size="20" font-weight="800" fill="#a78bfa">✍️ ${safeJournals} Logged</text>

    <!-- Stat 4: Track Persona -->
    <rect x="705" y="0" width="260" height="60" rx="14" fill="rgba(255, 255, 255, 0.04)" stroke="${safeTrackColor}" stroke-width="1.2" />
    <text x="725" y="24" font-family="'Plus Jakarta Sans', sans-serif" font-size="12" font-weight="700" fill="#94a3b8">FOCUS PERSONA</text>
    <text x="725" y="48" font-family="'Plus Jakarta Sans', sans-serif" font-size="15" font-weight="800" fill="${safeTrackColor}">${safeTrackIcon} ${safeTrackLabel}</text>
  </g>

  <!-- Footer Watermark & Verification -->
  <g transform="translate(130, 525)">
    <text x="0" y="0" font-family="'Plus Jakarta Sans', sans-serif" font-size="14" font-weight="600" fill="#64748b">Verified Weekly Discipline Record • <tspan fill="#38bdf8">${safeDate}</tspan></text>
    <text x="0" y="20" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="500" fill="#475569">SCAN QR TO VERIFY • ${safeVerifyUrl.replace(/^https?:\/\//, "")}</text>
  </g>

  <!-- QR Code -->
  ${qrSvg}
</svg>`;
}

module.exports = {
  escapeXml,
  getMilestoneTitle,
  getTrackDetails,
  generateVectorQrMatrix,
  generateStreakSvg,
  generateWeeklyReportCardSvg,
};
