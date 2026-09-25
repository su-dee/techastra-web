import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { getEventIconSrc, getEventImage } from "../lib/eventImages";
import { useLevelFilter } from "../components/EventBrowser";
import { LEVEL_AUDIENCE, LEVEL_LABEL, levelOf } from "../lib/site";

/**
 * Consolidated event registration list page showing all events in one
 * place with inline "Add to Cart" functionality. User can add events
 * directly from this list without navigating to individual event pages.
 *
 * Split into sections:
 * - TECHNICAL EVENTS
 * - NON-TECHNICAL EVENTS  
 * - COMBO PASSES (bundled events at discounted prices)
 */

function formatTime(iso) {
  return new Date(iso).toLocaleString([], { 
    weekday: "short", 
    month: "short",
    day: "numeric",
    hour: "2-digit", 
    minute: "2-digit" 
  });
}

function formatDay(day) {
  if (!day) return "";
  return `Day ${day}`;
}

function EventRow({ event, inCart, onAdd, onRemove }) {
  const iconSrc = getEventIconSrc(event) || getEventImage(event.name);
  const available = event.maxSeats - event.seatsTaken;
  const isFull = available <= 0;
  const isInCart = inCart(event.id);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="group relative bg-void/40 backdrop-blur-md border border-white/5 rounded-lg p-5 hover:border-arc/30 transition-all duration-300"
    >
      <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
        {/* Icon */}
        <div className="shrink-0">
          <img 
            src={iconSrc} 
            alt={event.name}
            className="w-12 h-12 sm:w-16 sm:h-16 rounded-lg object-cover"
          />
        </div>

        {/* Event Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-3 mb-2">
            <Link 
              to={`/events/${event.id}`}
              className="text-lg font-semibold text-offwhite hover:text-arc transition-colors"
            >
              {event.name}
            </Link>
            {event.isTeamEvent && (
              <Badge variant="outline" className="text-xs">
                Team {event.minTeamSize}-{event.maxTeamSize}
              </Badge>
            )}
          </div>
          
          <div className="flex flex-wrap items-center gap-3 text-sm text-offwhite/60">
            <span>{formatTime(event.startTime)}</span>
            {event.day && (
              <>
                <span className="text-offwhite/30">•</span>
                <span>{formatDay(event.day)}</span>
              </>
            )}
            {event.venue && (
              <>
                <span className="text-offwhite/30">•</span>
                <span>{event.venue}</span>
              </>
            )}
            <span className="text-offwhite/30">•</span>
            <span className={available < 10 ? "text-crimson" : ""}>
              {available} / {event.maxSeats} seats
            </span>
          </div>
        </div>

        {/* Price & Action */}
        <div className="flex items-center gap-4 sm:shrink-0">
          <div className="text-right">
            <div className="text-xl font-bold text-arc">₹{event.fee}</div>
          </div>
          
          {isInCart ? (
            <Button
              variant="outline"
              size="sm"
              onClick={() => onRemove(event)}
              className="border-crimson text-crimson hover:bg-crimson/10"
            >
              Remove
            </Button>
          ) : isFull ? (
            <Button variant="outline" size="sm" disabled>
              Full
            </Button>
          ) : (
            <Button
              size="sm"
              onClick={() => onAdd(event)}
              className="bg-arc hover:bg-arc/90 text-void"
            >
              Add to Cart
            </Button>
          )}
        </div>
      </div>
    </motion.div>
  );
}

