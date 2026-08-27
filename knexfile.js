// knexfile.js
require("dotenv").config();

const { parse } = require("pg-connection-string");

function getSsl(host) {
  if (process.env.DB_SSL === "false") return false;
  if (process.env.DB_SSL === "true" || process.env.DB_SSL || process.env.NODE_ENV === "production") {
    if (host && (!host.includes(".") || host === "localhost" || host === "127.0.0.1")) {
      return false;
    }
    return { rejectUnauthorized: false };
  }
  return false;
}

function buildConnection() {
  if (process.env.DB_HOST) {
    const host = process.env.DB_HOST;
    return {
      host: host,
      port: parseInt(process.env.DB_PORT, 10) || 5432,
      user: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      ssl: getSsl(host),
    };
  }

  if (process.env.DATABASE_URL) {
    const parsed = parse(process.env.DATABASE_URL);
    const host = parsed.host;
    return {
      host: host,
      port: parseInt(parsed.port, 10) || 5432,
      user: parsed.user,
      password: parsed.password,
      database: parsed.database,
      ssl: getSsl(host),
    };
  }

  const host = process.env.PGHOST || "127.0.0.1";
  return {
    host: host,
    port: parseInt(process.env.PGPORT, 10) || 5432,
    user: process.env.PGUSER,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    ssl: getSsl(host),
  };
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
