import React, { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import toast from "react-hot-toast";
import EventInfo, { kickerFor, teamLabel } from "../components/EventInfo";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { categoryOf } from "../lib/site";

// Stand-alone page for a single event (shared links / bookmarks). Same
// content as the modal on /events, laid out as the main site's modal panel.
export default function EventDetail() {
  const { id } = useParams();
  const [event, setEvent] = useState(null);
  const [others, setOthers] = useState([]);
  const [loading, setLoading] = useState(true);
  const { items, addItem, removeItem } = useCart();
  const navigate = useNavigate();

  useEffect(() => {
    window.scrollTo(0, 0);
    setLoading(true);
    api
      .get(`/api/events/${id}`)
      .then((data) => setEvent(data.event))
      .catch(() => toast.error("Could not load this event"))
      .finally(() => setLoading(false));
    api
      .get("/api/events")
      .then((data) => setOthers((data.events || []).filter((e) => e.id !== id)))
      .catch(() => {});
  }, [id]);

  if (loading) {
    return <div className="wrap px-6 py-32 text-center mono-label">Loading event…</div>;
  }

  if (!event) {
    return (
      <div className="wrap px-6 py-32 text-center">
        <p className="lead mb-6">This event could not be found.</p>
        <Link to="/events" className="btn-ghost-sm">Back to events</Link>
      </div>
    );
  }

  const cat = categoryOf(event);
  const inCart = items.some((i) => i.id === event.id);
  const full = event.seatsAvailable <= 0;
  const related = others.filter((e) => categoryOf(e) === cat).slice(0, 3);

  const add = () => {
    const result = addItem(event);
    if (!result.ok) toast.error(result.reason);
    else toast.success(`${event.name} added to cart`);
  };

  return (
    <div className="px-4 sm:px-10 pt-10 pb-24">
      <div className="max-w-[760px] mx-auto">
        <Link to="/events" className="link-cta mb-6">
          <span aria-hidden="true">&larr;</span> All events
        </Link>

        <article className={"modal__panel !max-h-none !overflow-visible !animate-none" + (cat === "non_technical" ? " modal__panel--non_technical" : "")}>
          <div className="kicker">{kickerFor(event)}</div>
          <h1 className="modal__title">{event.name}</h1>
          <div className="modal__tagline">{teamLabel(event)}</div>

          <EventInfo event={event} />

          <div className="flex flex-col sm:flex-row gap-3 mt-8">
            {inCart ? (
              <>
                <button className="btn-small modal__cta !mt-0 flex-1" onClick={() => navigate("/register")} data-log="event-detail-continue">
                  Continue to registration →
                </button>
                <button className="btn-ghost-sm !py-4" onClick={() => removeItem(event.id)}>
                  Remove from cart
                </button>
              </>
            ) : (
              <button className="btn-small modal__cta !mt-0 flex-1 disabled:opacity-50" disabled={full} onClick={add} data-log="event-detail-add">
                {full ? "Seats full" : `Add to cart — ₹${event.fee}`}
              </button>
            )}
          </div>
        </article>

        {related.length > 0 && (
          <div className="mt-16">
            <div className="kicker">More like this</div>
            <div className="grid gap-4 sm:grid-cols-3 mt-4">
              {related.map((e) => (
                <Link key={e.id} to={`/events/${e.id}`} className="card p-5 transition-[border-color,transform] hover:-translate-y-[3px] hover:border-amber/50">
                  <div className="text-[17px] text-heading">{e.name}</div>
                  <div className="text-[13px] text-steel mt-1">{e.track || teamLabel(e)}</div>
                  <div className="text-[13px] text-amber-light mt-4">Details →</div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
