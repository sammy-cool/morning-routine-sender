const { newDb } = require("pg-mem");
const migration = require("../db/migrations/20260711172620_create_subscribers_table");

function mockReqRes(query = {}) {
  const req = { query };
  const res = { _status: 200, _json: null };
  res.status = (c) => {
    res._status = c;
    return res;
  };
  res.json = (obj) => {
    res._json = obj;
    return res;
  };
  return { req, res };
}

describe("getSubscriberStats", () => {
  let knex;
  let getSubscriberStats;

  beforeEach(async () => {
    const mem = newDb();

    // pg-mem doesn't implement Postgres's DATE() function natively (it's
    // valid, standard Postgres -- this is purely a test-environment gap,
    // not a real SQL issue). Registered here per pg-mem's own suggested
    // fix, matching real Postgres's behavior: truncate a timestamp to
    // its calendar date.
    mem.public.registerFunction({
      name: "date",
      args: ["timestamptz"],
      returns: "date",
      // Returning a string, not `new Date(ts)` -- pg-mem's GROUP BY
      // appeared to compare Date objects by reference rather than value,
      // so two rows on the same calendar day weren't grouping together.
      // The controller already handles either shape (see its
      // `row.date instanceof Date ? ... : String(row.date)` fallback),
      // so this only affects the test environment, not production.
      implementation: (ts) => new Date(ts).toISOString().slice(0, 10),
    });

    knex = mem.adapters.createKnex(0);
    await migration.up(knex);

    // jest.doMock (not jest.mock -- avoids hoisting restrictions on
    // referencing the pg-mem knex instance) + a fresh require() per test,
    // since controllers/subscriberStats.controller.js does
    // `const db = require("../db/knex")` once at module load.
    jest.resetModules();
    jest.doMock("../db/knex", () => knex);
    getSubscriberStats =
      require("../controllers/subscriberStats.controller").getSubscriberStats;
  });

  afterEach(async () => {
    await knex.destroy();
    jest.dontMock("../db/knex");
  });

  test("returns zeroed stats for an empty table", async () => {
    const { req, res } = mockReqRes();
    await getSubscriberStats(req, res);

    expect(res._json.total).toBe(0);
    expect(res._json.active).toBe(0);
    expect(res._json.paused).toBe(0);
    expect(res._json.growth).toEqual([]);
  });

  test("counts total/active/paused correctly", async () => {
    await knex("subscribers").insert([
      { email: "a@example.com", cron_pattern: "0 8 * * *", is_active: true },
      { email: "b@example.com", cron_pattern: "0 8 * * *", is_active: true },
      { email: "c@example.com", cron_pattern: "0 8 * * *", is_active: false },
    ]);

    const { req, res } = mockReqRes();
    await getSubscriberStats(req, res);

    expect(res._json.total).toBe(3);
    expect(res._json.active).toBe(2);
    expect(res._json.paused).toBe(1);
  });

  test("groups growth by day within the requested window", async () => {
    const today = new Date().toISOString().slice(0, 10);

    await knex("subscribers").insert([
      {
        email: "a@example.com",
        cron_pattern: "0 8 * * *",
        created_at: `${today} 09:00:00`,
      },
      {
        email: "b@example.com",
        cron_pattern: "0 8 * * *",
        created_at: `${today} 14:00:00`,
      },
    ]);

    const { req, res } = mockReqRes({ days: "7" });
    await getSubscriberStats(req, res);

    expect(res._json.growth).toEqual([{ date: today, count: 2 }]);
    expect(res._json.windowDays).toBe(7);
  });

  test("clamps an out-of-range days value instead of erroring", async () => {
    const { req, res } = mockReqRes({ days: "99999" });
    await getSubscriberStats(req, res);

    expect(res._json.windowDays).toBe(365);
    expect(res._status).toBe(200);
  });

  test("defaults to 30 days when no query param is given", async () => {
    const { req, res } = mockReqRes();
    await getSubscriberStats(req, res);

    expect(res._json.windowDays).toBe(30);
  });
});
