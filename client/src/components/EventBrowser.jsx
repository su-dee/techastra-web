import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import EventArt from "./EventArt";
import EventInfo, { formatDay, formatFee, formatTimeRange, kickerFor, teamLabel } from "./EventInfo";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { CATEGORY_LABEL, DAYS, LEVEL_LABEL, categoryOf, levelOf } from "../lib/site";

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
  // Prev/Next inside the modal: swap the event without adding history, so
  // Back still closes the modal in one step.
  const go = useCallback(
    (e) =>
      setParams(
        (p) => {
          p.set("event", e.id);
          return p;
        },
        { replace: true }
      ),
    [setParams]
  );
  return { active, open, close, go };
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
            {v} events
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
      {/* Always both days, so Senior and Junior get the same layout; a day with
          no events for the chosen level is shown but disabled. */}
      {onDay && (
        <div className="events__chips" role="group" aria-label="Day">
          <button className={"chip" + (day === "all" ? " is-active" : "")} aria-pressed={day === "all"} onClick={() => onDay("all")}>
            ALL DAYS
          </button>
          {DAYS.map((d) => {
            const empty = !days.includes(d.id);
            return (
              <button
                key={d.id}
                className={"chip" + (day === d.id ? " is-active" : "")}
                aria-pressed={day === d.id}
                disabled={empty}
                title={empty ? `No ${LEVEL_LABEL[level].toLowerCase()} events on this day` : undefined}
                onClick={() => onDay(d.id)}
              >
                {d.label.toUpperCase()}
              </button>
            );
          })}
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
      <EventArt event={event} className="ev__art" />
      {/* What kind of event it is, centred - same format for senior and junior */}
      <div className="ev__kind">
        <span className="pill">{LEVEL_LABEL[levelOf(event)].toUpperCase()} EVENT · {CATEGORY_LABEL[cat].toUpperCase()}</span>
      </div>
      <div className="ev__top">
        <span className="mono-label">{formatDay(event)}</span>
      </div>
      <h3>{event.name}</h3>
      <div className="ev__tagline">{event.track || teamLabel(event)}</div>
      <p className="ev__desc">{event.description}</p>
      <div className="ev__stats">
        <div>
          <span className="mono-label">Fee</span>
          <div>{formatFee(event.fee)}</div>
        </div>
        <div>
          <span className="mono-label">Participation</span>
          <div>{teamLabel(event)}</div>
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
          aria-label={inCart ? `Added - remove ${event.name} from cart` : full ? `${event.name} is full` : `Add to cart: ${event.name}`}
          data-log={`events-card-${inCart ? "remove" : "add"}-${event.id}`}
        >
          {inCart ? "✓ Added" : full ? "Full" : "Add to cart"}
        </button>
      </div>
    </article>
  );
}

/**
 * Event details. `list` (the cards in on-screen order) enables Prev/Next and
 * the ← / → keys; `onNavigate` opens another event in the same modal.
 */
export function EventModal({ event, onClose, inCart, onToggle, list = [], onNavigate }) {
  const navigate = useNavigate();
  const { findClash } = useCart();
  const topRef = useRef(null);

  const index = event ? list.findIndex((e) => e.id === event.id) : -1;
  const prev = index > 0 ? list[index - 1] : null;
  const next = index >= 0 && index < list.length - 1 ? list[index + 1] : null;

  useEffect(() => {
    if (!event || !onNavigate) return;
    const onKey = (e) => {
      if (e.altKey || e.ctrlKey || e.metaKey || e.shiftKey) return;
      if (e.target.closest?.("input, textarea, select, [contenteditable]")) return;
      const to = e.key === "ArrowLeft" ? prev : e.key === "ArrowRight" ? next : null;
      if (to) {
        e.preventDefault();
        onNavigate(to);
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [event, prev, next, onNavigate]);

  // A new event starts at the top of the panel.
  useEffect(() => {
    const panel = topRef.current?.closest(".modal__panel");
    if (panel) panel.scrollTop = 0;
  }, [event?.id]);

  const clash = event && !inCart ? findClash(event) : null;
  const full = event && event.seatsAvailable <= 0;

  return (
    <Modal open={!!event} onClose={onClose} tone={event && categoryOf(event)} kicker={event && kickerFor(event)} title={event?.name}>
      {event && (
        <>
          <EventArt event={event} className="modal__art" />
          <div ref={topRef} />
          {onNavigate && (prev || next) && (
            <nav className="modal__nav" aria-label="Other events">
              {prev ? (
                <button type="button" onClick={() => onNavigate(prev)} aria-label={`Previous event: ${prev.name}`}>
                  <span aria-hidden="true">←</span> <span className="modal__nav-name">{prev.name}</span>
                </button>
              ) : (
                <span />
              )}
              {next && (
                <button type="button" onClick={() => onNavigate(next)} aria-label={`Next event: ${next.name}`}>
                  <span className="modal__nav-name">{next.name}</span> <span aria-hidden="true">→</span>
                </button>
              )}
            </nav>
          )}
          <EventInfo event={event} />

          {/* Always in view: what it costs and the one action to take. */}
          <div className="modal__bar">
            {clash && (
              <p className="modal__clash" role="status">
                <span aria-hidden="true">⚠</span> Clashes with <b>{clash}</b> in your cart (same time). Remove it to add
                this event.
              </p>
            )}
            <div className="modal__bar-row">
              <div className="modal__bar-info">
                <span className="text-amber-light tabular-nums">{formatFee(event.fee)}</span> · {teamLabel(event)}
              </div>
              {inCart ? (
                <div className="modal__bar-actions">
                  <button className="btn-ghost-sm" onClick={() => onToggle(event)}>
                    Remove from cart
                  </button>
                  <button className="btn-small" onClick={() => navigate("/register/form")}>
                    Continue to your details →
                  </button>
                </div>
              ) : (
                <div className="modal__bar-actions">
                  <button
                    className="btn-small disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={full || !!clash}
                    onClick={() => onToggle(event)}
                    data-log={`events-modal-add-${event.id}`}
                  >
                    {full ? "Seats full" : clash ? "Time clash" : "Add to cart"}
                  </button>
                </div>
              )}
            </div>
          </div>
        </>
      )}
    </Modal>
  );
}
