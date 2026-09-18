const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const emailTracker = require("../email-core/emailTracker");
const { validateSubscriberInput } = require("../helper/validateSubscriber");
const { generateStreakSvg, generateWeeklyReportCardSvg } = require("../helper/streakCardGenerator");
const { generateRadarChartSvg } = require("../helper/radarChartGenerator");

// GET /me
async function getMe(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    let systemAnnouncement = process.env.SYSTEM_ANNOUNCEMENT || null;
    try {
      const redis = require("../config/redisClient");
      const rAnnounce = await redis.get("system:broadcast:message");
      if (rAnnounce) systemAnnouncement = rAnnounce;
    } catch (_e) {
      /* Non-fatal redis broadcast lookup */
    }

    const { generateCalendarToken } = require("../helper/unsubscribeToken");
    const calendarToken = generateCalendarToken(subscriber.email);
    const domain = res.locals.apiBase || `${req.protocol}://${req.get("host")}`;
    const calendarFeedUrl = `${domain}/calendar/feed/${calendarToken}.ics`;
    const webcalUrl = calendarFeedUrl.replace(/^https?:\/\//i, "webcal://");

    res.json({
      ...subscriber,
      systemAnnouncement,
      calendarToken,
      calendarFeedUrl,
      webcalUrl,
    });
  } catch (error) {
    logger.error("Failed to load own subscriber record", { error: error.message });
    res.status(500).json({ error: "Failed to load your subscription" });
  }
}

// GET /me/history
async function getMyHistory(req, res) {
  try {
    const limit = Math.max(1, Math.min(Number(req.query.limit) || 20, 100));
    const history = await emailTracker.getHistory(req.subscriberEmail, limit);
    res.json({ history });
  } catch (error) {
    logger.error("Failed to load own send history", { error: error.message });
    res.status(500).json({ error: "Failed to load your history" });
  }
}

// GET /me/export-journal
async function exportJournal(req, res) {
  try {
    const journalService = require("../helper/journalService");
    const format = (req.query.format || "markdown").toLowerCase().trim();
    const todayStr = new Date().toISOString().split("T")[0];

    const entries = await journalService.getAllEntries(req.subscriberEmail);
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);

    if (format === "json") {
      res.setHeader("Content-Type", "application/json; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-journal-${todayStr}.json"`,
      );
      return res.json({
        subscriber: req.subscriberEmail,
        exportedAt: new Date().toISOString(),
        totalEntries: entries.length,
        entries,
      });
    }

    if (format === "csv") {
      const csv = journalService.generateCsvExport(entries);
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-journal-${todayStr}.csv"`,
      );
      return res.send(csv);
    }

    const md = journalService.generateMarkdownExport(req.subscriberEmail, entries, subscriber);

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="morning-routine-journal-${todayStr}.md"`,
    );
    res.send(md);
  } catch (error) {
    logger.error("Failed to export journal", { error: error.message });
    res.status(500).json({ error: "Failed to generate journal export" });
  }
}

// GET /api/me/export and GET /me/export
async function exportDisciplineData(req, res) {
  try {
    const email = (req.subscriberEmail || req.subscriber?.email || "").toLowerCase().trim();
    if (!email) {
      return res.status(401).json({ error: "Authentication required" });
    }

    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    const journalService = require("../helper/journalService");
    const entries = (await journalService.getAllEntries(subscriber.email)) || [];

    const format = (req.query.format || "json").toLowerCase().trim();
    const todayStr = new Date().toISOString().split("T")[0];

    const track = subscriber.routineTrack || subscriber.templateType || "deep-work";
    const streakCount = Number(subscriber.streakCount) || 0;
    const streakFreezes =
      subscriber.streakFreezes !== undefined && subscriber.streakFreezes !== null
        ? Number(subscriber.streakFreezes)
        : 2;
    const freezeHistory = Array.isArray(subscriber.freezeHistory) ? subscriber.freezeHistory : [];
    const customHabits = Array.isArray(subscriber.customHabits) ? subscriber.customHabits : [];

    if (format === "csv") {
      res.setHeader("Content-Type", "text/csv; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-routine-export-${todayStr}.csv"`,
      );

      const headers = [
        "Date",
        "Streak",
        "Verified Wakeup",
        "Priority Goal",
        "Mood",
        "Gratitude",
        "Reflection",
      ];

      const escapeCsv = (val) => {
        if (val === null || val === undefined) return '""';
        let str = String(val).replace(/"/g, '""');
        if (/^[=+\-@\t\r]/.test(str)) {
          str = `'${str}`;
        }
        return `"${str}"`;
      };

      const rows = entries.map((entry) => {
        const date = entry.entry_date || entry.date || "";
        const streak =
          entry.streak !== undefined && entry.streak !== null
            ? entry.streak
            : entry.streak_count !== undefined && entry.streak_count !== null
              ? entry.streak_count
              : entry.streakCount !== undefined && entry.streakCount !== null
                ? entry.streakCount
                : streakCount;

        let verifiedWakeup = true;
        if (entry.verified_wakeup !== undefined && entry.verified_wakeup !== null) {
          verifiedWakeup = entry.verified_wakeup;
        } else if (entry.verifiedWakeup !== undefined && entry.verifiedWakeup !== null) {
          verifiedWakeup = entry.verifiedWakeup;
        }

        const priorityGoal =
          entry.priority_goal ||
          entry.priorityGoal ||
          entry.one_big_thing ||
          entry.oneBigThing ||
          "";
        const mood =
          entry.mood_score !== undefined && entry.mood_score !== null
            ? entry.mood_score
            : entry.mood !== undefined && entry.mood !== null
              ? entry.mood
              : "";
        const gratitude = entry.gratitude || "";
        const reflection = entry.reflection_text || entry.reflectionText || entry.reflection || "";

        return [
          escapeCsv(date),
          escapeCsv(streak),
          escapeCsv(verifiedWakeup),
          escapeCsv(priorityGoal),
          escapeCsv(mood),
          escapeCsv(gratitude),
          escapeCsv(reflection),
        ];
      });

      const csvContent = [
        headers.map((h) => `"${h}"`).join(","),
        ...rows.map((r) => r.join(",")),
      ].join("\r\n");

      return res.send(csvContent);
    }

    if (format === "markdown" || format === "md") {
      res.setHeader("Content-Type", "text/markdown; charset=utf-8");
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-routine-export-${todayStr}.md"`,
      );

      // Notion & Obsidian compatible frontmatter
      let md = "---\n";
      md += `title: Morning Routine & Discipline Archive\n`;
      md += `subscriber: ${subscriber.email}\n`;
      md += `track: ${track}\n`;
      md += `streak_count: ${streakCount}\n`;
      md += `streak_freezes: ${streakFreezes}\n`;
      md += `total_entries: ${entries.length}\n`;
      md += `exported_at: ${new Date().toISOString()}\n`;
      if (customHabits.length > 0) {
        md += "custom_habits:\n";
        customHabits.forEach((h) => {
          md += `  - "${String(h).replace(/"/g, '\\"')}"\n`;
        });
      } else {
        md += "custom_habits: []\n";
      }
      md += "tags:\n";
      md += "  - discipline\n";
      md += "  - morning-routine\n";
      md += "  - habit-tracker\n";
      md += "---\n\n";

      md += `# 🌅 Morning Routine & Discipline Archive\n\n`;
      md += `> **Subscriber:** \`${subscriber.email}\` • **Track:** \`${track}\` • **Current Streak:** 🔥 **${streakCount} Days** • **Shield Freezes:** 🛡️ **${streakFreezes} Available**\n\n`;

      if (customHabits.length > 0) {
        md += `## 🎯 Custom Habits\n`;
        customHabits.forEach((h) => {
          md += `- [ ] ${h}\n`;
        });
        md += `\n`;
      }

      md += `## 📅 Daily Discipline Logs\n\n`;

      if (!entries || entries.length === 0) {
        md += `*No discipline logs recorded yet. Begin your morning routine ritual to build your daily archive!*\n`;
      } else {
        const moodEmojis = {
          1: "😫 Challenging (1/5)",
          2: "😕 Low Energy (2/5)",
          3: "😐 Steady / Balanced (3/5)",
          4: "🙂 Energized & Focused (4/5)",
          5: "⚡ Peak Flow & Momentum (5/5)",
        };

        entries.forEach((entry, idx) => {
          const entryNum = entries.length - idx;
          const date = entry.entry_date || entry.date || "Unknown Date";
          const streak =
            entry.streak !== undefined && entry.streak !== null
              ? entry.streak
              : entry.streak_count !== undefined && entry.streak_count !== null
                ? entry.streak_count
                : entry.streakCount !== undefined && entry.streakCount !== null
                  ? entry.streakCount
                  : streakCount;

          let verified = "Yes";
          if (typeof entry.verified_wakeup === "boolean") {
            verified = entry.verified_wakeup ? "Yes" : "No";
          } else if (entry.verified_wakeup !== undefined && entry.verified_wakeup !== null) {
            verified = String(entry.verified_wakeup);
          } else if (typeof entry.verifiedWakeup === "boolean") {
            verified = entry.verifiedWakeup ? "Yes" : "No";
          } else if (entry.verifiedWakeup !== undefined && entry.verifiedWakeup !== null) {
            verified = String(entry.verifiedWakeup);
          }

          const priorityGoal =
            entry.priority_goal ||
            entry.priorityGoal ||
            entry.one_big_thing ||
            entry.oneBigThing ||
            null;
          const mood =
            entry.mood_score !== undefined && entry.mood_score !== null
              ? entry.mood_score
              : entry.mood !== undefined && entry.mood !== null
                ? entry.mood
                : null;
          const gratitude = entry.gratitude || null;
          const reflection =
            entry.reflection_text || entry.reflectionText || entry.reflection || null;

          md += `### #${entryNum} • 📅 ${date}\n`;
          md += `- **Streak:** 🔥 ${streak} Days\n`;
          md += `- **Verified Wakeup:** ☀️ ${verified}\n`;
          if (mood) {
            const moodLabel = moodEmojis[mood] || `${mood}/5`;
            md += `- **Mood:** ${moodLabel}\n`;
          }
          if (priorityGoal) {
            md += `- **Priority Goal:** ${priorityGoal.trim()}\n`;
          }
          if (gratitude) {
            md += `- **Gratitude:** ${gratitude.trim()}\n`;
          }
          if (reflection) {
            md += `- **Reflection:** ${reflection.trim()}\n`;
          }
          md += `\n---\n\n`;
        });
      }

      return res.send(md);
    }

    // Default: JSON format
    res.setHeader("Content-Type", "application/json; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="morning-routine-export-${todayStr}.json"`,
    );

    return res.json({
      success: true,
      subscriber: subscriber.email,
      profile: {
        email: subscriber.email,
        name: subscriber.name || null,
        timezone: subscriber.timezone || "UTC",
        cronPattern: subscriber.cronPattern,
        isActive: subscriber.isActive,
        coachPersona: subscriber.coachPersona,
      },
      track,
      streakCount,
      streakFreezes,
      freezeHistory,
      customHabits,
      totalEntries: entries.length,
      exportedAt: new Date().toISOString(),
      entries,
    });
  } catch (error) {
    logger.error("Failed to export discipline data", { error: error.message });
    res.status(500).json({ error: "Failed to generate discipline data export" });
  }
}

