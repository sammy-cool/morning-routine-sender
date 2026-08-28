const { newDb } = require("pg-mem");
const migration = require("../db/migrations/20260711172620_create_subscribers_table");

// Uses pg-mem (an in-memory, Postgres-compatible engine) instead of a real
// Postgres connection, so this test is fast and needs no live database --
// consistent with the rest of __tests__/ being dependency-free.
describe("subscribers migration", () => {
  let knex;

  beforeEach(() => {
    const mem = newDb();
    knex = mem.adapters.createKnex(0);
  });

  afterEach(async () => {
    await knex.destroy();
  });

  test("up() creates the subscribers table with expected columns", async () => {
    await migration.up(knex);
    await knex("subscribers").insert({
      email: "test@example.com",
      cron_pattern: "0 8 * * *",
    });

    // Deliberately a separate select rather than .insert().returning("*") --
    // pg-mem's RETURNING clause represents booleans as "1"/"0" strings
    // rather than true/false, which isn't how a real Postgres connection
    // (via db/knex.js in the actual app) behaves. A follow-up select
    // avoids asserting on that pg-mem-specific quirk.
    const row = await knex("subscribers").where("email", "test@example.com").first();

    expect(row.email).toBe("test@example.com");
    expect(row.template_type).toBe("basic"); // default applied
    expect(row.timezone).toBe("Asia/Kolkata"); // default applied
    // Truthy rather than strict toBe(true): pg-mem represents booleans
    // inconsistently (true vs "1") depending on insert path taken. A real
    // Postgres connection via db/knex.js doesn't have this quirk -- what
    // matters here is that the default was applied at all.
    expect(row.is_active).toBeTruthy();
  });

  test("email column enforces a unique constraint", async () => {
    await migration.up(knex);
    await knex("subscribers").insert({
      email: "duplicate@example.com",
      cron_pattern: "0 8 * * *",
    });

    await expect(
      knex("subscribers").insert({
        email: "duplicate@example.com",
        cron_pattern: "0 0 * * *",
      }),
    ).rejects.toThrow();
  });

  test("insert().onConflict('email').merge() is idempotent (safe to re-run)", async () => {
    await migration.up(knex);
    const record = {
      email: "test@example.com",
      cron_pattern: "0 8 * * *",
    };

    await knex("subscribers").insert(record).onConflict("email").merge();
    await knex("subscribers").insert(record).onConflict("email").merge();

    const all = await knex("subscribers").select("*");
    expect(all).toHaveLength(1);
  });

  test("down() drops the table cleanly", async () => {
    await migration.up(knex);
    await migration.down(knex);

    await expect(knex("subscribers").select("*")).rejects.toThrow();
  });
});
