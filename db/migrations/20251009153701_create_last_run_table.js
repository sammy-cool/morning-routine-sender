/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */

exports.up = function (knex) {
  return knex.schema.createTable("job_last_run", (table) => {
    table.increments("id").primary();
    table.string("job_name", 100).notNullable().unique();
    table.timestamp("last_run_at").notNullable();
    table.string("status", 50).notNullable(); // 'success', 'failed'
    table.integer("emails_sent").defaultTo(0);
    table.integer("emails_failed").defaultTo(0);
    table.text("error_details").nullable();
    table.timestamp("created_at").defaultTo(knex.fn.now());
    table.timestamp("updated_at").defaultTo(knex.fn.now());

    table.index("job_name");
    table.index("last_run_at");
  });
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("job_last_run");
};
