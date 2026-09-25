const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload } = require("../middleware/upload");
const { registrationLimiter, exportLimiter } = require("../middleware/rateLimiter");
const { logIDORAttempt, logSuspiciousActivity } = require("../middleware/securityLogger");
const { generateRegistrationCode } = require("../utils/codes");
const { sendMail } = require("../utils/mailer");

const router = express.Router();

/** Returns true if two [start,end) time ranges overlap. */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * POST /api/registrations
 * Creates a new registration in "pending" status, along with the participant
 * User record (lead, for team events). Also validates:
 *  - all events are the same level (senior or junior)
 *  - no time-clash between the chosen events
 *  - seat availability
 * Rate limited: 3 registrations per hour per IP to prevent spam.
 */
router.post("/", registrationLimiter, upload.single("paymentProof"), async (req, res) => {
  try {
    const body = req.body;
    const eventIds = JSON.parse(body.eventIds || "[]");
    const teamMembers = body.teamMembers ? JSON.parse(body.teamMembers) : null;

    if (!body.name || !body.email || !body.password) {
      return res.status(400).json({ error: "Name, email and password are required" });
    }
    if (!eventIds.length) {
      return res.status(400).json({ error: "Select at least one event" });
    }
    if (!body.transactionId) {
      return res.status(400).json({ error: "UPI transaction ID is required" });
    }

    const existingUser = await prisma.user.findUnique({ where: { email: body.email.toLowerCase().trim() } });
    if (existingUser) {
      return res.status(409).json({ error: "An account with this email already exists" });
    }

    const events = await prisma.event.findMany({ where: { id: { in: eventIds } } });
    if (events.length !== eventIds.length) {
      return res.status(400).json({ error: "One or more selected events could not be found" });
    }

    // Senior events are for college students and Junior events for school
    // students, so one registration can't mix them (UI also blocks this).
    if (new Set(events.map((e) => e.level || "senior")).size > 1) {
      return res.status(400).json({
        error: "Senior (college) and Junior (school) events can't be registered together. Register for them separately.",
      });
    }

    // Time-clash validation (server-side safety net; UI also blocks this)
    for (let i = 0; i < events.length; i++) {
      for (let j = i + 1; j < events.length; j++) {
        if (rangesOverlap(events[i].startTime, events[i].endTime, events[j].startTime, events[j].endTime)) {
          return res.status(409).json({
            error: `"${events[i].name}" and "${events[j].name}" have overlapping timings. Remove one from your cart.`,
          });
        }
      }
    }

    // Seat availability check
    for (const ev of events) {
      if (ev.seatsTaken >= ev.maxSeats) {
        return res.status(409).json({ error: `"${ev.name}" has no seats remaining` });
      }
    }

    const totalAmount = events.reduce((sum, e) => sum + e.fee, 0);
    const passwordHash = await bcrypt.hash(body.password, 10);
    const registrationCode = await generateRegistrationCode(prisma);

    const paymentProofUrl = req.file ? `/uploads/${req.file.filename}` : null;

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: body.name,
          email: body.email.toLowerCase().trim(),
          phone: body.phone || null,
          passwordHash,
          role: "participant",
          collegeName: body.collegeName || null,
          registerNo: body.registerNo || null,
        },
      });

      const registration = await tx.registration.create({
        data: {
          registrationCode,
          userId: user.id,
          eventIds,
          teamName: body.teamName || null,
          teamMembers: teamMembers || undefined,
          collegeName: body.collegeName || null,
          totalAmount,
          transactionId: body.transactionId,
          paymentProofUrl,
          status: "pending",
        },
      });

      for (const ev of events) {
        await tx.event.update({
          where: { id: ev.id },
          data: { seatsTaken: { increment: 1 } },
        });
      }

      return registration;
    });

    await sendMail({
      to: body.email,
      subject: `TechAstra Registration Received - ${registrationCode}`,
      text: `Hi ${body.name},\n\nWe received your registration (${registrationCode}) for ${events.length} event(s), totalling ₹${totalAmount}. Our Registration Team will verify your payment shortly. You can track your status anytime on the Status page using your email or registration code.\n\n- TechAstra Team`,
    });

    res.status(201).json({ registration: result });
  } catch (err) {
    console.error("Create registration error:", err);
    res.status(500).json({ error: "Failed to submit registration" });
  }
});

/** GET /api/registrations/status?code=...&email=... - public status check. */
router.get("/status", async (req, res) => {
  try {
    const { code, email } = req.query;
    if (!code && !email) {
      return res.status(400).json({ error: "Provide a registration code or email" });
    }

    const registration = await prisma.registration.findFirst({
      where: code
        ? { registrationCode: code }
        : { user: { email: String(email).toLowerCase().trim() } },
      include: { user: true },
    });

    if (!registration) return res.status(404).json({ error: "Registration not found" });

    res.json({
      registrationCode: registration.registrationCode,
      status: registration.status,
      rejectionReason: registration.rejectionReason,
      totalAmount: registration.totalAmount,
      createdAt: registration.createdAt,
    });
  } catch (err) {
    console.error("Status check error:", err);
    res.status(500).json({ error: "Failed to check status" });
  }
});

