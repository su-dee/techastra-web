const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload, uploadDir, isImageFile, IMAGE_EXTS } = require("../middleware/upload");
const { registrationIpLimiter, registrationEmailLimiter, resubmitLimiter, statusLimiter } = require("../middleware/rateLimiter");
const { logIDORAttempt, logSuspiciousActivity } = require("../middleware/securityLogger");
const { generateRegistrationCode } = require("../utils/codes");
const { sendMail } = require("../utils/mailer");
const {
  validateRegistration,
  checkTeamSizes,
  checkComboRules,
  checkParticipation,
  checkRegistrationOpen,
  computeTotal,
  normalizeEmail,
  normalizeTxn,
  isUpiTxn,
} = require("../utils/validation");
const { reserveSeats, reserveForRegistration, applySeatChange } = require("../utils/seats");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

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

// Registrations that can share one mobile number (a teacher or parent may
// register several school students) - beyond that it's treated as spam.
const MAX_PER_PHONE = 10;

/** Removes an uploaded screenshot from disk (by bare file name only). */
const removeProof = (name) => name && fs.promises.unlink(path.join(uploadDir, path.basename(name))).catch(() => {});

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
async function createRegistration(req, res) {
    // Walk-up cash registrations come from the desk (POST /cash below): paid
    // in person, so no UTR or screenshot, and approved on the spot.
    const cash = !!req.cashDesk;
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
      // Events with their own registration website (Hack Nexus) are never
      // registered here.
      const external = events.find((e) => e.externalRegistration);
      if (external) {
        return reject(400, `${external.name} has its own registration website - register for it there.`);
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
      // Junior Techastra: each school student registers alone and teams are
      // formed at the venue, so a team list is never taken (it would only
      // take extra seats).
      if (levels.has("junior")) {
        value.teamMembers = null;
        value.teamName = null;
      }

      // Online registration for an event closes once it has started (the
      // desk can still add a walk-up on the day).
      const closedError = checkRegistrationOpen(events);
      if (closedError && !cash) return reject(400, closedError);

      if (value.phone) {
        const samePhone = await prisma.registration.count({
          where: { status: { not: "rejected" }, user: { phone: value.phone } },
        });
        if (samePhone >= MAX_PER_PHONE) {
          logSuspiciousActivity(req, "Many registrations with one phone number", { count: samePhone });
          return reject(429, "Too many registrations use this mobile number. Contact the Help Desk if this is a mistake.");
        }
      }

      const combos = value.comboIds.length
        ? await prisma.comboPass.findMany({ where: { id: { in: value.comboIds }, isActive: true } })
        : [];
      if (combos.length !== value.comboIds.length) {
        return reject(400, "A selected combo pass is no longer available.");
      }
      // One combo per registration, registered on its own (checked before the
      // time clashes, so the message names the real problem).
      const comboError = checkComboRules(value.eventIds, combos);
      if (comboError) return reject(400, comboError);

      // Time-clash validation (server-side safety net; UI also blocks this)
      for (let i = 0; i < events.length; i++) {
        for (let j = i + 1; j < events.length; j++) {
          if (rangesOverlap(events[i].startTime, events[i].endTime, events[j].startTime, events[j].endTime)) {
            return reject(409, `"${events[i].name}" and "${events[j].name}" have overlapping timings. Remove one from your cart.`);
          }
        }
      }

      const teamSize = value.teamMembers ? value.teamMembers.length : 1;
      // Fees are per person, so the amount depends on the team size.
      const totalAmount = computeTotal(events, combos, teamSize);
      const teamError = checkTeamSizes(events, teamSize, combos) || checkParticipation(events, teamSize);
      if (teamError) return reject(400, teamError);

      // Free registrations (Junior Techastra) only collect the student's
      // details: no payment to verify, so they're approved straight away.
      const free = totalAmount === 0;
      if (free || cash) {
        value.transactionId = null;
        cleanupUpload();
        // The desk must have collected exactly what the server charges.
        if (cash && !free && Number(req.body.amountCollected) !== totalAmount) {
          return reject(400, `Collect ₹${totalAmount} for this registration (entered: ₹${Number(req.body.amountCollected) || 0}).`);
        }
      } else {
        if (!value.transactionId) {
          return reject(400, "Enter the UPI transaction ID (UTR) from your payment app - the 12-digit reference number.");
        }
        // The registration desk checks every payment against this screenshot.
        if (!req.file) {
          return reject(400, "Upload a screenshot of your UPI payment's success screen.");
        }
        if (!(await isImageFile(req.file.path))) {
          logSuspiciousActivity(req, "Payment screenshot is not a real image", { name: req.file.originalname });
          return reject(400, "The payment screenshot must be a PNG, JPEG or WebP image.");
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
      const paymentProofUrl = !free && !cash && req.file ? req.file.filename : null;
      const approvedNow = free || cash;

      const result = await prisma.$transaction(async (tx) => {
        // A team takes one seat in a team event; in an individual event every
        // member is a separate participant (utils/seats.js).
        await reserveSeats(tx, events, teamSize);

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
            paymentMethod: free ? "free" : cash ? "cash" : "upi",
            status: approvedNow ? "approved" : "pending",
            // Free registrations have no payment to check, so they are approved
            // automatically; cash ones are approved by the desk member who took it.
            ...(free ? { reviewedByName: "Automatic (free registration)", reviewedAt: new Date() } : {}),
            ...(cash && !free ? reviewedBy(req) : {}),
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
        // Cash: the desk tells the participant this one-time password.
        ...(cash ? { temporaryPassword: req.generatedPassword } : {}),
      });

      // Free and cash registrations are approved on the spot, so they get the
      // approval email now (UPI ones get it when the desk approves the payment).
      if (approvedNow) {
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

router.post("/", registrationIpLimiter, upload.single("paymentProof"), registrationEmailLimiter, createRegistration);

/**
 * POST /api/registrations/cash - registration desk only: a walk-up who paid
 * cash in person. Same checks and server-computed amount as online
 * registration (the desk confirms the amount collected), approved at once.
 * The participant's password is generated here and returned once.
 */
router.post(
  "/cash",
  requireAuth,
  requireRole("registration_team", "master_admin"),
  upload.none(),
  (req, res, next) => {
    req.cashDesk = true;
    req.generatedPassword = crypto.randomBytes(6).toString("base64url"); // 8 characters
    req.body.password = req.generatedPassword;
    next();
  },
  createRegistration
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
    // Only ever served as an image - never as a page that could run script.
    const ext = path.extname(file).toLowerCase();
    if (!IMAGE_EXTS.has(ext)) return res.status(415).json({ error: "This payment screenshot isn't an image file" });
    res.set({
      "Cache-Control": "private, no-store",
      "Content-Type": ext === ".png" ? "image/png" : ext === ".webp" ? "image/webp" : "image/jpeg",
      "X-Content-Type-Options": "nosniff",
      "Content-Security-Policy": "default-src 'none'; img-src 'self'; sandbox",
      "Content-Disposition": `inline; filename="payment-${req.params.id}${ext}"`,
    });
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

/**
 * POST /api/registrations/resubmit - a rejected participant sends a new UPI
 * transaction ID and screenshot (multipart: code, email, password,
 * transactionId, paymentProof). Proves ownership with the code, email and
 * password; the registration goes back to "pending" for the desk and takes
 * its seats again.
 */
router.post("/resubmit", upload.single("paymentProof"), resubmitLimiter, async (req, res) => {
  const reject = (status, error) => {
    if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
    return res.status(status).json({ error });
  };
  try {
    const code = String(req.body?.code || "").trim().toUpperCase();
    const email = normalizeEmail(req.body?.email);
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    const transactionId = normalizeTxn(req.body?.transactionId);
    if (!code || !email || !password) return reject(400, "Enter your registration code, email and password.");

    const registration = await prisma.registration.findFirst({ where: { registrationCode: code, user: { email } }, include: { user: true } });
    // One message for every mismatch, so this can't be used to probe accounts.
    const ok = registration && (await bcrypt.compare(password, registration.user.passwordHash || ""));
    if (!ok) return reject(401, "The code, email or password doesn't match a registration.");
    if (registration.status !== "rejected") return reject(409, "Only a rejected registration can be resubmitted.");

    if (!isUpiTxn(transactionId)) return reject(400, "Enter the UPI transaction ID (UTR) from your payment app - the 12-digit reference number.");
    if (!req.file) return reject(400, "Upload a screenshot of your UPI payment's success screen.");
    if (!(await isImageFile(req.file.path))) {
      logSuspiciousActivity(req, "Payment screenshot is not a real image", { name: req.file.originalname });
      return reject(400, "The payment screenshot must be a PNG, JPEG or WebP image.");
    }
    const usedTxn = await prisma.registration.findUnique({ where: { transactionId } });
    if (usedTxn && usedTxn.id !== registration.id) {
      logSuspiciousActivity(req, "Reused UPI transaction ID", { transactionId });
      return reject(409, "This UPI transaction ID has already been used for another registration.");
    }
    const events = await prisma.event.findMany({ where: { id: { in: registration.eventIds } } });
    const closedError = checkRegistrationOpen(events);
    if (closedError) return reject(400, closedError);

    const oldProof = registration.paymentProofUrl;
    const updated = await prisma.$transaction(async (tx) => {
      await reserveForRegistration(tx, registration);
      return tx.registration.update({
        where: { id: registration.id },
        data: {
          status: "pending",
          transactionId,
          paymentProofUrl: req.file.filename,
          rejectionReason: null,
          reviewedById: null,
          reviewedByName: null,
          reviewedAt: null,
        },
      });
    });
    removeProof(oldProof);
    res.json({ registration: { registrationCode: updated.registrationCode, status: updated.status, totalAmount: updated.totalAmount } });
  } catch (err) {
    if (req.file) fs.promises.unlink(req.file.path).catch(() => {});
    if (err.status) return res.status(err.status).json({ error: err.message });
    if (err.code === "P2002") return res.status(409).json({ error: "This UPI transaction ID has already been used for another registration." });
    console.error("Resubmit error:", err);
    res.status(500).json({ error: "Failed to resubmit the registration" });
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
    // Flag possible duplicates for the desk: the same register number (as a
    // registrant or a team member) or mobile number in another live
    // registration. Only flagged, never blocked - the desk decides.
    const live = await prisma.registration.findMany({
      where: { status: { not: "rejected" } },
      select: { id: true, registrationCode: true, teamMembers: true, user: { select: { registerNo: true, phone: true } } },
    });
    const owners = new Map(); // key -> Set of registration codes
    const keysOf = (r) => {
      const keys = new Set();
      const regNo = (v) => String(v || "").trim().toUpperCase();
      if (regNo(r.user?.registerNo)) keys.add(`reg:${regNo(r.user.registerNo)}`);
      if (Array.isArray(r.teamMembers)) r.teamMembers.forEach((m) => regNo(m.regNo) && keys.add(`reg:${regNo(m.regNo)}`));
      if (r.user?.phone) keys.add(`phone:${r.user.phone}`);
      return keys;
    };
    for (const r of live) for (const k of keysOf(r)) (owners.get(k) || owners.set(k, new Set()).get(k)).add(r.registrationCode);
    const withFlags = registrations.map((r) => {
      const others = new Set();
      for (const k of keysOf(r)) for (const code of owners.get(k) || []) if (code !== r.registrationCode) others.add(code);
      return { ...r, possibleDuplicates: [...others] };
    });
    res.json({ registrations: withFlags });
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
      const current = await prisma.registration.findUnique({ where: { id: req.params.id }, include: { user: true } });
      if (!current) return res.status(404).json({ error: "Registration not found" });
      // Already approved: nothing to change, and no second email.
      if (current.status === "approved") return res.json({ registration: current, alreadyApproved: true });

      const registration = await prisma.$transaction(async (tx) => {
        // Approving a rejected registration takes its seats back first.
        await applySeatChange(tx, current, current.status, "approved");
        return tx.registration.update({
          where: { id: current.id },
          data: { status: "approved", rejectionReason: null, ...reviewedBy(req) },
          include: { user: true },
        });
      });

      res.json({ registration });

      // The only automatic email: sent after responding, so the desk never
      // waits on (or fails because of) mail. sendMail never throws.
      sendApprovalEmail(registration).catch((err) => console.warn("Approval email error:", err.message));
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
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
      const reason = typeof req.body?.reason === "string" ? req.body.reason.trim().slice(0, 300) : "";
      const current = await prisma.registration.findUnique({ where: { id: req.params.id } });
      if (!current) return res.status(404).json({ error: "Registration not found" });
      const registration = await prisma.$transaction(async (tx) => {
        // A rejected registration gives its seats back to other participants.
        await applySeatChange(tx, current, current.status, "rejected");
        return tx.registration.update({
          where: { id: current.id },
          data: { status: "rejected", rejectionReason: reason || "Payment could not be verified", ...reviewedBy(req) },
          include: { user: true },
        });
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
    const current = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Registration not found" });
    const registration = await prisma.$transaction(async (tx) => {
      // Moving in or out of "rejected" releases or re-takes the seats.
      if (data.status) await applySeatChange(tx, current, current.status, data.status);
      return tx.registration.update({ where: { id: current.id }, data });
    });
    res.json({ registration });
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Override error:", err);
    res.status(500).json({ error: "Failed to override registration" });
  }
});

module.exports = router;
