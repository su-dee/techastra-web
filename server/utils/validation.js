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
// College students' year of study (senior registrations).
const YEARS_OF_STUDY = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
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
  const eventChoices = parseJsonField(body.eventChoices, {});

  const value = {
    name: str(body.name),
    email: normalizeEmail(body.email),
    phone: normalizePhone(body.phone) || null,
    password: typeof body.password === "string" ? body.password : "",
    collegeName: str(body.collegeName) || null,
    registerNo: str(body.registerNo) || null,
    course: str(body.course) || null,
    department: str(body.department) || null,
    yearOfStudy: str(body.yearOfStudy) || null,
    teamName: str(body.teamName) || null,
    transactionId: normalizeTxn(body.transactionId),
    eventIds,
    comboIds,
    teamMembers: null,
    eventChoices: eventChoices && typeof eventChoices === "object" && !Array.isArray(eventChoices) ? eventChoices : {},
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
  if (value.course && value.course.length > 100) errors.push("Course is too long.");
  if (value.department && value.department.length > 100) errors.push("Department is too long.");
  if (value.yearOfStudy && !YEARS_OF_STUDY.includes(value.yearOfStudy)) errors.push("Choose your year of study.");
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

  // The team is always the registrant (lead) plus the listed members. Any
  // "lead" the client sends is replaced by the registrant, so the team - and
  // the per-person amount - can't leave out the person registering.
  if (teamMembers !== null) {
    if (!Array.isArray(teamMembers) || teamMembers.length > MAX_TEAM) {
      errors.push(`A team can have at most ${MAX_TEAM} members.`);
    } else {
      const members = teamMembers
        .filter((m) => m?.role !== "lead")
        .map((m) => ({
          name: str(m?.name).slice(0, 100),
          regNo: str(m?.regNo).slice(0, 50),
          department: str(m?.department).slice(0, 100),
          yearOfStudy: str(m?.yearOfStudy),
          role: "member",
        }));
      if (members.some((m) => m.name.length < 2)) errors.push("Enter a name for every team member.");
      if (members.some((m) => m.yearOfStudy && !YEARS_OF_STUDY.includes(m.yearOfStudy))) errors.push("Choose each team member's year of study.");
      // The same person can't be listed twice (checked by register number).
      const regNos = [value.registerNo, ...members.map((m) => m.regNo)].filter(Boolean).map((r) => r.toUpperCase());
      if (new Set(regNos).size !== regNos.length) errors.push("Each team member must be a different person - two have the same register number.");
      if (members.length) {
        const lead = { name: value.name, regNo: value.registerNo || "", department: value.department || "", yearOfStudy: value.yearOfStudy || "", role: "lead" };
        value.teamMembers = [lead, ...members];
      }
    }
  }

  return { errors, value };
}

/**
 * Participant details required for the registration's level: every
 * registration needs its college / school name (printed on the ID card);
 * college students (senior) also give course, department and year of
 * study. Returns an error message or null.
 */
function checkParticipantDetails(value, level) {
  if (!value.collegeName) return level === "junior" ? "Enter your school name." : "Enter your college name.";
  if (level !== "junior") {
    if (!value.course) return "Enter your course (for example B.E. or B.Tech).";
    if (!value.department) return "Enter your department.";
    if (!value.yearOfStudy) return "Choose your year of study.";
  }
  return null;
}

/**
 * College students (senior) give each team member's department and year
 * of study, like their own. Returns an error message or null.
 */
function checkMemberDetails(teamMembers) {
  const members = (teamMembers || []).filter((m) => m.role !== "lead");
  if (members.some((m) => !m.department)) return "Enter every team member's department.";
  if (members.some((m) => !m.yearOfStudy)) return "Choose every team member's year of study.";
  return null;
}

/**
 * The team lead fills in (or corrects) their members' department and year
 * of study after registering - teams that registered before these were
 * asked. `updates` lists { department, yearOfStudy } for each member in
 * order (the lead excluded); names and register numbers never change here.
 * Returns { error } or { teamMembers }.
 */
