// scripts/run-db-maintenance.js
require("dotenv").config();
const db = require("../db/knex");
const logger = require("../logger");

async function runDatabaseMaintenance() {
  logger.info("🔧 [DB Maintenance] Starting scheduled PostgreSQL VACUUM and ANALYZE...");
  const startTime = Date.now();

  try {
    const tables = [
      "email_tracker",
      "job_last_run",
      "subscribers",
      "suppression_list",
      "email_events",
      "push_subscriptions",
    ];
    for (const table of tables) {
      try {
        await db.raw(`VACUUM (ANALYZE) ${table}`);
        logger.info(`✅ [DB Maintenance] VACUUM (ANALYZE) completed for table: ${table}`);
      } catch (tableErr) {
        logger.warn(`⚠️ [DB Maintenance] VACUUM skipped for table ${table}: ${tableErr.message}`);
      }
    }

    await db.raw("ANALYZE");
    logger.info("✅ [DB Maintenance] Global ANALYZE completed.");

    const duration = Date.now() - startTime;
    logger.info(`🎉 [DB Maintenance] Maintenance routine finished in ${duration}ms.`);
  } catch (error) {
    logger.error("❌ [DB Maintenance] Database maintenance failed:", { error: error.message });
    process.exitCode = 1;
  } finally {
    await db.destroy();
  }
}

if (require.main === module) {
  runDatabaseMaintenance();
}

module.exports = { runDatabaseMaintenance };
