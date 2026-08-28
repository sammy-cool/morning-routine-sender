// __tests__/deliverability.dns.test.js
const { extractDomain, performDeliverabilityAudit } = require("../helper/dnsGuard");
const dns = require("node:dns").promises;

jest.mock("node:dns", () => ({
  promises: {
    resolveTxt: jest.fn(),
    resolveMx: jest.fn(),
  },
}));

describe("DNS Guard & Deliverability Audit Unit Tests", () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  test("extractDomain handles emails, URLs and domain names cleanly", () => {
    expect(extractDomain("user@morningroutine.app")).toBe("morningroutine.app");
    expect(extractDomain("<support@example.com>")).toBe("example.com");
    expect(extractDomain("https://myapp.io/dashboard")).toBe("myapp.io");
    expect(extractDomain("customdomain.org")).toBe("customdomain.org");
    expect(extractDomain(null)).toBe("morningroutine.app");
  });

  test("performDeliverabilityAudit calculates 100 Health Score and Grade A when all DNS records valid", async () => {
    const fullDkim2048Key =
      "MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEA0Y9x6k9dK8tqV6rY9jQ6xL1Zz3w8bA2nK4vL8xM5" +
      "pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5" +
      "pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5pQ7sT3w9bA2nK4vL8xM5" +
      "IDAQAB";

    dns.resolveTxt.mockImplementation((domain) => {
      if (domain.startsWith("_dmarc.")) {
        return Promise.resolve([["v=DMARC1; p=quarantine; rua=mailto:dmarc@example.com"]]);
      }
      if (domain.includes("._domainkey.")) {
        return Promise.resolve([[`v=DKIM1; k=rsa; p=${fullDkim2048Key}`]]);
      }
      return Promise.resolve([["v=spf1 include:_spf.resend.com ~all"]]);
    });

    dns.resolveMx.mockResolvedValue([{ exchange: "feedback-smtp.resend.com", priority: 10 }]);

    const audit = await performDeliverabilityAudit("notifications@example.com");

    expect(audit.domain).toBe("example.com");
    expect(audit.healthScore).toBe(100);
    expect(audit.grade).toBe("A");
    expect(audit.summaryStatus).toBe("HEALTHY");
    expect(audit.checks.spf.status).toBe("PASS");
    expect(audit.checks.dkim.status).toBe("PASS");
    expect(audit.checks.dmarc.status).toBe("PASS");
    expect(audit.checks.mx.status).toBe("PASS");
  });

  test("performDeliverabilityAudit detects missing SPF/DKIM/DMARC and scores low", async () => {
    dns.resolveTxt.mockRejectedValue(new Error("ENODATA"));
    dns.resolveMx.mockRejectedValue(new Error("ENODATA"));

    const audit = await performDeliverabilityAudit("test@empty-domain.test");

    expect(audit.healthScore).toBe(0);
    expect(audit.grade).toBe("F");
    expect(audit.summaryStatus).toBe("CRITICAL");
    expect(audit.actionableFixes.length).toBeGreaterThan(0);
  });
});
