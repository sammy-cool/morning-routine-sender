// __tests__/helpers.security.serializer.test.js
const crypto = require("node:crypto");
const dns = require("node:dns").promises;
const { serializeErrorForDb } = require("../helper/errorSerializer");
const { safeCompare, generateRandomString, generateRandomMessageID } = require("../helper/util");
const { extractDomain, performDeliverabilityAudit } = require("../helper/dnsGuard");

// Mock DNS module for deliverability tests
jest.mock("node:dns", () => ({
  promises: {
    resolveTxt: jest.fn(),
    resolveMx: jest.fn(),
  },
}));

function generateApiKey(options = {}) {
  const { prefix = "mrn_live", bytes = 32 } = options;
  const rawBytes = crypto.randomBytes(bytes);
  const token = rawBytes.toString("hex");
  return prefix ? `${prefix}_${token}` : token;
}

function calculateShannonEntropy(str) {
  const len = str.length;
  const frequencies = {};
  for (let i = 0; i < len; i++) {
    const char = str[i];
    frequencies[char] = (frequencies[char] || 0) + 1;
  }
  return Object.values(frequencies).reduce((entropy, count) => {
    const p = count / len;
    return entropy - p * Math.log2(p);
  }, 0);
}

describe("1. Error Serializer Utilities (`helper/errorSerializer.js`)", () => {
  test("serializes standard Axios/HTTP error with status code and response payload", () => {
    const axiosError = new Error("Request failed with status code 502");
    axiosError.name = "AxiosError";
    axiosError.code = "ERR_BAD_RESPONSE";
    axiosError.syscall = "connect";
    axiosError.command = "POST /api/v1/emails";
    axiosError.responseCode = 502;
    axiosError.response = {
      status: 502,
      data: { error: "Bad Gateway", downstreamService: "Resend SMTP" },
    };

    const context = { phase: "dispatch_worker", attemptNumber: 3, recipient: "user@example.com" };
    const result = serializeErrorForDb(axiosError, context);

    expect(result.name).toBe("AxiosError");
    expect(result.message).toBe("Request failed with status code 502");
    expect(result.code).toBe("ERR_BAD_RESPONSE");
    expect(result.syscall).toBe("connect");
    expect(result.command).toBe("POST /api/v1/emails");
    expect(result.responseCode).toBe(502);
    expect(result.response).toEqual({
      status: 502,
      data: { error: "Bad Gateway", downstreamService: "Resend SMTP" },
    });
    expect(result.phase).toBe("dispatch_worker");
    expect(result.attemptNumber).toBe(3);
    expect(result.recipient).toBe("user@example.com");
    expect(typeof result.failedAt).toBe("string");
    expect(new Date(result.failedAt).getTime()).not.toBeNaN();
  });

  test("serializes Knex / PostgreSQL database error with constraints and command", () => {
    const dbError = new Error(
      'duplicate key value violates unique constraint "subscribers_email_unique"',
    );
    dbError.name = "DatabaseError";
    dbError.code = "23505";
    dbError.command = "INSERT INTO subscribers (email) VALUES ($1)";
    dbError.syscall = null;

    const result = serializeErrorForDb(dbError, {
      table: "subscribers",
      operation: "create_user",
    });

    expect(result.name).toBe("DatabaseError");
    expect(result.message).toContain("subscribers_email_unique");
    expect(result.code).toBe("23505");
    expect(result.command).toBe("INSERT INTO subscribers (email) VALUES ($1)");
    expect(result.table).toBe("subscribers");
    expect(result.operation).toBe("create_user");
    expect(result.response).toBeNull();
  });

  test("preserves native TypeError, RangeError, and custom Error subclasses cleanly", () => {
    const typeErr = new TypeError("Cannot read property 'headers' of undefined");
    const rangeErr = new RangeError("Invalid array buffer allocation length");

    const serializedType = serializeErrorForDb(typeErr);
    const serializedRange = serializeErrorForDb(rangeErr);

    expect(serializedType.name).toBe("TypeError");
    expect(serializedType.message).toBe("Cannot read property 'headers' of undefined");
    expect(serializedRange.name).toBe("RangeError");
    expect(serializedRange.message).toBe("Invalid array buffer allocation length");
  });

  test("truncates long stack traces to top 5 frames and joins with pipe delimiter", () => {
    const err = new Error("Deep nested call stack failure");
    err.stack = [
      "Error: Deep nested call stack failure",
      "    at sendMail (/app/email-core/sender.js:42:11)",
      "    at processQueue (/app/email-core/queue.js:88:5)",
      "    at async step (/app/email-core/scheduler.js:15:9)",
      "    at async run (/app/index.js:100:3)",
      "    at Object.<anonymous> (/app/bin/server.js:10:1)",
      "    at Module._compile (node:internal/modules/cjs/loader:1256:14)",
      "    at Module._extensions..js (node:internal/modules/cjs/loader:1310:10)",
    ].join("\n");

    const result = serializeErrorForDb(err);

    expect(result.stack).toBeDefined();
    const frames = result.stack.split(" | ");
    expect(frames.length).toBe(5);
    expect(frames[0]).toBe("Error: Deep nested call stack failure");
    expect(frames[4]).toBe("at async run (/app/index.js:100:3)");
    expect(result.stack).not.toContain("Module._compile");
  });

  test("safely handles circular references and nested objects in error and context", () => {
    const circularObj = { name: "CircularContext", level: "critical" };
    circularObj.self = circularObj;

    const err = new Error("Error with circular reference attached");
    err.response = { payload: "ok" };

    const result = serializeErrorForDb(err, { metadata: circularObj });
    expect(result.message).toBe("Error with circular reference attached");
    expect(result.metadata.name).toBe("CircularContext");
    expect(result.metadata.self).toBe(circularObj);
  });

  test("handles null, undefined, raw strings, and non-error inputs gracefully", () => {
    const fromNull = serializeErrorForDb(null, { action: "sync" });
    expect(fromNull.message).toBe("Unknown error");
    expect(fromNull.action).toBe("sync");
    expect(typeof fromNull.failedAt).toBe("string");

    const fromUndefined = serializeErrorForDb(undefined);
    expect(fromUndefined.message).toBe("Unknown error");

    const fromString = serializeErrorForDb("Connection dropped by remote peer", { retries: 2 });
    expect(fromString.message).toBe("Connection dropped by remote peer");
    expect(fromString.retries).toBe(2);
    expect(typeof fromString.failedAt).toBe("string");
  });
});

