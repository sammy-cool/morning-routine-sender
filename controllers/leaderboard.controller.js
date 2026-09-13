// controllers/leaderboard.controller.js
const logger = require("../logger");

/**
 * Escapes unsafe characters for HTML rendering
 */
function escapeHtml(unsafe) {
  return (unsafe || "")
    .toString()
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;")
    .replace(/`/g, "&#x60;");
}

/**
 * Anonymizes email address for public Hall of Fame display (e.g. alex****@...)
 */
function anonymizeEmail(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "anonymous@user.net";
  }
  const parts = email.trim().toLowerCase().split("@");
  if (parts.length !== 2) return "anonymous@user.net";
  const [local, domain] = parts;
  const prefixLength = Math.min(4, Math.max(1, Math.floor(local.length / 2)));
  const prefix = local.slice(0, prefixLength);
  return `${prefix}****@${domain}`;
}

/**
 * Generates an anonymous display handle from email
 */
function getDisplayHandle(email) {
  if (!email || typeof email !== "string" || !email.includes("@")) {
    return "@builder";
  }
  const local = email.trim().toLowerCase().split("@")[0] || "user";
  const prefixLength = Math.min(4, Math.max(1, Math.floor(local.length / 2)));
  const prefix = local.slice(0, prefixLength);
  return `@${prefix}****`;
}

/**
 * Computes milestone badges earned based on streak count
 */
function getMilestoneBadges(streak) {
  const s = Math.max(0, Number(streak) || 0);
  const badges = [];
  if (s >= 3) badges.push("3-Day Spark");
  if (s >= 7) badges.push("7-Day Momentum");
  if (s >= 14) badges.push("14-Day Pioneer");
  if (s >= 21) badges.push("21-Day Habit Loop");
  if (s >= 30) badges.push("30-Day Master");
  if (s >= 50) badges.push("50-Day Iron Will");
  if (s >= 100) badges.push("Century Club");
  if (s >= 365) badges.push("Solar Legend");
  return badges;
}

/**
 * Computes top milestone badge title
 */
function getTopMilestoneBadge(streak) {
  const badges = getMilestoneBadges(streak);
  return badges.length > 0 ? badges[badges.length - 1] : "First Light";
}

/**
 * Computes consistency grade based on streak count
 */
function getConsistencyGrade(streak) {
  const s = Math.max(0, Number(streak) || 0);
  if (s >= 60) return "A+";
  if (s >= 30) return "A";
  if (s >= 14) return "A-";
  if (s >= 7) return "B+";
  if (s >= 3) return "B";
  if (s >= 1) return "B-";
  return "C";
}

/**
 * Normalized track config & display details
 */
function getTrackDetails(trackKey) {
  const t = (trackKey || "deep-work").toLowerCase().trim();
  switch (t) {
    case "stoic-mindset":
    case "mindfulness":
    case "stoic":
      return {
        key: "stoic-mindset",
        name: "Stoic Mindset",
        badge: "🧘 Stoic Mindset",
        icon: "🧘",
        color: "#a855f7",
      };
    case "fitness":
    case "health":
    case "classic":
    case "morning-energizer":
      return {
        key: "fitness",
        name: "Fitness",
        badge: "💪 Fitness & Energy",
        icon: "💪",
        color: "#f59e0b",
      };
    case "creative":
    case "learning":
    case "lifelong-learner":
      return {
        key: "creative",
        name: "Creative",
        badge: "🎨 Creative & Learning",
        icon: "🎨",
        color: "#ec4899",
      };
    case "executive":
      return {
        key: "executive",
        name: "Executive",
        badge: "💼 Executive Strategy",
        icon: "💼",
        color: "#10b981",
      };
    case "deep-work":
    case "builder":
    default:
      return {
        key: "deep-work",
        name: "Deep Work",
        badge: "⚡ Deep Work",
        icon: "⚡",
        color: "#38bdf8",
      };
  }
}

/**
 * Renders the Obsidian Glassmorphism Leaderboard & Hall of Fame HTML
 */
function renderLeaderboardHtml({ leaders = [], squads = [], track = "all", host = "localhost" }) {
  const trackTabs = [
    { key: "all", label: "All Tracks", icon: "🌐" },
    { key: "deep-work", label: "Deep Work", icon: "⚡" },
    { key: "stoic-mindset", label: "Stoic Mindset", icon: "🧘" },
    { key: "fitness", label: "Fitness", icon: "💪" },
    { key: "creative", label: "Creative", icon: "🎨" },
  ];

  const top3 = leaders.slice(0, 3);
  const podiumOrder = [];
  if (top3.length >= 2) podiumOrder.push({ ...top3[1], podiumRank: 2, medal: "🥈", place: "2nd" });
  if (top3.length >= 1) podiumOrder.push({ ...top3[0], podiumRank: 1, medal: "🥇", place: "1st" });
  if (top3.length >= 3) podiumOrder.push({ ...top3[2], podiumRank: 3, medal: "🥉", place: "3rd" });

  const canonicalUrl = `https://${host}/leaderboard${track !== "all" ? `?track=${encodeURIComponent(track)}` : ""}`;
  const ogImageUrl = `https://${host}/assets/mrn-brand-ico.png`;

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
  <meta name="robots" content="index, follow">
  <meta name="theme-color" content="#06080e">
  <meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-capable" content="yes">
  <title>🏆 Morning Routine Hall of Fame — Unbroken Streaks &amp; Community Leaderboard</title>
  <meta name="description" content="Discover top ritualists, unbroken morning streaks, milestone champions, and top accountability squads on the Morning Routine Sender Hall of Fame.">
  <link rel="canonical" href="${escapeHtml(canonicalUrl)}">

  <!-- SEO & Social OpenGraph Tags -->
  <meta property="og:type" content="website">
  <meta property="og:url" content="${escapeHtml(canonicalUrl)}">
  <meta property="og:title" content="🏆 Morning Routine Hall of Fame — Unbroken Streaks &amp; Community Leaderboard">
  <meta property="og:description" content="Unbroken streaks, habit milestones, and top accountability squads across Deep Work, Stoic Mindset, Fitness, and Creative tracks.">
  <meta property="og:image" content="${escapeHtml(ogImageUrl)}">
  <meta property="og:image:width" content="512">
  <meta property="og:image:height" content="512">
  <meta property="og:image:alt" content="Morning Routine Hall of Fame">
  <meta property="og:site_name" content="Morning Routine Sender">

  <!-- Twitter Card Metadata -->
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:site" content="@MorningRoutine">
  <meta name="twitter:creator" content="@MorningRoutine">
  <meta name="twitter:title" content="🏆 Morning Routine Hall of Fame — Unbroken Streaks &amp; Community Leaderboard">
  <meta name="twitter:description" content="Unbroken streaks, habit milestones, and top accountability squads across Deep Work, Stoic Mindset, Fitness, and Creative tracks.">
  <meta name="twitter:image" content="${escapeHtml(ogImageUrl)}">

  <!-- Fonts & Icons -->
  <link rel="icon" type="image/x-icon" href="/favicon.ico">
  <link rel="icon" type="image/svg+xml" href="/assets/logo.svg">
  <link rel="apple-touch-icon" href="/assets/mrn-brand-ico.png">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800;900&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.5.1/css/all.min.css">
  <link rel="stylesheet" href="/css/responsive-layout.css">

  <style>
    :root {
      --bg-dark: #06080e;
      --bg-surface: #0a0e1a;
      --bg-surface-elevated: #10162a;
      --glass-bg: rgba(16, 22, 42, 0.72);
      --glass-border: rgba(255, 255, 255, 0.08);
      --glass-border-hover: rgba(255, 255, 255, 0.16);
      --neon-cyan: #38bdf8;
      --neon-violet: #6366f1;
      --neon-emerald: #10b981;
      --neon-amber: #f59e0b;
      --neon-gold: #fbbf24;
      --text-main: #f8fafc;
      --text-muted: #94a3b8;
      --text-dim: #64748b;
    }

    * {
      box-sizing: border-box;
      margin: 0;
      padding: 0;
    }

    html, body {
      background-color: var(--bg-dark);
      color: var(--text-main);
      font-family: 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      scroll-behavior: smooth;
      -webkit-overflow-scrolling: touch;
      min-height: 100dvh;
      scroll-padding-top: 5rem;
      scroll-padding-bottom: 6rem;
    }

    /* Ambient Glowing Neon Auras */
    .ambient-glow {
      position: fixed;
      width: 500px;
      height: 500px;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
      filter: blur(140px);
      opacity: 0.15;
    }
    .glow-cyan {
      top: -100px;
      right: 5%;
      background: radial-gradient(circle, var(--neon-cyan), transparent);
    }
    .glow-violet {
      bottom: 10%;
      left: -100px;
      background: radial-gradient(circle, var(--neon-violet), transparent);
    }

    .main-wrap {
      position: relative;
      z-index: 1;
      max-width: 1240px;
      margin: 0 auto;
      padding: 1.5rem 1.25rem 5rem;
    }

    /* Navbar */
    .top-nav {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem 1.5rem;
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 20px;
      margin-bottom: 2.5rem;
    }
    .brand-link {
      display: flex;
      align-items: center;
      gap: 12px;
      text-decoration: none;
      color: var(--text-main);
    }
    .brand-link img {
      width: 32px;
      height: 32px;
    }
    .brand-text {
      font-weight: 800;
      font-size: 1.15rem;
      letter-spacing: -0.02em;
    }
    .nav-cta-group {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .nav-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0.5rem 1rem;
      min-height: 44px;
      border-radius: 12px;
      font-size: 0.9rem;
      font-weight: 600;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .nav-btn:active {
      transform: scale(0.975);
    }
    .nav-btn-glass {
      background: rgba(255, 255, 255, 0.05);
      color: var(--text-muted);
      border: 1px solid var(--glass-border);
    }
    .nav-btn-glass:hover {
      background: rgba(255, 255, 255, 0.1);
      color: var(--text-main);
    }
    .nav-btn-primary {
      background: linear-gradient(135deg, var(--neon-cyan), var(--neon-violet));
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 18px rgba(56, 189, 248, 0.3);
    }
    .nav-btn-primary:hover {
      box-shadow: 0 6px 24px rgba(56, 189, 248, 0.45);
    }

    /* Hero Section */
    .hero-section {
      text-align: center;
      margin-bottom: 3rem;
    }
    .hero-badge {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      background: rgba(251, 191, 36, 0.12);
      border: 1px solid rgba(251, 191, 36, 0.3);
      color: var(--neon-gold);
      padding: 6px 16px;
      border-radius: 9999px;
      font-size: 0.85rem;
      font-weight: 700;
      letter-spacing: 0.04em;
      text-transform: uppercase;
      margin-bottom: 1.25rem;
    }
    .hero-title {
      font-size: clamp(1.75rem, 4vw, 3rem);
      font-weight: 900;
      letter-spacing: -0.03em;
      line-height: 1.2;
      margin-bottom: 1rem;
      background: linear-gradient(135deg, #ffffff 40%, var(--neon-cyan) 85%, var(--neon-violet) 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
    }
    .hero-subtitle {
      font-size: 1.1rem;
      color: var(--text-muted);
      max-width: 650px;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }

    /* Track Filter Tabs */
    .tabs-wrapper {
      display: flex;
      justify-content: center;
      gap: 8px;
      flex-wrap: wrap;
      margin-bottom: 2.5rem;
    }
    .track-tab {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 0.6rem 1.2rem;
      min-height: 44px;
      border-radius: 9999px;
      background: var(--glass-bg);
      border: 1px solid var(--glass-border);
      color: var(--text-muted);
      text-decoration: none;
      font-size: 0.9rem;
      font-weight: 700;
      transition: all 0.2s ease;
    }
    .track-tab:hover {
      border-color: var(--glass-border-hover);
      color: var(--text-main);
    }
    .track-tab.active {
      background: linear-gradient(135deg, rgba(56, 189, 248, 0.18), rgba(99, 102, 241, 0.18));
      border-color: var(--neon-cyan);
      color: #ffffff;
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.25);
    }

    /* Podium Top 3 */
    .podium-container {
      display: grid;
      grid-template-columns: repeat(3, 1fr);
      gap: 1.5rem;
      align-items: flex-end;
      margin-bottom: 3.5rem;
    }
    .podium-card {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 2rem 1.5rem;
      text-align: center;
      position: relative;
      transition: transform 0.3s ease, box-shadow 0.3s ease;
    }
    .podium-card:hover {
      transform: translateY(-6px);
    }
    .podium-card.rank-1 {
      order: 2;
      padding-top: 2.75rem;
      padding-bottom: 2.5rem;
      border-color: rgba(251, 191, 36, 0.4);
      background: linear-gradient(180deg, rgba(251, 191, 36, 0.08) 0%, rgba(16, 22, 42, 0.8) 100%);
      box-shadow: 0 8px 32px rgba(251, 191, 36, 0.15);
    }
    .podium-card.rank-2 {
      order: 1;
      border-color: rgba(56, 189, 248, 0.3);
      box-shadow: 0 8px 24px rgba(56, 189, 248, 0.1);
    }
    .podium-card.rank-3 {
      order: 3;
      border-color: rgba(249, 115, 22, 0.3);
      box-shadow: 0 8px 24px rgba(249, 115, 22, 0.1);
    }

    /* Glowing Neon Ring for Avatar */
    .avatar-neon-ring {
      width: 80px;
      height: 80px;
      margin: 0 auto 1.25rem;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 2rem;
      position: relative;
    }
    .podium-card.rank-1 .avatar-neon-ring {
      width: 96px;
      height: 96px;
      background: radial-gradient(circle, rgba(251, 191, 36, 0.2), transparent);
      border: 3px solid var(--neon-gold);
      box-shadow: 0 0 25px rgba(251, 191, 36, 0.6), inset 0 0 15px rgba(251, 191, 36, 0.3);
    }
    .podium-card.rank-2 .avatar-neon-ring {
      border: 3px solid var(--neon-cyan);
      box-shadow: 0 0 20px rgba(56, 189, 248, 0.5), inset 0 0 12px rgba(56, 189, 248, 0.25);
    }
    .podium-card.rank-3 .avatar-neon-ring {
      border: 3px solid #f97316;
      box-shadow: 0 0 20px rgba(249, 115, 22, 0.5), inset 0 0 12px rgba(249, 115, 22, 0.25);
    }
    .podium-rank-badge {
      position: absolute;
      bottom: -6px;
      right: -6px;
      background: var(--bg-surface);
      border: 1px solid var(--glass-border);
      border-radius: 50%;
      width: 28px;
      height: 28px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
      font-weight: 800;
    }

    .podium-handle {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--text-main);
      margin-bottom: 0.4rem;
    }
    .podium-track {
      font-size: 0.8rem;
      font-weight: 600;
      color: var(--text-muted);
      margin-bottom: 0.75rem;
    }
    .podium-streak {
      font-family: 'JetBrains Mono', monospace;
      font-size: 1.4rem;
      font-weight: 800;
      color: var(--neon-amber);
      margin-bottom: 0.5rem;
    }
    .podium-badges {
      display: flex;
      justify-content: center;
      gap: 6px;
      flex-wrap: wrap;
    }
    .badge-pill {
      font-size: 0.75rem;
      font-weight: 700;
      padding: 3px 10px;
      border-radius: 9999px;
      background: rgba(255, 255, 255, 0.06);
      border: 1px solid var(--glass-border);
      color: var(--text-muted);
    }

    /* Main Content Layout: Table + Squad Sidebar */
    .hall-content-grid {
      display: grid;
      grid-template-columns: 2fr 1fr;
      gap: 2rem;
      margin-bottom: 4rem;
    }

    .glass-card {
      background: var(--glass-bg);
      backdrop-filter: blur(16px);
      -webkit-backdrop-filter: blur(16px);
      border: 1px solid var(--glass-border);
      border-radius: 24px;
      padding: 1.75rem;
      overflow: hidden;
    }
    .card-header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 1.25rem;
      padding-bottom: 1rem;
      border-bottom: 1px solid var(--glass-border);
    }
    .card-header-title {
      font-size: 1.2rem;
      font-weight: 800;
      display: flex;
      align-items: center;
      gap: 10px;
    }

    /* Leaderboard Table */
    .table-responsive {
      overflow-x: auto;
      overscroll-behavior: contain;
      -webkit-overflow-scrolling: touch;
    }
    .leaderboard-table {
      width: 100%;
      border-collapse: collapse;
      text-align: left;
    }
    .leaderboard-table th {
      font-size: 0.75rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-dim);
      padding: 0.85rem 1rem;
      border-bottom: 1px solid var(--glass-border);
    }
    .leaderboard-table td {
      padding: 1rem;
      border-bottom: 1px solid rgba(255, 255, 255, 0.04);
      font-size: 0.92rem;
      vertical-align: middle;
    }
    .leaderboard-table tbody tr {
      transition: background-color 0.15s ease;
    }
    .leaderboard-table tbody tr:hover {
      background-color: rgba(255, 255, 255, 0.03);
    }

    .rank-cell {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      width: 50px;
    }
    .rank-top1 { color: var(--neon-gold); }
    .rank-top2 { color: var(--neon-cyan); }
    .rank-top3 { color: #f97316; }

    .user-cell {
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .user-avatar-mini {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--glass-border);
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.9rem;
    }
    .user-handle {
      font-weight: 700;
      color: var(--text-main);
    }

    .track-tag {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 3px 10px;
      border-radius: 9999px;
      font-size: 0.8rem;
      font-weight: 600;
      background: rgba(255, 255, 255, 0.04);
      border: 1px solid var(--glass-border);
    }

    .streak-flame-cell {
      font-family: 'JetBrains Mono', monospace;
      font-weight: 800;
      color: var(--neon-amber);
      display: inline-flex;
      align-items: center;
      gap: 6px;
    }

    .grade-badge {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      padding: 3px 8px;
      border-radius: 6px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.8rem;
      font-weight: 800;
      background: rgba(16, 185, 129, 0.15);
      border: 1px solid rgba(16, 185, 129, 0.3);
      color: var(--neon-emerald);
    }

    /* Squad Card List */
    .squad-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }
    .squad-item {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 1rem;
      border-radius: 16px;
      background: rgba(255, 255, 255, 0.02);
      border: 1px solid var(--glass-border);
      transition: all 0.2s ease;
    }
    .squad-item:hover {
      border-color: var(--glass-border-hover);
      background: rgba(255, 255, 255, 0.04);
    }
    .squad-info {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .squad-rank {
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      font-weight: 800;
      color: var(--text-dim);
      width: 24px;
    }
    .squad-name {
      font-weight: 700;
      font-size: 0.95rem;
      color: var(--text-main);
      margin-bottom: 2px;
    }
    .squad-subtext {
      font-size: 0.78rem;
      color: var(--text-muted);
    }
    .squad-stat {
      text-align: right;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.9rem;
      font-weight: 700;
      color: var(--neon-amber);
    }

    /* Viral CTAs Section */
    .cta-banner {
      background: linear-gradient(135deg, rgba(99, 102, 241, 0.12) 0%, rgba(56, 189, 248, 0.12) 100%);
      border: 1px solid rgba(56, 189, 248, 0.25);
      border-radius: 28px;
      padding: 3rem 2rem;
      text-align: center;
      position: relative;
      overflow: hidden;
    }
    .cta-banner h2 {
      font-size: clamp(1.5rem, 3.5vw, 2.25rem);
      font-weight: 900;
      margin-bottom: 1rem;
      color: #ffffff;
    }
    .cta-banner p {
      font-size: 1.05rem;
      color: var(--text-muted);
      max-width: 580px;
      margin: 0 auto 2rem;
      line-height: 1.6;
    }
    .cta-btn-group {
      display: flex;
      justify-content: center;
      gap: 14px;
      flex-wrap: wrap;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 10px;
      padding: 0.85rem 1.85rem;
      min-height: 48px;
      border-radius: 14px;
      font-size: 1rem;
      font-weight: 700;
      text-decoration: none;
      transition: all 0.2s ease;
      cursor: pointer;
    }
    .cta-btn:active {
      transform: scale(0.975);
    }
    .cta-primary {
      background: linear-gradient(135deg, var(--neon-cyan), var(--neon-violet));
      color: #ffffff;
      border: none;
      box-shadow: 0 4px 20px rgba(56, 189, 248, 0.35);
    }
    .cta-primary:hover {
      box-shadow: 0 6px 28px rgba(56, 189, 248, 0.5);
    }
    .cta-secondary {
      background: rgba(255, 255, 255, 0.06);
      color: var(--text-main);
      border: 1px solid var(--glass-border);
      backdrop-filter: blur(10px);
    }
    .cta-secondary:hover {
      background: rgba(255, 255, 255, 0.12);
      border-color: var(--glass-border-hover);
    }

    /* Footer */
    .hall-footer {
      text-align: center;
      margin-top: 4rem;
      padding-top: 2rem;
      border-top: 1px solid var(--glass-border);
      color: var(--text-dim);
      font-size: 0.85rem;
    }
    .hall-footer a {
      color: var(--text-muted);
      text-decoration: none;
      margin: 0 8px;
    }
    .hall-footer a:hover {
      color: var(--neon-cyan);
    }

    /* Toast Container */
    #duelToast {
      position: fixed;
      bottom: 24px;
      right: 24px;
      background: var(--bg-surface-elevated);
      border: 1px solid var(--neon-cyan);
      color: var(--text-main);
      padding: 12px 20px;
      border-radius: 12px;
      box-shadow: 0 10px 30px rgba(0, 0, 0, 0.5);
      display: none;
      align-items: center;
      gap: 10px;
      z-index: 9999;
      font-size: 0.9rem;
      font-weight: 600;
    }

    /* Responsive */
    @media (max-width: 900px) {
      .hall-content-grid {
        grid-template-columns: 1fr;
      }
      .podium-container {
        grid-template-columns: 1fr;
      }
      .podium-card.rank-1 {
        order: 1;
      }
      .podium-card.rank-2 {
        order: 2;
      }
      .podium-card.rank-3 {
        order: 3;
      }
    }
  </style>
