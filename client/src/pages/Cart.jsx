import React from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import { useCart } from "../context/CartContext";
import { formatDay, formatTimeRange, kickerFor } from "../components/EventInfo";
import { plural } from "../lib/a11y";

export default function Cart() {
  const { items, removeItem, total } = useCart();
  const navigate = useNavigate();

  const remove = (item) => {
    removeItem(item.id);
    toast.success(`${item.name} removed from cart`);
  };

  return (
    <div className="max-w-2xl mx-auto px-6 py-14">
      <div className="page-head animate-cinematic-fade">
        <Stepper current={1} />
        <div className="kicker">Your cart</div>
        <h1 className="h2">{items.length ? plural(items.length, "event") + " selected" : "Your cart is empty"}</h1>
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="lead mb-6">Browse the events and add the ones you want to compete in.</p>
          <Link to="/events" className="btn-small">Browse events</Link>
        </div>
      ) : (
        <>
          <ul className="card divide-y divide-[rgba(255,255,255,0.08)] mb-8">
            {items.map((item) => (
              <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                <div className="min-w-0">
                  <p className="mono-label">{kickerFor(item)}</p>
                  <p className="text-[17px] text-heading mt-1">{item.name}</p>
                  <p className="text-[14px] text-soft mt-0.5">
                    {formatDay(item)} · {formatTimeRange(item)}
                    {item.isComboItem && item.comboName ? ` · part of ${item.comboName}` : ""}
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  {!item.isComboItem && <span className="text-[17px] text-amber-light tabular-nums">₹{item.fee}</span>}
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => remove(item)}
                    aria-label={`Remove ${item.name} from cart`}
                    data-log={`cart-remove-${item.id}`}
                  >
                    Remove
                  </button>
                </div>
              </li>
            ))}
          </ul>

          <div className="flex items-baseline justify-between mb-8 px-1">
            <span className="mono-label">Total</span>
            <span className="text-[30px] text-heading tabular-nums">₹{total}</span>
          </div>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            <Link to="/events" className="btn-ghost-sm text-center !py-3">Add more events</Link>
            <Button size="lg" className="flex-1" onClick={() => navigate("/register/form")} data-log="cart-proceed-to-registration">
              Continue to your details →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
