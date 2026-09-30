/**
 * ID card QR helpers. The card's QR holds the verification URL
 * (<site>/verify/<code>?t=<token>, see server/utils/idCard.js); the
 * attendance and food scanners read the registration code back out of it.
 */

/** The URL a participant's ID card QR opens. */
export function idCardVerifyUrl(registrationCode, token) {
  if (!registrationCode) return "";
  const url = `${window.location.origin}/verify/${encodeURIComponent(registrationCode)}`;
  return token ? `${url}?t=${encodeURIComponent(token)}` : url;
}

/**
 * The registration code from a scanned QR: the new cards hold the
 * verification URL, older ones the bare code - both work.
 */
export function registrationCodeFromQr(text) {
  const raw = String(text || "").trim();
  const m = raw.match(/\/verify\/([^/?#\s]+)/i);
  return (m ? decodeURIComponent(m[1]) : raw).toUpperCase();
}
