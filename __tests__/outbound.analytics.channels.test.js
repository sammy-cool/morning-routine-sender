/**
 * __tests__/outbound.analytics.channels.test.js
 *
 * Test Suite:
 * 1. Outbound Webhook Dispatcher (HMAC SHA-256 signatures, payload creation, AbortController timeouts, retry backoff)
 * 2. Multi-Channel Failover & Notifications (Discord embeds, Telegram HTML format, error isolation via Promise.allSettled)
 * 3. Subscriber Analytics & Growth Stats Controller (7/30-day windows, active/paused ratios, streak buckets, track popularity)
 */

"use strict";

process.env.USE_MOCK_REDIS = "true";

const crypto = require("node:crypto");
const { newDb } = require("pg-mem");

// Core modules under test
const outboundWebhookDispatcher = require("../helper/outboundWebhookDispatcher");
const channelDispatcher = require("../helper/channelDispatcher");
const { retryWithBackoff } = require("../helper/retryUtil");

// Database migrations for in-memory Postgres
const migrationSubscribers = require("../db/migrations/20260711172620_create_subscribers_table");
const migrationStreaks = require("../db/migrations/20260828000000_add_streaks_and_track_to_subscribers");
const migrationChannels = require("../db/migrations/20260829010000_add_channels_to_subscribers");
const migrationWebhooks = require("../db/migrations/20260829030000_add_outbound_webhooks_to_subscribers");

// Mock helper for Express req/res
function mockReqRes(query = {}, body = {}) {
  const req = { query, body };
  const res = {
    _status: 200,
    _json: null,
    status(code) {
      this._status = code;
      return this;
    },
    json(data) {
      this._json = data;
      return this;
    },
  };
  return { req, res };
}

