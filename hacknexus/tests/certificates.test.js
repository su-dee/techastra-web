// Hack Nexus participation certificates: Mr/Ms, the PDF download, emails to
// squad leads, release to squad dashboards, and winners left out. Its own
// file (and app) so it doesn't share payments.test.js's 100-a-minute limit.
import { test, before } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { PDFDocument } from "pdf-lib";
import request from "supertest";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";
import { applyMigrations } from "../server/migrations.js";

const origin = "http://localhost:5173";
const sent = [];
const mailer = {
  async sendRegistrationEmail() {},
  async sendCertificatesEmail(message) {
    sent.push(message);
  },
};
let db, app, adminCookie, leadCookie, squadId, otherId;
const cookieOf = (res) => res.headers["set-cookie"][0].split(";")[0];
const send = (method, path, body, cookie) => {
  const r = request(app)[method](path).set("Origin", origin);
  if (cookie) r.set("Cookie", cookie);
  return body === undefined ? r : r.send(body);
};
const pdfPages = async (r) => {
  const res = await r.buffer(true).parse((stream, cb) => {
    const chunks = [];
    stream.on("data", (c) => chunks.push(c));
    stream.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(res.status, 200);
  assert.equal(res.headers["content-type"], "application/pdf");
  return (await PDFDocument.load(res.body)).getPageCount();
};
async function waitForMail(count) {
  for (let i = 0; i < 100 && sent.length < count; i++) await new Promise((r) => setTimeout(r, 10));
}
// A registered squad, checked in.
async function checkedInSquad(username, teamName, members) {
  const cookie = cookieOf(
    await send("post", "/api/auth/signup", { username, password: `${username} password 2026` }).expect(201),
  );
  await send(
    "post",
    "/api/registrations",
    { teamName, email: `${username}@example.invalid`, squadSize: members.length, conductAccepted: true, members },
    cookie,
  ).expect(201);
  const id = (await db.query("SELECT id FROM registrations WHERE team_name=$1", [teamName])).rows[0].id;
  await db.query("UPDATE registrations SET status='approved', checked_in_at=NOW() WHERE id=$1", [id]);
  return { cookie, id };
}

before(async () => {
  db = new PGlite();
  await db.exec(await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"));
  await applyMigrations(db);
  app = createApp(db, { origin, mailer });
  const id = randomUUID();
  await db.query("INSERT INTO users (id,username,password_hash) VALUES ($1,'cert_admin',$2)", [id, await hashPassword("unused")]);
  await db.query("INSERT INTO admins (user_id,password_hash) VALUES ($1,$2)", [id, await hashPassword("cert admin password")]);
  adminCookie = cookieOf(
    await send("post", "/api/admin/login", { username: "cert_admin", password: "cert admin password" }).expect(200),
  );
  const lead = await checkedInSquad("cert_lead", "Cert Squad", [
    { fullName: "Cert Lead", phone: "9444444441", college: "CSE College" },
    { fullName: "Cert Second", email: "second@example.invalid", phone: "9444444442", college: "ECE College" },
  ]);
  leadCookie = lead.cookie;
  squadId = lead.id;
  otherId = (
    await checkedInSquad("win_lead", "Winning Squad", [
      { fullName: "Win Lead", phone: "9444444443", college: "IT College" },
      { fullName: "Win Second", email: "win2@example.invalid", phone: "9444444444", college: "IT College" },
    ])
  ).id;
});

test("certificates need Mr/Ms, download as one PDF and email each squad lead", async () => {
  const list = await send("get", "/api/admin/certificates", undefined, adminCookie).expect(200);
  assert.deepEqual([list.body.totals.squads, list.body.totals.people, list.body.totals.missingTitles], [2, 4, 4]);
  await send("post", "/api/admin/certificates/email", {}, adminCookie).expect(409);
  await send("put", "/api/admin/certificates/release", { released: true }, adminCookie).expect(409);
  await send("put", "/api/admin/certificates/title", { registrationId: squadId, position: 1, title: "Dr" }, adminCookie).expect(400);
  await send("put", "/api/admin/certificates/title", { registrationId: squadId, position: 1, title: "Mr" }, adminCookie).expect(200);
  await db.query("UPDATE registration_members SET title='Ms' WHERE title=''");

  assert.equal(await pdfPages(send("get", "/api/admin/certificates.pdf", undefined, adminCookie)), 4);
  await send("post", "/api/admin/certificates/email", {}, adminCookie).expect(202);
  await waitForMail(2);
  const mail = sent.find((m) => m.teamName === "Cert Squad");
  assert.equal(mail.to, "cert_lead@example.invalid");
  assert.deepEqual(mail.members, ["Mr. Cert Lead", "Ms. Cert Second"]);
  assert.equal(mail.attachments.length, 2);
  const after = await send("get", "/api/admin/certificates", undefined, adminCookie).expect(200);
  assert.equal(after.body.totals.emailed, 2);
  // Emailing again skips squads already emailed.
  await send("post", "/api/admin/certificates/email", {}, adminCookie).expect(202);
  await new Promise((r) => setTimeout(r, 50));
  assert.equal(sent.length, 2);
});

test("squads see their certificates on the dashboard only once released", async () => {
  const hidden = await send("get", "/api/registrations/me", undefined, leadCookie).expect(200);
  assert.equal(hidden.body.registration.certificates, null);
  await send("get", "/api/registrations/me/certificates/all", undefined, leadCookie).expect(404);

  await send("put", "/api/admin/certificates/release", { released: true }, adminCookie).expect(200);
  const shown = await send("get", "/api/registrations/me", undefined, leadCookie).expect(200);
  assert.deepEqual(shown.body.registration.certificates.map((c) => c.name), ["Cert Lead", "Cert Second"]);
  assert.equal(await pdfPages(send("get", "/api/registrations/me/certificates/2", undefined, leadCookie)), 1);
  assert.equal(await pdfPages(send("get", "/api/registrations/me/certificates/all", undefined, leadCookie)), 2);
  await send("get", "/api/registrations/me/certificates/9", undefined, leadCookie).expect(404);

  await send("put", "/api/admin/certificates/release", { released: false }, adminCookie).expect(200);
  const again = await send("get", "/api/registrations/me", undefined, leadCookie).expect(200);
  assert.equal(again.body.registration.certificates, null);
});

test("the 1st-3rd place squads get no participation certificate", async () => {
  await send("put", "/api/admin/certificates/winner", { registrationId: squadId, place: 4 }, adminCookie).expect(400);
  await send("put", "/api/admin/certificates/winner", { registrationId: otherId, place: 1 }, adminCookie).expect(200);
  // A place belongs to one squad: giving 1st to Cert Squad takes it from Winning Squad.
  await send("put", "/api/admin/certificates/winner", { registrationId: squadId, place: 1 }, adminCookie).expect(200);
  const list = await send("get", "/api/admin/certificates", undefined, adminCookie).expect(200);
  assert.equal(list.body.squads.find((s) => s.id === otherId).winner_position, null);
  assert.deepEqual([list.body.totals.winners, list.body.totals.people], [1, 2]);

  // Not in the download, not emailed, not on the winner's dashboard.
  assert.equal(await pdfPages(send("get", "/api/admin/certificates.pdf", undefined, adminCookie)), 2);
  const before = sent.length;
  await send("post", "/api/admin/certificates/email", { resend: true }, adminCookie).expect(202);
  await waitForMail(before + 1);
  assert.deepEqual(sent.slice(before).map((m) => m.teamName), ["Winning Squad"]);
  await send("put", "/api/admin/certificates/release", { released: true }, adminCookie).expect(200);
  const me = await send("get", "/api/registrations/me", undefined, leadCookie).expect(200);
  assert.equal(me.body.registration.certificates, null);
  await send("get", "/api/registrations/me/certificates/all", undefined, leadCookie).expect(404);

  // Clearing the place gives it back.
  await send("put", "/api/admin/certificates/winner", { registrationId: squadId, place: null }, adminCookie).expect(200);
  const back = await send("get", "/api/registrations/me", undefined, leadCookie).expect(200);
  assert.equal(back.body.registration.certificates.length, 2);
});
