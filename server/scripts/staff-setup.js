/**
 * Creates the real staff logins, each with its own random password:
 *   - admin, hospitality, certificates
 *   - desk1 ... desk5 (registration desk)
 *   - one coordinator login per event (e.g. coderescue@...), limited to that event
 *
 *   npm run staff:setup                 # create / update the logins
 *   npm run staff:setup -- --dry-run    # show what would change
 *
 * The passwords live in staff-credentials.csv next to package.json
 * (gitignored), plus a printable staff-credentials.html. Run it on this
 * laptop first; copy staff-credentials.csv to the server and run it there
 * too, so everyone keeps the same password in production.
 *   - Logins already in the CSV keep their password; new ones get a new one.
 *   - The database is set to match the CSV (re-running resets a changed password).
 *   - To reset one person's password, delete their line and re-run.
 * Login IDs use STAFF_LOGIN_DOMAIN (default techastra.drmgrdu.ac.in); no
 * email is ever sent to them.
 */
require("dotenv").config();
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");
const bcrypt = require("bcrypt");
const prisma = require("../db");

const DRY = process.argv.includes("--dry-run");
const DOMAIN = process.env.STAFF_LOGIN_DOMAIN || "techastra.drmgrdu.ac.in";
const DESKS = Number(process.env.STAFF_DESK_COUNT || 5);
const CSV = path.join(__dirname, "..", "staff-credentials.csv");
const HTML = path.join(__dirname, "..", "staff-credentials.html");

