// ./logger.js
const winston = require("winston");
const DailyRotateFile = require("winston-daily-rotate-file");
const path = require("path");
const fs = require("fs");
const os = require("os");
const util = require("util");

// Ensure logs directory exists
const logsDir = path.join(__dirname, "logs");
if (!fs.existsSync(logsDir)) {
  fs.mkdirSync(logsDir, { recursive: true });
}

// Safe JSON stringify that handles circular references and functions
function safeStringify(obj, indent = 2) {
  const seen = new WeakSet();
  return JSON.stringify(
    obj,
    (key, value) => {
      if (typeof value === "function") return `[Function: ${value.name || "anonymous"}]`;
      if (typeof value === "bigint") return value.toString();
      if (typeof value === "object" && value !== null) {
        if (seen.has(value)) return "[Circular]";
        seen.add(value);
        if (value instanceof Error) {
          return {
            name: value.name,
            message: value.message,
            stack: value.stack,
            code: value.code,
            status: value.status || value.statusCode,
          };
        }
      }
      return value;
    },
    indent
  );
}

// Custom Error Formatter: recursively unwraps Error objects in info and metadata
const enumerateErrorFormat = winston.format((info) => {
  if (info instanceof Error) {
    Object.assign(info, {
      message: info.message,
      stack: info.stack,
      name: info.name,
      code: info.code,
    });
  }

  // Deep inspect metadata properties for nested Error instances
  for (const key of Object.keys(info)) {
    if (info[key] instanceof Error) {
      info[key] = {
        name: info[key].name,
        message: info[key].message,
        stack: info[key].stack,
        code: info[key].code,
        syscall: info[key].syscall,
        errno: info[key].errno,
        status: info[key].status || info[key].statusCode,
      };
    }
  }

  return info;
});

// Custom Format for Human-Readable, Highly-Actionable Console Logs
const consoleFormat = winston.format.combine(
  enumerateErrorFormat(),
  winston.format.timestamp({ format: "YYYY-MM-DD HH:mm:ss" }),
  winston.format.colorize(),
  winston.format.printf(({ timestamp, level, message, stack, ...meta }) => {
    // Filter out standard default metadata for cleaner console output
    const cleanMeta = { ...meta };
    delete cleanMeta.service;
    delete cleanMeta.environment;
    delete cleanMeta.pid;
    delete cleanMeta.hostname;

    let metaStr = "";
    if (Object.keys(cleanMeta).length > 0) {
      try {
        metaStr = "\n  " + safeStringify(cleanMeta, 2).replace(/\n/g, "\n  ");
      } catch (e) {
        metaStr = "\n  " + util.inspect(cleanMeta, { depth: 3, colors: true });
      }
    }

    let stackStr = "";
    if (stack) {
      stackStr = `\n  ${stack.replace(/\n/g, "\n  ")}`;
    }

    return `[${timestamp}] ${level}: ${message}${metaStr}${stackStr}`;
  })
);

// Structured JSON Format for File Logs (for analysis & alerting)
const fileFormat = winston.format.combine(
  enumerateErrorFormat(),
  winston.format.timestamp({ format: "YYYY-MM-DDTHH:mm:ss.SSSZ" }),
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

// Daily rotate transport for all logs (3-day retention)
const dailyRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, "app-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  maxFiles: "3d",
  maxSize: "20m",
  format: fileFormat,
  zippedArchive: true,
});

// Daily rotate transport for errors (7-day retention)
const errorRotateTransport = new DailyRotateFile({
  filename: path.join(logsDir, "error-%DATE%.log"),
  datePattern: "YYYY-MM-DD",
  level: "error",
  maxFiles: "7d",
  maxSize: "20m",
  format: fileFormat,
  zippedArchive: true,
});

let fileLoggingAvailable = false;
try {
  if (!fs.existsSync(logsDir)) {
    fs.mkdirSync(logsDir, { recursive: true });
  }
  fs.accessSync(logsDir, fs.constants.W_OK);
  fileLoggingAvailable = true;
} catch (err) {
  // Console logging fallback if disk is read-only
}

// Create Master Logger
const transports = [
  new winston.transports.Console({
    format: consoleFormat,
  }),
];

if (fileLoggingAvailable) {
  dailyRotateTransport.on("error", (err) => {
    // Non-fatal stream error
  });
  errorRotateTransport.on("error", (err) => {
    // Non-fatal stream error
  });
  transports.push(dailyRotateTransport, errorRotateTransport);
}

const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || "info",
  defaultMeta: {
    service: "morning-routine-sender",
    environment: process.env.NODE_ENV || "development",
    pid: process.pid,
    hostname: os.hostname(),
  },
  exitOnError: false,
  transports,
});

if (fileLoggingAvailable) {
  dailyRotateTransport.on("rotate", (oldFilename, newFilename) => {
    logger.info("📋 Log file rotated", { oldFilename, newFilename });
  });

  dailyRotateTransport.on("logRemoved", (removedFilename) => {
    logger.info("🗑️  Old log file removed", { removedFilename });
  });

  try {
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
  } catch (err) {
    // Ignore exception transport error
  }
}

/**
 * Express Request Logger Middleware
 * Captures Method, Path, Status Code, Duration, IP, and User-Agent
 */
logger.requestLogger = function (req, res, next) {
  const start = Date.now();
  const originalEnd = res.end;

  res.end = function (...args) {
    const duration = Date.now() - start;
    const statusCode = res.statusCode;

    // Filter out static health checks or assets if desired, or log everything
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      statusCode,
      durationMs: duration,
      ip: req.ip || req.headers["x-forwarded-for"] || req.socket.remoteAddress,
      userAgent: req.get("user-agent") || "unknown",
    };

    if (statusCode >= 500) {
      logger.error(`HTTP ${req.method} ${req.originalUrl} ${statusCode} [${duration}ms]`, logData);
    } else if (statusCode >= 400) {
      logger.warn(`HTTP ${req.method} ${req.originalUrl} ${statusCode} [${duration}ms]`, logData);
    } else {
      logger.info(`HTTP ${req.method} ${req.originalUrl} ${statusCode} [${duration}ms]`, logData);
    }

    originalEnd.apply(res, args);
  };

  next();
};

module.exports = logger;
