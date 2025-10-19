const { Client } = require("pg");
const QueryStream = require("pg-query-stream");

require("dotenv").config();

async function readDb() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });

  const allData = {}; // Will store results per table

  try {
    await client.connect();

    // Fetch all user tables
    const tablesResult = await client.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
    `);

    const tableNames = tablesResult.rows.map((r) => r.table_name);

    // Loop through each table
    for (const tableName of tableNames) {
      const columnCheck = await client.query(
        `SELECT column_name 
         FROM information_schema.columns 
         WHERE table_name = $1 AND column_name = 'id'`,
        [tableName]
      );
      const hasIdColumn = columnCheck.rows.length > 0;

      const sql = hasIdColumn
        ? `SELECT * FROM "${tableName}" ORDER BY id`
        : `SELECT * FROM "${tableName}"`;

      const stream = client.query(new QueryStream(sql));
      const tableRows = [];

      // Stream each row
      await new Promise((resolve, reject) => {
        stream.on("data", (row) => {
          tableRows.push(row);
        });
        stream.on("end", resolve);
        stream.on("error", reject);
      });

      allData[tableName] = tableRows;
    }

    return allData;
  } catch (err) {
    throw err;
  } finally {
    await client.end();
  }
}

module.exports = { readDb };
