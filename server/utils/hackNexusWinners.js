/**
 * Hack Nexus winners for the valedictory winners list. Hack Nexus keeps its
 * own squads (schema HN_DB_SCHEMA, "hacknexus", in the same database); the
 * organisers lock 1st-3rd in its admin (registrations.winner_position).
 * Returns { event, places, external: true } shaped like winnersByEvent's
 * entries, or null when there are none or the schema isn't there (e.g. a
 * local database without Hack Nexus).
 */
const TITLES = ["Mr", "Ms"];

async function hackNexusWinners(prisma) {
  const schema = process.env.HN_DB_SCHEMA || "hacknexus";
  if (!/^[a-z_][a-z0-9_]*$/.test(schema)) return null;
  const event = await prisma.event.findFirst({
    where: { externalRegistration: true, name: { contains: "Hack Nexus", mode: "insensitive" } },
  });
  if (!event) return null;
  let squads, members;
  try {
    squads = await prisma.$queryRawUnsafe(
      `SELECT id::text AS id, team_name, winner_position FROM "${schema}".registrations
       WHERE winner_position IS NOT NULL ORDER BY winner_position`,
    );
    if (!squads.length) return null;
    members = await prisma.$queryRawUnsafe(
      `SELECT registration_id::text AS registration_id, position, full_name, college, phone, title
       FROM "${schema}".registration_members WHERE registration_id::text = ANY($1::text[]) ORDER BY position`,
      squads.map((s) => s.id),
    );
  } catch (err) {
    console.warn("Hack Nexus winners unavailable:", err.meta?.message || err.message);
    return null;
  }
  return {
    event,
    external: true,
    places: squads.map((s) => {
      const team = members.filter((m) => m.registration_id === s.id);
      const lead = team[0] || {};
      return {
        position: Number(s.winner_position),
        registration: {
          registrationCode: `HN-${s.id.slice(0, 8).toUpperCase()}`,
          teamName: s.team_name,
          collegeName: lead.college || "",
          user: { phone: lead.phone || "", collegeName: lead.college || "" },
        },
        // Hack Nexus records no course, department or year - each member's
        // own college, and the Mr/Ms set in its admin.
        people: team.map((m, index) => ({
          index,
          name: m.full_name,
          title: TITLES.includes(m.title) ? m.title : "",
          regNo: "",
          course: "",
          department: "",
          yearOfStudy: "",
          college: m.college || "",
        })),
      };
    }),
  };
}

module.exports = { hackNexusWinners };
