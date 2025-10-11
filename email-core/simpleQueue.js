// email-core/simple-queue.js
const EventEmitter = require("events");
const logger = require("../logger");

class SimpleQueue extends EventEmitter {
  constructor(name) {
    super();
    this.name = name;
    this.jobs = [];
    this.processing = false;
    logger.info(`Simple in-memory queue created: ${name}`);
  }

  async add(jobName, data, options = {}) {
    const job = {
      id: `${Date.now()}-${Math.random()}`,
      name: jobName,
      data,
      options,
      status: "waiting",
      attempts: 0,
      timestamp: new Date(),
    };

    this.jobs.push(job);
    logger.info("Job added to queue", { jobId: job.id, jobName });

    // Process immediately if not already processing
    if (!this.processing) {
      setImmediate(() => this.processNext());
    }

    return job;
  }

  async processNext() {
    if (this.processing || this.jobs.length === 0) return;

    this.processing = true;
    const job = this.jobs.shift();

    try {
      job.status = "active";
      logger.info("Processing job", { jobId: job.id });

      if (this.processor) {
        await this.processor(job);
        job.status = "completed";
        this.emit("completed", job);
        logger.info("Job completed", { jobId: job.id });
      }
    } catch (error) {
      job.status = "failed";
      job.error = error.message;
      job.attempts++;

      logger.error("Job failed", {
        jobId: job.id,
        error: error.message,
        attempts: job.attempts,
      });

      // Retry logic
      if (job.attempts < 3) {
        this.jobs.push(job);
        logger.info("Job queued for retry", { jobId: job.id });
      } else {
        this.emit("failed", job, error);
      }
    } finally {
      this.processing = false;

      // Process next job if available
      if (this.jobs.length > 0) {
        setImmediate(() => this.processNext());
      }
    }
  }

  process(processor) {
    this.processor = processor;
    this.processNext();
  }

  async getWaitingCount() {
    return this.jobs.filter((j) => j.status === "waiting").length;
  }

  async getActiveCount() {
    return this.jobs.filter((j) => j.status === "active").length;
  }

  async close() {
    logger.info(`Queue closed: ${this.name}`);
  }
}

module.exports = { SimpleQueue };
