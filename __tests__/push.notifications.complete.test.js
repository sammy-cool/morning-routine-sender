/**
 * __tests__/push.notifications.complete.test.js
 *
 * Comprehensive Test Suite for Web Push Notification Core & Routes:
 * 1. push-core/pushService.js:
 *    - VAPID initialization & key validation (configured, unconfigured, exceptions)
 *    - Routine push payload formatting & track metadata (deep-work, mindfulness, executive, learning)
 *    - Streak badge formatting (0 streak, positive streak, string/numeric casting)
 *    - Subscription registration & idempotent upsert on endpoint conflict
 *    - Expiration time parsing & user agent persistence
 *    - Subscriber session resolution & anonymous/unlinked registration fallback
 *    - Push notification dispatch & WebPush protocol responses (201 Created)
 *    - Automatic pruning/cleanup on 410 Gone and 404 Not Found
 *    - Transient error handling & retry tracking for 429 Rate Limit, 500 Server Error, 503 Service Unavailable
 *    - Endpoint deactivation via unsubscribeEndpoint
 *    - Multi-device morning dispatch (Promise.all, active vs inactive filtering)
 * 2. controllers/push.controller.js & routes/push.routes.js:
 *    - GET /api/push/vapid-public-key (503 when unconfigured, 200 with cache headers when set)
 *    - POST /api/push/subscribe (401 unauthenticated, 400 invalid body, 201 created, idempotent upsert)
 *    - POST /api/push/unsubscribe (401 unauthenticated, 400 missing endpoint, 200 success)
 *    - POST /api/push/send-test & POST /api/push/test (401 unauthenticated, 404 missing user, 400 no devices, 200 dispatched)
 *    - Full end-to-end device lifecycle flow
 */

"use strict";

const express = require("express");
const cookieParser = require("cookie-parser");
const request = require("supertest");
const { newDb } = require("pg-mem");

// ---------------------------------------------------------------------------
// 1. In-Memory Database & Knex Setup
// ---------------------------------------------------------------------------
let memDb;
let mockKnexInstance;

jest.mock("../db/knex", () => {
  const handler = (table) => mockKnexInstance(table);
  handler.schema = {
    hasTable: (...args) => mockKnexInstance.schema.hasTable(...args),
  };
  handler.fn = {
    now: () => (mockKnexInstance ? mockKnexInstance.fn.now() : new Date().toISOString()),
  };
  handler.raw = (...args) => mockKnexInstance.raw(...args);
  handler.destroy = jest.fn().mockResolvedValue();
  return handler;
});

// ---------------------------------------------------------------------------
// 2. Mock Logger
// ---------------------------------------------------------------------------
jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

// ---------------------------------------------------------------------------
// 3. Mock Web-Push
// ---------------------------------------------------------------------------
jest.mock("web-push", () => ({
  setVapidDetails: jest.fn(),
  sendNotification: jest.fn().mockResolvedValue({ statusCode: 201, headers: {}, body: "" }),
  generateVAPIDKeys: jest.fn(() => ({
    publicKey: "MOCK_VAPID_PUBLIC_KEY_65_CHARS_BASE64_URL_SAFE",
    privateKey: "MOCK_VAPID_PRIVATE_KEY_32_CHARS_BASE64_URL_SAFE",
  })),
}));

// ---------------------------------------------------------------------------
// 4. Mock Redis Client for Subscriber Sessions
// ---------------------------------------------------------------------------
const mockRedisSessions = new Map();
jest.mock("../config/redisClient", () => ({
  get: jest.fn(async (key) => mockRedisSessions.get(key) || null),
  set: jest.fn(async (key, val) => {
    mockRedisSessions.set(key, val);
    return "OK";
  }),
  del: jest.fn(async (key) => {
    const existed = mockRedisSessions.delete(key);
    return existed ? 1 : 0;
  }),
  quit: jest.fn().mockResolvedValue("OK"),
}));

// ---------------------------------------------------------------------------
// 5. Deterministic Mock for Shared Data
// ---------------------------------------------------------------------------
const mockUserData = new Map();
jest.mock("../helper/shared-data", () => ({
  getTrackContent: jest.fn((track = "deep-work") => {
    const tracks = {
      "deep-work": {
        track: "deep-work",
        name: "Deep Work & Builder",
        badge: "⚡ Deep Work & Builder",
        tagline: "High-focus engineering rituals & distraction-free flow states",
        ritual: "Select your #1 most critical architecture deliverable.",
      },
      mindfulness: {
        track: "mindfulness",
        name: "Mindfulness & Stoic",
        badge: "🧘 Mindfulness & Stoic",
        tagline: "Mental clarity, breathwork & emotional resilience",
        ritual: "Practice 4-7-8 Box Breathing for 3 minutes.",
      },
      executive: {
        track: "executive",
        name: "High-Performance Executive",
        badge: "💼 High-Performance Executive",
        tagline: "Strategic leverage, energy management & decisive execution",
        ritual: "Define your 3 Non-Negotiable High-Leverage Outcomes.",
      },
      learning: {
        track: "learning",
        name: "Lifelong Learner",
        badge: "📚 Lifelong Learner",
        tagline: "Mental models, active recall & rapid knowledge synthesis",
        ritual: "Active Recall: Teach yesterday's concept out loud.",
      },
    };
    return tracks[track] || tracks["deep-work"];
  }),
  getUserByEmail: jest.fn(async (email) => {
    if (!email) return null;
    return mockUserData.get(email.toLowerCase().trim()) || null;
  }),
}));

