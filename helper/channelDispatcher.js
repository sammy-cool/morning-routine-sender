// helper/channelDispatcher.js
const logger = require("../logger");
const sharedData = require("./shared-data");
const { generateActionToken } = require("./unsubscribeToken");

const TRACK_COLORS = {
  "deep-work": 0x7c3aed, // Electric Violet
  mindfulness: 0x10b981, // Emerald
  executive: 0xf59e0b, // Amber
  learning: 0x22d3ee, // Cyan
  classic: 0xec4899, // Pink
  career: 0x3b82f6, // Royal Blue
  reflection: 0x8b5cf6, // Violet
};

/**
 * Normalize and parse enabled channels from subscriber record
 * @param {string|string[]} channels
 * @returns {string[]}
 */
function parseEnabledChannels(channels) {
  if (!channels) return ["email"];
  if (Array.isArray(channels)) return channels.map((c) => String(c).toLowerCase().trim());
  return String(channels)
    .split(",")
    .map((c) => c.toLowerCase().trim())
    .filter(Boolean);
}

/**
 * Format and dispatch Discord Webhook Notification
 */
async function sendDiscordNotification({
  webhookUrl,
  subscriber,
  trackContent,
  quote,
  streakCount = 1,
  baseUrl = process.env.RENDER_URL || "https://morning-routine-sender.onrender.com",
}) {
  if (!webhookUrl || typeof webhookUrl !== "string") {
    return { success: false, channel: "discord", error: "Missing or invalid Discord Webhook URL" };
  }

  const trackKey = (subscriber?.routineTrack || trackContent?.track || "deep-work").toLowerCase();
  const trackName = trackContent?.name || "Deep Work & Builder";
  const embedColor = TRACK_COLORS[trackKey] || 0x7c3aed;
  const streak = Number(streakCount) || Number(subscriber?.streakCount) || 1;

  const email = subscriber?.email || "";
  const routineToken = email ? generateActionToken(email, "routine") : "";
  const checkinToken = email ? generateActionToken(email, "checkin") : "";

  const routineUrl = routineToken
    ? `${baseUrl}/routine?email=${encodeURIComponent(email)}&token=${routineToken}`
    : `${baseUrl}/routine`;

  const checkinUrl = checkinToken
    ? `${baseUrl}/checkin?email=${encodeURIComponent(email)}&token=${checkinToken}`
    : `${baseUrl}/routine`;

  const checklistFormatted = (
    trackContent?.checklist || [
      "Hydrate (500ml water)",
      "Review Today's #1 Priority",
      "Silence Notifications (90 min)",
      "Complete Flow State Sprint",
    ]
  )
    .map((item) => `• ${item}`)
    .join("\n");

  const payload = {
    username: "Morning Routine Sender",
    avatar_url: `${baseUrl}/assets/mrn-brand-ico.png`,
    embeds: [
      {
        title: `🌅 Morning Routine Spark • ${trackName}`,
        url: routineUrl,
        description: `Your daily focus ritual is ready. Start your morning with intentionality and momentum!\n\n[⚡ **Launch Live Interactive Routine**](${routineUrl}) • [🔥 **1-Click Streak Check-in**](${checkinUrl})`,
        color: embedColor,
        fields: [
          {
            name: "🔥 Habit Streak",
            value: `**${streak} Day${streak === 1 ? "" : "s"} Active**`,
            inline: true,
          },
          {
            name: "⚡ Persona Track",
            value: `\`${trackName}\``,
            inline: true,
          },
          {
            name: "🎯 Today's Action Ritual",
            value: trackContent?.ritual || "Select your #1 deliverable and focus for 90 minutes.",
            inline: false,
          },
          {
            name: "💬 Daily Wisdom",
            value: `*“${quote || trackContent?.quote || "Action is the foundational key to all success."}”*`,
            inline: false,
          },
          {
            name: "📋 Launch Checklist",
            value: checklistFormatted,
            inline: false,
          },
        ],
        footer: {
          text: "Morning Routine Sender • Start your day with focus",
          icon_url: `${baseUrl}/assets/mrn-brand-ico.png`,
        },
        timestamp: new Date().toISOString(),
      },
    ],
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      logger.warn("Discord Webhook responded with error status", {
        status: res.status,
        response: errText,
      });
      return { success: false, channel: "discord", status: res.status, error: errText };
    }

    logger.info("✅ Discord Webhook dispatch successful", { email: subscriber?.email });
    return { success: true, channel: "discord", status: res.status };
  } catch (error) {
    logger.error("❌ Discord Webhook dispatch failed", {
      error: error.message,
      email: subscriber?.email,
    });
    return {
      success: false,
      channel: "discord",
      error: error.name === "AbortError" ? "Discord webhook timed out (5s)" : error.message,
    };
  }
}

