/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable("subscribers", (table) => {
    table.increments("id").primary();
    table.string("email", 255).notNullable().unique();
    table.string("template_type", 100).notNullable().defaultTo("basic");
    table.string("cron_pattern", 100).notNullable();
    table.string("timezone", 100).notNullable().defaultTo("Asia/Kolkata");
    table.boolean("is_active").notNullable().defaultTo(true);
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    // Indexes for common queries
    table.index("email");
    table.index("is_active");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("subscribers");
};
