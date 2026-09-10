const fs = require("node:fs/promises");
const path = require("node:path");
const logger = require("../logger");
const { safeCompare } = require("../helper/util");

// GET /read-db
async function readDb(req, res) {
  const isAdminSession = req.signedCookies?.mrn_role === "admin";
  const apiKey = req.get("x-cron-key") || req.get("x-admin-secret") || req.query.key;
  const isKeyValid =
    Boolean(apiKey) &&
    ((Boolean(process.env.CRON_API_KEY) && safeCompare(apiKey, process.env.CRON_API_KEY)) ||
      (Boolean(process.env.ADMIN_KEY) && safeCompare(apiKey, process.env.ADMIN_KEY)));

  if (!isAdminSession && !isKeyValid) {
    logger.error("Forbidden: admin access or valid API key required");
    return res.status(403).json({ error: "Forbidden: admin access required" });
  }
  try {
    const { readDb: readDbFromHelper } = require("../helper/read-db");
    const result = await readDbFromHelper();
    logger.info("Getting Database Result");
    res.json({ success: true, data: result });
  } catch (error) {
    logger.error("Database reading failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
}

// POST /admin/cleanup-database
async function cleanupDatabase(req, res) {
  try {
    const DEFAULT_DAYS = 30;
    const envDays = Number(process.env.DB_RETENTION_DAYS);
    const bodyDays = Number(req?.body?.days);

    let days;

    if (Number.isFinite(bodyDays) && bodyDays > 0) {
      days = Math.max(Math.floor(bodyDays), 1);
    } else if (Number.isFinite(envDays) && envDays > 0) {
      days = envDays;
    } else {
      logger.warn(
        "No days specified in Body | Env | Specified days is not Greater than Zero!, using default value",
      );
      days = DEFAULT_DAYS;
    }

    const { cleanupOldEmailRecords } = require("../helper/database-cleanup");
    const result = await cleanupOldEmailRecords(days);

    res.json(result);
  } catch (error) {
    logger.error("Manual cleanup failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
}

// GET /admin/database-stats
async function getDatabaseStats(req, res) {
  try {
    const { getDatabaseStats: getStats } = require("../helper/database-cleanup");
    const stats = await getStats();

    res.json(stats);
  } catch (error) {
    logger.error("Failed to get stats", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
}

// POST /admin/cleanup-logs
//
// NOTE: the original inline version of this handler required "node:fs" (the
// callback-based module) and then called fs.readdir/fs.stat/fs.unlink with
// `await` and no callback. That throws "The 'cb' argument must be of type
// function" every single time (verified) -- so this endpoint has always
// returned a 500 in production. Fixed here by requiring "node:fs/promises"
// instead, which is the only change in behavior versus the original code.
async function cleanupLogs(req, res) {
  try {
    const logsDir = path.join(__dirname, "..", "logs");

    const files = await fs.readdir(logsDir);
    let deleted = 0;

    const cutoffDate = new Date();
    cutoffDate.setDate(cutoffDate.getDate() - 3);

    for (const file of files) {
      const filePath = path.join(logsDir, file);
      const stats = await fs.stat(filePath);

      if (stats.mtime < cutoffDate) {
        await fs.unlink(filePath);
        deleted++;
        logger.info("Deleted old log file", { file });
      }
    }

    res.json({ success: true, deleted });
  } catch (error) {
    logger.error("Log cleanup failed", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
}

module.exports = { readDb, cleanupDatabase, getDatabaseStats, cleanupLogs };
