/**
 * When coordinators may check participants in (QR scan or the manual button):
 * from an hour before the event starts. Earlier check-ins were being marked
 * days ahead by mistake, so the server refuses them until then.
 *
 * Local testing only: CHECKIN_ANYTIME=1 lifts the lock outside production.
 */
const OPENS_BEFORE_MS = 60 * 60 * 1000;

const checkinOpensAt = (event) => new Date(new Date(event.startTime).getTime() - OPENS_BEFORE_MS);

const istTime = (d) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

/** Why a check-in isn't allowed yet, or null when it is. */
function checkinNotOpen(event, now = new Date()) {
  if (process.env.CHECKIN_ANYTIME === "1" && process.env.NODE_ENV !== "production") return null;
  const opens = checkinOpensAt(event);
  if (now >= opens) return null;
  return `Check-in for ${event.name} opens at ${istTime(opens)} (an hour before the event). Scan participants' QR codes then.`;
}

module.exports = { checkinOpensAt, checkinNotOpen, OPENS_BEFORE_MS };
