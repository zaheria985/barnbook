const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

const MIGRATIONS_DIR = path.join(__dirname, "migrations");

async function ensureMigrationsTable(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      filename TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
    )
  `);
}

async function getMigrationFiles() {
  const files = await fs.readdir(MIGRATIONS_DIR);
  return files.filter((file) => file.endsWith(".sql")).sort();
}

async function getAppliedMigrations(pool) {
  const res = await pool.query("SELECT filename FROM schema_migrations");
  return new Set(res.rows.map((row) => row.filename));
}

async function applyMigration(pool, filename) {
  const client = await pool.connect();
  try {
    const filePath = path.join(MIGRATIONS_DIR, filename);
    const sql = await fs.readFile(filePath, "utf8");

    await client.query("BEGIN");
    await client.query(sql);
    await client.query(
      "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT (filename) DO NOTHING",
      [filename]
    );
    await client.query("COMMIT");
    console.log(`Applied migration: ${filename}`);
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
}

async function runMigrations(pool) {
  await ensureMigrationsTable(pool);

  const files = await getMigrationFiles();
  const applied = await getAppliedMigrations(pool);

  for (const file of files) {
    if (applied.has(file)) {
      continue;
    }
    await applyMigration(pool, file);
  }

  if (files.length === 0) {
    console.log("No migration files found.");
  } else {
    console.log("Migrations up to date.");
  }
}

async function main() {
  const connectionString = process.env.DATABASE_URL;

  if (!connectionString) {
    throw new Error("DATABASE_URL is required to run migrations.");
  }

  const pool = new Pool({ connectionString });

  try {
    await runMigrations(pool);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