</head>
<body>
  <div class="ambient-glow glow-cyan"></div>
  <div class="ambient-glow glow-violet"></div>

  <div class="main-wrap">
    <!-- Navbar -->
    <header class="top-nav">
      <a href="/" class="brand-link">
        <img src="/assets/logo.svg" alt="Morning Routine Sender" width="32" height="32">
        <span class="brand-text">Morning Routine</span>
      </a>
      <div class="nav-cta-group">
        <a href="/about" class="nav-btn nav-btn-glass">
          <i class="fas fa-info-circle"></i> <span>About</span>
        </a>
        <a href="/routine" class="nav-btn nav-btn-glass">
          <i class="fas fa-compass" style="color: var(--neon-cyan)"></i> <span>Companion</span>
        </a>
        <a href="/user-dashboard" class="nav-btn nav-btn-glass">
          <i class="fas fa-user-circle"></i> <span>Dashboard</span>
        </a>
        <a href="/#signupView" class="nav-btn nav-btn-primary">
          <i class="fas fa-bolt"></i> <span>Join Free</span>
        </a>
      </div>
    </header>

    <!-- Hero Section -->
    <section class="hero-section">
      <div class="hero-badge">
        <i class="fas fa-trophy"></i> Verified Community Streaks
      </div>
      <h1 class="hero-title">🏆 Morning Routine Hall of Fame — Unbroken Streaks &amp; Community Leaderboard</h1>
      <p class="hero-subtitle">
        Celebrating the world's most disciplined ritualists. See unbroken daily morning streaks,
        mastery milestones, and top-ranked accountability squads.
      </p>

      <!-- Routine Track Filter Tabs -->
      <nav class="tabs-wrapper" aria-label="Routine Track Filters">
        ${trackTabs
          .map(
            (tab) => `
          <a href="/leaderboard?track=${escapeHtml(tab.key)}" class="track-tab ${track === tab.key ? "active" : ""}">
            <span>${escapeHtml(tab.icon)}</span>
            <span>${escapeHtml(tab.label)}</span>
          </a>`,
          )
          .join("")}
      </nav>
    </section>

    <!-- Podium Top 3 Section -->
    ${
      podiumOrder.length > 0
        ? `
    <section class="podium-container" aria-label="Top 3 Ritualist Champions">
      ${podiumOrder
        .map(
          (p) => `
        <div class="podium-card rank-${p.podiumRank}">
          <div class="avatar-neon-ring">
            <span>${escapeHtml(p.medal)}</span>
            <div class="podium-rank-badge">${escapeHtml(p.place)}</div>
          </div>
          <div class="podium-handle">${escapeHtml(p.handle)}</div>
          <div class="podium-track">${escapeHtml(p.trackName)}</div>
          <div class="podium-streak">🔥 ${p.streakCount} DAYS</div>
          <div class="podium-badges">
            <span class="badge-pill">${escapeHtml(p.topBadge)}</span>
            <span class="grade-badge">Grade ${escapeHtml(p.consistencyGrade)}</span>
          </div>
        </div>`,
        )
        .join("")}
    </section>`
        : ""
    }

    <!-- Hall Content Grid: Table + Squads -->
    <div class="hall-content-grid">
      <!-- Leaderboard Table Card -->
      <section class="glass-card" aria-labelledby="tableHeading">
        <div class="card-header">
          <div class="card-header-title" id="tableHeading">
            <i class="fas fa-medal" style="color: var(--neon-cyan)"></i>
            <span>Top 25 Consistency Leaders</span>
          </div>
          <span class="badge-pill" style="color: var(--neon-cyan)">
            ${escapeHtml(leaders.length)} Ritualists
          </span>
        </div>

        <div class="table-responsive">
          <table class="leaderboard-table">
            <thead>
              <tr>
                <th>Rank</th>
                <th>Ritualist</th>
                <th>Track</th>
                <th>Streak</th>
                <th>Milestone Badges</th>
                <th>Grade</th>
              </tr>
            </thead>
            <tbody>
              ${
                leaders.length > 0
                  ? leaders
                      .map(
                        (l, idx) => `
                <tr>
                  <td class="rank-cell ${idx === 0 ? "rank-top1" : idx === 1 ? "rank-top2" : idx === 2 ? "rank-top3" : ""}">
                    #${l.rank}
                  </td>
                  <td>
                    <div class="user-cell">
                      <div class="user-avatar-mini">${idx === 0 ? "🥇" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : "⚡"}</div>
                      <div>
                        <div class="user-handle">${escapeHtml(l.handle)}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    <span class="track-tag">
                      ${escapeHtml(l.trackName)}
                    </span>
                  </td>
                  <td>
                    <span class="streak-flame-cell">🔥 ${l.streakCount}</span>
                  </td>
                  <td>
                    <div style="display: flex; gap: 4px; flex-wrap: wrap;">
                      ${(l.milestoneBadges || [])
                        .slice(-2)
                        .map((b) => `<span class="badge-pill">${escapeHtml(b)}</span>`)
                        .join("")}
                    </div>
                  </td>
                  <td>
                    <span class="grade-badge">${escapeHtml(l.consistencyGrade)}</span>
                  </td>
                </tr>`,
                      )
                      .join("")
                  : `
                <tr>
                  <td colspan="6" style="text-align: center; color: var(--text-muted); padding: 3rem 1rem;">
                    No active streaks recorded in this track yet. Be the first to claim the #1 spot!
                  </td>
                </tr>`
              }
            </tbody>
          </table>
        </div>
      </section>

      <!-- Squad Rankings Card -->
      <aside class="glass-card" aria-labelledby="squadHeading">
        <div class="card-header">
          <div class="card-header-title" id="squadHeading">
            <i class="fas fa-users" style="color: var(--neon-violet)"></i>
            <span>Top Squads</span>
          </div>
          <span class="badge-pill" style="color: var(--neon-violet)">
            ${escapeHtml(squads.length)} Active
          </span>
        </div>

        <div class="squad-list">
          ${
            squads.length > 0
              ? squads
                  .map(
                    (sq) => `
            <div class="squad-item">
              <div class="squad-info">
                <div class="squad-rank">#${sq.rank}</div>
                <div>
                  <div class="squad-name">${escapeHtml(sq.name)}</div>
                  <div class="squad-subtext">👥 ${sq.memberCount} / ${sq.maxMembers} Members • Grade ${escapeHtml(sq.consistencyGrade)}</div>
                </div>
              </div>
              <div class="squad-stat">
                🔥 ${sq.squadStreak}d
              </div>
            </div>`,
                  )
                  .join("")
              : `
            <div style="text-align: center; color: var(--text-muted); padding: 2rem 1rem;">
              <p style="margin-bottom: 1rem;">No accountability squads formed yet.</p>
              <a href="/user-dashboard#squads" class="nav-btn nav-btn-glass" style="display: inline-flex;">
                Create a Squad
              </a>
            </div>`
          }
        </div>
      </aside>
    </div>

    <!-- Viral CTAs Section -->
    <section class="cta-banner" aria-label="Join Community CTAs">
      <h2>Ready to Build Your Unbreakable Morning?</h2>
      <p>
        Join thousands of engineers, thinkers, and builders waking up with focus.
        Receive your personalized morning routine daily and climb the Hall of Fame.
      </p>
      <div class="cta-btn-group">
        <a href="/#signupView" class="cta-btn cta-primary">
          <i class="fas fa-bolt"></i> Start Your Unbroken Streak Today
        </a>
        <button type="button" class="cta-btn cta-secondary" id="challengeDuelBtn">
          <i class="fas fa-shield-halved" style="color: var(--neon-cyan)"></i> Challenge to Morning Duel
        </button>
      </div>
    </section>

    <!-- Footer -->
    <footer class="hall-footer">
      <p>
        &copy; ${new Date().getFullYear()} Morning Routine Sender • Zero-Noise Habit Architecture
      </p>
      <p style="margin-top: 8px;">
        <a href="/">Home</a> •
        <a href="/about">About</a> •
        <a href="/routine">Focus Companion</a> •
        <a href="/user-dashboard">Dashboard</a>
      </p>
    </footer>
  </div>

  <div id="duelToast" role="status" aria-live="polite">
    <i class="fas fa-check-circle" style="color: var(--neon-emerald)"></i>
    <span>Duel challenge link copied to clipboard! Share it with a rival.</span>
  </div>

  <script>
    document.getElementById("challengeDuelBtn")?.addEventListener("click", function() {
      const duelUrl = window.location.origin + "/routine?duel=1";
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText(duelUrl).then(() => {
          showToast();
        }).catch(() => {
          window.location.href = "/routine";
        });
      } else {
        window.location.href = "/routine";
      }
    });

    function showToast() {
      const toast = document.getElementById("duelToast");
      if (!toast) return;
      toast.style.display = "flex";
      setTimeout(() => {
        toast.style.display = "none";
      }, 3500);
    }
  </script>
