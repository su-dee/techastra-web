import EmbeddedPostgres from "embedded-postgres";
import { mkdir, readFile, writeFile, access } from "node:fs/promises";
import { randomBytes } from "node:crypto";
import path from "node:path";
import { spawn } from "node:child_process";
import { applyMigrations } from "./migrations.js";

// Development only. All data and credentials stay in the ignored .local folder.
const root = path.resolve(".local");
await mkdir(root, { recursive: true, mode: 0o700 });
const configPath = path.join(root, "postgres.json");
let config;
try {
  config = JSON.parse(await readFile(configPath, "utf8"));
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  config = {
    port: 54329,
    user: "hacknexus",
    password: randomBytes(24).toString("hex"),
  };
  await writeFile(configPath, JSON.stringify(config), { mode: 0o600 });
}
const dataDir = path.join(root, "postgres");
const postgres = new EmbeddedPostgres({
  databaseDir: dataDir,
  ...config,
  persistent: true,
  authMethod: "scram-sha-256",
  postgresFlags: ["-h", "127.0.0.1", "-k", root],
  onLog: () => {},
  onError: () => {},
});
let initialized = true;
try {
  await access(path.join(dataDir, "PG_VERSION"));
} catch {
  initialized = false;
}
if (!initialized) await postgres.initialise();
await postgres.start();
const admin = postgres.getPgClient("postgres", "127.0.0.1");
await admin.connect();
const exists = await admin.query(
  "SELECT 1 FROM pg_database WHERE datname='hacknexus'",
);
if (!exists.rows.length) await admin.query("CREATE DATABASE hacknexus");
await admin.end();
const client = postgres.getPgClient("hacknexus", "127.0.0.1");
await client.connect();
await client.query(
  await readFile(new URL("./schema.sql", import.meta.url), "utf8"),
);
await applyMigrations(client);
await client.end();
const databaseUrl = `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/hacknexus`;
console.log(
  `Local PostgreSQL ready on 127.0.0.1:${config.port}. Data persists in .local/postgres.`,
);
if (process.argv.includes("--with-app")) {
  const child = spawn("npm", ["run", "dev"], {
    stdio: "inherit",
    env: {
      ...process.env,
      DATABASE_URL: databaseUrl,
      APP_ORIGIN: "http://localhost:5173",
    },
  });
  child.on("exit", async (code) => {
    await postgres.stop();
    process.exit(code || 0);
  });
  for (const signal of ["SIGTERM", "SIGINT"])
    process.on(signal, () => child.kill(signal));
} else {
  console.log(
    "Use npm run dev:local to launch PostgreSQL and the website together.",
  );
  // Keep the database running; embedded-postgres handles graceful process exit.
  setInterval(() => {}, 60_000);
}
