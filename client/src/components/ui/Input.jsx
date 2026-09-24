import React from "react";

const FIELD =
  "w-full rounded-[10px] bg-white/[0.03] border border-white/10 px-3.5 py-2.5 text-[15px] text-text placeholder-[#6f6962] " +
  "hover:border-white/20 focus:border-amber/60 focus:ring-2 focus:ring-amber/20 outline-none transition-colors";

// Mono uppercase micro-labels, matching the main site's `.mono-label`.
export function Label({ children, htmlFor }) {
  return (
    <label htmlFor={htmlFor} className="block mono-label mb-2">
      {children}
    </label>
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