</body>
</html>`;
}

/**
 * GET /leaderboard
 * GET /hall-of-fame
 * GET /api/leaderboard
 */
async function getPublicLeaderboard(req, res) {
  const db = require("../db/knex");

  try {
    const requestedTrack = (req.query?.track || "all").toString().toLowerCase().trim();

    // 1. Query Top 25 Subscribers sorted by streak_count DESC where is_active = true
    let subscribersQuery = db("subscribers").where((builder) => {
      builder.where("is_active", true).orWhere("is_active", 1);
    });

    if (requestedTrack && requestedTrack !== "all") {
      const trackAliases = {
        "stoic-mindset": ["stoic-mindset", "mindfulness", "stoic"],
        mindfulness: ["stoic-mindset", "mindfulness", "stoic"],
        fitness: ["fitness", "health", "classic", "morning-energizer"],
        creative: ["creative", "learning", "lifelong-learner"],
        "deep-work": ["deep-work", "builder"],
        executive: ["executive"],
      };
      const matchingTracks = trackAliases[requestedTrack] || [requestedTrack];
      subscribersQuery = subscribersQuery.whereIn("routine_track", matchingTracks);
    }

    const rawLeaders = await subscribersQuery.orderBy("streak_count", "desc").limit(25);

    const leaders = rawLeaders.map((sub, index) => {
      const streak = Number(sub.streak_count) || 0;
      const track = sub.routine_track || sub.template_type || "deep-work";
      const trackInfo = getTrackDetails(track);
      const anonymized = anonymizeEmail(sub.email);
      const handle = getDisplayHandle(sub.email);
      const milestoneBadges = getMilestoneBadges(streak);
      const topBadge = getTopMilestoneBadge(streak);
      const consistencyGrade = getConsistencyGrade(streak);

      return {
        rank: index + 1,
        handle,
        displayName: handle,
        anonymizedEmail: anonymized,
        email: anonymized, // Strictly never leak raw email
        streakCount: streak,
        routineTrack: track,
        trackName: trackInfo.name,
        milestoneBadges,
        topBadge,
        consistencyGrade,
      };
    });

    // 2. Query Top 10 Accountability Squads sorted by memberCount DESC or squadStreak DESC
    let squads = [];
    try {
      const hasSquadsTable = await db.schema.hasTable("accountability_squads");
      if (hasSquadsTable) {
        const rawSquads = await db("accountability_squads").select(
          "id",
          "name",
          "invite_code as inviteCode",
          "max_members as maxMembers",
          "squad_streak as squadStreak",
        );

        const memberCountsMap = new Map();
        const hasMembersTable = await db.schema.hasTable("squad_members");
        if (hasMembersTable) {
          const counts = await db("squad_members")
            .select("squad_id")
            .count("id as count")
            .groupBy("squad_id");
          counts.forEach((c) => {
            memberCountsMap.set(c.squad_id, Number(c.count) || 0);
          });
        }

        squads = rawSquads
          .map((sq) => {
            const memberCount = memberCountsMap.get(sq.id) || 0;
            const streak = Number(sq.squadStreak) || 0;
            return {
              id: sq.id,
              name: sq.name,
              inviteCode: sq.inviteCode,
              maxMembers: Number(sq.maxMembers) || 5,
              memberCount,
              squadStreak: streak,
              consistencyGrade: getConsistencyGrade(streak),
              totalConsistency: streak * 10 + memberCount * 5,
            };
          })
          .sort((a, b) => b.memberCount - a.memberCount || b.squadStreak - a.squadStreak)
          .slice(0, 10)
          .map((sq, idx) => ({ rank: idx + 1, ...sq }));
      }
    } catch (err) {
      logger.warn("Could not query squads for public leaderboard", { error: err.message });
    }

    // 3. Determine if client expects JSON or HTML
    const isJson =
      req.xhr ||
      (req.headers.accept && req.headers.accept.includes("application/json")) ||
      req.path.startsWith("/api/") ||
      req.originalUrl.includes("/api/") ||
      req.query?.format === "json";

    if (isJson) {
      return res.json({
        success: true,
        leaders,
        squads,
        track: requestedTrack,
        totalLeaders: leaders.length,
        totalSquads: squads.length,
      });
    }

    // 4. Render sleek Obsidian Glassmorphic HTML page
    const host =
      (typeof req.get === "function" ? req.get("host") : null) ||
      req.headers?.host ||
      "morningroutinesender.com";
    const html = renderLeaderboardHtml({ leaders, squads, track: requestedTrack, host });

    res.set("Content-Type", "text/html; charset=utf-8");
    res.set("Cache-Control", "public, max-age=300, stale-while-revalidate=600");
    return res.send(html);
  } catch (err) {
    logger.error("Error generating public leaderboard", { error: err.message });
    if (
      req.headers.accept?.includes("application/json") ||
      req.path.startsWith("/api/") ||
      req.originalUrl.includes("/api/")
    ) {
      return res.status(500).json({ success: false, error: "Failed to generate leaderboard" });
    }
    return res.status(500).send("Unable to load leaderboard. Please try again later.");
  }
}

module.exports = {
  getPublicLeaderboard,
  renderLeaderboardHtml,
  anonymizeEmail,
  getDisplayHandle,
  getMilestoneBadges,
  getTopMilestoneBadge,
  getConsistencyGrade,
  getTrackDetails,
};
