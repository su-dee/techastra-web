const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload, uploadDir } = require("../middleware/upload");
const { registrationIpLimiter, registrationEmailLimiter, exportLimiter, statusLimiter } = require("../middleware/rateLimiter");
const { logIDORAttempt, logSuspiciousActivity } = require("../middleware/securityLogger");
const { generateRegistrationCode } = require("../utils/codes");
const { sendMail } = require("../utils/mailer");
const { validateRegistration, checkTeamSizes, computeTotal } = require("../utils/validation");
const fs = require("fs");
const path = require("path");

const router = express.Router();

/** Audit fields for a status change made by the signed-in staff member. */
const reviewedBy = (req) => ({ reviewedById: req.user.id, reviewedByName: req.user.name, reviewedAt: new Date() });

// Symposium days, as shown on the website ("October 8, 2026 (Day 1)").
const DAY_NUMBER = { "2026-10-08": 1, "2026-10-09": 2 };
const IST = "Asia/Kolkata";

function formatEventLine(ev) {
  const start = new Date(ev.startTime);
  const ymd = start.toLocaleDateString("en-CA", { timeZone: IST });
  const date = start.toLocaleDateString("en-US", { timeZone: IST, month: "long", day: "numeric", year: "numeric" });
  const time = (d) => new Date(d).toLocaleTimeString("en-US", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  const day = DAY_NUMBER[ymd] ? ` (Day ${DAY_NUMBER[ymd]})` : "";
  const venue = ev.venue ? `, ${ev.venue}` : "";
  const endYmd = new Date(ev.endTime).toLocaleDateString("en-CA", { timeZone: IST });
  if (endYmd !== ymd && DAY_NUMBER[ymd] && DAY_NUMBER[endYmd]) {
    // Runs across both days (Hack Nexus).
    return `- ${ev.name}: October 8-9, 2026 (Day 1-2), ${time(ev.startTime)} (Day ${DAY_NUMBER[ymd]}) - ${time(ev.endTime)} (Day ${DAY_NUMBER[endYmd]})${venue}`;
  }
  return `- ${ev.name}: ${date}${day}, ${time(ev.startTime)} - ${time(ev.endTime)}${venue}`;
}

/** The approval email - the only email the portal sends automatically. */
async function sendApprovalEmail(registration) {
  const events = await prisma.event.findMany({
    where: { id: { in: registration.eventIds } },
    orderBy: { startTime: "asc" },
  });
  const lines = [
    `Hi ${registration.user.name},`,
    "",
    `Your Techastra '26 registration (${registration.registrationCode}) has been approved. See you there!`,
    "",
    "Your events:",
    ...events.map(formatEventLine),
    "",
    "Log in to the Techastra '26 portal to see your digital ID card, and bring it (on your phone or printed) along with your college/school ID on the day.",
    "",
    "For any queries, reply to this email.",
    "",
    "- Techastra '26 Team",
  ];
  return sendMail({
    to: registration.user.email,
    subject: `Techastra '26 registration approved - ${registration.registrationCode}`,
    text: lines.join("\n"),
  });
}

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
 *  - paid registrations: a UPI transaction ID not used before, and a payment screenshot
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

      const combos = value.comboIds.length
        ? await prisma.comboPass.findMany({ where: { id: { in: value.comboIds }, isActive: true } })
        : [];
      if (combos.length !== value.comboIds.length) {
        return reject(400, "A selected combo pass is no longer available.");
      }
      // Also checks each combo's events are all in the registration.
      const totalAmount = computeTotal(events, combos);

      const teamSize = value.teamMembers ? value.teamMembers.length : 1;
      const teamError = checkTeamSizes(events, teamSize, combos);
      if (teamError) return reject(400, teamError);

      // Free registrations (Junior Techastra) only collect the student's
      // details: no payment to verify, so they're approved straight away.
      const free = totalAmount === 0;
      if (free) {
        value.transactionId = null;
        cleanupUpload();
      } else {
        if (!value.transactionId) {
          return reject(400, "Enter the UPI transaction ID (UTR) from your payment app - the 12-digit reference number.");
        }
        // The registration desk checks every payment against this screenshot.
        if (!req.file) {
          return reject(400, "Upload a screenshot of your UPI payment's success screen.");
        }
        const usedTxn = await prisma.registration.findUnique({ where: { transactionId: value.transactionId } });
        if (usedTxn) {
          logSuspiciousActivity(req, "Reused UPI transaction ID", { transactionId: value.transactionId });
          return reject(409, "This UPI transaction ID has already been used for another registration.");
        }
      }

      const passwordHash = await bcrypt.hash(value.password, 10);
      const registrationCode = await generateRegistrationCode(prisma);
      // Payment screenshots are personal data: kept out of the public static
      // folder and served only to staff (GET /api/registrations/:id/proof).
      const paymentProofUrl = !free && req.file ? req.file.filename : null;

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
            paymentMethod: free ? "free" : "upi",
            status: free ? "approved" : "pending",
            // Free registrations have no payment to check, so they are approved automatically.
            ...(free ? { reviewedByName: "Automatic (free registration)", reviewedAt: new Date() } : {}),
            consentAt: new Date(),
            guardianConsent: value.guardianConsent,
          },
        });
      });

      res.status(201).json({
        registration: {
          id: result.id,
          registrationCode: result.registrationCode,
          status: result.status,
          totalAmount: result.totalAmount,
        },
      });

      // Free registrations are approved on the spot, so they get the approval
      // email now (paid ones get it when the desk approves the payment).
      if (free) {
        sendApprovalEmail({ ...result, user: { name: value.name, email: value.email } }).catch((err) =>
          console.warn("Approval email error:", err.message)
        );
      }
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