/**
 * Format and dispatch Telegram Bot Message via Telegram Bot API
 */
async function sendTelegramNotification({
  chatId,
  botToken = process.env.TELEGRAM_BOT_TOKEN,
  subscriber,
  trackContent,
  quote,
  streakCount = 1,
  baseUrl = process.env.RENDER_URL || "https://morning-routine-sender.onrender.com",
}) {
  if (!chatId || (typeof chatId !== "string" && typeof chatId !== "number")) {
    return { success: false, channel: "telegram", error: "Missing or invalid Telegram Chat ID" };
  }
  if (!botToken) {
    return {
      success: false,
      channel: "telegram",
      error: "Telegram Bot Token not configured in TELEGRAM_BOT_TOKEN",
    };
  }

  const trackName = trackContent?.name || "Deep Work & Builder";
  const streak = Number(streakCount) || Number(subscriber?.streakCount) || 1;
  const email = subscriber?.email || "";

  const routineToken = email ? generateActionToken(email, "routine") : "";
  const checkinToken = email ? generateActionToken(email, "checkin") : "";

  const routineUrl = routineToken
    ? `${baseUrl}/routine?email=${encodeURIComponent(email)}&token=${routineToken}`
    : `${baseUrl}/routine`;

  const checkinUrl = checkinToken
    ? `${baseUrl}/checkin?email=${encodeURIComponent(email)}&token=${checkinToken}`
    : `${baseUrl}/routine`;

  const checklistFormatted = (
    trackContent?.checklist || [
      "Hydrate (500ml water)",
      "Review Today's #1 Priority",
      "Silence Notifications (90 min)",
      "Complete Flow State Sprint",
    ]
  )
    .map((item) => `• ${item}`)
    .join("\n");

  const messageText = [
    `🌅 <b>Morning Routine Spark • ${trackName}</b>`,
    ``,
    `🔥 <b>Streak:</b> ${streak} Day${streak === 1 ? "" : "s"} Active`,
    `⚡ <b>Track:</b> ${trackName}`,
    ``,
    `🎯 <b>Today's Action Ritual:</b>`,
    `${trackContent?.ritual || "Select your #1 deliverable and dive straight in."}`,
    ``,
    `💬 <i>“${quote || trackContent?.quote || "Action is the foundational key to all success."}”</i>`,
    ``,
    `📋 <b>Launch Checklist:</b>`,
    checklistFormatted,
  ].join("\n");

  const payload = {
    chat_id: String(chatId).trim(),
    text: messageText,
    parse_mode: "HTML",
    disable_web_page_preview: false,
    reply_markup: {
      inline_keyboard: [
        [
          { text: "⚡ Open Live Routine", url: routineUrl },
          { text: "🔥 1-Click Check-in", url: checkinUrl },
        ],
      ],
    },
  };

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    const apiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;
    const res = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: controller.signal,
    });
    clearTimeout(timeoutId);

    const data = await res.json().catch(() => ({}));
    if (!res.ok || data.ok === false) {
      logger.warn("Telegram API dispatch failed", { error: data.description, status: res.status });
      return {
        success: false,
        channel: "telegram",
        status: res.status,
        error: data.description || "Telegram API error",
      };
    }

    logger.info("✅ Telegram dispatch successful", { chatId, email });
    return { success: true, channel: "telegram", messageId: data.result?.message_id };
  } catch (error) {
    logger.error("❌ Telegram dispatch failed", { error: error.message, chatId });
    return {
      success: false,
      channel: "telegram",
      error: error.name === "AbortError" ? "Telegram API timed out (5s)" : error.message,
    };
  }
}

