/**
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasStreak = await knex.schema.hasColumn("subscribers", "streak_count");
  if (!hasStreak) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.integer("streak_count").notNullable().defaultTo(0);
      table.string("last_checkin_date", 20).nullable();
      table.string("routine_track", 100).notNullable().defaultTo("deep-work");
    });
  }
};

exports.down = async function (knex) {
  const hasStreak = await knex.schema.hasColumn("subscribers", "streak_count");
  if (hasStreak) {
    await knex.schema.alterTable("subscribers", (table) => {
      table.dropColumn("streak_count");
      table.dropColumn("last_checkin_date");
      table.dropColumn("routine_track");
    });
  }
};
