// knexfile.js
require("dotenv").config();

const { parse } = require("pg-connection-string");

function buildConnection() {
  let dbConfig = {};

  if (process.env.DATABASE_URL) {
    dbConfig = parse(process.env.DATABASE_URL);
  } else {
    dbConfig = {
      host: process.env.DB_HOST || process.env.PGHOST,
      port: process.env.DB_PORT || process.env.PGPORT || 5432,
      user: process.env.DB_USER || process.env.PGUSER,
      password: process.env.DB_PASSWORD || process.env.PGPASSWORD,
      database: process.env.DB_NAME || process.env.PGDATABASE,
    };
  }

  const host = dbConfig.host;
  const isInternal =
    !host ||
    !host.includes(".") ||
    host === "localhost" ||
    host === "127.0.0.1";

  if (process.env.DB_SSL === "false" || isInternal) {
    dbConfig.ssl = false;
  } else {
    dbConfig.ssl = { rejectUnauthorized: false };
  }

  return dbConfig;
}

module.exports = {
  test: {
    client: "sqlite3",
    connection: { filename: ":memory:" },
    useNullAsDefault: true,
    migrations: { directory: "./db/migrations" },
    seeds: { directory: "./db/seeds" },
  },
  development: {
    client: process.env.DB_CLIENT || "pg",
    connection: buildConnection(),
    useNullAsDefault: true,
    migrations: {
      directory: "./db/migrations",
    },
    seeds: {
      directory: "./db/seeds",
    },
    pool: {
      min: 0,
      max: 10,
      idleTimeoutMillis: 30000,
    },
  },

  production: {
    client: process.env.DB_CLIENT || "pg",
    connection: buildConnection(),
    useNullAsDefault: true,
    migrations: {
      directory: "./db/migrations",
    },
    pool: {
      min: 0,
      max: 10,
      idleTimeoutMillis: 30000,
      acquireTimeoutMillis: 60000,
    },
  },
};
