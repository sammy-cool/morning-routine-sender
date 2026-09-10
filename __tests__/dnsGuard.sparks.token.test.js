/**
 * Test Suite: Deliverability Guard, Curated Sparks, Unsubscribe Tokens & Read DB
 * Verifies:
 *   - helper/dnsGuard.js (Domain extraction, SPF, DKIM, DMARC, MX, health scoring)
 *   - helper/unsubscribeToken.js (Action-scoped tokens, legacy unsubscribe tokens, timing-safe checks)
 *   - helper/curatedSparks.js (Coach persona metadata, streak tiers, deterministic seed generation)
 *   - helper/read-db.js (Knex raw query email_tracker introspection)
 */

// Mock node:dns promises API
const mockResolveTxt = jest.fn();
const mockResolveMx = jest.fn();

jest.mock("node:dns", () => ({
  promises: {
    resolveTxt: mockResolveTxt,
    resolveMx: mockResolveMx,
  },
}));

const mockRaw = jest.fn();
jest.mock("../db/knex", () => ({
  raw: mockRaw,
}));

jest.mock("../logger", () => ({
  info: jest.fn(),
  warn: jest.fn(),
  error: jest.fn(),
}));

const { extractDomain, performDeliverabilityAudit } = require("../helper/dnsGuard");
const {
  generateUnsubscribeToken,
  verifyUnsubscribeToken,
  generateActionToken,
  verifyActionToken,
} = require("../helper/unsubscribeToken");
const {
  COACH_PERSONAS_METADATA,
  getStreakTier,
  getCuratedSpark,
  CURATED_SPARK_MATRIX,
} = require("../helper/curatedSparks");
const { readDb } = require("../helper/read-db");

