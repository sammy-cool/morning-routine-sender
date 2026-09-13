// helper/notificationOrchestrator.js
// Smart Notification Orchestrator for Morning Routine Sender
// Handles intelligent throttling, escalation ladders, quiet hours, and tone adaptation.

/**
 * Default quiet hours (no notifications between these hours in subscriber's timezone).
 */
const DEFAULT_QUIET_HOURS = { start: 22, end: 5 }; // 10 PM to 5 AM

/**
 * Escalation ladder: ordered channels to try when the user hasn't responded.
 * Each step has a channel type and a delay (in minutes) before escalating.
 */
const DEFAULT_ESCALATION_LADDER = [
  { channel: "push", delayMinutes: 0 },
  { channel: "telegram", delayMinutes: 15 },
  { channel: "discord", delayMinutes: 30 },
  { channel: "email", delayMinutes: 60 },
];

/**
 * Notification tone templates based on coach persona.
 */
const NOTIFICATION_TONES = {
  "gentle-nudge": {
    title: "☀️ Good morning!",
    body: "Your morning ritual is waiting — take it one step at a time.",
    urgency: "low",
  },
  "drill-sergeant": {
    title: "⚡ WAKE UP! No Excuses!",
    body: "The clock is ticking. Get up and OWN your morning. NOW.",
    urgency: "high",
  },
  "marcus-aurelius": {
    title: "🏛️ The obstacle is the way.",
    body: '"At dawn, when you have trouble getting out of bed, tell yourself: I have to go to work — as a human being."',
    urgency: "normal",
  },
  "zen-master": {
    title: "🧘 Be present. Begin.",
    body: "Each morning is a fresh canvas. Breathe. Rise. Flow.",
    urgency: "low",
  },
  default: {
    title: "🌅 Morning Routine Time",
    body: "Your morning ritual is ready. Let's build momentum today!",
    urgency: "normal",
  },
};

/**
 * Checks if the current time falls within quiet hours for a given timezone.
 *
 * @param {string} timezone - IANA timezone string (e.g. "America/New_York")
 * @param {Object} [quietHours] - { start: number, end: number } in 24h format
 * @returns {boolean}
 */
function isQuietHours(timezone, quietHours = DEFAULT_QUIET_HOURS) {
  try {
    const now = new Date();
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone || "UTC",
      hour: "numeric",
      hour12: false,
    });
    const currentHour = parseInt(formatter.format(now), 10);
    const { start, end } = quietHours;

    if (start > end) {
      // Crosses midnight: e.g. 22 to 5
      return currentHour >= start || currentHour < end;
    }
    return currentHour >= start && currentHour < end;
  } catch (_e) {
    return false;
  }
}

/**
 * Selects the appropriate notification tone based on the subscriber's coach persona.
 *
 * @param {string} [coachPersona="default"]
 * @returns {Object} { title, body, urgency }
 */
function getNotificationTone(coachPersona = "default") {
  const persona = (coachPersona || "default").toLowerCase().trim();
  return NOTIFICATION_TONES[persona] || NOTIFICATION_TONES.default;
}

/**
 * Determines the escalation step for a subscriber based on elapsed time
 * since the scheduled routine time.
 *
 * @param {number} minutesSinceScheduled - Minutes elapsed since the subscriber's scheduled routine time
 * @param {Array} [ladder] - Custom escalation ladder array
 * @returns {Object|null} The escalation step to execute, or null if all steps exhausted
 */
function getEscalationStep(minutesSinceScheduled, ladder = DEFAULT_ESCALATION_LADDER) {
  const elapsed = Math.max(0, Number(minutesSinceScheduled) || 0);

  // Find the latest step whose delay has been reached
  let currentStep = null;
  for (const step of ladder) {
    if (elapsed >= step.delayMinutes) {
      currentStep = step;
    }
  }
  return currentStep;
}

/**
 * Determines whether a notification should be sent based on throttling rules.
 *
 * @param {Object} subscriber
 * @param {boolean} [subscriber.alreadyCheckedInToday=false]
 * @param {string} [subscriber.timezone="UTC"]
 * @param {Object} [subscriber.quietHours]
 * @param {string} [subscriber.coachPersona="default"]
 * @returns {Object} { shouldSend, reason, tone }
 */
function shouldSendNotification(subscriber = {}) {
  // Rule 1: Don't send if already checked in today
  if (subscriber.alreadyCheckedInToday) {
    return {
      shouldSend: false,
      reason: "Already checked in today",
      tone: null,
    };
  }

  // Rule 2: Don't send during quiet hours
  const tz = subscriber.timezone || "UTC";
  const quietHours = subscriber.quietHours || DEFAULT_QUIET_HOURS;
  if (isQuietHours(tz, quietHours)) {
    return {
      shouldSend: false,
      reason: "Quiet hours active",
      tone: null,
    };
  }

  // Rule 3: Don't send if subscriber is on vacation
  if (subscriber.vacationPausedUntil) {
    const pausedUntil = new Date(subscriber.vacationPausedUntil);
    if (pausedUntil > new Date()) {
      return {
        shouldSend: false,
        reason: "Subscriber on vacation pause",
        tone: null,
      };
    }
  }

  // Rule 4: Don't send if subscriber is inactive
  if (subscriber.isActive === false) {
    return {
      shouldSend: false,
      reason: "Subscriber is inactive",
      tone: null,
    };
  }

  const tone = getNotificationTone(subscriber.coachPersona);

  return {
    shouldSend: true,
    reason: "OK",
    tone,
  };
}

/**
 * Builds the full orchestration plan for a subscriber notification.
 *
 * @param {Object} subscriber
 * @param {number} [minutesSinceScheduled=0]
 * @returns {Object} { shouldSend, channel, tone, escalationStep, reason }
 */
function buildOrchestrationPlan(subscriber = {}, minutesSinceScheduled = 0) {
  const decision = shouldSendNotification(subscriber);

  if (!decision.shouldSend) {
    return {
      shouldSend: false,
      channel: null,
      tone: null,
      escalationStep: null,
      reason: decision.reason,
    };
  }

  const step = getEscalationStep(minutesSinceScheduled);

  return {
    shouldSend: true,
    channel: step ? step.channel : "push",
    tone: decision.tone,
    escalationStep: step,
    reason: "OK",
  };
}

module.exports = {
  DEFAULT_QUIET_HOURS,
  DEFAULT_ESCALATION_LADDER,
  NOTIFICATION_TONES,
  isQuietHours,
  getNotificationTone,
  getEscalationStep,
  shouldSendNotification,
  buildOrchestrationPlan,
};
