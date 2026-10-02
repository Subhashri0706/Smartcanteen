require("dotenv").config();
const { Pool } = require("pg");

const isProduction = process.env.NODE_ENV === "production";

// Configure PostgreSQL connection using process.env.DATABASE_URL or individual environment variables
const poolConfig = process.env.DATABASE_URL
  ? {
      connectionString: process.env.DATABASE_URL,
      ssl:
        isProduction || process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : false,
    }
  : {
      user: process.env.PGUSER || "postgres",
      host: process.env.PGHOST || "localhost",
      database: process.env.PGDATABASE || "Smartcanteen",
      password: process.env.PGPASSWORD,
      port: process.env.PGPORT ? parseInt(process.env.PGPORT, 10) : 5432,
      ssl:
        process.env.DB_SSL === "true"
          ? { rejectUnauthorized: false }
          : false,
    };

const pool = new Pool(poolConfig);

module.exports = pool;