// scripts/verify-deployment.js
const TARGET_URL = process.env.RENDER_URL || process.env.BASE_URL || "http://localhost:2900";
const MAX_ATTEMPTS = parseInt(process.env.MAX_VERIFY_ATTEMPTS, 10) || 15;
const INITIAL_DELAY_MS = 2000;

async function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function verifyDeployment() {
  console.log(`🔍 [Deploy Verification] Polling health endpoint: ${TARGET_URL}/health`);
  console.log(`⏱️ Max attempts: ${MAX_ATTEMPTS}`);

  let delay = INITIAL_DELAY_MS;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const startTime = Date.now();
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);

      const res = await fetch(`${TARGET_URL}/health`, {
        signal: controller.signal,
        headers: { "User-Agent": "DeployVerification/1.0" },
      });
      clearTimeout(timeoutId);

      const elapsed = Date.now() - startTime;

      if (res.status === 200) {
        const body = await res.json();
        if (body.status === "ok") {
          console.log(`\n✅ [Deploy Verified] Health check passed on attempt ${attempt}/${MAX_ATTEMPTS}`);
          console.log(`   - HTTP Status: ${res.status}`);
          console.log(`   - Latency: ${elapsed}ms`);
          console.log(`   - Mode: ${body.mode}`);
          console.log(`   - Timestamp: ${body.timestamp}`);
          process.exit(0);
        }
      }

      console.log(`⚠️ Attempt ${attempt}/${MAX_ATTEMPTS}: Received HTTP ${res.status} (${elapsed}ms). Retrying in ${delay}ms...`);
    } catch (err) {
      console.log(`⚠️ Attempt ${attempt}/${MAX_ATTEMPTS}: Connection failed (${err.message}). Retrying in ${delay}ms...`);
    }

    await sleep(delay);
    delay = Math.min(delay * 1.5, 10000);
  }

  console.error(`\n❌ [Deploy Verification Failed] Health check did not pass within ${MAX_ATTEMPTS} attempts.`);
  process.exit(1);
}

verifyDeployment();
