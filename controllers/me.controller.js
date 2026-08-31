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

// POST /me/coach-persona { coachPersona }
async function updateCoachPersona(req, res) {
  const { coachPersona, persona } = req.body || {};
  const targetPersona = coachPersona || persona;

  if (!targetPersona || typeof targetPersona !== "string") {
    return res.status(400).json({
      error:
        "coachPersona field is required (e.g. 'stoic', 'relentless', 'zen', 'tech-lead', 'optimist')",
    });
  }

  const normalized = targetPersona.toLowerCase().trim();
  const validPersonas = ["stoic", "relentless", "zen", "tech-lead", "optimist"];

  if (!validPersonas.includes(normalized)) {
    return res.status(400).json({
      error: `Invalid coach persona '${targetPersona}'. Valid options: ${validPersonas.join(", ")}`,
    });
  }

  try {
    const { COACH_PERSONAS_METADATA } = require("../helper/curatedSparks");
    await sharedData.updateUser(req.subscriberEmail, { coachPersona: normalized });
    const updated = await sharedData.getUserByEmail(req.subscriberEmail);

    logger.info("Subscriber updated AI Coach Persona", {
      email: req.subscriberEmail,
      coachPersona: normalized,
    });

    res.json({
      success: true,
      message: `AI Coach Persona set to '${COACH_PERSONAS_METADATA[normalized]?.title || normalized}'`,
      coachPersona: normalized,
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
};
