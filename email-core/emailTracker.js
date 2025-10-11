// email-core/emailTracker.js
const fs = require("fs");
const path = require("path");
const logger = require("../logger");
const db = require("../db/knex");

const ROOT_DIR = process.cwd();
const TRACK_DIR = path.join(ROOT_DIR, "storage");
const TRACK_FILE = path.join(TRACK_DIR, "email-tracker.json");

// ✅ Ensure the folder exists before saving the file
function ensureStorageDirExists() {
  if (!fs.existsSync(TRACK_DIR)) {
    fs.mkdirSync(TRACK_DIR, { recursive: true });
    console.log("Created tracker storage folder:", TRACK_DIR);
  }
}

function getTodayDate() {
  return new Date().toISOString().slice(0, 10);
}

function loadTracker() {
  try {
    if (!fs.existsSync(TRACK_FILE)) return {};
    const data = fs.readFileSync(TRACK_FILE, "utf-8");
    return JSON.parse(data);
  } catch (err) {
    console.error("Failed to load tracker:", err);
    return {};
  }
}

function saveTracker(tracker) {
  try {
    ensureStorageDirExists();
    fs.writeFileSync(TRACK_FILE, JSON.stringify(tracker, null, 2));
  } catch (err) {
    console.error("Failed to save tracker:", err);
  }
}

function shouldSendEmail(userEmail, type) {
  const tracker = loadTracker();
  const key = `${type}:${userEmail}`;
  const record = tracker[key];
  const today = getTodayDate();

  // Send if never sent today successfully
  return !record || record.date !== today || record.status !== "success";
}

function updateTracker(userEmail, type, status, error = null) {
  const tracker = loadTracker();
  const key = `${type}:${userEmail}`;

  tracker[key] = {
    date: getTodayDate(),
    status,
    error,
  };

  saveTracker(tracker);
  logger.info(`Tracker updated for ${key}: ${status}`);
}

function cleanupOldEntries(days = 7) {
  const tracker = loadTracker();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - days);

  let removedCount = 0;

  for (const [key, record] of Object.entries(tracker)) {
    const recordDate = new Date(record.date);
    if (recordDate < cutoff) {
      delete tracker[key];
      removedCount++;
    }
  }

  saveTracker(tracker);
  console.log(`Cleaned up ${removedCount} old entries from tracker.`);
}

module.exports = {
  shouldSendEmail,
  updateTracker,
  cleanupOldEntries,
};

class EmailTracker {
  /**
   * Record a successful email send
   */
  async recordSend(recipient, templateType, messageId, metadata = {}) {
    try {
      await db("email_tracker").insert({
        recipient_email: recipient,
        template_type: templateType,
        sent_at: new Date(),
        status: "success",
        message_id: messageId,
        metadata: JSON.stringify(metadata),
        retry_count: 0,
      });
      logger.info("Email send recorded", {
        recipient,
        templateType,
        messageId,
      });
    } catch (error) {
      logger.error("Failed to record email send", {
        error: error.message,
        recipient,
      });
      // Don't throw - tracking failure shouldn't break email sending
    }
  }

  /**
   * Record a failed email attempt
   */
  async recordFailure(recipient, templateType, errorMessage, retryCount = 0) {
    try {
      await db("email_tracker").insert({
        recipient_email: recipient,
        template_type: templateType,
        sent_at: new Date(),
        status: "failed",
        error_message: errorMessage,
        retry_count: retryCount,
      });
      logger.warn("Email failure recorded", {
        recipient,
        templateType,
        retryCount,
      });
    } catch (error) {
      logger.error("Failed to record email failure", {
        error: error.message,
        recipient,
      });
    }
  }

  /**
   * Check if email was already sent today (idempotency)
   */
  async wasEmailSentToday(recipient, templateType) {
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await db("email_tracker")
        .where({
          recipient_email: recipient,
          template_type: templateType,
          status: "success",
        })
        .where("sent_at", ">=", today)
        .first();

      return !!result;
    } catch (error) {
      logger.error("Failed to check email history", {
        error: error.message,
        recipient,
      });
      return false; // Fail open to avoid blocking sends
    }
  }

  /**
   * Get send history for a recipient
   */
  async getHistory(recipient, limit = 10) {
    try {
      return await db("email_tracker")
        .where({ recipient_email: recipient })
        .orderBy("sent_at", "desc")
        .limit(limit);
    } catch (error) {
      logger.error("Failed to fetch email history", {
        error: error.message,
        recipient,
      });
      return [];
    }
  }

  /**
   * Get statistics for a date range
   */
  async getStats(startDate, endDate) {
    try {
      const stats = await db("email_tracker")
        .where("sent_at", ">=", startDate)
        .where("sent_at", "<=", endDate)
        .select(
          db.raw("COUNT(*) as total"),
          db.raw(
            "SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful"
          ),
          db.raw(
            "SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed"
          ),
          db.raw("AVG(retry_count) as avg_retries")
        )
        .first();

      return stats;
    } catch (error) {
      logger.error("Failed to fetch email stats", { error: error.message });
      return null;
    }
  }

  /**
   * Update job last run timestamp
   */
  async updateJobRun(jobName, emailsSent, emailsFailed, errorDetails = null) {
    try {
      const existing = await db("job_last_run")
        .where({ job_name: jobName })
        .first();

      if (existing) {
        await db("job_last_run")
          .where({ job_name: jobName })
          .update({
            last_run_at: new Date(),
            status: emailsFailed > 0 ? "failed" : "success",
            emails_sent: emailsSent,
            emails_failed: emailsFailed,
            error_details: errorDetails,
            updated_at: new Date(),
          });
      } else {
        await db("job_last_run").insert({
          job_name: jobName,
          last_run_at: new Date(),
          status: emailsFailed > 0 ? "failed" : "success",
          emails_sent: emailsSent,
          emails_failed: emailsFailed,
          error_details: errorDetails,
        });
      }

      logger.info("Job run recorded", { jobName, emailsSent, emailsFailed });
    } catch (error) {
      logger.error("Failed to update job run", {
        error: error.message,
        jobName,
      });
    }
  }

  /**
   * Get last successful run for a job
   */
  async getLastJobRun(jobName) {
    try {
      return await db("job_last_run").where({ job_name: jobName }).first();
    } catch (error) {
      logger.error("Failed to fetch last job run", {
        error: error.message,
        jobName,
      });
      return null;
    }
  }

  /**
   * Graceful cleanup on shutdown
   */
  async close() {
    try {
      await db.destroy();
      logger.info("Database connection closed");
    } catch (error) {
      logger.error("Failed to close database", { error: error.message });
    }
  }
}

module.exports = new EmailTracker();
