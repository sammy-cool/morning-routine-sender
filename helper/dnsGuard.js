// helper/dnsGuard.js
const dns = require("node:dns").promises;
const logger = require("../logger");

function extractDomain(emailOrDomain) {
  if (!emailOrDomain) return "morningroutine.app";
  const cleaned = emailOrDomain.trim().toLowerCase();
  if (cleaned.includes("@")) {
    return cleaned.split("@")[1].replace(/[<>]/g, "").trim();
  }
  return cleaned.replace(/^https?:\/\//, "").split("/")[0].trim();
}

async function auditSPF(domain) {
  try {
    const txtRecords = await dns.resolveTxt(domain);
    const flattened = txtRecords.map((r) => r.join(""));
    const spfRecords = flattened.filter((r) => r.startsWith("v=spf1"));

    if (spfRecords.length === 0) {
      return {
        status: "FAIL",
        score: 0,
        record: null,
        issues: ["No SPF record found on domain."],
        recommendation: `Add TXT record for "${domain}": "v=spf1 include:_spf.resend.com ~all" (adjust for your ESP).`,
      };
    }

    if (spfRecords.length > 1) {
      return {
        status: "FAIL",
        score: 10,
        record: spfRecords.join(" | "),
        issues: ["Multiple SPF records found. RFC 7208 prohibits having more than one SPF record."],
        recommendation: "Merge all SPF includes into a single v=spf1 TXT record.",
      };
    }

    const spf = spfRecords[0];
    const issues = [];
    let status = "PASS";
    let score = 30;

    if (spf.endsWith("+all")) {
      status = "FAIL";
      score = 5;
      issues.push("SPF ends with '+all' which allows anyone to spoof your domain.");
    } else if (spf.endsWith("?all")) {
      status = "WARN";
      score = 20;
      issues.push("SPF ends with '?all' (Neutral). Deliverability is higher with '~all' or '-all'.");
    }

    const includes = (spf.match(/include:/g) || []).length;
    if (includes > 8) {
      status = "WARN";
      issues.push(`SPF has ${includes} includes. Risk of exceeding the RFC 10 DNS lookup limit.`);
    }

    return {
      status,
      score,
      record: spf,
      issues,
      includesCount: includes,
      recommendation: status === "PASS" ? "SPF configured properly." : "Update SPF to use '~all' or '-all'.",
    };
  } catch (err) {
    return {
      status: "FAIL",
      score: 0,
      record: null,
      issues: [`DNS resolution error: ${err.message}`],
      recommendation: `Ensure TXT records are configured for ${domain}.`,
    };
  }
}

async function auditDKIM(domain, selectors = ["resend", "s1", "default", "smtp", "k1", "google"]) {
  const customSelector = process.env.DKIM_SELECTOR;
  const selectorList = customSelector ? [customSelector, ...selectors] : selectors;

  for (const selector of selectorList) {
    const dkimDomain = `${selector}._domainkey.${domain}`;
    try {
      const records = await dns.resolveTxt(dkimDomain);
      const flattened = records.map((r) => r.join(""));
      const dkim = flattened.find((r) => r.includes("v=DKIM1") || r.includes("p="));

      if (dkim) {
        const hasPublicKey = dkim.includes("p=") && !dkim.includes("p=;");
        const keyMatch = dkim.match(/p=([^;\s]+)/);
        const keyLength = keyMatch && keyMatch[1] ? keyMatch[1].length : 0;

        let status = "PASS";
        let score = 35;
        const issues = [];

        if (!hasPublicKey) {
          status = "FAIL";
          score = 5;
          issues.push("DKIM record exists but public key 'p=' tag is empty or revoked.");
        } else if (keyLength < 200) {
          status = "WARN";
          score = 25;
          issues.push("DKIM key appears to be 1024-bit. Upgrading to 2048-bit RSA is recommended.");
        }

        return {
          status,
          score,
          selector,
          dkimDomain,
          record: dkim,
          issues,
          recommendation: status === "PASS" ? `DKIM active on selector "${selector}".` : "Verify DKIM public key.",
        };
      }
    } catch {
      // Continue to next selector
    }
  }

  return {
    status: "FAIL",
    score: 0,
    selector: null,
    record: null,
    issues: [`No active DKIM record found on selectors: ${selectorList.join(", ")}`],
    recommendation: `Add a CNAME/TXT record for "${selectorList[0]}._domainkey.${domain}" provided by your SMTP provider.`,
  };
}

async function auditDMARC(domain) {
  const dmarcDomain = `_dmarc.${domain}`;
  try {
    const txtRecords = await dns.resolveTxt(dmarcDomain);
    const flattened = txtRecords.map((r) => r.join(""));
    const dmarcRecords = flattened.filter((r) => r.startsWith("v=DMARC1"));

    if (dmarcRecords.length === 0) {
      return {
        status: "FAIL",
        score: 0,
        record: null,
        issues: ["No DMARC record found."],
        recommendation: `Add TXT record for "_dmarc.${domain}": "v=DMARC1; p=quarantine; rua=mailto:dmarc@${domain}; pct=100"`,
      };
    }

    const dmarc = dmarcRecords[0];
    const policyMatch = dmarc.match(/p=([^;\s]+)/i);
    const policy = policyMatch ? policyMatch[1].toLowerCase() : "none";
    const ruaMatch = dmarc.match(/rua=([^;\s]+)/i);

    let status = "PASS";
    let score = 25;
    const issues = [];

    if (policy === "none") {
      status = "WARN";
      score = 15;
      issues.push("DMARC policy is set to 'p=none' (Monitoring only). Spam filters favor 'p=quarantine' or 'p=reject'.");
    }

    if (!ruaMatch) {
      issues.push("No aggregate reporting URI ('rua=') configured.");
    }

    return {
      status,
      score,
      policy,
      record: dmarc,
      hasReporting: Boolean(ruaMatch),
      issues,
      recommendation: policy === "none" ? "Upgrade policy from 'p=none' to 'p=quarantine' or 'p=reject'." : "DMARC policy configured.",
    };
  } catch {
    return {
      status: "FAIL",
      score: 0,
      record: null,
      issues: ["No DMARC record found at _dmarc." + domain],
      recommendation: `Publish a DMARC policy at "_dmarc.${domain}".`,
    };
  }
}

async function auditMX(domain) {
  try {
    const mxRecords = await dns.resolveMx(domain);
    if (!mxRecords || mxRecords.length === 0) {
      return {
        status: "FAIL",
        score: 0,
        records: [],
        issues: ["No MX records found. Receiving servers may reject outbound email."],
        recommendation: `Configure MX records for ${domain}.`,
      };
    }

    mxRecords.sort((a, b) => a.priority - b.priority);
    return {
      status: "PASS",
      score: 10,
      records: mxRecords,
      issues: [],
      recommendation: "MX records verified.",
    };
  } catch (err) {
    return {
      status: "FAIL",
      score: 0,
      records: [],
      issues: [`MX lookup failed: ${err.message}`],
      recommendation: `Ensure MX records are set up on ${domain}.`,
    };
  }
}

async function performDeliverabilityAudit(senderEmailOrDomain) {
  const domain = extractDomain(senderEmailOrDomain || process.env.FROM_USER || "morningroutine.app");

  logger.info(`🔍 Running DNS Deliverability Guard for domain: ${domain}`);

  const [spf, dkim, dmarc, mx] = await Promise.all([
    auditSPF(domain),
    auditDKIM(domain),
    auditDMARC(domain),
    auditMX(domain),
  ]);

  const totalScore = Math.min(100, Math.max(0, spf.score + dkim.score + dmarc.score + mx.score));

  let grade = "A";
  if (totalScore < 60) grade = "F";
  else if (totalScore < 75) grade = "C";
  else if (totalScore < 90) grade = "B";

  const allIssues = [...spf.issues, ...dkim.issues, ...dmarc.issues, ...mx.issues];

  return {
    domain,
    timestamp: new Date().toISOString(),
    healthScore: totalScore,
    grade,
    summaryStatus: totalScore >= 80 ? "HEALTHY" : totalScore >= 60 ? "WARNING" : "CRITICAL",
    checks: {
      spf,
      dkim,
      dmarc,
      mx,
    },
    actionableFixes: allIssues.length > 0 ? allIssues : ["Your email authentication DNS records meet high deliverability standards."],
  };
}

module.exports = {
  extractDomain,
  performDeliverabilityAudit,
};
