// __tests__/push.routes.test.js
const request = require("supertest");
const express = require("express");
const cookieParser = require("cookie-parser");
const pushRoutes = require("../routes/push.routes");
const pushService = require("../push-core/pushService");

jest.mock("../push-core/pushService");
jest.mock("../config/redisClient", () => ({
  get: jest.fn(async (key) => {
    if (key === "subscriber_session:valid_session_token") {
      return "subscriber@example.com";
    }
    return null;
  }),
  set: jest.fn(async () => "OK"),
  del: jest.fn(async () => 1),
}));

describe("Web Push Routes (/api/push/*)", () => {
  let app;

  beforeAll(() => {
    app = express();
    app.use(express.json());
    app.use(cookieParser("test_secret"));
    app.use(pushRoutes);
  });

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe("GET /api/push/vapid-public-key", () => {
    test("returns 503 if VAPID_PUBLIC_KEY is not configured", async () => {
      const origKey = process.env.VAPID_PUBLIC_KEY;
      delete process.env.VAPID_PUBLIC_KEY;

      const res = await request(app).get("/api/push/vapid-public-key");
      expect(res.status).toBe(503);
      expect(res.body.error).toContain("Web Push not configured");

      process.env.VAPID_PUBLIC_KEY = origKey;
    });

    test("returns publicKey and cache header when configured", async () => {
      process.env.VAPID_PUBLIC_KEY = "test_vapid_public_key_string";

      const res = await request(app).get("/api/push/vapid-public-key");
      expect(res.status).toBe(200);
      expect(res.body.publicKey).toBe("test_vapid_public_key_string");
      expect(res.headers["cache-control"]).toContain("public, max-age=86400");
    });
  });

  describe("POST /api/push/subscribe", () => {
    test("returns 401 without valid session", async () => {
      const res = await request(app)
        .post("/api/push/subscribe")
        .send({ subscription: { endpoint: "https://fcm.googleapis.com/fcm/send/xyz" } });

      expect(res.status).toBe(401);
      expect(res.body.error).toContain("Not logged in");
    });

    test("returns 400 with invalid subscription payload", async () => {
      const res = await request(app)
        .post("/api/push/subscribe")
        .set("Cookie", ["mrn_session=valid_session_token"])
        .send({});

      expect(res.status).toBe(400);
      expect(res.body.error).toContain("Invalid subscription payload");
    });

    test("registers subscription successfully with valid session and payload", async () => {
      pushService.registerSubscription.mockResolvedValueOnce({ success: true });

      const payload = {
        subscription: {
          endpoint: "https://fcm.googleapis.com/fcm/send/xyz",
          keys: {
            p256dh: "test_p256dh_key",
            auth: "test_auth_key",
          },
        },
      };

      const res = await request(app)
        .post("/api/push/subscribe")
        .set("Cookie", ["mrn_session=valid_session_token"])
        .send(payload);

      expect(res.status).toBe(201);
      expect(res.body.success).toBe(true);
      expect(pushService.registerSubscription).toHaveBeenCalledWith(
        "subscriber@example.com",
        payload.subscription,
        expect.any(String),
      );
    });
  });

  describe("POST /api/push/unsubscribe", () => {
    test("returns 401 without session", async () => {
      const res = await request(app)
        .post("/api/push/unsubscribe")
        .send({ endpoint: "https://fcm.googleapis.com/fcm/send/xyz" });

      expect(res.status).toBe(401);
    });

    test("returns 400 without endpoint", async () => {
      const res = await request(app)
        .post("/api/push/unsubscribe")
        .set("Cookie", ["mrn_session=valid_session_token"])
        .send({});

      expect(res.status).toBe(400);
    });

    test("unsubscribes endpoint successfully", async () => {
      pushService.unsubscribeEndpoint.mockResolvedValueOnce(true);

      const res = await request(app)
        .post("/api/push/unsubscribe")
        .set("Cookie", ["mrn_session=valid_session_token"])
        .send({ endpoint: "https://fcm.googleapis.com/fcm/send/xyz" });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(pushService.unsubscribeEndpoint).toHaveBeenCalledWith(
        "https://fcm.googleapis.com/fcm/send/xyz",
      );
    });
  });
});
