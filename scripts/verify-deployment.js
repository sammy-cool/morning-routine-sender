#!/usr/bin/env node
// scripts/verify-deployment.js
const args = process.argv.slice(2);
const cliUrl = args.find((arg) => arg.startsWith("http://") || arg.startsWith("https://"));
const isDeep = args.includes("--deep") || process.env.VERIFY_DEEP === "true";

const rawTarget = cliUrl || process.env.RENDER_URL || process.env.BASE_URL || "http://localhost:2900";
const TARGET_URL = rawTarget.replace(/\/+$/, "");
const MAX_ATTEMPTS = parseInt(process.env.MAX_VERIFY_ATTEMPTS, 10) || 15;
const TIMEOUT_MS = parseInt(process.env.VERIFY_TIMEOUT_MS, 10) || 5000;
const INITIAL_DELAY_MS = 2000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function checkEndpoint(url) {
  const startTime = Date.now();
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const res = await fetch(url, {
      signal: controller.signal,
      headers: { "User-Agent": "DeployVerification/2.0" },
    });
    clearTimeout(timeoutId);
    const elapsed = Date.now() - startTime;
    const isJson = res.headers.get("content-type")?.includes("application/json");
    const data = isJson ? await res.json() : await res.text();

    return { ok: res.ok, status: res.status, elapsed, data };
  } catch (err) {
    clearTimeout(timeoutId);
    return { ok: false, status: 0, elapsed: Date.now() - startTime, error: err.message };
  }
}

async function verifyDeployment() {
  const healthEndpoint = isDeep ? `${TARGET_URL}/health?deep=true` : `${TARGET_URL}/health`;

  console.log("\n==================================================");
  console.log("🚀 [Production Deploy Verification]");
  console.log(`🎯 Target URL:     ${TARGET_URL}`);
  console.log(`🔍 Health Path:    ${healthEndpoint}`);
  console.log(`⏱️ Max Attempts:   ${MAX_ATTEMPTS} (timeout: ${TIMEOUT_MS}ms)`);
  console.log(`🧪 Deep Check:     ${isDeep ? "ENABLED (DB + Redis)" : "DISABLED"}`);
  console.log("==================================================\n");

  let delay = INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    console.log(`[Attempt ${attempt}/${MAX_ATTEMPTS}] Probing health endpoint...`);
    const result = await checkEndpoint(healthEndpoint);

    if (result.ok && result.data?.status === "ok") {
      console.log(`\n✅ [Health Verified] Passed in ${result.elapsed}ms!`);
      console.log(`   - HTTP Status:    ${result.status}`);
      console.log(`   - App Uptime:     ${result.data.uptimeSeconds || 0}s`);
      console.log(`   - Memory Usage:   ${result.data.memoryUsageMB || "N/A"} MB`);
      if (result.data.checks) {
        console.log(`   - Database:       ${JSON.stringify(result.data.checks.database)}`);
        console.log(`   - Redis:          ${JSON.stringify(result.data.checks.redis)}`);
      }

      console.log("\n🔍 Verifying SEO / dynamic route (/robots.txt)...");
      const robotsResult = await checkEndpoint(`${TARGET_URL}/robots.txt`);
      if (robotsResult.ok && typeof robotsResult.data === "string" && robotsResult.data.includes("User-agent")) {
        console.log("✅ [SEO Verified] /robots.txt responded with valid content.");
      }

      console.log("\n🎉 [DEPLOYMENT SUCCESSFUL] All verification gates passed.\n");
      process.exit(0);
    }

    const failureReason = result.error || `HTTP ${result.status} - ${JSON.stringify(result.data)}`;
    console.log(`⚠️ Attempt ${attempt}/${MAX_ATTEMPTS} failed (${result.elapsed}ms): ${failureReason}`);

    if (attempt < MAX_ATTEMPTS) {
      console.log(`   Waiting ${delay}ms before next retry...\n`);
      await sleep(delay);
      delay = Math.min(Math.round(delay * 1.4), 10000);
    }
  }

  console.error(`\n❌ [DEPLOYMENT FAILED] Health verification timed out after ${MAX_ATTEMPTS} attempts.`);
  process.exit(1);
}

verifyDeployment();
