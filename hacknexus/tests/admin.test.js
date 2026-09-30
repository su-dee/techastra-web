import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";
import { applyMigrations } from "../server/migrations.js";

let db, app, adminCookie, participantCookie, registrationId, participantId;
const origin = "http://localhost:5173";
const password = "correct horse battery";
const cookieOf = (res) => res.headers["set-cookie"][0].split(";")[0];
const send = (method, path, body, cookie) => {
  const r = request(app)[method](path).set("Origin", origin);
  if (cookie) r.set("Cookie", cookie);
  return body === undefined ? r : r.send(body);
};

before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  await applyMigrations(db);
  await applyMigrations(db); // migrations are safe to reapply
  app = createApp(db);
  const adminId = randomUUID();
  await db.query(
    "INSERT INTO users (id,username,password_hash) VALUES ($1,'organizer',$2)",
    [adminId, await hashPassword("9111111111")],
  );
  await db.query("INSERT INTO admins (user_id,password_hash) VALUES ($1,$2)", [
    adminId,
    await hashPassword(password),
  ]);
  const signup = await send("post", "/api/auth/signup", {
    username: "squad_lead",
    password: "participant password",
  }).expect(201);
  participantCookie = cookieOf(signup);
  participantId = signup.body.user.id;
  const reg = await send(
    "post",
    "/api/registrations",
    {
      teamName: "=Formula Squad",
      email: "lead@example.invalid",
      squadSize: 3,
      problemId: "HN-AI-01",
      conductAccepted: true,
    },
    participantCookie,
  ).expect(201);
  registrationId = reg.body.registration.id;
  assert.equal(reg.body.registration.status, "pending");
});
after(() => db.close());

test("admin routes reject anonymous and participant sessions", async () => {
  await send("get", "/api/admin/stats").expect(401);
  await send("get", "/api/admin/stats", undefined, participantCookie).expect(
    401,
  );
  const asAdminCookie = participantCookie.replace("hn_session", "hn_admin");
  await send("get", "/api/admin/stats", undefined, asAdminCookie).expect(401);
});

test("admin login needs the admin password, not the participant password", async () => {
  await send("post", "/api/admin/login", {
    username: "organizer",
    password: "9111111111",
  }).expect(401);
  await send("post", "/api/admin/login", {
    username: "squad_lead",
    password: "participant password",
  }).expect(401);
  await request(app)
    .post("/api/admin/login")
    .set("Origin", "https://evil.example")
    .send({ username: "organizer", password })
    .expect(403);
  const res = await send("post", "/api/admin/login", {
    username: "ORGANIZER",
    password,
  }).expect(200);
  adminCookie = cookieOf(res);
  assert.match(res.headers["set-cookie"][0], /HttpOnly/);
  assert.match(res.headers["set-cookie"][0], /Path=\/api\/admin/);
  const me = await send("get", "/api/admin/me", undefined, adminCookie).expect(
    200,
  );
  assert.equal(me.body.admin.username, "organizer");
  // An admin session is not a participant session.
  const asParticipant = adminCookie.replace("hn_admin", "hn_session");
  await send("get", "/api/auth/me", undefined, asParticipant).expect(401);
});

test("stats summarize registrations", async () => {
  const res = await send(
    "get",
    "/api/admin/stats",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(res.body.totals.registrations, 1);
  assert.equal(res.body.totals.participants, 3);
  assert.equal(res.body.totals.users, 1);
  assert.deepEqual(res.body.byDomain, [{ domain: "HN-AI", count: 1 }]);
  assert.deepEqual(res.body.byProblem, [{ problem_id: "HN-AI-01", count: 1 }]);
});

test("registrations can be searched, filtered, and paged", async () => {
  const all = await send(
    "get",
    "/api/admin/registrations",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(all.body.total, 1);
  assert.equal(all.body.registrations[0].username, "squad_lead");
  const search = await send(
    "get",
    "/api/admin/registrations?q=formula",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(search.body.total, 1);
  const literal = await send(
    "get",
    "/api/admin/registrations?q=%25",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(literal.body.total, 0);
  const other = await send(
    "get",
    "/api/admin/registrations?domain=HN-CS",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(other.body.total, 0);
  const bad = await send(
    "get",
    "/api/admin/registrations?sort=1;DROP&page=-4&limit=9999",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(bad.body.page, 1);
  assert.equal(bad.body.limit, 100);
});

test("status, notes, and check-in updates are validated, saved, and audited", async () => {
  const path = `/api/admin/registrations/${registrationId}`;
  await send("patch", path, { status: "vip" }, adminCookie).expect(400);
  await send("patch", path, {}, adminCookie).expect(400);
  await send("patch", path, { notes: "x".repeat(2001) }, adminCookie).expect(
    400,
  );
  await send(
    "patch",
    "/api/admin/registrations/not-a-uuid",
    { status: "approved" },
    adminCookie,
  ).expect(404);
  // A squad without a payment cannot be approved.
  const unpaid = await send(
    "patch",
    path,
    { status: "approved" },
    adminCookie,
  ).expect(409);
  assert.match(unpaid.body.error, /hasn’t submitted a payment/);
  const res = await send(
    "patch",
    path,
    { status: "waitlisted", notes: " Strong team ", checkedIn: true },
    adminCookie,
  ).expect(200);
  assert.equal(res.body.registration.status, "waitlisted");
  assert.equal(res.body.registration.admin_notes, "Strong team");
  assert.ok(res.body.registration.checked_in_at);
  const mine = await send(
    "get",
    "/api/registrations/me",
    undefined,
    participantCookie,
  ).expect(200);
  assert.equal(mine.body.registration.status, "waitlisted");
  assert.equal(mine.body.registration.admin_notes, undefined);
  const log = await send(
    "get",
    "/api/admin/audit",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(log.body.entries[0].action, "update_registration");
  assert.equal(log.body.entries[0].admin_username, "organizer");
});

test("CSV export neutralizes spreadsheet formulas", async () => {
  const res = await send(
    "get",
    "/api/admin/registrations.csv",
    undefined,
    adminCookie,
  ).expect(200);
  assert.match(res.headers["content-type"], /text\/csv/);
  assert.match(res.headers["content-disposition"], /attachment/);
  assert.match(res.text, /"'=Formula Squad"/);
  assert.match(res.headers["cache-control"], /no-store/);
});

test("users list, session revocation, and deletion", async () => {
  const users = await send(
    "get",
    "/api/admin/users",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(users.body.total, 2);
  const organizer = users.body.users.find((u) => u.username === "organizer");
  assert.equal(organizer.is_admin, true);
  await send(
    "delete",
    `/api/admin/users/${organizer.id}`,
    undefined,
    adminCookie,
  ).expect(400);
  await send(
    "post",
    `/api/admin/users/${participantId}/revoke-sessions`,
    {},
    adminCookie,
  ).expect(200);
  await send("get", "/api/auth/me", undefined, participantCookie).expect(401);
  await send("get", "/api/admin/me", undefined, adminCookie).expect(200);
  await send(
    "delete",
    `/api/admin/users/${participantId}`,
    undefined,
    adminCookie,
  ).expect(200);
  const count = await db.query("SELECT COUNT(*)::int AS n FROM registrations");
  assert.equal(count.rows[0].n, 0);
});

test("admin logout ends the admin session", async () => {
  await send("post", "/api/admin/logout", {}, adminCookie).expect(200);
  await send("get", "/api/admin/me", undefined, adminCookie).expect(401);
});
