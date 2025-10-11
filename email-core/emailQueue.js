// email-core/emailQueue.js
const { Queue } = require("bullmq");
const { createRedisConnection } = require("../config/redis-config");
const logger = require("../logger");
// email-core/emailQueue.js - Modified for simple queue
const { SimpleQueue } = require("./simple-queue");

// Create simple in-memory queue
const emailQueue = new SimpleQueue("morning-routine-emails");

// ... rest of the functions remain similar but use SimpleQueue API

// Create Redis connection
// const connection = createRedisConnection();

/**
 * Queue for morning routine email jobs
 */
// const emailQueue = new Queue("morning-routine-emails", {
//   connection,

//   // Default job options (can be overridden per job)
//   defaultJobOptions: {
//     attempts: 3, // Retry up to 3 times
//     backoff: {
//       type: "exponential",
//       delay: 5000, // Start with 5 seconds, doubles each retry
//     },
//     removeOnComplete: {
//       age: 24 * 3600, // Keep successful jobs for 24 hours
//       count: 1000, // Keep max 1000 successful jobs
//     },
//     removeOnFail: {
//       age: 7 * 24 * 3600, // Keep failed jobs for 7 days
//     },
//   },
// });

// Queue event listeners for monitoring
emailQueue.on("error", (error) => {
  logger.error("Queue error:", { error: error.message });
});

emailQueue.on("waiting", (jobId) => {
  logger.debug("Job waiting:", { jobId });
});

emailQueue.on("added", (jobId) => {
  logger.info("Job added to queue:", { jobId });
});

/**
 * Add a single email job to the queue
 * @param {string} recipient - Recipient email address
 * @param {string} templateType - Template type (default, deep-work, etc.)
 * @param {object} data - Additional email data
 * @param {object} options - Job options (delay, priority, etc.)
 */
async function addEmailJob(recipient, templateType, data = {}, options = {}) {
  try {
    const jobData = {
      recipient,
      templateType,
      ...data,
      timestamp: new Date().toISOString(),
    };

    const job = await emailQueue.add("send-routine-email", jobData, {
      ...options,
      jobId: `${recipient}-${templateType}-${Date.now()}`, // Unique job ID
    });

    logger.info("Email job scheduled", {
      jobId: job.id,
      recipient,
      templateType,
    });

    return job;
  } catch (error) {
    logger.error("Failed to add email job", {
      error: error.message,
      recipient,
      templateType,
    });
    throw error;
  }
}

/**
 * Schedule daily routine email for a user
 * @param {string} recipient - Recipient email
 * @param {string} templateType - Template type
 * @param {string} cronPattern - Cron pattern (e.g., '0 8 * * *' for 8 AM daily)
 */
async function scheduleRepeatingJob(recipient, templateType, cronPattern) {
  try {
    const jobId = `recurring-${recipient}-${templateType}`;

    // Remove existing repeatable job if present
    const repeatableJobs = await emailQueue.getRepeatableJobs();
    const existing = repeatableJobs.find((job) => job.id === jobId);
    if (existing) {
      await emailQueue.removeRepeatableByKey(existing.key);
    }

    // Add new repeatable job
    const job = await emailQueue.add(
      "send-routine-email",
      {
        recipient,
        templateType,
        isRecurring: true,
      },
      {
        repeat: {
          pattern: cronPattern,
        },
        jobId,
      }
    );

    logger.info("Recurring email job scheduled", {
      jobId,
      recipient,
      templateType,
      cronPattern,
    });

    return job;
  } catch (error) {
    logger.error("Failed to schedule recurring job", {
      error: error.message,
      recipient,
      templateType,
    });
    throw error;
  }
}

/**
 * Schedule bulk emails (e.g., morning routine for all users)
 * @param {Array} recipients - Array of {email, templateType} objects
 */
async function scheduleBulkEmails(recipients) {
  try {
    const jobs = recipients.map((recipient) => ({
      name: "send-routine-email",
      data: {
        recipient: recipient.email,
        templateType: recipient.templateType || "default",
        timestamp: new Date().toISOString(),
      },
      opts: {
        jobId: `bulk-${recipient.email}-${Date.now()}`,
      },
    }));

    await emailQueue.addBulk(jobs);

    logger.info("Bulk email jobs scheduled", {
      count: recipients.length,
    });

    return jobs;
  } catch (error) {
    logger.error("Failed to schedule bulk emails", {
      error: error.message,
      count: recipients.length,
    });
    throw error;
  }
}

/**
 * Get queue stats
 */
async function getQueueStats() {
  try {
    const [waiting, active, completed, failed, delayed] = await Promise.all([
      emailQueue.getWaitingCount(),
      emailQueue.getActiveCount(),
      emailQueue.getCompletedCount(),
      emailQueue.getFailedCount(),
      emailQueue.getDelayedCount(),
    ]);

    return {
      waiting,
      active,
      completed,
      failed,
      delayed,
      total: waiting + active + completed + failed + delayed,
    };
  } catch (error) {
    logger.error("Failed to get queue stats", { error: error.message });
    return null;
  }
}

/**
 * Gracefully close queue connection
 */
async function closeQueue() {
  try {
    await emailQueue.close();
    await connection.quit();
    logger.info("Email queue closed");
  } catch (error) {
    logger.error("Error closing queue", { error: error.message });
  }
}

module.exports = {
  emailQueue,
  addEmailJob,
  scheduleRepeatingJob,
  scheduleBulkEmails,
  getQueueStats,
  closeQueue,
};