function applyMemberDetails(teamMembers, updates) {
  const list = Array.isArray(teamMembers) ? teamMembers : [];
  const members = list.filter((m) => m?.role !== "lead");
  if (!members.length) return { error: "This registration has no team members." };
  if (!Array.isArray(updates) || updates.length !== members.length) return { error: "Send the details of every team member." };
  const clean = updates.map((u) => ({ department: str(u?.department).slice(0, 100), yearOfStudy: str(u?.yearOfStudy) }));
  if (clean.some((u) => !u.department)) return { error: "Enter every team member's department." };
  if (clean.some((u) => !YEARS_OF_STUDY.includes(u.yearOfStudy))) return { error: "Choose every team member's year of study." };
  let i = 0;
  return { teamMembers: list.map((m) => (m?.role === "lead" ? m : { ...m, ...clean[i++] })) };
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
 * Events with choices (e.g. the game for Clash Squad E-Sports) need one of
 * their options picked. Returns { error } or { choices } - only the selected
 * events that have options, as { [eventId]: option }, or null if none do.
 */
function checkEventChoices(events, picked = {}) {
  const choices = {};
  for (const ev of events) {
    if (!ev.choices?.length) continue;
    const value = picked[ev.id];
    if (!ev.choices.includes(value)) {
      return { error: `Choose your ${(ev.choiceLabel || "option").toLowerCase()} for "${ev.name}" (${ev.choices.join(" or ")}).` };
    }
    choices[ev.id] = value;
  }
  return { choices: Object.keys(choices).length ? choices : null };
}

/**
 * Combo pass rules: at most one combo per registration, and a combo is
 * registered on its own - the registration's events must be exactly the
 * combo's events. Returns an error message or null.
 */
function checkComboRules(eventIds, combos) {
  if (combos.length > 1) return "Only one combo pass can be registered at a time.";
  if (combos.length === 1) {
    const combo = combos[0];
    const inCombo = new Set(combo.eventIds);
    if (eventIds.length !== inCombo.size || !eventIds.every((id) => inCombo.has(id))) {
      return `The "${combo.name}" pass is registered on its own - it can't be combined with other events.`;
    }
  }
  return null;
}

/**
 * Amount due for a registration: each selected combo pass at its combo
 * price per person (× team size), plus every other event's charge (see
 * eventCharge). Throws if a combo's events aren't all selected.
 */
function computeTotal(events, combos, teamSize = 1) {
  const people = Math.max(1, teamSize);
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
    total += combo.comboPrice * people; // combo price is per person
  }
  for (const ev of events) if (!covered.has(ev.id)) total += eventCharge(ev, people);
  return Math.round(total * 100) / 100;
}

/**
 * What one event costs for a registration. Fees are per person and every
 * member of a registration takes part in every event - in a team event as
 * the team, in an individual event each on their own - so the charge is
 * fee × people. A flat per-team fee (feePerTeam, e.g. Hack Nexus) is
 * charged once.
 */
function eventCharge(ev, teamSize = 1) {
  if (ev.feePerTeam) return ev.fee;
  return ev.fee * Math.max(1, teamSize);
}

/**
 * Seats one registration takes in an event: a team event seats the team as
 * one entry; in an individual event every member is a separate participant.
 */
function seatsNeeded(ev, teamSize = 1) {
  return ev.isTeamEvent ? 1 : Math.max(1, teamSize);
}

/**
 * Seats left in an event. Online registration can't use the on-spot seats
 * (Event.onSpotSeats); on-spot registration (the desk's QR) can use them all.
 */
function seatsLeft(ev, { onSpot = false } = {}) {
  const cap = ev.maxSeats - (onSpot ? 0 : ev.onSpotSeats || 0);
  return Math.max(cap - ev.seatsTaken, 0);
}

/** On-spot seats must be a whole number from 0 to the event's seats. Error message or null. */
function checkOnSpotSeats(onSpotSeats, maxSeats) {
  if (!Number.isInteger(onSpotSeats) || onSpotSeats < 0) return "On-spot seats must be a whole number, 0 or more.";
  if (Number.isFinite(maxSeats) && onSpotSeats > maxSeats) return `On-spot seats can't be more than the event's ${maxSeats} seats.`;
  return null;
}

/** People in a saved registration: its team list, or just the registrant. */
function registrationTeamSize(registration) {
  return Array.isArray(registration.teamMembers) && registration.teamMembers.length ? registration.teamMembers.length : 1;
}

/** The end (23:59:59 IST) of the symposium day a time falls on. */
function endOfDayIST(time) {
  const ymd = new Date(time).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  return new Date(`${ymd}T23:59:59.999+05:30`);
}

/**
 * Online registration for an event stays open until the end of its day (IST),
 * also after it has started (organisers, 8 Oct 2026).
 */
const registrationClosesAt = (event) => endOfDayIST(event.startTime);

/** An error message for the first event whose registration has closed, or null. */
function checkRegistrationOpen(events, now = new Date()) {
  const closed = events.find((e) => registrationClosesAt(e) <= now);
  return closed ? `Registration for "${closed.name}" has closed for the day.` : null;
}

/**
 * Individual-only registrations have no team: team details only make sense
 * when at least one event is a team event. Returns an error message or null.
 */
function checkParticipation(events, teamSize) {
  if (teamSize > 1 && !events.some((e) => e.isTeamEvent)) {
    return "These are individual events - register without team members (each person registers separately).";
  }
  return null;
}

module.exports = {
  MIN_PASSWORD,
  MAX_PASSWORD,
  YEARS_OF_STUDY,
  checkParticipantDetails,
  checkMemberDetails,
  applyMemberDetails,
  parseJsonField,
  normalizeEmail,
  normalizeTxn,
  isEmail,
  isPhone,
  isUpiTxn,
  validateRegistration,
  checkTeamSizes,
  checkComboRules,
  checkEventChoices,
  computeTotal,
  eventCharge,
  seatsNeeded,
  seatsLeft,
  checkOnSpotSeats,
  registrationTeamSize,
  checkRegistrationOpen,
  registrationClosesAt,
  endOfDayIST,
  checkParticipation,
};
