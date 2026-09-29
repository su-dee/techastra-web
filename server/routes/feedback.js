const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/**
 * POST /api/feedback - a signed-in participant rates an event they're
 * registered for (approved registrations only). The author is always the
 * logged-in account - never a userId from the request. One feedback per
 * person per event; sending again updates it.
 */
router.post("/", requireAuth, requireRole("participant"), async (req, res) => {
  try {
    const eventId = typeof req.body?.eventId === "string" ? req.body.eventId : "";
    const rating = Number(req.body?.rating);
    const comments = typeof req.body?.comments === "string" ? req.body.comments.trim().slice(0, 1000) : "";
    if (!eventId || !Number.isInteger(rating) || rating < 1 || rating > 5) {
      return res.status(400).json({ error: "Choose an event and a rating from 1 to 5" });
    }

    const registration = await prisma.registration.findFirst({
      where: { userId: req.user.id, status: "approved", eventIds: { has: eventId } },
      select: { id: true },
    });
    if (!registration) {
      return res.status(403).json({ error: "You can only give feedback on events you're registered for" });
    }

    const data = { eventId, userId: req.user.id, rating, comments: comments || null };
    const existing = await prisma.feedback.findFirst({ where: { eventId, userId: req.user.id } });
    const feedback = existing
      ? await prisma.feedback.update({ where: { id: existing.id }, data })
      : await prisma.feedback.create({ data });
    res.status(existing ? 200 : 201).json({ feedback });
  } catch (err) {
    console.error("Submit feedback error:", err);
    res.status(500).json({ error: "Failed to submit feedback" });
  }
});

/** GET /api/feedback/:eventId - admin view of feedback for an event. */
router.get("/:eventId", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const feedback = await prisma.feedback.findMany({ where: { eventId: req.params.eventId } });
    res.json({ feedback });
  } catch (err) {
    console.error("List feedback error:", err);
    res.status(500).json({ error: "Failed to load feedback" });
  }
});

module.exports = router;
