const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");

const router = express.Router();

/** GET /api/events - public list of all events (for the Events page timetable). */
router.get("/", async (req, res) => {
  try {
    const events = await prisma.event.findMany({ orderBy: { startTime: "asc" } });
    const withAvailability = events.map((e) => ({
      ...e,
      seatsAvailable: Math.max(e.maxSeats - e.seatsTaken, 0),
    }));
    res.json({ events: withAvailability });
  } catch (err) {
    console.error("List events error:", err);
    res.status(500).json({ error: "Failed to load events" });
  }
});

/** GET /api/events/:id - single event detail (incl. rulebook). */
router.get("/:id", async (req, res) => {
  try {
    const event = await prisma.event.findUnique({ where: { id: req.params.id } });
    if (!event) return res.status(404).json({ error: "Event not found" });
    res.json({ event: { ...event, seatsAvailable: Math.max(event.maxSeats - event.seatsTaken, 0) } });
  } catch (err) {
    console.error("Get event error:", err);
    res.status(500).json({ error: "Failed to load event" });
  }
});

/** POST /api/events - master_admin only: create an event. */
router.post("/", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const {
      name, description, track, category, level, startTime, endTime, fee, maxSeats,
      isTeamEvent, minTeamSize, maxTeamSize, rulebook, venue,
    } = req.body;

    if (!name || !startTime || !endTime || fee === undefined || !maxSeats) {
      return res.status(400).json({ error: "name, startTime, endTime, fee and maxSeats are required" });
    }

    // Normalize category to the two allowed values; default to technical.
    const normalizedCategory = category === "non_technical" ? "non_technical" : "technical";

    const event = await prisma.event.create({
      data: {
        name,
        description: description || "",
        track,
        category: normalizedCategory,
        level: level === "junior" ? "junior" : "senior",
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        fee: Number(fee),
        maxSeats: Number(maxSeats),
        isTeamEvent: Boolean(isTeamEvent),
        minTeamSize: minTeamSize ? Number(minTeamSize) : 1,
        maxTeamSize: maxTeamSize ? Number(maxTeamSize) : 1,
        rulebook,
        venue,
      },
    });
    res.status(201).json({ event });
  } catch (err) {
    console.error("Create event error:", err);
    res.status(500).json({ error: "Failed to create event" });
  }
});

/** PUT /api/events/:id - master_admin only: edit an event. */
router.put("/:id", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const data = { ...req.body };
    if (data.startTime) data.startTime = new Date(data.startTime);
    if (data.endTime) data.endTime = new Date(data.endTime);
    if (data.fee !== undefined) data.fee = Number(data.fee);
    if (data.maxSeats !== undefined) data.maxSeats = Number(data.maxSeats);
    // Only ever allow the two valid category values through an edit.
    if (data.category !== undefined) {
      data.category = data.category === "non_technical" ? "non_technical" : "technical";
    }
    if (data.level !== undefined) data.level = data.level === "junior" ? "junior" : "senior";
    delete data.id;
    delete data.seatsTaken;

    const event = await prisma.event.update({ where: { id: req.params.id }, data });
    res.json({ event });
  } catch (err) {
    console.error("Update event error:", err);
    res.status(500).json({ error: "Failed to update event" });
  }
});

/** DELETE /api/events/:id - master_admin only. */
router.delete("/:id", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    await prisma.event.delete({ where: { id: req.params.id } });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete event error:", err);
    res.status(500).json({ error: "Failed to delete event (it may have existing registrations)" });
  }
});

module.exports = router;
