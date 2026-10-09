import { test, before, after } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import request from "supertest";
import { createApp } from "../server/app.js";
import { hashPassword } from "../server/auth.js";
import { applyMigrations } from "../server/migrations.js";
import {
  parseScreenshot,
  normalizeTransactionId,
  upiUri,
} from "../server/payments.js";

let db, app, adminCookie, teamCookie, otherCookie, paymentId, passQr;
const sentMail = [];
const mailer = {
  async sendApprovalEmail(message) {
    sentMail.push({ kind: "approval", ...message });
  },
  async sendRejectionEmail(message) {
    sentMail.push({ kind: "rejection", ...message });
  },
  async sendRegistrationEmail(message) {
    sentMail.push({ kind: "registration", ...message });
  },
  async sendPaymentReceivedEmail(message) {
    sentMail.push({ kind: "payment", ...message });
  },
  async sendCertificatesEmail(message) {
    sentMail.push({ kind: "certificates", ...message });
  },
};
const mailOf = (kind) => sentMail.filter((m) => m.kind === kind);
// Some emails are sent after a database lookup that follows the response.
async function mailFor(kind, count) {
  for (let i = 0; i < 50 && mailOf(kind).length < count; i++)
    await new Promise((r) => setTimeout(r, 10));
  return mailOf(kind);
}
const squadMembers = [
  { fullName: "Pay Lead", phone: "9333333333", college: "CSE College" },
  {
    fullName: "  Second   Builder ",
    email: "Second@Example.invalid",
    phone: "+91 93333 33334",
    college: "CSE College",
  },
  {
    fullName: "Third Builder",
    email: "third@example.invalid",
    phone: "09333333335",
    college: "ECE College",
  },
];
const savedMembers = [
  {
    position: 1,
    fullName: "Pay Lead",
    email: "pay_lead@example.invalid",
    phone: "9333333333",
    college: "CSE College",
  },
  {
    position: 2,
    fullName: "Second Builder",
    email: "second@example.invalid",
    phone: "9333333334",
    college: "CSE College",
  },
  {
    position: 3,
    fullName: "Third Builder",
    email: "third@example.invalid",
    phone: "9333333335",
    college: "ECE College",
  },
];
const origin = "http://localhost:5173";
// Smallest valid PNG header plus padding.
const png = `data:image/png;base64,${Buffer.concat([
  Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  Buffer.alloc(64, 1),
]).toString("base64")}`;
const cookieOf = (res) => res.headers["set-cookie"][0].split(";")[0];
const send = (method, path, body, cookie) => {
  const r = request(app)[method](path).set("Origin", origin);
  if (cookie) r.set("Cookie", cookie);
  return body === undefined ? r : r.send(body);
};
async function squad(username, mobile, teamName, members) {
  const signup = await send("post", "/api/auth/signup", {
    username,
    password: `${username} password ${mobile}`,
  }).expect(201);
  const cookie = cookieOf(signup);
  await send(
    "post",
    "/api/registrations",
    {
      teamName,
      email: `${username}@example.invalid`,
      squadSize: 3,
      conductAccepted: true,
      members,
    },
    cookie,
  ).expect(201);
  return cookie;
}

before(async () => {
  db = new PGlite();
  await db.exec(
    await readFile(new URL("../server/schema.sql", import.meta.url), "utf8"),
  );
  await applyMigrations(db);
  app = createApp(db, { origin, mailer });
  const id = randomUUID();
  await db.query(
    "INSERT INTO users (id,username,password_hash) VALUES ($1,'lead_admin',$2)",
    [id, await hashPassword("unused-credential")],
  );
  await db.query("INSERT INTO admins (user_id,password_hash) VALUES ($1,$2)", [
    id,
    await hashPassword("lead admin password"),
  ]);
  adminCookie = cookieOf(
    await send("post", "/api/admin/login", {
      username: "lead_admin",
      password: "lead admin password",
    }).expect(200),
  );
  teamCookie = await squad(
    "pay_lead",
    "9333333333",
    "Paying Squad",
    squadMembers,
  );
  otherCookie = await squad("other_lead", "9444444444", "Other Squad");
});
after(() => db.close());

