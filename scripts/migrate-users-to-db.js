// scripts/migrate-users-to-db.js
//
// One-time migration: moves the subscribers that used to be hardcoded in
// helper/shared-data.js into the `subscribers` table.
//
// This is a self-contained snapshot of that array as it existed before
// shared-data.js was rewritten to be DB-backed -- deliberately NOT calling
// sharedData.getUsers(), since that function now reads FROM this same
// table. Depending on it here would be circular: on a fresh database,
// getUsers() would return nothing to migrate, silently losing these 5
// real email addresses instead of moving them.
const db = require("../db/knex");
const logger = require("../logger");

const LEGACY_USERS = [
  {
    email: process.env.TEST_EMAIL || "test@example.com",
    templateType: "basic",
    cronPattern: "0 8 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: process.env.TEST_EMAIL_2 || "test2@example.com",
    templateType: "basic",
    cronPattern: "30 7 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: "lordsmobile.007ishq@gmail.com",
    templateType: "basic",
    cronPattern: "30 7 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: "lordsmobile.999ishq@gmail.com",
    templateType: "basic",
    cronPattern: "0 7 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
  {
    email: "ishqyt007@gmail.com",
    templateType: "basic",
    cronPattern: "30 6 * * *",
    timezone: "Asia/Kolkata",
    isActive: true,
  },
];

async function migrateUsers() {
  try {
    const records = LEGACY_USERS.map((u) => ({
      email: u.email,
      template_type: u.templateType || "basic",
      cron_pattern: u.cronPattern,
      timezone: u.timezone || "Asia/Kolkata",
      is_active: u.isActive !== false,
    }));

    // onConflict('email').merge() -- safe to re-run without creating
    // duplicates if this is run more than once.
    await db("subscribers").insert(records).onConflict("email").merge();

    logger.info(`Migrated ${records.length} subscribers into the database`, {
      emails: records.map((r) => r.email),
    });
  } catch (error) {
    logger.error("Subscriber migration failed", { error: error.message });
    throw error;
  } finally {
    await db.destroy();
  }
}

migrateUsers()
  .then(() => {
    console.log("Subscriber migration completed successfully");
    process.exit(0);
  })
  .catch((error) => {
    console.error("Subscriber migration failed:", error);
    process.exit(1);
  });
