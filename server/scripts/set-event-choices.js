/**
 * Sets each event's choices (e.g. the Clash Squad game: Free Fire Max or
 * BGMI) from prisma/eventData.js, with its description and rulebook,
 * without re-running the whole seed. Only events that have choices change.
 *   node scripts/set-event-choices.js            (dry run: shows what would change)
 *   node scripts/set-event-choices.js --confirm  (writes)
 */
const prisma = require("../db");
const { buildEvents } = require("../prisma/eventData");

(async () => {
  const confirm = process.argv.includes("--confirm");
  let changed = 0;
  for (const e of buildEvents().filter((x) => x.choices.length)) {
    const events = await prisma.event.findMany({ where: { name: e.name, level: e.level }, select: { id: true, name: true, choices: true } });
    if (!events.length) console.log(`  !! no event named "${e.name}"`);
    for (const ev of events) {
      changed++;
      console.log(`  ${confirm ? "set" : "would set"} ${ev.name}: ${e.choiceLabel} = ${e.choices.join(" / ")} (was: ${ev.choices.join(" / ") || "none"})`);
      if (confirm) {
        await prisma.event.update({
          where: { id: ev.id },
          data: { choices: e.choices, choiceLabel: e.choiceLabel, description: e.description, rulebook: e.rulebook },
        });
      }
    }
  }
  console.log(confirm ? `Done: ${changed} event(s) updated.` : `Dry run: ${changed} event(s) would change. Re-run with --confirm to write.`);
  await prisma.$disconnect();
})().catch(async (err) => {
  console.error(err.message);
  await prisma.$disconnect();
  process.exit(1);
});
