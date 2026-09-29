// Registration pricing - mirrors computeTotal/eventCharge in
// server/utils/validation.js (the server always recalculates the amount).
//
//   - every senior event costs its fee PER PERSON, and every member of a
//     registration takes part in every event (team events as the team,
//     individual events each on their own): fee × team size;
//   - an event with feePerTeam (Hack Nexus) is a flat fee per team;
//   - a combo pass is its combo price per person (× team size);
//   - Junior events are free.

/** Price label for an event card / details: "Free", "₹100 per person", "₹1000 per team". */
export function priceLabel(event) {
  if (!event.fee) return "Free";
  return event.feePerTeam ? `₹${event.fee} per team` : `₹${event.fee} per person`;
}

/**
 * What one (non-combo) event costs for a registration of `teamSize` people.
 * Every member takes part in every event (a team event as the team, an
 * individual event each on their own), so it's fee × people - except a flat
 * per-team fee (Hack Nexus), charged once.
 */
export function eventCharge(event, teamSize = 1) {
  if (event.feePerTeam) return event.fee;
  return event.fee * Math.max(1, teamSize);
}

/**
 * How the details form registers this cart:
 *   "team"       - a team event needs 2+ people: the team form is required;
 *   "individual" - only individual events: individual form, no team;
 *   "either"     - team events that also allow 1 person (e.g. Crypt Clash 1-2).
 */
export function registrationKind(items) {
  const teamEvents = items.filter((i) => i.isTeamEvent);
  if (!teamEvents.length) return "individual";
  return teamEvents.some((i) => (i.minTeamSize || 1) >= 2) ? "team" : "either";
}

/** Combo passes in the cart: [{ id, name, price, events: [items] }]. */
export function combosIn(items) {
  const map = new Map();
  for (const i of items) {
    if (!i.isComboItem || !i.comboId) continue;
    if (!map.has(i.comboId)) map.set(i.comboId, { id: i.comboId, name: i.comboName, price: i.comboPrice, events: [] });
    map.get(i.comboId).events.push(i);
  }
  return [...map.values()];
}

/** Exact amount for the cart and a team of `teamSize` people (1 = individual). */
export function computeTotal(items, teamSize = 1) {
  const people = Math.max(1, teamSize);
  let total = 0;
  for (const combo of combosIn(items)) total += combo.price * people;
  for (const i of items) if (!i.isComboItem) total += eventCharge(i, people);
  return Math.round(total * 100) / 100;
}

/** Does the amount depend on how many people are in the team? */
export function dependsOnTeamSize(items) {
  // Only carts with a team event are registered as a team.
  if (!items.some((i) => i.isTeamEvent)) return false;
  return items.some((i) => i.fee > 0 && (i.isComboItem || !i.feePerTeam));
}

/**
 * The smallest team the cart can be registered with (for an estimate before
 * the team is entered): the largest minimum team size among its team events.
 */
export function smallestTeam(items) {
  return Math.max(1, ...items.filter((i) => i.isTeamEvent).map((i) => i.minTeamSize || 1));
}

/**
 * People allowed in a team registration for this cart, including the lead:
 * [min, max], the range every team event in the cart accepts. A team is at
 * least 2 people. (If the events share no size, the smallest team the cart
 * needs; the server's checkTeamSizes has the final say.)
 */
export function teamSizeRange(items) {
  const teamEvents = items.filter((i) => i.isTeamEvent);
  if (!teamEvents.length) return [1, 1];
  const min = Math.max(2, ...teamEvents.map((i) => i.minTeamSize || 1));
  const max = Math.min(...teamEvents.map((i) => i.maxTeamSize || i.minTeamSize || 1));
  return [min, Math.max(min, max)];
}
