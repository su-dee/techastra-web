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
 * The seat is held until the registration's first event starts. An unpaid
 * hold is then released: it becomes "rejected" (seats freed) with an email.
 * The desk can still take cash for it afterwards, while seats remain.
 */
const PAY_LATER = "later";

/** When a hold on these events ends: the earliest event start. */
function holdEndsAt(events) {
  const starts = events.map((e) => new Date(e.startTime).getTime()).filter(Number.isFinite);
  return starts.length ? new Date(Math.min(...starts)) : null;
}

/** "8 Oct, 9:30 AM" in IST, for messages and emails. */
function formatWhen(d) {
  return new Date(d)
    .toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
    .replace(/\b(am|pm)\b/, (m) => m.toUpperCase());
}

/** Seats blocked, nothing paid yet. */
const isPaymentDue = (registration) => registration.status === "pending" && registration.paymentMethod === PAY_LATER;

/** Releases every unpaid hold whose first event has started. Returns how many. */
async function releaseExpiredHolds(now = new Date()) {
  const due = await prisma.registration.findMany({ where: { status: "pending", paymentMethod: PAY_LATER } });
  if (!due.length) return 0;
  const events = await prisma.event.findMany({
    where: { id: { in: [...new Set(due.flatMap((r) => r.eventIds))] } },
    select: { id: true, name: true, startTime: true },
  });
  const byId = new Map(events.map((e) => [e.id, e]));
  let released = 0;
  for (const reg of due) {
    const regEvents = reg.eventIds.map((id) => byId.get(id)).filter(Boolean);
    const endsAt = holdEndsAt(regEvents);
    if (!endsAt || endsAt > now) continue;
    const first = regEvents.find((e) => new Date(e.startTime).getTime() === endsAt.getTime());
    try {
      const updated = await prisma.$transaction(async (tx) => {
        // Re-check inside the transaction: it may have been paid meanwhile.
        const { count } = await tx.registration.updateMany({
          where: { id: reg.id, status: "pending", paymentMethod: PAY_LATER },
          data: {
            status: "rejected",
            rejectionReason: `Seat released: payment not received before ${first ? first.name : "your event"} started (${formatWhen(endsAt)})`,
            reviewedById: null,
            reviewedByName: "Automatic (event started, not paid)",
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
  if (released) console.log(`Released ${released} unpaid pay-later registration(s) whose event has started.`);
  return released;
}

/** Checks for expired holds now and every minute (and on demand from routes). */
function startHoldReleaser(intervalMs = 60 * 1000) {
  const run = () => releaseExpiredHolds().catch((err) => console.error("Hold releaser error:", err.message));
  run();
  const timer = setInterval(run, intervalMs);
  timer.unref();
  return timer;
}

module.exports = { PAY_LATER, holdEndsAt, formatWhen, isPaymentDue, releaseExpiredHolds, startHoldReleaser };