function formatIcsDateTime(date) {
  return date.toISOString().replace(/[-:]/g, "").split(".")[0] + "Z";
}

function generateCalendarIcs(subscriber, domain = "https://morningroutinesender.com") {
  const trackKey = subscriber.routineTrack || "deep-work";
  const track = sharedData.getTrackContent(trackKey);
  const trackName = track?.name || "Deep Work & Builder";
  const ritual = track?.ritual || "Focus Sprint & Daily Planning";
  const checklist = (track?.checklist || ["Hydrate (500ml)", "Focus Sprint"]).join("\\n- ");
  const timezone = subscriber.timezone || "UTC";
  const email = subscriber.email;
  const { generateActionToken } = require("../helper/unsubscribeToken");
  const token = generateActionToken(email, "routine");
  const routineUrl = `${domain}/routine?email=${encodeURIComponent(email)}&token=${encodeURIComponent(token)}`;

  const [prefHour, prefMinute] = (subscriber.preferredTime || "07:00").split(":").map(Number);
  const hour = isNaN(prefHour) ? 7 : prefHour;
  const minute = isNaN(prefMinute) ? 0 : prefMinute;
  const durationMinutes = Number(subscriber.focusDurationMinutes) || 25;

  const now = new Date();
  const dtStamp = formatIcsDateTime(now);

  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, "0");
  const d = String(now.getDate()).padStart(2, "0");
  const hh = String(hour).padStart(2, "0");
  const mm = String(minute).padStart(2, "0");

  const endTotalMinutes = hour * 60 + minute + durationMinutes;
  const endHour = String(Math.floor(endTotalMinutes / 60) % 24).padStart(2, "0");
  const endMinute = String(endTotalMinutes % 60).padStart(2, "0");

  const dtStart = `${y}${m}${d}T${hh}${mm}00`;
  const dtEnd = `${y}${m}${d}T${endHour}${endMinute}00`;
  const uid = `mrn-routine-${Buffer.from(email).toString("hex").slice(0, 16)}@morningroutinesender.com`;

  return [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Morning Routine Sender//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:Morning Routine • ${trackName}`,
    `X-WR-TIMEZONE:${timezone}`,
    "X-WR-CALDESC:Daily morning routine focus rituals and habit streaks",
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${dtStamp}`,
    `DTSTART;TZID=${timezone}:${dtStart}`,
    `DTEND;TZID=${timezone}:${dtEnd}`,
    "RRULE:FREQ=DAILY",
    `SUMMARY:⚡ Morning Routine: ${trackName}`,
    `DESCRIPTION:Today's Ritual: ${ritual}\\n\\nChecklist:\\n- ${checklist}\\n\\nOpen Live Companion & Timer:\\n${routineUrl}`,
    `URL:${routineUrl}`,
    "STATUS:CONFIRMED",
    "TRANSP:OPAQUE",
    "BEGIN:VALARM",
    "TRIGGER:-PT10M",
    "ACTION:DISPLAY",
    "DESCRIPTION:Morning Routine starting in 10 minutes",
    "END:VALARM",
    "END:VEVENT",
    "END:VCALENDAR",
  ].join("\r\n");
}

// GET /me/calendar.ics
async function exportCalendar(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    const domain = res.locals.apiBase || `${req.protocol}://${req.get("host")}`;
    const icsContent = generateCalendarIcs(subscriber, domain);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="morning-routine.ics"');
    res.setHeader("Cache-Control", "public, max-age=3600");
    return res.send(icsContent);
  } catch (err) {
    logger.error("Failed to export calendar", { error: err.message });
    return res.status(500).json({ error: "Failed to generate calendar feed" });
  }
}

// GET /calendar/feed/:token.ics & GET /calendar/feed/:token
async function getCalendarFeedByToken(req, res) {
  try {
    const tokenParam = (req.params.token || "").replace(/\.ics$/, "");
    const { verifyCalendarToken } = require("../helper/unsubscribeToken");
    const verifiedEmail = verifyCalendarToken(tokenParam);

    let subscriber = null;
    if (verifiedEmail) {
      subscriber = await sharedData.getUserByEmail(verifiedEmail);
    } else {
      const redis = require("../config/redisClient");
      const sessionEmail = await redis.get(`subscriber_session:${tokenParam}`).catch(() => null);
      if (sessionEmail) {
        subscriber = await sharedData.getUserByEmail(sessionEmail);
      }
    }

    if (!subscriber) {
      return res.status(401).send("Invalid or expired calendar feed token");
    }

    const domain = res.locals.apiBase || `${req.protocol}://${req.get("host")}`;
    const icsContent = generateCalendarIcs(subscriber, domain);

    res.setHeader("Content-Type", "text/calendar; charset=utf-8");
    res.setHeader("Content-Disposition", 'inline; filename="morning-routine.ics"');
    res.setHeader("Cache-Control", "public, max-age=1800");
    return res.send(icsContent);
  } catch (err) {
    logger.error("Failed to serve calendar feed", { error: err.message });
    return res.status(500).send("Failed to serve calendar feed");
  }
}

