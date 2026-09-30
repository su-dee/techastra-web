import { Router, json } from "express";
import { rateLimit } from "express-rate-limit";
import { randomInt, randomUUID } from "node:crypto";
import { membersOf } from "./members.js";
import { setting } from "./env.js";

// Organizer UPI details. Override with environment variables in production.
export const paymentConfig = {
  fee: Number(setting("REGISTRATION_FEE")) || 1000,
  vpa: setting("UPI_ID") || "7010826253-2@ybl",
  payee: setting("UPI_PAYEE_NAME") || "THIRUVENKATAM V",
};
export const MAX_SCREENSHOT_BYTES = 5 * 1024 * 1024;
export const PASS_PREFIX = "HACKNEXUS:";

// Check-in codes: 8 characters with no look-alikes (no 0/O, 1/I/L), about
// 40 bits. Only organizers can submit codes, so they cannot be guessed at
// scale. Short codes also keep the QR at its smallest, easiest-to-scan size.
const PASS_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const newPassCode = () =>
  Array.from(
    { length: 8 },
    () => PASS_ALPHABET[randomInt(PASS_ALPHABET.length)],
  ).join("");
// Reads a scanned QR or a typed code ("HACKNEXUS:K7MQX2RT", "k7mq-x2rt").
// Cards issued before short codes carry 32 hex characters.
export function parsePassCode(value) {
  if (typeof value !== "string") return null;
  let code = value.replace(/[\s-]/g, "").toUpperCase();
  if (code.startsWith(PASS_PREFIX)) code = code.slice(PASS_PREFIX.length);
  if (/^[A-HJKMNP-Z2-9]{8}$/.test(code)) return code;
  if (/^[A-F0-9]{32}$/.test(code)) return code.toLowerCase();
  return null;
}

// Short reference shown in the UPI note so organizers can match statements.
export const paymentReference = (registrationId) =>
  `HN-${registrationId.slice(0, 8).toUpperCase()}`;

export function upiUri(registrationId) {
  const params = new URLSearchParams({
    pa: paymentConfig.vpa,
    pn: paymentConfig.payee,
    am: paymentConfig.fee.toFixed(2),
    cu: "INR",
    tn: `HACK_NEXUS ${paymentReference(registrationId)}`,
  });
  // URLSearchParams encodes spaces as "+", which some UPI apps show literally.
  return `upi://pay?${params.toString().replace(/\+/g, "%20")}`;
}

export function normalizeTransactionId(value) {
  if (typeof value !== "string") return null;
  const id = value.replace(/[\s-]/g, "").toUpperCase();
  return /^[A-Z0-9]{8,35}$/.test(id) ? id : null;
}

// Accepts a data: URL and returns the decoded image only when its bytes match
// an allowed image format, whatever type the client claims.
export function parseScreenshot(value) {
  if (typeof value !== "string") return null;
  const match =
    /^data:image\/(?:png|jpeg|jpg|webp);base64,([A-Za-z0-9+/]+=*)$/.exec(value);
  if (!match) return null;
  const buffer = Buffer.from(match[1], "base64");
  if (!buffer.length || buffer.length > MAX_SCREENSHOT_BYTES) return null;
  if (
    buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
  )
    return { buffer, type: "image/png" };
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff)
    return { buffer, type: "image/jpeg" };
  if (
    buffer.subarray(0, 4).toString("latin1") === "RIFF" &&
    buffer.subarray(8, 12).toString("latin1") === "WEBP"
  )
    return { buffer, type: "image/webp" };
  return null;
}

