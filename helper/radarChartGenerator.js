/**
 * helper/radarChartGenerator.js
 * SVG Radar / Spider Polygon Chart Generator for the "5 Pillars of Consistency"
 * Morning Routine Sender
 */

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
 * The 5 Core Pillars of Consistency with labels, emojis, and geometric offsets.
 */
const PILLARS = [
  {
    key: "riseTime",
    label: "Rise Time Precision",
    emoji: "🌅",
    textAnchor: "middle",
    labelDx: 0,
    labelDy: -28,
  },
  {
    key: "physical",
    label: "Physical Grounding",
    emoji: "⚡",
    textAnchor: "start",
    labelDx: 18,
    labelDy: -2,
  },
  {
    key: "deepWork",
    label: "Deep Work Sprint",
    emoji: "🎯",
    textAnchor: "start",
    labelDx: 16,
    labelDy: 20,
  },
  {
    key: "reflection",
    label: "Reflection Depth",
    emoji: "📖",
    textAnchor: "end",
    labelDx: -16,
    labelDy: 20,
  },
  {
    key: "grit",
    label: "Streak Grit",
    emoji: "🔥",
    textAnchor: "end",
    labelDx: -18,
    labelDy: -2,
  },
];

/**
 * Format track name into uppercase display label.
 */
function formatTrackLabel(track) {
  const t = String(track || "deep-work")
    .toLowerCase()
    .trim();
  switch (t) {
    case "mindfulness":
      return "MINDFULNESS & STOIC";
    case "executive":
      return "HIGH-PERFORMANCE EXEC";
    case "learning":
      return "LIFELONG LEARNER";
    case "classic":
      return "MORNING ENERGIZER";
    case "deep-work":
    default:
      return "DEEP WORK & BUILDER";
  }
}

/**
 * Generates an SVG radar / spider polygon chart of the "5 Pillars of Consistency".
 *
 * @param {Object} options
 * @param {string} [options.subscriberName="Morning Builder"]
 * @param {string} [options.trackName="deep-work"]
 * @param {number} [options.streakCount=7]
 * @param {Object} [options.scores={}]
 * @param {number} [options.scores.riseTime=85]
 * @param {number} [options.scores.physical=80]
 * @param {number} [options.scores.deepWork=90]
 * @param {number} [options.scores.reflection=75]
 * @param {number} [options.scores.grit=88]
 * @param {string} [options.grade]
 * @returns {string} Standalone SVG XML string (800x800)
 */
