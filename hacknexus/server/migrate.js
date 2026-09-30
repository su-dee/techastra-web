import { readFile } from "node:fs/promises";
import { db } from "./db.js";
import { applyMigrations } from "./migrations.js";
if (!process.env.DATABASE_URL)
  throw new Error("Set DATABASE_URL in .env before running the migration.");
try {
  await db.query(
    await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
  );
  await applyMigrations(db);
  console.log("PostgreSQL schema is ready.");
} finally {
  await db.end();
}
