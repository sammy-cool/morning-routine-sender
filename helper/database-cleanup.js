// helper/database-cleanup.js
const db = require("../db/knex");
const logger = require("../logger");

/**
 * Delete email records older than specified days
 * @param {number} days - Number of days to keep
 */
async function cleanupOldEmailRecords(days) {
  try {
    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - days);

    logger.info(`🧹 Starting database cleanup of last ${days} days!`, {
      cutoffDate: cutoffDate.toISOString(),
      daysToKeep: days,
    });

    // Delete old email tracker records
    const deleted = await db("email_tracker")
      .where("sent_at", "<", cutoffDate)
      .delete();

    logger.info("✅ Database cleanup completed", {
      recordsDeleted: deleted,
      cutoffDate: cutoffDate.toISOString(),
    });

    return { success: true, deleted };
  } catch (error) {
    logger.error("❌ Database cleanup failed", {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Optimize database (vacuum for SQLite)
 */
async function optimizeDatabase() {
  try {
    logger.info("🔧 Optimizing database...");

    // Vacuum for SQLite (reclaim space)
    await db.raw("VACUUM");

    // Analyze for query optimization
    await db.raw("ANALYZE");

    logger.info("✅ Database optimization completed");
    return { success: true };
  } catch (error) {
    logger.error("❌ Database optimization failed", {
      error: error.message,
    });
    return { success: false, error: error.message };
  }
}

/**
 * Get database statistics
 */
async function getDatabaseStats() {
  try {
    const [emailCount] = await db("email_tracker").count("* as count");
    const [oldestRecord] = await db("email_tracker")
      .orderBy("sent_at", "asc")
      .limit(1);
    const [newestRecord] = await db("email_tracker")
      .orderBy("sent_at", "desc")
      .limit(1);

    return {
      totalRecords: emailCount.count,
      oldestRecord: oldestRecord?.sent_at,
      newestRecord: newestRecord?.sent_at,
    };
  } catch (error) {
    logger.error("Failed to get database stats", {
      error: error.message,
    });
    return null;
  }
}

module.exports = {
  cleanupOldEmailRecords,
  optimizeDatabase,
  getDatabaseStats,
};
