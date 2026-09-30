/**
 * Supabase only: make sure participant data can never be read through
 * Supabase's auto-generated public API (PostgREST), even if the Data API is
 * switched on. For every table in the given schemas it
 *   - revokes all privileges from Supabase's API roles (anon, authenticated),
 *   - turns on row-level security with no policies (nothing is readable
 *     through the API; the apps connect as the tables' owner and are
 *     unaffected),
 * and stops future tables from getting API privileges by default.
 *
 *   npm run supabase:lockdown                      # schemas: public, hacknexus
 *   npm run supabase:lockdown -- public hacknexus  # choose schemas
 *
 * Uses DATABASE_URL (run it with the Supabase connection string). On a
 * plain PostgreSQL without Supabase's roles it changes nothing.
 * Safe to re-run - run it again after new migrations.
 */
require("dotenv").config();
const prisma = require("../db");

const schemas = process.argv.slice(2).filter((a) => !a.startsWith("-"));
const SCHEMAS = schemas.length ? schemas : ["public", "hacknexus"];
const q = (name) => `"${String(name).replace(/"/g, '""')}"`;

(async () => {
  const roles = (await prisma.$queryRawUnsafe(`SELECT rolname FROM pg_roles WHERE rolname IN ('anon', 'authenticated')`)).map((r) => r.rolname);
  if (!roles.length) {
    console.log("No Supabase API roles (anon, authenticated) in this database - nothing to lock down.");
    return;
  }
  const who = roles.map(q).join(", ");
  let tables = 0;
  for (const schema of SCHEMAS) {
    const exists = await prisma.$queryRawUnsafe(`SELECT 1 FROM pg_namespace WHERE nspname = $1`, schema);
    if (!exists.length) {
      console.log(`Schema ${schema}: not found, skipped`);
      continue;
    }
    const s = q(schema);
    await prisma.$executeRawUnsafe(`REVOKE ALL ON ALL TABLES IN SCHEMA ${s} FROM ${who}`);
    await prisma.$executeRawUnsafe(`REVOKE ALL ON ALL SEQUENCES IN SCHEMA ${s} FROM ${who}`);
    await prisma.$executeRawUnsafe(`REVOKE ALL ON ALL FUNCTIONS IN SCHEMA ${s} FROM ${who}`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} REVOKE ALL ON TABLES FROM ${who}`);
    await prisma.$executeRawUnsafe(`ALTER DEFAULT PRIVILEGES IN SCHEMA ${s} REVOKE ALL ON SEQUENCES FROM ${who}`);
    if (schema !== "public") await prisma.$executeRawUnsafe(`REVOKE ALL ON SCHEMA ${s} FROM ${who}`);
    const rows = await prisma.$queryRawUnsafe(`SELECT tablename FROM pg_tables WHERE schemaname = $1`, schema);
    for (const { tablename } of rows) {
      await prisma.$executeRawUnsafe(`ALTER TABLE ${s}.${q(tablename)} ENABLE ROW LEVEL SECURITY`);
    }
    tables += rows.length;
    console.log(`Schema ${schema}: ${rows.length} tables locked (no API access, row-level security on)`);
  }
  // Proof: can the API roles still read anything?
  const leaks = await prisma.$queryRawUnsafe(
    `SELECT table_schema, table_name, grantee FROM information_schema.role_table_grants
     WHERE grantee IN ('anon', 'authenticated') AND table_schema = ANY($1::text[])`,
    SCHEMAS
  );
  console.log(leaks.length ? `WARNING - API roles still have access to: ${leaks.map((l) => `${l.table_schema}.${l.table_name}`).join(", ")}` : `Done: ${tables} tables, no API access left.`);
})()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