test("helpers validate screenshots, transaction IDs, and build a fixed-amount UPI link", () => {
  assert.equal(parseScreenshot(png).type, "image/png");
  // A script disguised as an image is refused by its bytes.
  const fake = `data:image/png;base64,${Buffer.from("<script>alert(1)</script>").toString("base64")}`;
  assert.equal(parseScreenshot(fake), null);
  assert.equal(parseScreenshot("not a data url"), null);
  assert.equal(normalizeTransactionId(" 5123 4567 8901 "), "512345678901");
  assert.equal(normalizeTransactionId("abc"), null);
  assert.equal(normalizeTransactionId("12345678'; DROP"), null);
  const uri = upiUri("abcdef12-0000-4000-8000-000000000000");
  assert.match(uri, /^upi:\/\/pay\?pa=7010826253-2%40ybl/);
  assert.match(uri, /am=1000\.00/);
  assert.match(uri, /tn=HACK_NEXUS%20HN-ABCDEF12/);
});

test("registering emails the squad lead a link to complete payment", () => {
  const registrations = mailOf("registration");
  assert.equal(registrations.length, 2);
  assert.deepEqual(registrations[0], {
    kind: "registration",
    to: "pay_lead@example.invalid",
    teamName: "Paying Squad",
    registrationId: registrations[0].registrationId,
    squadSize: 3,
    fee: 1000,
    // The lead's email always comes from the registration's lead email.
    members: savedMembers,
    paymentUrl: `${origin}/payment`,
  });
  assert.deepEqual(registrations[1].members, []);
  assert.match(registrations[0].registrationId, /^[0-9a-f-]{36}$/);
});

test("the payment page shows the fixed fee and no payment yet", async () => {
  await send("get", "/api/payments/me").expect(401);
  const res = await send(
    "get",
    "/api/payments/me",
    undefined,
    teamCookie,
  ).expect(200);
  assert.equal(res.body.fee, 1000);
  assert.equal(res.body.payment, null);
  assert.equal(res.body.registration.pass_code, undefined);
  assert.match(res.body.upi.uri, /am=1000\.00/);
});

test("member details are validated, returned, and editable by the lead", async () => {
  const mine = await send(
    "get",
    "/api/registrations/me",
    undefined,
    teamCookie,
  ).expect(200);
  assert.deepEqual(mine.body.registration.members, savedMembers);
  const put = (members, cookie = teamCookie) =>
    send("put", "/api/registrations/me/members", { members }, cookie);
  const bad = async (members, pattern) =>
    assert.match((await put(members).expect(400)).body.error, pattern);
  await bad(squadMembers.slice(0, 2), /all 3 squad members/);
  await bad(
    squadMembers.map((m, i) => (i === 2 ? { ...m, phone: "12345" } : m)),
    /^Member 3: .*mobile/,
  );
  await bad(
    squadMembers.map((m, i) => (i === 1 ? { ...m, email: "nope" } : m)),
    /^Member 2: .*email/,
  );
  await bad(
    squadMembers.map((m, i) => (i === 0 ? { ...m, fullName: "" } : m)),
    /^Squad lead: .*name/,
  );
  await bad(
    squadMembers.map((m, i) =>
      i === 2 ? { ...m, email: "second@example.invalid" } : m,
    ),
    /different email/,
  );
  // The lead's email cannot be changed through member details.
  const edited = await put(
    squadMembers.map((m, i) =>
      i === 0
        ? { ...m, email: "someone@else.invalid", college: "New College" }
        : m,
    ),
  ).expect(200);
  assert.equal(edited.body.members[0].email, "pay_lead@example.invalid");
  assert.equal(edited.body.members[0].college, "New College");
  await put(squadMembers).expect(200);
  // A squad registered without members can add them later.
  const others = squadMembers.map((m, i) => ({
    ...m,
    email: `other${i}@example.invalid`,
    phone: `944444444${i}`,
  }));
  const added = await put(others, otherCookie).expect(200);
  assert.equal(added.body.members.length, 3);
  assert.equal(added.body.members[0].email, "other_lead@example.invalid");
  // Registration rejects incomplete member lists up front.
  const signup = await send("post", "/api/auth/signup", {
    username: "member_check",
    password: "squad lead password",
  }).expect(201);
  const res = await send(
    "post",
    "/api/registrations",
    {
      teamName: "Member Check",
      email: "member_check@example.invalid",
      squadSize: 3,
      conductAccepted: true,
      members: squadMembers.slice(0, 1),
    },
    cookieOf(signup),
  ).expect(400);
  assert.match(res.body.error, /all 3 squad members/);
  await send("get", "/api/registrations/me", undefined, cookieOf(signup))
    .expect(200)
    .then((r) => assert.equal(r.body.registration, null));
});

