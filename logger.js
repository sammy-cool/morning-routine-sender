const winston = require("winston");

const logger = winston.createLogger({
  level: "info", // Log 'info' level and above (info, error, etc.)
  format: winston.format.combine(
    winston.format.timestamp(), // Add timestamps
    winston.format.json() // Use JSON format for logs
  ),
  transports: [
    // Save errors to error.log
    new winston.transports.File({ filename: "error.log", level: "error" }),
    // Save all logs (info, error, etc.) to combined.log
    new winston.transports.File({ filename: "combined.log" }),
  ],
});

// In development, also log to the console for easy debugging
if (process.env.NODE_ENV !== "production") {
  logger.add(
    new winston.transports.Console({
      format: winston.format.simple(), // Simple format for console readability
    })
  );
}

module.exports = logger;