// 12 characters from an alphabet with no look-alikes (0/O, 1/l/I), as xxxx-xxxx-xxxx.
const ALPHABET = "abcdefghjkmnpqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function newPassword() {
  const chars = Array.from(crypto.randomBytes(12), (b) => ALPHABET[b % ALPHABET.length]);
  return [chars.slice(0, 4), chars.slice(4, 8), chars.slice(8)].map((c) => c.join("")).join("-");
}
const slug = (name) => name.toLowerCase().replace(/[^a-z0-9]+/g, "");
const csvCell = (v) => (/[",\n]/.test(v) ? `"${String(v).replace(/"/g, '""')}"` : String(v));

function readCsv() {
  if (!fs.existsSync(CSV)) return new Map();
  const [, ...rows] = fs.readFileSync(CSV, "utf8").trim().split(/\r?\n/);
  const map = new Map();
  for (const row of rows) {
    const cells = row.match(/("([^"]|"")*"|[^,]*)(,|$)/g).map((c) => c.replace(/,$/, "").replace(/^"|"$/g, "").replace(/""/g, '"'));
    const [, , login, password] = cells;
    if (login && password) map.set(login.toLowerCase(), password);
  }
  return map;
}

(async () => {
  const events = await prisma.event.findMany({ orderBy: [{ level: "desc" }, { category: "asc" }, { name: "asc" }] });
  if (!events.length) throw new Error("No events in the database - run the seed first.");

  const accounts = [
    { role: "master_admin", label: "Admin", name: "Techastra Admin", login: `admin@${DOMAIN}` },
    { role: "hospitality", label: "Hospitality (food counter)", name: "Hospitality Desk", login: `hospitality@${DOMAIN}` },
    { role: "certificate_team", label: "Certificate team", name: "Certificate Desk", login: `certificates@${DOMAIN}` },
    ...Array.from({ length: DESKS }, (_, i) => ({
      role: "registration_team", label: "Registration desk", name: `Registration Desk ${i + 1}`, login: `desk${i + 1}@${DOMAIN}`,
    })),
  ];
  const used = new Set(accounts.map((a) => a.login));
  for (const ev of events) {
    let login = `${slug(ev.name)}@${DOMAIN}`;
    if (used.has(login)) login = `${slug(ev.name)}.${ev.level}@${DOMAIN}`; // same name at both levels
    used.add(login);
    accounts.push({
      role: "coordinator",
      label: `Coordinator · ${ev.level === "junior" ? "Junior" : "Senior"} ${ev.category === "non_technical" ? "non-technical" : "technical"}`,
      name: `${ev.name} Coordinators`,
      event: ev,
      login,
    });
  }

  const saved = readCsv();
  let created = 0, updated = 0, kept = 0;
  for (const a of accounts) {
    a.password = saved.get(a.login) || newPassword();
    a.isNewPassword = !saved.has(a.login);
    const existing = await prisma.user.findUnique({ where: { email: a.login } });
    if (existing && existing.role !== a.role) throw new Error(`${a.login} exists with role ${existing.role}, expected ${a.role}`);
    const passwordOk = existing ? await bcrypt.compare(a.password, existing.passwordHash) : false;
    const eventOk = existing ? (existing.assignedEventId || null) === (a.event?.id || null) : false;
    if (existing && passwordOk && eventOk && existing.name === a.name) { kept++; continue; }
    if (DRY) { console.log(`${existing ? "would update" : "would create"}: ${a.login}`); existing ? updated++ : created++; continue; }
    const data = { name: a.name, role: a.role, passwordHash: await bcrypt.hash(a.password, 10), assignedEventId: a.event?.id || null };
    if (existing) { await prisma.user.update({ where: { id: existing.id }, data }); updated++; }
    else { await prisma.user.create({ data: { ...data, email: a.login } }); created++; }
  }

  if (!DRY) {
    const header = "Role,Name / Event,Login ID,Password";
    const lines = accounts.map((a) => [a.label, a.event ? a.event.name : a.name, a.login, a.password].map(csvCell).join(","));
    fs.writeFileSync(CSV, [header, ...lines].join("\n") + "\n", { mode: 0o600 });

    const esc = (s) => String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;");
    const slip = (a) => `<div class="slip"><div class="role">${esc(a.label)}</div><div class="who">${esc(a.event ? a.event.name : a.name)}</div>
<div class="row"><span>Login</span><b>${esc(a.login)}</b></div><div class="row"><span>Password</span><b class="pw">${esc(a.password)}</b></div>
<div class="note">Sign in at https://${esc(DOMAIN)}/login · keep this private</div></div>`;
    fs.writeFileSync(
      HTML,
      `<!doctype html><html><head><meta charset="utf-8"><title>Techastra '26 staff logins</title><style>
body{font-family:Arial,Helvetica,sans-serif;margin:12mm;color:#111}h1{font-size:16px;margin:0 0 4mm}p{font-size:11px;margin:0 0 6mm;color:#444}
.grid{display:grid;grid-template-columns:repeat(2,1fr);gap:4mm}.slip{border:1px dashed #888;border-radius:3mm;padding:4mm;break-inside:avoid;font-size:12px}
.role{font-size:10px;text-transform:uppercase;letter-spacing:.08em;color:#666}.who{font-size:15px;font-weight:bold;margin:1mm 0 3mm}
.row{display:flex;justify-content:space-between;gap:3mm;margin:1mm 0}.row span{color:#555}.pw{font-family:Consolas,monospace;font-size:14px;letter-spacing:.04em}
.note{margin-top:2mm;font-size:9px;color:#777}@media print{body{margin:8mm}}</style></head><body>
<h1>Techastra '26 — staff logins</h1><p>Cut along the dashed lines and hand each slip to its team. Coordinator logins only work for their own event.</p>
<div class="grid">${accounts.map(slip).join("\n")}</div></body></html>`,
      { mode: 0o600 }
    );
  }

  console.log(`\n${accounts.length} staff logins: ${created} created, ${updated} updated, ${kept} already up to date${DRY ? " (dry run - nothing changed)" : ""}.`);
  if (!DRY) console.log(`Passwords: ${path.basename(CSV)} and ${path.basename(HTML)} (printable) - keep them private, never commit them.`);
})()
  .catch((err) => {
    console.error(err.message || err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
