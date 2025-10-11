// ./logger.js
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");
const util = require("util");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
  console.log("✅ Logs directory created");
}

// Safe JSON stringify that handles circular references
function safeStringify(obj, indent = 2) {
  let cache = [];
  const retVal = JSON.stringify(
    obj,
    (key, value) =>
      typeof value === "object" && value !== null
        ? cache.includes(value)
          ? "[Circular]"
          : cache.push(value) && value
        : value,
    indent
  );
  cache = null;
  return retVal;
}

// Custom format for console output
const consoleFormat = winston.format.combine(
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, ...meta }) => {
    let metaStr = "";
    if (Object.keys(meta).length > 0) {
      try {
        metaStr = safeStringify(meta, 2);
      } catch (e) {
        metaStr = util.inspect(meta, {
          depth: 3,
          colors: true,
          compact: false,
        });
      }
    }
    return `[${timestamp}] ${level}: ${message} ${metaStr}`;
  })
);

// JSON format for file output
const fileFormat = winston.format.combine(
  winston.format.timestamp(),
  winston.format.errors({ stack: true }),
  winston.format.json({
    replacer: (key, value) => {
      if (typeof value === "object" && value !== null) {
        if (value.constructor && value.constructor.name === "SMTPPool") {
          return "[SMTPPool Object]";
        }
        if (value.constructor && value.constructor.name === "Mail") {
          return "[Mail Object]";
        }
      }
      return value;
    },
  })
);

// Daily rotate transport for all logs (kept for 3 days)
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "3d", // Keep logs for 3 days
  maxSize: "20m", // Max 20MB per file
  format: fileFormat,
  zippedArchive: true, // Compress old logs
});

// Daily rotate transport for errors (kept for 7 days)
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "7d", // Keep error logs for 7 days
  maxSize: "20m",
  format: fileFormat,
  zippedArchive: true,
});

// Create logger
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: { service: "morning-routine-sender" },
  transports: [
    // Console output (human-readable)
    new winston.transports.Console({
      format: consoleFormat,
    }),

    // Daily rotating file - all logs
    dailyRotateTransport,

    // Daily rotating file - errors only
    errorRotateTransport,
  ],
});

// Listen to rotation events
dailyRotateTransport.on("rotate", (oldFilename, newFilename) => {
  console.log("📋 Log file rotated:", { oldFilename, newFilename });
});

dailyRotateTransport.on("logRemoved", (removedFilename) => {
  console.log("🗑️  Old log file removed:", removedFilename);
});

// Log unhandled errors
logger.exceptions.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, "exceptions-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "7d",
    format: fileFormat,
  })
);

logger.rejections.handle(
  new DailyRotateFile({
    filename: path.join(logsDir, "rejections-%DATE%.log"),
    datePattern: "YYYY-MM-DD",
    maxFiles: "7d",
    format: fileFormat,
  })
);

module.exports = logger;
