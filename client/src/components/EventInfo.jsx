import React from "react";
import { CATEGORY_LABEL, categoryOf, dayOf } from "../lib/site";

export function formatDay(event) {
  const day = dayOf(event);
  if (day) return `Day 0${day}`;
  return new Date(event.startTime).toLocaleDateString([], { weekday: "short", day: "numeric", month: "short" });
}

export function formatTimeRange(event) {
  const t = (iso) => new Date(iso).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
  return `${t(event.startTime)} – ${t(event.endTime)}`;
}

export function teamLabel(event) {
  if (!event.isTeamEvent) return "Individual";
  return event.minTeamSize === event.maxTeamSize
    ? `Team of ${event.maxTeamSize}`
    : `Team of ${event.minTeamSize}–${event.maxTeamSize}`;
}

export function seatsLabel(event) {
  if (event.seatsAvailable == null) return `${event.maxSeats} seats`;
  return event.seatsAvailable <= 0 ? "Full" : `${event.seatsAvailable} of ${event.maxSeats} left`;
}

export function kickerFor(event) {
  const cat = CATEGORY_LABEL[categoryOf(event)];
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
    ["Fee", `₹${event.fee}`],
    ["Seats", seatsLabel(event)],
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
          <p className="prose-muted !text-[14px]">{event.rulebook}</p>
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
