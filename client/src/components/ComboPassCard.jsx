import React from "react";
import toast from "react-hot-toast";
import Button from "./ui/Button";
import { useCart } from "../context/CartContext";
import { registrationClosed } from "../lib/site";

/**
 * Combo pass: several events at a bundled price. Shown in step 1 of
 * registration (pages/Events.jsx) under the event cards for the chosen level.
 */
export default function ComboPassCard({ combo, comboEvents, onAddCombo, inCart }) {
  const allEventsAvailable = comboEvents.every((e) => e.maxSeats - e.seatsTaken > 0);
  // Closes once registration for any of its events has (end of that day).
  const closed = comboEvents.some(registrationClosed);
  const free = combo.comboPrice === 0;
  const savingsPercent = combo.individualPrice > 0 ? Math.round((combo.savings / combo.individualPrice) * 100) : 0;
  // Junior Techastra: individual registration, teams are formed at the venue.
  const junior = comboEvents.some((e) => e.level === "junior");
  const { items, activeCombo, removeCombo } = useCart();
  const added = activeCombo?.id === combo.id;
  // One combo per registration, and nothing else alongside it.
  const blockedReason = added
    ? null
    : activeCombo
      ? `Only one combo per registration - ${activeCombo.name} is in your cart`
      : items.length
        ? "A combo is registered on its own - your cart already has events"
        : null;
  // Team needed for the whole pass: enough people for every team event, up to
  // the biggest one (smaller events are played by part of the team).
  const teamEvents = comboEvents.filter((e) => e.isTeamEvent);
  const teamMin = Math.max(1, ...teamEvents.map((e) => e.minTeamSize || 1));
  const teamMax = Math.max(1, ...teamEvents.map((e) => e.maxTeamSize || e.minTeamSize || 1));
  const teamLabel = !teamEvents.length ? "Individual" : `Team of ${teamMin === teamMax ? teamMax : `${teamMin}–${teamMax}`}`;
  const partial = teamEvents.filter((e) => (e.maxTeamSize || e.minTeamSize || 1) < teamMax);

  return (
    <article className="card p-6 relative">
      {savingsPercent > 0 && <span className="pill absolute top-5 right-5">Save {savingsPercent}%</span>}
      {free && <span className="pill absolute top-5 right-5">Free</span>}
      <h3 className="text-xl text-heading mb-2 pr-24">{combo.name}</h3>
      <p className="text-sm text-soft mb-3">{combo.description}</p>
      <p className="text-[13px] text-amber-light mb-4">
        {junior ? "Register individually · teams are formed at the venue" : teamLabel}
        {!junior && partial.length > 0 && (
          <span className="text-dim">
            {" "}
            · {partial.map((e) => `${e.maxTeamSize || e.minTeamSize} of you play ${e.name}`).join(", ")}
          </span>
        )}
      </p>

      <div className="mb-4 space-y-2">
        <div className="mono-label">Includes</div>
        {comboEvents.map((event) => (
          <div key={event.id} className="flex items-center gap-2 text-sm">
            <span className="w-1.5 h-1.5 rounded-full bg-amber" aria-hidden="true" />
            <span className="text-text">{event.name}</span>
            <span className="text-dim">· {event.fee > 0 ? `₹${event.fee} per person` : "Free"}</span>
          </div>
        ))}
      </div>

      <div className="flex items-end justify-between gap-4 pt-4 border-t border-line">
        {free ? (
          <div>
            <div className="text-2xl text-amber-light">Free</div>
            <div className="text-xs text-dim">Registration is free</div>
          </div>
        ) : (
          <div>
            {combo.savings > 0 && <div className="text-xs text-dim line-through mb-1">₹{combo.individualPrice}</div>}
            <div className="text-2xl text-amber-light tabular-nums">
              ₹{combo.comboPrice} <span className="text-[14px] text-soft">per person</span>
            </div>
            {combo.savings > 0 && <div className="text-xs text-success">You save ₹{combo.savings} per person</div>}
          </div>
        )}
        {added ? (
          <div className="flex flex-col items-end gap-2">
            <span className="text-sm text-amber-light">✓ In your cart</span>
            <button
              type="button"
              className="btn-ghost-sm"
              onClick={() => {
                removeCombo(combo.id);
                toast.success(`${combo.name} removed from cart`);
              }}
              aria-label={`Remove ${combo.name} from cart`}
            >
              Remove combo
            </button>
          </div>
        ) : blockedReason ? (
          <Button variant="outline" disabled aria-label={`${combo.name} can't be added: ${blockedReason}`} title={blockedReason}>
            {activeCombo ? "Another combo selected" : "Cart has events"}
          </Button>
        ) : closed ? (
          <Button variant="outline" disabled aria-label={`${combo.name}: registration closed`}>
            Registration closed
          </Button>
        ) : allEventsAvailable ? (
          <Button onClick={() => onAddCombo(combo, comboEvents)} aria-label={`Add to cart: ${combo.name}`}>
            Add to cart
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Events full
          </Button>
        )}
      </div>
      {blockedReason && <p className="mt-3 text-[13px] text-dim">{blockedReason}.</p>}
    </article>
  );
}
