const fs = require("fs");
const prisma = require("../db");
const { generateCertificateCode } = require("./codes");
const { generateCertificatePdf, certificateFile } = require("./certificatePdf");
const { sendMail } = require("./mailer");
const { siteUrl } = require("./registrationEmails");

/**
 * Certificate rules (Techastra '26):
 * - Participation: only people checked in at the event, and never the event's
 *   winners. The committee sends them at the end of each event day
 *   (sendParticipationCertificates); each person gets their own, and a
 *   team's certificates all go to the registrant's email and dashboard.
 * - Winner: printed by the committee for the valedictory (winnerCertificates);
 *   never emailed or shown to participants.
 */

/** The people in a registration: its team list (lead first), or just the registrant. */
function peopleOf(registration) {
  const team = Array.isArray(registration.teamMembers) ? registration.teamMembers.filter((m) => m && m.name) : [];
  if (team.length) {
    return team.map((m, index) => ({
      index,
      name: m.name,
      regNo: m.regNo || "",
      department: m.department || (index === 0 ? registration.user?.department : "") || "",
      yearOfStudy: m.yearOfStudy || (index === 0 ? registration.user?.yearOfStudy : "") || "",
    }));
  }
  const u = registration.user || {};
  return [{ index: 0, name: u.name, regNo: u.registerNo || "", department: u.department || "", yearOfStudy: u.yearOfStudy || "" }];
}

/** The person's certificate for this event and type, made (code + PDF) if it doesn't exist yet. */
async function ensureCertificate({ registration, event, type, person, position = null }) {
  const key = { registrationId: registration.id, eventId: event.id, type, memberIndex: person.index };
  const existing = await prisma.certificate.findUnique({ where: { registrationId_eventId_type_memberIndex: key } });
  if (existing) return existing;
  const certificateCode = await generateCertificateCode(prisma);
  const pdfUrl = await generateCertificatePdf({
    certificateCode,
    participantName: person.name,
    eventName: event.name,
    type,
    position,
    collegeName: registration.collegeName || registration.user?.collegeName,
  });
  try {
    return await prisma.certificate.create({ data: { ...key, certificateCode, recipientName: person.name, pdfUrl } });
  } catch (err) {
    // Made at the same moment by another request: use that one.
    if (err.code === "P2002") return prisma.certificate.findUnique({ where: { registrationId_eventId_type_memberIndex: key } });
    throw err;
  }
}

/**
 * What sending a day's participation certificates would do, per event: an
 * event is ready once it has ended and its results are locked (so winners
 * are known and left out). Eligible = approved and checked in, not a winner.
 */
async function participationPlan(day, now = new Date()) {
  const events = await prisma.event.findMany({
    // Junior Techastra gets no certificates.
    where: { day: Number(day), externalRegistration: false, level: "senior" },
    orderBy: { startTime: "asc" },
  });
  const ids = events.map((e) => e.id);
  const [attendance, results, certs] = await Promise.all([
    prisma.attendance.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, registrationId: true } }),
    prisma.result.findMany({ where: { eventId: { in: ids } }, select: { eventId: true, registrationId: true } }),
    prisma.certificate.findMany({
      where: { eventId: { in: ids }, type: "participation" },
      select: { eventId: true, registrationId: true, emailedAt: true },
    }),
  ]);
  const regIds = [...new Set(attendance.map((a) => a.registrationId))];
  const regs = await prisma.registration.findMany({
    where: { id: { in: regIds }, status: "approved" },
    include: { user: true },
  });
  const regById = new Map(regs.map((r) => [r.id, r]));

  return events.map((event) => {
    const winners = new Set(results.filter((r) => r.eventId === event.id).map((r) => r.registrationId));
    const checkedIn = attendance.filter((a) => a.eventId === event.id).map((a) => regById.get(a.registrationId)).filter(Boolean);
    const eligible = checkedIn.filter((r) => !winners.has(r.id));
    const emailed = new Set(certs.filter((c) => c.eventId === event.id && c.emailedAt).map((c) => c.registrationId));
    const ended = new Date(event.endTime) <= now;
    const resultsLocked = winners.size > 0;
    return {
      event,
      status: !ended ? "not_ended" : !resultsLocked ? "no_results" : "ready",
      checkedIn: checkedIn.length,
      winners: winners.size,
      eligible,
      people: eligible.reduce((n, r) => n + peopleOf(r).length, 0),
      alreadySent: eligible.filter((r) => emailed.has(r.id)).length,
    };
  });
}

// One send at a time (single server process); the portal polls its progress.
let job = null;

