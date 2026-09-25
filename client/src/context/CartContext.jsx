import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import { LEVEL_LABEL, LEVEL_AUDIENCE, levelOf } from "../lib/site";

const CartContext = createContext(null);
const STORAGE_KEY = "techastra_cart";

function rangesOverlap(aStart, aEnd, bStart, bEnd) {
  return new Date(aStart) < new Date(bEnd) && new Date(bStart) < new Date(aEnd);
}

export function CartProvider({ children }) {
  const [items, setItems] = useState(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : [];
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

  const addItem = (event) => {
    if (items.some((i) => i.id === event.id)) return { ok: false, reason: "Already in cart" };
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
    const mismatch = comboEvents.map(levelMismatch).find(Boolean);
    if (mismatch) return { ok: false, reason: mismatch };
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

  const removeItem = (eventId) => {
    setItems((prev) => prev.filter((i) => i.id !== eventId));
  };

  /**
   * Remove all events that are part of a specific combo.
   */
  const removeCombo = (comboId) => {
    setItems((prev) => prev.filter((i) => i.comboId !== comboId));
  };

  const clearCart = () => setItems([]);

  /**
   * Calculate total with combo pricing.
   * Events marked as combo items use the combo price divided by the number of events.
   * Regular events use their individual fee.
   */
  const total = items.reduce((sum, i) => {
    if (i.isComboItem) {
      // For combo items, we've already distributed the combo price
      // Count each combo only once by checking if this is the first item of that combo
      const comboItems = items.filter((item) => item.comboId === i.comboId);
      const isFirstComboItem = comboItems[0]?.id === i.id;
      return isFirstComboItem ? sum + i.comboPrice : sum;
    }
    return sum + i.fee;
  }, 0);

  return (
    <CartContext.Provider value={{ items, addItem, addCombo, removeItem, removeCombo, clearCart, total, findClash }}>
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error("useCart must be used within a CartProvider");
  return ctx;
}
