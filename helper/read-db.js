const logger = require("../logger");
const db = require("../db/knex");

// Was previously opening its own separate `pg.Client` connection using
// process.env.DATABASE_URL -- a leftover from when the DB was hosted on
// Leapcell. That variable now points at a dead host (see .env.example),
// so this route was silently broken after the Render Postgres migration.
// Fixed by reusing the shared Knex connection from db/knex.js, which is
// already correctly configured (DB_HOST/DB_USER/etc, see knexfile.js) and
// is the same connection every other DB-touching route uses.
async function readDb() {
  try {
    // knex.raw() with the pg client returns the same pg Result shape
    // (.rows / .rowCount) that the previous pg.Client-based version did,
    // so the response shape to callers is unchanged.
    const result = await db.raw(
      "SELECT * FROM email_tracker ORDER BY sent_at DESC;",
    );
    return { rowCount: result.rowCount, rows: result.rows };
  } catch (err) {
    logger.error("❌ Error inspecting database:", err.message);
    throw err;
  }
}

module.exports = { readDb };