/**
 * GET /api/registrations/status?code=...&email=... - public status check.
 * Needs BOTH the registration code and the email it was made with, so an
 * email alone can't reveal whether someone registered (and codes, which are
 * sequential, can't be browsed without the matching email).
 */
router.get("/status", statusLimiter, async (req, res) => {
  try {
    const code = String(req.query.code || "").trim().toUpperCase();
    const email = String(req.query.email || "").trim().toLowerCase();
    if (!code || !email) {
      return res.status(400).json({ error: "Enter both your registration code and the email you registered with" });
    }

    const registration = await prisma.registration.findFirst({
      where: { registrationCode: code, user: { email } },
    });

    if (!registration) {
      return res.status(404).json({ error: "No registration matches that code and email" });
    }

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
        data: { status: "approved", rejectionReason: null, ...reviewedBy(req) },
        include: { user: true },
      });

      res.json({ registration });

      // The only automatic email: sent after responding, so the desk never
      // waits on (or fails because of) mail. sendMail never throws.
      sendApprovalEmail(registration).catch((err) => console.warn("Approval email error:", err.message));
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
        data: { status: "rejected", rejectionReason: reason || "Payment could not be verified", ...reviewedBy(req) },
        include: { user: true },
      });

      res.json({ registration });
    } catch (err) {
      console.error("Reject error:", err);
      res.status(500).json({ error: "Failed to reject registration" });
    }
  }
);

/**
 * PATCH /api/registrations/:id/override - master_admin only: correct a
 * registration's status or details. Only the fields below can change (no
 * mass assignment of amounts, payment IDs, owner or audit fields), and the
 * change is recorded as reviewed by this admin.
 */
const OVERRIDE_STATUSES = ["pending", "approved", "rejected"];
router.patch("/:id/override", requireAuth, requireRole("master_admin"), async (req, res) => {
  try {
    const { status, rejectionReason, teamName, collegeName } = req.body || {};
    const data = {};
    if (status !== undefined) {
      if (!OVERRIDE_STATUSES.includes(status)) {
        return res.status(400).json({ error: `status must be one of ${OVERRIDE_STATUSES.join(", ")}` });
      }
      data.status = status;
      Object.assign(data, reviewedBy(req));
      if (status !== "rejected") data.rejectionReason = null;
    }
    if (typeof rejectionReason === "string") data.rejectionReason = rejectionReason.trim().slice(0, 300) || null;
    if (typeof teamName === "string") data.teamName = teamName.trim().slice(0, 80) || null;
    if (typeof collegeName === "string") data.collegeName = collegeName.trim().slice(0, 150) || null;
    if (!Object.keys(data).length) return res.status(400).json({ error: "Nothing to update" });
    const registration = await prisma.registration.update({ where: { id: req.params.id }, data });
    res.json({ registration });
  } catch (err) {
    console.error("Override error:", err);
    res.status(500).json({ error: "Failed to override registration" });
  }
});

module.exports = router;
