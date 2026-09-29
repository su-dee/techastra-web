/**
 * Recounts every event's seatsTaken from its live registrations (pending and
 * approved - rejected ones hold no seats), using the same per-registration
 * rule as registration (utils/validation.js seatsNeeded).
 *
 *   node scripts/recount-seats.js            # dry run: shows the differences
 *   node scripts/recount-seats.js --confirm  # writes the corrected counts
 *
 * Use it once after upgrading (older versions kept seats for rejected
 * registrations) or whenever the numbers look off.
 */
require("dotenv").config();
const prisma = require("../db");
const { seatsNeeded, registrationTeamSize } = require("../utils/validation");

const confirm = process.argv.includes("--confirm");

(async () => {
  const events = await prisma.event.findMany({ orderBy: { name: "asc" } });
  const byId = new Map(events.map((e) => [e.id, e]));
  const counts = new Map(events.map((e) => [e.id, 0]));
  const live = await prisma.registration.findMany({ where: { status: { not: "rejected" } } });
  for (const reg of live) {
    const size = registrationTeamSize(reg);
    for (const id of reg.eventIds) {
      const ev = byId.get(id);
      if (ev) counts.set(id, counts.get(id) + seatsNeeded(ev, size));
    }
  }
  let changed = 0;
  for (const ev of events) {
    const want = counts.get(ev.id);
    if (want === ev.seatsTaken) continue;
    changed++;
    console.log(`${ev.name}: ${ev.seatsTaken} -> ${want}`);
    if (confirm) await prisma.event.update({ where: { id: ev.id }, data: { seatsTaken: want } });
  }
  console.log(changed ? (confirm ? `Updated ${changed} event(s).` : `${changed} event(s) differ - run with --confirm to fix.`) : "All seat counts are correct.");
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
