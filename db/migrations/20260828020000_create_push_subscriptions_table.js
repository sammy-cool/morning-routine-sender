/**
 * db/migrations/20260828020000_create_push_subscriptions_table.js
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = function (knex) {
  return knex.schema.createTable("push_subscriptions", (table) => {
    table.increments("id").primary();
    table
      .integer("subscriber_id")
      .unsigned()
      .nullable()
      .references("id")
      .inTable("subscribers")
      .onDelete("CASCADE");
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
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Indexes for high-speed morning cron lookups
    table.index("subscriber_email");
    table.index(["subscriber_email", "is_active"]);
    table.index("is_active");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("push_subscriptions");
};
