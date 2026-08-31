// helper/curatedSparks.js

/**
 * 5 Coach Persona Specifications & Metadata Registry
 */
const COACH_PERSONAS_METADATA = {
  stoic: {
    id: "stoic",
    name: "Marcus Aurelius & Stoic Sage",
    title: "The Stoic Sage",
    badge: "🏛️ Stoic Sage",
    archetype: "Roman Emperor & Stoic Philosopher",
    tagline: "Master your internal citadel & cultivate unshakable tranquility.",
    icon: "fa-monument",
    color: "#7c3aed",
    tone: "Grounded, serene, introspective, unshakable, objective, dignified",
    focusDomains:
      "Dichotomy of control, amor fati, memento mori, emotional equanimity, virtue under pressure",
    philosophy:
      "You have power over your mind, not outside events. Meet every obstacle as raw fuel for virtue.",
    sampleQuote:
      "You have power over your mind - not outside events. Realize this, and you will find strength. — Marcus Aurelius",
    sampleSpark:
      "External turbulence has no power over your calm mind unless you grant it permission. Ground your judgment in reason and command your morning.",
  },
  relentless: {
    id: "relentless",
    name: "Relentless Operator",
    title: "The Relentless Operator",
    badge: "⚡ Relentless Operator",
    archetype: "High-Performance Disciplinarian & Extreme Operator",
    tagline: "Zero excuses, radical accountability & uncompromising execution.",
    icon: "fa-bolt",
    color: "#f43f5e",
    tone: "Direct, intense, uncompromising, accountability-driven, gritty, electrifying",
    focusDomains:
      "Zero excuses, extreme ownership, friction destruction, discomfort tolerance, discipline equals freedom",
    philosophy:
      "Discipline is the only bridge between vision and reality. Stop negotiating with weakness—attack the day.",
    sampleQuote: "Discipline equals freedom. The only easy day was yesterday. — Jocko Willink",
    sampleSpark:
      "Stop negotiating with comfort. Attack your #1 hardest deliverable before the rest of the world wakes up. Momentum is seized, never given.",
  },
  zen: {
    id: "zen",
    name: "Zen Master",
    title: "The Zen Master",
    badge: "🧘 Zen Master",
    archetype: "Mindfulness Teacher & Calibrated Peace Sage",
    tagline: "Conscious breath, deep presence & calibrated stillness.",
    icon: "fa-spa",
    color: "#10b981",
    tone: "Tranquil, gentle, spacious, breathing-centered, deeply present, poetic",
    focusDomains:
      "Beginner's mind (Shoshin), conscious breathwork, radical acceptance, non-attachment, stillness in motion",
    philosophy:
      "Quiet the turbulent waters of the mind to reflect truth. Every moment is a clean slate to begin in peace.",
    sampleQuote: "Peace comes from within. Do not seek it without. — Buddha",
    sampleSpark:
      "Drop the burden of yesterday and the worries of tomorrow. In this single conscious breath, you have everything needed to step forward with ease.",
  },
  "tech-lead": {
    id: "tech-lead",
    name: "Principal Architect",
    title: "The Principal Architect",
    badge: "💻 Principal Architect",
    archetype: "Staff Engineering Lead & Systems Optimizer",
    tagline: "High engineering leverage, modular thinking & systematic execution.",
    icon: "fa-terminal",
    color: "#06b6d4",
    tone: "Analytical, crisp, high-signal, modular, pragmatic, first-principles",
    focusDomains:
      "80/20 leverage, technical debt elimination, single-tasking flow states, architecture sprints, systematic execution",
    philosophy:
      "Simplicity is prerequisite for reliability. Optimize the critical path, eliminate friction, and build for compounding leverage.",
    sampleQuote:
      "Simplicity is prerequisite for reliability. Measure twice, commit once. — Edsger W. Dijkstra",
    sampleSpark:
      "Identify your single highest-leverage bottleneck and eliminate it. Guard your morning 90-minute architecture sprint with zero context switching.",
  },
  optimist: {
    id: "optimist",
    name: "Momentum Catalyst",
    title: "The Momentum Catalyst",
    badge: "☀️ Momentum Catalyst",
    archetype: "Vibrant Energy Coach & Radical Optimism Champion",
    tagline: "Electrifying enthusiasm, radical gratitude & 1% daily compounding.",
    icon: "fa-sun",
    color: "#f59e0b",
    tone: "Uplifting, electrifying, infectious enthusiasm, radical gratitude, growth-igniting",
    focusDomains:
      "1% daily compounding, celebrating micro-wins, contagious positive energy, abundance mindset, joy in execution",
    philosophy:
      "Energy is a conscious choice. Greet every challenge with profound gratitude, infectious optimism, and unstoppable drive.",
    sampleQuote:
      "The secret of your future is hidden in your daily routine. Rise with joy and make today count! — Mike Murdock",
    sampleSpark:
      "Today is an extraordinary canvas of opportunity. Bring vibrant energy to your craft, celebrate your consistency, and ignite compounding momentum!",
  },
};

