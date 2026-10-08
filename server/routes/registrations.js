const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { upload, uploadDir, isImageFile, IMAGE_EXTS } = require("../middleware/upload");
const { registrationIpLimiter, registrationEmailLimiter, resubmitLimiter, statusLimiter } = require("../middleware/rateLimiter");
const { logIDORAttempt, logSuspiciousActivity } = require("../middleware/securityLogger");
const { generateRegistrationCode } = require("../utils/codes");
const { sendReceivedEmail, sendApprovalEmail, sendRejectionEmail, siteUrl } = require("../utils/registrationEmails");
const { idCardToken, isValidIdCardToken, istDate, onSpotToken, isValidOnSpotToken } = require("../utils/idCard");
const {
  validateRegistration,
  checkTeamSizes,
  checkComboRules,
  checkEventChoices,
  checkParticipation,
  checkRegistrationOpen,
  checkParticipantDetails,
  checkMemberDetails,
  applyMemberDetails,
  computeTotal,
  normalizeEmail,
  normalizeTxn,
  isUpiTxn,
  MIN_PASSWORD,
  MAX_PASSWORD,
} = require("../utils/validation");
const { reserveSeats, reserveForRegistration, applySeatChange } = require("../utils/seats");
const { PAY_LATER, holdEndsAt, formatWhen, isPaymentDue, releaseExpiredHolds } = require("../utils/payLater");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const router = express.Router();

/** Audit fields for a status change made by the signed-in staff member. */
const reviewedBy = (req) => ({ reviewedById: req.user.id, reviewedByName: req.user.name, reviewedAt: new Date() });

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
 *  - paid registrations: a UPI transaction ID not used before, and a payment screenshot -
 *    or "pay later" (payLater=true): seats blocked until the first event starts, no
 *    payment yet (utils/payLater.js)
 *  - the amount due, including combo pass prices (never trusted from the client)
 *  - seats, reserved atomically so two people can't take the last seat
 */
