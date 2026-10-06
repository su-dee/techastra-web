// Unit tests for utils/checkinWindow.js. Run: npm test (node's built-in runner).
const test = require("node:test");
const assert = require("node:assert/strict");
const { checkinOpensAt, checkinNotOpen } = require("../utils/checkinWindow");

// Pen Your Vision: Oct 8, 10:00 AM IST = 04:30 UTC.
const event = { name: "Pen Your Vision", startTime: "2026-10-08T04:30:00.000Z" };

test("check-in opens exactly an hour before the event starts", () => {
  assert.equal(checkinOpensAt(event).toISOString(), "2026-10-08T03:30:00.000Z");
});

test("before the window: refused, with the opening time in IST", () => {
  const msg = checkinNotOpen(event, new Date("2026-10-06T10:00:00Z"));
  assert.match(msg, /Pen Your Vision opens at Thu, 8 Oct, 9:00 am/i);
  assert.ok(checkinNotOpen(event, new Date("2026-10-08T03:29:59Z")));
});

test("from an hour before, through the event and after it: allowed", () => {
  for (const t of ["2026-10-08T03:30:00Z", "2026-10-08T04:30:00Z", "2026-10-08T12:00:00Z"]) {
    assert.equal(checkinNotOpen(event, new Date(t)), null, t);
  }
});

test("CHECKIN_ANYTIME=1 lifts the lock for local testing, never in production", () => {
  const before = new Date("2026-10-06T10:00:00Z");
  const saved = { a: process.env.CHECKIN_ANYTIME, n: process.env.NODE_ENV };
  try {
    process.env.CHECKIN_ANYTIME = "1";
    process.env.NODE_ENV = "development";
    assert.equal(checkinNotOpen(event, before), null);
    process.env.NODE_ENV = "production";
    assert.ok(checkinNotOpen(event, before));
  } finally {
    if (saved.a === undefined) delete process.env.CHECKIN_ANYTIME; else process.env.CHECKIN_ANYTIME = saved.a;
    if (saved.n === undefined) delete process.env.NODE_ENV; else process.env.NODE_ENV = saved.n;
  }
});
