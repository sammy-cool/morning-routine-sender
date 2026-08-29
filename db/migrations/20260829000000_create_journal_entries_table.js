/**
 * Migration: Create journal_entries table for subscriber morning reflections
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasJournal = await knex.schema.hasTable("journal_entries");
  if (!hasJournal) {
    await knex.schema.createTable("journal_entries", (table) => {
      table.increments("id").primary();
      table
        .integer("subscriber_id")
        .unsigned()
        .nullable()
        .references("id")
        .inTable("subscribers")
        .onDelete("CASCADE");
      table.string("subscriber_email", 255).notNullable();
      table.string("entry_date", 20).notNullable(); // YYYY-MM-DD
      table.string("track_key", 50).notNullable().defaultTo("deep-work");
      table.text("one_big_thing").nullable();
      table.text("gratitude").nullable();
      table.text("reflection_text").nullable();
      table.integer("mood_score").nullable().defaultTo(5); // 1-5 rating
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      // Unique constraint to enforce one daily reflection per subscriber
      table.unique(["subscriber_email", "entry_date"]);

      // Indexes for fast retrieval & export
      table.index("subscriber_email");
      table.index(["subscriber_email", "entry_date"]);
      table.index("entry_date");
    });
  }
};

exports.down = function (knex) {
  return knex.schema.dropTableIfExists("journal_entries");
};