test("payment submission is validated and cannot be duplicated", async () => {
  await send(
    "post",
    "/api/payments",
    { transactionId: "x", screenshot: png },
    teamCookie,
  ).expect(400);
  await send(
    "post",
    "/api/payments",
    { transactionId: "512345678901", screenshot: "nope" },
    teamCookie,
  ).expect(400);
  const ok = await send(
    "post",
    "/api/payments",
    { transactionId: "5123 4567 8901", screenshot: png, amount: 1 },
    teamCookie,
  ).expect(201);
  assert.equal(ok.body.payment.status, "submitted");
  assert.equal(ok.body.payment.amount, 1000); // the client cannot choose the amount
  // Submitting payment completes registration and emails the lead.
  const [received] = await mailFor("payment", 1);
  assert.deepEqual(received, {
    kind: "payment",
    to: "pay_lead@example.invalid",
    teamName: "Paying Squad",
    registrationId: received.registrationId,
    squadSize: 3,
    transactionId: "512345678901",
    amount: 1000,
    members: savedMembers,
    statusUrl: `${origin}/payment`,
  });
  await send(
    "post",
    "/api/payments",
    { transactionId: "999988887777", screenshot: png },
    teamCookie,
  ).expect(409);
  // Another squad cannot reuse the same transaction ID.
  await send(
    "post",
    "/api/payments",
    { transactionId: "512345678901", screenshot: png },
    otherCookie,
  ).expect(409);
  await send("get", "/api/pass/me", undefined, teamCookie).expect(404);
  const mine = await send(
    "get",
    "/api/registrations/me",
    undefined,
    teamCookie,
  ).expect(200);
  assert.equal(mine.body.registration.payment_status, "submitted");
});

test("large screenshots are accepted up to the limit only on the payment route", async () => {
  const big = `data:image/png;base64,${Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    Buffer.alloc(6 * 1024 * 1024),
  ]).toString("base64")}`;
  await send(
    "post",
    "/api/payments",
    { transactionId: "111122223333", screenshot: big },
    otherCookie,
  ).expect(413);
  await send(
    "post",
    "/api/registrations",
    { teamName: "x".repeat(20000) },
    otherCookie,
  ).expect(413);
});