export function createPaymentRouter(
  db,
  requireUser,
  { mailer = null, origin = "http://localhost:5173" } = {},
) {
  const router = Router();
  const submitLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many payment submissions. Try again shortly." },
  });
  const registrationFor = async (userId) =>
    (
      await db.query(
        "SELECT id,team_name,lead_email,domain,squad_size,problem_id,status,pass_code,checked_in_at,created_at FROM registrations WHERE user_id=$1",
        [userId],
      )
    ).rows[0];
  const paymentFor = async (registrationId) =>
    (
      await db.query(
        "SELECT status,amount,transaction_id,rejection_reason,submitted_at,reviewed_at FROM payments WHERE registration_id=$1",
        [registrationId],
      )
    ).rows[0] || null;

  router.get("/payments/me", requireUser, async (req, res) => {
    const registration = await registrationFor(req.user.id);
    if (!registration)
      return res
        .status(404)
        .json({ error: "Register your squad before making a payment." });
    const { pass_code, ...details } = registration;
    res.json({
      registration: details,
      payment: await paymentFor(registration.id),
      fee: paymentConfig.fee,
      upi: {
        uri: upiUri(registration.id),
        vpa: paymentConfig.vpa,
        payee: paymentConfig.payee,
        reference: paymentReference(registration.id),
      },
    });
  });

  // Screenshots need a larger body limit than the rest of the API.
  router.post(
    "/payments",
    submitLimiter,
    json({ limit: "8mb" }),
    requireUser,
    async (req, res) => {
      const registration = await registrationFor(req.user.id);
      if (!registration)
        return res
          .status(404)
          .json({ error: "Register your squad before making a payment." });
      const transactionId = normalizeTransactionId(req.body.transactionId);
      const screenshot = parseScreenshot(req.body.screenshot);
      if (!transactionId)
        return res.status(400).json({
          error:
            "Enter the UPI transaction ID (8–35 letters or digits) exactly as shown in your payment app.",
        });
      if (!screenshot)
        return res.status(400).json({
          error: "Attach a PNG, JPEG, or WebP payment screenshot under 5 MB.",
        });
      const existing = await paymentFor(registration.id);
      if (existing && existing.status !== "rejected")
        return res.status(409).json({
          error:
            existing.status === "verified"
              ? "Your payment is already verified."
              : "Your payment is already submitted and awaiting verification.",
        });
      try {
        // Replace a rejected submission; otherwise create the first one.
        await db.query(
          `INSERT INTO payments (id,registration_id,amount,transaction_id,screenshot,screenshot_type)
           VALUES ($1,$2,$3,$4,$5,$6)
           ON CONFLICT (registration_id) DO UPDATE SET amount=EXCLUDED.amount,transaction_id=EXCLUDED.transaction_id,
             screenshot=EXCLUDED.screenshot,screenshot_type=EXCLUDED.screenshot_type,status='submitted',
             rejection_reason='',submitted_at=NOW(),reviewed_at=NULL,reviewed_by=NULL
           WHERE payments.status='rejected'`,
          [
            randomUUID(),
            registration.id,
            paymentConfig.fee,
            transactionId,
            screenshot.buffer,
            screenshot.type,
          ],
        );
      } catch (error) {
        if (error.code === "23505")
          return res.status(409).json({
            error: "This transaction ID has already been submitted.",
          });
        throw error;
      }
      const payment = await paymentFor(registration.id);
      if (payment?.status !== "submitted")
        return res.status(409).json({
          error: "Your payment is already submitted and awaiting verification.",
        });
      res.status(201).json({ payment });
      // Sent after responding so a slow or failing mail server never blocks
      // the submission.
      if (mailer)
        membersOf(db, registration.id)
          .then((members) =>
            mailer.sendPaymentReceivedEmail({
              to: registration.lead_email,
              teamName: registration.team_name,
              registrationId: registration.id,
              squadSize: registration.squad_size,
              transactionId: payment.transaction_id,
              amount: payment.amount,
              members,
              statusUrl: `${origin}/payment`,
            }),
          )
          .catch((error) =>
            console.error(
              `Payment received email to ${registration.lead_email} failed:`,
              error.message,
            ),
          );
    },
  );

  router.get("/pass/me", requireUser, async (req, res) => {
    const registration = await registrationFor(req.user.id);
    const payment = registration && (await paymentFor(registration.id));
    if (
      !registration?.pass_code ||
      payment?.status !== "verified" ||
      registration.status !== "approved"
    )
      return res.status(404).json({
        error: "Your ID card will be available once your payment is verified.",
      });
    const { pass_code, ...details } = registration;
    const reference = paymentReference(registration.id);
    // One ID card per member. Contact details stay off the card.
    const members = (await membersOf(db, registration.id)).map((m) => ({
      position: m.position,
      participantId: `${reference}-${String(m.position).padStart(2, "0")}`,
      fullName: m.fullName,
      college: m.college,
    }));
    res.json({
      pass: {
        ...details,
        reference,
        members,
        qr: `${PASS_PREFIX}${pass_code}`,
        amount: payment.amount,
        transaction_id: payment.transaction_id,
      },
    });
  });

  return router;
}