/** GET /api/registrations - registration_team/master_admin: list all, filterable by status. */
router.get("/", requireAuth, requireRole("registration_team", "master_admin"), async (req, res) => {
  try {
    const { status } = req.query;
    const registrations = await prisma.registration.findMany({
      where: status ? { status } : undefined,
      include: { user: true },
      orderBy: { createdAt: "desc" },
    });
    res.json({ registrations });
  } catch (err) {
    console.error("List registrations error:", err);
    res.status(500).json({ error: "Failed to load registrations" });
  }
});

/** GET /api/registrations/lookup?q=... - lost-ID recovery by name/reg number/email/code. */
router.get(
  "/lookup",
  requireAuth,
  requireRole("registration_team", "master_admin"),
  async (req, res) => {
    try {
      const q = String(req.query.q || "").trim();
      if (!q) return res.status(400).json({ error: "Provide a search term" });

      const registrations = await prisma.registration.findMany({
        where: {
          OR: [
            { registrationCode: { contains: q, mode: "insensitive" } },
            { user: { name: { contains: q, mode: "insensitive" } } },
            { user: { registerNo: { contains: q, mode: "insensitive" } } },
            { user: { email: { contains: q, mode: "insensitive" } } },
          ],
        },
        include: { user: true },
        take: 20,
      });

      res.json({ registrations });
    } catch (err) {
      console.error("Lookup error:", err);
      res.status(500).json({ error: "Lookup failed" });
    }
  }
);

/** GET /api/registrations/mine - the logged-in participant's own registration (for the Dashboard/ID card). */
router.get("/mine", requireAuth, requireRole("participant"), async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { userId: req.user.id },
      include: { user: true },
    });
    if (!registration) return res.status(404).json({ error: "No registration found for this account" });
    res.json({ registration });
  } catch (err) {
    console.error("Get my registration error:", err);
    res.status(500).json({ error: "Failed to load your registration" });
  }
});

/** GET /api/registrations/:id - detail view (used by ID card / dashboard). */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { id: req.params.id },
      include: { user: true },
    });
    if (!registration) return res.status(404).json({ error: "Registration not found" });

    const isOwner = req.user.id === registration.userId;
    const isStaff = ["registration_team", "master_admin"].includes(req.user.role);
    if (!isOwner && !isStaff) {
      // Log IDOR attempt - user trying to access someone else's registration
      logIDORAttempt(req, "registration", req.params.id, registration.userId);
      return res.status(403).json({ error: "Not authorized to view this registration" });
    }

    res.json({ registration });
  } catch (err) {
    console.error("Get registration error:", err);
    res.status(500).json({ error: "Failed to load registration" });
  }
});

/** PATCH /api/registrations/:id/approve */
router.patch(
  "/:id/approve",
  requireAuth,
  requireRole("registration_team", "master_admin"),
  async (req, res) => {
    try {
      const registration = await prisma.registration.update({
        where: { id: req.params.id },
        data: { status: "approved", rejectionReason: null },
        include: { user: true },
      });

      await sendMail({
        to: registration.user.email,
        subject: `TechAstra Registration Approved - ${registration.registrationCode}`,
        text: `Hi ${registration.user.name},\n\nGreat news! Your registration (${registration.registrationCode}) has been approved. You can now log in to your dashboard to view your digital ID card.\n\n- TechAstra Team`,
      });

      res.json({ registration });
    } catch (err) {
      console.error("Approve error:", err);
      res.status(500).json({ error: "Failed to approve registration" });
    }
  }
);

/** PATCH /api/registrations/:id/reject { reason } */
router.patch(
  "/:id/reject",
  requireAuth,
  requireRole("registration_team", "master_admin"),
  async (req, res) => {
    try {
      const { reason } = req.body;
      const registration = await prisma.registration.update({
        where: { id: req.params.id },
        data: { status: "rejected", rejectionReason: reason || "Payment could not be verified" },
        include: { user: true },
      });

      await sendMail({
        to: registration.user.email,
        subject: `TechAstra Registration Update - ${registration.registrationCode}`,
        text: `Hi ${registration.user.name},\n\nUnfortunately your registration (${registration.registrationCode}) was rejected.\nReason: ${registration.rejectionReason}\n\nPlease contact the Registration Team desk or reply to this email if you believe this is a mistake.\n\n- TechAstra Team`,
      });

      res.json({ registration });
    } catch (err) {
      console.error("Reject error:", err);
      res.status(500).json({ error: "Failed to reject registration" });
    }
  }
);

/** PATCH /api/registrations/:id/override - master_admin only: force any field/status. */
router.patch("/:id/override", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const data = { ...req.body };
    delete data.id;
    delete data.userId;
    const registration = await prisma.registration.update({ where: { id: req.params.id }, data });
    res.json({ registration });
  } catch (err) {
    console.error("Override error:", err);
    res.status(500).json({ error: "Failed to override registration" });
  }
});

module.exports = router;
