import React, { useEffect, useRef } from "react";

/**
 * Centered dialog in the main site's EventModal style. Closes on Escape and
 * backdrop click, locks page scroll while open.
 *
 *   size:  "sm" | "md" | "lg"   (fullScreen is the older name for "lg")
 *   tone:  "technical" | "non_technical" - amber vs steel corner wash
 *   title: optional; pass `kicker` for the small mono line above it
 */
export default function Modal({ open, onClose, title, kicker, children, size = "md", fullScreen = false, tone, labelledBy }) {
  const closeRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    closeRef.current?.focus();
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [open, onClose]);

  if (!open) return null;

  const sizeClass = fullScreen || size === "lg" ? " modal__panel--lg" : size === "sm" ? " modal__panel--sm" : "";
  const toneClass = tone === "non_technical" ? " modal__panel--non_technical" : "";

  return (
    <div className="modal" onClick={onClose}>
      <div
        className={"modal__panel" + sizeClass + toneClass}
        role="dialog"
        aria-modal="true"
        aria-labelledby={labelledBy || (title ? "modal-title" : undefined)}
        onClick={(e) => e.stopPropagation()}
      >
        <button ref={closeRef} className="modal__close" onClick={onClose} aria-label="Close">
          ×
        </button>
        {kicker && <div className="kicker">{kicker}</div>}
        {title && (
          <h3 id="modal-title" className={"modal__title pr-10" + (kicker ? "" : " !mt-0")}>
            {title}
          </h3>
        )}
        <div className={title || kicker ? "mt-5" : ""}>{children}</div>
      </div>
    </div>
  );
}