// GET /api/streak-card.svg & GET /api/streak-card/:email/card.svg
async function getStreakCard(req, res) {
  try {
    const rawEmail = req.params?.email || req.query?.email || req.subscriberEmail;
    let subscriber = null;
    if (rawEmail) {
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (cleanEmail.includes("@")) {
        subscriber = await sharedData.getUserByEmail(cleanEmail);
      } else {
        const db = require("../db/knex");
        const row = await db("subscribers")
          .where("email", cleanEmail)
          .orWhere("email", "like", `${cleanEmail}@%`)
          .first();
        if (row) {
          subscriber = {
            ...row,
            streakCount: Number(row.streak_count) || 0,
            routineTrack: row.routine_track || row.template_type || "deep-work",
          };
        }
      }
    }
    const streak = subscriber ? subscriber.streakCount : Number(req.query.streak) || 1;
    const track = subscriber
      ? subscriber.routineTrack || subscriber.templateType
      : req.query.track || "deep-work";

    const officialDomain =
      req.app?.locals?.officialDomain ||
      process.env.RENDER_URL ||
      "https://morning-routine-sender.onrender.com";

    const name = subscriber?.email
      ? subscriber.email.split("@")[0]
      : rawEmail
        ? rawEmail.split("@")[0]
        : req.query.name || "Morning Builder";

    const svg = generateStreakSvg({
      name,
      streak,
      track,
      verifyUrl: `${officialDomain}/routine`,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    );
    res.send(svg);
  } catch (error) {
    logger.error("Failed to generate streak card SVG", { error: error.message });
    res
      .status(500)
      .send(
        '<svg width="800" height="450" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="450" fill="#07090e"/><text x="400" y="225" fill="#f43f5e" text-anchor="middle" font-family="sans-serif">Error generating streak card</text></svg>',
      );
  }
}

// GET /me/streak-card (authenticated)
async function getMyStreakCard(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    const streak = subscriber.streakCount ?? 1;
    const track = subscriber.routineTrack || subscriber.templateType || "deep-work";
    const name = subscriber.email.split("@")[0];
    const officialDomain =
      req.app?.locals?.officialDomain ||
      process.env.RENDER_URL ||
      "https://morning-routine-sender.onrender.com";

    const svg = generateStreakSvg({
      name,
      streak,
      track,
      verifyUrl: `${officialDomain}/routine`,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    if (req.query.download === "true" || req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="morning-routine-streak-${streak}-days.svg"`,
      );
    }
    return res.send(svg);
  } catch (error) {
    logger.error("Failed to fetch authenticated streak card", { error: error.message });
    res.status(500).json({ error: "Failed to generate your streak card" });
  }
}

// GET /api/weekly-report.svg & GET /api/weekly-report/:email/card.svg & GET /me/weekly-report.svg
async function getWeeklyReportCard(req, res) {
  try {
    const rawEmail = req.params?.email || req.query?.email || req.subscriberEmail;
    let subscriber = null;
    if (rawEmail) {
      const cleanEmail = rawEmail.trim().toLowerCase();
      if (cleanEmail.includes("@")) {
        subscriber = await sharedData.getUserByEmail(cleanEmail);
      } else {
        const db = require("../db/knex");
        const row = await db("subscribers")
          .where("email", cleanEmail)
          .orWhere("email", "like", `${cleanEmail}@%`)
          .first();
        if (row) {
          subscriber = {
            ...row,
            streakCount: Number(row.streak_count) || 0,
            routineTrack: row.routine_track || row.template_type || "deep-work",
          };
        }
      }
    }

    const streak = subscriber ? (subscriber.streakCount ?? 1) : Number(req.query.streak) || 7;
    const track = subscriber
      ? subscriber.routineTrack || subscriber.templateType || "deep-work"
      : req.query.track || "deep-work";

    const officialDomain =
      req.app?.locals?.officialDomain ||
      process.env.RENDER_URL ||
      "https://morning-routine-sender.onrender.com";

    const name = subscriber?.email
      ? subscriber.email.split("@")[0]
      : rawEmail
        ? rawEmail.split("@")[0]
        : req.query.name || "Morning Builder";

    let activeDays = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
    let dayStatuses = [true, true, true, true, true, true, true];
    let completionRate = "100%";
    let grade = "A+";
    let journalsLogged = 7;
    let focusMinutes = 175;

    if (subscriber && subscriber.email) {
      try {
        const {
          getSubscriberWeeklyMetrics,
          getPast7Dates,
        } = require("../helper/weeklyDigestService");
        const metrics = await getSubscriberWeeklyMetrics(
          subscriber.email,
          subscriber.timezone || "UTC",
        );
        if (metrics && Array.isArray(metrics.completionCalendar)) {
          const past7 = getPast7Dates(subscriber.timezone || "UTC");
          activeDays = past7.map((d) =>
            new Intl.DateTimeFormat("en-US", {
              timeZone: subscriber.timezone || "UTC",
              weekday: "short",
            }).format(d.fullDate),
          );
          dayStatuses = metrics.completionCalendar.map((c) => Boolean(c.completed));
          const rateNum = metrics.completionRate ?? 100;
          completionRate = `${rateNum}%`;
          if (rateNum === 100) grade = "A+";
          else if (rateNum >= 85) grade = "A";
          else if (rateNum >= 70) grade = "B";
          else if (rateNum >= 50) grade = "C";
          else grade = "D";

          const completedCount = metrics.completedDaysCount || 0;
          focusMinutes = completedCount * 25;
          journalsLogged = completedCount;
        }
      } catch (metricsErr) {
        logger.warn("Could not compute weekly metrics for report card", {
          error: metricsErr.message,
        });
      }
    } else {
      if (req.query.grade) grade = String(req.query.grade).toUpperCase();
      if (req.query.rate) completionRate = `${parseInt(req.query.rate, 10) || 100}%`;
    }

    const svg = generateWeeklyReportCardSvg({
      name,
      streak,
      track,
      grade,
      completionRate,
      activeDays,
      dayStatuses,
      focusMinutes,
      journalsLogged,
      verifyUrl: `${officialDomain}/routine`,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    );
    if (req.query.download === "true" || req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="weekly-habit-report-${name}.svg"`,
      );
    }
    return res.send(svg);
  } catch (error) {
    logger.error("Failed to generate weekly report card SVG", { error: error.message });
    return res
      .status(500)
      .send(
        '<svg width="1200" height="630" xmlns="http://www.w3.org/2000/svg"><rect width="1200" height="630" fill="#07090e"/><text x="600" y="315" fill="#f43f5e" text-anchor="middle" font-family="sans-serif" font-size="24">Error generating weekly report card</text></svg>',
      );
  }
}

// GET /me/weekly-report & GET /me/weekly-report.svg (authenticated)
async function getMyWeeklyReportCard(req, res) {
  return getWeeklyReportCard(req, res);
}

// GET /api/me/radar.svg & GET /radar/:token.svg & GET /radar/:email/radar.svg
async function getRadarChart(req, res) {
  try {
    const rawIdentifier =
      req.params?.token ||
      req.params?.email ||
      req.query?.token ||
      req.query?.email ||
      req.subscriberEmail;

    let subscriber = null;
    let subscriberEmail = null;

    if (req.subscriberEmail) {
      subscriberEmail = req.subscriberEmail;
    } else if (rawIdentifier) {
      const cleanId = String(rawIdentifier)
        .trim()
        .replace(/\.svg$/, "");

      // 1. Direct email match
      if (cleanId.includes("@")) {
        subscriberEmail = cleanId.toLowerCase();
      } else {
        // 2. Token resolution (action token, calendar token, or Redis session)
        const { verifyCalendarToken } = require("../helper/unsubscribeToken");
        const calEmail = verifyCalendarToken(cleanId);
        if (calEmail) {
          subscriberEmail = calEmail;
        } else {
          try {
            const redis = require("../config/redisClient");
            const sessionEmail = await redis.get(`subscriber_session:${cleanId}`).catch(() => null);
            if (sessionEmail) {
              subscriberEmail = sessionEmail;
            }
          } catch (_e) {
            // Redis fallback
          }
        }
      }

      // 3. Knex lookup by email prefix / handle
      if (!subscriberEmail && cleanId) {
        try {
          const db = require("../db/knex");
          const row = await db("subscribers")
            .where("email", cleanId)
            .orWhere("email", "like", `${cleanId}@%`)
            .first();
          if (row) {
            subscriber = {
              ...row,
              streakCount: Number(row.streak_count) || 0,
              routineTrack: row.routine_track || row.template_type || "deep-work",
            };
            subscriberEmail = row.email;
          }
        } catch (_dbErr) {
          // Knex error fallback
        }
      }
    }

    if (subscriberEmail && !subscriber) {
      try {
        subscriber = await sharedData.getUserByEmail(subscriberEmail);
      } catch (_e) {
        // Shared-data lookup fallback
      }
    }

    const streakCount = subscriber ? (subscriber.streakCount ?? 1) : Number(req.query.streak) || 7;
    const trackName = subscriber
      ? subscriber.routineTrack || subscriber.templateType || "deep-work"
      : req.query.track || "deep-work";

    const subscriberName = subscriber?.email
      ? subscriber.email.split("@")[0]
      : subscriberEmail
        ? subscriberEmail.split("@")[0]
        : req.query.name || "Morning Builder";

    // Journal entries count for reflection depth estimation
    let journalCount = 0;
    if (subscriberEmail) {
      try {
        const db = require("../db/knex");
        const [{ count }] = await db("journal_entries")
          .where("subscriber_email", subscriberEmail.toLowerCase().trim())
          .count("* as count");
        journalCount = Number(count) || 0;
      } catch (_e) {
        journalCount = Math.min(streakCount, 14);
      }
    } else {
      journalCount = Number(req.query.journals) || Math.min(streakCount, 14);
    }

    const track = String(trackName).toLowerCase();

    // 1. Rise Time Precision (0-100)
    let riseTimeScore = 72;
    if (streakCount >= 30) riseTimeScore = 96;
    else if (streakCount >= 14) riseTimeScore = 90;
    else if (streakCount >= 7) riseTimeScore = 84;
    else if (streakCount >= 3) riseTimeScore = 78;
    if (track === "classic" || track === "executive") {
      riseTimeScore = Math.min(100, riseTimeScore + 4);
    }

    // 2. Physical Grounding (0-100)
    let physicalScore = 75;
    if (track === "mindfulness" || track === "classic") physicalScore = 92;
    else if (track === "executive") physicalScore = 88;
    else if (track === "deep-work") physicalScore = 80;
    if (streakCount >= 7) physicalScore = Math.min(100, physicalScore + 6);

    // 3. Deep Work Sprint (0-100)
    let deepWorkScore = 80;
    if (track === "deep-work") deepWorkScore = 95;
    else if (track === "learning") deepWorkScore = 92;
    else if (track === "executive") deepWorkScore = 90;
    if (streakCount >= 14) deepWorkScore = Math.min(100, deepWorkScore + 8);

    // 4. Reflection Depth (0-100)
    let reflectionScore = 65;
    if (journalCount >= 20) reflectionScore = 96;
    else if (journalCount >= 10) reflectionScore = 90;
    else if (journalCount >= 5) reflectionScore = 84;
    else if (journalCount >= 1) reflectionScore = 76;
    if (track === "mindfulness") reflectionScore = Math.min(100, reflectionScore + 6);

    // 5. Streak Grit (0-100)
    let gritScore = 65;
    if (streakCount >= 60) gritScore = 99;
    else if (streakCount >= 30) gritScore = 95;
    else if (streakCount >= 14) gritScore = 88;
    else if (streakCount >= 7) gritScore = 82;
    else if (streakCount >= 3) gritScore = 74;

    const scores = {
      riseTime: req.query.riseTime !== undefined ? Number(req.query.riseTime) : riseTimeScore,
      physical: req.query.physical !== undefined ? Number(req.query.physical) : physicalScore,
      deepWork: req.query.deepWork !== undefined ? Number(req.query.deepWork) : deepWorkScore,
      reflection:
        req.query.reflection !== undefined ? Number(req.query.reflection) : reflectionScore,
      grit: req.query.grit !== undefined ? Number(req.query.grit) : gritScore,
    };

    const grade = req.query.grade ? String(req.query.grade).toUpperCase() : null;

    const svg = generateRadarChartSvg({
      subscriberName,
      trackName,
      streakCount,
      scores,
      grade,
    });

    res.setHeader("Content-Type", "image/svg+xml; charset=utf-8");
    res.setHeader(
      "Cache-Control",
      "public, max-age=1800, s-maxage=3600, stale-while-revalidate=86400",
    );
    if (req.query.download === "true" || req.query.download === "1") {
      res.setHeader(
        "Content-Disposition",
        `attachment; filename="consistency-radar-${subscriberName.replace(/[^a-zA-Z0-9_-]/g, "")}.svg"`,
      );
    }
    return res.send(svg);
  } catch (error) {
    logger.error("Failed to generate radar chart SVG", { error: error.message });
    return res
      .status(500)
      .send(
        '<svg width="800" height="800" xmlns="http://www.w3.org/2000/svg"><rect width="800" height="800" fill="#06080e"/><text x="400" y="400" fill="#f43f5e" text-anchor="middle" font-family="sans-serif" font-size="20">Error generating radar chart</text></svg>',
      );
  }
}

// GET /api/coach-personas
async function getCoachPersonas(_req, res) {
  try {
    const { COACH_PERSONAS_METADATA } = require("../helper/curatedSparks");
    const personas = Object.values(COACH_PERSONAS_METADATA);
    res.json({
      success: true,
      defaultPersona: "stoic",
      personas,
    });
  } catch (error) {
    logger.error("Failed to list coach personas", { error: error.message });
    res.status(500).json({ error: "Failed to load coach personas metadata" });
  }
}

// POST /me/coach-persona { coachPersona, customCoachPrompt }
async function updateCoachPersona(req, res) {
  const { coachPersona, persona, customCoachPrompt } = req.body || {};
  const targetPersona = coachPersona || persona;

  if (!targetPersona || typeof targetPersona !== "string") {
    return res.status(400).json({
      error:
        "coachPersona field is required (e.g. 'stoic', 'relentless', 'zen', 'tech-lead', 'optimist', 'custom')",
    });
  }

  const normalized = targetPersona.toLowerCase().trim();
  const validPersonas = ["stoic", "relentless", "zen", "tech-lead", "optimist", "custom"];

  if (!validPersonas.includes(normalized)) {
    return res.status(400).json({
      error: `Invalid coach persona '${targetPersona}'. Valid options: ${validPersonas.join(", ")}`,
    });
  }

  if (customCoachPrompt !== undefined && customCoachPrompt !== null && customCoachPrompt !== "") {
    if (typeof customCoachPrompt !== "string" || customCoachPrompt.length > 500) {
      return res.status(400).json({
        error: "customCoachPrompt must be a string under 500 characters",
      });
    }
  }

  try {
    const { COACH_PERSONAS_METADATA } = require("../helper/curatedSparks");
    const patch = { coachPersona: normalized };
    if (customCoachPrompt !== undefined) {
      patch.customCoachPrompt = customCoachPrompt ? String(customCoachPrompt).trim() : null;
    }
    await sharedData.updateUser(req.subscriberEmail, patch);
    const updated = await sharedData.getUserByEmail(req.subscriberEmail);

    logger.info("Subscriber updated AI Coach Persona", {
      email: req.subscriberEmail,
      coachPersona: normalized,
    });

    res.json({
      success: true,
      message: `AI Coach Persona set to '${COACH_PERSONAS_METADATA[normalized]?.title || normalized}'`,
      coachPersona: normalized,
      customCoachPrompt: updated?.customCoachPrompt,
      subscriber: updated,
    });
  } catch (error) {
    logger.error("Failed to update coach persona", {
      error: error.message,
      email: req.subscriberEmail,
    });
    res.status(500).json({ error: "Failed to update AI coach persona" });
  }
}

// PATCH /me  { templateType?, routineTrack?, cronPattern?, timezone?, isActive?, focusDurationMinutes?, customHabits?, customQuote?, customRitual?, newsCategory?, customCoachPrompt?, weeklyDigestEnabled?, weeklyDigestDay? }
async function updateMe(req, res) {
  let {
    templateType,
    routineTrack,
    cronPattern,
    timezone,
    isActive,
    focusDurationMinutes,
    customHabits,
    customQuote,
    customRitual,
    newsCategory,
    customCoachPrompt,
    weeklyDigestEnabled,
    weeklyDigestDay,
    weekendRoutineTrack,
    weekendCronPattern,
    vacationUntil,
    vacationReason,
    emailDensity,
    locationCity,
    sendTime,
    weekendSendTime,
    optimalSendWindow,
    quietHours,
  } = req.body || {};

  const errors = [];

  if (sendTime !== undefined && sendTime !== null && sendTime !== "") {
    const timeMatch = String(sendTime)
      .trim()
      .match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!timeMatch) {
      errors.push("sendTime must be in HH:MM 24-hour format (e.g. '06:30')");
    } else if (cronPattern === undefined) {
      const min = parseInt(timeMatch[2], 10);
      const hour = parseInt(timeMatch[1], 10);
      cronPattern = `${min} ${hour} * * 1-5`;
    }
  }

  if (weekendSendTime !== undefined && weekendSendTime !== null && weekendSendTime !== "") {
    const wTimeMatch = String(weekendSendTime)
      .trim()
      .match(/^([01]\d|2[0-3]):([0-5]\d)$/);
    if (!wTimeMatch) {
      errors.push("weekendSendTime must be in HH:MM 24-hour format (e.g. '08:00')");
    } else if (weekendCronPattern === undefined) {
      const wMin = parseInt(wTimeMatch[2], 10);
      const wHour = parseInt(wTimeMatch[1], 10);
      weekendCronPattern = `${wMin} ${wHour} * * 0,6`;
    }
  }

  if (quietHours !== undefined && quietHours !== null) {
    if (
      typeof quietHours !== "object" ||
      typeof quietHours.start !== "number" ||
      typeof quietHours.end !== "number" ||
      quietHours.start < 0 ||
      quietHours.start > 23 ||
      quietHours.end < 0 ||
      quietHours.end > 23
    ) {
      errors.push("quietHours must be an object with start and end numbers between 0 and 23");
    }
  }

  if (
    weekendRoutineTrack !== undefined &&
    weekendRoutineTrack !== null &&
    weekendRoutineTrack !== ""
  ) {
    const validTracks = [
      "deep-work",
      "mindfulness",
      "executive",
      "learning",
      "classic",
      "career",
      "reflection",
    ];
    if (
      typeof weekendRoutineTrack !== "string" ||
      !validTracks.includes(weekendRoutineTrack.toLowerCase().trim())
    ) {
      errors.push(`weekendRoutineTrack must be one of: ${validTracks.join(", ")}`);
    }
  }

  if (
    weekendCronPattern !== undefined &&
    weekendCronPattern !== null &&
    weekendCronPattern !== ""
  ) {
    const cron = require("node-cron");
    if (typeof weekendCronPattern !== "string" || !cron.validate(weekendCronPattern.trim())) {
      errors.push("Invalid weekendCronPattern format");
    }
  }

  if (emailDensity !== undefined && emailDensity !== null && emailDensity !== "") {
    const validDensities = ["bite", "standard", "deep"];
    if (
      typeof emailDensity !== "string" ||
      !validDensities.includes(emailDensity.toLowerCase().trim())
    ) {
      errors.push(`emailDensity must be one of: ${validDensities.join(", ")}`);
    }
  }

  if (locationCity !== undefined && locationCity !== null) {
    if (typeof locationCity !== "string" || locationCity.length > 100) {
      errors.push("locationCity must be a string under 100 characters");
    }
  }

  if (vacationUntil !== undefined && vacationUntil !== null && vacationUntil !== "") {
    const d = new Date(vacationUntil);
    if (isNaN(d.getTime())) {
      errors.push("vacationUntil must be a valid date or null");
    }
  }

  if (
    templateType === undefined &&
    routineTrack === undefined &&
    cronPattern === undefined &&
    timezone === undefined &&
    isActive === undefined &&
    focusDurationMinutes === undefined &&
    customHabits === undefined &&
    customQuote === undefined &&
    customRitual === undefined &&
    newsCategory === undefined &&
    customCoachPrompt === undefined &&
    weeklyDigestEnabled === undefined &&
    weeklyDigestDay === undefined &&
    weekendRoutineTrack === undefined &&
    weekendCronPattern === undefined &&
    vacationUntil === undefined &&
    vacationReason === undefined &&
    emailDensity === undefined &&
    locationCity === undefined &&
    sendTime === undefined &&
    weekendSendTime === undefined &&
    optimalSendWindow === undefined &&
    quietHours === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const inputErrors = validateSubscriberInput(
    { templateType, routineTrack, cronPattern, timezone },
    { requireEmail: false },
  );
  errors.push(...inputErrors);

  if (focusDurationMinutes !== undefined) {
    const parsedMins = Number(focusDurationMinutes);
    if (!Number.isInteger(parsedMins) || parsedMins < 5 || parsedMins > 180) {
      errors.push("focusDurationMinutes must be an integer between 5 and 180");
    }
  }

  if (customHabits !== undefined) {
    if (!Array.isArray(customHabits)) {
      errors.push("customHabits must be an array of habit strings");
    } else if (customHabits.length > 10) {
      errors.push("customHabits cannot exceed 10 habit items");
    } else {
      for (const h of customHabits) {
        if (typeof h !== "string" || !h.trim() || h.trim().length > 100) {
          errors.push("Each custom habit must be a non-empty string under 100 characters");
          break;
        }
      }
    }
  }

  if (customQuote !== undefined && customQuote !== null && customQuote !== "") {
    if (typeof customQuote !== "string" || customQuote.length > 300) {
      errors.push("customQuote must be a string under 300 characters");
    }
  }

  if (customRitual !== undefined && customRitual !== null && customRitual !== "") {
    if (typeof customRitual !== "string" || customRitual.length > 300) {
      errors.push("customRitual must be a string under 300 characters");
    }
  }

  if (newsCategory !== undefined) {
    const validNews = ["all", "tech", "ai", "finance", "science", "wellness", "off"];
    if (
      typeof newsCategory !== "string" ||
      !validNews.includes(newsCategory.toLowerCase().trim())
    ) {
      errors.push(`newsCategory must be one of: ${validNews.join(", ")}`);
    }
  }

  if (customCoachPrompt !== undefined && customCoachPrompt !== null && customCoachPrompt !== "") {
    if (typeof customCoachPrompt !== "string" || customCoachPrompt.length > 500) {
      errors.push("customCoachPrompt must be a string under 500 characters");
    }
  }

  if (weeklyDigestEnabled !== undefined && typeof weeklyDigestEnabled !== "boolean") {
    errors.push("weeklyDigestEnabled must be a boolean");
  }

  if (weeklyDigestDay !== undefined) {
    const validDays = ["sunday", "monday", "friday"];
    if (
      typeof weeklyDigestDay !== "string" ||
      !validDays.includes(weeklyDigestDay.toLowerCase().trim())
    ) {
      errors.push(`weeklyDigestDay must be one of: ${validDays.join(", ")}`);
    }
  }

  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const updates = {};
    if (templateType !== undefined) updates.templateType = templateType;
    if (routineTrack !== undefined) updates.routineTrack = routineTrack;
    if (cronPattern !== undefined) updates.cronPattern = cronPattern;
    if (timezone !== undefined) updates.timezone = timezone;
    if (focusDurationMinutes !== undefined) {
      updates.focusDurationMinutes = Number(focusDurationMinutes);
    }
    if (customHabits !== undefined) {
      updates.customHabits = customHabits.map((h) => String(h).trim()).filter(Boolean);
    }
    if (customQuote !== undefined) {
      updates.customQuote = customQuote ? String(customQuote).trim() : null;
    }
    if (customRitual !== undefined) {
      updates.customRitual = customRitual ? String(customRitual).trim() : null;
    }
    if (newsCategory !== undefined) {
      updates.newsCategory = newsCategory.toLowerCase().trim();
    }
    if (customCoachPrompt !== undefined) {
      updates.customCoachPrompt = customCoachPrompt ? String(customCoachPrompt).trim() : null;
    }
    if (weeklyDigestEnabled !== undefined) {
      updates.weeklyDigestEnabled = Boolean(weeklyDigestEnabled);
    }
    if (weeklyDigestDay !== undefined) {
      updates.weeklyDigestDay = weeklyDigestDay.toLowerCase().trim();
    }
    if (weekendRoutineTrack !== undefined) {
      updates.weekendRoutineTrack = weekendRoutineTrack
        ? weekendRoutineTrack.toLowerCase().trim()
        : null;
    }
    if (weekendCronPattern !== undefined) {
      updates.weekendCronPattern = weekendCronPattern ? weekendCronPattern.trim() : null;
    }
    if (emailDensity !== undefined) {
      updates.emailDensity = emailDensity.toLowerCase().trim();
    }
    if (locationCity !== undefined) {
      updates.locationCity = locationCity ? locationCity.trim() : null;
    }
    if (vacationUntil !== undefined) {
      updates.vacationUntil = vacationUntil ? new Date(vacationUntil).toISOString() : null;
    }
    if (vacationReason !== undefined) {
      updates.vacationReason = vacationReason ? String(vacationReason).trim() : null;
    }
    if (sendTime !== undefined) {
      updates.sendTime = sendTime ? String(sendTime).trim() : null;
      if (cronPattern !== undefined && !updates.cronPattern) updates.cronPattern = cronPattern;
    }
    if (weekendSendTime !== undefined) {
      updates.weekendSendTime = weekendSendTime ? String(weekendSendTime).trim() : null;
      if (weekendCronPattern !== undefined && !updates.weekendCronPattern) {
        updates.weekendCronPattern = weekendCronPattern;
      }
    }
    if (optimalSendWindow !== undefined) {
      updates.optimalSendWindow = Boolean(optimalSendWindow);
    }
    if (quietHours !== undefined) {
      updates.quietHours = quietHours;
    }

    if (Object.keys(updates).length > 0) {
      await sharedData.updateUser(req.subscriberEmail, updates);
    }
    if (isActive !== undefined) {
      await sharedData.setUserActive(req.subscriberEmail, Boolean(isActive));
    }

    // Dynamic Hot-Reload: Reschedule user cron job if schedule, timezone, or active status changed
    if (
      cronPattern !== undefined ||
      timezone !== undefined ||
      isActive !== undefined ||
      templateType !== undefined ||
      routineTrack !== undefined ||
      weekendRoutineTrack !== undefined ||
      weekendCronPattern !== undefined ||
      vacationUntil !== undefined
    ) {
      try {
        const emailScheduler = require("../email-core/emailScheduler");
        if (typeof emailScheduler.rescheduleUserJob === "function") {
          await emailScheduler.rescheduleUserJob(req.subscriberEmail);
        }
      } catch (schedErr) {
        logger.warn("Non-fatal failure rescheduling user cron job in updateMe", {
          email: req.subscriberEmail,
          error: schedErr.message,
        });
      }
    }

    const updated = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!updated) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    logger.info("Subscriber updated their own preferences", {
      email: req.subscriberEmail,
    });
    res.json(updated);
  } catch (error) {
    logger.error("Failed to update own subscriber record", {
      error: error.message,
    });
    res.status(500).json({ error: "Failed to update your subscription" });
  }
}

