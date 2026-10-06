const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { scanLimiter } = require("../middleware/rateLimiter");
const { logSuspiciousActivity, logSecurityEvent } = require("../middleware/securityLogger");
const { validateQRScanData } = require("../middleware/inputValidation");
const { participantDetails } = require("../utils/participantDetails");
const { juniorRoster } = require("../utils/juniorRoster");
const { checkinNotOpen } = require("../utils/checkinWindow");

// Junior Techastra has no ID cards, so its events have no check-in.
async function isJuniorEvent(eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { level: true } });
  return event?.level === "junior";
}
const NO_JUNIOR_CHECKIN = "Junior Techastra events don't use check-in.";

/**
 * Why this event can't take check-ins right now (junior event, or before the
 * check-in window opens an hour before it starts), or null when it can.
 */
async function checkinBlocked(eventId) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { name: true, level: true, startTime: true } });
  if (!event) return null; // the lookups below report a missing registration/event
  if (event.level === "junior") return NO_JUNIOR_CHECKIN;
  return checkinNotOpen(event);
}

const router = express.Router();

/**
 * Attendance is one row per registration, so one scan of the lead's ID card
 * checks in the whole team. Who that covers: the team (or the participant)
 * as a label for messages, and every member's name (lead first).
 */
function teamOf(registration) {
  const members = Array.isArray(registration.teamMembers)
    ? registration.teamMembers.filter((m) => m && m.name).map((m) => ({ name: m.name, role: m.role === "lead" ? "lead" : "member" }))
    : [];
  if (!members.length) members.push({ name: registration.user.name, role: "lead" });
  const who = members.length > 1 ? registration.teamName || `${registration.user.name}'s team` : registration.user.name;
  const label = members.length > 1 ? `${who} (all ${members.length} members)` : who;
  return { name: registration.teamName || null, who, label, members };
}

/**
 * POST /api/attendance/scan
 * Coordinator scans a participant's registration QR (registrationCode) at
 * their assigned event. Blocks duplicate check-ins for the same event.
 * Rate limited: 30 scans per minute per coordinator to prevent abuse.
 */
router.post(
  "/scan",
  requireAuth,
  requireRole("coordinator", "master_admin"),
  validateQRScanData,
  scanLimiter,
  async (req, res) => {
  try {
    const { registrationCode, eventId } = req.body;
    
    // Input is already validated by validateQRScanData middleware

    // Coordinators may only scan for their assigned event (admin can scan for any).
    if (req.user.role === "coordinator" && req.user.assignedEventId !== eventId) {
      logSuspiciousActivity(req, "coordinator_scanning_wrong_event", {
        coordinatorId: req.user.id,
        assignedEventId: req.user.assignedEventId,
        attemptedEventId: eventId,
      });
      return res.status(403).json({ error: "You are not assigned to this event" });
    }
    const blocked = await checkinBlocked(eventId);
    if (blocked) return res.status(409).json({ error: blocked, outcome: "not_open" });

    const registration = await prisma.registration.findUnique({
      where: { registrationCode },
      include: { user: true },
    });

    if (!registration) {
      return res.status(404).json({ error: "No registration found for this QR code" });
    }
    // The coordinator sees the participant's full details whatever the
    // outcome (checked in, already in, wrong event, not approved).
    if (registration.status !== "approved") {
      return res.status(409).json({ error: "This registration is not approved", outcome: "not_approved", details: await participantDetails(registration) });
    }
    if (!registration.eventIds.includes(eventId)) {
      return res.status(409).json({
        error: `${teamOf(registration).who} is not registered for this event`,
        outcome: "wrong_event",
        details: await participantDetails(registration),
      });
    }

    const existing = await prisma.attendance.findUnique({
      where: { registrationId_eventId: { registrationId: registration.id, eventId } },
    });
    if (existing) {
      return res.status(409).json({
        error: `${teamOf(registration).label} already checked in`,
        alreadyScanned: true,
        scannedAt: existing.scannedAt,
        outcome: "already",
        team: teamOf(registration),
        details: await participantDetails(registration),
      });
    }

    let attendance;
    try {
      attendance = await prisma.attendance.create({
        data: { registrationId: registration.id, eventId, scannedBy: req.user.id },
      });
    } catch (err) {
      // Scanned twice at once: the unique index lets only one check-in through.
      if (err.code !== "P2002") throw err;
      return res.status(409).json({
        error: `${teamOf(registration).label} already checked in`,
        alreadyScanned: true,
        outcome: "already",
        team: teamOf(registration),
        details: await participantDetails(registration),
      });
    }

    logSecurityEvent("participant_details_viewed", { userId: req.user.id, registrationCode, via: "attendance_scan" });
    res.status(201).json({
      attendance,
      outcome: "checked_in",
      participant: { name: registration.user.name, college: registration.collegeName, code: registration.registrationCode },
      team: teamOf(registration),
      details: await participantDetails(registration),
    });
  } catch (err) {
    console.error("Attendance scan error:", err);
    res.status(500).json({ error: "Failed to record attendance" });
  }
});

