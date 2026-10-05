/**
 * Junior Techastra registration: the overall Junior coordinator imports the
 * schools' students from an Excel or CSV file (see utils/juniorImport.js).
 * Junior students have no account, ID card, QR check-in or certificate.
 */
const express = require("express");
const multer = require("multer");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { apiLimiter, exportLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../middleware/securityLogger");
const { readRows, validateRows } = require("../utils/juniorImport");
const { toCsv } = require("../utils/csv");

const router = express.Router();
const staff = [requireAuth, requireRole("junior_coordinator", "master_admin")];

// Kept in memory only: the file is parsed and dropped, never saved to disk.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024, files: 1 } });
function singleFile(req, res, next) {
  upload.single("file")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.code === "LIMIT_FILE_SIZE" ? "The file is too big (2 MB at most)." : "Couldn't read the upload." });
    next();
  });
}

const juniorEvents = () =>
  prisma.event.findMany({
    where: { level: "junior" },
    orderBy: [{ startTime: "asc" }, { name: "asc" }],
    select: { id: true, name: true, category: true, isTeamEvent: true, minTeamSize: true, maxTeamSize: true, startTime: true, venue: true },
  });

/** GET /api/junior/events - the junior events with how many students each has. */
router.get("/events", ...staff, async (req, res) => {
  try {
    const [events, counts] = await Promise.all([
      juniorEvents(),
      prisma.juniorParticipant.groupBy({ by: ["eventId"], _count: { _all: true } }),
    ]);
    const countOf = new Map(counts.map((c) => [c.eventId, c._count._all]));
    res.json({ events: events.map((e) => ({ ...e, students: countOf.get(e.id) || 0 })) });
  } catch (err) {
    console.error("Junior events error:", err);
    res.status(500).json({ error: "Failed to load the junior events" });
  }
});

/** Next free code number: JR2026-0001, JR2026-0002, ... */
async function nextCodeNumber(tx, prefix) {
  const last = await tx.juniorParticipant.findFirst({ where: { code: { startsWith: prefix } }, orderBy: { code: "desc" }, select: { code: true } });
  return last ? Number(last.code.slice(prefix.length)) + 1 : 1;
}

/**
 * POST /api/junior/import (multipart "file") - ?dryRun=1 only checks the file
 * and returns every entry with its problem, if any. Without dryRun the valid
 * entries are saved and the rest are skipped (and listed).
 */
router.post("/import", ...staff, apiLimiter, singleFile, async (req, res) => {
  if (!req.file) return res.status(400).json({ error: "Choose an Excel or CSV file to import." });
  const dryRun = req.query.dryRun === "1" || req.query.dryRun === "true";
  try {
    let rows;
    try {
      rows = await readRows(req.file.buffer, req.file.originalname);
    } catch (err) {
      return res.status(400).json({ error: err.message });
    }
    const [events, existing] = await Promise.all([
      juniorEvents(),
      prisma.juniorParticipant.findMany({ select: { eventId: true, name: true, school: true, className: true, teamName: true } }),
    ]);
    const checked = validateRows(rows, events, existing);
    if (checked.error) return res.status(400).json({ error: checked.error });
    const { entries } = checked;
    const valid = entries.filter((e) => !e.error);
    const summary = { total: entries.length, valid: valid.length, errors: entries.length - valid.length };
    if (dryRun || !valid.length) return res.json({ dryRun: true, summary, entries });

    const prefix = `JR${new Date().getFullYear()}-`;
    const imported = await prisma.$transaction(async (tx) => {
      let n = await nextCodeNumber(tx, prefix);
      const data = valid.map((e) => ({
        code: `${prefix}${String(n++).padStart(4, "0")}`,
        eventId: e.eventId,
        name: e.name,
        school: e.school,
        className: e.className,
        teamName: e.teamName || null,
        importedById: req.user.id,
        importedByName: req.user.name,
      }));
      await tx.juniorParticipant.createMany({ data });
      return data.length;
    });
    logSecurityEvent("junior_import", req.user.id, { file: req.file.originalname, imported, skipped: summary.errors }, req);
    res.status(201).json({ dryRun: false, imported, summary, entries });
  } catch (err) {
    console.error("Junior import error:", err);
    res.status(500).json({ error: "Import failed. Nothing was saved - try again." });
  }
});

const withEventName = async (students) => {
  const events = new Map((await juniorEvents()).map((e) => [e.id, e.name]));
  return students.map((s) => ({ ...s, eventName: events.get(s.eventId) || "Unknown event" }));
};

/** GET /api/junior/participants?eventId= - imported students, newest first. */
router.get("/participants", ...staff, async (req, res) => {
  try {
    const where = req.query.eventId ? { eventId: String(req.query.eventId) } : {};
    const students = await prisma.juniorParticipant.findMany({ where, orderBy: [{ createdAt: "desc" }, { code: "desc" }] });
    res.json({ participants: await withEventName(students) });
  } catch (err) {
    console.error("Junior list error:", err);
    res.status(500).json({ error: "Failed to load the junior students" });
  }
});

/** DELETE /api/junior/participants/:id - remove a wrongly imported entry. */
router.delete("/participants/:id", ...staff, apiLimiter, async (req, res) => {
  try {
    const student = await prisma.juniorParticipant.findUnique({ where: { id: req.params.id } });
    if (!student) return res.status(404).json({ error: "Not found - it may already be deleted." });
    if (await prisma.result.findFirst({ where: { registrationId: student.id } })) {
      return res.status(409).json({ error: "This student is a locked winner. Ask the admin to change the results first." });
    }
    await prisma.juniorParticipant.delete({ where: { id: student.id } });
    logSecurityEvent("junior_delete", req.user.id, { code: student.code, eventId: student.eventId }, req);
    res.json({ ok: true });
  } catch (err) {
    console.error("Junior delete error:", err);
    res.status(500).json({ error: "Failed to delete" });
  }
});

/** GET /api/junior/export - every imported student as CSV. */
router.get("/export", ...staff, exportLimiter, async (req, res) => {
  try {
    // Imported text is user-supplied: stop a cell like =HYPERLINK(...) from
    // running as a formula when the export is opened in Excel.
    const safe = (v) => (typeof v === "string" && /^[=+\-@\t\r]/.test(v) ? `'${v}` : v);
    const students = (
      await withEventName(
        await prisma.juniorParticipant.findMany({ orderBy: [{ eventId: "asc" }, { school: "asc" }, { teamName: "asc" }, { name: "asc" }] })
      )
    ).map((s) => Object.fromEntries(Object.entries(s).map(([k, v]) => [k, safe(v)])));
    const csv = toCsv(students, [
      { label: "Code", value: "code" },
      { label: "Event", value: "eventName" },
      { label: "Student name", value: "name" },
      { label: "School", value: "school" },
      { label: "Class", value: "className" },
      { label: "Team name", value: "teamName" },
      { label: "Imported by", value: "importedByName" },
      { label: "Imported at", value: (s) => s.createdAt.toISOString() },
    ]);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", 'attachment; filename="junior-techastra-students.csv"');
    res.send("﻿" + csv);
  } catch (err) {
    console.error("Junior export error:", err);
    res.status(500).json({ error: "Export failed" });
  }
});

module.exports = router;
