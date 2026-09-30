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

/**
 * The editable event fields from a create/edit body, normalised. Anything
 * else (id, seatsTaken, computed seatsAvailable, timestamps...) is dropped,
 * so the admin form can send the event back as it received it.
 * Returns { data } or { error }.
 */
function eventFields(body) {
  const data = {};
  for (const k of ["name", "description", "track", "rulebook", "venue"]) {
    if (body[k] !== undefined) data[k] = body[k] === null ? null : String(body[k]);
  }
  if (body.category !== undefined) data.category = body.category === "non_technical" ? "non_technical" : "technical";
  if (body.level !== undefined) data.level = body.level === "junior" ? "junior" : "senior";
  if (body.day !== undefined) data.day = body.day === null || body.day === "" ? null : Number(body.day);
  if (body.startTime) data.startTime = new Date(body.startTime);
  if (body.endTime) data.endTime = new Date(body.endTime);
  for (const k of ["fee", "maxSeats", "minTeamSize", "maxTeamSize"]) {
    if (body[k] !== undefined && body[k] !== "") data[k] = Number(body[k]);
  }
  for (const k of ["feePerTeam", "isTeamEvent", "externalRegistration"]) {
    if (body[k] !== undefined) data[k] = Boolean(body[k]);
  }
  if (body.registrationUrl !== undefined) {
    const url = String(body.registrationUrl || "").trim();
    // A full address, or a path on this site (e.g. /hacknexus/).
    if (url && !/^https?:\/\/[^\s]+$/i.test(url) && !/^\/[^\s/][^\s]*$|^\/$/.test(url)) {
      return { error: "Registration link must be a full web address starting with https://, or a path on this site starting with /" };
    }
    data.registrationUrl = url || null;
  }
  for (const k of ["startTime", "endTime"]) {
    if (data[k] && Number.isNaN(data[k].getTime())) return { error: `Invalid ${k}` };
  }
  for (const k of ["fee", "maxSeats", "minTeamSize", "maxTeamSize", "day"]) {
    if (data[k] !== undefined && data[k] !== null && !Number.isFinite(data[k])) return { error: `Invalid ${k}` };
  }
  return { data };
}

/** POST /api/events - master_admin only: create an event. */
router.post("/", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const { name, startTime, endTime, fee, maxSeats } = req.body;
    if (!name || !startTime || !endTime || fee === undefined || !maxSeats) {
      return res.status(400).json({ error: "name, startTime, endTime, fee and maxSeats are required" });
    }
    const { data, error } = eventFields(req.body);
    if (error) return res.status(400).json({ error });

    const event = await prisma.event.create({
      data: {
        description: "",
        category: "technical",
        level: "senior",
        minTeamSize: 1,
        maxTeamSize: 1,
        ...data,
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
    const { data, error } = eventFields(req.body);
    if (error) return res.status(400).json({ error });

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
