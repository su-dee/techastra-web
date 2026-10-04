/**
 * Participant ID card verification. The card's QR opens
 * /verify/<registrationCode>?t=<token>; the token is an HMAC of the code, so
 * only a real card's QR verifies - registration codes are sequential, and
 * without it anyone could walk through them and read participants' names.
 */
const crypto = require("crypto");

function secret() {
  const s = process.env.ID_CARD_SECRET || process.env.JWT_SECRET;
  if (!s) throw new Error("ID_CARD_SECRET or JWT_SECRET must be set");
  return s;
}

/** Short, URL-safe token for a registration code. */
function idCardToken(registrationCode) {
  return crypto.createHmac("sha256", secret()).update(`idcard:${registrationCode}`).digest("base64url").slice(0, 16);
}

/** True if `token` is the valid token for `registrationCode` (constant-time). */
function isValidIdCardToken(registrationCode, token) {
  if (typeof token !== "string" || !token) return false;
  const expected = Buffer.from(idCardToken(registrationCode));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

/** A date as YYYY-MM-DD in India time. */
const istDate = (d = new Date()) => new Date(d).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/**
 * The desk's on-spot registration QR carries this token: an HMAC of the
 * day (India time), so a photo of the QR shared online stops working the
 * next day and can't be used to take on-spot seats in advance.
 */
function onSpotToken(date = new Date()) {
  return crypto.createHmac("sha256", secret()).update(`onspot:${istDate(date)}`).digest("base64url").slice(0, 16);
}

/** True if `token` is today's on-spot token (constant-time). */
function isValidOnSpotToken(token, now = new Date()) {
  if (typeof token !== "string" || !token) return false;
  const expected = Buffer.from(onSpotToken(now));
  const given = Buffer.from(token);
  return expected.length === given.length && crypto.timingSafeEqual(expected, given);
}

module.exports = { idCardToken, isValidIdCardToken, istDate, onSpotToken, isValidOnSpotToken };
