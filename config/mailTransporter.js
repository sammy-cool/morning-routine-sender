const { createTransporter, closeTransporter } = require("./email-config");

// Same lazy-singleton pattern that used to live directly in index.js:
// the transporter is only created on first use, and both the route handler
// and graceful shutdown need to see the SAME instance -- so the singleton
// state lives here now instead of as a module-scoped `let` in index.js.
let transporter = null;

function getTransporter() {
  if (!transporter) {
    transporter = createTransporter();
  }
  return transporter;
}

// Mirrors the exact shutdown logic that used to be inline in index.js's
// gracefulShutdown(): only close if one was ever created, then clear it.
async function closeTransporterConnection() {
  if (transporter) {
    await closeTransporter(transporter);
    transporter = null;
  }
}

module.exports = { getTransporter, closeTransporterConnection };