// POST /me/channels { discordWebhookUrl?, telegramChatId?, channelsEnabled? }
async function updateChannels(req, res) {
  const { discordWebhookUrl, telegramChatId, channelsEnabled } = req.body || {};

  try {
    if (discordWebhookUrl !== undefined && discordWebhookUrl !== "" && discordWebhookUrl !== null) {
      const isDiscordUrl =
        typeof discordWebhookUrl === "string" &&
        /^https:\/\/(?:ptb\.|canary\.)?discord(?:app)?\.com\/api\/webhooks\/\d+\/[A-Za-z0-9_-]+$/.test(
          discordWebhookUrl.trim(),
        );
      if (!isDiscordUrl) {
        return res.status(400).json({
          error: "Invalid Discord Webhook URL. Format: https://discord.com/api/webhooks/...",
        });
      }
    }

    if (telegramChatId !== undefined && telegramChatId !== "" && telegramChatId !== null) {
      const isChatId = /^-?\d{5,20}$/.test(String(telegramChatId).trim());
      if (!isChatId) {
        return res.status(400).json({
          error: "Invalid Telegram Chat ID. Chat ID must be numeric (e.g. 123456789).",
        });
      }
    }

    let parsedChannels = "email";
    if (channelsEnabled !== undefined) {
      const list = Array.isArray(channelsEnabled)
        ? channelsEnabled
        : String(channelsEnabled).split(",");
      const validChannels = ["email", "discord", "telegram"];
      const filtered = list
        .map((c) => String(c).toLowerCase().trim())
        .filter((c) => validChannels.includes(c));
      if (!filtered.includes("email")) filtered.unshift("email");
      parsedChannels = filtered.join(",");
    }

    const updates = {
      discordWebhookUrl: discordWebhookUrl ? discordWebhookUrl.trim() : null,
      telegramChatId: telegramChatId ? String(telegramChatId).trim() : null,
      channelsEnabled: parsedChannels,
    };

    await sharedData.updateUser(req.subscriberEmail, updates);
    const updated = await sharedData.getUserByEmail(req.subscriberEmail);

    logger.info("Subscriber updated notification channels", { email: req.subscriberEmail });
    res.json({
      success: true,
      message: "Notification channels updated successfully",
      subscriber: updated,
    });
  } catch (error) {
    logger.error("Failed to update notification channels", { error: error.message });
    res.status(500).json({ error: "Failed to update notification channels" });
  }
}

