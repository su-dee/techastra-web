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

module.exports = { idCardToken, isValidIdCardToken };
