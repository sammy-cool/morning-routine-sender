// __tests__/admin.telemetry.test.js
process.env.ADMIN_USER = "admin";
process.env.ADMIN_PASSWORD = "password123";
process.env.ADMIN_SKIP_KEY = "GG!";

const { newDb } = require("pg-mem");
const express = require("express");
const cookieParser = require("cookie-parser");
const cookieSignature = require("cookie-signature");
const request = require("supertest");
const eventsMigration = require("../db/migrations/20260828010000_create_suppression_and_events_tables");

const cookieSecret = process.env.SESSION_SECRET || "cookie_secret";
const signedAdminCookie = `mrn_role=s%3A${encodeURIComponent(cookieSignature.sign("admin", cookieSecret))}`;

let mockKnexInstance;
jest.mock("../db/knex", () => {
  const handler = (table) => mockKnexInstance(table);
  Object.defineProperty(handler, "schema", {
    get: () => mockKnexInstance.schema,
  });
  Object.defineProperty(handler, "fn", {
    get: () => mockKnexInstance.fn,
  });
  Object.defineProperty(handler, "raw", {
    get: () => mockKnexInstance.raw,
  });
  return handler;
});

describe("Admin Telemetry & Delivery Analytics", () => {
  let app;
  let memDb;

  beforeEach(async () => {
    memDb = newDb();
    mockKnexInstance = memDb.adapters.createKnex(0);

    // Create email_tracker table
    await mockKnexInstance.schema.createTable("email_tracker", (table) => {
      table.increments("id").primary();
      table.string("recipient_email", 255).notNullable();
      table.string("template_type", 100).notNullable();
      table.timestamp("sent_at").notNullable();
      table.string("status", 50).notNullable();
      table.text("error_message").nullable();
      table.integer("retry_count").defaultTo(0);
      table.string("message_id", 255).nullable();
      table.text("metadata").nullable();
      table.timestamp("created_at").defaultTo(mockKnexInstance.fn.now());
      table.timestamp("updated_at").defaultTo(mockKnexInstance.fn.now());
    });

    // Run suppression & events migration
    await eventsMigration.up(mockKnexInstance);

    const deliverabilityRoutes = require("../routes/deliverability.routes");
    const adminRoutes = require("../routes/admin.routes");

    app = express();
    app.use(express.json());
    app.use(cookieParser(cookieSecret));
    app.use("/admin/deliverability", deliverabilityRoutes);
    app.use(adminRoutes);
  });

  afterEach(async () => {
    if (mockKnexInstance) {
      await mockKnexInstance.destroy();
    }
  });

  describe("Authentication Guard", () => {
    test("rejects unauthenticated requests with 403 Forbidden", async () => {
      const res = await request(app).get("/admin/deliverability/telemetry-overview");
      expect(res.status).toBe(403);
    });

    test("rejects non-admin requests to /admin/api/retry-failed", async () => {
      const res = await request(app).post("/admin/api/retry-failed").send({ hours: 24 });
      expect(res.status).toBe(403);
    });
  });

  describe("GET /admin/deliverability/telemetry-overview", () => {
    test("returns accurate aggregated rates and counts for authenticated admin", async () => {
      // Seed email_tracker data
      await mockKnexInstance("email_tracker").insert([
        {
          recipient_email: "sub1@example.com",
          template_type: "deep-work",
          sent_at: new Date(),
          status: "success",
          retry_count: 0,
        },
        {
          recipient_email: "sub2@example.com",
          template_type: "mindfulness",
          sent_at: new Date(),
          status: "success",
          retry_count: 1,
        },
        {
          recipient_email: "fail@example.com",
          template_type: "executive",
          sent_at: new Date(),
          status: "failed",
          retry_count: 3,
          error_message: "Connection timeout",
        },
      ]);

      // Seed email_events data
      await mockKnexInstance("email_events").insert([
        {
          event_id: "evt_1",
          recipient_email: "sub1@example.com",
          message_id: "msg_1",
          event_type: "delivered",
          provider: "resend",
          occurred_at: new Date(),
        },
        {
          event_id: "evt_2",
          recipient_email: "sub1@example.com",
          message_id: "msg_1",
          event_type: "opened",
          provider: "resend",
          occurred_at: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/admin/deliverability/telemetry-overview?days=7")
        .set("Cookie", [signedAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.overview.totalDispatched).toBe(3);
      expect(res.body.overview.totalSent).toBe(2);
      expect(res.body.overview.failedDispatches).toBe(1);
      expect(res.body.overview.retriedDispatches).toBe(2);
      expect(res.body.overview.delivered).toBe(1);
      expect(res.body.overview.opened).toBe(1);
      expect(res.body.byProvider.resend).toBeDefined();
    });
  });

  describe("GET /admin/deliverability/recent-events", () => {
    test("filters events by provider and event_type", async () => {
      await mockKnexInstance("email_events").insert([
        {
          event_id: "evt_a",
          recipient_email: "user_a@example.com",
          event_type: "delivered",
          provider: "sendgrid",
          occurred_at: new Date(),
        },
        {
          event_id: "evt_b",
          recipient_email: "user_b@example.com",
          event_type: "soft_bounce",
          provider: "resend",
          occurred_at: new Date(),
        },
      ]);

      const res = await request(app)
        .get("/admin/deliverability/recent-events?provider=sendgrid")
        .set("Cookie", [signedAdminCookie]);

      expect(res.status).toBe(200);
      expect(res.body.count).toBe(1);
      expect(res.body.events[0].provider).toBe("sendgrid");
    });
  });

  describe("POST /admin/deliverability/retry-failed", () => {
    test("returns empty summary when no failed dispatches are found", async () => {
      const res = await request(app)
        .post("/admin/deliverability/retry-failed")
        .set("Cookie", [signedAdminCookie])
        .send({ hours: 24 });

      expect(res.status).toBe(200);
      expect(res.body.success).toBe(true);
      expect(res.body.summary.totalFound).toBe(0);
      expect(res.body.summary.retried).toBe(0);
    });
  });
});
