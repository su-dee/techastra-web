/**
 * Sets each event's WhatsApp group link from prisma/eventData.js
 * (WHATSAPP_GROUPS) without re-running the whole seed. Only that one column
 * changes; events without a listed group are left as they are.
 *   node scripts/set-whatsapp-groups.js            (dry run: shows what would change)
 *   node scripts/set-whatsapp-groups.js --confirm  (writes)
 */
const prisma = require("../db");
const { WHATSAPP_GROUPS } = require("../prisma/eventData");

(async () => {
  const confirm = process.argv.includes("--confirm");
  let changed = 0;
  for (const [name, url] of Object.entries(WHATSAPP_GROUPS)) {
    const events = await prisma.event.findMany({ where: { name }, select: { id: true, name: true, level: true, whatsappUrl: true } });
    if (!events.length) {
      console.log(`  !! no event named "${name}"`);
      continue;
    }
    for (const ev of events) {
      if (ev.whatsappUrl === url) {
        console.log(`  ok  ${ev.name} (${ev.level}) already set`);
        continue;
      }
      changed++;
      console.log(`  ${confirm ? "set" : "would set"} ${ev.name} (${ev.level})`);
      if (confirm) await prisma.event.update({ where: { id: ev.id }, data: { whatsappUrl: url } });
    }
  }
  console.log(confirm ? `Done: ${changed} event(s) updated.` : `Dry run: ${changed} event(s) would change. Re-run with --confirm to write.`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err.message);
  await prisma.$disconnect();
  process.exit(1);
});