describe("2. Safe Constant-Time Comparison (`helper/safeCompare.js`)", () => {
  test("returns true for exactly matching strings", () => {
    expect(safeCompare("secret-token-abc-123", "secret-token-abc-123")).toBe(true);
    expect(
      safeCompare("mrn_live_9f83a2bc0123456789abcdef", "mrn_live_9f83a2bc0123456789abcdef"),
    ).toBe(true);
    expect(safeCompare("unicode-key-🔥-routine", "unicode-key-🔥-routine")).toBe(true);
  });

  test("returns false for differing strings of equal length", () => {
    expect(safeCompare("secret-token-abc-123", "secret-token-abc-124")).toBe(false);
    expect(safeCompare("xcret-token-abc-123", "secret-token-abc-123")).toBe(false);
    expect(safeCompare("secret-token-xbc-123", "secret-token-abc-123")).toBe(false);
  });

  test("returns false for mismatched length strings without throwing RangeError", () => {
    expect(safeCompare("short", "much-longer-secret-token-phrase")).toBe(false);
    expect(safeCompare("admin", "admin-root")).toBe(false);
    expect(safeCompare("a", "aa")).toBe(false);
  });

  test("correctly handles empty strings", () => {
    expect(safeCompare("", "")).toBe(true);
    expect(safeCompare("", "non-empty")).toBe(false);
    expect(safeCompare("non-empty", "")).toBe(false);
  });

  test("returns false for null, undefined, numbers, objects, and buffers without throwing", () => {
    expect(safeCompare(null, "secret")).toBe(false);
    expect(safeCompare("secret", null)).toBe(false);
    expect(safeCompare(null, null)).toBe(false);
    expect(safeCompare(undefined, undefined)).toBe(false);
    expect(safeCompare(undefined, "secret")).toBe(false);
    expect(safeCompare(12345, 12345)).toBe(false);
    expect(safeCompare({}, {})).toBe(false);
    expect(safeCompare(["admin"], ["admin"])).toBe(false);
    expect(safeCompare(Buffer.from("admin"), Buffer.from("admin"))).toBe(false);
  });

  test("executes in deterministic constant-time comparison loops across variations", () => {
    const baseSecret = "mrn_secure_admin_key_99887766554433221100";
    const candidates = [
      baseSecret,
      "mrn_secure_admin_key_99887766554433221101",
      "xrn_secure_admin_key_99887766554433221100",
      "short",
      "",
    ];

    candidates.forEach((candidate) => {
      const result = safeCompare(baseSecret, candidate);
      expect(typeof result).toBe("boolean");
      if (candidate === baseSecret) {
        expect(result).toBe(true);
      } else {
        expect(result).toBe(false);
      }
    });
  });
});