function certificateEmail(registration, certs, events) {
  const user = registration.user;
  const byEvent = new Map();
  for (const c of certs) {
    const name = events.get(c.eventId)?.name || "Event";
    if (!byEvent.has(name)) byEvent.set(name, []);
    byEvent.get(name).push(c.recipientName);
  }
  const site = siteUrl();
  const lines = [
    `Hi ${user.name},`,
    "",
    "Thank you for taking part in Techastra '26. Your participation certificates are attached:",
    "",
    ...[...byEvent].map(([event, names]) => `- ${event}: ${names.join(", ")}`),
    "",
    ...(certs.length > 1 && certs.some((c) => c.memberIndex > 0)
      ? ["Your team members' certificates are attached too - please forward them.", ""]
      : []),
    site ? `You can also download them any time from your dashboard: ${site}/dashboard` : "You can also download them any time from your dashboard.",
    "Each certificate can be verified on our website with the certificate ID printed on it.",
    "",
    "Techastra '26",
  ];
  return { subject: "Your Techastra '26 participation certificates", text: lines.join("\n") };
}

/**
 * Makes and emails the participation certificates for a day's ready events.
 * Runs in the background (it can take minutes); progress is in sendStatus().
 * Re-running is safe: certificates are made once and each registration is
 * emailed only the certificates it hasn't been sent yet.
 */
function sendParticipationCertificates(day, startedBy) {
  if (job && job.state === "running") return { error: "Certificates are already being sent - wait for that to finish." };
  job = { state: "running", day: Number(day), startedBy, startedAt: new Date(), total: 0, done: 0, emails: 0, failed: [], skipped: [], certificates: 0 };
  const current = job;
  (async () => {
    try {
      const plan = await participationPlan(day);
      current.skipped = plan.filter((p) => p.status !== "ready").map((p) => ({ event: p.event.name, reason: p.status }));
      const ready = plan.filter((p) => p.status === "ready");
      const events = new Map(ready.map((p) => [p.event.id, p.event]));
      // Make every certificate first, grouped by registration.
      const byReg = new Map();
      for (const p of ready) for (const reg of p.eligible) {
        if (!byReg.has(reg.id)) byReg.set(reg.id, { reg, events: [] });
        byReg.get(reg.id).events.push(p.event);
      }
      current.total = byReg.size;
      for (const { reg, events: regEvents } of byReg.values()) {
        const certs = [];
        for (const event of regEvents) {
          for (const person of peopleOf(reg)) {
            certs.push(await ensureCertificate({ registration: reg, event, type: "participation", person }));
          }
        }
        current.certificates += certs.length;
        const unsent = certs.filter((c) => !c.emailedAt);
        if (unsent.length) {
          const { subject, text } = certificateEmail(reg, unsent, events);
          const attachments = unsent.map((c) => ({
            filename: `Techastra26-${(events.get(c.eventId)?.name || "Event").replace(/[^A-Za-z0-9]+/g, "-")}-${c.recipientName.replace(/[^A-Za-z0-9]+/g, "-")}.pdf`,
            content: fs.readFileSync(certificateFile(c.pdfUrl)),
            contentType: "application/pdf",
          }));
          const result = await sendMail({ to: reg.user.email, subject, text, attachments });
          if (result.sent || result.mocked) {
            await prisma.certificate.updateMany({ where: { id: { in: unsent.map((c) => c.id) } }, data: { emailedAt: new Date() } });
            current.emails++;
          } else {
            current.failed.push({ registrationCode: reg.registrationCode, email: reg.user.email });
          }
        }
        current.done++;
      }
      current.state = "done";
    } catch (err) {
      console.error("Sending participation certificates failed:", err);
      current.state = "error";
      current.error = err.message;
    }
    current.finishedAt = new Date();
  })();
  return { job: current };
}

const sendStatus = () => job;

/**
 * Winner certificates for an event, one per person in each placed
 * registration (made if needed), in finishing order - for printing.
 */
async function winnerCertificates(event) {
  const results = await prisma.result.findMany({ where: { eventId: event.id }, orderBy: { position: "asc" } });
  const regs = await prisma.registration.findMany({ where: { id: { in: results.map((r) => r.registrationId) } }, include: { user: true } });
  const regById = new Map(regs.map((r) => [r.id, r]));
  const out = [];
  for (const result of results) {
    const reg = regById.get(result.registrationId);
    if (!reg) continue;
    for (const person of peopleOf(reg)) {
      out.push(await ensureCertificate({ registration: reg, event, type: "winner", person, position: result.position }));
    }
  }
  return out;
}

module.exports = { peopleOf, ensureCertificate, participationPlan, sendParticipationCertificates, sendStatus, winnerCertificates };