describe("Deliverability Guard, Curated Sparks, Tokens & Read DB Suite", () => {
  const originalEnv = process.env;

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, UNSUBSCRIBE_SECRET: "test-secret-key-12345" };
  });

  afterAll(() => {
    process.env = originalEnv;
  });

  // ==========================================================================
  // 1. dnsGuard.js Tests
  // ==========================================================================
  describe("dnsGuard.js Email Deliverability Audit", () => {
    const fullDkim2048Key =
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Y9x6k9dK8tqV6rY9jQ6xL1Zz3w8bA2nK4vL8xM5" +
      "pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5" +
      "pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5IDAQAB";

    describe("extractDomain()", () => {
      test("extracts domain correctly across diverse formats", () => {
        expect(extractDomain("hello@example.com")).toBe("example.com");
        expect(extractDomain("<support@service.io>")).toBe("service.io");
        expect(extractDomain("https://auth.subdomain.org/path/login")).toBe("auth.subdomain.org");
        expect(extractDomain("http://simple.com")).toBe("simple.com");
        expect(extractDomain("plain-domain.net")).toBe("plain-domain.net");
        expect(extractDomain("")).toBe("morningroutine.app");
        expect(extractDomain(null)).toBe("morningroutine.app");
      });
    });

    describe("performDeliverabilityAudit()", () => {
      test("calculates perfect 100 score, Grade A, HEALTHY status on valid records", async () => {
        mockResolveTxt.mockImplementation(async (domain) => {
          if (domain.startsWith("_dmarc.")) {
            return [["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com; pct=100"]];
          }
          if (domain.includes("._domainkey.")) {
            return [[`v=DKIM1; k=rsa; p=${fullDkim2048Key}`]];
          }
          return [["v=spf1 include:_spf.resend.com ~all"]];
        });

        mockResolveMx.mockResolvedValue([
          { exchange: "mail.example.com", priority: 10 },
          { exchange: "backup.example.com", priority: 20 },
        ]);

        const audit = await performDeliverabilityAudit("user@example.com");

        expect(audit.domain).toBe("example.com");
        expect(audit.healthScore).toBe(100);
        expect(audit.grade).toBe("A");
        expect(audit.summaryStatus).toBe("HEALTHY");
        expect(audit.checks.spf.status).toBe("PASS");
        expect(audit.checks.dkim.status).toBe("PASS");
        expect(audit.checks.dmarc.status).toBe("PASS");
        expect(audit.checks.mx.status).toBe("PASS");
      });

      test("flags RFC violations on multiple SPF records", async () => {
        mockResolveTxt.mockImplementation(async (domain) => {
          if (domain.startsWith("_dmarc.")) return [["v=DMARC1; p=reject"]];
          if (domain.includes("._domainkey.")) return [[`v=DKIM1; p=${fullDkim2048Key}`]];
          return [["v=spf1 include:_spf1.com ~all"], ["v=spf1 include:_spf2.com ~all"]];
        });
        mockResolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);

        const audit = await performDeliverabilityAudit("example.com");

        expect(audit.checks.spf.status).toBe("FAIL");
        expect(audit.checks.spf.score).toBe(10);
        expect(audit.checks.spf.issues[0]).toContain("Multiple SPF records found");
      });

      test("flags warnings for SPF '+all' and DMARC 'p=none'", async () => {
        mockResolveTxt.mockImplementation(async (domain) => {
          if (domain.startsWith("_dmarc.")) return [["v=DMARC1; p=none"]];
          if (domain.includes("._domainkey.")) return [[`v=DKIM1; p=${fullDkim2048Key}`]];
          return [["v=spf1 +all"]];
        });
        mockResolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);

        const audit = await performDeliverabilityAudit("example.com");

        expect(audit.checks.spf.status).toBe("FAIL");
        expect(audit.checks.dmarc.status).toBe("WARN");
        expect(audit.checks.dmarc.policy).toBe("none");
        expect(audit.checks.dmarc.hasReporting).toBe(false);
        expect(audit.healthScore).toBeLessThan(90);
      });

      test("detects short 1024-bit DKIM keys and marks status as WARN", async () => {
        const shortKey = "MIGfMA0GCSqGSIb3DQEBAQUAA4GNADCBiQKBgQC3";
        mockResolveTxt.mockImplementation(async (domain) => {
          if (domain.includes("._domainkey.")) return [[`v=DKIM1; p=${shortKey}`]];
          return [["v=spf1 ~all"]];
        });
        mockResolveMx.mockResolvedValue([{ exchange: "mx.example.com", priority: 10 }]);

        const audit = await performDeliverabilityAudit("example.com");

        expect(audit.checks.dkim.status).toBe("WARN");
        expect(audit.checks.dkim.score).toBe(25);
        expect(audit.checks.dkim.issues[0]).toContain("1024-bit");
      });

      test("handles total DNS resolution failure gracefully (Grade F, CRITICAL)", async () => {
        mockResolveTxt.mockRejectedValue(new Error("ENOTFOUND"));
        mockResolveMx.mockRejectedValue(new Error("ENOTFOUND"));

        const audit = await performDeliverabilityAudit("unresolvable-domain.org");

        expect(audit.healthScore).toBe(0);
        expect(audit.grade).toBe("F");
        expect(audit.summaryStatus).toBe("CRITICAL");
        expect(audit.actionableFixes.length).toBeGreaterThanOrEqual(4);
      });
    });
  });

  // ==========================================================================
  // 2. unsubscribeToken.js Tests
  // ==========================================================================
  describe("unsubscribeToken.js Cryptographic Tokens", () => {
    describe("generateActionToken() and verifyActionToken()", () => {
      test("generates 32-char hex string deterministically", () => {
        const token1 = generateActionToken("user@example.com", "check-in");
        const token2 = generateActionToken("user@example.com", "check-in");
        expect(token1).toHaveLength(32);
        expect(token1).toBe(token2);
      });

      test("is case-insensitive and trims email inputs", () => {
        const tokenA = generateActionToken("User@Example.Com  ", "view-routine");
        const tokenB = generateActionToken("user@example.com", "view-routine");
        expect(tokenA).toBe(tokenB);
      });

      test("verifies valid token successfully", () => {
        const token = generateActionToken("user@example.com", "check-in");
        expect(verifyActionToken("user@example.com", token, "check-in")).toBe(true);
      });

      test("fails verification on action mismatch or email mismatch", () => {
        const token = generateActionToken("user@example.com", "check-in");
        expect(verifyActionToken("user@example.com", token, "other-action")).toBe(false);
        expect(verifyActionToken("other@example.com", token, "check-in")).toBe(false);
      });

      test("safely handles invalid token lengths without throwing crypto errors", () => {
        expect(verifyActionToken("user@example.com", "too-short", "check-in")).toBe(false);
        expect(verifyActionToken("user@example.com", "", "check-in")).toBe(false);
        expect(verifyActionToken("user@example.com", null, "check-in")).toBe(false);
        expect(verifyActionToken(null, "some-token", "check-in")).toBe(false);
      });
    });

    describe("generateUnsubscribeToken() and verifyUnsubscribeToken()", () => {
      test("verifies both legacy token and action-scoped unsubscribe token", () => {
        const email = "subscriber@example.com";
        const legacyToken = generateUnsubscribeToken(email);
        const actionToken = generateActionToken(email, "unsubscribe");

        expect(verifyUnsubscribeToken(email, legacyToken)).toBe(true);
        expect(verifyUnsubscribeToken(email, actionToken)).toBe(true);
      });

      test("falls back to ADMIN_KEY when UNSUBSCRIBE_SECRET is absent", () => {
        delete process.env.UNSUBSCRIBE_SECRET;
        process.env.ADMIN_KEY = "admin-backup-secret";

        const token = generateUnsubscribeToken("test@example.com");
        expect(verifyUnsubscribeToken("test@example.com", token)).toBe(true);
      });

      test("rejects tampered tokens", () => {
        const token = generateUnsubscribeToken("test@example.com");
        const tampered = token.slice(0, 31) + (token[31] === "a" ? "b" : "a");
        expect(verifyUnsubscribeToken("test@example.com", tampered)).toBe(false);
      });
    });
  });

  // ==========================================================================
  // 3. curatedSparks.js Tests
  // ==========================================================================
  describe("curatedSparks.js Engine", () => {
    test("COACH_PERSONAS_METADATA contains all 5 expected personas", () => {
      const expected = ["stoic", "relentless", "zen", "tech-lead", "optimist"];
      expected.forEach((id) => {
        expect(COACH_PERSONAS_METADATA[id]).toBeDefined();
        expect(COACH_PERSONAS_METADATA[id].name).toBeTruthy();
        expect(COACH_PERSONAS_METADATA[id].sampleSpark).toBeTruthy();
      });
    });

    test("getStreakTier maps thresholds to tier keys correctly", () => {
      expect(getStreakTier(0).tierKey).toBe("tier-1");
      expect(getStreakTier(2).tierKey).toBe("tier-1");
      expect(getStreakTier(3).tierKey).toBe("tier-3");
      expect(getStreakTier(6).tierKey).toBe("tier-3");
      expect(getStreakTier(7).tierKey).toBe("tier-7");
      expect(getStreakTier(13).tierKey).toBe("tier-7");
      expect(getStreakTier(14).tierKey).toBe("tier-14");
      expect(getStreakTier(29).tierKey).toBe("tier-14");
      expect(getStreakTier(30).tierKey).toBe("tier-30");
      expect(getStreakTier(59).tierKey).toBe("tier-30");
      expect(getStreakTier(60).tierKey).toBe("tier-60");
      expect(getStreakTier(99).tierKey).toBe("tier-60");
      expect(getStreakTier(100).tierKey).toBe("tier-100");
      expect(getStreakTier(250).tierKey).toBe("tier-100");

      // Non-numeric and negative inputs
      expect(getStreakTier(null).tierKey).toBe("tier-1");
      expect(getStreakTier(-10).tierKey).toBe("tier-1");
    });

    test("getCuratedSpark returns spark structure and falls back to stoic on unknown persona", () => {
      const spark = getCuratedSpark({
        coachPersona: "stoic",
        streakCount: 5,
        dateStr: "2026-09-10",
        email: "subscriber@example.com",
      });

      expect(spark).toHaveProperty("sparkReflection");
      expect(spark).toHaveProperty("microAction");
      expect(spark).toHaveProperty("focusMantra");

      const unknownSpark = getCuratedSpark({ coachPersona: "unknown_persona" });
      const stoicTier1 = CURATED_SPARK_MATRIX.stoic["tier-1"];
      expect(stoicTier1.some((s) => s.sparkReflection === unknownSpark.sparkReflection)).toBe(true);
    });

    test("getCuratedSpark produces deterministic results for identical seeds", () => {
      const args = {
        coachPersona: "relentless",
        streakCount: 14,
        dateStr: "2026-09-10",
        email: "test@example.com",
      };
      const spark1 = getCuratedSpark(args);
      const spark2 = getCuratedSpark(args);
      expect(spark1).toEqual(spark2);
    });
  });

  // ==========================================================================
  // 4. read-db.js Tests
  // ==========================================================================
  describe("read-db.js Database Inspector", () => {
    test("executes raw query and returns rowCount and rows", async () => {
      const fakeRows = [
        { id: 1, recipient_email: "user1@example.com", status: "success" },
        { id: 2, recipient_email: "user2@example.com", status: "failure" },
      ];
      mockRaw.mockResolvedValue({ rowCount: 2, rows: fakeRows });

      const result = await readDb();

      expect(mockRaw).toHaveBeenCalledWith(
        "SELECT * FROM email_tracker ORDER BY sent_at DESC LIMIT 1000;",
      );
      expect(result).toEqual({ rowCount: 2, rows: fakeRows });
    });

    test("logs error and rethrows when db.raw fails", async () => {
      mockRaw.mockRejectedValue(new Error("Knex connection pool closed"));

      await expect(readDb()).rejects.toThrow("Knex connection pool closed");
    });
  });
});
