import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { LEVEL_LABEL, LEVEL_AUDIENCE, JUNIOR_REGISTRATION_NOTE, levelOf, registrationClosed } from "../lib/site";
import { computeTotal, dependsOnTeamSize, smallestTeam } from "../lib/pricing";

const CartContext = createContext(null);
const STORAGE_KEY = "techastra_cart";

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      // Junior events can't be registered online any more (see addItem).
      return raw ? JSON.parse(raw).filter((i) => levelOf(i) !== "junior") : [];
    } catch {
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }, [items]);

  /** Returns the clashing event name if adding `event` would overlap an existing cart item, else null. */
  const findClash = useCallback(
    (event) => {
      const clash = items.find((i) => rangesOverlap(i.startTime, i.endTime, event.startTime, event.endTime));
      return clash ? clash.name : null;
    },
    [items]
  );

  // Senior (college) and Junior (school) events are separate registrations,
  // so a cart only ever holds one level. The server enforces this too.
  const levelMismatch = (event) => {
    if (!items.length || levelOf(items[0]) === levelOf(event)) return null;
    const cur = levelOf(items[0]);
    return `Your cart has ${LEVEL_LABEL[cur]} events (for ${LEVEL_AUDIENCE[cur]}). ${LEVEL_LABEL[levelOf(event)]} events need a separate registration.`;
  };

  // Combo rules (the server enforces them too): a combo pass is registered on
  // its own - one combo per registration, nothing else alongside it - and its
  // events can only be removed together, as the whole combo.
  const activeCombo = (() => {
    const c = items.find((i) => i.isComboItem && i.comboId);
    return c ? { id: c.comboId, name: c.comboName } : null;
  })();

  const addItem = (event) => {
    if (event.externalRegistration) return { ok: false, reason: `${event.name} has its own registration website.` };
    if (levelOf(event) === "junior") return { ok: false, reason: JUNIOR_REGISTRATION_NOTE };
    if (registrationClosed(event)) return { ok: false, reason: `Registration for ${event.name} has closed for the day.` };
    if (items.some((i) => i.id === event.id)) return { ok: false, reason: "Already in cart" };
    if (activeCombo) {
      return {
        ok: false,
        reason: `Your cart has the ${activeCombo.name} pass, which is registered on its own. Remove the combo to choose events individually.`,
      };
    }
    const mismatch = levelMismatch(event);
    if (mismatch) return { ok: false, reason: mismatch };
    const clash = findClash(event);
    if (clash) return { ok: false, reason: `Clashes with "${clash}" already in your cart` };
    setItems((prev) => [...prev, event]);
    return { ok: true };
  };

  /**
   * Add all events from a combo pass.
   * Validates that NONE of the combo events clash with existing cart items.
   * If any event clashes, the entire combo is blocked (no partial add).
   */
  const addCombo = (comboPass, comboEvents) => {
    if (comboEvents.some((e) => levelOf(e) === "junior")) return { ok: false, reason: JUNIOR_REGISTRATION_NOTE };
    if (activeCombo) {
      return {
        ok: false,
        reason:
          activeCombo.id === comboPass.id
            ? `${comboPass.name} is already in your cart`
            : `Only one combo pass per registration. Remove ${activeCombo.name} from your cart first.`,
      };
    }
    if (items.length) {
      return {
        ok: false,
        reason: `A combo pass is registered on its own. Remove the ${items.length === 1 ? "event" : `${items.length} events`} in your cart first.`,
      };
    }
    const mismatch = comboEvents.map(levelMismatch).find(Boolean);
    if (mismatch) return { ok: false, reason: mismatch };
    const closed = comboEvents.find(registrationClosed);
    if (closed) return { ok: false, reason: `${comboPass.name} has closed - registration for ${closed.name} has ended.` };
    // Check if any combo event is already in cart
    const alreadyInCart = comboEvents.find((e) => items.some((i) => i.id === e.id));
    if (alreadyInCart) {
      return { ok: false, reason: `"${alreadyInCart.name}" is already in your cart` };
    }

    // Check for time clashes with existing cart items
    for (const event of comboEvents) {
      const clash = findClash(event);
      if (clash) {
        return { ok: false, reason: `Cannot add combo: "${event.name}" clashes with "${clash}"` };
      }
    }

    // All checks passed - add all events with combo metadata
    const comboItems = comboEvents.map((event) => ({
      ...event,
      comboId: comboPass.id,
      comboName: comboPass.name,
      comboPrice: comboPass.comboPrice,
      isComboItem: true,
    }));

    setItems((prev) => [...prev, ...comboItems]);
    return { ok: true };
  };

  /** Removes a single event. Events of a combo pass can't be removed on their own. */
  const removeItem = (eventId) => {
    const item = items.find((i) => i.id === eventId);
    if (item?.isComboItem) {
      return { ok: false, reason: `${item.name} is part of ${item.comboName}. Remove the whole combo instead.` };
    }
    setItems((prev) => prev.filter((i) => i.id !== eventId));
    return { ok: true };
  };

  /**
   * Remove all events that are part of a specific combo.
   */
  const removeCombo = (comboId) => {
    setItems((prev) => prev.filter((i) => i.comboId !== comboId));
  };

  const clearCart = () => setItems([]);

  // Fees are per person, so the exact amount needs the team size (known on the
  // details form - see lib/pricing.js). Until then `total` is the amount for
  // the smallest team the cart allows, and `totalIsEstimate` says so.
  const total = computeTotal(items, smallestTeam(items));
  const totalIsEstimate = dependsOnTeamSize(items);

  return (
    <CartContext.Provider
      value={{ items, addItem, addCombo, removeItem, removeCombo, clearCart, total, totalIsEstimate, findClash, activeCombo }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
