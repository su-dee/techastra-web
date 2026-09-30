// Squad member details: validation and storage shared by the participant and
// admin APIs. Member 1 is the squad lead; their email is the lead email.

const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const clean = (value) =>
  typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
// Accepts 10-digit Indian mobile numbers with optional +91/0 prefix and spacing.
export function normalizePhone(value) {
  const digits = typeof value === "string" ? value.replace(/[\s()-]/g, "") : "";
  const match = /^(?:\+?91|0)?([6-9]\d{9})$/.exec(digits);
  return match ? match[1] : null;
}

// Returns { members } with cleaned values, or { error } naming the member and
// field to fix. Member 1's email is always the lead email.
export function validateMembers(input, squadSize, leadEmail) {
  if (!Array.isArray(input) || input.length !== squadSize)
    return {
      error: `Add details for all ${squadSize} squad members, including the lead.`,
    };
  const members = [];
  for (const [i, raw] of input.entries()) {
    const who = i === 0 ? "Squad lead" : `Member ${i + 1}`;
    const fullName = clean(raw?.fullName);
    const email = i === 0 ? leadEmail : clean(raw?.email).toLowerCase();
    const phone = normalizePhone(raw?.phone);
    const college = clean(raw?.college);
    if (fullName.length < 2 || fullName.length > 80)
      return { error: `${who}: enter a full name (2–80 characters).` };
    if (email.length > 254 || !emailPattern.test(email))
      return { error: `${who}: enter a complete email address.` };
    if (!phone)
      return {
        error: `${who}: enter a 10-digit mobile number, such as 9876543210.`,
      };
    if (college.length < 2 || college.length > 120)
      return { error: `${who}: enter a college name (2–120 characters).` };
    if (members.some((m) => m.email === email))
      return { error: `${who}: each member needs a different email address.` };
    if (members.some((m) => m.phone === phone))
      return { error: `${who}: each member needs a different mobile number.` };
    members.push({ fullName, email, phone, college });
  }
  return { members };
}

// SQL VALUES rows for members, with parameters numbered after `offset`.
// `idExpr` is the SQL expression for the registration id.
export function memberValues(members, offset, idExpr) {
  const params = [];
  const rows = members.map((m, i) => {
    params.push(m.fullName, m.email, m.phone, m.college);
    const n = offset + i * 4;
    return `(${idExpr},${i + 1},$${n + 1},$${n + 2},$${n + 3},$${n + 4})`;
  });
  return { sql: rows.join(","), params };
}

export async function saveMembers(db, registrationId, members) {
  const { sql, params } = memberValues(members, 1, "$1");
  await db.query(
    `INSERT INTO registration_members (registration_id,position,full_name,email,phone,college)
     VALUES ${sql}
     ON CONFLICT (registration_id,position) DO UPDATE SET full_name=EXCLUDED.full_name,
       email=EXCLUDED.email,phone=EXCLUDED.phone,college=EXCLUDED.college`,
    [registrationId, ...params],
  );
  await db.query(
    "DELETE FROM registration_members WHERE registration_id=$1 AND position>$2",
    [registrationId, members.length],
  );
}

export async function membersOf(db, registrationId) {
  const result = await db.query(
    'SELECT position,full_name AS "fullName",email,phone,college FROM registration_members WHERE registration_id=$1 ORDER BY position',
    [registrationId],
  );
  return result.rows;
}
