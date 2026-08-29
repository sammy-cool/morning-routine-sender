// helper/errorClassifier.js

/**
 * Determines whether an error is transient (retryable) or permanent.
 * @param {Error|object|string} error - The error to classify
 * @returns {boolean} True if transient/retryable, false if permanent
 */
function isRetryableError(error) {
  if (!error) return false;

  const errObj = typeof error === "string" ? { message: error } : error;
  const message = (errObj.message || "").toLowerCase();
  const code = (errObj.code || "").toUpperCase();
  const responseCode = Number(errObj.responseCode) || 0;

  // 1. Explicit permanent non-retryable codes
  const permanentCodes = [
    "EAUTH",
    "EENVELOPE",
    "EMJML",
    "ETEMPLATE",
    "EBADENGINE",
    "ENOENT",
    "EINVALIDRECIPIENT",
  ];
  if (permanentCodes.includes(code)) return false;

  // 2. Permanent SMTP 5xx rejections (e.g. 550 Mailbox does not exist, 554 Transaction failed)
  if (responseCode >= 500 && responseCode < 600 && responseCode !== 503) {
    return false;
  }

  // 3. Known transient network & socket error codes
  const transientCodes = [
    "ETIMEDOUT",
    "ECONNRESET",
    "ECONNREFUSED",
    "ENOTFOUND",
    "EAI_AGAIN",
    "ESOCKETTIMEDOUT",
    "EPIPE",
    "EHOSTUNREACH",
    "ENETUNREACH",
    "ECONNABORTED",
    "RATE_LIMIT",
  ];
  if (transientCodes.includes(code)) return true;

  // 4. Temporary SMTP 4xx errors (e.g. 421 Server busy, 450 Mailbox locked, 451 Local error, 452 Storage full)
  if (responseCode >= 400 && responseCode < 500) {
    return true;
  }

  // 5. Common transient error message keywords
  const transientKeywords = [
    "timeout",
    "timed out",
    "greeting never received",
    "connection closed",
    "socket closed",
    "connection reset",
    "temporarily unavailable",
    "try again later",
    "rate limit",
    "too many connections",
    "busy",
    "service unavailable",
  ];

  return transientKeywords.some((kw) => message.includes(kw));
}

module.exports = {
  isRetryableError,
};
