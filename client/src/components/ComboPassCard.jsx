import React from "react";
import Button from "./ui/Button";

/**
 * Combo pass: several events at a bundled price. Shown in step 1 of
 * registration (pages/Events.jsx) under the event cards for the chosen level.
 */
export default function ComboPassCard({ combo, comboEvents, onAddCombo, inCart }) {
  const allEventsAvailable = comboEvents.every((e) => e.maxSeats - e.seatsTaken > 0);
  const free = combo.comboPrice === 0;
  const savingsPercent = combo.individualPrice > 0 ? Math.round((combo.savings / combo.individualPrice) * 100) : 0;
  // Junior Techastra: individual registration, teams are formed at the venue.
  const junior = comboEvents.some((e) => e.level === "junior");
  const added = comboEvents.length > 0 && comboEvents.every((e) => inCart(e.id));
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
            <span className="text-dim">· {event.fee > 0 ? `₹${event.fee}` : "Free"}</span>
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
            <div className="text-xs text-dim line-through mb-1">₹{combo.individualPrice}</div>
            <div className="text-2xl text-amber-light tabular-nums">₹{combo.comboPrice}</div>
            <div className="text-xs text-success">You save ₹{combo.savings}</div>
          </div>
        )}
        {added ? (
          <span className="text-sm text-amber-light">✓ In your cart</span>
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
    </article>
  );
}
