import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import EventInfo, { formatDay, formatTimeRange, kickerFor, seatsLabel, teamLabel } from "./EventInfo";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { CATEGORY_LABEL, LEVEL_LABEL, categoryOf, levelOf } from "../lib/site";

// Shared pieces for pages that list events (Home, Events): data loading,
// cart toggling, the event card and the details modal.

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    api
      .get("/api/events")
      .then((data) => setEvents(data.events || []))
      .catch(() => toast.error("Failed to load events"))
      .finally(() => setLoading(false));
  }, []);
  return { events, loading };
}

export function useCartToggle() {
  const { items, addItem, removeItem } = useCart();
  const inCart = useCallback((id) => items.some((i) => i.id === id), [items]);
  const toggle = (event) => {
    if (inCart(event.id)) {
      removeItem(event.id);
      toast.success(`${event.name} removed from cart`);
      return;
    }
    const result = addItem(event);
    if (!result.ok) toast.error(result.reason);
    else toast.success(`${event.name} added to cart`);
  };
  return { items, inCart, toggle };
}

// The open modal lives in the URL (?event=<id>) so it survives refresh and
// the browser Back button closes it.
export function useEventModal(events) {
  const [params, setParams] = useSearchParams();
  const activeId = params.get("event");
  const active = events.find((e) => e.id === activeId) || null;
  const open = useCallback(
    (e) =>
      setParams((p) => {
        p.set("event", e.id);
        return p;
      }),
    [setParams]
  );
  const close = useCallback(
    () =>
      setParams(
        (p) => {
          p.delete("event");
          return p;
        },
        { replace: true }
      ),
    [setParams]
  );
  return { active, open, close };
}

const CATEGORY_FILTERS = [
  ["all", "ALL"],
  ["technical", "TECHNICAL"],
  ["non_technical", "NON-TECHNICAL"],
];

// Level lives in the URL (?level=junior) so links can point straight at
// the junior events; with no param it follows the cart, else Senior.
export function useLevelFilter(items) {
  const [params, setParams] = useSearchParams();
  const fromUrl = params.get("level");
  const level = fromUrl === "junior" || fromUrl === "senior" ? fromUrl : items[0] ? levelOf(items[0]) : "senior";
  const setLevel = useCallback(
    (l) =>
      setParams(
        (p) => {
          p.set("level", l);
          return p;
        },
        { replace: true }
      ),
    [setParams]
  );
  return [level, setLevel];
}

// Senior/Junior switch + category (and optional day) chips, laid out like
// the main site's events header.
export function EventFilters({ level, onLevel, category, onCategory, days = [], day, onDay }) {
  return (
    <div className="events__filters">
      <div className="seg" role="group" aria-label="Level">
        {Object.entries(LEVEL_LABEL).map(([k, v]) => (
          <button key={k} className={level === k ? "is-active" : ""} aria-pressed={level === k} onClick={() => onLevel(k)} data-log={`events-level-${k}`}>
            {v}
          </button>
        ))}
      </div>
      <div className="events__chips" role="group" aria-label="Category">
        {CATEGORY_FILTERS.map(([k, v]) => (
          <button key={k} className={"chip" + (category === k ? " is-active" : "")} aria-pressed={category === k} onClick={() => onCategory(k)} data-log={`events-filter-${k}`}>
            {v}
          </button>
        ))}
      </div>
      {onDay && days.length > 1 && (
        <div className="events__chips" role="group" aria-label="Day">
          {["all", ...days].map((d) => (
            <button key={d} className={"chip" + (day === d ? " is-active" : "")} aria-pressed={day === d} onClick={() => onDay(d)}>
              {d === "all" ? "ALL DAYS" : `DAY 0${d}`}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export function EventCard({ event, inCart, onOpen, onToggle }) {
  const cat = categoryOf(event);
  const full = event.seatsAvailable <= 0;
  return (
    <article className={"card ev" + (inCart ? " is-selected" : "")}>
      <button className="ev__open" onClick={() => onOpen(event)} aria-label={`${event.name} — view details`} data-log={`events-card-open-${event.id}`} />
      <div className={"orb ev__orb ev__orb--" + cat} aria-hidden="true" />
      <div className="ev__top">
        <span className="mono-label">{formatDay(event)}</span>
        <span className="pill">{LEVEL_LABEL[levelOf(event)].toUpperCase()} · {CATEGORY_LABEL[cat].toUpperCase()}</span>
      </div>
      <h3>{event.name}</h3>
      <div className="ev__tagline">{event.track || teamLabel(event)}</div>
      <p className="ev__desc">{event.description}</p>
      <div className="ev__stats">
        <div>
          <span className="mono-label">Fee</span>
          <div>₹{event.fee}</div>
        </div>
        <div>
          <span className="mono-label">Seats</span>
          <div className={full ? "text-danger" : ""}>{seatsLabel(event)}</div>
        </div>
      </div>
      <div className="ev__foot">
        <span className="ev__meta">
          {formatTimeRange(event)}
          {event.venue ? ` · ${event.venue}` : ""}
        </span>
        <button
          className={"ev__action " + (inCart ? "btn-ghost-sm" : "btn-small")}
          onClick={() => onToggle(event)}
          disabled={!inCart && full}
          aria-label={inCart ? `Remove ${event.name} from cart` : `Add ${event.name} to cart`}
          data-log={`events-card-${inCart ? "remove" : "add"}-${event.id}`}
        >
          {inCart ? "✓ Added" : full ? "Full" : "Add"}
        </button>
      </div>
    </article>
  );
}

export function EventModal({ event, onClose, inCart, onToggle }) {
  const navigate = useNavigate();
  return (
    <Modal open={!!event} onClose={onClose} tone={event && categoryOf(event)} kicker={event && kickerFor(event)} title={event?.name}>
      {event && (
        <>
          <EventInfo event={event} />
          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            {inCart ? (
              <>
                <button className="btn-small modal__cta !mt-0 flex-1" onClick={() => navigate("/register")}>
                  Continue to registration →
                </button>
                <button className="btn-ghost-sm !py-4 sm:w-auto" onClick={() => onToggle(event)}>
                  Remove from cart
                </button>
              </>
            ) : (
              <button
                className="btn-small modal__cta !mt-0 flex-1 disabled:opacity-50"
                disabled={event.seatsAvailable <= 0}
                onClick={() => onToggle(event)}
                data-log={`events-modal-add-${event.id}`}
              >
                {event.seatsAvailable <= 0 ? "Seats full" : `Add ${event.name} to cart — ₹${event.fee}`}
              </button>
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
