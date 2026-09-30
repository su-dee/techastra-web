import { readFile } from "node:fs/promises";
import { db, dbSchema } from "./db.js";
import { applyMigrations } from "./migrations.js";
import { setting } from "./env.js";
if (!setting("DATABASE_URL"))
  throw new Error("Set DATABASE_URL in .env before running the migration.");
try {
  // On a shared database (e.g. Supabase), Hack Nexus lives in its own schema.
  if (dbSchema) await db.query(`CREATE SCHEMA IF NOT EXISTS ${dbSchema}`);
  await db.query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  await applyMigrations(db);
  console.log(
    `PostgreSQL schema is ready${dbSchema ? ` (schema "${dbSchema}")` : ""}.`,
  );
} finally {
  await db.end();
}
