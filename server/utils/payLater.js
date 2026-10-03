const prisma = require("../db");
const { applySeatChange } = require("./seats");
const { sendRejectionEmail } = require("./registrationEmails");

/**
 * "Pay later": a paid registration can block its seats without paying yet.
 * It is saved as status "pending" with paymentMethod "later" (no UTR, no
 * screenshot), holds its seats, and gets no ID card - only approved
 * registrations can sign in or pass a QR check. The participant then pays
 * online (status page: UTR + screenshot, checked by the desk like any UPI
 * payment) or in cash at the registration desk (approved on the spot).
 *
 * Unpaid holds are released at PAY_LATER_DEADLINE: they become "rejected"
 * (seats freed) with an email. A released registration can still pay online
 * or at the desk later, while seats remain.
 */
const DEFAULT_DEADLINE = "2026-10-07T23:59:00+05:30";
const PAY_LATER = "later";

function payLaterDeadline() {
  const d = new Date(process.env.PAY_LATER_DEADLINE || DEFAULT_DEADLINE);
  return Number.isNaN(d.getTime()) ? new Date(DEFAULT_DEADLINE) : d;
}

/** "7 Oct, 11:59 PM" in IST, for messages and emails. */
function formatDeadline(d = payLaterDeadline()) {
  return d
    .toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    .replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

const payLaterOpen = (now = new Date()) => now < payLaterDeadline();

/** Seats blocked, nothing paid yet. */
const isPaymentDue = (registration) => registration.status === "pending" && registration.paymentMethod === PAY_LATER;

/** Releases every unpaid hold once the deadline has passed. Returns how many. */
async function releaseExpiredHolds(now = new Date()) {
  if (payLaterOpen(now)) return 0;
  const due = await prisma.registration.findMany({ where: { status: "pending", paymentMethod: PAY_LATER } });
  let released = 0;
  for (const reg of due) {
    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction: it may have been paid meanwhile.
        const { count } = await tx.registration.updateMany({
          where: { id: reg.id, status: "pending", paymentMethod: PAY_LATER },
          data: {
            status: "rejected",
            rejectionReason: `Seat released: payment not received by ${formatDeadline()}`,
            reviewedById: null,
            reviewedByName: "Automatic (payment deadline)",
            reviewedAt: now,
          },
        });
        if (!count) return null;
        await applySeatChange(tx, reg, "pending", "rejected");
        return tx.registration.findUnique({ where: { id: reg.id } });
      });
      if (updated) {
        released++;
        sendRejectionEmail(updated);
      }
    } catch (err) {
      console.error(`Releasing unpaid hold ${reg.registrationCode} failed:`, err.message);
    }
  }
  if (released) console.log(`Released ${released} unpaid pay-later registration(s) after the deadline.`);
  return released;
}

/** Checks for expired holds now and every few minutes (and on demand from routes). */
function startHoldReleaser(intervalMs = 5 * 60 * 1000) {
  const run = () => releaseExpiredHolds().catch((err) => console.error("Hold releaser error:", err.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}

module.exports = { PAY_LATER, payLaterDeadline, formatDeadline, payLaterOpen, isPaymentDue, releaseExpiredHolds, startHoldReleaser };
