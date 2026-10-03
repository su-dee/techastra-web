import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { createApp } from "../server/app.js";
import { normalizeMobile, verifyPassword } from "../server/auth.js";
import { applyMigrations } from "../server/migrations.js";

let db, app, cookie, userId, registrationId;
const origin = "http://localhost:5173";
const post = (path, body, session = cookie) => {
  const r = request(app).post(path).set("Origin", origin);
  if (session) r.set("Cookie", session);
  return r.send(body);
};
before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  await applyMigrations(db);
  app = createApp(db);
});
after(async () => {
  await db.close();
});

test("optional domain is saved as NULL and team names cannot be reused by another account", async () => {
  const owner = await post(
    "/api/auth/signup",
    { username: "optional_owner", password: "optional owner pass" },
    null,
  ).expect(201);
  const ownerCookie = owner.headers["set-cookie"][0].split(";")[0];
  const body = {
    teamName: "  Optional   Squad  ",
    email: "optional@example.invalid",
    squadSize: 3,
    conductAccepted: true,
  };
  const created = await post("/api/registrations", body, ownerCookie).expect(
    201,
  );
  assert.equal(created.body.registration.domain, null);
  assert.equal(created.body.registration.problem_id, null);
  assert.equal(created.body.registration.team_name, "Optional Squad");
  const other = await post(
    "/api/auth/signup",
    { username: "duplicate_owner", password: "duplicate owner pass" },
    null,
  ).expect(201);
  const otherCookie = other.headers["set-cookie"][0].split(";")[0];
  await post(
    "/api/registrations",
    { ...body, teamName: "optional squad" },
    otherCookie,
  ).expect(409);
  await post(
    "/api/registrations",
    { ...body, teamName: " OPTIONAL    SQUAD " },
    otherCookie,
  ).expect(409);
  const rows = await db.query(
    "SELECT COUNT(*)::int AS count FROM registrations WHERE LOWER(team_name)='optional squad'",
  );
  assert.equal(rows.rows[0].count, 1);
  // Direct SQL writes cannot bypass normalized duplicate detection either.
  await assert.rejects(
    db.query(
      "INSERT INTO registrations (id,user_id,team_name,lead_email,squad_size,conduct_accepted) VALUES ($1,$2,$3,$4,2,TRUE)",
      [
        "00000000-0000-4000-8000-000000000099",
        other.body.user.id,
        " OPTIONAL    SQUAD ",
        "other@example.invalid",
      ],
    ),
    { code: "23505" },
  );
});

test("a selected challenge supplies its domain when the optional domain is blank", async () => {
  const owner = await post(
    "/api/auth/signup",
    { username: "challenge_owner", password: "challenge owner pass" },
    null,
  ).expect(201);
  const ownerCookie = owner.headers["set-cookie"][0].split(";")[0];
  const result = await post(
    "/api/registrations",
    {
      teamName: "Challenge Squad",
      email: "challenge@example.invalid",
      squadSize: 3,
      domain: "",
      problemId: "HN-X-02",
      conductAccepted: true,
    },
    ownerCookie,
  ).expect(201);
  assert.equal(result.body.registration.domain, "HN-X");
  await assert.rejects(
    db.query("UPDATE registrations SET domain=NULL WHERE id=$1", [
      result.body.registration.id,
    ]),
    { code: "23514" },
  );
});

