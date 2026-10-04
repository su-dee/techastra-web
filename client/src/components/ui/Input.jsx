import React, { useState } from "react";
import { Eye, EyeOff } from "lucide-react";

const FIELD =
  "w-full rounded-[10px] bg-shade/[0.03] border border-[color:var(--c-8f8676)] px-3.5 py-2.5 text-[15px] text-text placeholder-[color:var(--c-afa697)] " +
  "hover:border-[color:var(--c-afa697)] focus:border-amber/60 focus:ring-2 focus:ring-amber/20 outline-none transition-colors " +
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

/** A password field with a show/hide button (the field stays type=password by default). */
export function PasswordInput({ className = "", ...props }) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <input className={`${FIELD} pr-12 ${className}`} {...props} type={show ? "text" : "password"} />
      <button
        type="button"
        onClick={() => setShow((v) => !v)}
        aria-label={show ? "Hide password" : "Show password"}
        aria-pressed={show}
        className="absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-r-[10px] text-dim hover:text-heading focus-visible:outline focus-visible:outline-2 focus-visible:outline-amber/60"
      >
        {show ? <EyeOff size={18} aria-hidden="true" /> : <Eye size={18} aria-hidden="true" />}
      </button>
    </div>
  );
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
