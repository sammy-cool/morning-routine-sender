/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable("email_tracker", (table) => {
    table.increments("id").primary();
    table.string("recipient_email", 255).notNullable();
    table.string("template_type", 100).notNullable();
    table.timestamp("sent_at").notNullable();
    table.string("status", 50).notNullable(); // 'success', 'failed', 'pending'
    table.text("error_message").nullable();
    table.integer("retry_count").defaultTo(0);
    table.string("message_id", 255).nullable(); // SMTP message ID
    table.json("metadata").nullable(); // Additional context as JSON
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index("recipient_email");
    table.index("sent_at");
    table.index("status");
    table.index(["recipient_email", "template_type", "sent_at"]);
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("email_tracker");
};