async function createRegistration(req, res) {
    // Walk-up cash registrations come from the desk (POST /cash below): paid
    // in person, so no UTR or screenshot, and approved on the spot.
    const cash = !!req.cashDesk;
    // On the spot: the desk's cash form, or the website opened from the
    // desk's on-spot QR (today's token). These may use the on-spot seats.
    const onSpot = cash || isValidOnSpotToken(String(req.body?.onSpotToken || ""));
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
      // Junior Techastra students are registered by their school through the
      // Junior Techastra coordinator (imported from Excel/CSV, routes/junior.js).
      if (events.some((e) => e.level === "junior")) {
        return reject(400, "Junior Techastra has no online registration. Schools register their students through the Junior Techastra coordinator.");
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
        // Course / department / year of study are for college students only.
        value.course = value.department = value.yearOfStudy = null;
      }
      // College / school name (printed on the ID card) and, for college
      // students, course, department and year of study.
      const detailsError =
        checkParticipantDetails(value, levels.has("junior") ? "junior" : "senior") ||
        (levels.has("junior") ? null : checkMemberDetails(value.teamMembers));
      if (detailsError) return reject(400, detailsError);

      // Online registration for an event closes at the end of its day (the
      // desk's cash form can always add a walk-up).
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
      // e.g. Free Fire Max or BGMI for Clash Squad E-Sports.
      const picked = checkEventChoices(events, value.eventChoices);
      if (picked.error) return reject(400, picked.error);

      // Free registrations (Junior Techastra) only collect the student's
      // details: no payment to verify, so they're approved straight away.
      const free = totalAmount === 0;
      // "Pay later": blocks the seats now and pays before the first event
      // starts (online or at the desk). Paid online registrations only.
      // On-spot website registrations always pay in cash at the desk.
      const payLater = !free && !cash && (onSpot || String(req.body.payLater) === "true");
      const payBy = payLater ? holdEndsAt(events) : null;
      if (free || cash || payLater) {
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
      const paymentProofUrl = !free && !cash && !payLater && req.file ? req.file.filename : null;
      const approvedNow = free || cash;

      const result = await prisma.$transaction(async (tx) => {
        // A team takes one seat in a team event; in an individual event every
        // member is a separate participant (utils/seats.js).
        await reserveSeats(tx, events, teamSize, { online: !onSpot });

        const user = await tx.user.create({
          data: {
            name: value.name,
            email: value.email,
            phone: value.phone,
            passwordHash,
            role: "participant",
            collegeName: value.collegeName,
            registerNo: value.registerNo,
            course: value.course,
            department: value.department,
            yearOfStudy: value.yearOfStudy,
          },
        });

        return tx.registration.create({
          data: {
            registrationCode,
            userId: user.id,
            eventIds: value.eventIds,
            teamName: value.teamName,
            teamMembers: value.teamMembers || undefined,
            eventChoices: picked.choices || undefined,
            onSpot,
            collegeName: value.collegeName,
            totalAmount,
            transactionId: value.transactionId,
            paymentProofUrl,
            paymentMethod: free ? "free" : cash ? "cash" : payLater ? PAY_LATER : "upi",
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
          paymentMethod: result.paymentMethod,
          onSpot: result.onSpot,
          ...(payLater ? { payBy: payBy.toISOString() } : {}),
        },
        // Cash: the desk tells the participant this one-time password.
        ...(cash ? { temporaryPassword: req.generatedPassword } : {}),
      });

      // Free and cash registrations are approved on the spot, so they get the
      // approval email now (UPI ones get it when the desk approves the payment).
      // Paid online registrations now wait for the desk: confirm receipt.
      // Pay later: the seat is blocked - say how and by when to pay.
      const participant = { ...result, user: { name: value.name, email: value.email } };
      if (approvedNow) sendApprovalEmail(participant);
      else sendReceivedEmail(participant, payLater ? { payBy: formatWhen(payBy) } : {});
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

    // Pay later: seats blocked, nothing paid yet - the page offers "Pay now"
    // and says until when the seat is held.
    const paymentDue = isPaymentDue(registration);
    const payBy = paymentDue
      ? holdEndsAt(await prisma.event.findMany({ where: { id: { in: registration.eventIds } }, select: { startTime: true } }), registration.createdAt)
      : null;
    res.json({
      registrationCode: registration.registrationCode,
      status: registration.status,
      rejectionReason: registration.rejectionReason,
      totalAmount: registration.totalAmount,
      createdAt: registration.createdAt,
      paymentMethod: registration.paymentMethod,
      paymentDue,
      payBy: payBy ? payBy.toISOString() : null,
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
 * its seats again. Also how a "pay later" registration pays online: it is
 * already pending with its seats held, and now has a payment to check.
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
    const payingLater = isPaymentDue(registration);
    if (registration.status !== "rejected" && !payingLater) return reject(409, "Only a rejected registration can be resubmitted.");

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
      // A pay-later registration still holds its seats; a rejected one takes them again.
      if (!payingLater) await reserveForRegistration(tx, registration, { online: !registration.onSpot });
      return tx.registration.update({
        where: { id: registration.id },
        data: {
          status: "pending",
          paymentMethod: "upi",
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
    // Paying a pay-later registration is its first payment, not a resubmission.
    sendReceivedEmail({ ...updated, user: registration.user }, { resubmitted: !payingLater });
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
    // The desk's list is always current: unpaid holds whose event has started are
    // released first (the timer in utils/payLater.js may not have run yet).
    await releaseExpiredHolds();
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

/**
 * GET /api/registrations/verify/:code?t=<token> - public: what the ID card's
 * QR opens. Confirms the card is genuine and approved, showing only what's
 * printed on the card plus the events. Needs the card's token (see
 * utils/idCard.js), so registration codes can't be browsed.
 */
router.get("/verify/:code", statusLimiter, async (req, res) => {
  try {
    const code = String(req.params.code || "").trim().toUpperCase();
    const invalid = () => res.status(404).json({ valid: false, error: "This is not a valid Techastra '26 ID card." });
    if (!code || !isValidIdCardToken(code, String(req.query.t || ""))) return invalid();
    const registration = await prisma.registration.findUnique({
      where: { registrationCode: code },
      include: { user: { select: { name: true, collegeName: true, registerNo: true } } },
    });
    if (!registration) return invalid();
    if (registration.status !== "approved") {
      return res.status(409).json({ valid: false, error: "This registration is not approved.", registrationCode: code });
    }
    const events = await prisma.event.findMany({
      where: { id: { in: registration.eventIds } },
      orderBy: { startTime: "asc" },
      select: { name: true, startTime: true, endTime: true, venue: true },
    });
    res.set("Cache-Control", "no-store");
    res.json({
      valid: true,
      registrationCode: code,
      name: registration.user.name,
      institution: registration.collegeName || registration.user.collegeName,
      registerNo: registration.user.registerNo,
      teamName: registration.teamName,
      events,
    });
  } catch (err) {
    console.error("Verify ID card error:", err);
    res.status(500).json({ valid: false, error: "Couldn't verify this ID card" });
  }
});

/** GET /api/registrations/mine - the logged-in participant's own registration (for the Dashboard/ID card). */
router.get("/mine", requireAuth, requireRole("participant"), async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({
      where: { userId: req.user.id },
      include: { user: true },
    });
    if (!registration) return res.status(404).json({ error: "No registration found for this account" });
    // Event-day activity for the profile dashboard: check-ins and placings
    // (meals aren't shown to participants).
    const [attendance, results] = await Promise.all([
      prisma.attendance.findMany({ where: { registrationId: registration.id }, select: { eventId: true, scannedAt: true } }),
      prisma.result.findMany({ where: { registrationId: registration.id }, select: { eventId: true, position: true } }),
    ]);
    // Their events' WhatsApp groups - only once approved, and only their events.
    const whatsappGroups =
      registration.status === "approved"
        ? (
            await prisma.event.findMany({
              where: { id: { in: registration.eventIds }, whatsappUrl: { not: null } },
              select: { id: true, name: true, whatsappUrl: true },
              orderBy: { startTime: "asc" },
            })
          ).map((e) => ({ eventId: e.id, name: e.name, url: e.whatsappUrl }))
        : [];
    res.json({
      registration: { ...registration, idCardToken: idCardToken(registration.registrationCode) },
      activity: { attendance, results },
      whatsappGroups,
    });
  } catch (err) {
    console.error("Get my registration error:", err);
    res.status(500).json({ error: "Failed to load your registration" });
  }
});

/**
 * GET /api/registrations/onspot-link - the link for the desk's on-spot
 * registration QR. It works only today (India time): registrations made
 * through it may use the events' on-spot seats and pay in cash at the desk.
 */
router.get("/onspot-link", requireAuth, requireRole("registration_team", "master_admin"), (req, res) => {
  const site = siteUrl();
  if (!site) return res.status(500).json({ error: "CLIENT_ORIGIN is not set, so the on-spot link can't be made." });
  res.json({ url: `${site}/events?onspot=${onSpotToken()}`, validOn: istDate() });
});

/**
 * PATCH /api/registrations/mine/team-members - the team lead adds or
 * corrects their members' department and year of study.
 * Body: { members: [{ department, yearOfStudy }] } in the team's order.
 */
router.patch("/mine/team-members", requireAuth, requireRole("participant"), async (req, res) => {
  try {
    const registration = await prisma.registration.findUnique({ where: { userId: req.user.id } });
    if (!registration) return res.status(404).json({ error: "No registration found for this account" });
    if (registration.status === "rejected") return res.status(409).json({ error: "This registration was rejected." });
    const result = applyMemberDetails(registration.teamMembers, req.body?.members);
    if (result.error) return res.status(400).json({ error: result.error });
    const updated = await prisma.registration.update({
      where: { id: registration.id },
      data: { teamMembers: result.teamMembers },
      select: { teamMembers: true },
    });
    res.json({ teamMembers: updated.teamMembers });
  } catch (err) {
    console.error("Update team members error:", err);
    res.status(500).json({ error: "Couldn't save the team details" });
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

    res.json({ registration: { ...registration, idCardToken: idCardToken(registration.registrationCode) } });
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
      // Pay later and not paid yet: take the cash (collect-cash) or wait for
      // their online payment - never approve with nothing paid.
      if (current.paymentMethod === PAY_LATER) {
        return res.status(409).json({ error: `No payment yet - collect ₹${current.totalAmount} in cash (Cash received) or wait for their online payment.` });
      }

      const registration = await prisma.$transaction(async (tx) => {
        // Approving a rejected registration takes its seats back first (staff
        // may use on-spot seats too).
        await applySeatChange(tx, current, current.status, "approved", { online: false });
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

/**
 * PATCH /api/registrations/:id/collect-cash { amountCollected } - a "pay
 * later" participant pays in cash at the registration desk: approved on the
 * spot (ID card and approval email follow). Also works after the event's
 * start released the seat, if seats remain. The amount must be exactly what's due.
 */
router.patch(
  "/:id/collect-cash",
  requireAuth,
  requireRole("registration_team", "master_admin"),
  async (req, res) => {
    try {
      const current = await prisma.registration.findUnique({ where: { id: req.params.id }, include: { user: true } });
      if (!current) return res.status(404).json({ error: "Registration not found" });
      if (current.paymentMethod !== PAY_LATER || current.status === "approved") {
        return res.status(409).json({ error: "Only an unpaid pay-later registration can be paid in cash here." });
      }
      if (Number(req.body?.amountCollected) !== current.totalAmount) {
        return res.status(400).json({ error: `Collect ₹${current.totalAmount} for this registration (entered: ₹${Number(req.body?.amountCollected) || 0}).` });
      }
      const registration = await prisma.$transaction(async (tx) => {
        // Only one desk can take the money: the row must still be unpaid.
        const { count } = await tx.registration.updateMany({
          where: { id: current.id, paymentMethod: PAY_LATER, status: { not: "approved" } },
          data: { status: "approved", paymentMethod: "cash", rejectionReason: null, ...reviewedBy(req) },
        });
        if (!count) throw Object.assign(new Error("This registration was just paid at another desk."), { status: 409 });
        // A seat released when the event started is taken again (409 if full);
        // the desk may use on-spot seats.
        await applySeatChange(tx, current, current.status, "approved", { online: false });
        return tx.registration.findUnique({ where: { id: current.id }, include: { user: true } });
      });
      res.json({ registration });
      sendApprovalEmail(registration).catch((err) => console.warn("Approval email error:", err.message));
    } catch (err) {
      if (err.status) return res.status(err.status).json({ error: err.message });
      console.error("Collect cash error:", err);
      res.status(500).json({ error: "Failed to record the cash payment" });
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
      // Newly rejected: the participant is told why and how to resubmit (once).
      // Someone already approved was told they're in, so theirs reads as a
      // cancellation (e.g. a college student in free Junior events).
      if (current.status !== "rejected") sendRejectionEmail(registration, { cancelled: current.status === "approved" });
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
      if (data.status) await applySeatChange(tx, current, current.status, data.status, { online: false });
      return tx.registration.update({ where: { id: current.id }, data });
    });
    res.json({ registration });
    // A decision the participant hasn't been told yet gets its email (once).
    if (data.status === "approved" && current.status !== "approved") sendApprovalEmail(registration);
    if (data.status === "rejected" && current.status !== "rejected") sendRejectionEmail(registration);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Override error:", err);
    res.status(500).json({ error: "Failed to override registration" });
  }
});

/**
 * POST /api/registrations/:id/password { password } - the registration desk
 * sets a new login password for a participant who has forgotten theirs
 * (participants can't reset it themselves). Never logged.
 */
router.post("/:id/password", requireAuth, requireRole("registration_team", "master_admin"), async (req, res) => {
  try {
    const password = typeof req.body?.password === "string" ? req.body.password : "";
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      return res.status(400).json({ error: `The password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters.` });
    }
    const registration = await prisma.registration.findUnique({
      where: { id: req.params.id },
      include: { user: { select: { id: true, role: true, email: true } } },
    });
    if (!registration) return res.status(404).json({ error: "Registration not found" });
    if (registration.user.role !== "participant") {
      return res.status(400).json({ error: "Only participant passwords can be changed here." });
    }
    await prisma.user.update({ where: { id: registration.user.id }, data: { passwordHash: await bcrypt.hash(password, 10) } });
    console.log(`Login password for ${registration.registrationCode} changed by ${req.user.name || req.user.id}.`);
    res.json({ email: registration.user.email, canSignIn: registration.status === "approved" });
  } catch (err) {
    console.error("Set password error:", err);
    res.status(500).json({ error: "Couldn't change the password" });
  }
});

module.exports = router;
