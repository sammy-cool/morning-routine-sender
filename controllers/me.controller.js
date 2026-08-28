const logger = require("../logger");
const sharedData = require("../helper/shared-data");
const emailTracker = require("../email-core/emailTracker");
const { validateSubscriberInput } = require("../helper/validateSubscriber");
const { generateStreakSvg } = require("../helper/streakCardGenerator");

// GET /me
async function getMe(req, res) {
  try {
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    if (!subscriber) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    res.json(subscriber);
  } catch (error) {
    logger.error("Failed to load own subscriber record", { error: error.message });
    res.status(500).json({ error: "Failed to load your subscription" });
  }
}

// GET /me/history
async function getMyHistory(req, res) {
  try {
    const limit = Math.min(Number(req.query.limit) || 20, 100);
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
    const subscriber = await sharedData.getUserByEmail(req.subscriberEmail);
    const history = await emailTracker.getHistory(req.subscriberEmail, 100);

    let md = `# 🌅 Morning Routine Journal & Habit History\n\n`;
    md += `* **Subscriber:** \`${req.subscriberEmail}\`\n`;
    md += `* **Current Streak:** 🔥 **${subscriber?.streakCount || 1} Days**\n`;
    md += `* **Active Persona Track:** \`${subscriber?.routineTrack || subscriber?.templateType || "deep-work"}\`\n`;
    md += `* **Schedule & Timezone:** \`${subscriber?.cronPattern || "0 8 * * *"}\` (${subscriber?.timezone || "UTC"})\n`;
    md += `* **Export Date:** ${new Date().toISOString().split("T")[0]}\n\n---\n\n`;

    md += `## 📜 Dispatch & Habit History\n\n`;
    if (!history || history.length === 0) {
      md += `*No dispatched routine history yet.*\n`;
    } else {
      history.forEach((h, idx) => {
        md += `### Day ${history.length - idx} • ${new Date(h.sent_at || h.created_at).toDateString()}\n`;
        md += `- **Status:** ${h.status === "sent" ? "✅ Completed & Sent" : "⚠️ " + (h.status || "Logged")}\n`;
        md += `- **Template Track:** \`${h.template_type || "classic"}\`\n`;
        if (h.error_message) md += `- **Notes:** ${h.error_message}\n`;
        md += `\n`;
      });
    }

    res.setHeader("Content-Type", "text/markdown; charset=utf-8");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="morning-routine-journal-${new Date().toISOString().split("T")[0]}.md"`
    );
    res.send(md);
  } catch (error) {
    logger.error("Failed to export journal", { error: error.message });
    res.status(500).json({ error: "Failed to generate journal export" });
  }
}

// GET /api/streak-card.svg
async function getStreakCard(req, res) {
  try {
    const email = req.query.email || req.subscriberEmail;
    let subscriber = null;
    if (email) {
      subscriber = await sharedData.getUserByEmail(email);
    }
    const streak = subscriber ? subscriber.streakCount : Number(req.query.streak) || 1;
    const track = subscriber ? (subscriber.routineTrack || subscriber.templateType) : (req.query.track || "deep-work");

    const svg = generateStreakSvg({
      name: email ? email.split("@")[0] : "Morning Builder",
      streak,
      track,
    });

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(svg);
  } catch (error) {
    logger.error("Failed to generate streak card SVG", { error: error.message });
    res.status(500).send("<svg><text>Error generating streak card</text></svg>");
  }
}

// PATCH /me  { templateType?, routineTrack?, cronPattern?, timezone?, isActive? }
async function updateMe(req, res) {
  const { templateType, routineTrack, cronPattern, timezone, isActive } = req.body || {};

  if (
    templateType === undefined &&
    routineTrack === undefined &&
    cronPattern === undefined &&
    timezone === undefined &&
    isActive === undefined
  ) {
    return res.status(400).json({ error: "No fields provided to update" });
  }

  const errors = validateSubscriberInput(
    { templateType, routineTrack, cronPattern, timezone },
    { requireEmail: false },
  );
  if (errors.length > 0) {
    return res.status(400).json({ errors });
  }

  try {
    const updates = {};
    if (templateType !== undefined) updates.templateType = templateType;
    if (routineTrack !== undefined) updates.routineTrack = routineTrack;
    if (cronPattern !== undefined) updates.cronPattern = cronPattern;
    if (timezone !== undefined) updates.timezone = timezone;

    if (Object.keys(updates).length > 0) {
      await sharedData.updateUser(req.subscriberEmail, updates);
    }
    if (isActive !== undefined) {
      await sharedData.setUserActive(req.subscriberEmail, Boolean(isActive));
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

module.exports = { getMe, getMyHistory, exportJournal, getStreakCard, updateMe };
