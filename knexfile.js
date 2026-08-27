// knexfile.js
require("dotenv").config();

function getSslConfig(host, connectionString) {
  if (process.env.DB_SSL === "false") return false;

  let targetHost = host;
  if (!targetHost && connectionString) {
    try {
      const parsed = new URL(connectionString);
      targetHost = parsed.hostname;
    } catch (e) {
      const match = connectionString.match(/@([^:/]+)/);
      if (match) targetHost = match[1];
    }
  }

  // Single-label hostnames without dots (like Render internal dpg-xxxx-a, localhost, etc.)
  // do not support SSL on private networks.
  const isInternal =
    !targetHost ||
    !targetHost.includes(".") ||
    targetHost === "localhost" ||
    targetHost === "127.0.0.1";

  if (isInternal) {
    return false;
  }

  if (process.env.DB_SSL === "true" || process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: false };
  }

  return false;
}

const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(null, process.env.DATABASE_URL),
    };
  }

  const host = process.env.DB_HOST || process.env.PGHOST;
  const user = process.env.DB_USER || process.env.PGUSER;
  const password = process.env.DB_PASSWORD || process.env.PGPASSWORD;
  const database = process.env.DB_NAME || process.env.PGDATABASE;
  const port = process.env.DB_PORT || process.env.PGPORT || 5432;

  return {
    host,
    port,
    user,
    password,
    database,
    ssl: getSslConfig(host, null),
  };
};

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
    connection: getConnection(),
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
    connection: getConnection(),
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
