import { readFile } from "node:fs/promises";
import { randomBytes, randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { hashPassword } from "./auth.js";
import { applyMigrations } from "./migrations.js";

// Usage:
//   npm run admin:create -- <username>   create an organizer or promote an existing account
//   npm run admin:remove -- <username>   revoke admin access and admin sessions
const [command, rawUsername] = process.argv.slice(2);
const username = rawUsername?.trim().toLowerCase();
if (
  !["create", "remove"].includes(command) ||
  !/^[a-z0-9_]{3,30}$/.test(username || "")
) {
  console.error(
    "Usage: npm run admin:create -- <username>  |  npm run admin:remove -- <username>",
  );
  process.exit(1);
}

async function databaseUrl() {
  if (process.env.DATABASE_URL) return process.env.DATABASE_URL;
  try {
    // Fall back to the npm run dev:local database.
    const config = JSON.parse(await readFile(".local/postgres.json", "utf8"));
    return `postgresql://${config.user}:${config.password}@127.0.0.1:${config.port}/hacknexus`;
  } catch {
    throw new Error("Set DATABASE_URL, or start npm run dev:local first.");
  }
}

function ask(question) {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    terminal: true,
  });
  // Mask typed characters so the password is not echoed.
  rl._writeToOutput = (text) => {
    if (text.includes(question)) process.stdout.write(text);
  };
  return new Promise((resolve) =>
    rl.question(question, (answer) => {
      rl.close();
      process.stdout.write("\n");
      resolve(answer);
    }),
  );
}

async function readPassword() {
  if (process.env.ADMIN_PASSWORD) return process.env.ADMIN_PASSWORD;
  if (!process.stdin.isTTY)
    throw new Error("Run in a terminal, or provide ADMIN_PASSWORD.");
  const first = await ask("Admin password (min 12 characters): ");
  const second = await ask("Confirm password: ");
  if (first !== second) throw new Error("Passwords do not match.");
  return first;
}

// Connect through db.js so DB_SCHEMA, DB_SSL etc. apply exactly as in the app.
process.env.DATABASE_URL = await databaseUrl();
const { db } = await import("./db.js");
const client = await db.connect();
try {
  await applyMigrations(client);
  if (command === "remove") {
    const removed = await client.query(
      "DELETE FROM admins WHERE user_id=(SELECT id FROM users WHERE username=$1) RETURNING user_id",
      [username],
    );
    if (!removed.rows[0]) throw new Error(`${username} is not an admin.`);
    await client.query("DELETE FROM sessions WHERE user_id=$1 AND is_admin", [
      removed.rows[0].user_id,
    ]);
    console.log(`Admin access removed for ${username}.`);
  } else {
    const password = await readPassword();
    if (password.length < 12 || password.length > 200)
      throw new Error("Admin passwords must be 12–200 characters.");
    const hash = await hashPassword(password);
    let user = (
      await client.query("SELECT id FROM users WHERE username=$1", [username])
    ).rows[0];
    if (!user) {
      // Organizer-only account: the participant credential is random and unusable.
      user = (
        await client.query(
          "INSERT INTO users (id,username,password_hash) VALUES ($1,$2,$3) RETURNING id",
          [
            randomUUID(),
            username,
            await hashPassword(randomBytes(32).toString("hex")),
          ],
        )
      ).rows[0];
    }
    await client.query(
      "INSERT INTO admins (user_id,password_hash) VALUES ($1,$2) ON CONFLICT (user_id) DO UPDATE SET password_hash=EXCLUDED.password_hash",
      [user.id, hash],
    );
    // A password change signs out existing admin sessions.
    await client.query("DELETE FROM sessions WHERE user_id=$1 AND is_admin", [
      user.id,
    ]);
    console.log(`${username} can now sign in at /admin.`);
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
} finally {
  client.release();
  await db.end();
}
