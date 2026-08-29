// email-core/emailTracker.js
const logger = require("../logger");
const db = require("../db/knex");
const { serializeErrorForDb } = require("../helper/errorSerializer");

class EmailTracker {
  /**
   * Record a successful email send
   */
  async recordSend(recipient, templateType, messageId, metadata = {}, retryCount = 0) {
    try {
      const normalizedRecipient = (recipient || "").toLowerCase().trim();
      const metaObj = metadata && typeof metadata === "object" ? metadata : {};
      if (retryCount > 0) {
        metaObj.retryCount = retryCount;
        metaObj.recovered = true;
      }

      await db("email_tracker").insert({
        recipient_email: normalizedRecipient,
        template_type: templateType,
        sent_at: new Date(),
        status: "success",
        message_id: messageId,
        metadata: metaObj,
        retry_count: retryCount,
      });

      logger.info("Email send recorded", {
        recipient: normalizedRecipient,
        templateType,
        messageId,
        retryCount,
        metadata: metaObj,
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
   * Record a failed email attempt with rich diagnostic metadata
   */
  async recordFailure(recipient, templateType, errorOrMessage, retryCount = 0, metadata = {}) {
    try {
      const normalizedRecipient = (recipient || "").toLowerCase().trim();
      const isErrorObj = errorOrMessage instanceof Error;
      const errorMessage = isErrorObj
        ? errorOrMessage.message || String(errorOrMessage)
        : String(errorOrMessage || "Unknown email dispatch failure");

      const errorDetails = isErrorObj
        ? serializeErrorForDb(errorOrMessage, { ...metadata, retryCount })
        : { message: errorMessage, ...metadata, retryCount };

      await db("email_tracker").insert({
        recipient_email: normalizedRecipient,
        template_type: templateType,
        sent_at: new Date(),
        status: "failed",
        error_message: errorMessage.substring(0, 1000),
        retry_count: retryCount,
        metadata: errorDetails,
      });

      logger.warn("Email failure recorded", {
        recipient: normalizedRecipient,
        templateType,
        retryCount,
        errorCode: isErrorObj ? errorOrMessage.code : undefined,
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
  async wasEmailSentToday(recipient, templateType, timezone = "UTC") {
    try {
      const normalizedRecipient = (recipient || "").toLowerCase().trim();
      const now = new Date();
      const todayStr = now.toLocaleDateString("en-CA", { timeZone: timezone }); // YYYY-MM-DD

      const client = db.client?.config?.client || "";
      const isPostgres = client === "pg" || client === "postgresql";

      let query = db("email_tracker").where({
        recipient_email: normalizedRecipient,
        template_type: templateType,
        status: "success",
      });

      if (isPostgres) {
        query = query.whereRaw("DATE(sent_at AT TIME ZONE ?) = ?", [timezone, todayStr]);
      } else {
        // SQLite / pg-mem fallback
        query = query.whereRaw("DATE(sent_at) = ?", [todayStr]);
      }

      const result = await query.first();
      return Boolean(result);
    } catch (error) {
      logger.error("Failed to check email history", {
        error: error.message,
        recipient,
      });
      return false; // Fail open to avoid blocking sends
    }
  }

  /**
   * Get send history for a recipient with parsed metadata
   */
  async getHistory(recipient, limit = 10) {
    try {
      const normalizedRecipient = (recipient || "").toLowerCase().trim();
      const rows = await db("email_tracker")
        .where({ recipient_email: normalizedRecipient })
        .orderBy("sent_at", "desc")
        .limit(limit);

      return (rows || []).map((row) => {
        if (row && typeof row.metadata === "string") {
          try {
            row.metadata = JSON.parse(row.metadata);
          } catch (_parseErr) {
            // Keep raw string if malformed JSON
          }
        }
        return row;
      });
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
          db.raw("SUM(CASE WHEN status = 'success' THEN 1 ELSE 0 END) as successful"),
          db.raw("SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed"),
          db.raw("AVG(retry_count) as avg_retries"),
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
      await db("job_last_run")
        .insert({
          job_name: jobName,
          last_run_at: new Date(),
          status: emailsFailed > 0 ? "failed" : "success",
          emails_sent: emailsSent,
          emails_failed: emailsFailed,
          error_details: errorDetails,
        })
        .onConflict("job_name")
        .merge({
          last_run_at: new Date(),
          status: emailsFailed > 0 ? "failed" : "success",
          emails_sent: emailsSent,
          emails_failed: emailsFailed,
          error_details: errorDetails,
          updated_at: new Date(),
        });

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
