import { readFileSync } from "node:fs";
import pg from "pg";
import { setting } from "./env.js";

// Optional settings for a hosted database such as Supabase:
//   DB_SCHEMA   - keep Hack Nexus's tables in their own schema (e.g. "hacknexus").
//                 Use a session-mode connection (Supabase pooler port 5432) so
//                 the per-connection search_path holds.
//   DB_SSL      - "1" to connect over SSL. DB_SSL_CA = path to the provider's CA
//                 certificate to verify the server; without it the connection is
//                 encrypted but the certificate isn't checked.
//   DB_POOL_MAX - connections kept open (default 10; keep low on free plans).
const schema = setting("DB_SCHEMA") || "";
if (schema && !/^[a-z_][a-z0-9_]*$/.test(schema))
  throw new Error("DB_SCHEMA must be a plain lowercase name, e.g. hacknexus.");
const ssl =
  setting("DB_SSL") === "1"
    ? setting("DB_SSL_CA")
      ? { ca: readFileSync(setting("DB_SSL_CA"), "utf8") }
      : { rejectUnauthorized: false }
    : undefined;

// With DB_SSL set, SSL is configured here: an sslmode in the URL would
// override it (and demand a CA the system doesn't trust), so drop it.
let connectionString = setting("DATABASE_URL");
if (ssl && connectionString) {
  try {
    const url = new URL(connectionString);
    url.searchParams.delete("sslmode");
    connectionString = url.toString();
  } catch {
    // not a URL - leave it as given
  }
}

// Every connection works inside the app's schema (queries use plain table
// names): set at connection start-up. DB_SCHEMA_MODE=set runs a SET after
// connecting instead, for poolers that reject start-up options.
const setMode = setting("DB_SCHEMA_MODE") === "set";
export const db = new pg.Pool({
  connectionString,
  connectionTimeoutMillis: Number(setting("DB_CONNECT_TIMEOUT_MS") || 10000),
  max: Number(setting("DB_POOL_MAX") || 10),
  ssl,
  ...(schema && !setMode ? { options: `-c search_path=${schema}` } : {}),
});
if (schema && setMode)
  db.on("connect", (client) => {
    client.query(`SET search_path TO ${schema}`).catch(() => {});
  });
db.on("error", (error) =>
  console.error("Database connection error:", error.code),
);
export const dbSchema = schema;
