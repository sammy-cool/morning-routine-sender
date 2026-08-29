process.env.USE_MOCK_REDIS = "true";

const mockSubscriberEmail = "channel.tester@example.com";

jest.mock("../middleware/subscriberSession", () => ({
  requireSubscriberSession: (req, _res, next) => {
    req.subscriberEmail = mockSubscriberEmail;
    req.subscriberSession = { email: mockSubscriberEmail };
    next();
  },
}));

const channelDispatcher = require("../helper/channelDispatcher");
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const subscriberPortalRoutes = require("../routes/subscriberPortal.routes");
const sharedData = require("../helper/shared-data");

describe("Multi-Channel Notification Dispatcher Engine (Discord & Telegram)", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser("test-secret"));
    app.locals = { officialDomain: "https://test.morningroutine.com" };
    app.use(subscriberPortalRoutes);
  });

  describe("Channel Preference Parsing", () => {
    it("should default to ['email'] when channels are empty or undefined", () => {
      expect(channelDispatcher.parseEnabledChannels(null)).toEqual(["email"]);
      expect(channelDispatcher.parseEnabledChannels(undefined)).toEqual(["email"]);
      expect(channelDispatcher.parseEnabledChannels("")).toEqual(["email"]);
    });

    it("should parse comma-separated strings and arrays cleanly", () => {
      expect(channelDispatcher.parseEnabledChannels("email,discord")).toEqual(["email", "discord"]);
      expect(channelDispatcher.parseEnabledChannels(["Email", "Telegram "])).toEqual([
        "email",
        "telegram",
      ]);
    });
  });

  describe("Discord Webhook Dispatcher", () => {
    it("should reject missing or invalid Discord Webhook URL", async () => {
      const res = await channelDispatcher.sendDiscordNotification({
        webhookUrl: null,
        subscriber: { email: mockSubscriberEmail },
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Missing or invalid Discord Webhook URL");
    });
  });

  describe("Telegram Bot Dispatcher", () => {
    it("should reject missing Chat ID or missing bot token", async () => {
      const res = await channelDispatcher.sendTelegramNotification({
        chatId: null,
        botToken: "dummy-token",
        subscriber: { email: mockSubscriberEmail },
      });
      expect(res.success).toBe(false);
      expect(res.error).toContain("Missing or invalid Telegram Chat ID");

      const noTokenRes = await channelDispatcher.sendTelegramNotification({
        chatId: "12345678",
        botToken: null,
        subscriber: { email: mockSubscriberEmail },
      });
      expect(noTokenRes.success).toBe(false);
      expect(noTokenRes.error).toContain("Telegram Bot Token not configured");
    });
  });

  describe("Multi-Channel Subscriber API Endpoints", () => {
    it("POST /me/channels should reject invalid Discord URL format", async () => {
      const res = await request(app)
        .post("/me/channels")
        .send({ discordWebhookUrl: "https://malicious.com/not-discord" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid Discord Webhook URL");
    });

    it("POST /me/channels should reject non-numeric Telegram Chat ID", async () => {
      const res = await request(app)
        .post("/me/channels")
        .send({ telegramChatId: "invalid-username-chat" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid Telegram Chat ID");
    });

    it("POST /me/channels should save valid discord & telegram channels", async () => {
      jest.spyOn(sharedData, "updateUser").mockResolvedValue(true);
      jest.spyOn(sharedData, "getUserByEmail").mockResolvedValue({
        email: mockSubscriberEmail,
        discordWebhookUrl: "https://discord.com/api/webhooks/123456789/testToken",
        telegramChatId: "987654321",
        channelsEnabled: "email,discord,telegram",
      });

      const res = await request(app)
        .post("/me/channels")
        .send({
          discordWebhookUrl: "https://discord.com/api/webhooks/123456789/testToken",
          telegramChatId: "987654321",
          channelsEnabled: ["email", "discord", "telegram"],
        });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.subscriber.telegramChatId).toBe("987654321");
    });

    it("POST /api/channels/test should validate required channel parameter", async () => {
      const res = await request(app).post("/api/channels/test").send({ channel: "sms" });

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Channel must be 'discord' or 'telegram'");
    });
  });
});
