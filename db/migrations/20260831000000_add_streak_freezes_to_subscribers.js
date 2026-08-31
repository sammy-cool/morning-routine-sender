/**
 * Migration: Add streak_freezes and freeze_history to subscribers
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasStreakFreezes = await knex.schema.hasColumn("subscribers", "streak_freezes");
  if (!hasStreakFreezes) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.integer("streak_freezes").notNullable().defaultTo(2);
      table.text("freeze_history").notNullable().defaultTo("[]");
    });
  }
};

/**
 * Rollback: Remove streak_freezes and freeze_history
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.down = async function (knex) {
  const hasStreakFreezes = await knex.schema.hasColumn("subscribers", "streak_freezes");
  if (hasStreakFreezes) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.dropColumn("streak_freezes");
      table.dropColumn("freeze_history");
    });
  }
};