test("admins review payments with the screenshot, then verify to issue the pass", async () => {
  const list = await send(
    "get",
    "/api/admin/payments?status=submitted",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(list.body.total, 1);
  paymentId = list.body.payments[0].id;
  assert.equal(list.body.payments[0].transaction_id, "512345678901");
  assert.match(list.body.payments[0].reference, /^HN-/);
  const shot = await send(
    "get",
    `/api/admin/payments/${paymentId}/screenshot`,
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(shot.headers["content-type"], "image/png");
  assert.match(shot.headers["content-security-policy"], /sandbox/);
  await send(
    "get",
    `/api/admin/payments/${paymentId}/screenshot`,
    undefined,
    teamCookie,
  ).expect(401);
  await send(
    "post",
    `/api/admin/payments/${paymentId}/reject`,
    { reason: "" },
    adminCookie,
  ).expect(400);
  await send(
    "post",
    `/api/admin/payments/${paymentId}/verify`,
    {},
    adminCookie,
  ).expect(200);
  await send(
    "post",
    `/api/admin/payments/${paymentId}/verify`,
    {},
    adminCookie,
  ).expect(409);
  // Verifying emails the squad lead exactly once, linking to the ID card.
  const approvals = await mailFor("approval", 1);
  assert.equal(approvals.length, 1);
  assert.deepEqual(approvals[0], {
    kind: "approval",
    to: "pay_lead@example.invalid",
    teamName: "Paying Squad",
    registrationId: approvals[0].registrationId,
    squadSize: 3,
    transactionId: "512345678901",
    amount: 1000,
    members: savedMembers,
    passUrl: `${origin}/pass`,
  });
  assert.match(approvals[0].registrationId, /^[0-9a-f-]{36}$/);
  // Admins see member details in the squad dialog and CSV export.
  const detail = await send(
    "get",
    `/api/admin/registrations/${approvals[0].registrationId}`,
    undefined,
    adminCookie,
  ).expect(200);
  assert.deepEqual(detail.body.registration.members, savedMembers);
  const csv = await send(
    "get",
    "/api/admin/registrations.csv",
    undefined,
    adminCookie,
  ).expect(200);
  assert.match(csv.text, /,squad_size,members,/);
  assert.match(
    csv.text,
    /"Pay Lead \| pay_lead@example\.invalid \| 9333333333 \| CSE College; Second Builder/,
  );
  const pass = await send("get", "/api/pass/me", undefined, teamCookie).expect(
    200,
  );
  assert.equal(pass.body.pass.team_name, "Paying Squad");
  assert.equal(pass.body.pass.status, "approved");
  // Short, unambiguous check-in code: no 0/O or 1/I/L.
  assert.match(pass.body.pass.qr, /^HACKNEXUS:[A-HJKMNP-Z2-9]{8}$/);
  assert.match(pass.body.pass.reference, /^HN-[A-F0-9]{8}$/);
  // One card per member; contact details are not sent for the card.
  assert.deepEqual(
    pass.body.pass.members,
    savedMembers.map((m) => ({
      position: m.position,
      participantId: `${pass.body.pass.reference}-0${m.position}`,
      fullName: m.fullName,
      college: m.college,
    })),
  );
  passQr = pass.body.pass.qr;
});

test("scanning the ID card QR checks the squad in once", async () => {
  await send(
    "post",
    "/api/admin/attendance/scan",
    { code: "hello" },
    adminCookie,
  ).expect(400);
  await send(
    "post",
    "/api/admin/attendance/scan",
    { code: `HACKNEXUS:${"0".repeat(32)}` },
    adminCookie,
  ).expect(404);
  const first = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: passQr },
    adminCookie,
  ).expect(200);
  assert.equal(first.body.result, "checked_in");
  assert.equal(first.body.squad.team_name, "Paying Squad");
  assert.equal(first.body.squad.checked_in_by, "lead_admin");
  const again = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: passQr },
    adminCookie,
  ).expect(200);
  assert.equal(again.body.result, "already");
  // The grouped code printed on the card can be typed instead of scanned.
  // Typed as printed on the card, in any case, with or without the hyphen.
  const code = passQr.split(":")[1];
  const typed = ` ${code.slice(0, 4).toLowerCase()}-${code.slice(4)} `;
  const manual = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: typed },
    adminCookie,
  ).expect(200);
  assert.equal(manual.body.squad.team_name, "Paying Squad");
  const attendance = await send(
    "get",
    "/api/admin/attendance",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(attendance.body.totals.checked_in, 1);
  assert.equal(attendance.body.totals.people, 3);
});

