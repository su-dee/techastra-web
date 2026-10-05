const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { broadcastResult } = require("../socket");
const { apiLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent, logIDORAttempt } = require("../middleware/securityLogger");
const { juniorRoster, juniorWinners } = require("../utils/juniorRoster");

/**
 * Junior events: every winner must be one of the event's imported teams or
 * students (the roster's ids). Returns an error message, or null.
 */
async function checkJuniorWinners(eventId, winners) {
  const event = await prisma.event.findUnique({ where: { id: eventId }, select: { level: true } });
  if (event?.level !== "junior") return null;
  const ids = new Set((await juniorRoster(eventId)).map((r) => r.registrationId));
  return winners.every((w) => ids.has(w.registrationId)) ? null : "Pick the winners from this event's Junior students.";
}

const router = express.Router();

/** GET /api/results - public leaderboard data, optionally filtered by event/college. */
router.get("/", async (req, res) => {
  try {
    const { eventId, college } = req.query;

    const results = await prisma.result.findMany({
      where: eventId ? { eventId } : undefined,
      orderBy: [{ eventId: "asc" }, { position: "asc" }],
    });

    const registrationIds = results.map((r) => r.registrationId);
    const registrations = await prisma.registration.findMany({
      where: { id: { in: registrationIds } },
      include: { user: true },
    });
    const regMap = new Map(registrations.map((r) => [r.id, r]));
    // Junior events' winners are imported students, not registrations.
    const juniors = await juniorWinners(registrationIds.filter((id) => !regMap.has(id)));

    const eventIds = [...new Set(results.map((r) => r.eventId))];
    const events = await prisma.event.findMany({ where: { id: { in: eventIds } } });
    const eventMap = new Map(events.map((e) => [e.id, e]));

    let enriched = results.map((r) => {
      const reg = regMap.get(r.registrationId);
      const junior = juniors.get(r.registrationId);
      return {
        id: r.id,
        eventId: r.eventId,
        eventName: eventMap.get(r.eventId)?.name || "Unknown Event",
        position: r.position,
        teamName: reg?.teamName || junior?.teamName || null,
        participantName: reg?.user?.name || junior?.name || "Unknown",
        college: reg?.collegeName || junior?.school || null,
        lockedAt: r.lockedAt,
      };
    });

    if (college) {
      enriched = enriched.filter((r) => (r.college || "").toLowerCase() === String(college).toLowerCase());
    }

    res.json({ results: enriched });
  } catch (err) {
    console.error("List results error:", err);
    res.status(500).json({ error: "Failed to load results" });
  }
});

/**
 * POST /api/results
 * Coordinator submits 1st/2nd/3rd place for their assigned event.
 * Locks immediately - resubmitting fails unless the admin override endpoint is used.
 * Body: { eventId, winners: [{ position, registrationId }, ...] }
 */
router.post("/", requireAuth, requireRole("coordinator", "master_admin"), apiLimiter, async (req, res) => {
  try {
    const { eventId, winners } = req.body;
    if (!eventId || !Array.isArray(winners) || !winners.length) {
      return res.status(400).json({ error: "eventId and a winners array are required" });
    }
    
    // IDOR Prevention: Coordinators can only submit for their assigned event
    if (req.user.role === "coordinator" && req.user.assignedEventId !== eventId) {
      logIDORAttempt(
        req.user.id,
        "eventId",
        eventId,
        req.user.assignedEventId,
        req
      );
      return res.status(403).json({ error: "You are not assigned to this event" });
    }

    const existing = await prisma.result.findMany({ where: { eventId } });
    if (existing.length > 0) {
      return res.status(409).json({ error: "Results for this event are already locked. Ask a master admin to override." });
    }
    const juniorError = await checkJuniorWinners(eventId, winners);
    if (juniorError) return res.status(400).json({ error: juniorError });

    const created = await prisma.$transaction(
      winners.map((w) =>
        prisma.result.create({
          data: {
            eventId,
            position: Number(w.position),
            registrationId: w.registrationId,
            lockedBy: req.user.id,
          },
        })
      )
    );

    // Log result submission
    logSecurityEvent(
      "result_submission",
      req.user.id,
      { eventId, winnerCount: created.length, role: req.user.role },
      req
    );

    broadcastResult({ eventId, results: created });
    res.status(201).json({ results: created });
  } catch (err) {
    console.error("Submit results error:", err);
    res.status(500).json({ error: "Failed to submit results" });
  }
});

/**
 * PATCH /api/results/override - master_admin only: edit locked results for an event.
 * Body: { eventId, winners: [{ position, registrationId }, ...] }
 */
router.patch("/override", requireAuth, requireRole("master_admin"), apiLimiter, async (req, res) => {
  try {
    const { eventId, winners } = req.body;
    if (!eventId || !Array.isArray(winners) || !winners.length) {
      return res.status(400).json({ error: "eventId and a winners array are required" });
    }
    const juniorError = await checkJuniorWinners(eventId, winners);
    if (juniorError) return res.status(400).json({ error: juniorError });

    await prisma.result.deleteMany({ where: { eventId } });

    const created = await prisma.$transaction(
      winners.map((w) =>
        prisma.result.create({
          data: {
            eventId,
            position: Number(w.position),
            registrationId: w.registrationId,
            lockedBy: req.user.id,
            overriddenBy: req.user.id,
          },
        })
      )
    );

    // Log admin override
    logSecurityEvent(
      "result_override",
      req.user.id,
      { eventId, winnerCount: created.length },
      req
    );

    broadcastResult({ eventId, results: created, overridden: true });
    res.json({ results: created });
  } catch (err) {
    console.error("Override results error:", err);
    res.status(500).json({ error: "Failed to override results" });
  }
});

module.exports = router;
