import { readFile } from "node:fs/promises";
const files = [
  "002_optional_domain.sql",
  "003_admin.sql",
  "004_payments.sql",
  "005_members.sql",
  "006_passwords.sql",
  "007_short_pass_codes.sql",
  "008_meals.sql",
  "009_certificates.sql",
];
export async function applyMigrations(db) {
  // Versioned SQL is additive/idempotent and preserves existing registrations.
  // PGlite needs exec() for multi-statement SQL; node-postgres uses query().
  const run = db.exec ? (sql) => db.exec(sql) : (sql) => db.query(sql);
  for (const file of files)
    await run(
      await readFile(new URL(`./migrations/${file}`, import.meta.url), "utf8"),
    );
}
