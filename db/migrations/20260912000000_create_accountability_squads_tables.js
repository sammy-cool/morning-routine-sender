/**
 * Migration: Create accountability_squads and squad_members tables for peer consistency squads
 * @param { import("knex").Knex } knex
 * @returns { Promise<void> }
 */
exports.up = async function (knex) {
  const hasSquads = await knex.schema.hasTable("accountability_squads");
  if (!hasSquads) {
    await knex.schema.createTable("accountability_squads", (table) => {
      table.increments("id").primary();
      table.string("name", 100).notNullable();
      table.string("invite_code", 20).notNullable().unique();
      table.string("creator_email", 255).notNullable();
      table.integer("max_members").notNullable().defaultTo(5);
      table.integer("squad_streak").notNullable().defaultTo(0);
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());

      table.index("invite_code");
      table.index("creator_email");
    });
  }

  const hasMembers = await knex.schema.hasTable("squad_members");
  if (!hasMembers) {
    await knex.schema.createTable("squad_members", (table) => {
      table.increments("id").primary();
      table
        .integer("squad_id")
        .unsigned()
        .notNullable()
        .references("id")
        .inTable("accountability_squads")
        .onDelete("CASCADE");
      table.string("subscriber_email", 255).notNullable();
      table.string("role", 20).notNullable().defaultTo("member"); // 'leader' | 'member'
      table.timestamp("joined_at").defaultTo(knex.fn.now());

      table.unique(["squad_id", "subscriber_email"]);
      table.index("subscriber_email");
      table.index("squad_id");
    });
  }
};

exports.down = async function (knex) {
  await knex.schema.dropTableIfExists("squad_members");
  await knex.schema.dropTableIfExists("accountability_squads");
};