const webpush = require("web-push");
const db = require("../db/knex");
const sharedData = require("../helper/shared-data");
const pushService = require("../push-core/pushService");
const pushController = require("../controllers/push.controller");
const pushRoutes = require("../routes/push.routes");
const { requireSubscriberSession } = require("../middleware/subscriberSession");

// Helper to construct Express Supertest App
function buildSupertestApp() {
  const app = express();
  app.use(express.json());
  app.use(cookieParser("test_secret"));
  app.use(pushRoutes);

  // Mount test alias route for POST /api/push/test as well
  app.post("/api/push/test", requireSubscriberSession, pushController.sendTestPush);

  return app;
}

// Sample subscription fixture
function createSampleSubscription(endpointId = "device-alpha") {
  return {
    endpoint: `https://fcm.googleapis.com/fcm/send/${endpointId}`,
    expirationTime: "2026-12-31T23:59:59.000Z",
    keys: {
      p256dh: `mock_p256dh_key_${endpointId}`,
      auth: `mock_auth_secret_${endpointId}`,
    },
  };
}

describe("Web Push Notification Core & Routes Comprehensive Test Suite", () => {
  let app;

  beforeEach(async () => {
    jest.clearAllMocks();
    webpush.setVapidDetails.mockImplementation(() => {});
    mockRedisSessions.clear();
    mockUserData.clear();
    process.env.VAPID_PUBLIC_KEY = "mock_vapid_public_key_for_tests";
    process.env.VAPID_PRIVATE_KEY = "mock_vapid_private_key_for_tests";
    process.env.VAPID_SUBJECT = "mailto:admin@morningroutinesender.com";

    // Re-initialize fresh pg-mem in-memory postgres
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex();

    // Setup schema
    await mockKnexInstance.schema.createTable("subscribers", (table) => {
      table.increments("id").primary();
      table.string("email", 255).notNullable().unique();
      table.string("routineTrack", 50).nullable();
      table.integer("streakCount").defaultTo(0);
    });

    await mockKnexInstance.schema.createTable("push_subscriptions", (table) => {
      table.increments("id").primary();
      table.integer("subscriber_id").nullable();
      table.string("subscriber_email", 255).notNullable();
      table.text("endpoint").notNullable().unique();
      table.string("p256dh", 255).notNullable();
      table.string("auth", 255).notNullable();
      table.timestamp("expiration_time").nullable();
      table.text("user_agent").nullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.integer("failed_attempts").notNullable().defaultTo(0);
      table.integer("last_error_status").nullable();
      table.timestamp("last_pushed_at").nullable();
      table.timestamp("created_at").defaultTo(mockKnexInstance.fn.now());
      table.timestamp("updated_at").defaultTo(mockKnexInstance.fn.now());
    });

    app = buildSupertestApp();
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
  });

  // =========================================================================
  // Section 1: pushService.js - VAPID Keys Initialization
  // =========================================================================
  describe("push-core/pushService.js - VAPID Configuration", () => {
    let origEnv;

    beforeEach(() => {
      origEnv = { ...process.env };
    });

    afterEach(() => {
      process.env = { ...origEnv };
    });

    test("isConfigured is true when VAPID keys are present during module initialization", () => {
      let serviceInstance;
      process.env.VAPID_PUBLIC_KEY = "test_public_key";
      process.env.VAPID_PRIVATE_KEY = "test_private_key";
      process.env.VAPID_SUBJECT = "mailto:ops@morningroutine.test";

      jest.isolateModules(() => {
        serviceInstance = require("../push-core/pushService");
      });

      expect(serviceInstance.isConfigured).toBe(true);
      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        "mailto:ops@morningroutine.test",
        "test_public_key",
        "test_private_key",
      );
    });

    test("falls back to default subject mailto:admin@morningroutinesender.com when VAPID_SUBJECT is missing", () => {
      delete process.env.VAPID_SUBJECT;
      process.env.VAPID_PUBLIC_KEY = "test_public_key";
      process.env.VAPID_PRIVATE_KEY = "test_private_key";

      jest.isolateModules(() => {
        const serviceInstance = require("../push-core/pushService");
        expect(serviceInstance.isConfigured).toBe(true);
      });

      expect(webpush.setVapidDetails).toHaveBeenCalledWith(
        "mailto:admin@morningroutinesender.com",
        "test_public_key",
        "test_private_key",
      );
    });

    test("isConfigured is false if VAPID_PUBLIC_KEY is missing", () => {
      let serviceInstance;
      delete process.env.VAPID_PUBLIC_KEY;
      process.env.VAPID_PRIVATE_KEY = "test_private_key";

      jest.isolateModules(() => {
        serviceInstance = require("../push-core/pushService");
      });

      expect(serviceInstance.isConfigured).toBe(false);
    });

    test("isConfigured is false if VAPID_PRIVATE_KEY is missing", () => {
      let serviceInstance;
      process.env.VAPID_PUBLIC_KEY = "test_public_key";
      delete process.env.VAPID_PRIVATE_KEY;

      jest.isolateModules(() => {
        serviceInstance = require("../push-core/pushService");
      });

      expect(serviceInstance.isConfigured).toBe(false);
    });

    test("isConfigured is false if webpush.setVapidDetails throws an exception", () => {
      process.env.VAPID_PUBLIC_KEY = "bad_key";
      process.env.VAPID_PRIVATE_KEY = "bad_key";

      jest.isolateModules(() => {
        const isolatedWebpush = require("web-push");
        isolatedWebpush.setVapidDetails.mockImplementation(() => {
          throw new Error("Invalid ASN.1 encoding for private key");
        });
        const serviceInstance = require("../push-core/pushService");
        expect(serviceInstance.isConfigured).toBe(false);
      });
    });
  });

  // =========================================================================
  // Section 2: pushService.js - Payload Formatting
  // =========================================================================
  describe("push-core/pushService.js - buildRoutinePushPayload", () => {
    test("builds payload for Deep Work track with 0 streak (no streak badge in title)", () => {
      const subscriber = { routineTrack: "deep-work", streakCount: 0 };
      const payload = pushService.buildRoutinePushPayload(subscriber);

      expect(payload.title).toBe("🌅 Deep Work & Builder");
      expect(payload.body).toContain("Select your #1 most critical architecture deliverable.");
      expect(payload.body).toContain("Click to start today's focus timer!");
      expect(payload.tag).toBe("morning-routine-deep-work");
      expect(payload.icon).toBe("/assets/mrn-brand-ico.png");
      expect(payload.badge).toBe("/assets/mrn-brand-ico.png");
      expect(payload.renotify).toBe(true);
      expect(payload.requireInteraction).toBe(true);
      expect(payload.data.track).toBe("deep-work");
      expect(payload.data.streak).toBe(0);
      expect(payload.data.url).toBe("/routine");
      expect(payload.data.dashboardUrl).toBe("/user-dashboard");
      expect(typeof payload.data.timestamp).toBe("number");
      expect(payload.actions).toEqual([
        { action: "open_routine", title: "⚡ Start Ritual" },
        { action: "checkin", title: "🔥 Check-in" },
        { action: "open_dashboard", title: "👤 Dashboard" },
      ]);
    });

    test("includes fire badge in title when streakCount is greater than 0", () => {
      const subscriber = { routineTrack: "mindfulness", streakCount: 14 };
      const payload = pushService.buildRoutinePushPayload(subscriber);

      expect(payload.title).toBe("🌅 Mindfulness & Stoic 🔥 14d streak");
      expect(payload.body).toContain("Practice 4-7-8 Box Breathing");
      expect(payload.tag).toBe("morning-routine-mindfulness");
      expect(payload.data.streak).toBe(14);
    });

    test("falls back to templateType when routineTrack is absent", () => {
      const subscriber = { templateType: "executive", streakCount: 5 };
      const payload = pushService.buildRoutinePushPayload(subscriber);

      expect(payload.title).toBe("🌅 High-Performance Executive 🔥 5d streak");
      expect(payload.tag).toBe("morning-routine-executive");
      expect(payload.data.track).toBe("executive");
    });

    test("falls back to deep-work when both routineTrack and templateType are missing", () => {
      const subscriber = { streakCount: "3" };
      const payload = pushService.buildRoutinePushPayload(subscriber);

      expect(payload.title).toBe("🌅 Deep Work & Builder 🔥 3d streak");
      expect(payload.tag).toBe("morning-routine-deep-work");
      expect(payload.data.track).toBe("deep-work");
      expect(payload.data.streak).toBe(3);
    });

    test("handles NaN, null, or undefined streak values gracefully as 0", () => {
      const subscriber = { routineTrack: "learning", streakCount: "invalid-number" };
      const payload = pushService.buildRoutinePushPayload(subscriber);

      expect(payload.title).toBe("🌅 Lifelong Learner");
      expect(payload.data.streak).toBe(0);
    });
  });

  // =========================================================================
  // Section 3: pushService.js - registerSubscription
  // =========================================================================
  describe("push-core/pushService.js - registerSubscription", () => {
    test("rejects invalid subscriberEmail parameter", async () => {
      const sub = createSampleSubscription();
      await expect(pushService.registerSubscription("", sub)).rejects.toThrow(
        "Valid subscriber email is required for push registration",
      );
      await expect(pushService.registerSubscription(null, sub)).rejects.toThrow(
        "Valid subscriber email is required for push registration",
      );
      await expect(pushService.registerSubscription(12345, sub)).rejects.toThrow(
        "Valid subscriber email is required for push registration",
      );
    });

    test("rejects missing subscription object or missing endpoint", async () => {
      await expect(pushService.registerSubscription("user@example.com", null)).rejects.toThrow(
        "Invalid push subscription object",
      );

      await expect(
        pushService.registerSubscription("user@example.com", { keys: { p256dh: "a", auth: "b" } }),
      ).rejects.toThrow("Invalid push subscription object");
    });

    test("rejects subscription with missing p256dh or auth keys", async () => {
      await expect(
        pushService.registerSubscription("user@example.com", {
          endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
          keys: { p256dh: "key-only" },
        }),
      ).rejects.toThrow("Missing p256dh or auth subscription keys");

      await expect(
        pushService.registerSubscription("user@example.com", {
          endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
          keys: { auth: "auth-only" },
        }),
      ).rejects.toThrow("Missing p256dh or auth subscription keys");
    });

    test("registers subscription linked to existing subscriber ID", async () => {
      await db("subscribers").insert({
        id: 77,
        email: "member@example.com",
        routineTrack: "deep-work",
      });

      const sub = createSampleSubscription("browser-device-1");
      const result = await pushService.registerSubscription(
        "  MEMBER@Example.com  ",
        sub,
        "Chrome/128.0",
      );

      expect(result).toEqual({ success: true });

      const record = await db("push_subscriptions").where("endpoint", sub.endpoint).first();

      expect(record).toBeDefined();
      expect(record.subscriber_id).toBe(77);
      expect(record.subscriber_email).toBe("member@example.com");
      expect(record.p256dh).toBe(sub.keys.p256dh);
      expect(record.auth).toBe(sub.keys.auth);
      expect(record.user_agent).toBe("Chrome/128.0");
      expect(record.is_active).toBe(true);
      expect(record.failed_attempts).toBe(0);
      expect(record.last_error_status).toBeNull();
      expect(record.expiration_time).toBeDefined();
    });

    test("registers subscription when subscriber does not exist in subscribers table (subscriber_id remains null)", async () => {
      const sub = createSampleSubscription("unregistered-device-1");
      const result = await pushService.registerSubscription("anonymous@example.com", sub);

      expect(result).toEqual({ success: true });

      const record = await db("push_subscriptions").where("endpoint", sub.endpoint).first();

      expect(record).toBeDefined();
      expect(record.subscriber_id).toBeNull();
      expect(record.subscriber_email).toBe("anonymous@example.com");
      expect(record.user_agent).toBeNull();
      expect(record.is_active).toBe(true);
    });

    test("handles expirationTime as null cleanly", async () => {
      const sub = {
        endpoint: "https://fcm.googleapis.com/fcm/send/no-exp",
        expirationTime: null,
        keys: { p256dh: "key_p256dh", auth: "key_auth" },
      };

      await pushService.registerSubscription("user@example.com", sub);
      const record = await db("push_subscriptions").where("endpoint", sub.endpoint).first();
      expect(record.expiration_time).toBeNull();
    });

    test("upsert is idempotent: re-registering an endpoint updates keys and reactivates dead subscription", async () => {
      const sub = createSampleSubscription("reused-endpoint");

      // Initial registration
      await pushService.registerSubscription("user1@example.com", sub, "Firefox/115");

      // Simulate record getting disabled after delivery failure
      await db("push_subscriptions").where("endpoint", sub.endpoint).update({
        is_active: false,
        failed_attempts: 5,
        last_error_status: 410,
      });

      // User returns on device, updates subscription
      const updatedSub = {
        endpoint: sub.endpoint,
        keys: {
          p256dh: "fresh_p256dh_key",
          auth: "fresh_auth_key",
        },
      };

      await pushService.registerSubscription("user2@example.com", updatedSub, "Firefox/120");

      const allRecords = await db("push_subscriptions").where("endpoint", sub.endpoint);
      expect(allRecords).toHaveLength(1);

      const record = allRecords[0];
      expect(record.subscriber_email).toBe("user2@example.com");
      expect(record.p256dh).toBe("fresh_p256dh_key");
      expect(record.auth).toBe("fresh_auth_key");
      expect(record.user_agent).toBe("Firefox/120");
      expect(record.is_active).toBe(true);
      expect(record.failed_attempts).toBe(0);
      expect(record.last_error_status).toBeNull();
    });
  });

  // =========================================================================
  // Section 4: pushService.js - unsubscribeEndpoint
  // =========================================================================
  describe("push-core/pushService.js - unsubscribeEndpoint", () => {
    test("sets is_active to false and returns true for existing endpoint", async () => {
      const sub = createSampleSubscription("device-to-unsub");
      await pushService.registerSubscription("user@example.com", sub);

      const result = await pushService.unsubscribeEndpoint(sub.endpoint);
      expect(result).toBe(true);

      const record = await db("push_subscriptions").where("endpoint", sub.endpoint).first();
      expect(record.is_active).toBe(false);
    });

    test("returns false when unsubscribing non-existent endpoint", async () => {
      const result = await pushService.unsubscribeEndpoint("https://nonexistent.push/endpoint");
      expect(result).toBe(false);
    });
  });

  // =========================================================================
  // Section 5: pushService.js - sendToSubscriptionRecord Status & Error Handling
  // =========================================================================
  describe("push-core/pushService.js - sendToSubscriptionRecord", () => {
    let subRecord;
    const testPayload = { title: "Test Alert", body: "Wake up and conquer" };

    beforeEach(async () => {
      const sub = createSampleSubscription("delivery-test-device");
      await pushService.registerSubscription("push-target@example.com", sub);
      subRecord = await db("push_subscriptions").where("endpoint", sub.endpoint).first();
    });

    test("handles successful push delivery (HTTP 201 Created)", async () => {
      webpush.sendNotification.mockResolvedValueOnce({ statusCode: 201 });

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result).toEqual({ status: "sent", id: subRecord.id });
      expect(webpush.sendNotification).toHaveBeenCalledWith(
        {
          endpoint: subRecord.endpoint,
          keys: { p256dh: subRecord.p256dh, auth: subRecord.auth },
        },
        JSON.stringify(testPayload),
        { TTL: 86400, urgency: "high" },
      );

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.last_pushed_at).toBeDefined();
      expect(updated.failed_attempts).toBe(0);
      expect(updated.last_error_status).toBeNull();
    });

    test("handles subscription expired (410 Gone) by pruning/deactivating endpoint", async () => {
      const error410 = new Error("Subscription expired");
      error410.statusCode = 410;
      webpush.sendNotification.mockRejectedValueOnce(error410);

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result).toEqual({ status: "pruned", statusCode: 410, id: subRecord.id });

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.is_active).toBe(false);
      expect(updated.last_error_status).toBe(410);
    });

    test("handles subscription invalid (404 Not Found) by pruning/deactivating endpoint", async () => {
      const error404 = new Error("Endpoint not found on push service");
      error404.statusCode = 404;
      webpush.sendNotification.mockRejectedValueOnce(error404);

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result).toEqual({ status: "pruned", statusCode: 404, id: subRecord.id });

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.is_active).toBe(false);
      expect(updated.last_error_status).toBe(404);
    });

    test("handles rate limiting (429 Too Many Requests) with retry increment and leaves active", async () => {
      const error429 = new Error("Push service rate limit exceeded");
      error429.statusCode = 429;
      webpush.sendNotification.mockRejectedValueOnce(error429);

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result).toEqual({
        status: "failed",
        statusCode: 429,
        error: "Push service rate limit exceeded",
        id: subRecord.id,
      });

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.is_active).toBe(true);
      expect(updated.failed_attempts).toBe(1);
      expect(updated.last_error_status).toBe(429);
    });

    test("handles transient 500 Internal Server Error with retry increment", async () => {
      const error500 = new Error("Internal push gateway fault");
      error500.statusCode = 500;
      webpush.sendNotification.mockRejectedValueOnce(error500);

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result.status).toBe("failed");
      expect(result.statusCode).toBe(500);

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.is_active).toBe(true);
      expect(updated.failed_attempts).toBe(1);
      expect(updated.last_error_status).toBe(500);
    });

    test("handles transient 503 Service Unavailable with retry increment", async () => {
      const error503 = new Error("Service Temporarily Unavailable");
      error503.statusCode = 503;
      webpush.sendNotification.mockRejectedValueOnce(error503);

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result.status).toBe("failed");
      expect(result.statusCode).toBe(503);

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.is_active).toBe(true);
      expect(updated.failed_attempts).toBe(1);
      expect(updated.last_error_status).toBe(503);
    });

    test("falls back to 500 status when error lacks statusCode but contains endpoint property", async () => {
      const errorNoStatus = new Error("Connection reset by peer");
      errorNoStatus.endpoint = subRecord.endpoint;
      webpush.sendNotification.mockRejectedValueOnce(errorNoStatus);

      const result = await pushService.sendToSubscriptionRecord(subRecord, testPayload);

      expect(result.status).toBe("failed");
      expect(result.statusCode).toBe(500);

      const updated = await db("push_subscriptions").where("id", subRecord.id).first();
      expect(updated.failed_attempts).toBe(1);
      expect(updated.last_error_status).toBe(500);
    });
  });

  // =========================================================================
  // Section 6: pushService.js - dispatchMorningPushForSubscriber
  // =========================================================================
  describe("push-core/pushService.js - dispatchMorningPushForSubscriber", () => {
    test("skips dispatch if VAPID keys are unconfigured", async () => {
      let unconfiguredService;
      const origPub = process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PUBLIC_KEY;

      jest.isolateModules(() => {
        unconfiguredService = require("../push-core/pushService");
      });

      const result = await unconfiguredService.dispatchMorningPushForSubscriber({
        email: "test@example.com",
      });

      expect(result).toEqual({ status: "skipped", reason: "vapid_not_configured" });
      process.env.VAPID_PUBLIC_KEY = origPub;
    });

    test("skips dispatch if subscriber has no active push subscriptions in DB", async () => {
      const result = await pushService.dispatchMorningPushForSubscriber({
        email: "nosub@example.com",
        routineTrack: "deep-work",
      });

      expect(result).toEqual({ status: "skipped", reason: "no_active_push_subscriptions" });
    });

    test("dispatches to all active devices for a subscriber concurrently", async () => {
      const email = "multidevice@example.com";
      const sub1 = createSampleSubscription("phone-device");
      const sub2 = createSampleSubscription("laptop-device");

      await pushService.registerSubscription(email, sub1, "Mobile Safari");
      await pushService.registerSubscription(email, sub2, "Chrome Desktop");

      webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      const result = await pushService.dispatchMorningPushForSubscriber({
        email,
        routineTrack: "executive",
        streakCount: 8,
      });

      expect(result.status).toBe("dispatched");
      expect(result.count).toBe(2);
      expect(result.results).toHaveLength(2);
      expect(result.results[0].status).toBe("sent");
      expect(result.results[1].status).toBe("sent");
      expect(webpush.sendNotification).toHaveBeenCalledTimes(2);
    });

    test("ignores deactivated/pruned subscriptions for the subscriber", async () => {
      const email = "partiallyactive@example.com";
      const sub1 = createSampleSubscription("active-device");
      const sub2 = createSampleSubscription("dead-device");

      await pushService.registerSubscription(email, sub1);
      await pushService.registerSubscription(email, sub2);
      await pushService.unsubscribeEndpoint(sub2.endpoint);

      webpush.sendNotification.mockResolvedValue({ statusCode: 201 });

      const result = await pushService.dispatchMorningPushForSubscriber({
        email,
        routineTrack: "mindfulness",
      });

      expect(result.status).toBe("dispatched");
      expect(result.count).toBe(1);
      expect(webpush.sendNotification).toHaveBeenCalledTimes(1);
    });
  });

  // =========================================================================
  // Section 7: push.controller.js - Unit Tests
  // =========================================================================
  describe("controllers/push.controller.js - Unit Tests", () => {
    test("getVapidPublicKey returns 503 when VAPID_PUBLIC_KEY is not set", () => {
      const origKey = process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PUBLIC_KEY;

      const req = {};
      const res = {
        status: jest.fn().mockReturnThis(),
        json: jest.fn(),
      };

      pushController.getVapidPublicKey(req, res);

      expect(res.status).toHaveBeenCalledWith(503);
      expect(res.json).toHaveBeenCalledWith({
        error: "Web Push not configured on this server.",
      });

      process.env.VAPID_PUBLIC_KEY = origKey;
    });

    test("getVapidPublicKey returns 200 and Cache-Control when key is set", () => {
      process.env.VAPID_PUBLIC_KEY = "mock_public_key_abc123";

      const req = {};
      const res = {
        setHeader: jest.fn(),
        json: jest.fn(),
      };

      pushController.getVapidPublicKey(req, res);

      expect(res.setHeader).toHaveBeenCalledWith("Cache-Control", "public, max-age=86400");
      expect(res.json).toHaveBeenCalledWith({ publicKey: "mock_public_key_abc123" });
    });

    test("subscribe returns 400 on missing or invalid payload", async () => {
      const req = { subscriberEmail: "user@example.com", body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await pushController.subscribe(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Invalid subscription payload." });
    });

    test("unsubscribe returns 400 on missing endpoint", async () => {
      const req = { body: {} };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      await pushController.unsubscribe(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscription endpoint required." });
    });

    test("sendTestPush returns 404 when subscriber is not found via sharedData", async () => {
      const req = { subscriberEmail: "missing@example.com" };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      sharedData.getUserByEmail.mockResolvedValueOnce(null);

      await pushController.sendTestPush(req, res);
      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: "Subscriber not found." });
    });

    test("sendTestPush returns 400 when subscriber has no active push subscriptions in DB", async () => {
      const req = { subscriberEmail: "nodevices@example.com" };
      const res = { status: jest.fn().mockReturnThis(), json: jest.fn() };

      sharedData.getUserByEmail.mockResolvedValueOnce({ email: "nodevices@example.com" });

      await pushController.sendTestPush(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({
        error: "No active push subscriptions found on this account.",
      });
    });
  });

  // =========================================================================
  // Section 8: routes/push.routes.js - HTTP Integration Tests via Supertest
  // =========================================================================
  describe("routes/push.routes.js - Integration Tests", () => {
    const validSessionToken = "session_token_xyz";
    const sessionEmail = "subscriber@example.com";

    beforeEach(() => {
      mockRedisSessions.set(`subscriber_session:${validSessionToken}`, sessionEmail);
      process.env.VAPID_PUBLIC_KEY = "test_vapid_public_key_live";
    });

    describe("GET /api/push/vapid-public-key", () => {
      test("serves public key with Cache-Control header", async () => {
        const res = await request(app).get("/api/push/vapid-public-key");

        expect(res.status).toBe(200);
        expect(res.body.publicKey).toBe("test_vapid_public_key_live");
        expect(res.headers["cache-control"]).toBe("public, max-age=86400");
      });

      test("returns 503 when server VAPID key is missing", async () => {
        delete process.env.VAPID_PUBLIC_KEY;

        const res = await request(app).get("/api/push/vapid-public-key");

        expect(res.status).toBe(503);
        expect(res.body.error).toContain("Web Push not configured");
      });
    });

    describe("POST /api/push/subscribe", () => {
      test("rejects unauthenticated requests with 401", async () => {
        const res = await request(app)
          .post("/api/push/subscribe")
          .send({ subscription: createSampleSubscription() });

        expect(res.status).toBe(401);
        expect(res.body.error).toBe("Not logged in");
      });

      test("rejects authenticated requests with invalid subscription body (400)", async () => {
        const res = await request(app)
          .post("/api/push/subscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({ subscription: { endpoint: "" } });

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Invalid subscription payload.");
      });

      test("successfully registers valid subscription with 201 Created", async () => {
        const sub = createSampleSubscription("supertest-device");

        const res = await request(app)
          .post("/api/push/subscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .set("User-Agent", "Supertest-Runner/1.0")
          .send({ subscription: sub });

        expect(res.status).toBe(201);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Push notification subscription active.");

        const record = await db("push_subscriptions").where("endpoint", sub.endpoint).first();
        expect(record).toBeDefined();
        expect(record.subscriber_email).toBe(sessionEmail);
        expect(record.user_agent).toBe("Supertest-Runner/1.0");
      });

      test("returns 500 when database insertion fails", async () => {
        const sub = createSampleSubscription("failing-device");
        const origRegister = pushService.registerSubscription;
        jest
          .spyOn(pushService, "registerSubscription")
          .mockRejectedValueOnce(new Error("DB Deadlock"));

        const res = await request(app)
          .post("/api/push/subscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({ subscription: sub });

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to register push subscription.");

        pushService.registerSubscription = origRegister;
      });
    });

    describe("POST /api/push/unsubscribe", () => {
      test("rejects unauthenticated requests with 401", async () => {
        const res = await request(app)
          .post("/api/push/unsubscribe")
          .send({ endpoint: "https://some.push.endpoint" });

        expect(res.status).toBe(401);
      });

      test("rejects missing endpoint in payload with 400", async () => {
        const res = await request(app)
          .post("/api/push/unsubscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({});

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("Subscription endpoint required.");
      });

      test("successfully unsubscribes endpoint with 200 OK", async () => {
        const sub = createSampleSubscription("to-be-removed");
        await pushService.registerSubscription(sessionEmail, sub);

        const res = await request(app)
          .post("/api/push/unsubscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({ endpoint: sub.endpoint });

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.message).toBe("Push notifications unsubscribed.");

        const record = await db("push_subscriptions").where("endpoint", sub.endpoint).first();
        expect(record.is_active).toBe(false);
      });
    });

    describe("POST /api/push/send-test and POST /api/push/test", () => {
      test("rejects unauthenticated test push with 401", async () => {
        const res = await request(app).post("/api/push/send-test");
        expect(res.status).toBe(401);

        const resAlias = await request(app).post("/api/push/test");
        expect(resAlias.status).toBe(401);
      });

      test("returns 404 when subscriber is not in database", async () => {
        const res = await request(app)
          .post("/api/push/send-test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);

        expect(res.status).toBe(404);
        expect(res.body.error).toBe("Subscriber not found.");
      });

      test("returns 400 when subscriber has no active devices registered", async () => {
        mockUserData.set(sessionEmail, { email: sessionEmail, routineTrack: "mindfulness" });

        const res = await request(app)
          .post("/api/push/send-test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);

        expect(res.status).toBe(400);
        expect(res.body.error).toBe("No active push subscriptions found on this account.");
      });

      test("dispatches test push to registered devices on /api/push/send-test", async () => {
        mockUserData.set(sessionEmail, { email: sessionEmail, routineTrack: "learning" });
        const sub = createSampleSubscription("test-target-device");
        await pushService.registerSubscription(sessionEmail, sub);

        webpush.sendNotification.mockResolvedValueOnce({ statusCode: 201 });

        const res = await request(app)
          .post("/api/push/send-test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.sent).toBe(1);
        expect(res.body.results[0].status).toBe("sent");

        expect(webpush.sendNotification).toHaveBeenCalledWith(
          { endpoint: sub.endpoint, keys: sub.keys },
          expect.stringContaining("Morning Routine Test Notification"),
          expect.any(Object),
        );
      });

      test("dispatches test push to registered devices on /api/push/test alias route", async () => {
        mockUserData.set(sessionEmail, { email: sessionEmail, routineTrack: "learning" });
        const sub = createSampleSubscription("test-alias-device");
        await pushService.registerSubscription(sessionEmail, sub);

        webpush.sendNotification.mockResolvedValueOnce({ statusCode: 201 });

        const res = await request(app)
          .post("/api/push/test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);

        expect(res.status).toBe(200);
        expect(res.body.success).toBe(true);
        expect(res.body.sent).toBe(1);
      });

      test("returns 500 when unexpected error occurs during test dispatch", async () => {
        mockUserData.set(sessionEmail, { email: sessionEmail, routineTrack: "learning" });
        const sub = createSampleSubscription("error-test-device");
        await pushService.registerSubscription(sessionEmail, sub);
        jest
          .spyOn(pushService, "sendToSubscriptionRecord")
          .mockRejectedValueOnce(new Error("Disk full"));

        const res = await request(app)
          .post("/api/push/send-test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);

        expect(res.status).toBe(500);
        expect(res.body.error).toBe("Failed to trigger test push.");
      });
    });

    // =======================================================================
    // Section 9: End-to-End Lifecycle Scenario
    // =======================================================================
    describe("Full Web Push Lifecycle Scenario (E2E)", () => {
      test("complete lifecycle: get VAPID key -> subscribe -> dispatch test -> prune dead -> unsubscribe", async () => {
        // Step 1: Client retrieves public VAPID key
        const keyRes = await request(app).get("/api/push/vapid-public-key");
        expect(keyRes.status).toBe(200);
        expect(keyRes.body.publicKey).toBe("test_vapid_public_key_live");

        // Step 2: Authenticated user registers Device A and Device B
        const deviceA = createSampleSubscription("lifecycle-device-a");
        const deviceB = createSampleSubscription("lifecycle-device-b");

        const subResA = await request(app)
          .post("/api/push/subscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({ subscription: deviceA });
        expect(subResA.status).toBe(201);

        const subResB = await request(app)
          .post("/api/push/subscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({ subscription: deviceB });
        expect(subResB.status).toBe(201);

        mockUserData.set(sessionEmail, {
          email: sessionEmail,
          routineTrack: "executive",
          streakCount: 3,
        });

        // Step 3: Trigger test push (both devices active)
        webpush.sendNotification.mockResolvedValue({ statusCode: 201 });
        const testPushRes = await request(app)
          .post("/api/push/send-test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);

        expect(testPushRes.status).toBe(200);
        expect(testPushRes.body.sent).toBe(2);

        // Step 4: Device A expires (browser revoked permissions -> 410 Gone) during morning dispatch
        const err410 = new Error("Subscription expired");
        err410.statusCode = 410;
        webpush.sendNotification
          .mockRejectedValueOnce(err410) // Device A
          .mockResolvedValueOnce({ statusCode: 201 }); // Device B

        const morningDispatch = await pushService.dispatchMorningPushForSubscriber({
          email: sessionEmail,
          routineTrack: "executive",
          streakCount: 4,
        });

        expect(morningDispatch.status).toBe("dispatched");
        expect(morningDispatch.results.some((r) => r.status === "pruned")).toBe(true);

        // Verify Device A was pruned from active list in database
        const recordA = await db("push_subscriptions").where("endpoint", deviceA.endpoint).first();
        expect(recordA.is_active).toBe(false);
        expect(recordA.last_error_status).toBe(410);

        // Step 5: User explicitly unsubscribes Device B
        const unsubRes = await request(app)
          .post("/api/push/unsubscribe")
          .set("Cookie", [`mrn_session=${validSessionToken}`])
          .send({ endpoint: deviceB.endpoint });
        expect(unsubRes.status).toBe(200);

        const recordB = await db("push_subscriptions").where("endpoint", deviceB.endpoint).first();
        expect(recordB.is_active).toBe(false);

        // Step 6: Subsequent test push fails with 400 because no active devices remain
        const finalTestRes = await request(app)
          .post("/api/push/send-test")
          .set("Cookie", [`mrn_session=${validSessionToken}`]);
        expect(finalTestRes.status).toBe(400);
        expect(finalTestRes.body.error).toBe("No active push subscriptions found on this account.");
      });
    });
  });
});