// POST /api/channels/test { channel, webhookUrl?, chatId? }
async function testChannel(req, res) {
  const { channel, webhookUrl, chatId } = req.body || {};
  const subscriberEmail = req.subscriberEmail;

  if (!channel || !["discord", "telegram"].includes(channel)) {
    return res.status(400).json({ error: "Channel must be 'discord' or 'telegram'" });
  }

  try {
    let targetWebhook = webhookUrl;
    let targetChatId = chatId;

    if (subscriberEmail && (!targetWebhook || !targetChatId)) {
      const sub = await sharedData.getUserByEmail(subscriberEmail);
      if (sub) {
        if (!targetWebhook) targetWebhook = sub.discordWebhookUrl;
        if (!targetChatId) targetChatId = sub.telegramChatId;
      }
    }

    if (channel === "discord" && !targetWebhook) {
      return res.status(400).json({ error: "Discord Webhook URL is required" });
    }
    if (channel === "telegram" && !targetChatId) {
      return res.status(400).json({ error: "Telegram Chat ID is required" });
    }

    const channelDispatcher = require("../helper/channelDispatcher");
    const result = await channelDispatcher.testChannelDispatch({
      channel,
      webhookUrl: targetWebhook,
      chatId: targetChatId,
      subscriberEmail,
      baseUrl:
        req.app?.locals?.officialDomain ||
        process.env.RENDER_URL ||
        "https://morning-routine-sender.onrender.com",
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || "Channel dispatch test failed",
      });
    }

    res.json({
      success: true,
      message: `Test notification delivered successfully to ${channel === "discord" ? "Discord Webhook" : "Telegram"}!`,
    });
  } catch (error) {
    logger.error("Channel test endpoint error", { error: error.message });
    res.status(500).json({ error: "Failed to test channel dispatch" });
  }
}

