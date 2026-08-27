// scripts/monitor.js - Health monitoring script
const logger = require("../logger");

const BASE_URL = process.env.BASE_URL || "http://localhost:2900";

async function healthCheck() {
  try {
    const response = await fetch(`${BASE_URL}/health`);
    const data = await response.json();
    console.log("✅ Health check passed:", data);
    return true;
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return false;
  }
}

async function checkScheduledJobs() {
  try {
    const response = await fetch(`${BASE_URL}/scheduled-jobs`);
    const data = await response.json();
    console.log("📅 Scheduled jobs:", data);
    return true;
  } catch (error) {
    console.error("❌ Failed to get scheduled jobs:", error.message);
    return false;
  }
}

async function getDatabaseStats() {
  try {
    const response = await fetch(`${BASE_URL}/admin/database-stats`);
    const data = await response.json();
    console.log("📊 Database stats:", data);
    return true;
  } catch (error) {
    console.error("❌ Failed to get database stats:", error.message);
    return false;
  }
}

async function runMonitoring() {
  console.log("🔍 Running system monitoring...\n");

  await healthCheck();
  await checkScheduledJobs();
  await getDatabaseStats();

  console.log("\n✅ Monitoring complete");
}

// Run monitoring
runMonitoring().catch(console.error);
