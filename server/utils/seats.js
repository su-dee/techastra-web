/**
 * Seat bookkeeping for registrations. A registration holds its seats while
 * it is pending or approved; rejecting it gives them back, and moving it out
 * of "rejected" again (approve / override / resubmit) takes them again - so
 * rejected registrations never block real participants.
 */
const { seatsNeeded, registrationTeamSize } = require("./validation");

/**
 * Reserves seats atomically inside a transaction: the conditional UPDATE only
 * succeeds while enough seats are left, so concurrent registrations can't
 * oversell. Throws a 409 error naming the full event.
 */
async function reserveSeats(tx, events, teamSize) {
  for (const ev of events) {
    const n = seatsNeeded(ev, teamSize);
    const updated = await tx.$executeRaw`UPDATE "Event" SET "seatsTaken" = "seatsTaken" + ${n}, "updatedAt" = NOW() WHERE "id" = ${ev.id} AND "seatsTaken" + ${n} <= "maxSeats"`;
    if (updated !== 1) {
      const err = new Error(`"${ev.name}" doesn't have ${n > 1 ? `${n} seats` : "a seat"} left`);
      err.status = 409;
      throw err;
    }
  }
}

/** Seats a saved registration holds, as [event, count] pairs. */
async function heldSeats(tx, registration) {
  const events = await tx.event.findMany({ where: { id: { in: registration.eventIds } } });
  const size = registrationTeamSize(registration);
  return { events, size };
}

/** Takes the seats for a saved registration again (e.g. leaving "rejected"). */
async function reserveForRegistration(tx, registration) {
  const { events, size } = await heldSeats(tx, registration);
  await reserveSeats(tx, events, size);
}

/** Gives a saved registration's seats back (e.g. when it is rejected). */
async function releaseForRegistration(tx, registration) {
  const { events, size } = await heldSeats(tx, registration);
  for (const ev of events) {
    const n = seatsNeeded(ev, size);
    await tx.$executeRaw`UPDATE "Event" SET "seatsTaken" = GREATEST("seatsTaken" - ${n}, 0), "updatedAt" = NOW() WHERE "id" = ${ev.id}`;
  }
}

/**
 * Applies the seat change for a status move: leaving "rejected" reserves,
 * entering it releases; other moves (pending <-> approved) keep the seats.
 */
async function applySeatChange(tx, registration, fromStatus, toStatus) {
  if (fromStatus === "rejected" && toStatus !== "rejected") await reserveForRegistration(tx, registration);
  else if (fromStatus !== "rejected" && toStatus === "rejected") await releaseForRegistration(tx, registration);
}

module.exports = { reserveSeats, reserveForRegistration, releaseForRegistration, applySeatChange };
