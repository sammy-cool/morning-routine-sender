// helper/errorSerializer.js

/**
 * Normalizes and extracts diagnostic details from an error for DB persistence and logging.
 * Handles native Error non-enumerable properties cleanly.
 * @param {Error|Object|string} error
 * @param {Object} [context={}]
 * @returns {Object} Clean JSON-serializable diagnostic metadata object
 */
function serializeErrorForDb(error, context = {}) {
  if (!error) {
    return {
      message: "Unknown error",
      failedAt: new Date().toISOString(),
      ...context,
    };
  }

  if (typeof error === "string") {
    return {
      message: error,
      failedAt: new Date().toISOString(),
      ...context,
    };
  }

  const serialized = {
    name: error.name || "Error",
    message: error.message || String(error),
    code: error.code || null,
    syscall: error.syscall || null,
    command: error.command || null,
    responseCode: error.responseCode || null,
    response: error.response || null,
    failedAt: new Date().toISOString(),
  };

  if (error.stack) {
    // Retain top 5 frames for compact debugging
    serialized.stack = error.stack
      .split(/\r?\n/)
      .slice(0, 5)
      .map((s) => s.trim())
      .join(" | ");
  }

  return {
    ...serialized,
    ...context,
  };
}

module.exports = {
  serializeErrorForDb,
};
