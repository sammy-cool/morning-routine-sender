// __tests__/retry.metadata.test.js
const { isRetryableError } = require("../helper/errorClassifier");
const { retryWithBackoff } = require("../helper/retryUtil");
const { serializeErrorForDb } = require("../helper/errorSerializer");
const { newDb } = require("pg-mem");

describe("Error Classification & Retry Engine", () => {
  test("classifies transient network and timeout errors as retryable", () => {
    expect(isRetryableError({ code: "ETIMEDOUT", message: "Connection timed out" })).toBe(true);
    expect(isRetryableError({ code: "ECONNRESET", message: "Socket hung up" })).toBe(true);
    expect(isRetryableError({ code: "ECONNREFUSED", message: "Connection refused" })).toBe(true);
    expect(
      isRetryableError({
        responseCode: 421,
        message: "Service not available, closing transmission channel",
      }),
    ).toBe(true);
    expect(
      isRetryableError({
        responseCode: 451,
        message: "Requested action aborted: local error in processing",
      }),
    ).toBe(true);
    expect(isRetryableError("Connection closed by remote host unexpectedly")).toBe(true);
  });

  test("classifies permanent errors as non-retryable", () => {
    expect(isRetryableError({ code: "EAUTH", message: "Invalid SMTP login credentials" })).toBe(
      false,
    );
    expect(
      isRetryableError({ code: "EMJML", message: "ValidationError: div element invalid" }),
    ).toBe(false);
    expect(isRetryableError({ code: "ETEMPLATE", message: "Template not found" })).toBe(false);
    expect(isRetryableError({ responseCode: 550, message: "5.1.1 User unknown" })).toBe(false);
    expect(isRetryableError({ responseCode: 554, message: "5.7.1 Delivery not authorized" })).toBe(
      false,
    );
    expect(isRetryableError(null)).toBe(false);
  });

  test("retryWithBackoff succeeds immediately when operation succeeds on 1st attempt", async () => {
    const fn = jest.fn().mockResolvedValue({ messageId: "msg-123" });
    const res = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 });

    expect(res.result).toEqual({ messageId: "msg-123" });
    expect(res.retries).toBe(0);
    expect(res.totalAttempts).toBe(1);
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("retryWithBackoff recovers and returns retry count when transient error resolves on retry", async () => {
    let callCount = 0;
    const fn = jest.fn().mockImplementation(async () => {
      callCount++;
      if (callCount < 3) {
        const err = new Error("Temporary SMTP socket timeout");
        err.code = "ETIMEDOUT";
        throw err;
      }
      return { messageId: "recovered-msg-456" };
    });

    const onRetry = jest.fn();
    const res = await retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10, onRetry });

    expect(res.result).toEqual({ messageId: "recovered-msg-456" });
    expect(res.retries).toBe(2);
    expect(res.totalAttempts).toBe(3);
    expect(fn).toHaveBeenCalledTimes(3);
    expect(onRetry).toHaveBeenCalledTimes(2);
  });

  test("retryWithBackoff throws immediately without retrying on permanent non-retryable error", async () => {
    const fn = jest.fn().mockImplementation(async () => {
      const err = new Error("550 Mailbox not found");
      err.responseCode = 550;
      throw err;
    });

    await expect(retryWithBackoff(fn, { maxRetries: 3, baseDelayMs: 10 })).rejects.toThrow(
      "550 Mailbox not found",
    );
    expect(fn).toHaveBeenCalledTimes(1);
  });

  test("serializeErrorForDb extracts non-enumerable properties and stack frames cleanly", () => {
    const err = new Error("SMTP connection timed out");
    err.code = "ETIMEDOUT";
    err.syscall = "connect";
    err.responseCode = 421;

    const serialized = serializeErrorForDb(err, { phase: "smtp_handshake", attempts: 2 });
    expect(serialized.name).toBe("Error");
    expect(serialized.message).toBe("SMTP connection timed out");
    expect(serialized.code).toBe("ETIMEDOUT");
    expect(serialized.syscall).toBe("connect");
    expect(serialized.responseCode).toBe(421);
    expect(serialized.phase).toBe("smtp_handshake");
    expect(serialized.attempts).toBe(2);
    expect(serialized.stack).toBeDefined();
    expect(typeof serialized.failedAt).toBe("string");
  });
});

describe("Database Email Tracker & Metadata Persistence", () => {
  let memDb;
  let knex;

  beforeEach(async () => {
    memDb = newDb();
    knex = memDb.adapters.createKnex();

    // Create email_tracker table
    await knex.schema.createTable("email_tracker", (table) => {
      table.increments("id").primary();
      table.string("recipient_email", 255).notNullable();
      table.string("template_type", 100).notNullable();
      table.timestamp("sent_at").notNullable();
      table.string("status", 50).notNullable();
      table.text("error_message").nullable();
      table.integer("retry_count").defaultTo(0);
      table.string("message_id", 255).nullable();
      table.text("metadata").nullable();
      table.timestamp("created_at").defaultTo(knex.fn.now());
      table.timestamp("updated_at").defaultTo(knex.fn.now());
    });
  });

  afterEach(async () => {
    await knex.destroy();
  });

  test("saves successful email send with retry count and custom metadata", async () => {
    const meta = { routineTrack: "deep-work", dayNumber: "01", scheduled: true };
    await knex("email_tracker").insert({
      recipient_email: "test@example.com",
      template_type: "deep-work",
      sent_at: new Date(),
      status: "success",
      message_id: "msg-999",
      retry_count: 1,
      metadata: JSON.stringify(meta),
    });

    const record = await knex("email_tracker").where("recipient_email", "test@example.com").first();
    expect(record.status).toBe("success");
    expect(record.retry_count).toBe(1);
    expect(record.message_id).toBe("msg-999");
    expect(JSON.parse(record.metadata)).toEqual(meta);
  });

  test("saves failed email send with rich diagnostic metadata and error details", async () => {
    const errorDetails = {
      message: "Connection closed unexpectedly",
      code: "ECONNRESET",
      totalAttempts: 4,
      phase: "smtp_dispatch",
      isRetryable: true,
    };

    await knex("email_tracker").insert({
      recipient_email: "fail@example.com",
      template_type: "executive",
      sent_at: new Date(),
      status: "failed",
      error_message: errorDetails.message,
      retry_count: 3,
      metadata: JSON.stringify(errorDetails),
    });

    const record = await knex("email_tracker").where("recipient_email", "fail@example.com").first();
    expect(record.status).toBe("failed");
    expect(record.retry_count).toBe(3);
    expect(record.error_message).toBe("Connection closed unexpectedly");
    const parsed = JSON.parse(record.metadata);
    expect(parsed.code).toBe("ECONNRESET");
    expect(parsed.totalAttempts).toBe(4);
  });
});
