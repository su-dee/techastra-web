const test = require("node:test");
const assert = require("node:assert/strict");

process.env.JWT_SECRET = process.env.JWT_SECRET || "test-secret-for-tokens";
const { onSpotToken, isValidOnSpotToken, istDate } = require("../utils/idCard");

test("the on-spot QR token works only on the day it was made (India time)", () => {
  const day1 = new Date("2026-10-08T03:30:00Z"); // 9:00 AM IST, 8 Oct
  const lateDay1 = new Date("2026-10-08T18:00:00Z"); // 11:30 PM IST, still 8 Oct
  const day2 = new Date("2026-10-08T19:00:00Z"); // 12:30 AM IST, 9 Oct
  assert.equal(istDate(lateDay1), "2026-10-08");
  assert.equal(istDate(day2), "2026-10-09");
  const token = onSpotToken(day1);
  assert.ok(isValidOnSpotToken(token, lateDay1));
  assert.equal(isValidOnSpotToken(token, day2), false);
  assert.equal(isValidOnSpotToken("", day1), false);
  assert.equal(isValidOnSpotToken("not-a-real-token", day1), false);
  assert.equal(isValidOnSpotToken(undefined, day1), false);
});
