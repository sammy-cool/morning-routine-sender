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
  custom: {
    id: "custom",
    name: "Personalized Mentor",
    title: "The Personalized Mentor",
    badge: "✨ Personalized Mentor",
    archetype: "Custom AI Coach & Autonomous Advisor",
    tagline: "Customized guidance, personalized principles & tailored execution.",
    icon: "fa-user-astronaut",
    color: "#ec4899",
    tone: "Adaptive, personalized, inspiring, disciplined",
    focusDomains: "Custom directives, personalized milestones, tailored encouragement",
    philosophy: "Align your morning ritual with your unique personal manifesto and vision.",
    sampleQuote: "The mind is everything. What you think you become. — Buddha",
    sampleSpark:
      "Today is crafted around your personal vision. Execute with clear intention and steady discipline.",
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
      {
        sparkReflection:
          "Begin each morning by telling yourself: today I will encounter the busybody, the ungrateful, the arrogant, the deceitful. I can be harmed by none because I know virtue.",
        microAction:
          "Set a calm boundary: commit to not reacting emotionally to the first unforeseen disruption today.",
        focusMantra: "Anchor in composure.",
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
      {
        sparkReflection:
          "Three mornings of intentional living. Small habits compound quietly. Protect your inner citadel against mindless browsing.",
        microAction:
          "Dedicate your first 15 minutes exclusively to deep concentration before opening your communication channels.",
        focusMantra: "Protect the citadel.",
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
      {
        sparkReflection:
          "Seven mornings of self-mastery. Freedom is the only worthy goal in life. It is won by disregarding things that lie beyond our control.",
        microAction:
          "List two things you spent energy worrying about this week that had zero bearing on your true virtue.",
        focusMantra: "Sovereign over self.",
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
      {
        sparkReflection:
          "Fourteen days of steadfast resolve. Waste no more time arguing about what a good person should be. Be one.",
        microAction:
          "Take immediate action on an ethical duty or obligation you have been putting off.",
        focusMantra: "Action over debate.",
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
      {
        sparkReflection:
          "A full month of philosophical resilience. You have shifted from reacting to life to responding with measured deliberate reason.",
        microAction:
          "Review your progress in your journal and acknowledge how far your emotional equanimity has developed.",
        focusMantra: "Equanimity in all things.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 consecutive days of Stoic discipline. You respond with measured wisdom rather than reactive impulse.",
        microAction: "Mentor or inspire one peer today with patient presence and calm judgment.",
        focusMantra: "Wisdom through equanimity.",
      },
      {
        sparkReflection:
          "Sixty mornings of quiet grandeur. Like an emerald that retains its luster though left untrumpeted, your virtue speaks for itself.",
        microAction:
          "Execute your work today with excellence, seeking zero public acclaim or vanity praise.",
        focusMantra: "Integrity in silence.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Stoic Century Mastery. You stand as a lighthouse in any storm, unmoving and serene.",
        microAction: "Reflect on how your reactions have transformed over the last 100 mornings.",
        focusMantra: "Eternal inner peace.",
      },
      {
        sparkReflection:
          "Century milestone reached. You have cultivated a temperament that welcomes whatever destiny offers with grace (Amor Fati).",
        microAction:
          "Write down three words that define your philosophy of life going forward into your next century.",
        focusMantra: "Amor fati, eternal strength.",
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
      {
        sparkReflection:
          "Friction is your compass. Where you feel resistance is exactly where your breakthrough lies.",
        microAction:
          "Step straight into a cold shower or splash freezing water on your face right now.",
        focusMantra: "Embrace the friction.",
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
      {
        sparkReflection:
          "Three days in. Anyone can start on Monday with enthusiasm; champions execute when nobody is clapping.",
        microAction:
          "Clear your workspace of all clutter. Leave only your primary sprint objective visible.",
        focusMantra: "Execute in obscurity.",
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
      {
        sparkReflection:
          "One full week of dominance. Consistency is your weapon. Don't look back; accelerate through the finish line.",
        microAction:
          "Identify the biggest time-vampire from this week and ruthlessly cut it from your schedule.",
        focusMantra: "Relentless elimination.",
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
      {
        sparkReflection:
          "Fourteen days of unrelenting execution. You are conditioning your mind to ignore self-doubt and demand results.",
        microAction:
          "Set a timer for a 45-minute sprint and maintain 100% velocity without taking your hands off the keyboard.",
        focusMantra: "Sprint through walls.",
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
      {
        sparkReflection:
          "A month of unyielding momentum. You don't hope for results; you execute with surgical precision until the mission is done.",
        microAction:
          "Identify an ambitious quarterly milestone and double down on the key lead metric starting today.",
        focusMantra: "Extreme ownership.",
      },
    ],
    "tier-60": [
      {
        sparkReflection:
          "60 days of absolute execution. You don't hope for results; you manufacture them through savage daily consistency.",
        microAction: "Tackle the most intimidating problem on your plate before lunch.",
        focusMantra: "Dominate the standard.",
      },
      {
        sparkReflection:
          "Sixty days of relentless performance. You are in the top 1% of consistency. Never let complacency infiltrate your perimeter.",
        microAction:
          "Do a 5-minute debrief of yesterday's bottleneck and permanently engineer it out of your workflow.",
        focusMantra: "Never settle, keep hunting.",
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
      {
        sparkReflection:
          "Century of relentless fire. You have proven that discipline is not a momentary feeling, but an uncompromising lifestyle.",
        microAction:
          "Raise the bar on everything you touch today. Set the standard for everyone around you.",
        focusMantra: "Unrivaled operational intensity.",
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
      {
        sparkReflection:
          "When you walk, walk. When you eat, eat. Do not rush through the morning to reach an imaginary destination.",
        microAction:
          "Feel your feet firmly on the ground for 60 seconds, noticing the stability of the earth beneath you.",
        focusMantra: "Rooted in stillness.",
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
      {
        sparkReflection:
          "Three mornings of conscious awareness. The river flows naturally without force. Move with ease, not friction.",
        microAction:
          "Soften your shoulders and release any tension held in your jaw before beginning your work.",
        focusMantra: "Effortless flow.",
      },
    ],
    "tier-7": [
      {
        sparkReflection:
          "7 days of mindful presence. Like still water that reflects the moon, a calm mind sees all things clearly.",
        microAction: "Take a 5-minute silent morning walk with gentle awareness of your senses.",
        focusMantra: "Stillness reflects clarity.",
      },
      {
        sparkReflection:
          "A full week of gentle consistency. You have learned that true strength is not frantic action, but serene presence.",
        microAction:
          "Pause before speaking or typing in your first interaction today and listen with complete presence.",
        focusMantra: "Listen before responding.",
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
      {
        sparkReflection:
          "Fourteen days of anchored peace. You are the sky; everything else is just passing weather.",
        microAction:
          "When a stressful thought arises today, acknowledge it gently like a passing cloud and let it drift by.",
        focusMantra: "Spacious awareness.",
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
      {
        sparkReflection:
          "One month of mindful living. You have transformed routine into ritual, and morning into a temple of presence.",
        microAction:
          "Sit quietly for 3 full minutes with eyes closed before looking at your task list.",
        focusMantra: "Quiet sanctuary within.",
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
      {
        sparkReflection:
          "Sixty mornings of luminous awareness. Deep roots are never moved by the wind.",
        microAction:
          "Send a wave of unconditional compassion to someone in your life experiencing difficulty.",
        focusMantra: "Deep roots, calm branches.",
      },
    ],
    "tier-100": [
      {
        sparkReflection:
          "100+ Days of Zen Mastery. You embody living meditation in every action, word, and breath.",
        microAction: "Share a moment of unconditional gratitude with someone you value today.",
        focusMantra: "Master of Zen harmony.",
      },
      {
        sparkReflection:
          "Century of mindful presence. Every moment has become an open doorway to peace and timeless wisdom.",
        microAction:
          "Dedicate your actions today to the peace, clarity, and well-being of everyone you encounter.",
        focusMantra: "Awakened in every step.",
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
      {
        sparkReflection:
          "Good code solves the immediate requirement. Great engineering designs the system so the problem cannot occur again.",
        microAction:
          "Write down the single invariant your system must satisfy before beginning your implementation.",
        focusMantra: "Solve the root cause.",
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
      {
        sparkReflection:
          "Premature optimization is the root of all evil. Build the clean, modular baseline first; profile before tuning.",
        microAction:
          "Identify one complex branch or conditional in your recent work and plan a cleaner abstraction.",
        focusMantra: "Measure before optimizing.",
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
      {
        sparkReflection:
          "One week of disciplined development rituals. Clean architecture is not a luxury; it is the compounding velocity of the team.",
        microAction:
          "Add comprehensive integration test coverage to your most fragile code path today.",
        focusMantra: "Test-driven confidence.",
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
      {
        sparkReflection:
          "Fourteen days of systematic execution. Treat your personal time and cognitive bandwidth like high-availability compute.",
        microAction:
          "Turn off all browser badges and notifications during your morning deep work block.",
        focusMantra: "Zero context switching.",
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
      {
        sparkReflection:
          "One month of architectural leadership. You balance velocity with technical health, shipping robust code that endures.",
        microAction:
          "Identify an operational metric that could use an automated alerting threshold and implement it.",
        focusMantra: "Build for resilience.",
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
      {
        sparkReflection:
          "Sixty days of engineering craft. The difference between an ordinary engineer and a principal architect is deliberate focus on compounding leverage.",
        microAction:
          "Share a concise architectural insight or design pattern with a junior colleague.",
        focusMantra: "Multiply the team.",
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
      {
        sparkReflection:
          "Century of staff-level discipline. You have engineered a life and routine that operates with near-zero friction and maximum throughput.",
        microAction:
          "Document your core engineering heuristics into an enduring personal manifesto.",
        focusMantra: "Architect of compounding leverage.",
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
      {
        sparkReflection:
          "Your attitude is your signature. Bring enthusiasm, curiosity, and high energy into everything you touch this morning.",
        microAction:
          "Stand tall, smile broadly, and express heartfelt gratitude for this fresh, brand-new day.",
        focusMantra: "Spark vibrant energy.",
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
      {
        sparkReflection:
          "Three days of radiant positivity! Consistency is the soil in which your biggest dreams blossom into reality.",
        microAction:
          "Play an uplifting instrumental song that charges you with motivation and joy.",
        focusMantra: "Vibrant momentum.",
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
      {
        sparkReflection:
          "Seven mornings of unstoppable sunshine. When you choose optimism, doors swing open and solutions appear.",
        microAction:
          "Celebrate your 7-day milestone by treating yourself to your favorite morning fruit or drink.",
        focusMantra: "Celebrate every win.",
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
      {
        sparkReflection:
          "Fourteen days of genuine optimism. You don't just react to the weather; you bring your own sunshine wherever you go.",
        microAction:
          "Reframe a challenge you've been dreading into an exciting opportunity to showcase your creativity.",
        focusMantra: "Bring the sunshine.",
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
      {
        sparkReflection:
          "A full month of radiant momentum. Your optimistic spirit is not a facade—it is an unshakable reservoir of resilience and joy.",
        microAction: "List 5 unexpected blessings that arrived over your past 30 mornings.",
        focusMantra: "Abundance in all moments.",
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
      {
        sparkReflection:
          "Sixty mornings of contagious joy! You inspire everyone around you simply by being an unwavering beacon of optimism.",
        microAction: "Make someone laugh or smile unexpectedly during your morning conversations.",
        focusMantra: "Beacon of joy.",
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
      {
        sparkReflection:
          "Century of radiant light! You have demonstrated that a joyful, grateful, and determined heart can conquer any mountain.",
        microAction:
          "Write a letter of gratitude to yourself for honoring your potential for 100 consecutive mornings.",
        focusMantra: "Eternal fountain of joy.",
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