// POST /me/outbound-webhook { webhookEndpointUrl?, webhookUrl?, webhookSecret?, webhookEnabled? }
async function updateOutboundWebhook(req, res) {
  const { webhookEndpointUrl, webhookUrl, webhookSecret, webhookEnabled } = req.body || {};
  const url = webhookEndpointUrl !== undefined ? webhookEndpointUrl : webhookUrl;

  try {
    if (url !== undefined && url !== "" && url !== null) {
      if (typeof url !== "string" || !/^https?:\/\/.+/i.test(url.trim())) {
        return res.status(400).json({
          error: "Invalid webhook endpoint URL. Must start with http:// or https://",
        });
      }
    }

    const updates = {};
    if (url !== undefined) {
      updates.webhookEndpointUrl = url ? url.trim() : null;
    }
    if (webhookSecret !== undefined) {
      updates.webhookSecret = webhookSecret ? String(webhookSecret).trim() : null;
    }
    if (webhookEnabled !== undefined) {
      updates.webhookEnabled = Boolean(webhookEnabled);
    }

    if (Object.keys(updates).length === 0) {
      return res.status(400).json({ error: "No fields provided to update" });
    }

    await sharedData.updateUser(req.subscriberEmail, updates);
    const updated = await sharedData.getUserByEmail(req.subscriberEmail);

    logger.info("Subscriber updated outbound webhook configuration", {
      email: req.subscriberEmail,
    });

    res.json({
      success: true,
      message: "Outbound webhook settings updated successfully",
      webhook: {
        endpointUrl: updated?.webhookEndpointUrl || updates.webhookEndpointUrl || null,
        secretConfigured: Boolean(updated?.webhookSecret || updates.webhookSecret),
        enabled:
          updated?.webhookEnabled !== undefined ? updated.webhookEnabled : updates.webhookEnabled,
      },
    });
  } catch (error) {
    logger.error("Failed to update outbound webhook settings", { error: error.message });
    res.status(500).json({ error: "Failed to update outbound webhook settings" });
  }
}

