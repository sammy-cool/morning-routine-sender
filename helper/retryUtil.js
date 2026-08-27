// retryUtil.js
const logger = require("../logger");

async function retry(fn, retries = 3, delayMs = 2000, context = "operation") {
  for (let i = 1; i <= retries; i++) {
    try {
      return await fn();
    } catch (err) {
      if (i < retries) {
        logger.warn(`Retry attempt ${i}/${retries} failed for ${context}. Retrying in ${delayMs}ms...`, {
          attempt: i,
          maxRetries: retries,
          delayMs,
          error: err.message || err,
        });
        await new Promise((res) => setTimeout(res, delayMs));
      } else {
        logger.error(`All ${retries} retry attempts exhausted for ${context}`, {
          error: err.message || err,
          stack: err.stack,
        });
        throw err;
      }
    }
  }
}
module.exports = { retry };
