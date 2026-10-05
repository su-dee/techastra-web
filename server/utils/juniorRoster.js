/**
 * Junior events have no online registrations: their participants are the
 * students the Junior coordinator imported (JuniorParticipant). This groups
 * them the way the coordinator portal lists registrations - one entry per
 * team (same team name and school) or per student - so the roster and the
 * winners list work the same for junior events. A team is identified by its
 * first member's id, which is what a locked result stores.
 */
const prisma = require("../db");
const { teamKey } = require("./juniorImport");

async function juniorRoster(eventId) {
  const students = await prisma.juniorParticipant.findMany({ where: { eventId }, orderBy: [{ createdAt: "asc" }, { code: "asc" }] });
  const groups = new Map();
  for (const s of students) {
    const key = s.teamName ? teamKey(eventId, s.school, s.teamName) : s.id;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(s);
  }
  return [...groups.values()].map((team) => {
    const [lead] = team;
    return {
      registrationId: lead.id,
      registrationCode: lead.code,
      name: lead.name,
      teamName: lead.teamName || null,
      college: lead.school,
      members: team.map((m, i) => ({ name: m.name, role: i === 0 ? "lead" : "member", className: m.className })),
      present: false,
      junior: true,
    };
  });
}

/** Display info for result rows that point at junior participants: id -> { name, teamName, school, members }. */
async function juniorWinners(ids) {
  if (!ids.length) return new Map();
  const leads = await prisma.juniorParticipant.findMany({ where: { id: { in: ids } } });
  const out = new Map();
  for (const lead of leads) {
    const team = lead.teamName
      ? (await prisma.juniorParticipant.findMany({ where: { eventId: lead.eventId, teamName: { equals: lead.teamName, mode: "insensitive" } }, orderBy: [{ createdAt: "asc" }, { code: "asc" }] }))
          .filter((m) => teamKey(lead.eventId, m.school, m.teamName) === teamKey(lead.eventId, lead.school, lead.teamName))
      : [lead];
    out.set(lead.id, { name: lead.name, teamName: lead.teamName || null, school: lead.school, members: team.map((m) => m.name) });
  }
  return out;
}

module.exports = { juniorRoster, juniorWinners };
