/**
 * Input validation for public endpoints (OWASP ASVS V5). Pure functions, no
 * database access, so they can be unit-tested (see test/validation.test.js).
 */

const EMAIL = /^[^\s@]{1,64}@[^\s@]{1,190}\.[^\s@]{2,}$/;
// Indian mobile numbers, with or without +91 / spaces / dashes.
const PHONE = /^(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
// UPI apps show a 12-digit UTR / RRN; some show a longer alphanumeric
// transaction ID. Accept both, never whitespace or symbols.
const UPI_TXN = /^[A-Z0-9]{10,35}$/;

const MIN_PASSWORD = 8;
const MAX_PASSWORD = 128;
const MAX_EVENTS = 20;
const MAX_TEAM = 10;

const str = (v) => (typeof v === "string" ? v.trim() : "");

/** Parses a JSON form field; returns `fallback` for empty input, throws on bad JSON. */
function parseJsonField(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    const err = new Error("Malformed request data");
    err.status = 400;
    throw err;
  }
}

const normalizeEmail = (v) => str(v).toLowerCase();
const normalizeTxn = (v) => str(v).replace(/\s+/g, "").toUpperCase();
const normalizePhone = (v) => str(v).replace(/[\s-]/g, "");

const isEmail = (v) => EMAIL.test(v) && v.length <= 254;
const isPhone = (v) => PHONE.test(str(v));
const isUpiTxn = (v) => UPI_TXN.test(v);

/**
 * Validates the multipart body of POST /api/registrations.
 * Returns { errors: string[], value } - `value` holds the normalised fields.
 */
function validateRegistration(body = {}) {
  const errors = [];
  const eventIds = parseJsonField(body.eventIds, []);
  const comboIds = parseJsonField(body.comboIds, []);
  const teamMembers = parseJsonField(body.teamMembers, null);

  const value = {
    name: str(body.name),
    email: normalizeEmail(body.email),
    phone: normalizePhone(body.phone) || null,
    password: typeof body.password === "string" ? body.password : "",
    collegeName: str(body.collegeName) || null,
    registerNo: str(body.registerNo) || null,
    teamName: str(body.teamName) || null,
    transactionId: normalizeTxn(body.transactionId),
    eventIds,
    comboIds,
    teamMembers: null,
    consent: body.consent === "true" || body.consent === true,
    guardianConsent: body.guardianConsent === "true" || body.guardianConsent === true,
  };

  if (value.name.length < 2 || value.name.length > 100) errors.push("Enter your full name (2–100 characters).");
  if (!isEmail(value.email)) errors.push("Enter a valid email address.");
  if (value.phone && !isPhone(value.phone)) errors.push("Enter a valid 10-digit Indian mobile number.");
  if (value.password.length < MIN_PASSWORD || value.password.length > MAX_PASSWORD)
    errors.push(`Password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters.`);
  if (value.collegeName && value.collegeName.length > 150) errors.push("College / school name is too long.");
  if (value.registerNo && value.registerNo.length > 50) errors.push("Register number / class is too long.");
  if (value.teamName && value.teamName.length > 80) errors.push("Team name is too long.");
  // Required only when there's something to pay (free Junior registrations
  // have no payment) - the route checks that once the total is known.
  if (value.transactionId && !isUpiTxn(value.transactionId))
    errors.push("Enter the UPI transaction ID (UTR) from your payment app - the 12-digit reference number.");
  if (!value.consent) errors.push("Please accept the Terms and the Privacy Notice to register.");

  if (!Array.isArray(eventIds) || !eventIds.length) errors.push("Select at least one event.");
  else if (eventIds.length > MAX_EVENTS || eventIds.some((id) => typeof id !== "string" || id.length > 64))
    errors.push("Invalid event selection.");
  else if (new Set(eventIds).size !== eventIds.length) errors.push("An event was selected twice.");

  if (!Array.isArray(comboIds) || comboIds.some((id) => typeof id !== "string" || id.length > 64))
    errors.push("Invalid combo pass selection.");

  if (teamMembers !== null) {
    if (!Array.isArray(teamMembers) || teamMembers.length > MAX_TEAM) {
      errors.push(`A team can have at most ${MAX_TEAM} members.`);
    } else {
      value.teamMembers = teamMembers.map((m) => ({
        name: str(m?.name).slice(0, 100),
        regNo: str(m?.regNo).slice(0, 50),
        role: m?.role === "lead" ? "lead" : "member",
      }));
      if (value.teamMembers.some((m) => m.name.length < 2)) errors.push("Enter a name for every team member.");
    }
  }

  return { errors, value };
}

/**
 * Team-size rules for team events. Solo events ignore the team (the lead
 * takes part alone). Returns an error message or null.
 *
 * Events booked through a combo pass are checked against the combo: the team
 * must have enough people for each event, and may be as large as the biggest
 * team event in that combo - e.g. Combo 1 (Hidden Frames 2, Team Feud 3) is
 * booked by a team of 3, and 2 of them play Hidden Frames.
 */
function checkTeamSizes(events, teamSize, combos = []) {
  const comboCap = new Map(); // eventId -> largest team allowed in its combo
  for (const combo of combos) {
    const inCombo = events.filter((e) => combo.eventIds.includes(e.id) && e.isTeamEvent);
    const cap = Math.max(1, ...inCombo.map((e) => e.maxTeamSize || e.minTeamSize || 1));
    inCombo.forEach((e) => comboCap.set(e.id, cap));
  }
  for (const ev of events) {
    if (!ev.isTeamEvent) continue;
    // Junior Techastra: school students register individually and teams
    // are formed at the venue, so the team size isn't checked here.
    if (ev.level === "junior") continue;
    const min = ev.minTeamSize || 1;
    const max = comboCap.get(ev.id) ?? (ev.maxTeamSize || min);
    if (teamSize < min || teamSize > max) {
      const range = min === max ? `${min}` : `${min}–${max}`;
      return comboCap.has(ev.id)
        ? `"${ev.name}" is in a combo pass that needs a team of ${range} (you have ${teamSize}).`
        : `"${ev.name}" needs a team of ${range} (you have ${teamSize}).`;
    }
  }
  return null;
}

/**
 * Amount due for a registration: each selected combo pass at its combo
 * price, plus the fee of every event not covered by a combo. Throws if a
 * combo's events aren't all selected.
 */
function computeTotal(events, combos) {
  const covered = new Set();
  let total = 0;
  const selected = new Set(events.map((e) => e.id));
  for (const combo of combos) {
    if (!combo.eventIds.every((id) => selected.has(id)) || combo.eventIds.some((id) => covered.has(id))) {
      const err = new Error(`The "${combo.name}" pass doesn't match the selected events.`);
      err.status = 400;
      throw err;
    }
    combo.eventIds.forEach((id) => covered.add(id));
    total += combo.comboPrice;
  }
  for (const ev of events) if (!covered.has(ev.id)) total += ev.fee;
  return Math.round(total * 100) / 100;
}

module.exports = {
  MIN_PASSWORD,
  parseJsonField,
  normalizeEmail,
  normalizeTxn,
  isEmail,
  isPhone,
  isUpiTxn,
  validateRegistration,
  checkTeamSizes,
  computeTotal,
};