/**
 * Maps streak count to psychological streak milestone tiers
 */
function getStreakTier(streak) {
  const count = Number(streak) || 0;
  if (count >= 100) {
    return {
      title: "Master of Morning",
      stageDescription: "Century mastery & effortless automaticity. You've reached elite status.",
      tierKey: "tier-100",
    };
  }
  if (count >= 60) {
    return {
      title: "Titan Habit",
      stageDescription: "Deep compounding and long-term automaticity. Plateau resistance.",
      tierKey: "tier-60",
    };
  }
  if (count >= 30) {
    return {
      title: "Unbreakable Flow",
      stageDescription:
        "1-month milestone. Identity has crystallized into effortless morning discipline.",
      tierKey: "tier-30",
    };
  }
  if (count >= 14) {
    return {
      title: "Iron Consistency",
      stageDescription: "Two weeks strong. Momentum is overcoming friction.",
      tierKey: "tier-14",
    };
  }
  if (count >= 7) {
    return {
      title: "Weekly Champion",
      stageDescription: "1 full week unbroken. First major compounding inflection.",
      tierKey: "tier-7",
    };
  }
  if (count >= 3) {
    return {
      title: "Kinetic Momentum",
      stageDescription: "Day 3+ ignition. Moving from conscious effort to automatic rhythm.",
      tierKey: "tier-3",
    };
  }
  return {
    title: "First Light",
    stageDescription: "Day 1-2 inception. Breaking the initial inertia.",
    tierKey: "tier-1",
  };
}

/**
 * Curated Sparks Matrix organized by Coach Persona & Milestone Tiers
 */
