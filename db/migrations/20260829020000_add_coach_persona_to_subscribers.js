/**
 * Migration: Add coach_persona column to subscribers table
 * Default persona is 'stoic'.
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("subscribers", "coach_persona");
  if (!hasColumn) {
    await knex.schema.alterTable("subscribers", (table) => {
      table
        .string("coach_persona", 50)
        .notNullable()
        .defaultTo("stoic")
        .comment("Active AI Coach Persona: stoic, relentless, zen, tech-lead, optimist");
    });
  }
};

/**
 * Rollback: Drop coach_persona column from subscribers table
 *
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasColumn = await knex.schema.hasColumn("subscribers", "coach_persona");
  if (hasColumn) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.dropColumn("coach_persona");
    });
  }
};
