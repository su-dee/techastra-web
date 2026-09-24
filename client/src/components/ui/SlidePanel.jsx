import React, { useEffect } from "react";

/**
 * Slide-in-from-right form overlay (used by the Help Desk). Styled like the
 * main site's modal panel, anchored to the right edge.
 */
export default function SlidePanel({ open, onClose, title, eyebrow, children, backLabel = "Back" }) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === "Escape") onClose?.();
    };
    document.addEventListener("keydown", onKey);
    document.body.classList.add("no-scroll");
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.classList.remove("no-scroll");
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[60] flex justify-end" role="dialog" aria-modal="true" aria-label={title}>
      <div
        className="absolute inset-0 bg-[rgba(4,4,6,0.74)] backdrop-blur-[5px] animate-panel-backdrop"
        onClick={onClose}
        data-log="slide-panel-backdrop-dismiss"
      />
      <div className="relative w-full sm:w-[480px] h-full overflow-y-auto border-l border-white/10 shadow-panel animate-panel-slide-in bg-[radial-gradient(120%_60%_at_100%_0%,rgba(196,110,40,0.18)_0%,rgba(12,12,16,0)_60%),#0c0c10]">
        <div className="px-6 sm:px-9 py-8">
          <button onClick={onClose} className="link-cta mb-8" data-log="slide-panel-back">
            <span aria-hidden="true">&larr;</span>
            {backLabel}
          </button>
          {eyebrow && <p className="kicker mb-3">{eyebrow}</p>}
          {title && <h2 className="text-[28px] leading-tight text-heading mb-7">{title}</h2>}
          {children}
        </div>
      </div>
    </div>
  );
}
