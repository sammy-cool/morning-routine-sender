// scripts/migrate-json-to-db.js
const fs = require("fs");
const db = require("../db/knex");
const logger = require("../logger");

async function migrateData() {
  try {
    // Read existing JSON file
    const jsonPath = "./storage/email-tracker.json";

    if (!fs.existsSync(jsonPath)) {
      logger.info("No existing email-tracker.json found, skipping migration");
      return;
    }

    const jsonData = JSON.parse(fs.readFileSync(jsonPath, "utf8"));

    // Transform and insert data
    // Adjust this based on your actual JSON structure
    const records = [];

    if (Array.isArray(jsonData)) {
      for (const item of jsonData) {
        records.push({
          recipient_email: item.recipient || item.email,
          template_type: item.template || "default",
          sent_at: new Date(item.sentAt || item.timestamp),
          status: item.status || "success",
          message_id: item.messageId,
          metadata: JSON.stringify(item.metadata || {}),
          retry_count: item.retryCount || 0,
        });
      }
    } else {
      // Handle object-based structure
      for (const [key, value] of Object.entries(jsonData)) {
        records.push({
          recipient_email: value.email,
          template_type: value.template || "default",
          sent_at: new Date(value.lastSent),
          status: "success",
          metadata: JSON.stringify(value),
        });
      }
    }

    if (records.length > 0) {
      await db.batchInsert("email_tracker", records, 100);
      logger.info(`Migrated ${records.length} records from JSON to database`);

      // Backup original JSON
      fs.renameSync(jsonPath, `${jsonPath}.backup-${Date.now()}`);
      logger.info("Original JSON file backed up");
    }
  } catch (error) {
    logger.error("Migration failed", { error: error.message });
    throw error;
  } finally {
    await db.destroy();
  }
}

migrateData()
  .then(() => {
    console.log("Migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Migration failed:", error);
    process.exit(1);
  });