const CURATED_SPARK_MATRIX = {
  stoic: {
    "tier-1": [
      {
        sparkReflection:
          "You have power over your mind, not outside events. Greet this morning with unshakeable calm and clear judgment.",
        microAction:
          "Identify the single biggest external stressor on your mind and consciously classify it as outside your control.",
        focusMantra: "Control the controllable.",
      },
      {
        sparkReflection:
          "The obstacle in the path becomes the path. Never forget, within every difficulty lies a chance to practice virtue.",
        microAction: "Take 3 deep, slow breaths before touching any screen or notification.",
        focusMantra: "Turn obstacle into fuel.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Day 3 of discipline. When you arise in the morning, think of what a privilege it is to be alive, to think, to enjoy, to love.",
        microAction:
          "Write down 1 Stoic intention for how you will respond when interrupted today.",
        focusMantra: "Stillness amidst turbulence.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "One full unbroken week of Stoic alignment. Inner fortress is built not in quiet solitude, but through consistent daily practice.",
        microAction:
          "Perform a 60-second negative visualization (premeditatio malorum) to inoculate your mind against surprise disruptions.",
        focusMantra: "Unshakable internal citadel.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two weeks of Stoic mastery. Your thoughts dye your soul. Color them with reason, equanimity, and courageous action.",
        microAction:
          "Review your morning priorities through the lens of timeless virtue: Wisdom, Courage, Justice, Moderation.",
        focusMantra: "Virtue is the sole good.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-day Stoic milestone. You have forged an impregnable sanctuary of calm. Let no external storm shake your grounded resolve.",
        microAction:
          "Pause for 2 minutes before starting your first major task and recommit to single-minded purpose.",
        focusMantra: "Master of my mind.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 consecutive days of Stoic discipline. You respond with measured wisdom rather than reactive impulse.",
        microAction: "Mentor or inspire one peer today with patient presence and calm judgment.",
        focusMantra: "Wisdom through equanimity.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Stoic Century Mastery. You stand as a lighthouse in any storm, unmoving and serene.",
        microAction: "Reflect on how your reactions have transformed over the last 100 mornings.",
        focusMantra: "Eternal inner peace.",
      },
    ],
  },
  relentless: {
    "tier-1": [
      {
        sparkReflection:
          "No excuses. No negotiations with weakness. Attack your morning with pure savage discipline.",
        microAction:
          "Drink 500ml water and complete 25 pushups immediately to shatter morning lethargy.",
        focusMantra: "Zero excuses, all execution.",
      },
      {
        sparkReflection:
          "Don't count the days; make the days count. The standard you walk past is the standard you accept.",
        microAction:
          "Identify the #1 task you've been procrastinating on and schedule it for your first 45 minutes.",
        focusMantra: "Attack the hardest first.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Day 3! The initial excitement fades; now real discipline begins. Stay hard when comfort calls.",
        microAction:
          "Turn your phone on Do Not Disturb and lock in a 60-minute non-negotiable execution block.",
        focusMantra: "Discipline over emotion.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days unbroken! You are building an undeniable reputation with yourself. Keep raising the standard.",
        microAction:
          "Review today's goals and increase your output target on your top priority by 10%.",
        focusMantra: "Relentless forward pressure.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two weeks of relentless grit. While others hit snooze, you compound undeniable competitive advantage.",
        microAction:
          "Eliminate one comfortable distraction that has crept into your morning routine.",
        focusMantra: "Outwork your yesterday self.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-Day Relentless Titan! Extreme ownership has become your default operating system.",
        microAction:
          "Set a grueling sprint deliverable for this morning and execute without a single glance at social feeds.",
        focusMantra: "Unbreakable mental armor.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of absolute execution. You don't hope for results; you manufacture them through savage daily consistency.",
        microAction: "Tackle the most intimidating problem on your plate before lunch.",
        focusMantra: "Dominate the standard.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100-Day Relentless Legend! You have rewired your identity into an unstoppable execution machine.",
        microAction:
          "Write down your next 100-day impossible goal and take the first step right now.",
        focusMantra: "Master of relentless grit.",
      },
    ],
  },
  zen: {
    "tier-1": [
      {
        sparkReflection:
          "Quiet the mind, and the soul will speak. Begin this day with an open heart and deep, conscious presence.",
        microAction:
          "Close your eyes and complete 5 cycles of mindful box breathing (4s in, 4s hold, 4s out, 4s hold).",
        focusMantra: "Present in this breath.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Notice how returning to the breath instantly dissolves morning hurry. Peace is not elsewhere; it is right here.",
        microAction:
          "Drink your morning tea or coffee in complete silence without looking at any device.",
        focusMantra: "Mindful in every sip.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days of mindful presence. Like still water that reflects the moon, a calm mind sees all things clearly.",
        microAction: "Take a 5-minute silent morning walk with gentle awareness of your senses.",
        focusMantra: "Stillness reflects clarity.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two unbroken weeks of Zen clarity. You no longer carry the weight of rushing through your mornings.",
        microAction:
          "Perform a 60-second mindful body scan, letting tension melt from your neck and shoulders.",
        focusMantra: "Calm within, clear without.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-Day Zen Milestone. In the beginner's mind there are many possibilities, but in the expert's mind there are few.",
        microAction:
          "Approach your hardest challenge today with the fresh curiosity of beginner's mind (Shoshin).",
        focusMantra: "Fresh mind, boundless peace.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of tranquil strength. You move through chaotic environments without losing your center.",
        microAction:
          "Pause before opening your inbox and set an intention of mindful presence for your communications.",
        focusMantra: "Unshakable inner calm.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Zen Mastery. You embody living meditation in every action, word, and breath.",
        microAction: "Share a moment of unconditional gratitude with someone you value today.",
        focusMantra: "Master of Zen harmony.",
      },
    ],
  },
  "tech-lead": {
    "tier-1": [
      {
        sparkReflection:
          "Simplicity is prerequisite for reliability. Strip away low-signal noise and direct all bandwidth to high-leverage architecture.",
        microAction:
          "Close all Slack/Discord channels and open only the single repository/spec needed for your #1 ticket.",
        focusMantra: "Maximize signal, minimize noise.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Three days of engineering leverage. The best code is the code you never have to write—design for elegance and simplicity.",
        microAction:
          "Write out the 3 core invariants for today's technical deliverable before writing implementation code.",
        focusMantra: "Design cleanly, execute fast.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days of structured engineering discipline! Systematic compounding turns complex systems into modular masterpieces.",
        microAction:
          "Audit your tech debt backlog and schedule 30 minutes to refactor one high-friction module.",
        focusMantra: "Compounding code craft.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two weeks of flow-state engineering. Protect your prime focus hours with rigorous calendar defense.",
        microAction:
          "Decline or delegate at least one synchronous status meeting that could be an asynchronous PR.",
        focusMantra: "Protect prime focus hours.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-Day Principal Architect milestone! You operate with staff-level leverage, clarity, and rapid execution velocity.",
        microAction:
          "Draft a 1-page architecture decision record (ADR) for your next major system improvement.",
        focusMantra: "Systematic high-leverage impact.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of relentless architectural rigor. You build resilient systems by mastering your daily development rituals.",
        microAction:
          "Automate or script one repetitive manual workflow that steals 10 minutes from your team daily.",
        focusMantra: "Automate friction away.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100-Day Staff Architect Titan. Legendary craftsmanship, impeccable system design, and unbroken focus discipline.",
        microAction:
          "Mentor an engineer on how you organize your mornings for uninterrupted deep flow state.",
        focusMantra: "Master of engineering leverage.",
      },
    ],
  },
  optimist: {
    "tier-1": [
      {
        sparkReflection:
          "Today is full of unlimited possibilities! Greet the morning with electrifying energy, a big smile, and radical gratitude.",
        microAction:
          "Write down 3 things you are genuinely excited about creating or experiencing today.",
        focusMantra: "Rise with joy and purpose.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Day 3 of vibrant momentum! Feel how positive expectation primes your brain for creative breakthroughs and serendipity.",
        microAction:
          "Step into the morning sunlight for 3 minutes and take 3 deep revitalizing breaths.",
        focusMantra: "Bright light, vibrant mind.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "One full week of unstoppable enthusiasm! Your radiant morning energy is an infectious force for good in the world.",
        microAction:
          "Send a genuine 1-sentence note of encouragement or appreciation to a teammate or loved one.",
        focusMantra: "Radiate positive power.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two weeks of high-energy mornings! You are waking up primed for joy, enthusiastic action, and compounding micro-wins.",
        microAction:
          "Celebrate your consistency with a proud victory fist pump and your favorite morning music.",
        focusMantra: "Unstoppable daily joy.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-Day Momentum Catalyst milestone! You prove that choosing optimism and gratitude transforms every single morning.",
        microAction:
          "Plan an energizing reward or healthy celebration for reaching your 30-day streak!",
        focusMantra: "Gratitude unlocks abundance.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of radiant energy. Your optimism isn't luck—it's a high-performance superpower you've mastered.",
        microAction:
          "Turn one minor annoyance from yesterday into an opportunity for growth and laughter today.",
        focusMantra: "Every obstacle is opportunity.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Radiant Energy! A true master of daily positivity, physical activation, and unstoppable optimism.",
        microAction:
          "Look in the mirror, celebrate your 100-day transformation, and step boldly into the day with a smile!",
        focusMantra: "Master of radiant energy.",
      },
    ],
  },
};

/**
 * Deterministic selection based on coach persona / track, streak tier, and date hash
 */
function getCuratedSpark({
  coachPersona = "stoic",
  track: _track = "deep-work",
  streakCount = 0,
  dateStr = "",
  email = "",
}) {
  const normPersona = (coachPersona || "stoic").toLowerCase().trim();
  const personaMatrix = CURATED_SPARK_MATRIX[normPersona] || CURATED_SPARK_MATRIX["stoic"];
  const tier = getStreakTier(streakCount);

  let candidates = personaMatrix[tier.tierKey];
  if (!candidates || !candidates.length) {
    candidates = personaMatrix["tier-1"] || CURATED_SPARK_MATRIX["stoic"]["tier-1"];
  }

  // Deterministic seed based on date + email + persona
  const seedString = `${dateStr}_${email || normPersona}_${streakCount}_${normPersona}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % candidates.length;
  return candidates[index];
}

module.exports = {
  COACH_PERSONAS_METADATA,
  getStreakTier,
  getCuratedSpark,
  CURATED_SPARK_MATRIX,
};
