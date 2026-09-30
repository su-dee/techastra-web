import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";
import { applyMigrations } from "../server/migrations.js";

let db, app, legacyId, adminCookie;
const origin = "http://localhost:5173";
const schema = await readFile(
  new URL("../server/schema.sql", import.meta.url),
  "utf8",
);
const cookieOf = (res) => res.headers["set-cookie"][0].split(";")[0];
const send = (method, path, body, cookie) => {
  const r = request(app)[method](path).set("Origin", origin);
  if (cookie) r.set("Cookie", cookie);
  return body === undefined ? r : r.send(body);
};
const login = (username, password) =>
  send("post", "/api/auth/login", { username, password });

before(async () => {
  db = new PGlite();
  await db.exec(schema);
  // An account from before chosen passwords: its hash is of the mobile digits.
  legacyId = randomUUID();
  await db.query(
    "INSERT INTO users (id,username,password_hash) VALUES ($1,'legacy_lead',$2)",
    [legacyId, await hashPassword("919876543210")],
  );
  await applyMigrations(db);
  app = createApp(db, { origin });
  const adminId = randomUUID();
  await db.query(
    "INSERT INTO users (id,username,password_hash) VALUES ($1,'organizer',$2)",
    [adminId, await hashPassword("unused participant password")],
  );
  await db.query("INSERT INTO admins (user_id,password_hash) VALUES ($1,$2)", [
    adminId,
    await hashPassword("organizer admin password"),
  ]);
  adminCookie = cookieOf(
    await send("post", "/api/admin/login", {
      username: "organizer",
      password: "organizer admin password",
    }).expect(200),
  );
});
after(() => db.close());

test("the migration keeps existing accounts on their mobile number and is safe to rerun", async () => {
  await applyMigrations(db);
  const { rows } = await db.query(
    "SELECT password_kind FROM users WHERE id=$1",
    [legacyId],
  );
  assert.equal(rows[0].password_kind, "mobile");
  const created = await send("post", "/api/auth/signup", {
    username: "fresh_builder",
    password: "fresh builder pass",
  }).expect(201);
  assert.equal(created.body.user.mustSetPassword, false);
  const fresh = await db.query(
    "SELECT password_kind FROM users WHERE username='fresh_builder'",
  );
  assert.equal(fresh.rows[0].password_kind, "chosen");
});

test("a mobile-number account signs in once, then must choose a password", async () => {
  const first = await login("legacy_lead", "+91 98765 43210").expect(200);
  assert.equal(first.body.user.mustSetPassword, true);
  const cookie = cookieOf(first);
  const other = cookieOf(
    await login("legacy_lead", "919876543210").expect(200),
  );
  const me = await send("get", "/api/auth/me", undefined, cookie).expect(200);
  assert.equal(me.body.user.mustSetPassword, true);

  const change = (body) => send("post", "/api/auth/password", body, cookie);
  await change({
    currentPassword: "9999999999",
    newPassword: "my new password",
  }).expect(401);
  const phone = await change({
    currentPassword: "919876543210",
    newPassword: "98765 43210",
  }).expect(400);
  assert.match(phone.body.error, /phone number/);
  await change({
    currentPassword: "919876543210",
    newPassword: "short",
  }).expect(400);
  const done = await change({
    currentPassword: "+91 98765 43210",
    newPassword: "my new password",
  }).expect(200);
  assert.equal(done.body.user.mustSetPassword, false);

  // This session stays signed in; the account's other sessions are ended.
  await send("get", "/api/auth/me", undefined, cookie).expect(200);
  await send("get", "/api/auth/me", undefined, other).expect(401);
  await login("legacy_lead", "919876543210").expect(401);
  const again = await login("legacy_lead", "my new password").expect(200);
  assert.equal(again.body.user.mustSetPassword, false);
});

test("wrong passwords are limited per account, not for the whole network", async () => {
  await send("post", "/api/auth/signup", {
    username: "target_user",
    password: "target password",
  }).expect(201);
  await send("post", "/api/auth/signup", {
    username: "neighbour",
    password: "neighbour password",
  }).expect(201);
  // A successful sign-in clears earlier mistakes.
  for (let i = 0; i < 9; i++)
    await login("target_user", "not the password").expect(401);
  await login("TARGET_USER", "target password").expect(200);
  for (let i = 0; i < 10; i++)
    await login("target_user", "not the password").expect(401);
  const locked = await login("target_user", "target password").expect(429);
  assert.match(locked.body.error, /this account/);
  // Someone else on the same network is unaffected.
  await login("neighbour", "neighbour password").expect(200);
});

test("organizers can issue a one-time password that must be replaced", async () => {
  const signup = await send("post", "/api/auth/signup", {
    username: "forgetful",
    password: "forgotten password",
  }).expect(201);
  const userId = signup.body.user.id;
  const oldCookie = cookieOf(signup);
  await send(
    "post",
    `/api/admin/users/${userId}/reset-password`,
    undefined,
    oldCookie,
  ).expect(401);
  const reset = await send(
    "post",
    `/api/admin/users/${userId}/reset-password`,
    undefined,
    adminCookie,
  ).expect(200);
  assert.match(reset.body.password, /^[a-z2-9]{4}-[a-z2-9]{4}-[a-z2-9]{4}$/);
  await send("get", "/api/auth/me", undefined, oldCookie).expect(401);
  await login("forgetful", "forgotten password").expect(401);
  const temp = await login("forgetful", reset.body.password).expect(200);
  assert.equal(temp.body.user.mustSetPassword, true);
  await send(
    "post",
    "/api/auth/password",
    {
      currentPassword: reset.body.password,
      newPassword: "remembered this time",
    },
    cookieOf(temp),
  ).expect(200);
  await login("forgetful", reset.body.password).expect(401);

  const { rows } = await db.query(
    "SELECT details FROM admin_audit_log WHERE action='reset_password'",
  );
  assert.equal(rows.length, 1);
  assert.ok(!JSON.stringify(rows[0].details).includes(reset.body.password));
  const organizer = await db.query(
    "SELECT id FROM users WHERE username='organizer'",
  );
  await send(
    "post",
    `/api/admin/users/${organizer.rows[0].id}/reset-password`,
    undefined,
    adminCookie,
  ).expect(400);
});