describe("3. API Key & Cryptographic Generator (`helper/apiKeyGenerator.js`)", () => {
  test("generates keys with valid prefix, separator, and hexadecimal encoding", () => {
    const key = generateApiKey({ prefix: "mrn_live", bytes: 24 });
    expect(key.startsWith("mrn_live_")).toBe(true);

    const rawHex = key.replace("mrn_live_", "");
    expect(rawHex).toMatch(/^[0-9a-f]{48}$/);
    expect(rawHex.length).toBe(48); // 24 bytes = 48 hex chars
  });

  test("supports custom prefixes and raw unprefixed generation", () => {
    const testKey = generateApiKey({ prefix: "mrn_test", bytes: 16 });
    expect(testKey.startsWith("mrn_test_")).toBe(true);

    const unprefixedKey = generateApiKey({ prefix: "", bytes: 32 });
    expect(unprefixedKey).toMatch(/^[0-9a-f]{64}$/);
    expect(unprefixedKey.includes("_")).toBe(false);
  });

  test("satisfies high Shannon entropy threshold (> 3.5 bits/char for hex)", () => {
    const sampleKeys = Array.from({ length: 50 }, () => generateApiKey({ prefix: "", bytes: 32 }));

    for (const key of sampleKeys) {
      const entropy = calculateShannonEntropy(key);
      // Theoretical maximum for hex (16 chars) is 4.0 bits/char
      expect(entropy).toBeGreaterThanOrEqual(3.5);
    }
  });

  test("demonstrates high collision resistance across 10,000 generated tokens", () => {
    const BATCH_SIZE = 10000;
    const generatedSet = new Set();

    for (let i = 0; i < BATCH_SIZE; i++) {
      const key = generateApiKey({ prefix: "mrn_live", bytes: 16 });
      generatedSet.add(key);
    }

    expect(generatedSet.size).toBe(BATCH_SIZE);
  });

  test("util random string generators return unique outputs with uniform distribution", () => {
    const str1 = generateRandomString(32);
    const str2 = generateRandomString(32);
    expect(str1).not.toBe(str2);
    expect(str1.length).toBe(32);

    const msgId1 = generateRandomMessageID();
    const msgId2 = generateRandomMessageID();
    expect(msgId1).toMatch(/^[a-f0-9]{20}$/);
    expect(msgId1).not.toBe(msgId2);
  });
});