// POST /api/outbound-webhook/test { webhookEndpointUrl?, webhookUrl?, webhookSecret? }
async function testOutboundWebhook(req, res) {
  const { webhookEndpointUrl, webhookUrl, webhookSecret } = req.body || {};
  const subscriberEmail = req.subscriberEmail;

  try {
    let targetUrl = webhookEndpointUrl || webhookUrl;
    let targetSecret = webhookSecret;

    if (subscriberEmail && (!targetUrl || targetSecret === undefined)) {
      const sub = await sharedData.getUserByEmail(subscriberEmail);
      if (sub) {
        if (!targetUrl) targetUrl = sub.webhookEndpointUrl;
        if (targetSecret === undefined) targetSecret = sub.webhookSecret;
      }
    }

    if (!targetUrl) {
      return res.status(400).json({ error: "Webhook endpoint URL is required to test dispatch" });
    }

    const outboundWebhookDispatcher = require("../helper/outboundWebhookDispatcher");
    const result = await outboundWebhookDispatcher.testOutboundWebhook({
      webhookUrl: targetUrl,
      webhookSecret: targetSecret,
      subscriberEmail,
    });

    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: result.error || "Outbound webhook test failed",
      });
    }

    res.json({
      success: true,
      message: "Test outbound webhook delivered successfully!",
      status: result.status,
    });
  } catch (error) {
    logger.error("Outbound webhook test endpoint error", { error: error.message });
    res.status(500).json({ error: "Failed to test outbound webhook dispatch" });
  }
}

// GET /me/streak-freeze/status
async function getStreakFreezeStatus(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    res.json({
      success: true,
      streakFreezes: subscriber.streakFreezes ?? 2,
      streakFreezesRemaining: subscriber.streakFreezes ?? 2,
      freezeHistory: subscriber.freezeHistory || [],
      streakCount: subscriber.streakCount || 0,
      lastCheckinDate: subscriber.lastCheckinDate || null,
    });
  } catch (error) {
    logger.error("Failed to fetch streak freeze status", { error: error.message });
    res.status(500).json({ error: "Failed to load streak freeze status" });
  }
}

// POST /me/streak-freeze/use
async function useStreakFreeze(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }

    const freezes = subscriber.streakFreezes !== undefined ? Number(subscriber.streakFreezes) : 2;
    if (freezes <= 0) {
      return res.status(400).json({
        success: false,
        error: "No streak freeze shields remaining. Complete daily check-ins to stay consistent!",
        streakFreezes: 0,
      });
    }

    let todayStr;
    try {
      todayStr = new Intl.DateTimeFormat("en-CA", {
        timeZone: subscriber.timezone || "UTC",
      }).format(new Date());
    } catch (_err) {
      todayStr = new Intl.DateTimeFormat("en-CA", { timeZone: "UTC" }).format(new Date());
    }

    const history = Array.isArray(subscriber.freezeHistory) ? [...subscriber.freezeHistory] : [];
    const alreadyFrozenToday = history.some((h) => h.date === todayStr);

    if (alreadyFrozenToday) {
      return res.status(400).json({
        success: false,
        error: "A streak freeze shield is already active for today.",
        streakFreezes: freezes,
      });
    }

    const newFreezes = freezes - 1;
    history.push({
      date: todayStr,
      usedAt: new Date().toISOString(),
      reason: "manual",
    });

    await sharedData.updateUser(req.subscriberEmail, {
      streakFreezes: newFreezes,
      freezeHistory: history,
    });

    logger.info("Subscriber activated streak freeze shield", {
      email: req.subscriberEmail,
      date: todayStr,
      remaining: newFreezes,
    });

    // Non-blocking trigger of streak.freeze_activated outbound webhook
    const outboundWebhookDispatcher = require("../helper/outboundWebhookDispatcher");
    outboundWebhookDispatcher
      .dispatchWebhookForSubscriber(req.subscriberEmail, "streak.freeze_activated", {
        streakFreezesRemaining: newFreezes,
        date: todayStr,
        reason: "manual",
        activatedAt: new Date().toISOString(),
      })
      .catch((err) => {
        logger.error("Outbound webhook trigger failed on streak freeze", {
          error: err.message,
          email: req.subscriberEmail,
        });
      });

    res.json({
      success: true,
      message: "Streak Freeze Shield activated for today! Your streak is protected.",
      streakFreezes: newFreezes,
      freezeHistory: history,
      date: todayStr,
    });
  } catch (error) {
    logger.error("Failed to activate streak freeze", { error: error.message });
    res.status(500).json({ error: "Failed to activate streak freeze" });
  }
}

// POST /me/vacation/pause
async function pauseVacation(req, res) {
  try {
    const email = req.subscriberEmail;
    const { days, until, untilDate, reason } = req.body || {};
    let targetDate = null;

    const rawUntil = until || untilDate;
    if (rawUntil) {
      const d = new Date(rawUntil);
      if (isNaN(d.getTime())) {
        return res.status(400).json({ error: "Invalid 'until' date provided" });
      }
      if (d <= new Date()) {
        return res.status(400).json({ error: "Vacation return date must be in the future" });
      }
      targetDate = d.toISOString();
    } else if (days && Number(days) > 0) {
      const ms = Number(days) * 24 * 60 * 60 * 1000;
      targetDate = new Date(Date.now() + ms).toISOString();
    } else {
      targetDate = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    }

    const vacationReason = reason ? String(reason).trim() : "Vacation / Travel";

    const updated = await sharedData.updateUser(email, {
      vacationUntil: targetDate,
      vacationReason,
    });

    try {
      const emailScheduler = require("../email-core/emailScheduler");
      if (typeof emailScheduler.rescheduleUserJob === "function") {
        await emailScheduler.rescheduleUserJob(email);
      }
    } catch (_schedErr) {
      // non-fatal
    }

    logger.info("✈️ Vacation mode activated for subscriber", {
      email,
      targetDate,
      vacationReason,
    });

    return res.json({
      success: true,
      subscriber: updated,
      vacationUntil: targetDate,
      vacationReason,
      message: `Routine paused until ${targetDate.split("T")[0]}. Your streak is safely frozen!`,
    });
  } catch (error) {
    logger.error("Failed to activate vacation mode", { error: error.message });
    return res.status(500).json({ error: "Failed to pause routine" });
  }
}

// POST /me/vacation/resume
async function resumeVacation(req, res) {
  try {
    const email = req.subscriberEmail;
    const updated = await sharedData.updateUser(email, {
      vacationUntil: null,
      vacationReason: null,
    });

    try {
      const emailScheduler = require("../email-core/emailScheduler");
      if (typeof emailScheduler.rescheduleUserJob === "function") {
        await emailScheduler.rescheduleUserJob(email);
      }
    } catch (_schedErr) {
      // non-fatal
    }

    logger.info("✈️ Vacation mode resumed early for subscriber", { email });

    return res.json({
      success: true,
      subscriber: updated || { email, vacationUntil: null, vacationReason: null },
      message: "Welcome back! Routine resumed and streak active.",
    });
  } catch (error) {
    logger.error("Failed to resume routine from vacation", { error: error.message });
    return res.status(500).json({ error: "Failed to resume routine" });
  }
}

// GET /me/milestones
async function getMilestones(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    const { getStreakMilestones } = require("../helper/streakMilestones");
    const milestones = getStreakMilestones(subscriber.streakCount);
    return res.json({
      success: true,
      ...milestones,
    });
  } catch (error) {
    logger.error("Failed to get subscriber milestones", { error: error.message });
    return res.status(500).json({ error: "Failed to fetch milestones" });
  }
}