function ComboPassCard({ combo, comboEvents, onAddCombo }) {
  const allEventsAvailable = comboEvents.every(e => (e.maxSeats - e.seatsTaken) > 0);
  const savingsPercent = Math.round((combo.savings / combo.individualPrice) * 100);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative bg-void/40 backdrop-blur-md border border-arc/20 rounded-lg p-6 hover:border-arc/40 transition-all duration-300"
    >
      {/* Savings Badge */}
      <div className="absolute -top-3 right-6">
        <Badge className="bg-arc text-void font-semibold">
          Save {savingsPercent}%
        </Badge>
      </div>

      <div className="mb-4">
        <h3 className="text-xl font-bold text-offwhite mb-2">{combo.name}</h3>
        <p className="text-sm text-offwhite/60">{combo.description}</p>
      </div>

      {/* Included Events */}
      <div className="mb-4 space-y-2">
        <div className="text-xs uppercase tracking-wide text-offwhite/40 font-semibold">Includes:</div>
        {comboEvents.map((event) => (
          <div key={event.id} className="flex items-center gap-2 text-sm">
            <div className="w-1.5 h-1.5 rounded-full bg-arc" />
            <span className="text-offwhite/80">{event.name}</span>
            <span className="text-offwhite/40">• ₹{event.fee}</span>
          </div>
        ))}
      </div>

      {/* Pricing */}
      <div className="flex items-end justify-between pt-4 border-t border-white/5">
        <div>
          <div className="text-xs text-offwhite/40 line-through mb-1">₹{combo.individualPrice}</div>
          <div className="text-2xl font-bold text-arc">₹{combo.comboPrice}</div>
          <div className="text-xs text-green-400">You save ₹{combo.savings}</div>
        </div>
        
        {allEventsAvailable ? (
          <Button
            onClick={() => onAddCombo(combo, comboEvents)}
            className="bg-arc hover:bg-arc/90 text-void"
          >
            Add Combo
          </Button>
        ) : (
          <Button variant="outline" disabled>
            Events Full
          </Button>
        )}
      </div>
    </motion.div>
  );
}

