// knexfile.js
require("dotenv").config();

module.exports = {
  development: {
    client: "sqlite3",
    connection: {
      filename: "./storage/email-tracker.db",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./db/migrations",
    },
    seeds: {
      directory: "./db/seeds",
    },
  },

  production: {
    client: "sqlite3",
    connection: {
      filename: process.env.DB_PATH || "/var/data/email-tracker.db",
    },
    useNullAsDefault: true,
    migrations: {
      directory: "./db/migrations",
    },
    pool: {
      min: 2,
      max: 10,
    },
  },
};
