import React, { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Stepper from "../components/ui/Stepper";
import Button from "../components/ui/Button";
import ComboPassCard from "../components/ComboPassCard";
import { EventCard, EventFilters, EventModal, useCartToggle, useEventModal, useEvents, useLevelFilter } from "../components/EventBrowser";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { plural } from "../lib/a11y";
import { LEVEL_AUDIENCE, LEVEL_LABEL, categoryOf, dayOf, levelOf } from "../lib/site";

/**
 * Step 1 of registration - the one place to choose events (the old /register
 * list redirects here). Three steps, same everywhere:
 *   1. Choose events  (/events - cards, filters, details, combo passes)
 *   2. Your details   (/register/form)
 *   3. Payment        (/checkout)
 * The sticky bar at the bottom is the cart: it always shows what's picked and
 * leads to step 2. The cart icon in the navbar opens the full cart review.
 */
// Level-specific part of the step-1 description.
const LEVEL_INTRO = {
  senior: "For college students, held on October 8, 2026 (Day 1) and October 9, 2026 (Day 2). Junior events for school students are registered separately.",
  junior: "For school students, all held on October 9, 2026 (Day 2). Senior events for college students are registered separately.",
};

export default function Events() {
  const navigate = useNavigate();
  const { events, loading } = useEvents();
  const { items, inCart, toggle } = useCartToggle();
  const { total, addCombo } = useCart();
  const modal = useEventModal(events);
  const [level, setLevel] = useLevelFilter(items);
  const [category, setCategory] = useState("all");
  const [day, setDay] = useState("all");
  const [combos, setCombos] = useState([]);

  useEffect(() => {
    api
      .get("/api/combos")
      .then((d) => setCombos(d.combos || []))
      .catch(() => {}); // combo passes are optional extras
  }, []);

  const ofLevel = useMemo(() => events.filter((e) => levelOf(e) === level), [events, level]);
  const days = useMemo(() => [...new Set(ofLevel.map(dayOf).filter(Boolean))].sort(), [ofLevel]);
  const visible = useMemo(
    () => ofLevel.filter((e) => (category === "all" || categoryOf(e) === category) && (day === "all" || dayOf(e) === day)),
    [ofLevel, category, day]
  );
  // A combo only shows under the level all of its events belong to.
  const levelCombos = combos.filter((c) => c.isActive && c.eventIds.every((id) => ofLevel.some((e) => e.id === id)));

  const handleAddCombo = (combo, comboEvents) => {
    const result = addCombo(combo, comboEvents);
    if (!result.ok) toast.error(result.reason);
    else toast.success(`${combo.name} added to cart`);
  };

  return (
    <>
      <section className="section events !border-t-0 !pt-16 !pb-40">
        <div className="wrap">
          <div className="events__head">
            <div>
              <Stepper current={1} />
              <div className="kicker mt-6">Step 1 · Choose events</div>
              <h1 className="h2">Choose what you’ll compete in</h1>
              {/* Names the chosen level first, then what applies to it. */}
              <div className="mt-4 max-w-xl" aria-live="polite">
                <p className="text-[22px] leading-tight font-semibold text-amber-light">{LEVEL_LABEL[level]} events</p>
                <p className="lead mt-2">
                  {LEVEL_INTRO[level]} Add the events you want to your cart, then continue to your details. Events
                  that overlap in time can’t go in the same cart.
                </p>
              </div>
            </div>
          </div>

          {/* Filters on their own row: identical for Senior and Junior. */}
          <div className="events__toolbar">
            <EventFilters
              level={level}
              onLevel={(l) => {
                setLevel(l);
                setCategory("all");
                setDay("all");
              }}
              category={category}
              onCategory={setCategory}
              days={days}
              day={day}
              onDay={setDay}
            />
          </div>

          <div className="events__count">
            {loading
              ? "LOADING EVENTS…"
              : `${LEVEL_LABEL[level].toUpperCase()} EVENTS · FOR ${LEVEL_AUDIENCE[level].toUpperCase()} — SHOWING ${visible.length} OF ${ofLevel.length}`}
          </div>

          {!loading && visible.length === 0 && <p className="lead mt-10">No events match these filters.</p>}

          <h2 className="sr-only">{visible.length} events</h2>
          <div className="events__grid">
            {visible.map((e) => (
              <EventCard key={e.id} event={e} inCart={inCart(e.id)} onOpen={modal.open} onToggle={toggle} />
            ))}
          </div>

          {levelCombos.length > 0 && (
            <section className="mt-16" aria-labelledby="combos-title">
              <div className="kicker">Save more</div>
              <h2 id="combos-title" className="h3">Combo passes</h2>
              <div className="grid gap-6 md:grid-cols-2 mt-6">
                {levelCombos.map((combo) => (
                  <ComboPassCard
                    key={combo.id}
                    combo={combo}
                    comboEvents={events.filter((e) => combo.eventIds.includes(e.id))}
                    onAddCombo={handleAddCombo}
                    inCart={inCart}
                  />
                ))}
              </div>
            </section>
          )}
        </div>
      </section>

      {/* The cart, always in view: what's picked and the way to step 2. */}
      <div className="reg-bar" role="region" aria-label="Your cart">
        <div className="reg-bar__inner">
          <div>
            <div className="text-heading">
              {items.length ? `${plural(items.length, "event")} in your cart · ₹${total}` : "Your cart is empty"}
            </div>
            <div className="text-sm text-soft">
              {items.length ? "Next: your details, then payment" : "Add an event above to start registering"}
            </div>
          </div>
          <div className="flex flex-wrap gap-3">
            {items.length > 0 && (
              <Link to="/cart" className="btn-ghost-sm !py-3" data-log="events-bar-cart">
                Review cart
              </Link>
            )}
            <Button size="lg" disabled={!items.length} onClick={() => navigate("/register/form")} data-log="events-bar-continue">
              Continue to your details →
            </Button>
          </div>
        </div>
      </div>

      <EventModal
        event={modal.active}
        onClose={modal.close}
        inCart={modal.active && inCart(modal.active.id)}
        onToggle={toggle}
        list={visible}
        onNavigate={modal.go}
      />
    </>
  );
}