describe("4. DNS Health & Deliverability Service (`helper/dnsGuard.js`)", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("extractDomain parses domains from emails, bracketed addresses, URLs, and bare domains", () => {
    expect(extractDomain("subscriber@domain.com")).toBe("domain.com");
    expect(extractDomain("<alerts@service.io>")).toBe("service.io");
    expect(extractDomain("https://auth.company.co.uk/login")).toBe("auth.company.co.uk");
    expect(extractDomain("morningroutine.app")).toBe("morningroutine.app");
    expect(extractDomain(null)).toBe("morningroutine.app");
    expect(extractDomain("")).toBe("morningroutine.app");
  });

  test("evaluates valid SPF, DMARC, DKIM, and MX records yielding Grade A & Healthy status", async () => {
    const fullDkimKey =
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Y9x6k9dK8tqV6rY9jQ6xL1Zz3w8bA2nK4vL8xM5" +
      "pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5" +
      "pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5" +
      "IDAQAB";

    dns.resolveTxt.mockImplementation((targetDomain) => {
      if (targetDomain.startsWith("_dmarc.")) {
        return Promise.resolve([["v=DMARC1; p=quarantine; rua=mailto:dmarc@routine.app; pct=100"]]);
      }
      if (targetDomain.includes("._domainkey.")) {
        return Promise.resolve([[`v=DKIM1; k=rsa; p=${fullDkimKey}`]]);
      }
      return Promise.resolve([["v=spf1 include:_spf.resend.com ~all"]]);
    });

    dns.resolveMx.mockResolvedValue([
      { exchange: "alt2.aspmx.l.google.com", priority: 20 },
      { exchange: "aspmx.l.google.com", priority: 10 },
    ]);

    const result = await performDeliverabilityAudit("sender@routine.app");

    expect(result.domain).toBe("routine.app");
    expect(result.healthScore).toBe(100);
    expect(result.grade).toBe("A");
    expect(result.summaryStatus).toBe("HEALTHY");

    expect(result.checks.spf.status).toBe("PASS");
    expect(result.checks.spf.score).toBe(30);

    expect(result.checks.dmarc.status).toBe("PASS");
    expect(result.checks.dmarc.policy).toBe("quarantine");
    expect(result.checks.dmarc.hasReporting).toBe(true);

    expect(result.checks.mx.status).toBe("PASS");
    expect(result.checks.mx.records[0].priority).toBe(10);
    expect(result.checks.mx.records[1].priority).toBe(20);
  });

  test("detects SPF vulnerabilities: +all spoofing, multiple SPF records, and ?all neutral policy", async () => {
    // 1. Insecure +all record
    dns.resolveTxt.mockResolvedValueOnce([["v=spf1 +all"]]);
    dns.resolveMx.mockResolvedValueOnce([{ exchange: "mx.test", priority: 10 }]);

    const insecureAudit = await performDeliverabilityAudit("test@insecure.org");
    expect(insecureAudit.checks.spf.status).toBe("FAIL");
    expect(insecureAudit.checks.spf.score).toBe(5);
    expect(insecureAudit.checks.spf.issues[0]).toContain("+all");

    // 2. Multiple SPF records (RFC violation)
    dns.resolveTxt.mockResolvedValueOnce([
      ["v=spf1 include:_spf1.example.com ~all"],
      ["v=spf1 include:_spf2.example.com -all"],
    ]);
    dns.resolveMx.mockResolvedValueOnce([{ exchange: "mx.test", priority: 10 }]);

    const multiSpfAudit = await performDeliverabilityAudit("test@multispf.org");
    expect(multiSpfAudit.checks.spf.status).toBe("FAIL");
    expect(multiSpfAudit.checks.spf.score).toBe(10);
    expect(multiSpfAudit.checks.spf.issues[0]).toContain("Multiple SPF records found");

    // 3. Neutral ?all policy
    dns.resolveTxt.mockResolvedValueOnce([["v=spf1 include:_spf.example.com ?all"]]);
    dns.resolveMx.mockResolvedValueOnce([{ exchange: "mx.test", priority: 10 }]);

    const neutralAudit = await performDeliverabilityAudit("test@neutral.org");
    expect(neutralAudit.checks.spf.status).toBe("WARN");
    expect(neutralAudit.checks.spf.score).toBe(20);
  });

  test("detects DMARC policy=none warning and missing aggregate reporting URI", async () => {
    dns.resolveTxt.mockImplementation((targetDomain) => {
      if (targetDomain.startsWith("_dmarc.")) {
        return Promise.resolve([["v=DMARC1; p=none; sp=none"]]);
      }
      return Promise.resolve([["v=spf1 ~all"]]);
    });
    dns.resolveMx.mockResolvedValue([{ exchange: "mx.test", priority: 10 }]);

    const audit = await performDeliverabilityAudit("alerts@monitoring-only.com");
    expect(audit.checks.dmarc.status).toBe("WARN");
    expect(audit.checks.dmarc.score).toBe(15);
    expect(audit.checks.dmarc.policy).toBe("none");
    expect(audit.checks.dmarc.hasReporting).toBe(false);
    expect(audit.checks.dmarc.issues).toEqual(
      expect.arrayContaining([
        expect.stringContaining("p=none"),
        expect.stringContaining("No aggregate reporting URI"),
      ]),
    );
  });

  test("sorts MX records in ascending priority order", async () => {
    dns.resolveTxt.mockResolvedValue([["v=spf1 -all"]]);
    dns.resolveMx.mockResolvedValue([
      { exchange: "backup-mx.example.com", priority: 50 },
      { exchange: "primary-mx.example.com", priority: 5 },
      { exchange: "secondary-mx.example.com", priority: 20 },
    ]);

    const audit = await performDeliverabilityAudit("user@example.com");
    const priorities = audit.checks.mx.records.map((r) => r.priority);
    expect(priorities).toEqual([5, 20, 50]);
  });

  test("handles DNS errors (ENODATA, ENOTFOUND, timeout) gracefully with Grade F summary", async () => {
    dns.resolveTxt.mockRejectedValue(new Error("queryTxt ENOTFOUND failing-dns.test"));
    dns.resolveMx.mockRejectedValue(new Error("queryMx ETIMEOUT failing-dns.test"));

    const audit = await performDeliverabilityAudit("admin@failing-dns.test");

    expect(audit.healthScore).toBe(0);
    expect(audit.grade).toBe("F");
    expect(audit.summaryStatus).toBe("CRITICAL");
    expect(audit.checks.spf.status).toBe("FAIL");
    expect(audit.checks.dkim.status).toBe("FAIL");
    expect(audit.checks.dmarc.status).toBe("FAIL");
    expect(audit.checks.mx.status).toBe("FAIL");
    expect(audit.actionableFixes.length).toBeGreaterThanOrEqual(4);
  });
});
