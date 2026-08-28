/**
 * Migration: Create suppression_list and email_events tables + deliverability columns on subscribers
 * @param { import("knex").Knex } knex
 */
exports.up = async function (knex) {
  // 1. suppression_list table
  const hasSuppression = await knex.schema.hasTable("suppression_list");
  if (!hasSuppression) {
    await knex.schema.createTable("suppression_list", (table) => {
      table.increments("id").primary();
      table.string("email", 255).notNullable().unique();
      table.string("reason", 50).notNullable(); // 'hard_bounce', 'soft_bounce_threshold', 'spam_complaint', 'manual_admin', 'unsubscribe'
      table.string("provider", 50).nullable(); // 'resend', 'sendgrid', 'brevo', 'generic'
      table.string("bounce_code", 50).nullable(); // '5.1.1', '550', etc.
      table.text("diagnostic_reason").nullable();
      table.timestamp("suppressed_at").defaultTo(knex.fn.now());
      table.timestamp("expires_at").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table.index("email");
      table.index("reason");
      table.index("expires_at");
    });
  }

  // 2. email_events telemetry table
  const hasEvents = await knex.schema.hasTable("email_events");
  if (!hasEvents) {
    await knex.schema.createTable("email_events", (table) => {
      table.increments("id").primary();
      table.string("event_id", 255).nullable().unique();
      table.string("recipient_email", 255).notNullable();
      table.string("message_id", 255).nullable();
      table.string("event_type", 50).notNullable(); // 'delivered', 'opened', 'clicked', 'soft_bounce', 'hard_bounce', 'spam_complaint', 'unsubscribed'
      table.string("provider", 50).notNullable();
      table.string("ip_address", 64).nullable();
      table.text("user_agent").nullable();
      table.string("click_url", 1024).nullable();
      table.string("bounce_code", 50).nullable();
      table.text("bounce_description").nullable();
      table.text("raw_payload").nullable();
      table.timestamp("occurred_at").notNullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());

      table.index("recipient_email");
      table.index("event_type");
      table.index("message_id");
      table.index("occurred_at");
    });
  }

  // 3. deliverability columns on subscribers table
  const hasSubscribers = await knex.schema.hasTable("subscribers");
  if (hasSubscribers) {
    const hasStatus = await knex.schema.hasColumn("subscribers", "deliverability_status");
    if (!hasStatus) {
      await knex.schema.alterTable("subscribers", (table) => {
        table.string("deliverability_status", 50).notNullable().defaultTo("active");
        table.integer("soft_bounce_count").notNullable().defaultTo(0);
        table.timestamp("bounce_cooldown_until").nullable();
        table.timestamp("last_bounce_at").nullable();
        table.string("last_bounce_type", 50).nullable();
        table.string("last_bounce_code", 50).nullable();
        table.timestamp("last_delivered_at").nullable();
        table.timestamp("last_opened_at").nullable();
        table.timestamp("last_clicked_at").nullable();

        table.index("deliverability_status");
        table.index("bounce_cooldown_until");
      });
    }
  }
};

exports.down = async function (knex) {
  const hasSubscribers = await knex.schema.hasTable("subscribers");
  if (hasSubscribers) {
    const hasStatus = await knex.schema.hasColumn("subscribers", "deliverability_status");
    if (hasStatus) {
      await knex.schema.alterTable("subscribers", (table) => {
        table.dropColumn("deliverability_status");
        table.dropColumn("soft_bounce_count");
        table.dropColumn("bounce_cooldown_until");
        table.dropColumn("last_bounce_at");
        table.dropColumn("last_bounce_type");
        table.dropColumn("last_bounce_code");
        table.dropColumn("last_delivered_at");
        table.dropColumn("last_opened_at");
        table.dropColumn("last_clicked_at");
      });
    }
  }
  await knex.schema.dropTableIfExists("email_events");
  await knex.schema.dropTableIfExists("suppression_list");
};
