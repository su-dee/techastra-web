// Unit tests for utils/validation.js. Run: npm test (node's built-in runner).
const test = require("node:test");
const assert = require("node:assert/strict");
const {
  validateRegistration,
  checkTeamSizes,
  checkComboRules,
  checkParticipation,
  checkRegistrationOpen,
  registrationTeamSize,
  seatsNeeded,
  computeTotal,
  isPhone,
  isUpiTxn,
  parseJsonField,
} = require("../utils/validation");

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

test("UTR may be left out (free Junior registrations); the route requires it when there's a fee", () => {
  const { errors, value } = validateRegistration({ ...valid, transactionId: "" });
  assert.deepEqual(errors, []);
  assert.equal(value.transactionId, "");
});

test("free events cost nothing; combos and paid events add up", () => {
  const junior = [{ id: "j1", fee: 0 }, { id: "j2", fee: 0 }];
  assert.equal(computeTotal(junior, []), 0);
  const senior = [{ id: "a", fee: 200 }, { id: "b", fee: 200 }, { id: "c", fee: 100 }, { id: "d", fee: 1000 }];
  assert.equal(computeTotal(senior, [{ name: "Combo 1", eventIds: ["a", "b", "c"], comboPrice: 200 }]), 1200);
});

test("combo passes: the team may be as large as the combo's biggest team event", () => {
  const hf = { id: "hf", name: "Hidden Frames", isTeamEvent: true, minTeamSize: 2, maxTeamSize: 2 };
  const tf = { id: "tf", name: "Team Feud", isTeamEvent: true, minTeamSize: 3, maxTeamSize: 3 };
  const pa = { id: "pa", name: "Prompt Arena", isTeamEvent: false, minTeamSize: 1, maxTeamSize: 1 };
  const combo1 = { eventIds: ["hf", "tf", "pa"] };
  assert.equal(checkTeamSizes([hf, tf, pa], 3, [combo1]), null); // 2 of the 3 play Hidden Frames
  assert.match(checkTeamSizes([hf, tf, pa], 2, [combo1]), /Team Feud/); // too few for Team Feud
  assert.match(checkTeamSizes([hf, tf, pa], 4, [combo1]), /combo/); // bigger than any event
  // Booked on their own (no combo), the exact sizes still apply.
  assert.match(checkTeamSizes([hf, tf], 3, []), /Hidden Frames/);
});

test("junior team events accept individual registration (teams form at the venue)", () => {
  const mindMerge = { id: "mm", name: "Mind Merge", level: "junior", isTeamEvent: true, minTeamSize: 3, maxTeamSize: 3 };
  const traceX = { id: "tx", name: "TRACE//X", level: "junior", isTeamEvent: true, minTeamSize: 4, maxTeamSize: 4 };
  const combo3 = { eventIds: ["mm", "tx"] };
  assert.equal(checkTeamSizes([mindMerge, traceX], 1, [combo3]), null);
  assert.equal(checkTeamSizes([mindMerge], 1, []), null);
  // Senior team events are still checked.
  assert.match(checkTeamSizes([{ ...mindMerge, level: "senior" }], 1, []), /Mind Merge/);
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
  // The registrant is always the lead - a client-sent "lead" is replaced.
  assert.deepEqual(value.teamMembers.map((m) => [m.name, m.role]), [["Arun Kumar", "lead"], ["Mem", "member"]]);
});

test("the registrant is always counted in the team", () => {
  // Members sent without the lead: the lead is added, so 3 listed = team of 4.
  const three = JSON.stringify([{ name: "Bala" }, { name: "Chitra" }, { name: "Divya" }]);
  const { value } = validateRegistration({ ...valid, teamMembers: three });
  assert.equal(value.teamMembers.length, 4);
  assert.equal(value.teamMembers[0].role, "lead");
  // Only a lead and no members: an individual registration.
  const onlyLead = validateRegistration({ ...valid, teamMembers: JSON.stringify([{ name: "Arun Kumar", role: "lead" }]) });
  assert.equal(onlyLead.value.teamMembers, null);
});

