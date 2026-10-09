const express = require("express");
const fs = require("fs");
const ExcelJS = require("exceljs");
const { PDFDocument } = require("pdf-lib");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { certificateFile } = require("../utils/certificatePdf");
const { winnersListPdf } = require("../utils/winnersListPdf");
const { hackNexusWinners } = require("../utils/hackNexusWinners");
const {
  TITLES,
  peopleOf,
  certificateName,
  refreshCertificates,
  participationPlan,
  sendParticipationCertificates,
  sendStatus,
  winnerCertificates,
} = require("../utils/certificates");

const router = express.Router();
const committee = [requireAuth, requireRole("certificate_team", "master_admin")];
const PLACE = { 1: "1st", 2: "2nd", 3: "3rd" };

/**
 * GET /api/certificates/participation/plan?day=1 - what "Send participation
 * certificates" would do for that day's events (see utils/certificates.js).
 */
router.get("/participation/plan", ...committee, async (req, res) => {
  try {
    const day = Number(req.query.day);
    if (![1, 2].includes(day)) return res.status(400).json({ error: "Choose Day 1 or Day 2." });
    const plan = await participationPlan(day);
    res.json({
      events: plan.map((p) => ({
        eventId: p.event.id,
        name: p.event.name,
        endTime: p.event.endTime,
        status: p.status,
        checkedIn: p.checkedIn,
        winners: p.winners,
        eligible: p.eligible.length,
        people: p.people,
        alreadySent: p.alreadySent,
      })),
      job: sendStatus(),
    });
  } catch (err) {
    console.error("Certificate plan error:", err);
    res.status(500).json({ error: "Failed to load the certificate plan" });
  }
});

/** POST /api/certificates/participation/send { day } - make and email them (in the background). */
router.post("/participation/send", ...committee, (req, res) => {
  const day = Number(req.body?.day);
  if (![1, 2].includes(day)) return res.status(400).json({ error: "Choose Day 1 or Day 2." });
  const { job, error } = sendParticipationCertificates(day, req.user.name || req.user.email);
  if (error) return res.status(409).json({ error });
  res.status(202).json({ job });
});

/** GET /api/certificates/participation/status - progress of the last send. */
router.get("/participation/status", ...committee, (req, res) => res.json({ job: sendStatus() }));

/** Winners of every event with locked results (or one event), in finishing order. */
async function winnersByEvent(eventId) {
  const results = await prisma.result.findMany({
    where: eventId ? { eventId } : {},
    orderBy: [{ eventId: "asc" }, { position: "asc" }],
  });
  const [events, regs] = await Promise.all([
    // Junior Techastra gets no certificates.
    prisma.event.findMany({ where: { id: { in: [...new Set(results.map((r) => r.eventId))] }, level: "senior" }, orderBy: [{ day: "asc" }, { startTime: "asc" }] }),
    prisma.registration.findMany({ where: { id: { in: results.map((r) => r.registrationId) } }, include: { user: true } }),
  ]);
  const regById = new Map(regs.map((r) => [r.id, r]));
  const list = events.map((event) => ({
    event,
    places: results
      .filter((r) => r.eventId === event.id && regById.has(r.registrationId))
      .map((r) => {
        const reg = regById.get(r.registrationId);
        return { position: r.position, registration: reg, people: peopleOf(reg) };
      }),
  }));
  // Hack Nexus locks its winners in its own admin (separate squads).
  const hackNexus = await hackNexusWinners(prisma);
  if (hackNexus && (!eventId || eventId === hackNexus.event.id)) {
    list.push(hackNexus);
    const when = (e) => [e.day ?? 99, new Date(e.startTime).getTime()];
    list.sort((a, b) => {
      const [da, ta] = when(a.event), [db, tb] = when(b.event);
      return da - db || ta - tb;
    });
  }
  return list;
}

/** GET /api/certificates/winners - winners per event, for the portal. */
router.get("/winners", ...committee, async (req, res) => {
  try {
    const list = await winnersByEvent();
    res.json({
      events: list.map(({ event, places, external }) => ({
        eventId: event.id,
        name: event.name,
        day: event.day,
        // Hack Nexus: locked in its own admin; no winner certificates here.
        external: !!external,
        places: places.map((p) => ({
          position: p.position,
          registrationCode: p.registration.registrationCode,
          teamName: p.registration.teamName,
          college: p.registration.collegeName || p.registration.user.collegeName,
          names: p.people.map((x) => x.name),
        })),
      })),
    });
  } catch (err) {
    console.error("Winners list error:", err);
    res.status(500).json({ error: "Failed to load the winners" });
  }
});

/**
 * GET /api/certificates/winners.xlsx[?eventId=] - the winners list for the
 * valedictory: one sheet per event, one row per person.
 */
