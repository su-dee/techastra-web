const express = require("express");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { scanLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../middleware/securityLogger");
const { isValidRegistrationCode } = require("../middleware/inputValidation");
const { registrationTeamSize } = require("../utils/validation");
const { participantDetails } = require("../utils/participantDetails");

/**
 * Welcome-kit handout at the registration desk. The desk scans the
 * participant's ID card QR, sees who it is and how many kits are due (one
 * per person on the registration), then hands them over - once.
 */
const router = express.Router();
router.use(requireAuth, requireRole("registration_team", "master_admin"));

const codeOf = (req) => String(req.params.code || "").trim().toUpperCase();

/** What the desk sees after a scan: the participant's full details, kits due, and any earlier handout. */
async function kitStatus(registrationCode) {
  const registration = await prisma.registration.findUnique({
    where: { registrationCode },
    select: {
      id: true, registrationCode: true, status: true, eventIds: true, teamName: true, teamMembers: true, collegeName: true,
      user: { select: { name: true, collegeName: true } },
    },
  });
  if (!registration) return null;
  const [handout, events, details] = await Promise.all([
    prisma.kitHandout.findUnique({ where: { registrationId: registration.id } }),
    prisma.event.findMany({ where: { id: { in: registration.eventIds } }, select: { name: true }, orderBy: { startTime: "asc" } }),
    participantDetails(registration),
  ]);
  const members = Array.isArray(registration.teamMembers) ? registration.teamMembers.map((m) => m?.name).filter(Boolean) : [];
  return {
    registration,
    view: {
      registrationCode: registration.registrationCode,
      name: registration.user.name,
      college: registration.collegeName || registration.user.collegeName || null,
      status: registration.status,
      teamName: registration.teamName,
      members,
      events: events.map((e) => e.name),
      kitsDue: registrationTeamSize(registration),
      handout: handout && { kits: handout.kits, givenByName: handout.givenByName, givenAt: handout.givenAt },
      details,
    },
  };
}

/** GET /api/kits - totals and the latest handouts (for the desk's counter). */
router.get("/", async (req, res) => {
  try {
    const [totals, recent] = await Promise.all([
      prisma.kitHandout.aggregate({ _count: true, _sum: { kits: true } }),
      prisma.kitHandout.findMany({ orderBy: { givenAt: "desc" }, take: 20 }),
    ]);
    const regs = await prisma.registration.findMany({
      where: { id: { in: recent.map((h) => h.registrationId) } },
      select: { id: true, registrationCode: true, user: { select: { name: true } } },
    });
    const byId = new Map(regs.map((r) => [r.id, r]));
    res.json({
      registrations: totals._count,
      kits: totals._sum.kits || 0,
      recent: recent.map((h) => ({
        registrationCode: byId.get(h.registrationId)?.registrationCode || null,
        name: byId.get(h.registrationId)?.user.name || "(deleted)",
        kits: h.kits,
        givenByName: h.givenByName,
        givenAt: h.givenAt,
      })),
    });
  } catch (err) {
    console.error("Kit list error:", err);
    res.status(500).json({ error: "Failed to load kit handouts" });
  }
});

/** GET /api/kits/:code - look up a scanned registration (changes nothing). */
router.get("/:code", scanLimiter, async (req, res) => {
  const code = codeOf(req);
  if (!isValidRegistrationCode(code)) return res.status(400).json({ error: "That QR isn't a Techastra ID card" });
  try {
    const found = await kitStatus(code);
    if (!found) return res.status(404).json({ error: "No registration found for this QR code" });
    logSecurityEvent("participant_details_viewed", { userId: req.user.id, registrationCode: code, via: "kit_desk" });
    res.json(found.view);
  } catch (err) {
    console.error("Kit lookup error:", err);
    res.status(500).json({ error: "Failed to look up the registration" });
  }
});

/** POST /api/kits/:code - record the handout. Approved registrations only, once each. */
router.post("/:code", scanLimiter, async (req, res) => {
  const code = codeOf(req);
  if (!isValidRegistrationCode(code)) return res.status(400).json({ error: "That QR isn't a Techastra ID card" });
  try {
    const found = await kitStatus(code);
    if (!found) return res.status(404).json({ error: "No registration found for this QR code" });
    const { registration, view } = found;
    if (registration.status !== "approved") {
      return res.status(409).json({ error: `This registration is ${registration.status}, not approved - no kit`, ...view });
    }
    if (view.handout) {
      return res.status(409).json({ error: `Kits already given to ${view.name}`, alreadyGiven: true, ...view });
    }
    try {
      await prisma.kitHandout.create({
        data: { registrationId: registration.id, kits: view.kitsDue, givenById: req.user.id, givenByName: req.user.name || "Staff" },
      });
    } catch (err) {
      // Two desks scanned the same card at once: the unique index lets only one through.
      if (err.code === "P2002") return res.status(409).json({ error: `Kits already given to ${view.name}`, alreadyGiven: true, ...view });
      throw err;
    }
    logSecurityEvent("kit_handout", { userId: req.user.id, registrationCode: code, kits: view.kitsDue });
    const after = await kitStatus(code);
    res.status(201).json(after.view);
  } catch (err) {
    console.error("Kit handout error:", err);
    res.status(500).json({ error: "Failed to record the kit handout" });
  }
});

/** DELETE /api/kits/:code - undo a handout recorded by mistake (master admin only). */
router.delete("/:code", requireRole("master_admin"), async (req, res) => {
  const code = codeOf(req);
  if (!isValidRegistrationCode(code)) return res.status(400).json({ error: "Invalid registration code" });
  try {
    const registration = await prisma.registration.findUnique({ where: { registrationCode: code }, select: { id: true } });
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    const { count } = await prisma.kitHandout.deleteMany({ where: { registrationId: registration.id } });
    if (!count) return res.status(404).json({ error: "No kit handout recorded for this registration" });
    logSecurityEvent("kit_handout_undone", { userId: req.user.id, registrationCode: code });
    res.json({ undone: true });
  } catch (err) {
    console.error("Kit undo error:", err);
    res.status(500).json({ error: "Failed to undo the kit handout" });
  }
});

module.exports = router;