test("the food counter gives each meal once per squad", async () => {
  await send("post", "/api/admin/meals/scan", { code: passQr, meal: "pizza" }, adminCookie).expect(400);
  const first = await send("post", "/api/admin/meals/scan", { code: passQr, meal: "d1_lunch" }, adminCookie).expect(200);
  assert.equal(first.body.result, "given");
  assert.equal(first.body.squad.team_name, "Paying Squad");
  assert.equal(first.body.handout.people, 3);
  assert.equal(first.body.handout.given_by, "lead_admin");
  const again = await send("post", "/api/admin/meals/scan", { code: passQr, meal: "d1_lunch" }, adminCookie).expect(200);
  assert.equal(again.body.result, "already");
  assert.equal(again.body.handout.given_by, "lead_admin");
  // Check-in volunteers can run the food counter too; another meal is separate.
  // (Few requests here: the whole file shares the API's 100-a-minute limit.)
  await send("post", "/api/admin/admins", { username: "food_1", password: "food counter pass", role: "scanner" }, adminCookie).expect(201);
  const counter = cookieOf(
    await send("post", "/api/admin/login", { username: "food_1", password: "food counter pass" }).expect(200),
  );
  const third = await send("post", "/api/admin/meals/scan", { code: passQr, meal: "d1_evening_snacks" }, counter).expect(200);
  assert.equal(third.body.result, "given");
  const summary = await send("get", "/api/admin/meals", undefined, counter).expect(200);
  const lunch = summary.body.meals.find((m) => m.id === "d1_lunch");
  assert.deepEqual([lunch.squads, lunch.people], [1, 3]);
  assert.equal(summary.body.recent[0].label, "Day 1 · Evening snacks");
  assert.ok(summary.body.expected.squads >= 1);
  // The full list: every squad to feed, with the meals it has collected.
  const squad = summary.body.teams.find((t) => t.team_name === "Paying Squad");
  assert.equal(squad.expected, true);
  assert.deepEqual(Object.keys(squad.meals).sort(), ["d1_evening_snacks", "d1_lunch"]);
  assert.equal(squad.meals.d1_lunch.given_by, "lead_admin");
  assert.equal(squad.meals.d1_morning_snacks, undefined);
  assert.equal(summary.body.teams.filter((t) => t.expected).length, summary.body.expected.squads);
});

test("admins can add check-in volunteers who can only scan", async () => {
  await send(
    "post",
    "/api/admin/admins",
    { username: "door_1", password: "short", role: "scanner" },
    adminCookie,
  ).expect(400);
  await send(
    "post",
    "/api/admin/admins",
    { username: "door_1", password: "door volunteer pass", role: "owner" },
    adminCookie,
  ).expect(400);
  await send(
    "post",
    "/api/admin/admins",
    { username: "door_1", password: "door volunteer pass", role: "scanner" },
    adminCookie,
  ).expect(201);
  await send(
    "post",
    "/api/admin/admins",
    { username: "door_1", password: "door volunteer pass", role: "admin" },
    adminCookie,
  ).expect(409);
  const scanner = cookieOf(
    await send("post", "/api/admin/login", {
      username: "door_1",
      password: "door volunteer pass",
    }).expect(200),
  );
  const me = await send("get", "/api/admin/me", undefined, scanner).expect(200);
  assert.equal(me.body.admin.role, "scanner");
  const scan = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: passQr },
    scanner,
  ).expect(200);
  assert.equal(scan.body.result, "already");
  await send("get", "/api/admin/attendance", undefined, scanner).expect(200);
  for (const path of [
    "/api/admin/stats",
    "/api/admin/payments",
    "/api/admin/registrations",
    "/api/admin/admins",
  ])
    await send("get", path, undefined, scanner).expect(403);
  await send(
    "post",
    "/api/admin/admins",
    { username: "sneaky", password: "sneaky volunteer", role: "admin" },
    scanner,
  ).expect(403);
  const admins = await send(
    "get",
    "/api/admin/admins",
    undefined,
    adminCookie,
  ).expect(200);
  const door = admins.body.admins.find((a) => a.username === "door_1");
  assert.equal(door.created_by, "lead_admin");
  const self = admins.body.admins.find((a) => a.username === "lead_admin");
  await send(
    "delete",
    `/api/admin/admins/${self.id}`,
    undefined,
    adminCookie,
  ).expect(400);
  await send(
    "delete",
    `/api/admin/admins/${door.id}`,
    undefined,
    adminCookie,
  ).expect(200);
  await send("get", "/api/admin/me", undefined, scanner).expect(401);
});