router.get("/winners.xlsx", ...committee, async (req, res) => {
  try {
    const list = await winnersByEvent(req.query.eventId ? String(req.query.eventId) : undefined);
    const workbook = new ExcelJS.Workbook();
    const columns = [
      { header: "Place", key: "place", width: 8 },
      { header: "Name", key: "name", width: 26 },
      { header: "Team", key: "team", width: 20 },
      { header: "Register No", key: "regNo", width: 16 },
      { header: "Course", key: "course", width: 14 },
      { header: "Department", key: "department", width: 26 },
      { header: "Year", key: "year", width: 10 },
      { header: "College", key: "college", width: 40 },
      { header: "Phone (registrant)", key: "phone", width: 16 },
      { header: "Registration Code", key: "code", width: 16 },
    ];
    const rowsOf = ({ places }) =>
      places.flatMap((p) =>
        p.people.map((person) => ({
          place: PLACE[p.position] || `${p.position}th`,
          name: person.name,
          team: p.registration.teamName || "",
          regNo: person.regNo,
          course: person.course,
          department: person.department,
          year: person.yearOfStudy,
          college: person.college || p.registration.collegeName || p.registration.user.collegeName || "",
          phone: p.registration.user.phone || "",
          code: p.registration.registrationCode,
        }))
      );
    const used = new Set();
    const sheetName = (name) => {
      let base = name.replace(/[[\]:*?/\\]/g, " ").trim().slice(0, 31) || "Event";
      let n = base, i = 2;
      while (used.has(n.toLowerCase())) n = `${base.slice(0, 27)} (${i++})`;
      used.add(n.toLowerCase());
      return n;
    };
    if (!req.query.eventId) {
      const all = workbook.addWorksheet(sheetName("All winners"));
      all.columns = [{ header: "Event", key: "event", width: 24 }, ...columns];
      for (const entry of list) all.addRows(rowsOf(entry).map((r) => ({ event: entry.event.name, ...r })));
      all.getRow(1).font = { bold: true };
    }
    for (const entry of list) {
      const sheet = workbook.addWorksheet(sheetName(entry.event.name));
      sheet.columns = columns;
      sheet.addRows(rowsOf(entry));
      sheet.getRow(1).font = { bold: true };
    }
    if (!list.length) workbook.addWorksheet("No results yet").addRow(["No event has locked results yet."]);

    const one = req.query.eventId && list[0] ? `-${list[0].event.name.replace(/[^A-Za-z0-9]+/g, "-")}` : "";
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Techastra26-Winners${one}.xlsx"`);
    res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (err) {
    console.error("Winners Excel error:", err);
    res.status(500).json({ error: "Failed to export the winners" });
  }
});

/**
 * GET /api/certificates/winners-list.pdf - the winners list for the
 * valedictory as a printable PDF: every event, with place, team, name (with
 * Mr/Ms), course, department, year and college of each person.
 */
router.get("/winners-list.pdf", ...committee, async (req, res) => {
  try {
    const list = await winnersByEvent();
    const pdf = await winnersListPdf(list, { nameOf: (person) => `${person.title ? `${person.title}. ` : ""}${person.name}` });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Techastra26-Winners-List.pdf"');
    res.send(pdf);
  } catch (err) {
    console.error("Winners list PDF error:", err);
    res.status(500).json({ error: "Failed to make the winners list" });
  }
});

/** One PDF of the given certificates, one page each, in order. */
async function mergeCertificates(certs) {
  const merged = await PDFDocument.create();
  for (const c of certs) {
    const doc = await PDFDocument.load(fs.readFileSync(certificateFile(c.pdfUrl)));
    for (const page of await merged.copyPages(doc, doc.getPageIndices())) merged.addPage(page);
  }
  return Buffer.from(await merged.save());
}

/**
 * GET /api/certificates/winners.pdf - every event's winner certificates in
 * one PDF (events by day and time, then 1st, 2nd, 3rd), to print them all.
 */
router.get("/winners.pdf", ...committee, async (req, res) => {
  try {
    const certs = [];
    for (const { event } of await winnersByEvent()) certs.push(...(await winnerCertificates(event)));
    if (!certs.length) return res.status(409).json({ error: "No event has locked results yet." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", 'attachment; filename="Techastra26-Winners-All-Events.pdf"');
    res.send(await mergeCertificates(certs));
  } catch (err) {
    console.error("All winner certificates error:", err);
    res.status(500).json({ error: "Failed to make the winner certificates" });
  }
});

/**
 * GET /api/certificates/winners/:eventId/pdf - every winner certificate of
 * the event (one page per person), to print the hard copies.
 */
router.get("/winners/:eventId/pdf", ...committee, async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.eventId } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    if (event.level === "junior") return res.status(409).json({ error: "Junior Techastra events have no certificates." });
    const certs = await winnerCertificates(event);
    if (!certs.length) return res.status(409).json({ error: "This event's results aren't locked yet." });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="Techastra26-Winners-${event.name.replace(/[^A-Za-z0-9]+/g, "-")}.pdf"`);
    res.send(await mergeCertificates(certs));
  } catch (err) {
    console.error("Winner certificates error:", err);
    res.status(500).json({ error: "Failed to make the winner certificates" });
  }
});

/** GET /api/certificates - all issued certificates (committee). */
router.get("/", ...committee, async (req, res) => {
  try {
    const certificates = await prisma.certificate.findMany({ orderBy: { issuedAt: "desc" } });
    res.json({ certificates });
  } catch (err) {
    console.error("List certificates error:", err);
    res.status(500).json({ error: "Failed to load certificates" });
  }
});

/**
 * GET /api/certificates/mine - the participant's participation certificates
 * (their own and their team's). Winner certificates are given in print only.
 */
router.get("/mine", requireAuth, requireRole("participant"), async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({ where: { userId: req.user.id } });
    if (!registration) return res.json({ certificates: [] });
    const certificates = await prisma.certificate.findMany({
      where: { registrationId: registration.id, type: "participation" },
      orderBy: [{ issuedAt: "asc" }, { memberIndex: "asc" }],
      select: { id: true, certificateCode: true, eventId: true, type: true, memberIndex: true, recipientName: true, issuedAt: true },
    });
    res.json({ certificates });
  } catch (err) {
    console.error("My certificates error:", err);
    res.status(500).json({ error: "Failed to load certificates" });
  }
});

/**
 * PUT /api/certificates/mine/titles { titles: ["Mr", "Ms", ...] } - Mr or Ms
 * for each person on the registration's certificates, in team-list order
 * (the lead sets the whole team's). Certificates already made are made again
 * with the new names.
 */
router.put("/mine/titles", requireAuth, requireRole("participant"), async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({ where: { userId: req.user.id }, include: { user: true } });
    if (!registration) return res.status(404).json({ error: "No registration found for this account" });
    if (registration.status === "rejected") return res.status(409).json({ error: "This registration was rejected." });
    const titles = req.body?.titles;
    const count = peopleOf(registration).length;
    if (!Array.isArray(titles) || titles.length !== count || titles.some((t) => !TITLES.includes(t))) {
      return res.status(400).json({ error: count > 1 ? "Choose Mr or Ms for every team member." : "Choose Mr or Ms." });
    }
    const updated = await prisma.registration.update({ where: { id: registration.id }, data: { memberTitles: titles }, include: { user: true } });
    await refreshCertificates(updated);
    res.json({ memberTitles: updated.memberTitles, names: peopleOf(updated).map(certificateName) });
  } catch (err) {
    console.error("Certificate titles error:", err);
    res.status(500).json({ error: "Couldn't save Mr / Ms" });
  }
});

/**
 * GET /api/certificates/:code/pdf - one certificate's PDF. The committee can
 * download any; a participant only their own registration's participation
 * certificates. (The files are never served publicly.)
 */
router.get("/:code/pdf", requireAuth, async (req, res) => {
  try {
    const cert = await prisma.certificate.findUnique({ where: { certificateCode: String(req.params.code) } });
    if (!cert?.pdfUrl) return res.status(404).json({ error: "Certificate not found" });
    const staff = ["certificate_team", "master_admin"].includes(req.user.role);
    if (!staff) {
      const own = req.user.role === "participant" && (await prisma.registration.findUnique({ where: { userId: req.user.id } }));
      if (!own || own.id !== cert.registrationId || cert.type !== "participation") {
        return res.status(404).json({ error: "Certificate not found" });
      }
    }
    const file = certificateFile(cert.pdfUrl);
    if (!fs.existsSync(file)) return res.status(404).json({ error: "Certificate file is missing" });
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="${cert.certificateCode}.pdf"`);
    res.setHeader("Cache-Control", "private, no-store");
    fs.createReadStream(file).pipe(res);
  } catch (err) {
    console.error("Certificate PDF error:", err);
    res.status(500).json({ error: "Failed to load the certificate" });
  }
});

/** GET /api/certificates/verify/:code - public certificate verification. */
router.get("/verify/:code", async (req, res) => {
  try {
    const certificate = await prisma.certificate.findUnique({ where: { certificateCode: String(req.params.code).trim().toUpperCase() } });
    if (!certificate) return res.json({ valid: false });

    const [registration, event] = await Promise.all([
      prisma.registration.findUnique({ where: { id: certificate.registrationId }, include: { user: true } }),
      prisma.event.findUnique({ where: { id: certificate.eventId } }),
    ]);

    res.json({
      valid: true,
      certificateCode: certificate.certificateCode,
      type: certificate.type,
      participantName: certificate.recipientName || registration?.user?.name,
      college: registration?.collegeName,
      eventName: event?.name,
      issuedAt: certificate.issuedAt,
    });
  } catch (err) {
    console.error("Verify certificate error:", err);
    res.status(500).json({ error: "Verification failed" });
  }
});

module.exports = router;