// POST & GET /api/me/hardware-checkin (NFC / Apple Shortcuts / Automation)
async function hardwareCheckin(req, res) {
  try {
    let token = req.query?.token || req.body?.token;
    if (!token && req.headers?.authorization) {
      const authHeader = req.headers.authorization.trim();
      if (authHeader.toLowerCase().startsWith("bearer ")) {
        token = authHeader.slice(7).trim();
      } else {
        token = authHeader;
      }
    }

    let email = (
      req.query?.email ||
      req.body?.email ||
      req.subscriberEmail ||
      req.session?.subscriberEmail ||
      ""
    )
      .trim()
      .toLowerCase();

    // If email is not passed explicitly, attempt to resolve from composite or encoded token
    if (!email && token && typeof token === "string") {
      if (token.includes(":")) {
        const parts = token.split(":");
        const possibleEmail = parts[0].trim().toLowerCase();
        const rawToken = parts.slice(1).join(":").trim();
        if (possibleEmail && rawToken) {
          email = possibleEmail;
          token = rawToken;
        }
      } else {
        try {
          const decoded = Buffer.from(token, "base64url").toString("utf8");
          if (decoded.includes(":")) {
            const parts = decoded.split(":");
            const possibleEmail = parts[0].trim().toLowerCase();
            const rawToken = parts.slice(1).join(":").trim();
            if (possibleEmail && rawToken) {
              email = possibleEmail;
              token = rawToken;
            }
          }
        } catch (_e) {
          // ignore malformed basic auth header
        }
      }
    }

    // If still no email, attempt lookup across subscribers by matching token
    const { verifyActionToken } = require("../helper/unsubscribeToken");
    if (!email && token) {
      try {
        const db = require("../db/knex");
        const subscribers = await db("subscribers").select("email");
        for (const sub of subscribers) {
          if (
            verifyActionToken(sub.email, token, "hardware") ||
            verifyActionToken(sub.email, token, "checkin")
          ) {
            email = (sub.email || "").trim().toLowerCase();
            break;
          }
        }
      } catch (_e) {
        // ignore db lookup failure
      }
    }

    if (!token || !email) {
      return res.status(401).json({
        success: false,
        error: "Missing or invalid hardware verification token",
      });
    }

    const isValid =
      verifyActionToken(email, token, "hardware") || verifyActionToken(email, token, "checkin");

    if (!isValid) {
      logger.warn("Invalid hardware check-in token attempt", { email, ip: req.ip });
      return res.status(401).json({
        success: false,
        error: "Invalid or expired verification token",
      });
    }

    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({
        success: false,
        error: "Subscriber not found",
      });
    }

    const checkinResult = await sharedData.recordCheckin(email, subscriber.timezone);
    const finalStreak =
      checkinResult.streakCount !== undefined
        ? checkinResult.streakCount
        : checkinResult.streak !== undefined
          ? checkinResult.streak
          : Number(subscriber.streakCount) || 1;

    subscriber.streakCount = finalStreak;

    if (checkinResult.alreadyCheckedInToday) {
      return res.status(200).json({
        success: true,
        message: "Morning routine already verified today!",
        streak: subscriber.streakCount,
        streakCount: subscriber.streakCount,
        alreadyCheckedIn: true,
      });
    }

    const journalService = require("../helper/journalService");
    try {
      await journalService.recordEntry(email, {
        one_big_thing: "Physical NFC / Hardware Wake-Up Verified",
        verified_wakeup: true,
        streak: subscriber.streakCount,
      });
    } catch (journalErr) {
      logger.warn("Failed to record hardware checkin journal entry", {
        email,
        error: journalErr.message,
      });
    }

    // Optional notification trigger via channelDispatcher and pushService
    try {
      const channelDispatcher = require("../helper/channelDispatcher");
      if (channelDispatcher?.dispatchChannelsForSubscriber) {
        channelDispatcher.dispatchChannelsForSubscriber(subscriber).catch((notifErr) => {
          logger.warn("Channel dispatch failed on hardware checkin", {
            email,
            error: notifErr.message,
          });
        });
      }
      const pushService = require("../push-core/pushService");
      if (pushService && typeof pushService.dispatchMorningPushForSubscriber === "function") {
        pushService.dispatchMorningPushForSubscriber(subscriber).catch(() => {});
      }
    } catch (_notifErr) {
      // ignore notification dispatch errors in physical checkin
    }

    logger.info("Physical NFC / Hardware Wake-Up verified", {
      email,
      streakCount: subscriber.streakCount,
    });

    return res.status(200).json({
      success: true,
      message: "⚡ Physical Wake-Up Verified!",
      streak: subscriber.streakCount,
      streakCount: subscriber.streakCount,
      verifiedWakeup: true,
    });
  } catch (error) {
    logger.error("Hardware check-in error", { error: error.message });
    return res.status(500).json({
      success: false,
      error: "Internal server error during hardware check-in",
    });
  }
}

// GET /api/me/shortcut-config (authenticated)
async function getShortcutConfig(req, res) {
  try {
    const email = (req.subscriberEmail || req.session?.subscriberEmail || "").trim().toLowerCase();

    if (!email) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ success: false, error: "Subscriber not found" });
    }

    const { generateActionToken } = require("../helper/unsubscribeToken");
    const token = generateActionToken(email, "hardware");

    const baseUrl =
      res.locals.apiBase ||
      (req.get && req.get("host") ? `${req.protocol}://${req.get("host")}` : null) ||
      req.app?.locals?.officialDomain ||
      process.env.RENDER_URL ||
      "https://morning-routine-sender.onrender.com";

    const webhookUrl = `${baseUrl}/api/me/hardware-checkin?token=${token}&email=${encodeURIComponent(email)}`;

    return res.json({
      success: true,
      webhookUrl,
      token,
      instructions: {
        ios: "Open Apple Shortcuts app -> Create Automation -> When NFC tag is tapped -> Add 'Get Contents of URL' with Method POST to webhookUrl",
        android:
          "Open Tasker or Automate -> Add NFC Tag trigger -> HTTP Request POST to webhookUrl",
      },
    });
  } catch (error) {
    logger.error("Failed to generate shortcut config", { error: error.message });
    return res
      .status(500)
      .json({ success: false, error: "Failed to generate shortcut configuration" });
  }
}

// GET /api/me/xp & GET /me/xp (authenticated)
async function getXpProfile(req, res) {
  try {
    const email = (req.subscriberEmail || req.session?.subscriberEmail || req.query?.email || "")
      .trim()
      .toLowerCase();

    if (!email) {
      return res.status(401).json({ success: false, error: "Authentication required" });
    }

    const subscriber = await sharedData.getUserByEmail(email);
    if (!subscriber) {
      return res.status(404).json({ success: false, error: "Subscriber not found" });
    }

    const journalService = require("../helper/journalService");
    let entries = [];
    try {
      entries = (await journalService.getAllEntries(email)) || [];
    } catch (_jErr) {
      entries = [];
    }

    const streakCount = Number(subscriber.streakCount) || 0;
    const journalEntries = entries.length;
    let verifiedWakeups = 0;
    let hardwareCheckins = 0;
    let moodLogs = 0;
    let gratitudeLogs = 0;
    let reflections = 0;

    for (const entry of entries) {
      if (entry.verified_wakeup || entry.verifiedWakeup) verifiedWakeups++;
      if (
        (entry.one_big_thing && entry.one_big_thing.includes("Hardware")) ||
        (entry.oneBigThing && entry.oneBigThing.includes("Hardware")) ||
        (entry.one_big_thing && entry.one_big_thing.includes("NFC"))
      ) {
        hardwareCheckins++;
      }
      if (entry.mood_score !== undefined || entry.mood !== undefined) moodLogs++;
      if (entry.gratitude && String(entry.gratitude).trim()) gratitudeLogs++;
      if (
        (entry.reflection_text && String(entry.reflection_text).trim()) ||
        (entry.reflection && String(entry.reflection).trim())
      ) {
        reflections++;
      }
    }

    const xpEngine = require("../helper/xpEngine");
    const xpData = xpEngine.getXpProfile({
      streakCount,
      totalCheckins: streakCount,
      journalEntries,
      verifiedWakeups,
      hardwareCheckins,
      duelWins: Number(subscriber.duelWins) || 0,
      moodLogs,
      gratitudeLogs,
      reflections,
    });

    return res.json({
      success: true,
      subscriber: email,
      ...xpData,
    });
  } catch (error) {
    logger.error("Failed to load subscriber XP profile", { error: error.message });
    return res.status(500).json({ success: false, error: "Failed to load XP profile" });
  }
}

// GET /api/me/mern-insight & GET /me/mern-insight
async function getMernInsight(req, res) {
  try {
    const rawEmail = req.subscriberEmail || req.query?.email || "developer@example.com";
    const { getDailyMernInsight } = require("../helper/mernKnowledgeService");
    const insight = await getDailyMernInsight({
      email: rawEmail,
      timezone: req.query?.timezone || "UTC",
      forceId: req.query?.id || null,
    });
    return res.json({
      success: true,
      insight,
    });
  } catch (error) {
    logger.error("Failed to fetch MERN insight", { error: error.message });
    return res.status(500).json({ success: false, error: "Failed to fetch MERN insight" });
  }
}

module.exports = {
  getMe,
  getMyHistory,
  exportJournal,
  getStreakCard,
  getMyStreakCard,
  getCoachPersonas,
  updateCoachPersona,
  updateMe,
  updateChannels,
  testChannel,
  updateOutboundWebhook,
  testOutboundWebhook,
  getStreakFreezeStatus,
  useStreakFreeze,
  pauseVacation,
  resumeVacation,
  getMilestones,
  exportCalendar,
  getCalendarFeedByToken,
  getWeeklyReportCard,
  getMyWeeklyReportCard,
  getRadarChart,
  exportDisciplineData,
  hardwareCheckin,
  getShortcutConfig,
  getXpProfile,
  getMernInsight,
};