test("rejecting revokes the pass and lets the squad resubmit", async () => {
  await send(
    "post",
    `/api/admin/payments/${paymentId}/reject`,
    { reason: "Amount not received" },
    adminCookie,
  ).expect(200);
  // The lead is told why, with a link to resubmit.
  const rejection = sentMail.at(-1);
  assert.equal(rejection.kind, "rejection");
  assert.equal(rejection.to, "pay_lead@example.invalid");
  assert.equal(rejection.reason, "Amount not received");
  assert.equal(rejection.transactionId, "512345678901");
  assert.equal(rejection.amount, 1000);
  assert.equal(rejection.paymentUrl, `${origin}/payment`);
  await send("get", "/api/pass/me", undefined, teamCookie).expect(404);
  await send(
    "post",
    "/api/admin/attendance/scan",
    { code: passQr },
    adminCookie,
  ).expect(404);
  const me = await send(
    "get",
    "/api/payments/me",
    undefined,
    teamCookie,
  ).expect(200);
  assert.equal(me.body.payment.status, "rejected");
  assert.equal(me.body.payment.rejection_reason, "Amount not received");
  assert.equal(me.body.registration.status, "pending");
  const again = await send(
    "post",
    "/api/payments",
    { transactionId: "600011112222", screenshot: png },
    teamCookie,
  ).expect(201);
  assert.equal(again.body.payment.status, "submitted");
  const stats = await send(
    "get",
    "/api/admin/stats",
    undefined,
    adminCookie,
  ).expect(200);
  assert.equal(stats.body.payments.submitted, 1);
  assert.equal(stats.body.payments.unpaid, 1);
  const log = await send(
    "get",
    "/api/admin/audit",
    undefined,
    adminCookie,
  ).expect(200);
  const actions = log.body.entries.map((e) => e.action);
  for (const action of [
    "verify_payment",
    "reject_payment",
    "check_in",
    "add_admin",
    "remove_admin",
  ])
    assert.ok(actions.includes(action), action);
});

test("registration errors name the field that needs fixing", async () => {
  const signup = await send("post", "/api/auth/signup", {
    username: "field_errors",
    password: "squad lead password",
  }).expect(201);
  const cookie = cookieOf(signup);
  const base = {
    teamName: "Clear Errors",
    email: "lead@college.edu",
    squadSize: 3,
    conductAccepted: true,
  };
  const cases = [
    [{ email: "lead@college" }, /complete lead email/],
    [{ teamName: " AB " }, /3–30 characters/],
    [{ squadSize: 5 }, /2 or 3 builders/],
    [{ squadSize: 1 }, /2 or 3 builders/],
    [{ squadSize: 4 }, /2 or 3 builders/],
    [{ conductAccepted: false }, /Code of Conduct/],
  ];
  for (const [change, message] of cases) {
    const res = await send(
      "post",
      "/api/registrations",
      { ...base, ...change },
      cookie,
    ).expect(400);
    assert.match(res.body.error, message);
  }
  // Surrounding spaces in the email are trimmed rather than rejected.
  const ok = await send(
    "post",
    "/api/registrations",
    { ...base, email: "  Lead@College.edu " },
    cookie,
  ).expect(201);
  assert.equal(ok.body.registration.lead_email, "lead@college.edu");
});

test("approving from the registration dialog verifies the payment and issues the ID card", async () => {
  const cookie = await squad("dialog_lead", "9666666666", "Dialog Squad");
  await send(
    "post",
    "/api/payments",
    { transactionId: "700011112222", screenshot: png },
    cookie,
  ).expect(201);
  const reg = (
    await send("get", "/api/registrations/me", undefined, cookie).expect(200)
  ).body.registration;
  await send("get", "/api/pass/me", undefined, cookie).expect(404);
  await send(
    "patch",
    `/api/admin/registrations/${reg.id}`,
    { status: "approved" },
    adminCookie,
  ).expect(200);
  const payment = await send(
    "get",
    "/api/payments/me",
    undefined,
    cookie,
  ).expect(200);
  assert.equal(payment.body.payment.status, "verified");
  const pass = await send("get", "/api/pass/me", undefined, cookie).expect(200);
  assert.match(pass.body.pass.qr, /^HACKNEXUS:/);
  // Moving the squad out of "approved" hides the card and blocks check-in.
  await send(
    "patch",
    `/api/admin/registrations/${reg.id}`,
    { status: "waitlisted" },
    adminCookie,
  ).expect(200);
  await send("get", "/api/pass/me", undefined, cookie).expect(404);
  const scan = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: pass.body.pass.qr },
    adminCookie,
  ).expect(409);
  assert.match(scan.body.error, /waitlisted/);
});

