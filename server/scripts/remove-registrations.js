/**
 * Removes registrations by code, with their attendance, food, kit, result
 * and certificate rows, then frees their seats. The user accounts are kept.
 *
 *   node scripts/remove-registrations.js SYM2026-0001 SYM2026-0002            # dry run
 *   node scripts/remove-registrations.js SYM2026-0001 SYM2026-0002 --confirm  # delete
 */
require("dotenv").config();
const prisma = require("../db");

const confirm = process.argv.includes("--confirm");
const codes = process.argv.slice(2).filter((a) => !a.startsWith("--"));

(async () => {
  if (!codes.length) throw new Error("Pass at least one registration code.");
  const regs = await prisma.registration.findMany({
    where: { registrationCode: { in: codes } },
    include: { user: { select: { name: true, email: true, role: true } } },
  });
  const missing = codes.filter((c) => !regs.some((r) => r.registrationCode === c));
  if (missing.length) console.log(`Not found: ${missing.join(", ")}`);
  const events = await prisma.event.findMany({ select: { id: true, name: true } });
  const name = new Map(events.map((e) => [e.id, e.name]));
  for (const r of regs) {
    const where = { registrationId: r.id };
    const [att, food, kit, res, cert] = await Promise.all([
      prisma.attendance.count({ where }), prisma.foodLog.count({ where }), prisma.kitHandout.count({ where }),
      prisma.result.count({ where }), prisma.certificate.count({ where }),
    ]);
    console.log(`${r.registrationCode} | ${r.status} | ${r.user.name} <${r.user.email}> (${r.user.role}) | Rs ${r.totalAmount} | ${r.eventIds.map((id) => name.get(id) || id).join(", ")} | attendance ${att}, food ${food}, kit ${kit}, results ${res}, certificates ${cert}`);
  }
  if (!confirm) return console.log(`Dry run: ${regs.length} registration(s) would be removed. Add --confirm to delete.`);
  for (const r of regs) {
    await prisma.$transaction(async (tx) => {
      const where = { registrationId: r.id };
      await tx.attendance.deleteMany({ where });
      await tx.foodLog.deleteMany({ where });
      await tx.kitHandout.deleteMany({ where });
      await tx.result.deleteMany({ where });
      await tx.certificate.deleteMany({ where });
      await tx.registration.delete({ where: { id: r.id } });
    });
    console.log(`Removed ${r.registrationCode}`);
  }
})()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
