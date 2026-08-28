// GET /admin/subscribers/stats?days=30
async function getSubscriberStats(req, res) {
  // Deliberately required here, not at top of file: a top-level import
  // would make requiring this module (and therefore
  // routes/subscribers.routes.js, which mounts it) always trigger a real
  // DB connection attempt via db/knex.js -- including in tests that
  // require the routes file but never actually call this endpoint (this
  // broke the pre-existing __tests__/subscribers.controller.test.js,
  // which requires routes/subscribers.routes.js but never calls the
  // stats endpoint). Same pattern already used in
  // controllers/pages.controller.js for the same reason -- see the
  // comment there.
  const db = require("../db/knex");

  try {
    const days = Math.min(Math.max(Number(req.query.days) || 30, 1), 365);

    const [{ count: total }] = await db("subscribers").count("* as count");
    const [{ count: active }] = await db("subscribers")
      .where("is_active", true)
      .count("* as count");

    const since = new Date();
    since.setDate(since.getDate() - days);

    // DATE(created_at) groups signups by calendar day -- Postgres syntax,
    // consistent with the rest of this app's raw SQL (see
    // helper/database-cleanup.js's retention queries for the same pattern).
    const growthRows = await db("subscribers")
      .select(db.raw("DATE(created_at) as date"))
      .count("* as count")
      .where("created_at", ">=", since)
      .groupBy(db.raw("DATE(created_at)"))
      .orderBy("date", "asc");

    const growth = growthRows.map((row) => ({
      date: row.date instanceof Date ? row.date.toISOString().slice(0, 10) : String(row.date),
      count: Number(row.count),
    }));

    res.json({
      total: Number(total),
      active: Number(active),
      paused: Number(total) - Number(active),
      windowDays: days,
      growth,
    });
  } catch (error) {
    const logger = require("../logger");
    logger.error("Failed to load subscriber stats", {
      error: error.message,
      stack: error.stack,
    });
    res.status(500).json({ error: "Failed to load subscriber stats" });
  }
}

module.exports = { getSubscriberStats };
