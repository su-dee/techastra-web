const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload, uploadDir } = require("../middleware/upload");
const { registrationIpLimiter, registrationEmailLimiter, exportLimiter } = require("../middleware/rateLimiter");
const { logIDORAttempt, logSuspiciousActivity } = require("../middleware/securityLogger");
const { generateRegistrationCode } = require("../utils/codes");
const { sendMail } = require("../utils/mailer");
const { validateRegistration, checkTeamSizes, computeTotal } = require("../utils/validation");
const fs = require("fs");
const path = require("path");

const router = express.Router();

/** Returns true if two [start,end) time ranges overlap. */
function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return aStart < bEnd && bStart < aEnd;
}

/**
 * POST /api/registrations
 * Creates a registration in "pending" status (the Registration Team then
 * checks the UPI payment) together with the participant's User record.
 * Validates, server-side:
 *  - every field (utils/validation.js), consent, and guardian consent for
 *    Junior Techastra (participants are under 18 - DPDP Act 2023, s.9)
 *  - all events are the same level (senior or junior), no time clashes
 *  - team sizes for team events
 *  - the UPI transaction ID hasn't been used by another registration
 *  - the amount due, including combo pass prices (never trusted from the client)
 *  - seats, reserved atomically so two people can't take the last seat
 */
router.post(
  "/",
  registrationIpLimiter,
  upload.single("paymentProof"),
  registrationEmailLimiter,
  async (req, res) => {
    const cleanupUpload = () => req.file && fs.promises.unlink(req.file.path).catch(() => {});
    const reject = (status, error, extra) => {
      cleanupUpload();
      return res.status(status).json({ error, ...extra });
    };
    try {
      const { errors, value } = validateRegistration(req.body);
      if (errors.length) return reject(400, errors[0], { errors });

      const existingUser = await prisma.user.findUnique({ where: { email: value.email } });
      if (existingUser) {
        return reject(409, "An account with this email already exists. Check your status or sign in instead.");
      }

      const usedTxn = await prisma.registration.findUnique({ where: { transactionId: value.transactionId } });
      if (usedTxn) {
        logSuspiciousActivity(req, "Reused UPI transaction ID", { transactionId: value.transactionId });
        return reject(409, "This UPI transaction ID has already been used for another registration.");
      }

      const events = await prisma.event.findMany({ where: { id: { in: value.eventIds } } });
      if (events.length !== value.eventIds.length) {
        return reject(400, "One or more selected events could not be found");
      }

      // Senior events are for college students and Junior events for school
      // students, so one registration can't mix them (UI also blocks this).
      const levels = new Set(events.map((e) => e.level || "senior"));
      if (levels.size > 1) {
        return reject(400, "Senior events (college students) and Junior events (school students) can't be registered together. Register for them separately.");
      }
      if (levels.has("junior") && !value.guardianConsent) {
        return reject(400, "Junior Techastra registrations need a parent or guardian's consent.");
      }

      // Time-clash validation (server-side safety net; UI also blocks this)
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          if (rangesOverlap(events[i].startTime, events[i].endTime, events[j].startTime, events[j].endTime)) {
            return reject(409, `"${events[i].name}" and "${events[j].name}" have overlapping timings. Remove one from your cart.`);
          }
        }
      }

      const teamSize = value.teamMembers ? value.teamMembers.length : 1;
      const teamError = checkTeamSizes(events, teamSize);
      if (teamError) return reject(400, teamError);

      const combos = value.comboIds.length
        ? await prisma.comboPass.findMany({ where: { id: { in: value.comboIds }, isActive: true } })
        : [];
      if (combos.length !== value.comboIds.length) {
        return reject(400, "A selected combo pass is no longer available.");
      }
      const totalAmount = computeTotal(events, combos);

      const passwordHash = await bcrypt.hash(value.password, 10);
      const registrationCode = await generateRegistrationCode(prisma);
      // Payment screenshots are personal data: kept out of the public static
      // folder and served only to staff (GET /api/registrations/:id/proof).
      const paymentProofUrl = req.file ? req.file.filename : null;

      const result = await prisma.$transaction(async (tx) => {
        // Reserve seats atomically: the conditional UPDATE only succeeds while
        // a seat is left, so concurrent registrations can't oversell.
        for (const ev of events) {
          const updated = await tx.$executeRaw`UPDATE "Event" SET "seatsTaken" = "seatsTaken" + 1, "updatedAt" = NOW() WHERE "id" = ${ev.id} AND "seatsTaken" < "maxSeats"`;
          if (updated !== 1) {
            const err = new Error(`"${ev.name}" has no seats remaining`);
            err.status = 409;
            throw err;
          }
        }

        const user = await tx.user.create({
          data: {
            name: value.name,
            email: value.email,
            phone: value.phone,
            passwordHash,
            role: "participant",
            collegeName: value.collegeName,
            registerNo: value.registerNo,
          },
        });

        return tx.registration.create({
          data: {
            registrationCode,
            userId: user.id,
            eventIds: value.eventIds,
            teamName: value.teamName,
            teamMembers: value.teamMembers || undefined,
            collegeName: value.collegeName,
            totalAmount,
            transactionId: value.transactionId,
            paymentProofUrl,
            paymentMethod: "upi",
            status: "pending",
            consentAt: new Date(),
            guardianConsent: value.guardianConsent,
          },
        });
      });

      await sendMail({
        to: value.email,
        subject: `Techastra '26 registration received - ${registrationCode}`,
        text: `Hi ${value.name},\n\nWe received your registration (${registrationCode}) for ${events.length} event(s), totalling Rs. ${totalAmount}, with UPI transaction ID ${value.transactionId}. Our Registration Team will verify your payment shortly. You can track your status anytime on the Status page using your email or registration code.\n\n- Techastra '26 Team`,
      });

      res.status(201).json({
        registration: {
          id: result.id,
          registrationCode: result.registrationCode,
          status: result.status,
          totalAmount: result.totalAmount,
        },
      });
    } catch (err) {
      cleanupUpload();
      if (err.status) return res.status(err.status).json({ error: err.message });
      if (err.code === "P2002") {
        return res.status(409).json({ error: "This email or UPI transaction ID is already registered." });
      }
      console.error("Create registration error:", err);
      res.status(500).json({ error: "Failed to submit registration" });
    }
  }
);

/**
 * GET /api/registrations/:id/proof
 * Streams the payment screenshot to Registration Team / admins only. Older
 * rows stored "/uploads/<file>"; only the bare file name is ever used, so a
 * crafted value can't escape the uploads folder.
 */
router.get("/:id/proof", requireAuth, requireRole("registration_team", "master_admin"), async (req, res) => {
  try {
    const reg = await prisma.registration.findUnique({ where: { id: req.params.id }, select: { paymentProofUrl: true } });
    if (!reg || !reg.paymentProofUrl) return res.status(404).json({ error: "No payment screenshot for this registration" });
    const file = path.basename(reg.paymentProofUrl);
    res.set("Cache-Control", "private, no-store");
    res.sendFile(path.join(uploadDir, file), (err) => {
      if (err && !res.headersSent) res.status(404).json({ error: "Payment screenshot not found" });
    });
  } catch (err) {
    console.error("Payment proof error:", err);
    res.status(500).json({ error: "Failed to load payment screenshot" });
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