/** GET /api/attendance/event/:eventId - present/absent roster for coordinators. */
router.get(
  "/event/:eventId",
  requireAuth,
  requireRole("coordinator", "master_admin"),
  async (req, res) => {
    try {
      const { eventId } = req.params;
      if (req.user.role === "coordinator" && req.user.assignedEventId !== eventId) {
        return res.status(403).json({ error: "You are not assigned to this event" });
      }
      // Junior events: the students the Junior coordinator imported (no check-in).
      if (await isJuniorEvent(eventId)) {
        const roster = await juniorRoster(eventId);
        const total = roster.reduce((n, r) => n + r.members.length, 0);
        return res.json({ roster, junior: true, presentCount: 0, totalCount: roster.length, presentPeople: 0, totalPeople: total });
      }

      const registrations = await prisma.registration.findMany({
        where: { status: "approved", eventIds: { has: eventId } },
        include: { user: true },
      });

      const attendanceRecords = await prisma.attendance.findMany({ where: { eventId } });
      const attendedIds = new Set(attendanceRecords.map((a) => a.registrationId));

      const roster = registrations.map((r) => ({
        registrationId: r.id,
        registrationCode: r.registrationCode,
        name: r.user.name,
        college: r.collegeName,
        teamName: r.teamName,
        // Everyone on the registration (lead first): checked in together.
        members: teamOf(r).members,
        choice: r.eventChoices?.[eventId] || null,
        present: attendedIds.has(r.id),
      }));
      const people = (rows) => rows.reduce((n, r) => n + r.members.length, 0);

      res.json({
        roster,
        presentCount: roster.filter((r) => r.present).length,
        totalCount: registrations.length,
        presentPeople: people(roster.filter((r) => r.present)),
        totalPeople: people(roster),
      });
    } catch (err) {
      console.error("Roster error:", err);
      res.status(500).json({ error: "Failed to load roster" });
    }
  }
);

/** POST /api/attendance/manual - manual search fallback check-in (no camera). */
router.post("/manual", requireAuth, requireRole("coordinator", "master_admin"), async (req, res) => {
  try {
    const { registrationId, eventId } = req.body || {};
    if (typeof registrationId !== "string" || typeof eventId !== "string" || !registrationId || !eventId) {
      return res.status(400).json({ error: "registrationId and eventId are required" });
    }
    if (req.user.role === "coordinator" && req.user.assignedEventId !== eventId) {
      return res.status(403).json({ error: "You are not assigned to this event" });
    }
    const blocked = await checkinBlocked(eventId);
    if (blocked) return res.status(409).json({ error: blocked, outcome: "not_open" });

    // Same checks as a QR scan: the registration must exist, be approved and
    // include this event.
    const registration = await prisma.registration.findUnique({ where: { id: registrationId }, include: { user: true } });
    if (!registration) {
      return res.status(404).json({ error: "No registration found" });
    }
    if (registration.status !== "approved") {
      return res.status(409).json({ error: "This registration is not approved" });
    }
    if (!registration.eventIds.includes(eventId)) {
      return res.status(409).json({ error: `${teamOf(registration).who} is not registered for this event` });
    }

    const existing = await prisma.attendance.findUnique({
      where: { registrationId_eventId: { registrationId, eventId } },
    });
    if (existing) {
      return res.status(409).json({ error: `${teamOf(registration).label} already checked in`, alreadyScanned: true, scannedAt: existing.scannedAt });
    }

    const attendance = await prisma.attendance.create({
      data: { registrationId, eventId, scannedBy: req.user.id },
    });
    res.status(201).json({
      attendance,
      participant: { name: registration.user.name, college: registration.collegeName, code: registration.registrationCode },
      team: teamOf(registration),
    });
  } catch (err) {
    console.error("Manual check-in error:", err);
    res.status(500).json({ error: "Failed to check in participant" });
  }
});

module.exports = router;
