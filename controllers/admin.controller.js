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

// POST /admin/api/reschedule-all
async function rescheduleAllCronJobs(req, res) {
  try {
    const emailScheduler = require("../email-core/emailScheduler");
    const result = await emailScheduler.rescheduleAllJobs();
    logger.info("Admin triggered rescheduleAllCronJobs", { totalJobs: result.totalJobs });
    res.json({
      success: true,
      message: `Successfully reloaded and rescheduled ${result.totalJobs} active cron schedules.`,
      ...result,
    });
  } catch (error) {
    logger.error("Failed to reschedule cron jobs via admin", { error: error.message || error });
    res.status(500).json({ success: false, error: error.message || error });
  }
}

// GET /admin/api/scheduler/queue
async function getSchedulerQueue(req, res) {
  try {
    const emailScheduler = require("../email-core/emailScheduler");
    const limit = Number(req.query.limit) || 15;
    const queue =
      typeof emailScheduler.getUpcomingDispatchQueue === "function"
        ? emailScheduler.getUpcomingDispatchQueue(limit)
        : [];
    res.json({ success: true, count: queue.length, queue });
  } catch (error) {
    logger.error("Failed to fetch scheduler queue", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /admin/api/scheduler/dispatch-preview
async function dispatchSinglePreview(req, res) {
  try {
    const { email, dryRun } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const sharedData = require("../helper/shared-data");
    const user = await sharedData.getUserByEmail(email);
    if (!user) {
      return res.status(404).json({ error: "Subscriber not found" });
    }
    if (dryRun) {
      return res.json({
        success: true,
        dryRun: true,
        user: {
          email: user.email,
          routineTrack: user.routineTrack || user.templateType,
          timezone: user.timezone,
          cronPattern: user.cronPattern,
          streakCount: user.streakCount,
        },
      });
    }
    const emailScheduler = require("../email-core/emailScheduler");
    const result = await emailScheduler.sendRoutineEmail(user, process.env.ADMIN_SKIP_KEY);
    res.json({ success: true, result });
  } catch (error) {
    logger.error("Failed dispatch preview", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /admin/api/suppressions
async function getSuppressionsList(req, res) {
  try {
    const db = require("../db/knex");
    const rows = await db("suppression_list")
      .orderBy("created_at", "desc")
      .limit(100)
      .catch(() => []);
    res.json({ success: true, count: rows.length, suppressions: rows });
  } catch (error) {
    logger.error("Failed to load suppressions", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /admin/api/suppressions/unsuppress
async function unsuppressEmail(req, res) {
  try {
    const { email } = req.body || {};
    if (!email) {
      return res.status(400).json({ error: "Email is required" });
    }
    const cleanEmail = email.trim().toLowerCase();
    const suppressionService = require("../email-core/suppressionService");
    await suppressionService.removeSuppression(cleanEmail);
    res.json({
      success: true,
      message: `Successfully unsuppressed ${cleanEmail}. Routine delivery restored.`,
    });
  } catch (error) {
    logger.error("Failed to unsuppress email", { error: error.message });
    res.status(500).json({ success: false, error: error.message });
  }
}

// GET /admin/api/announcements
async function getAdminAnnouncements(req, res) {
  try {
    const { getActiveAnnouncement } = require("../helper/announcementService");
    const ann = await getActiveAnnouncement("all");
    res.json({ success: true, announcement: ann });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// POST /admin/api/announcements
async function createAnnouncement(req, res) {
  try {
    const { title, message, targetTrack, priority, expiresAt } = req.body || {};
    if (!message) {
      return res.status(400).json({ error: "Message is required" });
    }
    const { setAnnouncement } = require("../helper/announcementService");
    const ann = await setAnnouncement({ title, message, targetTrack, priority, expiresAt });
    res.json({ success: true, announcement: ann });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

// DELETE /admin/api/announcements
async function clearActiveAnnouncement(req, res) {
  try {
    const { clearAnnouncement } = require("../helper/announcementService");
    await clearAnnouncement();
    res.json({ success: true, message: "Announcement cleared" });
  } catch (error) {
    res.status(500).json({ success: false, error: error.message });
  }
}

module.exports = {
  readDb,
  cleanupDatabase,
  getDatabaseStats,
  cleanupLogs,
  rescheduleAllCronJobs,
  getSchedulerQueue,
  dispatchSinglePreview,
  getSuppressionsList,
  unsuppressEmail,
  getAdminAnnouncements,
  createAnnouncement,
  clearActiveAnnouncement,
};
