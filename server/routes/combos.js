const express = require("express");
const prisma = require("../db");
const router = express.Router();

/**
 * GET /api/combos
 * List all active combo passes with their included events
 */
router.get("/", async (req, res) => {
  try {
    const combos = await prisma.comboPass.findMany({
      where: { isActive: true },
      orderBy: { createdAt: "asc" },
    });

    // Every combo's events in one query (not one per combo).
    const events = await prisma.event.findMany({
      where: { id: { in: [...new Set(combos.flatMap((c) => c.eventIds))] } },
      select: { id: true, name: true, category: true, startTime: true, endTime: true, fee: true, day: true, maxSeats: true, seatsTaken: true },
    });
    const byId = new Map(events.map((e) => [e.id, e]));

    const combosWithEvents = combos.map((combo) => {
      const included = combo.eventIds.map((id) => byId.get(id)).filter(Boolean);
      return {
        ...combo,
        events: included.map(({ maxSeats, seatsTaken, ...e }) => e),
        // Seats available: the fewest left across the included events
        availableSeats: Math.min(combo.availableSeats, ...included.map((e) => Math.max(e.maxSeats - e.seatsTaken, 0))),
      };
    });

    res.json({ combos: combosWithEvents });
  } catch (error) {
    console.error("Error fetching combos:", error);
    res.status(500).json({ error: "Failed to fetch combo passes" });
  }
});

/**
 * GET /api/combos/:id
 * Get a single combo pass by ID
 */
router.get("/:id", async (req, res) => {
  try {
    const { id } = req.params;
    const combo = await prisma.comboPass.findUnique({
      where: { id },
    });

    if (!combo) {
      return res.status(404).json({ error: "Combo pass not found" });
    }

    // Fetch full event details
    const events = await prisma.event.findMany({
      where: { id: { in: combo.eventIds } },
    });

    res.json({ combo: { ...combo, events } });
  } catch (error) {
    console.error("Error fetching combo:", error);
    res.status(500).json({ error: "Failed to fetch combo pass" });
  }
});

module.exports = router;
