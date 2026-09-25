import React, { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { EventCard, EventFilters, EventModal, useCartToggle, useEventModal, useEvents, useLevelFilter } from "../components/EventBrowser";
import { LEVEL_AUDIENCE, LEVEL_LABEL, categoryOf, dayOf, levelOf } from "../lib/site";

/**
 * Full event catalogue - the "shop" step of registration. The landing page
 * (Home.jsx) previews a few events and links here; this page lists them all
 * with level (Senior/Junior), category and day filters, and add-to-cart.
 */

export default function Events() {
  const { events, loading } = useEvents();
  const { items, inCart, toggle } = useCartToggle();
  const modal = useEventModal(events);
  const [level, setLevel] = useLevelFilter(items);
  const [category, setCategory] = useState("all");
  const [day, setDay] = useState("all");

  const ofLevel = useMemo(() => events.filter((e) => levelOf(e) === level), [events, level]);
  const days = useMemo(() => [...new Set(ofLevel.map(dayOf).filter(Boolean))].sort(), [ofLevel]);

  const visible = useMemo(
    () => ofLevel.filter((e) => (category === "all" || categoryOf(e) === category) && (day === "all" || dayOf(e) === day)),
    [ofLevel, category, day]
  );

  return (
    <>
      <section className="section events !border-t-0 !pt-16">
        <div className="wrap">
          <div className="events__head">
            <div>
              <div className="kicker">Events · Step 1 of 3</div>
              <h1 className="h2">Choose what you’ll compete in</h1>
              <p className="lead mt-3 max-w-xl">
                Senior events are for college students and Junior events for school students — each
                registers separately. Add events to your cart, then register once for all of them;
                events that overlap in time can’t go in the same cart.
              </p>
            </div>
            <EventFilters
              level={level}
              onLevel={(l) => {
                setLevel(l);
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
              : `${LEVEL_LABEL[level].toUpperCase()} · FOR ${LEVEL_AUDIENCE[level].toUpperCase()} — SHOWING ${visible.length} OF ${ofLevel.length} EVENTS`}
            {items.length > 0 && ` · ${items.length} IN CART`}
          </div>

          {!loading && visible.length === 0 && <p className="lead mt-10">No events match these filters.</p>}

          <div className="events__grid">
            {visible.map((e) => (
              <EventCard key={e.id} event={e} inCart={inCart(e.id)} onOpen={modal.open} onToggle={toggle} />
            ))}
          </div>
        </div>
      </section>

      <section className="section contact text-center">
        <div className="contact__inner">
          <div className="kicker">Next step</div>
          <h2 className="h2">{items.length > 0 ? "Your selections are waiting." : "Choose your events. Craft your days."}</h2>
          <p className="lead mt-4 mx-auto max-w-[560px]">
            {items.length > 0
              ? `${items.length} event${items.length === 1 ? "" : "s"} in your cart. Review them and complete registration when you’re ready.`
              : "Add any event above to begin. Everything comes together on the registration screen."}
          </p>
          <div className="contact__ctas">
            <Link className="btn-pill" to="/register" data-log="events-cta-register">
              {items.length > 0 ? "Complete registration" : "Start registration"}
            </Link>
            {items.length > 0 && (
              <Link className="btn-ghost" to="/cart" data-log="events-cta-view-cart">
                View cart
              </Link>
            )}
          </div>
        </div>
      </section>

      <EventModal event={modal.active} onClose={modal.close} inCart={modal.active && inCart(modal.active.id)} onToggle={toggle} />
    </>
  );
}
