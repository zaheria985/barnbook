import { Pool } from "pg";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  max: Number(process.env.DB_POOL_MAX) || 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000,
  // TLS is opt-in (the default compose deployment talks to an internal,
  // non-TLS Postgres). Set DB_SSL=1 to enable, DB_SSL=strict to also require a
  // valid certificate chain.
  ssl: process.env.DB_SSL
    ? { rejectUnauthorized: process.env.DB_SSL === "strict" }
    : undefined,
});

export default pool;
