// Uses only the app's dedicated local development database and disposable records.
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import assert from "node:assert/strict";
import pg from "pg";
const config = JSON.parse(
  await readFile(new URL("../.local/postgres.json", import.meta.url), "utf8"),
);
const db = new pg.Client({
  ...config,
  host: "127.0.0.1",
  database: "hacknexus",
});
await db.connect();
const username = `qa_${randomUUID().replaceAll("-", "").slice(0, 20)}`;
const password = "disposable qa password";
const teamName = username.replace("qa_", "QA ");
const secondUsername = `${username}_b`;
let cookie;
async function request(route, body) {
  const res = await fetch(`http://127.0.0.1:3001/api${route}`, {
    method: body ? "POST" : "GET",
    headers: {
      Origin: "http://localhost:5173",
      "Content-Type": "application/json",
      ...(cookie ? { Cookie: cookie } : {}),
    },
    ...(body ? { body: JSON.stringify(body) } : {}),
  });
  const data = await res.json();
  if (res.headers.get("set-cookie"))
    cookie = res.headers.get("set-cookie").split(";")[0];
  return { status: res.status, data };
}
try {
  const health = await request("/health");
  assert.equal(health.status, 200);
  const signup = await request("/auth/signup", { username, password });
  assert.equal(signup.status, 201);
  const registration = await request("/registrations", {
    teamName,
    email: "qa@example.invalid",
    squadSize: 3,
    abstract: "Disposable integration test",
    conductAccepted: true,
  });
  assert.equal(registration.status, 201);
  const saved = await db.query(
    "SELECT r.team_name,r.domain,u.password_hash FROM registrations r JOIN users u ON u.id=r.user_id WHERE u.username=$1",
    [username],
  );
  assert.equal(saved.rows[0].team_name, teamName);
  assert.equal(saved.rows[0].domain, null);
  assert.match(saved.rows[0].password_hash, /^scrypt:/);
  await request("/auth/logout", {});
  assert.equal((await request("/auth/me")).status, 401);
  assert.equal(
    (await request("/auth/login", { username, password })).status,
    200,
  );
  assert.equal(
    (await request("/registrations/me")).data.registration.id,
    registration.data.registration.id,
  );
  assert.equal(
    (await request("/auth/signup", { username: secondUsername, password }))
      .status,
    201,
  );
  for (const name of [
    teamName.toLowerCase(),
    `  ${teamName.replace(" ", "   ")}  `,
  ]) {
    assert.equal(
      (
        await request("/registrations", {
          teamName: name,
          email: "qa@example.invalid",
          squadSize: 3,
          conductAccepted: true,
        })
      ).status,
      409,
    );
  }
  const count = await db.query(
    "SELECT COUNT(*)::int AS count FROM registrations WHERE user_id=$1",
    [signup.data.user.id],
  );
  assert.equal(count.rows[0].count, 1);
  console.log(
    "Native PostgreSQL verified: optional domain stored as NULL, registration persisted and restored after login, duplicate team names rejected across accounts (case and whitespace variants), exactly one team record saved.",
  );
} finally {
  await db.query("DELETE FROM users WHERE username IN ($1,$2)", [
    username,
    secondUsername,
  ]);
  await db.end();
  console.log("Disposable QA records removed.");
}
