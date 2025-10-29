const { Client } = require("pg");
const logger = require("../logger");

async function readDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: true,
  });

  try {
    await client.connect();
    logger.info("✅ Connected to Leapcell database!");

    // 🔹 Fetch data from your table
    const result = await client.query(
      `SELECT * FROM email_tracker ORDER BY sent_at DESC;`
    );
    return { rowCount: result.rowCount, rows: result.rows };
  } catch (err) {
    logger.error("❌ Error inspecting database:", err.message);
  } finally {
    await client.end();
    logger.info("🔒 Connection closed.");
  }
}

module.exports = { readDb };
