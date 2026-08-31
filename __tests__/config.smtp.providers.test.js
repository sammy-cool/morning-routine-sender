/**
 * Test Suite: Config, SMTP Providers & Transporter Pool Tests
 * File: __tests__/config.smtp.providers.test.js
 */

const nodemailer = require("nodemailer");
const logger = require("../logger");

// Mock dependencies for isolated config testing
jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
  debug: jest.fn(),
}));

describe("1. SMTP Providers Registry (config/smtp-providers.js)", () => {
  const { SMTP_PROVIDERS, getProviderConfig } = require("../config/smtp-providers");

  test("contains standard provider presets with expected properties", () => {
    const expectedProviders = [
      "gmail",
      "outlook",
      "office365",
      "sendgrid",
      "mailgun",
      "ses",
      "zoho",
    ];

    expectedProviders.forEach((providerKey) => {
      const provider = SMTP_PROVIDERS[providerKey];
      expect(provider).toBeDefined();
      expect(typeof provider.host).toBe("string");
      expect(typeof provider.port).toBe("number");
      expect(typeof provider.secure).toBe("boolean");
      expect(typeof provider.requireTLS).toBe("boolean");
      expect(typeof provider.notes).toBe("string");
    });
  });

  test("verifies standard port defaults and TLS configurations", () => {
    // Gmail
    expect(SMTP_PROVIDERS.gmail.host).toBe("smtp.gmail.com");
    expect(SMTP_PROVIDERS.gmail.port).toBe(587);
    expect(SMTP_PROVIDERS.gmail.secure).toBe(false);
    expect(SMTP_PROVIDERS.gmail.requireTLS).toBe(true);

    // SendGrid preset has predefined user 'apikey'
    expect(SMTP_PROVIDERS.sendgrid.host).toBe("smtp.sendgrid.net");
    expect(SMTP_PROVIDERS.sendgrid.port).toBe(587);
    expect(SMTP_PROVIDERS.sendgrid.auth).toEqual({ user: "apikey" });

    // AWS SES
    expect(SMTP_PROVIDERS.ses.host).toContain("amazonaws.com");
    expect(SMTP_PROVIDERS.ses.port).toBe(587);

    // Mailgun
    expect(SMTP_PROVIDERS.mailgun.host).toBe("smtp.mailgun.org");
    expect(SMTP_PROVIDERS.mailgun.port).toBe(587);
  });

  test("getProviderConfig returns configuration case-insensitively", () => {
    expect(getProviderConfig("gmail")).toEqual(SMTP_PROVIDERS.gmail);
    expect(getProviderConfig("GMAIL")).toEqual(SMTP_PROVIDERS.gmail);
    expect(getProviderConfig("SendGrid")).toEqual(SMTP_PROVIDERS.sendgrid);
    expect(getProviderConfig("SES")).toEqual(SMTP_PROVIDERS.ses);
    expect(getProviderConfig("ZoHo")).toEqual(SMTP_PROVIDERS.zoho);
  });

  test("getProviderConfig returns null for non-existent or unknown providers", () => {
    expect(getProviderConfig("unknown_service")).toBeNull();
    expect(getProviderConfig("custom_mock")).toBeNull();
  });
});

