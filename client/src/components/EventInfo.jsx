import React from "react";
import { CATEGORY_LABEL, DAYS, LEVEL_LABEL, categoryOf, dayOf, levelOf } from "../lib/site";
import { getOnSpotToken } from "../lib/onSpot";
import { priceLabel } from "../lib/pricing";

// Symposium day the event ends on (Hack Nexus runs from Day 1 into Day 2).
function endDayOf(event) {
  const date = new Date(event.endTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return DAYS.find((d) => d.date === date)?.id ?? null;
}

function isMultiDay(event) {
  const end = endDayOf(event);
  return end != null && end !== dayOf(event);
}

export function formatDay(event) {
  const day = dayOf(event);
  const known = DAYS.find((d) => d.id === day);
  if (known && isMultiDay(event)) return "October 8–9, 2026 (Day 1–2)";
  if (known) return known.label; // "October 8, 2026 (Day 1)"
  return new Date(event.startTime).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
}

export function formatTimeRange(event) {
  const t = (iso) => new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
  if (isMultiDay(event)) return `${t(event.startTime)} (Day ${dayOf(event)}) – ${t(event.endTime)} (Day ${endDayOf(event)})`;
  return `${t(event.startTime)} – ${t(event.endTime)}`;
}

// Junior events are free (registration only collects the student's details).
export function formatFee(amount) {
  return amount > 0 ? `₹${amount}` : "Free";
}

export function teamLabel(event) {
  if (!event.isTeamEvent) return "Individual";
  return event.minTeamSize === event.maxTeamSize
    ? `Team of ${event.maxTeamSize}`
    : `Team of ${event.minTeamSize}–${event.maxTeamSize}`;
}

export function seatsLabel(event) {
  if (event.seatsAvailable == null) return `${event.maxSeats} seats`;
  // Online registration can't use the on-spot seats (lib/onSpot.js), so count only its share.
  const seats = getOnSpotToken() ? event.maxSeats : event.maxSeats - (event.onSpotSeats || 0);
  return event.seatsAvailable <= 0 ? "Full" : `${event.seatsAvailable} of ${seats} left`;
}

export function kickerFor(event) {
  const cat = `${LEVEL_LABEL[levelOf(event)]} ${CATEGORY_LABEL[categoryOf(event)]}`;
  return event.track ? `${cat} · ${event.track}` : cat;
}

function People({ contacts }) {
  if (!contacts?.length) return <div className="tba mt-2">To be announced</div>;
  return (
    <ul>
      {contacts.map((p) => (
        <li key={`${p.name}-${p.phone}`}>
          {p.name}
          {p.role && <span className="text-dim text-[13px]"> · {p.role}</span>}
          {p.phone && <a href={`tel:${p.phone}`}>{p.phone}</a>}
        </li>
      ))}
    </ul>
  );
}

// Facts grid + description + rulebook + contacts, in the order the main
// site's EventModal uses. Shared by the modal on /events and /events/:id.
export default function EventInfo({ event }) {
  const facts = [
    ["Day", formatDay(event)],
    ["Time", formatTimeRange(event)],
    ["Venue", event.venue],
    ["Format", teamLabel(event)],
    ["Fee", priceLabel(event)],
  ];

  return (
    <>
      <div className="facts">
        {facts.map(([k, v]) => (
          <div className="fact" key={k}>
            <div className="mono-label">{k}</div>
            <div className={v ? "" : "tba"}>{v || "TBA"}</div>
          </div>
        ))}
      </div>

      {event.description && (
        <div className="modal__block">
          <p className="prose-muted">{event.description}</p>
        </div>
      )}

      {event.rulebook && (
        <div className="modal__block">
          <h4 className="mono-label">Rules</h4>
          {/* Paragraphs; one whose first line ends in ":" gets that line as a subheading. */}
          {event.rulebook.split(/\n\s*\n/).map((para, i) => {
            const [first, ...rest] = para.split("\n");
            const heading = /:\s*$/.test(first) && rest.length ? first.replace(/:\s*$/, "") : null;
            return (
              <div key={i} className={i ? "mt-4" : ""}>
                {heading && <h5 className="rulebook__sub">{heading}</h5>}
                <p className="prose-muted !text-[14px]">{heading ? rest.join("\n") : para}</p>
              </div>
            );
          })}
        </div>
      )}

      <div className="modal__block people">
        <div>
          <div className="mono-label">Event coordinators</div>
          <People contacts={event.coordinatorContacts} />
        </div>
      </div>
    </>
  );
}