test("the same person can't be listed twice in a team", () => {
  const dup = JSON.stringify([{ name: "Bala", regNo: "21cs001" }, { name: "Bala K", regNo: "21CS001" }]);
  assert.ok(validateRegistration({ ...valid, teamMembers: dup }).errors.some((e) => /different person/.test(e)));
  const leadTwice = JSON.stringify([{ name: "Me Again", regNo: "21CS009" }]);
  assert.ok(validateRegistration({ ...valid, registerNo: "21cs009", teamMembers: leadTwice }).errors.some((e) => /different person/.test(e)));
});

test("registration closes when an event starts", () => {
  const now = new Date("2026-10-08T05:00:00Z");
  const later = { name: "Later", startTime: "2026-10-08T06:00:00Z" };
  const started = { name: "Started", startTime: "2026-10-08T04:00:00Z" };
  assert.equal(checkRegistrationOpen([later], now), null);
  assert.match(checkRegistrationOpen([later, started], now), /Started.*closed/);
});

test("team size of a saved registration", () => {
  assert.equal(registrationTeamSize({ teamMembers: null }), 1);
  assert.equal(registrationTeamSize({ teamMembers: [{}, {}, {}] }), 3);
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

test("a combo pass is registered alone, and only one per registration", () => {
  const combo1 = { name: "Combo 1", eventIds: ["a", "b", "c"] };
  const combo2 = { name: "Combo 2", eventIds: ["d", "e"] };
  assert.equal(checkComboRules(["a", "b", "c"], [combo1]), null); // exactly the combo
  assert.equal(checkComboRules(["c", "a", "b"], [combo1]), null); // order doesn't matter
  assert.equal(checkComboRules(["x", "y"], []), null); // no combo: any events
  assert.match(checkComboRules(["a", "b", "c", "x"], [combo1]), /on its own/); // combo + extra event
  assert.match(checkComboRules(["a", "b"], [combo1]), /on its own/); // part of a combo
  assert.match(checkComboRules(["a", "b", "c", "d", "e"], [combo1, combo2]), /one combo/); // two combos
});

test("fees are per person: team = members x fee; Hack Nexus flat per team; combo per person", () => {
  const solo = { id: "s", fee: 100, isTeamEvent: false };
  const team = { id: "t", fee: 100, isTeamEvent: true };
  const hack = { id: "h", fee: 1000, isTeamEvent: true, feePerTeam: true };
  assert.equal(computeTotal([solo], [], 1), 100);
  assert.equal(computeTotal([team], [], 3), 300); // team of 3 x Rs 100
  assert.equal(computeTotal([solo, team], [], 3), 600); // every member also plays the individual event
  assert.equal(computeTotal([hack], [], 4), 1000); // flat per team
  const combo = { name: "Combo 1", eventIds: ["s", "t"], comboPrice: 200 };
  assert.equal(computeTotal([solo, team], [combo], 3), 600); // Rs 200 per person
  assert.equal(computeTotal([solo, team], [combo], 1), 200);
  const junior = { id: "j", fee: 0, isTeamEvent: true };
  assert.equal(computeTotal([junior], [], 1), 0);
});

test("individual events: every team member takes part (fee and seats per member); no team for individual-only carts", () => {
  const solo = { id: "s", fee: 100, isTeamEvent: false };
  const team = { id: "t", fee: 100, isTeamEvent: true };
  assert.equal(seatsNeeded(solo, 3), 3); // three separate participants
  assert.equal(seatsNeeded(team, 3), 1); // one team entry
  assert.equal(seatsNeeded(solo, 1), 1);
  assert.match(checkParticipation([solo], 3), /individual events/);
  assert.equal(checkParticipation([solo], 1), null);
  assert.equal(checkParticipation([solo, team], 3), null);
});