test("ID cards issued before short codes still check in", async () => {
  const cookie = await squad("legacy_card", "9777777777", "Legacy Card Squad");
  const { rows } = await db.query(
    "SELECT r.id FROM registrations r JOIN users u ON u.id=r.user_id WHERE u.username='legacy_card'",
  );
  const legacy = "0123456789abcdef0123456789abcdef";
  await db.query(
    "UPDATE registrations SET status='approved',pass_code=$2 WHERE id=$1",
    [rows[0].id, legacy],
  );
  await db.query(
    "INSERT INTO payments (id,registration_id,amount,transaction_id,screenshot,screenshot_type,status) VALUES ($1,$2,1000,'LEGACYTXN0001',$3,'image/png','verified')",
    [randomUUID(), rows[0].id, Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])],
  );
  const pass = await send("get", "/api/pass/me", undefined, cookie).expect(200);
  assert.equal(pass.body.pass.qr, `HACKNEXUS:${legacy}`);
  const scanned = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: `HACKNEXUS:${legacy}` },
    adminCookie,
  ).expect(200);
  assert.equal(scanned.body.result, "checked_in");
  const typed = await send(
    "post",
    "/api/admin/attendance/scan",
    { code: legacy.toUpperCase().match(/.{4}/g).join(" ") },
    adminCookie,
  ).expect(200);
  assert.equal(typed.body.result, "already");
});

test("the scanners are not held back by the shared per-IP limit", async () => {
  // The rest of the API allows 100 requests a minute per IP; the check-in
  // and food counters have their own, higher limits.
  for (let i = 0; i < 110; i++)
    await send("get", "/api/admin/meals", undefined, adminCookie).expect(200);
  // (This squad's card was revoked by an earlier test: refused, but not rate-limited.)
  const scan = await send("post", "/api/admin/attendance/scan", { code: passQr }, adminCookie);
  assert.notEqual(scan.status, 429);
  // Other routes still share the per-IP limit, which these 110 didn't use up.
  await send("get", "/api/admin/stats", undefined, adminCookie).expect(200);
});

test("participation certificates for checked-in squads: Mr/Ms, PDF download and email to the lead", async () => {
  const { PDFDocument } = await import("pdf-lib");
  const list = await send("get", "/api/admin/certificates", undefined, adminCookie).expect(200);
  const squad = list.body.squads.find((s) => s.team_name === "Paying Squad");
  assert.ok(squad, "the checked-in squad is listed");
  assert.equal(list.body.totals.missingTitles, list.body.totals.people);
  // Emailing waits until every member has Mr or Ms.
  await send("post", "/api/admin/certificates/email", {}, adminCookie).expect(409);
  await send("put", "/api/admin/certificates/title", { registrationId: squad.id, position: 1, title: "Dr" }, adminCookie).expect(400);
  for (const s of list.body.squads)
    for (const m of s.members)
      await send("put", "/api/admin/certificates/title", { registrationId: s.id, position: m.position, title: m.position === 1 ? "Mr" : "Ms" }, adminCookie).expect(200);
  const pdf = await send("get", "/api/admin/certificates.pdf", undefined, adminCookie).expect(200).buffer(true).parse((res, cb) => {
    const chunks = [];
    res.on("data", (c) => chunks.push(c));
    res.on("end", () => cb(null, Buffer.concat(chunks)));
  });
  assert.equal(pdf.headers["content-type"], "application/pdf");
  assert.equal((await PDFDocument.load(pdf.body)).getPageCount(), list.body.totals.people);
  await send("post", "/api/admin/certificates/email", {}, adminCookie).expect(202);
  const mails = await mailFor("certificates", list.body.totals.squads);
  const mail = mails.find((m) => m.teamName === "Paying Squad");
  assert.equal(mail.to, squad.lead_email);
  assert.equal(mail.members[0], `Mr. ${squad.members[0].full_name}`);
  assert.equal(mail.attachments.length, squad.members.length);
  const after = await send("get", "/api/admin/certificates", undefined, adminCookie).expect(200);
  assert.equal(after.body.totals.emailed, after.body.totals.squads);
});
