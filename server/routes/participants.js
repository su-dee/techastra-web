const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { logSecurityEvent, logSuspiciousActivity } = require("../middleware/securityLogger");
const { participantDetails } = require("../utils/participantDetails");

/**
 * Participants' full details for staff (utils/participantDetails.js):
 *  - registration team and master admin: anyone who has registered, any status;
 *  - event coordinators: only participants checked in at their own event.
 */
const router = express.Router();
router.use(requireAuth);

/** GET /api/participants/checked-in?eventId= - everyone checked in at an event, with full details. */
router.get("/checked-in", requireRole("coordinator", "master_admin"), async (req, res) => {
  try {
    const eventId = req.user.role === "coordinator" ? req.user.assignedEventId : String(req.query.eventId || "");
    if (!eventId) return res.status(400).json({ error: "No event selected" });
    if (req.user.role === "coordinator" && req.query.eventId && req.query.eventId !== eventId) {
      return res.status(403).json({ error: "You are not assigned to this event" });
    }
    const attendance = await prisma.attendance.findMany({ where: { eventId }, orderBy: { scannedAt: "desc" } });
    const participants = [];
    for (const a of attendance) {
      const details = await participantDetails({ id: a.registrationId });
      if (details) participants.push({ checkedInAt: a.scannedAt, details });
    }
    logSecurityEvent("participant_details_viewed", { userId: req.user.id, eventId, count: participants.length, via: "checked_in_list" });
    res.json({ participants });
  } catch (err) {
    console.error("Checked-in list error:", err);
    res.status(500).json({ error: "Failed to load checked-in participants" });
  }
});

/** GET /api/participants/:registrationId - one participant's full details. */
router.get("/:registrationId", requireRole("registration_team", "master_admin", "coordinator"), async (req, res) => {
  try {
    const registrationId = String(req.params.registrationId || "");
    if (req.user.role === "coordinator") {
      const checkedIn = req.user.assignedEventId
        ? await prisma.attendance.findUnique({ where: { registrationId_eventId: { registrationId, eventId: req.user.assignedEventId } } })
        : null;
      if (!checkedIn) {
        logSuspiciousActivity(req, "coordinator_details_not_checked_in", { coordinatorId: req.user.id, registrationId });
        return res.status(403).json({ error: "You can see details only for participants checked in at your event" });
      }
    }
    const details = await participantDetails({ id: registrationId });
    if (!details) return res.status(404).json({ error: "Registration not found" });
    logSecurityEvent("participant_details_viewed", { userId: req.user.id, registrationCode: details.registrationCode, via: "details_view" });
    res.json({ details });
  } catch (err) {
    console.error("Participant details error:", err);
    res.status(500).json({ error: "Failed to load participant details" });
  }
});

module.exports = router;
