import React, { useCallback, useEffect, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import toast from "react-hot-toast";
import Modal from "./ui/Modal";
import EventArt from "./EventArt";
import EventInfo, { formatDay, formatFee, formatTimeRange, kickerFor, teamLabel } from "./EventInfo";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { CATEGORY_LABEL, DAYS, LEVEL_LABEL, categoryOf, levelOf, registrationClosed } from "../lib/site";
import { priceLabel } from "../lib/pricing";
import { eventsPath, confirmOnSpot, getOnSpotToken } from "../lib/onSpot";

// Shared pieces for pages that list events (Home, Events): data loading,
// cart toggling, the event card and the details modal.

export function useEvents() {
  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  // Opened from the registration desk's on-spot QR (lib/onSpot.js).
  const [onSpot, setOnSpot] = useState(() => !!getOnSpotToken());
  useEffect(() => {
    const hadToken = !!getOnSpotToken();
    api
      .get(eventsPath())
      .then((data) => {
        setEvents(data.events || []);
        const valid = confirmOnSpot(data);
        setOnSpot(valid);
        if (hadToken && !valid) toast("This on-spot link has expired - ask the registration desk for today's QR.", { id: "onspot-expired" });
      })
      .catch(() => toast.error("Failed to load events"))
      .finally(() => setLoading(false));
  }, []);
  return { events, loading, onSpot };
}

export function useCartToggle() {
  const { items, addItem, removeItem } = useCart();
  const inCart = useCallback((id) => items.some((i) => i.id === id), [items]);
  const toggle = (event) => {
    if (inCart(event.id)) {
      const removed = removeItem(event.id);
      if (!removed.ok) toast.error(removed.reason);
      else toast.success(`${event.name} removed from cart`);
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
                {/* Short on phones so the day chips fit one row. */}
                <span className="sm:hidden" aria-hidden="true">{d.short.toUpperCase()}</span>
                <span className="hidden sm:inline">{d.label.toUpperCase()}</span>
                <span className="sr-only sm:hidden">{d.label}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

/**
 * For events registered on their own website (Hack Nexus): a link out in
 * place of "Add to cart", or a disabled "coming soon" until the URL is set.
 */
export function ExternalRegisterButton({ event, className = "btn-small", short = false }) {
  if (!event.registrationUrl) {
    return (
      <button type="button" className={`${className} disabled:opacity-50 disabled:cursor-not-allowed`} disabled>
        {short ? "Link soon" : "Registration link coming soon"}
      </button>
    );
  }
  // A path on this site (Hack Nexus at /hacknexus/) opens in the same tab; a
  // different website opens in a new one. A plain <a>, not a router Link:
  // that path is a separate app, not a page of this one.
  const sameSite = event.registrationUrl.startsWith("/");
  return (
    <a
      href={event.registrationUrl}
      {...(sameSite ? {} : { target: "_blank", rel: "noopener noreferrer" })}
      className={className}
      aria-label={sameSite ? `Register for ${event.name}` : `Register for ${event.name} on its own website (opens in a new tab)`}
      data-log={`events-external-${event.id}`}
    >
      {short ? "Register ↗" : `Register for ${event.name} ↗`}
    </a>
  );
}

export function EventCard({ event, inCart, onOpen, onToggle }) {
  const cat = categoryOf(event);
  const full = event.seatsAvailable <= 0;
  const closed = registrationClosed(event);
  // A combo pass stands alone: its events show as part of the combo, and
  // nothing else can be added while it's in the cart.
  const { items, activeCombo } = useCart();
  const comboName = items.find((i) => i.id === event.id && i.isComboItem)?.comboName;
  const lockedByCombo = !inCart && !!activeCombo;
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
          <div>{priceLabel(event)}</div>
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
        {event.externalRegistration ? (
          <ExternalRegisterButton event={event} className="ev__action btn-small" short />
        ) : (
          <button
            className={"ev__action " + (inCart ? "btn-ghost-sm" : "btn-small")}
            onClick={() => onToggle(event)}
            disabled={(!inCart && (full || closed)) || !!comboName || lockedByCombo}
            aria-label={
              comboName
                ? `${event.name} is part of ${comboName} in your cart`
                : lockedByCombo
                  ? `${event.name} can't be added: your cart has the ${activeCombo.name} pass`
                  : inCart
                    ? `Added - remove ${event.name} from cart`
                    : closed
                      ? `Registration for ${event.name} has closed`
                      : full
                        ? `${event.name} is full`
                        : `Add to cart: ${event.name}`
            }
            data-log={`events-card-${inCart ? "remove" : "add"}-${event.id}`}
          >
            {comboName ? `✓ In ${comboName}` : lockedByCombo ? "Combo selected" : inCart ? "✓ Added" : closed ? "Closed" : full ? "Full" : "Add to cart"}
          </button>
        )}
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
  const { findClash, items, activeCombo, removeCombo } = useCart();
  const topRef = useRef(null);
  const comboItem = event ? items.find((i) => i.id === event.id && i.isComboItem) : null;
  const lockedByCombo = !!event && !inCart && !!activeCombo && !event.externalRegistration;

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

  const clash = event && !inCart && !event.externalRegistration ? findClash(event) : null;
  const full = event && event.seatsAvailable <= 0;
  const closed = event && registrationClosed(event);

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
            {event.externalRegistration && (
              <p className="text-[13px] text-soft mb-3">
                {event.name} has its own registration website - it isn’t registered through this portal or the cart.
              </p>
            )}
            {comboItem && (
              <p className="text-[13px] text-soft mb-3">
                Part of <b className="text-heading">{comboItem.comboName}</b> - combo events can only be removed together.
              </p>
            )}
            {lockedByCombo && (
              <p className="modal__clash" role="status">
                <span aria-hidden="true">ⓘ</span> Your cart has the <b>{activeCombo.name}</b> pass, which is registered on
                its own. Remove the combo to choose events individually.
              </p>
            )}
            {clash && !lockedByCombo && (
              <p className="modal__clash" role="status">
                <span aria-hidden="true">⚠</span> Clashes with <b>{clash}</b> in your cart (same time). Remove it to add
                this event.
              </p>
            )}
            <div className="modal__bar-row">
              <div className="modal__bar-info">
                <span className="text-amber-light tabular-nums">{priceLabel(event)}</span> · {teamLabel(event)}
              </div>
              {event.externalRegistration ? (
                <div className="modal__bar-actions">
                  <ExternalRegisterButton event={event} />
                </div>
              ) : inCart ? (
                <div className="modal__bar-actions">
                  {comboItem ? (
                    <button
                      className="btn-ghost-sm"
                      onClick={() => {
                        removeCombo(comboItem.comboId);
                        toast.success(`${comboItem.comboName} removed from cart`);
                      }}
                    >
                      Remove {comboItem.comboName}
                    </button>
                  ) : (
                    <button className="btn-ghost-sm" onClick={() => onToggle(event)}>
                      Remove from cart
                    </button>
                  )}
                  <button className="btn-small" onClick={() => navigate("/register/form")}>
                    Continue to your details →
                  </button>
                </div>
              ) : (
                <div className="modal__bar-actions">
                  <button
                    className="btn-small disabled:opacity-50 disabled:cursor-not-allowed"
                    disabled={closed || full || !!clash || lockedByCombo}
                    onClick={() => onToggle(event)}
                    data-log={`events-modal-add-${event.id}`}
                  >
                    {closed ? "Registration closed" : full ? "Seats full" : lockedByCombo ? "Combo selected" : clash ? "Time clash" : "Add to cart"}
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
