// Unit tests for utils/validation.js. Run: npm test (node's built-in runner).
const test = require("node:test");
const assert = require("node:assert/strict");
const { validateRegistration, checkTeamSizes, computeTotal, isPhone, isUpiTxn, parseJsonField } = require("../utils/validation");

const valid = {
  name: "Arun Kumar",
  email: "  Arun@Example.com ",
  phone: "98765 43210",
  password: "Str0ngPass!",
  eventIds: JSON.stringify(["e1"]),
  transactionId: " 4265 1234 5678 ",
  consent: "true",
};

test("valid registration is accepted and normalised", () => {
  const { errors, value } = validateRegistration(valid);
  assert.deepEqual(errors, []);
  assert.equal(value.email, "arun@example.com");
  assert.equal(value.transactionId, "426512345678");
  assert.equal(value.phone, "9876543210");
  assert.deepEqual(value.eventIds, ["e1"]);
});

test("consent is required", () => {
  const { errors } = validateRegistration({ ...valid, consent: "false" });
  assert.ok(errors.some((e) => /Terms/.test(e)));
});

test("rejects bad email, short password, bad UTR, no events", () => {
  const { errors } = validateRegistration({ ...valid, email: "nope", password: "short", transactionId: "12-34", eventIds: "[]" });
  assert.equal(errors.length, 4);
});

test("rejects duplicate and oversized event lists", () => {
  assert.ok(validateRegistration({ ...valid, eventIds: JSON.stringify(["a", "a"]) }).errors.length);
  assert.ok(validateRegistration({ ...valid, eventIds: JSON.stringify(Array.from({ length: 21 }, (_, i) => `e${i}`)) }).errors.length);
});

test("malformed JSON fields raise a 400", () => {
  assert.throws(() => parseJsonField("{oops", []), (err) => err.status === 400);
});

test("team members are capped and trimmed", () => {
  const many = JSON.stringify(Array.from({ length: 11 }, () => ({ name: "A B" })));
  assert.ok(validateRegistration({ ...valid, teamMembers: many }).errors.length);
  const { value } = validateRegistration({ ...valid, teamMembers: JSON.stringify([{ name: " Lead ", role: "lead" }, { name: "Mem", role: "admin" }]) });
  assert.deepEqual(value.teamMembers.map((m) => [m.name, m.role]), [["Lead", "lead"], ["Mem", "member"]]);
});

test("Indian mobile numbers", () => {
  for (const ok of ["9876543210", "+91 98765 43210", "91-98765-43210", "6123456789"]) assert.ok(isPhone(ok), ok);
  for (const bad of ["12345", "5876543210", "98765432101", "abcdefghij"]) assert.ok(!isPhone(bad), bad);
});

test("UPI transaction IDs", () => {
  assert.ok(isUpiTxn("426512345678"));
  assert.ok(isUpiTxn("T2409261234567890ABC"));
  assert.ok(!isUpiTxn("12345"));
  assert.ok(!isUpiTxn("4265-1234-5678"));
});

test("team sizes apply only to team events", () => {
  const events = [
    { name: "Hack Nexus", isTeamEvent: true, minTeamSize: 2, maxTeamSize: 4 },
    { name: "Code Rescue", isTeamEvent: false, minTeamSize: 1, maxTeamSize: 1 },
  ];
  assert.equal(checkTeamSizes(events, 3), null);
  assert.match(checkTeamSizes(events, 1), /Hack Nexus/);
  assert.match(checkTeamSizes(events, 5), /2–4/);
  assert.equal(checkTeamSizes([events[1]], 1), null);
});

test("total uses combo prices and never double-counts", () => {
  const events = [
    { id: "a", fee: 100 },
    { id: "b", fee: 120 },
    { id: "c", fee: 50 },
  ];
  assert.equal(computeTotal(events, []), 270);
  assert.equal(computeTotal(events, [{ name: "Duo", eventIds: ["a", "b"], comboPrice: 180 }]), 230);
  assert.throws(() => computeTotal(events, [{ name: "Ghost", eventIds: ["a", "z"], comboPrice: 10 }]), /Ghost/);
  assert.throws(() => computeTotal(events, [
    { name: "X", eventIds: ["a"], comboPrice: 1 },
    { name: "Y", eventIds: ["a"], comboPrice: 1 },
  ]));
});
