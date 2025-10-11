// scripts/monitor.js - Health monitoring script
const axios = require("axios");
const logger = require("../logger");

const BASE_URL = process.env.BASE_URL || "http://localhost:2900";

async function healthCheck() {
  try {
    const response = await axios.get(`${BASE_URL}/health`);
    console.log("✅ Health check passed:", response.data);
    return true;
  } catch (error) {
    console.error("❌ Health check failed:", error.message);
    return false;
  }
}

async function checkScheduledJobs() {
  try {
    const response = await axios.get(`${BASE_URL}/scheduled-jobs`);
    console.log("📅 Scheduled jobs:", response.data);
    return true;
  } catch (error) {
    console.error("❌ Failed to get scheduled jobs:", error.message);
    return false;
  }
}

async function getDatabaseStats() {
  try {
    const response = await axios.get(`${BASE_URL}/admin/database-stats`);
    console.log("📊 Database stats:", response.data);
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