/**
 * Dispatch all configured channels for a subscriber during routine execution
 */
async function dispatchChannelsForSubscriber(subscriber, options = {}) {
  if (!subscriber) return { dispatched: 0, results: [] };

  const channelsEnabled = parseEnabledChannels(
    subscriber.channelsEnabled || subscriber.channels_enabled,
  );
  const trackKey = subscriber.routineTrack || subscriber.templateType || "deep-work";
  const trackContent =
    options.trackContent ||
    sharedData.getTrackContent(trackKey, {
      customQuote: subscriber.customQuote,
      customRitual: subscriber.customRitual,
      email: subscriber.email,
      dateStr: options.dateStr,
    });
  const quote = options.quote || trackContent?.quote || (await sharedData.getNewRandomQuote());
  const baseUrl =
    options.baseUrl || process.env.RENDER_URL || "https://morning-routine-sender.onrender.com";

  const dispatchTasks = [];

  // Discord Dispatch
  if (channelsEnabled.includes("discord")) {
    const webhookUrl = subscriber.discordWebhookUrl || subscriber.discord_webhook_url;
    if (webhookUrl) {
      dispatchTasks.push(
        sendDiscordNotification({
          webhookUrl,
          subscriber,
          trackContent,
          quote,
          streakCount: subscriber.streakCount || subscriber.streak_count || 1,
          baseUrl,
        }),
      );
    }
  }

  // Telegram Dispatch
  if (channelsEnabled.includes("telegram")) {
    const chatId = subscriber.telegramChatId || subscriber.telegram_chat_id;
    if (chatId) {
      dispatchTasks.push(
        sendTelegramNotification({
          chatId,
          botToken: options.botToken || process.env.TELEGRAM_BOT_TOKEN,
          subscriber,
          trackContent,
          quote,
          streakCount: subscriber.streakCount || subscriber.streak_count || 1,
          baseUrl,
        }),
      );
    }
  }

  if (dispatchTasks.length === 0) {
    return { dispatched: 0, results: [] };
  }

  const results = await Promise.allSettled(dispatchTasks);
  const formattedResults = results.map((r) =>
    r.status === "fulfilled" ? r.value : { success: false, error: r.reason?.message },
  );

  return {
    dispatched: dispatchTasks.length,
    results: formattedResults,
  };
}

/**
 * Test a specific channel on demand
 */
async function testChannelDispatch({ channel, webhookUrl, chatId, subscriberEmail, baseUrl }) {
  const trackContent = sharedData.getTrackContent("deep-work");
  const quote = "Simplicity is prerequisite for reliability. - Edsger W. Dijkstra";
  const dummySubscriber = {
    email: subscriberEmail || "subscriber@example.com",
    streakCount: 7,
    routineTrack: "deep-work",
  };

  if (channel === "discord") {
    return await sendDiscordNotification({
      webhookUrl,
      subscriber: dummySubscriber,
      trackContent,
      quote,
      streakCount: 7,
      baseUrl,
    });
  }

  if (channel === "telegram") {
    return await sendTelegramNotification({
      chatId,
      subscriber: dummySubscriber,
      trackContent,
      quote,
      streakCount: 7,
      baseUrl,
    });
  }

  return { success: false, error: `Unsupported channel: ${channel}` };
}

module.exports = {
  TRACK_COLORS,
  parseEnabledChannels,
  sendDiscordNotification,
  sendTelegramNotification,
  dispatchChannelsForSubscriber,
  testChannelDispatch,
};