test("mobile normalization rejects arbitrary text and consistently normalizes formatting", () => {
  assert.equal(normalizeMobile("+91 (98765) 43210"), "919876543210");
  assert.equal(normalizeMobile("abc9876543210"), null);
  assert.equal(normalizeMobile("123"), null);
});
test("unauthenticated registration is rejected", async () => {
  await post("/api/registrations", {}).expect(401);
});
test("cross-origin account creation is rejected", async () => {
  await request(app)
    .post("/api/auth/signup")
    .set("Origin", "https://evil.example")
    .send({ username: "attacker", password: "attacker password" })
    .expect(403);
});
test("invalid account details are rejected", async () => {
  await post("/api/auth/signup", {
    username: "x",
    password: "long enough",
  }).expect(400);
  await post("/api/auth/signup", {
    username: "short_pw",
    password: "abc",
  }).expect(400);
  // A phone number is not accepted as a new password.
  const phone = await post("/api/auth/signup", {
    username: "phone_pw",
    password: "+91 98765 43210",
  }).expect(400);
  assert.match(phone.body.error, /phone number/);
});
test("signup persists a salted credential hash and issues an HTTP-only cookie", async () => {
  const response = await post("/api/auth/signup", {
    username: "Test_Builder",
    password: "correct horse 42",
  }).expect(201);
  assert.equal(response.body.user.username, "test_builder");
  assert.equal(response.body.user.password_hash, undefined);
  userId = response.body.user.id;
  cookie = response.headers["set-cookie"][0].split(";")[0];
  assert.match(response.headers["set-cookie"][0], /HttpOnly/);
  assert.match(response.headers["set-cookie"][0], /SameSite=Strict/);
  const {
    rows: [user],
  } = await db.query("SELECT * FROM users WHERE id=$1", [userId]);
  assert.match(user.password_hash, /^scrypt:/);
  assert.ok(!user.password_hash.includes("correct horse"));
  assert.equal(user.password_kind, "chosen");
  assert.equal(
    await verifyPassword("correct horse 42", user.password_hash),
    true,
  );
  const {
    rows: [session],
  } = await db.query("SELECT * FROM sessions WHERE user_id=$1", [userId]);
  assert.notEqual(session.token_hash, cookie.split("=")[1]);
});
test("duplicate usernames are rejected case-insensitively", async () => {
  await post("/api/auth/signup", {
    username: "TEST_BUILDER",
    password: "another password",
  }).expect(409);
});
test("session returns only the signed-in user and private responses cannot be cached", async () => {
  const res = await request(app)
    .get("/api/auth/me")
    .set("Cookie", cookie)
    .expect(200);
  assert.equal(res.body.user.id, userId);
  assert.equal(res.headers["cache-control"], "no-store");
});
test("registration rejects domain/challenge mismatch and missing agreement", async () => {
  const body = {
    teamName: "Nexus Test Squad",
    email: "test@example.com",
    domain: "HN-AI",
    squadSize: 3,
    problemId: "HN-CS-01",
    conductAccepted: true,
  };
  await post("/api/registrations", body).expect(400);
  await post("/api/registrations", {
    ...body,
    problemId: "HN-AI-01",
    conductAccepted: false,
  }).expect(400);
});
test("registration persists all fields and is available after reload", async () => {
  const res = await post("/api/registrations", {
    teamName: "Nexus Test Squad",
    email: "test@example.com",
    domain: "HN-AI",
    squadSize: 3,
    problemId: "HN-AI-01",
    abstract: "A grounded campus assistant",
    conductAccepted: true,
  }).expect(201);
  registrationId = res.body.registration.id;
  const saved = await request(app)
    .get("/api/registrations/me")
    .set("Cookie", cookie)
    .expect(200);
  assert.equal(saved.body.registration.id, registrationId);
  assert.equal(saved.body.registration.squad_size, 3);
  await post("/api/registrations", {
    teamName: "Another Team",
    email: "test@example.com",
    domain: "HN-AI",
    squadSize: 3,
    conductAccepted: true,
  }).expect(409);
});
test("logout revokes the session and invalid credentials cannot sign in", async () => {
  await post("/api/auth/logout", {}).expect(200);
  await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
  await post("/api/auth/login", {
    username: "test_builder",
    password: "wrong password",
  }).expect(401);
  await post("/api/auth/login", {
    username: "missing_builder",
    password: "wrong password",
  }).expect(401);
});
test("correct login restores registration; other accounts cannot access it", async () => {
  const login = await post("/api/auth/login", {
    username: "TEST_BUILDER",
    password: "correct horse 42",
  }).expect(200);
  assert.equal(login.body.user.mustSetPassword, false);
  cookie = login.headers["set-cookie"][0].split(";")[0];
  const own = await request(app)
    .get("/api/registrations/me")
    .set("Cookie", cookie)
    .expect(200);
  assert.equal(own.body.registration.id, registrationId);
  const other = await post(
    "/api/auth/signup",
    { username: "other_builder", password: "other builder pass" },
    null,
  ).expect(201);
  const otherCookie = other.headers["set-cookie"][0].split(";")[0];
  const isolated = await request(app)
    .get("/api/registrations/me")
    .set("Cookie", otherCookie)
    .expect(200);
  assert.equal(isolated.body.registration, null);
});
test("expired sessions cannot access account data", async () => {
  await db.query("UPDATE sessions SET expires_at=$1 WHERE user_id=$2", [
    new Date(0),
    userId,
  ]);
  await request(app).get("/api/auth/me").set("Cookie", cookie).expect(401);
});
test("schema constraints prevent invalid registrations even outside the API", async () => {
  await assert.rejects(
    db.query("UPDATE registrations SET squad_size=6 WHERE id=$1", [
      registrationId,
    ]),
  );
  await assert.rejects(
    db.query("UPDATE registrations SET conduct_accepted=false WHERE id=$1", [
      registrationId,
    ]),
  );
  await assert.rejects(
    db.query("UPDATE registrations SET problem_id='HN-CS-01' WHERE id=$1", [
      registrationId,
    ]),
  );
});