function generateRadarChartSvg({
  subscriberName = "Morning Builder",
  trackName = "deep-work",
  streakCount = 7,
  scores = {},
  grade = null,
} = {}) {
  const CX = 400;
  const CY = 400;
  const MAX_R = 230;

  // Sanitized scores bounded strictly between 0 and 100
  const safeScores = {
    riseTime: Math.max(
      0,
      Math.min(100, scores?.riseTime !== undefined ? Number(scores.riseTime) : 85),
    ),
    physical: Math.max(
      0,
      Math.min(100, scores?.physical !== undefined ? Number(scores.physical) : 80),
    ),
    deepWork: Math.max(
      0,
      Math.min(100, scores?.deepWork !== undefined ? Number(scores.deepWork) : 90),
    ),
    reflection: Math.max(
      0,
      Math.min(100, scores?.reflection !== undefined ? Number(scores.reflection) : 75),
    ),
    grit: Math.max(0, Math.min(100, scores?.grit !== undefined ? Number(scores.grit) : 88)),
  };

  const avgScore = Math.round(
    (safeScores.riseTime +
      safeScores.physical +
      safeScores.deepWork +
      safeScores.reflection +
      safeScores.grit) /
      5,
  );

  const defaultGrade =
    avgScore >= 92
      ? "A+"
      : avgScore >= 85
        ? "A"
        : avgScore >= 75
          ? "B"
          : avgScore >= 65
            ? "C"
            : "D";

  const safeGrade = escapeXml(grade ? String(grade).toUpperCase() : defaultGrade);
  const momentum = avgScore;
  const safeStreak = Math.max(0, parseInt(streakCount, 10) || 0);
  const safeTrackLabel = escapeXml(formatTrackLabel(trackName));

  const cleanName = String(subscriberName || "Morning Builder").trim();
  const safeSubscriberName = escapeXml(cleanName.startsWith("@") ? cleanName : `@${cleanName}`);
  const userInitial = escapeXml((cleanName.replace(/[^a-zA-Z0-9]/g, "")[0] || "M").toUpperCase());

  // Math: 5 Angles starting at -PI/2 (top 12 o'clock)
  const angles = PILLARS.map((_, i) => -Math.PI / 2 + (i * 2 * Math.PI) / 5);

  // Concentric pentagon polygon rings: 20%, 40%, 60%, 80%, 100%
  const scales = [0.2, 0.4, 0.6, 0.8, 1.0];
  const concentricPolygonsSvg = scales
    .map((s) => {
      const r = MAX_R * s;
      const pts = angles
        .map((a) => `${(CX + r * Math.cos(a)).toFixed(1)},${(CY + r * Math.sin(a)).toFixed(1)}`)
        .join(" ");
      const stroke = s === 1.0 ? "rgba(56, 189, 248, 0.35)" : "rgba(255, 255, 255, 0.09)";
      const strokeWidth = s === 1.0 ? "1.5" : "1";
      return `<polygon points="${pts}" fill="none" stroke="${stroke}" stroke-width="${strokeWidth}" />`;
    })
    .join("\n    ");

  // Concentric scale percentage badges along vertical axis
  const scaleBadgesSvg = scales
    .map((s) => {
      const pct = Math.round(s * 100);
      const y = (CY - MAX_R * s + 4).toFixed(1);
      return `<text x="408" y="${y}" font-family="'JetBrains Mono', monospace" font-size="9" font-weight="600" fill="rgba(148, 163, 184, 0.5)">${pct}%</text>`;
    })
    .join("\n    ");

  // 5 Radial Axis lines from center (400, 400)
  const radialLinesSvg = angles
    .map((a) => {
      const x2 = (CX + MAX_R * Math.cos(a)).toFixed(1);
      const y2 = (CY + MAX_R * Math.sin(a)).toFixed(1);
      return `<line x1="${CX}" y1="${CY}" x2="${x2}" y2="${y2}" stroke="rgba(255, 255, 255, 0.15)" stroke-width="1.2" stroke-dasharray="4,4" />`;
    })
    .join("\n    ");

  // Data Polygon calculation
  const dataCoords = PILLARS.map((p, i) => {
    const val = safeScores[p.key];
    const r = MAX_R * (val / 100);
    const a = angles[i];
    return {
      x: CX + r * Math.cos(a),
      y: CY + r * Math.sin(a),
      val,
    };
  });

  const dataPointsStr = dataCoords.map((pt) => `${pt.x.toFixed(1)},${pt.y.toFixed(1)}`).join(" ");

  // Circular vertex markers with glowing aura
  const vertexMarkersSvg = dataCoords
    .map((pt) => {
      const x = pt.x.toFixed(1);
      const y = pt.y.toFixed(1);
      return `
      <g>
        <circle cx="${x}" cy="${y}" r="10" fill="#38bdf8" opacity="0.35" filter="url(#radarPointGlow)" />
        <circle cx="${x}" cy="${y}" r="6" fill="#06080e" stroke="#38bdf8" stroke-width="2.5" />
        <circle cx="${x}" cy="${y}" r="2" fill="#ffffff" />
      </g>`;
    })
    .join("");

  // Outer vertex labels (emoji, metric name, percentage score)
  const labelsSvg = PILLARS.map((pillar, i) => {
    const a = angles[i];
    const tipX = CX + MAX_R * Math.cos(a);
    const tipY = CY + MAX_R * Math.sin(a);
    const lx = (tipX + pillar.labelDx).toFixed(1);
    const ly = (tipY + pillar.labelDy).toFixed(1);
    const scoreVal = safeScores[pillar.key];

    return `
    <g>
      <text x="${lx}" y="${ly}" text-anchor="${pillar.textAnchor}">
        <tspan font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="12" font-weight="700" fill="#cbd5e1">${pillar.emoji} ${escapeXml(pillar.label)}</tspan>
        <tspan x="${lx}" dy="16" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" fill="#38bdf8">${scoreVal}%</tspan>
      </text>
    </g>`;
  }).join("");

  return `<svg width="800" height="800" viewBox="0 0 800 800" fill="none" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <!-- Deep Obsidian Gradient Background -->
    <linearGradient id="radarBgGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#06080e" />
      <stop offset="50%" stop-color="#0a0f1c" />
      <stop offset="100%" stop-color="#0d121f" />
    </linearGradient>

    <!-- Neon Cyan to Indigo Data Polygon Gradient -->
    <linearGradient id="radarPolyGrad" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#38bdf8" />
      <stop offset="100%" stop-color="#6366f1" />
    </linearGradient>

    <!-- Glassmorphic Card Border Gradient -->
    <linearGradient id="radarGlassBorder" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="rgba(255, 255, 255, 0.16)" />
      <stop offset="50%" stop-color="rgba(56, 189, 248, 0.28)" />
      <stop offset="100%" stop-color="rgba(99, 102, 241, 0.16)" />
    </linearGradient>

    <!-- Glowing Filters -->
    <filter id="radarPointGlow" x="-50%" y="-50%" width="200%" height="200%">
      <feGaussianBlur stdDeviation="5" result="blur" />
      <feComposite in="SourceGraphic" in2="blur" operator="over" />
    </filter>
    <filter id="radarAmbientGlow" x="-30%" y="-30%" width="160%" height="160%">
      <feGaussianBlur stdDeviation="40" result="blur" />
    </filter>
    <filter id="radarCardShadow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="8" stdDeviation="12" flood-color="#000000" flood-opacity="0.5" />
    </filter>
  </defs>

  <!-- Deep Obsidian Background -->
  <rect width="800" height="800" fill="url(#radarBgGrad)" />

  <!-- Ambient Glowing Auras -->
  <circle cx="220" cy="200" r="200" fill="#38bdf8" opacity="0.07" filter="url(#radarAmbientGlow)" />
  <circle cx="580" cy="600" r="220" fill="#6366f1" opacity="0.07" filter="url(#radarAmbientGlow)" />

  <!-- Inner Obsidian Glass Frame -->
  <rect x="20" y="20" width="760" height="760" rx="28" fill="rgba(10, 14, 26, 0.55)" stroke="url(#radarGlassBorder)" stroke-width="1.6" />

  <!-- Top Brand Header -->
  <g transform="translate(48, 52)">
    <rect x="0" y="0" width="40" height="40" rx="12" fill="#0f172a" stroke="rgba(56, 189, 248, 0.45)" stroke-width="1.2" />
    <path d="M12 20 L18 26 L28 14" stroke="#38bdf8" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none" />
    <text x="52" y="18" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="14" font-weight="800" fill="#ffffff" letter-spacing="1.5">MORNING ROUTINE SENDER</text>
    <text x="52" y="34" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="11" font-weight="600" fill="#94a3b8" letter-spacing="0.5">5-PILLAR CONSISTENCY RADAR • DISCIPLINE MATRIX</text>
  </g>

  <!-- Top Right Subscriber Pill -->
  <g transform="translate(752, 52)">
    <rect x="-240" y="0" width="240" height="40" rx="20" fill="rgba(255, 255, 255, 0.04)" stroke="rgba(255, 255, 255, 0.1)" stroke-width="1" />
    <circle cx="-218" cy="20" r="12" fill="#6366f1" />
    <text x="-218" y="24" text-anchor="middle" font-family="'Plus Jakarta Sans', sans-serif" font-size="11" font-weight="800" fill="#ffffff">${userInitial}</text>
    <text x="-198" y="25" font-family="'Plus Jakarta Sans', sans-serif" font-size="13" font-weight="700" fill="#f8fafc">${safeSubscriberName}</text>
    <text x="-18" y="25" text-anchor="end" font-family="'JetBrains Mono', monospace" font-size="12" font-weight="800" fill="#38bdf8">🔥 ${safeStreak}d</text>
  </g>

  <!-- Concentric Pentagon Polygon Rings (20%, 40%, 60%, 80%, 100%) -->
  <g>
    ${concentricPolygonsSvg}
  </g>

  <!-- Concentric Scale Percentage Labels -->
  <g>
    ${scaleBadgesSvg}
  </g>

  <!-- 5 Radial Axis Lines Radiating from (400, 400) -->
  <g>
    ${radialLinesSvg}
  </g>

  <!-- Data Polygon with Neon Cyan/Indigo Gradient Fill and Glowing Stroke -->
  <polygon points="${dataPointsStr}" fill="url(#radarPolyGrad)" fill-opacity="0.35" stroke="#38bdf8" stroke-width="3" stroke-linejoin="round" />

  <!-- Circular Vertex Markers at Data Points -->
  ${vertexMarkersSvg}

  <!-- Axis Labels Outside Vertex Tips -->
  ${labelsSvg}

  <!-- Center Brand Watermark & Core Disc -->
  <g transform="translate(400, 400)" pointer-events="none">
    <circle r="34" fill="rgba(6, 8, 14, 0.85)" stroke="rgba(56, 189, 248, 0.3)" stroke-width="1.2" />
    <circle r="30" fill="none" stroke="rgba(255, 255, 255, 0.06)" stroke-width="0.8" />
    <path d="M-9 -6 L0 -14 L9 -6 L9 9 L-9 9 Z" fill="none" stroke="#38bdf8" stroke-width="1.8" opacity="0.75" />
    <circle cx="0" cy="1.5" r="2.5" fill="#6366f1" />
  </g>

  <!-- Track Subtitle -->
  <text x="400" y="708" text-anchor="middle" font-family="'Plus Jakarta Sans', -apple-system, sans-serif" font-size="11" font-weight="700" fill="#64748b" letter-spacing="1.5">ROUTINE TRACK: ${safeTrackLabel}</text>

  <!-- Consistency Grade Badge Watermark -->
  <g transform="translate(400, 742)">
    <rect x="-165" y="-19" width="330" height="38" rx="19" fill="rgba(13, 18, 31, 0.92)" stroke="rgba(56, 189, 248, 0.35)" stroke-width="1.4" filter="url(#radarCardShadow)" />
    <text x="0" y="6" text-anchor="middle" font-family="'JetBrains Mono', monospace" font-size="13" font-weight="800" fill="#f8fafc" letter-spacing="1.2">GRADE: ${safeGrade} • ${momentum}% MOMENTUM</text>
  </g>
</svg>`;
}

module.exports = {
  PILLARS,
  generateRadarChartSvg,
};
