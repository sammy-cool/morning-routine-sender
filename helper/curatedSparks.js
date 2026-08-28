// helper/curatedSparks.js

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

const CURATED_SPARK_MATRIX = {
  "deep-work": {
    "tier-1": [
      {
        sparkReflection:
          "The hardest line of code is always the first one written. Silence all alerts and enter your first 45-minute sprint with single-minded craft.",
        microAction:
          "Close all messaging apps and open only the single source file you need for your #1 priority.",
        focusMantra: "Silence the noise, master the signal.",
      },
      {
        sparkReflection:
          "Momentum is built by doing, not by planning to do. Take immediate action on your hardest technical problem.",
        microAction:
          "Write down the exact 3-step test case for your next commit before opening your inbox.",
        focusMantra: "Start fast, eliminate friction.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Three days in, cognitive resistance begins to drop. Your brain is adapting to morning deep work sprints.",
        microAction:
          "Block 90 uninterrupted minutes in your calendar right now before anyone asks for a sync.",
        focusMantra: "Protect your prime focus hours.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days of pure engineering focus! The compound interest of distraction-free builder hours is now tangible.",
        microAction:
          "Review your git log from this week and identify your single cleanest architectural breakthrough.",
        focusMantra: "Consistency compounds engineering mastery.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two unbroken weeks of deep work. You are no longer just practicing focus; you are an engineer who lives in flow.",
        microAction:
          "Identify the one piece of tech debt or complexity you can ruthlessly simplify today.",
        focusMantra: "Simplicity is prerequisite for reliability.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-day Deep Work milestone! You operate in the top decile of single-tasking flow and mental endurance.",
        microAction:
          "Design today's core sprint with zero context switching. 1 deliverable, 100% presence.",
        focusMantra: "Mastery through uninterrupted focus.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 consecutive days of builder momentum. Your focus is an unshakeable competitive moat.",
        microAction:
          "Tackle the most intimidating architectural challenge on your backlog first thing this morning.",
        focusMantra: "Relentless execution, world-class craft.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Deep Work mastery! Unbroken craftsmanship and legendary consistency.",
        microAction: "Mentor or inspire one peer today on how you protect your focus rituals.",
        focusMantra: "Master of the morning craft.",
      },
    ],
  },
  mindfulness: {
    "tier-1": [
      {
        sparkReflection:
          "You have power over your mind, not outside events. Take three grounding breaths and greet this day with stillness.",
        microAction: "Complete 2 minutes of 4-7-8 box breathing before touching any screen.",
        focusMantra: "Present in this moment.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Notice the subtle shift when you start your day with intention rather than digital reactivity.",
        microAction: "Jot down 3 specific things you are grateful for this morning.",
        focusMantra: "Gratitude unlocks abundance.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "One full week of morning equanimity. Inner peace is not an accident; it is a discipline you are mastering.",
        microAction:
          "Identify one external trigger you anticipate today and consciously decide to remain calm.",
        focusMantra: "Equanimity in every circumstance.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "14 days of mindfulness. As the morning stabilizes, your entire day responds with clarity and grace.",
        microAction: "Take a 5-minute silent morning walk with zero headphones or notifications.",
        focusMantra: "Calm mind, clear direction.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30 days of Stoic resilience. You have built an impenetrable sanctuary of inner peace.",
        microAction:
          "Perform a 60-second morning body scan and release tension in your shoulders and jaw.",
        focusMantra: "Unshakable stillness within.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of mindful living. You respond with wisdom rather than reacting with impulse.",
        microAction:
          "Pause before your first meeting and set a compassionate intention for your interactions.",
        focusMantra: "Wisdom through presence.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "Centurion of Mindfulness! 100+ days of unwavering presence and tranquil strength.",
        microAction: "Reflect on how much lighter your thoughts feel compared to Day 1.",
        focusMantra: "Master of inner peace.",
      },
    ],
  },
  executive: {
    "tier-1": [
      {
        sparkReflection:
          "High performers do not manage time; they manage energy and execute the vital few high-leverage outcomes.",
        microAction:
          "Define your #1 high-leverage outcome before opening any inbound messaging channels.",
        focusMantra: "Lead with decisive clarity.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Momentum is accelerating. Protect your morning calendar aggressively from low-value meetings.",
        microAction:
          "Audit today's calendar and delegate or decline at least one non-essential sync.",
        focusMantra: "Focus on strategic leverage.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days of executive rigor! Consistent morning alignment drives compounding organizational clarity.",
        microAction:
          "Review your top quarterly KPI and ensure today's schedule directly moves that needle.",
        focusMantra: "Strategy dictates execution.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two full weeks of high-leverage discipline. You operate with decisive clarity and zero reactive drift.",
        microAction: "Draft the 3 strategic decisions you need to finalize before 12:00 PM.",
        focusMantra: "Clarity breeds speed.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-day executive streak. Your discipline sets the standard for everyone in your orbit.",
        microAction:
          "Spend 5 uninterrupted minutes thinking through 2nd and 3rd order consequences of your top initiative.",
        focusMantra: "Vision backed by relentless action.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of relentless strategic execution. High leverage has become your natural operating baseline.",
        microAction: "Eliminate one recurring organizational bottleneck today.",
        focusMantra: "Relentless executive leverage.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100-Day Executive Titan. Master of high-stakes focus, ruthless prioritization, and peak performance.",
        microAction:
          "Review the trajectory of your greatest accomplishment over the last 100 mornings.",
        focusMantra: "Master of strategic velocity.",
      },
    ],
  },
  learning: {
    "tier-1": [
      {
        sparkReflection:
          "Knowledge compounds faster than capital when paired with active recall and daily curiosity.",
        microAction: "Read 10 pages of a dense non-fiction or technical book before social feeds.",
        focusMantra: "Learn deeply, synthesize clearly.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "3 days of mental growth. Applying the Feynman technique transforms passive information into active insight.",
        microAction:
          "Explain yesterday's key learning out loud in 60 seconds as if explaining to a beginner.",
        focusMantra: "Teach to master.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "A full week of rapid synthesis! Continuous daily learning is an unassailable competitive advantage.",
        microAction:
          "Select one mental model (e.g., Inversion, First Principles) to apply to today's top problem.",
        focusMantra: "First principles thinking.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "14 days of dedicated intellectual expansion. Your mental models are interconnecting rapidly.",
        microAction: "Capture 1 profound insight in your permanent note-taking system.",
        focusMantra: "Compound knowledge daily.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30 days of polymath curiosity! Your ability to cross-pollinate ideas across domains is sharpening.",
        microAction:
          "Formulate one counter-intuitive hypothesis to explore during your deep reading session.",
        focusMantra: "Curiosity without limits.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of relentless knowledge acquisition. You are building an expansive intellectual moat.",
        microAction:
          "Write a 3-bullet synthesis of the most valuable concept you've learned this month.",
        focusMantra: "Synthesize, innovate, master.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100-Day Centurion of Lifelong Learning! You embody the pursuit of timeless wisdom and technical mastery.",
        microAction:
          "Share one mental model with a colleague or friend that unlocked a breakthrough for you.",
        focusMantra: "Master of perpetual curiosity.",
      },
    ],
  },
  classic: {
    "tier-1": [
      {
        sparkReflection:
          "Every morning is a clean slate. Hydrate, get natural sunlight in your eyes, and step into today with vibrant energy.",
        microAction:
          "Drink 500ml of water and do 20 jumping jacks to activate your nervous system.",
        focusMantra: "Rise with energy and purpose.",
      },
    ],
    "tier-3": [
      {
        sparkReflection:
          "Three consecutive days of energized mornings! Feel the physical and mental momentum taking root.",
        microAction: "Write down one positive intention that will define your attitude today.",
        focusMantra: "Energy flows where intention goes.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days unbroken! Your morning routine has transformed into a fountain of daily optimism and energy.",
        microAction:
          "Smile, take 3 deep belly breaths, and commit to being 1% better than yesterday.",
        focusMantra: "Unstoppable daily momentum.",
      },
    ],
    "tier-14": [
      {
        sparkReflection:
          "Two weeks of vibrant mornings. You are waking up primed for success and enthusiastic execution.",
        microAction:
          "Step outside for 3 minutes of natural morning sunlight before sitting at your desk.",
        focusMantra: "Bright light, energized mind.",
      },
    ],
    "tier-30": [
      {
        sparkReflection:
          "30-day Energizer milestone! Waking up with drive and clarity has become second nature.",
        microAction: "Celebrate your consistency and plan an energizing healthy lunch.",
        focusMantra: "Living with vitality and joy.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of positive morning power. Your vibrant energy radiates into everything you build.",
        microAction:
          "Send a quick note of encouragement or gratitude to someone who energizes you.",
        focusMantra: "Radiate energy and excellence.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Energized Mornings! A true master of daily positivity, physical priming, and unstoppable momentum.",
        microAction:
          "Look in the mirror, celebrate your 100-day transformation, and step boldly into the day.",
        focusMantra: "Master of radiant energy.",
      },
    ],
  },
};

/**
 * Deterministic selection based on track, streak tier, and date hash
 */
function getCuratedSpark({ track = "deep-work", streakCount = 0, dateStr = "", email = "" }) {
  const normTrack = (track || "deep-work").toLowerCase().trim();
  const trackMatrix = CURATED_SPARK_MATRIX[normTrack] || CURATED_SPARK_MATRIX["deep-work"];
  const tier = getStreakTier(streakCount);

  let candidates = trackMatrix[tier.tierKey];
  if (!candidates || !candidates.length) {
    candidates = trackMatrix["tier-1"] || CURATED_SPARK_MATRIX["deep-work"]["tier-1"];
  }

  // Deterministic seed based on date + email
  const seedString = `${dateStr}_${email || normTrack}_${streakCount}`;
  let hash = 0;
  for (let i = 0; i < seedString.length; i++) {
    hash = (hash << 5) - hash + seedString.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % candidates.length;
  return candidates[index];
}

module.exports = {
  getStreakTier,
  getCuratedSpark,
  CURATED_SPARK_MATRIX,
};