describe("Outbound Dispatcher, Multi-Channel Failover & Subscriber Analytics", () => {
  let originalFetch;

  beforeAll(() => {
    originalFetch = global.fetch;
  });

  afterAll(() => {
    global.fetch = originalFetch;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  // =========================================================================
  // SECTION 1: Outbound Dispatcher & Webhook Dispatching
  // =========================================================================
  describe("1. Outbound Webhook Dispatcher Engine", () => {
    describe("computeSignature", () => {
      test("generates valid sha256=<hex> HMAC signature matching standard crypto", () => {
        const payload = JSON.stringify({
          event: "routine.completed",
          streak: 12,
          track: "deep-work",
        });
        const secret = "whsec_test_secret_key_8899aabb";

        const signature = outboundWebhookDispatcher.computeSignature(payload, secret);

        expect(signature).toMatch(/^sha256=[a-f0-9]{64}$/);
        const expectedHmac = crypto.createHmac("sha256", secret).update(payload).digest("hex");
        expect(signature).toBe(`sha256=${expectedHmac}`);
      });

      test("returns empty string when secret is empty, null, or undefined", () => {
        const payload = JSON.stringify({ event: "test.ping" });

        expect(outboundWebhookDispatcher.computeSignature(payload, "")).toBe("");
        expect(outboundWebhookDispatcher.computeSignature(payload, null)).toBe("");
        expect(outboundWebhookDispatcher.computeSignature(payload, undefined)).toBe("");
      });
    });

    describe("sendOutboundWebhook - Payload & Header Validation", () => {
      test("validates required webhook endpoint URL", async () => {
        const resultMissing = await outboundWebhookDispatcher.sendOutboundWebhook({
          webhookUrl: "",
          event: "routine.completed",
        });
        expect(resultMissing.success).toBe(false);
        expect(resultMissing.error).toContain("Missing or invalid webhook endpoint URL");

        const resultNull = await outboundWebhookDispatcher.sendOutboundWebhook({
          webhookUrl: null,
          event: "routine.completed",
        });
        expect(resultNull.success).toBe(false);
      });

      test("creates correct payload structure and headers with HMAC signature", async () => {
        let capturedUrl, capturedOptions;
        global.fetch = jest.fn().mockImplementation((url, options) => {
          capturedUrl = url;
          capturedOptions = options;
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => '{"received":true}',
          });
        });

        const fixedTimestamp = "2026-08-31T07:00:00.000Z";
        const result = await outboundWebhookDispatcher.sendOutboundWebhook({
          webhookUrl: "https://api.example.com/webhooks/mrn",
          webhookSecret: "my_super_secret_key",
          event: "routine.completed",
          streak: 15,
          track: "deep-work",
          data: { subscriberEmail: "builder@example.com", customNote: "Day 15 completed!" },
          timestamp: fixedTimestamp,
        });

        expect(result.success).toBe(true);
        expect(result.status).toBe(200);
        expect(capturedUrl).toBe("https://api.example.com/webhooks/mrn");
        expect(capturedOptions.method).toBe("POST");
        expect(capturedOptions.headers["Content-Type"]).toBe("application/json");
        expect(capturedOptions.headers["User-Agent"]).toBe(
          "MorningRoutineSender-OutboundWebhook/1.0",
        );
        expect(capturedOptions.headers["X-MorningRoutine-Event"]).toBe("routine.completed");
        expect(capturedOptions.headers["X-MorningRoutine-Timestamp"]).toBe(fixedTimestamp);
        expect(capturedOptions.headers["X-MorningRoutine-Signature"]).toMatch(
          /^sha256=[a-f0-9]{64}$/,
        );

        const parsedBody = JSON.parse(capturedOptions.body);
        expect(parsedBody).toEqual({
          event: "routine.completed",
          timestamp: fixedTimestamp,
          streak: 15,
          track: "deep-work",
          data: {
            subscriberEmail: "builder@example.com",
            customNote: "Day 15 completed!",
          },
        });
      });

      test("handles fallback defaults for streak, track, and data", async () => {
        let capturedOptions;
        global.fetch = jest.fn().mockImplementation((_, options) => {
          capturedOptions = options;
          return Promise.resolve({
            ok: true,
            status: 200,
            text: async () => "ok",
          });
        });

        await outboundWebhookDispatcher.sendOutboundWebhook({
          webhookUrl: "https://api.example.com/webhooks/mrn",
          event: "journal.logged",
        });

        const parsed = JSON.parse(capturedOptions.body);
        expect(parsed.streak).toBe(0);
        expect(parsed.track).toBe("deep-work");
        expect(parsed.data).toEqual({});
        expect(capturedOptions.headers["X-MorningRoutine-Signature"]).toBeUndefined();
      });
    });

    describe("sendOutboundWebhook - Timeout & HTTP Status Handling", () => {
      test("handles AbortController timeout (5000ms AbortError) cleanly", async () => {
        global.fetch = jest.fn().mockImplementation((_, options) => {
          return new Promise((_, reject) => {
            const abortError = new Error("The operation was aborted");
            abortError.name = "AbortError";
            if (options.signal) {
              options.signal.addEventListener("abort", () => reject(abortError));
            }
            // Trigger abort mock
            reject(abortError);
          });
        });

        const result = await outboundWebhookDispatcher.sendOutboundWebhook({
          webhookUrl: "https://slow-destination.example.com/webhook",
          event: "routine.completed",
        });

        expect(result.success).toBe(false);
        expect(result.isTimeout).toBe(true);
        expect(result.error).toContain("Webhook delivery timed out after 5000ms");
      });

      test("handles non-2xx HTTP responses without throwing unhandled rejection", async () => {
        global.fetch = jest.fn().mockResolvedValue({
          ok: false,
          status: 502,
          text: async () => "Bad Gateway: upstream down",
        });

        const result = await outboundWebhookDispatcher.sendOutboundWebhook({
          webhookUrl: "https://failing-destination.example.com/webhook",
          event: "routine.completed",
        });

        expect(result.success).toBe(false);
        expect(result.status).toBe(502);
        expect(result.error).toContain("HTTP 502: Bad Gateway: upstream down");
      });
    });

    describe("dispatchWebhookForSubscriber - Inactive Filtering", () => {
      test("skips dispatch when subscriber has webhook_enabled = false or missing endpoint URL", async () => {
        const disabledSubscriber = {
          email: "disabled@example.com",
          webhook_enabled: false,
          webhook_endpoint_url: "https://hooks.zapier.com/hooks/catch/123/abc",
        };

        const result = await outboundWebhookDispatcher.dispatchWebhookForSubscriber(
          disabledSubscriber,
          "routine.completed",
        );

        expect(result.dispatched).toBe(false);
        expect(result.reason).toBe("webhook_disabled_or_missing_url");
      });
    });

    describe("Retry Logic with Backoff (retryWithBackoff integration)", () => {
      test("retries transient 5xx/network errors up to maxRetries with backoff", async () => {
        let attempts = 0;
        const retryableOperation = jest.fn().mockImplementation(async () => {
          attempts++;
          if (attempts < 3) {
            const networkError = new Error("ECONNRESET: connection reset by peer");
            networkError.code = "ECONNRESET";
            throw networkError;
          }
          return { success: true, deliveredAtAttempt: attempts };
        });

        const retryHistory = [];
        const result = await retryWithBackoff(retryableOperation, {
          maxRetries: 3,
          baseDelayMs: 10,
          maxDelayMs: 50,
          onRetry: ({ attempt, nextDelayMs }) => {
            retryHistory.push({ attempt, nextDelayMs });
          },
        });

        expect(result.result.success).toBe(true);
        expect(result.totalAttempts).toBe(3);
        expect(result.retries).toBe(2);
        expect(retryHistory).toHaveLength(2);
      });

      test("aborts immediately without retry on non-retryable 4xx client errors", async () => {
        const clientError = new Error("HTTP 401 Unauthorized: Invalid API key");
        clientError.status = 401;

        const fatalOperation = jest.fn().mockRejectedValue(clientError);

        await expect(
          retryWithBackoff(fatalOperation, {
            maxRetries: 3,
            baseDelayMs: 10,
            isRetryable: (err) => err.status >= 500 || !err.status,
          }),
        ).rejects.toThrow("HTTP 401 Unauthorized");

        expect(fatalOperation).toHaveBeenCalledTimes(1);
      });
    });
  });

  // =========================================================================
  // SECTION 2: Multi-Channel Failover & Notifications (Telegram & Discord)
  // =========================================================================
  describe("2. Multi-Channel Failover & Channel Notifier Engine", () => {
    describe("parseEnabledChannels", () => {
      test("defaults to ['email'] for empty, undefined, or null input", () => {
        expect(channelDispatcher.parseEnabledChannels(null)).toEqual(["email"]);
        expect(channelDispatcher.parseEnabledChannels(undefined)).toEqual(["email"]);
        expect(channelDispatcher.parseEnabledChannels("")).toEqual(["email"]);
      });

      test("parses comma-separated strings and trims whitespace cleanly", () => {
        expect(channelDispatcher.parseEnabledChannels("email, discord, telegram")).toEqual([
          "email",
          "discord",
          "telegram",
        ]);
        expect(channelDispatcher.parseEnabledChannels("DISCORD, EMAIL")).toEqual([
          "discord",
          "email",
        ]);
      });

      test("handles array inputs with mixed casing and spacing", () => {
        expect(channelDispatcher.parseEnabledChannels([" Email ", "TELEGRAM "])).toEqual([
          "email",
          "telegram",
        ]);
      });
    });

    describe("sendTelegramNotification - HTML Formatting & Inline Keyboards", () => {
      test("constructs valid Telegram Bot API HTML payload with action tokens", async () => {
        let capturedPayload;
        global.fetch = jest.fn().mockImplementation((_, options) => {
          capturedPayload = JSON.parse(options.body);
          return Promise.resolve({
            ok: true,
            status: 200,
            json: async () => ({ ok: true, result: { message_id: 998811 } }),
          });
        });

        const subscriber = {
          email: "telegram.user@example.com",
          streakCount: 5,
          routineTrack: "deep-work",
        };
        const trackContent = {
          name: "Deep Work & Builder",
          ritual: "Write 200 lines of clean code",
          checklist: ["Hydrate (500ml)", "Silence Slack", "Deep Sprint (90m)"],
        };

        const result = await channelDispatcher.sendTelegramNotification({
          chatId: "123456789",
          botToken: "test_bot_token_abc123",
          subscriber,
          trackContent,
          quote: "Simplicity is the soul of efficiency.",
          streakCount: 5,
          baseUrl: "https://morning-routine-sender.onrender.com",
        });

        expect(result.success).toBe(true);
        expect(result.channel).toBe("telegram");
        expect(result.messageId).toBe(998811);

        expect(capturedPayload.chat_id).toBe("123456789");
        expect(capturedPayload.parse_mode).toBe("HTML");
        expect(capturedPayload.text).toContain(
          "🌅 <b>Morning Routine Spark • Deep Work & Builder</b>",
        );
        expect(capturedPayload.text).toContain("🔥 <b>Streak:</b> 5 Days Active");
        expect(capturedPayload.text).toContain("🎯 <b>Today's Action Ritual:</b>");
        expect(capturedPayload.text).toContain("Write 200 lines of clean code");
        expect(capturedPayload.text).toContain("<i>“Simplicity is the soul of efficiency.”</i>");
        expect(capturedPayload.text).toContain("• Silence Slack");

        // Verify action button links with action token signatures
        expect(capturedPayload.reply_markup.inline_keyboard).toHaveLength(1);
        const [routineBtn, checkinBtn] = capturedPayload.reply_markup.inline_keyboard[0];
        expect(routineBtn.text).toBe("⚡ Open Live Routine");
        expect(routineBtn.url).toContain("/routine?email=telegram.user%40example.com&token=");
        expect(checkinBtn.text).toBe("🔥 1-Click Check-in");
        expect(checkinBtn.url).toContain("/checkin?email=telegram.user%40example.com&token=");
      });

      test("rejects missing chatId or missing botToken with clear error message", async () => {
        const noChat = await channelDispatcher.sendTelegramNotification({
          chatId: null,
          botToken: "token123",
        });
        expect(noChat.success).toBe(false);
        expect(noChat.error).toContain("Missing or invalid Telegram Chat ID");

        const noToken = await channelDispatcher.sendTelegramNotification({
          chatId: "123456",
          botToken: "",
        });
        expect(noToken.success).toBe(false);
        expect(noToken.error).toContain("Telegram Bot Token not configured");
      });
    });

    describe("sendDiscordNotification - Embed Payload Construction", () => {
      test("constructs valid Discord Webhook embed with persona track color", async () => {
        let capturedPayload;
        global.fetch = jest.fn().mockImplementation((_, options) => {
          capturedPayload = JSON.parse(options.body);
          return Promise.resolve({
            ok: true,
            status: 204,
            text: async () => "",
          });
        });

        const subscriber = { email: "discord.builder@example.com", routineTrack: "mindfulness" };
        const trackContent = {
          track: "mindfulness",
          name: "Mindfulness & Zen",
          ritual: "10-minute box breathing",
          checklist: ["Drink cold water", "Box breathing", "Gratitude journaling"],
        };

        const result = await channelDispatcher.sendDiscordNotification({
          webhookUrl: "https://discord.com/api/webhooks/123/testToken",
          subscriber,
          trackContent,
          streakCount: 9,
          quote: "Peace comes from within.",
        });

        expect(result.success).toBe(true);
        expect(result.channel).toBe("discord");

        expect(capturedPayload.username).toBe("Morning Routine Sender");
        expect(capturedPayload.embeds).toHaveLength(1);
        const embed = capturedPayload.embeds[0];
        expect(embed.title).toBe("🌅 Morning Routine Spark • Mindfulness & Zen");
        expect(embed.color).toBe(0x10b981); // Emerald for mindfulness

        const fieldMap = Object.fromEntries(embed.fields.map((f) => [f.name, f.value]));
        expect(fieldMap["🔥 Habit Streak"]).toBe("**9 Days Active**");
        expect(fieldMap["⚡ Persona Track"]).toBe("`Mindfulness & Zen`");
        expect(fieldMap["🎯 Today's Action Ritual"]).toBe("10-minute box breathing");
        expect(fieldMap["💬 Daily Wisdom"]).toContain("“Peace comes from within.”");
        expect(fieldMap["📋 Launch Checklist"]).toContain("• Gratitude journaling");
      });

      test("rejects missing or invalid Discord Webhook URL", async () => {
        const result = await channelDispatcher.sendDiscordNotification({
          webhookUrl: "",
        });
        expect(result.success).toBe(false);
        expect(result.error).toContain("Missing or invalid Discord Webhook URL");
      });
    });

    describe("Multi-Channel Error Isolation & Failover (Promise.allSettled)", () => {
      test("failure on Discord does not block or fail Telegram dispatch", async () => {
        // Discord fails with 500, Telegram succeeds
        global.fetch = jest.fn().mockImplementation((url) => {
          if (url.includes("discord.com")) {
            return Promise.resolve({
              ok: false,
              status: 500,
              text: async () => "Internal Discord Webhook Error",
            });
          }
          if (url.includes("api.telegram.org")) {
            return Promise.resolve({
              ok: true,
              status: 200,
              json: async () => ({ ok: true, result: { message_id: 77712 } }),
            });
          }
          return Promise.reject(new Error("Unknown destination"));
        });

        const subscriber = {
          email: "failover.tester@example.com",
          channelsEnabled: "email,discord,telegram",
          discordWebhookUrl: "https://discord.com/api/webhooks/123/deadHook",
          telegramChatId: "987654321",
          streakCount: 14,
          routineTrack: "executive",
        };

        const dispatchResult = await channelDispatcher.dispatchChannelsForSubscriber(subscriber, {
          botToken: "telegram_valid_token",
        });

        expect(dispatchResult.dispatched).toBe(2);
        expect(dispatchResult.results).toHaveLength(2);

        const discordRes = dispatchResult.results.find((r) => r.channel === "discord");
        const telegramRes = dispatchResult.results.find((r) => r.channel === "telegram");

        expect(discordRes.success).toBe(false);
        expect(discordRes.status).toBe(500);

        expect(telegramRes.success).toBe(true);
        expect(telegramRes.messageId).toBe(77712);
      });

      test("returns { dispatched: 0 } cleanly when only email is enabled", async () => {
        const subscriber = {
          email: "email.only@example.com",
          channelsEnabled: "email",
        };

        const res = await channelDispatcher.dispatchChannelsForSubscriber(subscriber);
        expect(res.dispatched).toBe(0);
        expect(res.results).toEqual([]);
      });
    });
  });

  // =========================================================================
  // SECTION 3: Subscriber Growth & Analytics Controller
  // =========================================================================
  describe("3. Subscriber Growth & Analytics Controller", () => {
    let knex;
    let getSubscriberStats;

    beforeEach(async () => {
      const mem = newDb();

      // Register standard Postgres DATE() function in pg-mem
      mem.public.registerFunction({
        name: "date",
        args: ["timestamptz"],
        returns: "date",
        implementation: (ts) => new Date(ts).toISOString().slice(0, 10),
      });

      knex = mem.adapters.createKnex(0);
      await migrationSubscribers.up(knex);
      await migrationStreaks.up(knex);
      await migrationChannels.up(knex);
      await migrationWebhooks.up(knex);

      jest.resetModules();
      jest.doMock("../db/knex", () => knex);
      getSubscriberStats = require("../controllers/subscriberStats.controller").getSubscriberStats;
    });

    afterEach(async () => {
      await knex.destroy();
      jest.dontMock("../db/knex");
    });

    describe("Time Window & Date Range Clamping", () => {
      test("defaults to 30 days when query parameter is omitted", async () => {
        const { req, res } = mockReqRes();
        await getSubscriberStats(req, res);

        expect(res._status).toBe(200);
        expect(res._json.windowDays).toBe(30);
      });

      test("clamps days between 1 and 365", async () => {
        const { req: reqLow, res: resLow } = mockReqRes({ days: "0" });
        await getSubscriberStats(reqLow, resLow);
        expect(resLow._json.windowDays).toBe(1);

        const { req: reqHigh, res: resHigh } = mockReqRes({ days: "5000" });
        await getSubscriberStats(reqHigh, resHigh);
        expect(resHigh._json.windowDays).toBe(365);
      });
    });

    describe("Active vs. Inactive Ratios and Total Counts", () => {
      test("calculates active, paused, and total correctly", async () => {
        await knex("subscribers").insert([
          { email: "sub1@example.com", cron_pattern: "0 8 * * *", is_active: true },
          { email: "sub2@example.com", cron_pattern: "0 8 * * *", is_active: true },
          { email: "sub3@example.com", cron_pattern: "0 8 * * *", is_active: true },
          { email: "sub4@example.com", cron_pattern: "0 8 * * *", is_active: false },
          { email: "sub5@example.com", cron_pattern: "0 8 * * *", is_active: false },
        ]);

        const { req, res } = mockReqRes({ days: "7" });
        await getSubscriberStats(req, res);

        expect(res._json.total).toBe(5);
        expect(res._json.active).toBe(3);
        expect(res._json.paused).toBe(2);
        expect(res._json.windowDays).toBe(7);
      });
    });

    describe("7-Day vs 30-Day Growth Aggregation", () => {
      test("groups signups by calendar date within requested window", async () => {
        const now = new Date();
        const dateToday = now.toISOString().slice(0, 10);
        const dateYesterday = new Date(now.getTime() - 86400000).toISOString().slice(0, 10);

        await knex("subscribers").insert([
          {
            email: "user.today.1@example.com",
            cron_pattern: "0 8 * * *",
            created_at: `${dateToday} 06:30:00`,
            is_active: true,
          },
          {
            email: "user.today.2@example.com",
            cron_pattern: "0 8 * * *",
            created_at: `${dateToday} 08:45:00`,
            is_active: true,
          },
          {
            email: "user.yesterday@example.com",
            cron_pattern: "0 8 * * *",
            created_at: `${dateYesterday} 12:00:00`,
            is_active: true,
          },
        ]);

        const { req, res } = mockReqRes({ days: "7" });
        await getSubscriberStats(req, res);

        expect(res._json.growth).toEqual(
          expect.arrayContaining([
            { date: dateYesterday, count: 1 },
            { date: dateToday, count: 2 },
          ]),
        );
      });
    });

    describe("Database Failure Error Handling", () => {
      test("responds with HTTP 500 when database throws an error", async () => {
        // Force table drop to simulate DB error
        await knex.schema.dropTable("subscribers");

        const { req, res } = mockReqRes();
        await getSubscriberStats(req, res);

        expect(res._status).toBe(500);
        expect(res._json).toEqual({ error: "Failed to load subscriber stats" });
      });
    });
  });
});
