export async function register() {
  // Only run migrations on the Node.js server, not in Edge runtime
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const fs = await import("node:fs/promises");
    const path = await import("node:path");
    const pool = (await import("@/lib/db")).default;

    const migrationsDir = path.join(process.cwd(), "db", "migrations");

    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS schema_migrations (
          filename TEXT PRIMARY KEY,
          applied_at TIMESTAMPTZ NOT NULL DEFAULT now()
        )
      `);

      const files = (await fs.readdir(migrationsDir))
        .filter((f) => f.endsWith(".sql"))
        .sort();

      const applied = await pool.query("SELECT filename FROM schema_migrations");
      const appliedSet = new Set(applied.rows.map((r: { filename: string }) => r.filename));

      for (const file of files) {
        if (appliedSet.has(file)) continue;

        const sql = await fs.readFile(path.join(migrationsDir, file), "utf8");
        const client = await pool.connect();
        try {
          await client.query("BEGIN");
          await client.query(sql);
          await client.query(
            "INSERT INTO schema_migrations (filename) VALUES ($1) ON CONFLICT DO NOTHING",
            [file]
          );
          await client.query("COMMIT");
          console.log(`Auto-applied migration: ${file}`);
        } catch (err) {
          await client.query("ROLLBACK");
          console.error(`Migration ${file} failed:`, err);
        } finally {
          client.release();
        }
      }
    } catch (err) {
      console.error("Auto-migration check failed:", err);
    }
  }
}
