// helper/calendarFeedGenerator.js
const { generateActionToken } = require("./unsubscribeToken");

/**
 * Escape text for iCalendar RFC 5545 (commas, semicolons, backslashes, newlines)
 */
function escapeIcsText(str) {
  if (!str) return "";
  return String(str)
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\r\n|\n|\r/g, "\\n");
}

/**
 * Format date to iCalendar UTC timestamp format (YYYYMMDDTHHMMSSZ)
 */
function toIcsTimestamp(date = new Date()) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

/**
 * Parse cron pattern into hour and minute
 * e.g. "30 6 * * *" => { hour: 6, minute: 30 }
 */
function parseCronTime(cronPattern = "0 7 * * *") {
  const parts = String(cronPattern).trim().split(/\s+/);
  const minute = parseInt(parts[0], 10);
  const hour = parseInt(parts[1], 10);
  return {
    minute: Number.isFinite(minute) ? minute : 0,
    hour: Number.isFinite(hour) ? hour : 7,
  };
}

/**
 * Generate RFC 5545 iCalendar feed content
 * @param {Object} user - User record with email, routineTrack, timezone, cronPattern, customHabits
 * @param {string} [appBaseUrl="https://morningroutine.io"]
 * @returns {string} .ics format string
 */
function generateIcsCalendar(user, appBaseUrl = "https://morningroutine.io") {
  const email = user.email || "subscriber@morningroutine.io";
  const trackName = (user.routineTrack || user.templateType || "deep-work")
    .replace(/-/g, " ")
    .toUpperCase();
  const timezone = user.timezone || "UTC";
  const { hour, minute } = parseCronTime(user.cronPattern || "0 7 * * *");
  const durationMinutes = Number(user.focusDurationMinutes) || 25;

  const routineToken = generateActionToken(email, "routine");
  const checkinToken = generateActionToken(email, "checkin");

  const routineUrl = `${appBaseUrl}/routine?email=${encodeURIComponent(email)}&token=${routineToken}`;
  const checkinUrl = `${appBaseUrl}/checkin?email=${encodeURIComponent(email)}&token=${checkinToken}`;

  const habits =
    Array.isArray(user.customHabits) && user.customHabits.length > 0
      ? user.customHabits
      : [
          "Hydrate with 500ml water",
          "5 minutes intentional breathing",
          "Review One Big Thing",
          "25 minutes uninterrupted focus block",
        ];

  const habitBullets = habits.map((h, idx) => `${idx + 1}. [ ] ${h}`).join("\n");

  const description = [
    `🌅 MORNING ROUTINE: ${trackName}`,
    "",
    "📋 Today's Habit Checklist:",
    habitBullets,
    "",
    `⚡ Open Live Companion: ${routineUrl}`,
    `🔥 1-Click Streak Check-in: ${checkinUrl}`,
    "",
    "— Powered by Morning Routine Sender",
  ].join("\n");

  const dtStamp = toIcsTimestamp(new Date());

  // DTSTART format for local recurring: HHMMSS
  const pad = (n) => String(n).padStart(2, "0");
  const timeStr = `${pad(hour)}${pad(minute)}00`;

  // Start today in local context
  const today = new Date();
  const dateStr = `${today.getFullYear()}${pad(today.getMonth() + 1)}${pad(today.getDate())}`;

  // DTEND: calculate end time
  const endTotalMinutes = hour * 60 + minute + durationMinutes;
  const endHour = Math.floor(endTotalMinutes / 60) % 24;
  const endMinute = endTotalMinutes % 60;
  const endTimeStr = `${pad(endHour)}${pad(endMinute)}00`;

  const icsLines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Morning Routine Sender//Habit Calendar 2.0//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Morning Routine (${trackName})`,
    "X-WR-CALDESC:Daily morning rituals, mindset spark, and streak tracker.",
    `X-WR-TIMEZONE:${timezone}`,
    "BEGIN:VEVENT",
    `UID:routine-${Buffer.from(email).toString("base64").replace(/=/g, "")}@morningroutine.io`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${timezone}:${dateStr}T${timeStr}`,
    `DTEND;TZID=${timezone}:${dateStr}T${endTimeStr}`,
    "RRULE:FREQ=DAILY;INTERVAL=1",
    `SUMMARY:🌅 Morning Routine • ${trackName}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
    `URL:${routineUrl}`,
    "STATUS:CONFIRMED",
    "TRANSP:TRANSPARENT",
    "BEGIN:VALARM",
    "ACTION:DISPLAY",
    "DESCRIPTION:Time for your Morning Routine!",
    "TRIGGER:-PT5M",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ];

  return icsLines.join("\r\n") + "\r\n";
}

module.exports = {
  generateIcsCalendar,
  parseCronTime,
  escapeIcsText,
};