describe("2. Environment Configuration & Validation (config/env.js)", () => {
  const originalEnv = process.env;
  let validateEnv;
  let REQUIRED;

  beforeEach(() => {
    jest.resetModules();
    process.env = { ...originalEnv };
    const envModule = require("../config/env");
    validateEnv = envModule.validateEnv;
    REQUIRED = envModule.REQUIRED;
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  test("REQUIRED array contains core authentication, transport, and API keys", () => {
    expect(REQUIRED).toEqual(
      expect.arrayContaining([
        "FROM_USER",
        "PASSWORD",
        "TRANSPORTER_HOST",
        "TRANSPORTER_PORT",
        "ADMIN_KEY",
        "CRON_API_KEY",
      ]),
    );
  });

  test("validateEnv returns empty array when all required vars and DATABASE_URL are set", () => {
    const logger = require("../logger");
    REQUIRED.forEach((k) => {
      process.env[k] = "test-value";
    });
    process.env.DATABASE_URL = "postgres://user:pass@localhost:5432/testdb";

    const missing = validateEnv();
    expect(missing).toEqual([]);
    expect(logger.info).toHaveBeenCalledWith(
      expect.stringContaining("All required environment variables are present"),
    );
  });

  test("validateEnv passes when discrete DB parts (DB_HOST, DB_USER, DB_NAME) are provided without DATABASE_URL", () => {
    REQUIRED.forEach((k) => {
      process.env[k] = "test-value";
    });
    delete process.env.DATABASE_URL;
    process.env.DB_HOST = "localhost";
    process.env.DB_USER = "postgres";
    process.env.DB_NAME = "routine_db";

    const missing = validateEnv();
    expect(missing).toEqual([]);
  });

  test("validateEnv detects missing required keys and logs warning", () => {
    const logger = require("../logger");
    delete process.env.FROM_USER;
    delete process.env.PASSWORD;
    delete process.env.DATABASE_URL;
    delete process.env.DB_HOST;

    const missing = validateEnv();
    expect(missing).toContain("FROM_USER");
    expect(missing).toContain("PASSWORD");
    expect(missing).toContain("DATABASE_URL (or DB_HOST, DB_USER, DB_NAME)");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Missing environment variables"),
    );
  });

  test("validateEnv flags database as missing if only partial DB parts are provided", () => {
    REQUIRED.forEach((k) => {
      process.env[k] = "test-value";
    });
    delete process.env.DATABASE_URL;
    process.env.DB_HOST = "localhost";
    delete process.env.DB_USER;
    delete process.env.DB_NAME;

    const missing = validateEnv();
    expect(missing).toContain("DATABASE_URL (or DB_HOST, DB_USER, DB_NAME)");
  });
});

describe("3. Redis Client Interface & Reconnection (config/redisClient.js)", () => {
  const originalEnv = process.env;

  afterEach(() => {
    process.env = originalEnv;
    jest.resetModules();
    jest.restoreAllMocks();
  });

  test("instantiates Mock Redis when USE_MOCK_REDIS='true'", () => {
    process.env = { ...originalEnv, NODE_ENV: "development", USE_MOCK_REDIS: "true" };
    const RedisMock = require("ioredis-mock");
    const client = require("../config/redisClient");
    expect(client).toBeInstanceOf(RedisMock);
  });

  test("instantiates Mock Redis automatically in test environment", () => {
    process.env = { ...originalEnv, NODE_ENV: "test", USE_MOCK_REDIS: "false" };
    const RedisMock = require("ioredis-mock");
    const client = require("../config/redisClient");
    expect(client).toBeInstanceOf(RedisMock);
  });

  test("configures live Redis client options, TLS, and retryStrategy", () => {
    let capturedOptions;
    let capturedUrl;
    const mockRedisInstance = {
      on: jest.fn().mockReturnThis(),
    };

    jest.doMock("ioredis", () => {
      return jest.fn().mockImplementation((url, opts) => {
        capturedUrl = url;
        capturedOptions = opts;
        return mockRedisInstance;
      });
    });

    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      USE_MOCK_REDIS: "false",
      REDIS_URL: "rediss://default:secret@production-redis:6380",
    };

    const logger = require("../logger");
    require("../config/redisClient");

    expect(capturedUrl).toBe("rediss://default:secret@production-redis:6380");
    // Verify TLS enabled for rediss://
    expect(capturedOptions.tls).toBeDefined();

    // Verify retry strategy exponential backoff
    expect(capturedOptions.retryStrategy(1)).toBe(50);
    expect(capturedOptions.retryStrategy(2)).toBe(100);
    expect(capturedOptions.retryStrategy(3)).toBe(150);
    // After 3 retries, strategy stops and returns null
    expect(capturedOptions.retryStrategy(4)).toBeNull();
    expect(logger.error).toHaveBeenCalledWith(
      expect.stringContaining("Redis connection failed after 3 retries"),
    );

    // Verify event listeners hooked
    expect(mockRedisInstance.on).toHaveBeenCalledWith("connect", expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith("error", expect.any(Function));
    expect(mockRedisInstance.on).toHaveBeenCalledWith("close", expect.any(Function));
  });

  test("falls back to REDIS_LEAP_URL and default redis host when REDIS_URL is absent", () => {
    let capturedUrl;
    jest.doMock("ioredis", () => {
      return jest.fn().mockImplementation((url) => {
        capturedUrl = url;
        return { on: jest.fn().mockReturnThis() };
      });
    });

    // Test legacy leap url fallback
    process.env = {
      ...originalEnv,
      NODE_ENV: "production",
      USE_MOCK_REDIS: "false",
      REDIS_LEAP_URL: "redis://legacy-host:6379",
    };
    delete process.env.REDIS_URL;

    const logger = require("../logger");
    require("../config/redisClient");
    expect(capturedUrl).toBe("redis://legacy-host:6379");
    expect(logger.warn).toHaveBeenCalledWith(
      expect.stringContaining("Using legacy REDIS_LEAP_URL"),
    );
  });
});

describe("4. Mail Transporter Singleton & Pool Lifecycle (config/mailTransporter.js & email-config.js)", () => {
  const originalEnv = process.env;

  beforeEach(async () => {
    jest.resetModules();
    const { closeTransporterConnection } = require("../config/mailTransporter");
    await closeTransporterConnection();

    process.env = {
      ...originalEnv,
      TRANSPORTER_HOST: "smtp.example.com",
      TRANSPORTER_PORT: "587",
      TRANSPORTER_SECURE: "false",
      TRANSPORTER_REQUIRE_TLS: "true",
      FROM_USER: "routine@example.com",
      PASSWORD: "securepassword",
      SMTP_POOL_ENABLED: "true",
      SMTP_MAX_CONNECTIONS: "5",
      SMTP_MAX_MESSAGES: "100",
      SMTP_VERIFY_ON_STARTUP: "false", // disable async startup probe during unit tests
    };
  });

  afterAll(async () => {
    const { closeTransporterConnection } = require("../config/mailTransporter");
    await closeTransporterConnection();
    process.env = originalEnv;
  });

  test("validateSmtpConfig throws Error if required SMTP vars are missing", () => {
    const { validateSmtpConfig } = require("../config/email-config");
    delete process.env.FROM_USER;

    expect(() => validateSmtpConfig()).toThrow(
      /Missing required SMTP environment variables: FROM_USER/,
    );
  });

  test("createTransporter builds nodemailer transport with pooled connection settings", () => {
    const freshNodemailer = require("nodemailer");
    const mockTransportObj = { verify: jest.fn(), close: jest.fn() };
    const createTransportSpy = jest
      .spyOn(freshNodemailer, "createTransport")
      .mockReturnValue(mockTransportObj);

    const { createTransporter } = require("../config/email-config");
    const transporter = createTransporter();

    expect(createTransportSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        host: "smtp.example.com",
        port: 587,
        secure: false,
        requireTLS: true,
        auth: {
          user: "routine@example.com",
          pass: "securepassword",
        },
        pool: true,
        maxConnections: 5,
        maxMessages: 100,
        idleTimeout: 5000,
        tls: expect.objectContaining({
          minVersion: "TLSv1.2",
          rejectUnauthorized: true,
        }),
      }),
    );
    expect(transporter).toBe(mockTransportObj);
  });

  test("getTransporter implements lazy singleton and reuses same instance", () => {
    const freshNodemailer = require("nodemailer");
    const mockTransportObj = { verify: jest.fn(), close: jest.fn() };
    jest.spyOn(freshNodemailer, "createTransport").mockReturnValue(mockTransportObj);

    const { getTransporter } = require("../config/mailTransporter");

    const instance1 = getTransporter();
    const instance2 = getTransporter();

    expect(instance1).toBe(mockTransportObj);
    expect(instance2).toBe(instance1);
    expect(freshNodemailer.createTransport).toHaveBeenCalledTimes(1);
  });

  test("closeTransporterConnection closes pool and clears singleton instance", async () => {
    const freshNodemailer = require("nodemailer");
    const mockClose = jest.fn();
    const mockTransportObj = {
      verify: jest.fn(),
      close: mockClose,
    };
    jest.spyOn(freshNodemailer, "createTransport").mockReturnValue(mockTransportObj);

    const { getTransporter, closeTransporterConnection } = require("../config/mailTransporter");

    // Initialize transporter
    getTransporter();

    // Close connection
    await closeTransporterConnection();
    expect(mockClose).toHaveBeenCalledTimes(1);

    // Verify closing when null is a safe no-op
    await expect(closeTransporterConnection()).resolves.toBeUndefined();

    // Next getTransporter creates a fresh instance
    const freshInstance = getTransporter();
    expect(freshNodemailer.createTransport).toHaveBeenCalledTimes(2);
    expect(freshInstance).toBe(mockTransportObj);
  });
});
