// email-core/emailWorker.js
const { Worker } = require("bullmq");
const { createRedisConnection } = require("../config/redis-config");
const { createTransporter } = require("../config/email-config");
const emailTracker = require("./emailTracker");
const emailService = require("./emailService");
const logger = require("../logger");

// Create Redis connection for worker
const connection = createRedisConnection();

// Create email transporter
const transporter = createTransporter();

/**
 * Process email job
 * @param {Job} job - BullMQ job object
 */
async function processEmailJob(job) {
  const { recipient, templateType, timestamp } = job.data;

  logger.info("Processing email job", {
    jobId: job.id,
    recipient,
    templateType,
    attempt: job.attemptsMade + 1,
  });

  try {
    // Check if already sent today (idempotency)
    const alreadySent = await emailTracker.wasEmailSentToday(
      recipient,
      templateType
    );

    if (alreadySent) {
      logger.info("Email already sent today, skipping", {
        recipient,
        templateType,
      });
      return { status: "skipped", reason: "already_sent_today" };
    }

    // Send email using emailService
    const result = await emailService.sendRoutineEmail(
      transporter,
      recipient,
      templateType
    );

    // Record successful send
    await emailTracker.recordSend(recipient, templateType, result.messageId, {
      jobId: job.id,
      attemptsMade: job.attemptsMade + 1,
    });

    logger.info("Email sent successfully", {
      jobId: job.id,
      recipient,
      messageId: result.messageId,
    });

    return {
      status: "success",
      messageId: result.messageId,
      recipient,
    };
  } catch (error) {
    // Record failure
    await emailTracker.recordFailure(
      recipient,
      templateType,
      error.message,
      job.attemptsMade + 1
    );

    logger.error("Email send failed", {
      jobId: job.id,
      recipient,
      error: error.message,
      attempt: job.attemptsMade + 1,
    });

    // Throw error to trigger BullMQ retry mechanism
    throw error;
  }
}

/**
 * Create and start email worker
 * @param {number} concurrency - Number of concurrent jobs to process
 */
function createEmailWorker(concurrency = 5) {
  const worker = new Worker("morning-routine-emails", processEmailJob, {
    connection,
    concurrency,

    // Limit duration of job execution
    lockDuration: 30000, // 30 seconds

    // Settings for failed jobs
    settings: {
      // Backoff strategy
      backoffStrategy: (attemptsMade, type, error, job) => {
        // Custom backoff logic if needed
        return Math.min(attemptsMade * 5000, 60000); // Max 1 minute
      },
    },
  });

  // Worker event listeners
  worker.on("completed", (job, result) => {
    logger.info("Job completed", {
      jobId: job.id,
      result,
    });
  });

  worker.on("failed", (job, error) => {
    logger.error("Job failed", {
      jobId: job?.id,
      error: error.message,
      attemptsMade: job?.attemptsMade,
    });
  });

  worker.on("error", (error) => {
    console.log("GGGGGGGG", error);
  });

  worker.on("stalled", (jobId) => {
    logger.warn("Job stalled", { jobId });
  });

  logger.info("Email worker started", { concurrency });

  return worker;
}

module.exports = { createEmailWorker };
