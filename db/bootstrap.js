const fs = require("node:fs/promises");
const path = require("node:path");
const { Pool } = require("pg");

const DEFAULT_MAX_WAIT_MS = 60_000;
const DEFAULT_POLL_MS = 1_000;

async function sleep(ms) {
  await new Promise((r) => setTimeout(r, ms));
}

async function waitForDb(pool, maxWaitMs, pollMs) {
  const start = Date.now();
  while (true) {
    try {
      await pool.query("SELECT 1");
      return;
    } catch (err) {
      const elapsed = Date.now() - start;
      if (elapsed >= maxWaitMs) {
        throw new Error(
          `Database not ready after ${Math.ceil(maxWaitMs / 1000)}s: ${err?.message || err}`
        );
      }
      await sleep(pollMs);
    }
  }
}

async function tableExists(pool, tableName) {
  const res = await pool.query(
    `SELECT EXISTS (
       SELECT 1
       FROM information_schema.tables
       WHERE table_schema = 'public'
         AND table_name = $1
     ) AS present`,
    [tableName]
  );
  return !!res.rows[0]?.present;
}

async function applySqlFile(pool, filePath) {
  const sql = await fs.readFile(filePath, "utf8");
  await pool.query(sql);
}

async function main() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is required.");
  }

  const maxWaitMs = Number(process.env.DB_WAIT_MAX_MS || "") || DEFAULT_MAX_WAIT_MS;
  const pollMs = Number(process.env.DB_WAIT_POLL_MS || "") || DEFAULT_POLL_MS;

  const bootstrapSchemaEnv = process.env.BOOTSTRAP_SCHEMA;
  const bootstrapSchema =
    bootstrapSchemaEnv === undefined ||
    bootstrapSchemaEnv === "" ||
    bootstrapSchemaEnv === "1" ||
    bootstrapSchemaEnv?.toLowerCase?.() === "true";

  const seedDefaultUserEnv = process.env.SEED_DEFAULT_USER;
  const seedDefaultUser =
    seedDefaultUserEnv === undefined ||
    seedDefaultUserEnv === "" ||
    seedDefaultUserEnv === "1" ||
    seedDefaultUserEnv?.toLowerCase?.() === "true";

  const pool = new Pool({ connectionString });

  try {
    await waitForDb(pool, maxWaitMs, pollMs);

    const hasUsers = await tableExists(pool, "users");
    if (!hasUsers) {
      if (!bootstrapSchema) {
        throw new Error(
          "Base schema not found (users table missing) and BOOTSTRAP_SCHEMA=0. " +
            "Point DATABASE_URL to an initialized Barnbook database or set BOOTSTRAP_SCHEMA=1."
        );
      }

      const schemaPath = path.join(__dirname, "schema.sql");
      console.log("Applying base schema from db/schema.sql...");
      await applySqlFile(pool, schemaPath);
      console.log("Base schema applied.");

      if (seedDefaultUser) {
        const seedPath = path.join(__dirname, "seed-default-user.sql");
        console.log("Seeding default user from db/seed-default-user.sql...");
        await applySqlFile(pool, seedPath);
        console.log("Default user seed applied.");
      }
    }
  } finally {
    await pool.end();
  }
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