export default function Register() {
  const navigate = useNavigate();
  const { items, addItem, removeItem, addCombo } = useCart();
  const [level, setLevel] = useLevelFilter(items);
  const [events, setEvents] = useState([]);
  const [combos, setCombos] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      api.get("/api/events"),
      api.get("/api/combos")
    ])
      .then(([eventsData, combosData]) => {
        setEvents(eventsData.events || []);
        setCombos(combosData.combos || []);
      })
      .catch(() => toast.error("Failed to load events"))
      .finally(() => setLoading(false));
  }, []);

  const inCart = (id) => items.some((i) => i.id === id);

  const handleAdd = (event) => {
    const result = addItem(event);
    if (!result.ok) {
      toast.error(result.reason);
    } else {
      toast.success(`${event.name} added to cart`);
    }
  };

  const handleRemove = (event) => {
    removeItem(event.id);
    toast.success(`${event.name} removed from cart`);
  };

  const handleAddCombo = (combo, comboEvents) => {
    const result = addCombo(combo, comboEvents);
    if (!result.ok) {
      toast.error(result.reason);
    } else {
      toast.success(`${combo.name} added to cart`);
    }
  };

  const handleProceedToRegister = () => {
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return;
    }
    navigate("/register/form");
  };

  const levelEvents = events.filter((e) => levelOf(e) === level);
  const technicalEvents = levelEvents.filter(e => e.category === "technical");
  const nonTechnicalEvents = levelEvents.filter(e => e.category === "non_technical");
  // A combo only shows under the level all of its events belong to.
  const activeCombos = combos.filter(
    (c) => c.isActive && c.eventIds.every((id) => levelEvents.some((e) => e.id === id))
  );

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-offwhite/60">Loading events...</div>
      </div>
    );
  }

  return (
    <div className="max-w-6xl mx-auto px-6 py-12">
      {/* Header */}
      <div className="text-center mb-12 animate-cinematic-fade">
        <p className="text-arc text-[11px] tracking-cinematic uppercase mb-4">Event Registration</p>
        <h1 className="font-serif text-4xl sm:text-5xl text-offwhite mb-4">
          Choose Your Events
        </h1>
        <p className="text-offwhite/60 max-w-2xl mx-auto">
          Senior events are for college students and Junior events for school students — each registers
          separately. Select events to add to your cart.
          {activeCombos.length > 0 && " Plus combo passes for bundled savings."}
        </p>
        <div className="seg mt-8" role="group" aria-label="Level">
          {Object.entries(LEVEL_LABEL).map(([k, v]) => (
            <button key={k} className={level === k ? "is-active" : ""} aria-pressed={level === k} onClick={() => setLevel(k)} data-log={`register-level-${k}`}>
              {v} · {LEVEL_AUDIENCE[k]}
            </button>
          ))}
        </div>
      </div>

      {/* Cart Summary */}
      {items.length > 0 && (
        <div className="mb-8 bg-arc/10 border border-arc/20 rounded-lg p-5 flex items-center justify-between">
          <div>
            <div className="text-offwhite font-semibold mb-1">
              {items.length} event(s) in cart
            </div>
            <div className="text-sm text-offwhite/60">
              Ready to proceed to registration
            </div>
          </div>
          <Button onClick={handleProceedToRegister} className="bg-arc hover:bg-arc/90 text-void">
            Proceed to Register
          </Button>
        </div>
      )}

      {/* TECHNICAL EVENTS */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-offwhite uppercase tracking-tight">
            {LEVEL_LABEL[level]} Technical Events
          </h2>
          <div className="flex-1 h-px bg-white/10" />
          <Badge variant="outline" className="text-xs">
            {technicalEvents.length} Events
          </Badge>
        </div>
        
        <div className="space-y-4">
          {technicalEvents.length === 0 ? (
            <div className="text-center py-8 text-offwhite/40">No technical events available</div>
          ) : (
            technicalEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                inCart={inCart}
                onAdd={handleAdd}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>
      </section>

      {/* NON-TECHNICAL EVENTS */}
      <section className="mb-12">
        <div className="flex items-center gap-4 mb-6">
          <h2 className="text-2xl font-bold text-offwhite uppercase tracking-tight">
            {LEVEL_LABEL[level]} Non-Technical Events
          </h2>
          <div className="flex-1 h-px bg-white/10" />
          <Badge variant="outline" className="text-xs">
            {nonTechnicalEvents.length} Events
          </Badge>
        </div>
        
        <div className="space-y-4">
          {nonTechnicalEvents.length === 0 ? (
            <div className="text-center py-8 text-offwhite/40">No non-technical events available</div>
          ) : (
            nonTechnicalEvents.map((event) => (
              <EventRow
                key={event.id}
                event={event}
                inCart={inCart}
                onAdd={handleAdd}
                onRemove={handleRemove}
              />
            ))
          )}
        </div>
      </section>

      {/* COMBO PASSES */}
      {activeCombos.length > 0 && (
        <section className="mb-12">
          <div className="flex items-center gap-4 mb-6">
            <h2 className="text-2xl font-bold text-offwhite uppercase tracking-tight">
              Combo Passes
            </h2>
            <div className="flex-1 h-px bg-white/10" />
            <Badge className="bg-arc/20 text-arc text-xs">
              Save More
            </Badge>
          </div>
          
          <div className="grid gap-6 md:grid-cols-2">
            {activeCombos.map((combo) => {
              const comboEvents = events.filter(e => combo.eventIds.includes(e.id));
              return (
                <ComboPassCard
                  key={combo.id}
                  combo={combo}
                  comboEvents={comboEvents}
                  onAddCombo={handleAddCombo}
                />
              );
            })}
          </div>
        </section>
      )}

      {/* Footer CTA */}
      {items.length > 0 && (
        <div className="sticky bottom-6 bg-void/95 backdrop-blur-md border border-arc/30 rounded-lg p-5 shadow-xl">
          <div className="flex items-center justify-between max-w-4xl mx-auto">
            <div>
              <div className="text-offwhite font-semibold">
                {items.length} event(s) selected
              </div>
              <div className="text-sm text-offwhite/60">
                Continue to complete registration
              </div>
            </div>
            <Button onClick={handleProceedToRegister} size="lg" className="bg-arc hover:bg-arc/90 text-void">
              Proceed to Register
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
