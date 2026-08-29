// __tests__/suppression.postgres.test.js
const { newDb } = require("pg-mem");

describe("Suppression & Push Service DB Query Compatibility", () => {
  let memDb;
  let knex;

  beforeEach(async () => {
    memDb = newDb();
    knex = memDb.adapters.createKnex();

    // Create tables for test
    await knex.schema.createTable("email_tracker", (table) => {
      table.increments("id").primary();
      table.string("recipient_email", 255).notNullable();
      table.string("template_type", 100).notNullable();
      table.timestamp("sent_at").notNullable();
      table.string("status", 50).notNullable();
      table.text("error_message").nullable();
      table.integer("retry_count").defaultTo(0);
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });

    await knex.schema.createTable("push_subscriptions", (table) => {
      table.increments("id").primary();
      table.string("subscriber_email", 255).notNullable();
      table.text("endpoint").notNullable().unique();
      table.string("p256dh", 255).notNullable();
      table.string("auth", 255).notNullable();
      table.boolean("is_active").notNullable().defaultTo(true);
      table.integer("failed_attempts").notNullable().defaultTo(0);
      table.integer("last_error_status").nullable();
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  });

  afterEach(async () => {
    await knex.destroy();
  });

  test("email_tracker latest record update on hard bounce resolves by ID without SQL syntax error", async () => {
    // Insert 2 records for the same recipient with different sent_at
    await knex("email_tracker").insert([
      {
        recipient_email: "bounce@example.com",
        template_type: "deep-work",
        sent_at: new Date("2026-08-28T06:00:00Z"),
        status: "success",
      },
      {
        recipient_email: "bounce@example.com",
        template_type: "deep-work",
        sent_at: new Date("2026-08-29T06:00:00Z"),
        status: "success",
      },
    ]);

    // Query latest email and update by ID (our safe pattern)
    const latestEmail = await knex("email_tracker")
      .where("recipient_email", "bounce@example.com")
      .orderBy("sent_at", "desc")
      .first();

    expect(latestEmail.id).toBe(2);

    await knex("email_tracker").where("id", latestEmail.id).update({
      status: "bounced",
      error_message: "Hard Bounce: 5.1.1 User unknown",
      updated_at: new Date(),
    });

    const updated = await knex("email_tracker").where("id", 2).first();
    expect(updated.status).toBe("bounced");
    expect(updated.error_message).toContain("Hard Bounce: 5.1.1");

    // Verify older record wasn't mutated
    const older = await knex("email_tracker").where("id", 1).first();
    expect(older.status).toBe("success");
  });

  test("push_subscriptions failed_attempts increments correctly using raw SQL addition", async () => {
    await knex("push_subscriptions").insert({
      subscriber_email: "push@example.com",
      endpoint: "https://fcm.googleapis.com/fcm/send/test-endpoint",
      p256dh: "test-p256dh-key",
      auth: "test-auth-secret",
      failed_attempts: 0,
    });

    // Increment failed attempts
    await knex("push_subscriptions")
      .where("endpoint", "https://fcm.googleapis.com/fcm/send/test-endpoint")
      .update({
        failed_attempts: knex.raw("failed_attempts + 1"),
        last_error_status: 500,
        updated_at: new Date(),
      });

    const sub = await knex("push_subscriptions")
      .where("endpoint", "https://fcm.googleapis.com/fcm/send/test-endpoint")
      .first();
    expect(sub.failed_attempts).toBe(1);
    expect(sub.last_error_status).toBe(500);

    // Second failure
    await knex("push_subscriptions")
      .where("endpoint", "https://fcm.googleapis.com/fcm/send/test-endpoint")
      .update({
        failed_attempts: knex.raw("failed_attempts + 1"),
        last_error_status: 503,
        updated_at: new Date(),
      });

    const sub2 = await knex("push_subscriptions")
      .where("endpoint", "https://fcm.googleapis.com/fcm/send/test-endpoint")
      .first();
    expect(sub2.failed_attempts).toBe(2);
    expect(sub2.last_error_status).toBe(503);
  });
});
