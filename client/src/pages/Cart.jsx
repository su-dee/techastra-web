import React from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import { useCart } from "../context/CartContext";
import { formatDay, formatFee, formatTimeRange, kickerFor } from "../components/EventInfo";
import { plural } from "../lib/a11y";
import { priceLabel } from "../lib/pricing";

export default function Cart() {
  const { items, removeItem, removeCombo, activeCombo, total, totalIsEstimate } = useCart();
  const navigate = useNavigate();

  const remove = (item) => {
    const result = removeItem(item.id);
    if (!result.ok) return toast.error(result.reason);
    toast.success(`${item.name} removed from cart`);
  };

  // A combo pass is removed as a whole - its events have no Remove of their own.
  const comboItems = activeCombo ? items.filter((i) => i.comboId === activeCombo.id) : [];
  const singles = items.filter((i) => !i.isComboItem);
  const eventLine = (item) => (
    <div className="min-w-0">
      <p className="mono-label">{kickerFor(item)}</p>
      <p className="text-[17px] text-heading mt-1">{item.name}</p>
      <p className="text-[14px] text-soft mt-0.5">
        {formatDay(item)} · {formatTimeRange(item)}
      </p>
    </div>
  );

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
          {activeCombo && (
            <section className="card mb-8 overflow-hidden" aria-labelledby="cart-combo-title">
              <div className="flex flex-wrap items-center justify-between gap-4 p-5 border-b border-line">
                <div>
                  <p className="mono-label">Combo pass</p>
                  <h2 id="cart-combo-title" className="text-[19px] text-heading mt-1">{activeCombo.name}</h2>
                  <p className="text-[13px] text-dim mt-1">
                    Registered on its own - its events can only be removed together.
                  </p>
                </div>
                <div className="flex items-center gap-4">
                  <span className="text-[17px] text-amber-light tabular-nums">
                    {comboItems[0]?.comboPrice ? `₹${comboItems[0].comboPrice} per person` : "Free"}
                  </span>
                  <button
                    type="button"
                    className="btn-ghost-sm"
                    onClick={() => {
                      removeCombo(activeCombo.id);
                      toast.success(`${activeCombo.name} removed from cart`);
                    }}
                    aria-label={`Remove ${activeCombo.name} from cart`}
                    data-log="cart-remove-combo"
                  >
                    Remove combo
                  </button>
                </div>
              </div>
              <ul className="divide-y divide-shade/10">
                {comboItems.map((item) => (
                  <li key={item.id} className="p-5">{eventLine(item)}</li>
                ))}
              </ul>
            </section>
          )}

          {singles.length > 0 && (
            <ul className="card divide-y divide-shade/10 mb-8">
              {singles.map((item) => (
                <li key={item.id} className="flex flex-wrap items-center justify-between gap-4 p-5">
                  {eventLine(item)}
                  <div className="flex items-center gap-4">
                    <span className="text-[17px] text-amber-light tabular-nums">{priceLabel(item)}</span>
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
          )}

          <div className="flex items-baseline justify-between px-1">
            <span className="mono-label">{totalIsEstimate && total > 0 ? "Estimated total" : "Total"}</span>
            <span className="text-[30px] text-heading tabular-nums">
              {totalIsEstimate && total > 0 ? "from " : ""}
              {formatFee(total)}
            </span>
          </div>
          <p className="text-[13px] text-dim mb-8 mt-1 px-1 text-right">
            {totalIsEstimate && total > 0
              ? "Fees are per person, so a team pays for each member. The exact amount is shown once you enter your team."
              : ""}
          </p>

          <div className="flex flex-col-reverse sm:flex-row gap-3">
            {!activeCombo && <Link to="/events" className="btn-ghost-sm text-center !py-3">Add more events</Link>}
            <Button size="lg" className="flex-1" onClick={() => navigate("/register/form")} data-log="cart-proceed-to-registration">
              Continue to your details →
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
