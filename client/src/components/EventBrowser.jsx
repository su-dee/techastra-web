import React, { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import EventInfo, { formatDay, formatTimeRange, kickerFor, seatsLabel, teamLabel } from "./EventInfo";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { CATEGORY_LABEL, categoryOf } from "../lib/site";

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
  const open = useCallback((e) => setParams({ event: e.id }), [setParams]);
  const close = useCallback(() => setParams({}, { replace: true }), [setParams]);
  return { active, open, close };
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
        <span className="pill">{CATEGORY_LABEL[cat].toUpperCase()}</span>
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
