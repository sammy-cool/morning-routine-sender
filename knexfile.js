// knexfile.js
require("dotenv").config();

const getSslConfig = () => {
  if (process.env.DB_SSL === "false") return false;
  if (process.env.DB_SSL === "true" || process.env.DB_SSL) {
    return { rejectUnauthorized: false };
  }
  if (process.env.NODE_ENV === "production") {
    return { rejectUnauthorized: false };
  }
  return false;
};

const getConnection = () => {
  if (process.env.DATABASE_URL) {
    return {
      connectionString: process.env.DATABASE_URL,
      ssl: getSslConfig(),
    };
  }

  return {
    host: process.env.DB_HOST,
    port: process.env.DB_PORT || 5432,
    user: process.env.DB_USER,
    password: process.env.DB_PASSWORD,
    database: process.env.DB_NAME,
    ssl: getSslConfig(),
  };
};

module.exports = {
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
