const sqlite3 = require("sqlite3").verbose();

// Open the database
let db = new sqlite3.Database("storage/email-tracker.db", (err) => {
  if (err) {
    console.error("Error opening database:", err.message);
  } else {
    console.log("Connected to the email-tracker.db database.");
  }
});

// List all tables
db.all(
  "SELECT name FROM sqlite_master WHERE type='table'",
  [],
  (err, tables) => {
    if (err) {
      console.error("Error fetching tables:", err.message);
      return;
    }

    console.log("Tables in the database:");
    tables.forEach((table) => {
      console.log(`- ${table.name}`);
    });

    // Optionally query one table (change the name to an actual one)
    const exampleTable = tables[3]?.name; // Pick the first table //SELECT * FROM email_tracker ORDER BY sent_at DESC LIMIT 5;
    if (exampleTable) {
      db.all(`SELECT * FROM ${exampleTable} LIMIT 100`, [], (err, rows) => {
        if (err) {
          console.error("Error reading data:", err.message);
          return;
        }

        console.log(`\nData from "${exampleTable}" table:`);
        console.table(rows);
      });
    }
  }
);

// Close the DB after a short delay to ensure queries complete
setTimeout(() => {
  db.close((err) => {
    if (err) {
      console.error("Error closing database:", err.message);
    } else {
      console.log("Closed the database connection.");
    }
  });
}, 1000);
