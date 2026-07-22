const db = require("../db/knex");

// GET /admin/subscribers/stats?days=30
async function getSubscriberStats(req, res) {
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
      date:
        row.date instanceof Date
          ? row.date.toISOString().slice(0, 10)
          : String(row.date),
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
    console.error("Failed to load subscriber stats:", error.message);
    res.status(500).json({ error: "Failed to load subscriber stats" });
  }
}

module.exports = { getSubscriberStats };
