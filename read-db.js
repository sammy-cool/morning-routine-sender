const { Client } = require("pg");

// Create a new PostgreSQL client
const client = new Client({
  connectionString:
    "postgresql://mrn_user:M0pLwyIqMCwE1GnJoDCz0tvMiXhlE6EK@dpg-d3lte08gjchc73cn5drg-a.oregon-postgres.render.com/mrn",
  ssl: {
    rejectUnauthorized: false,
  },
});

// Async wrapper function
(async () => {
  try {
    await client.connect();
    console.log("✅ Connected to the PostgreSQL database.");

    // Fetch all user-defined tables from public schema
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tableNames = tablesResult.rows.map((row) => row.table_name);
    if (tableNames.length === 0) {
      console.log("⚠️ No tables found in the database.");
      return;
    }

    console.log("\n📦 Tables in the database:");
    tableNames.forEach((name) => {
      // Apply bold only to actual string values
      if (typeof name === "string") {
        console.log(`- ${name}`);
      }
    });

    // Loop through each table and display its data
    for (const tableName of tableNames) {
      console.log(`\n📄 Data from "${tableName}" table:`);
      const dataResult = await client.query(
        `SELECT * FROM "${tableName}" LIMIT 100`
      );
      console.table(dataResult.rows);
    }
  } catch (error) {
    console.error("❌ Error:", error.message || error);
  } finally {
    await client.end();
    console.log("🔌 Database connection closed.");
  }
})();
