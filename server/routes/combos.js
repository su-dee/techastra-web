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

    // Fetch full event details for each combo
    const combosWithEvents = await Promise.all(
      combos.map(async (combo) => {
        const events = await prisma.event.findMany({
          where: { id: { in: combo.eventIds } },
          select: {
            id: true,
            name: true,
            category: true,
            startTime: true,
            endTime: true,
            fee: true,
            day: true,
          },
        });

        return {
          ...combo,
          events,
          // Calculate seats available as minimum across all included events
          availableSeats: Math.min(
            combo.availableSeats,
            ...events.map((e) => e.maxSeats - e.seatsTaken || 0)
          ),
        };
      })
    );

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
