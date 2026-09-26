import React from "react";

const FIELD =
  "w-full rounded-[10px] bg-white/[0.03] border border-[#8f8676] px-3.5 py-2.5 text-[15px] text-text placeholder-[#afa697] " +
  "hover:border-[#afa697] focus:border-amber/60 focus:ring-2 focus:ring-amber/20 outline-none transition-colors " +
  "aria-[invalid=true]:border-danger aria-[invalid=true]:ring-1 aria-[invalid=true]:ring-danger/40";

// Mono uppercase micro-labels, matching the main site's `.mono-label`.
// `required` adds a visible marker; the input's own `required` attribute is
// what screen readers announce.
export function Label({ children, htmlFor, required, hint }) {
  return (
    <label htmlFor={htmlFor} className="block mono-label mb-2">
      {children}
      {required && (
        <span className="text-amber-light" aria-hidden="true">
          {" "}*
        </span>
      )}
      {hint && <span className="normal-case tracking-normal font-sans text-[12px] text-dim"> — {hint}</span>}
    </label>
  );
}

/** Inline error under a field; link it with aria-describedby={`${id}-error`}. */
export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={`${id}-error`} className="mt-1.5 text-[13px] text-danger flex items-start gap-1.5">
      <span aria-hidden="true">!</span>
      {children}
    </p>
  );
}

/** Helper text under a field; link it with aria-describedby={`${id}-hint`}. */
export function FieldHint({ id, children }) {
  return (
    <p id={`${id}-hint`} className="mt-1.5 text-[13px] text-dim">
      {children}
    </p>
  );
}

export function Input({ className = "", ...props }) {
  return <input className={`${FIELD} ${className}`} {...props} />;
}

export function Textarea({ className = "", ...props }) {
  return <textarea className={`${FIELD} ${className}`} {...props} />;
}

export function Select({ className = "", children, ...props }) {
  return (
    <select className={`${FIELD} [&>option]:bg-ink-panel ${className}`} {...props}>
      {children}
    </select>
  );
}
