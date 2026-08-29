// helper/retryUtil.js
const { isRetryableError } = require("./errorClassifier");

/**
 * Executes an async function with exponential backoff and jitter retry policy.
 * @param {Function} fn - Async operation receiving (attemptNumber: 0-indexed)
 * @param {Object} options - Configuration options
 * @param {number} [options.maxRetries=3] - Maximum retry attempts after initial try
 * @param {number} [options.baseDelayMs=1500] - Base delay in ms
 * @param {number} [options.maxDelayMs=15000] - Maximum delay cap in ms
 * @param {Function} [options.isRetryable=isRetryableError] - Predicate to test if error should be retried
 * @param {Function} [options.onRetry] - Callback invoked before each retry delay
 * @returns {Promise<{ result: any, retries: number, totalAttempts: number }>}
 */
async function retryWithBackoff(fn, options = {}) {
  const {
    maxRetries = 3,
    baseDelayMs = 1500,
    maxDelayMs = 15000,
    isRetryable = isRetryableError,
    onRetry = null,
  } = options;

  let attempt = 0;

  while (true) {
    try {
      const result = await fn(attempt);
      return {
        result,
        retries: attempt,
        totalAttempts: attempt + 1,
      };
    } catch (error) {
      attempt++;

      const shouldRetry = attempt <= maxRetries && isRetryable(error);

      if (!shouldRetry) {
        error.retriesExecuted = attempt - 1;
        error.totalAttempts = attempt;
        error.isRetryable = isRetryable(error);
        throw error;
      }

      // Full Jitter Exponential Backoff: random between 0 and min(maxDelayMs, baseDelayMs * 2^(attempt-1))
      const expCap = Math.min(maxDelayMs, baseDelayMs * Math.pow(2, attempt - 1));
      const jitterDelay = Math.floor(Math.random() * (expCap / 2)) + Math.floor(expCap / 2);

      if (typeof onRetry === "function") {
        try {
          await onRetry({
            error,
            attempt,
            maxRetries,
            nextDelayMs: jitterDelay,
          });
        } catch (_) {
          // Callback failure shouldn't abort retry flow
        }
      }

      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
}

module.exports = {
  retryWithBackoff,
};
