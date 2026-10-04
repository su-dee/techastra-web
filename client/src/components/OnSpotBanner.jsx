import React from "react";

/** Shown while registering in on-spot mode (opened from the desk's QR). */
export default function OnSpotBanner({ className = "" }) {
  return (
    <p role="status" className={`rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-[14px] text-text ${className}`}>
      <strong className="font-semibold text-heading">On-spot registration.</strong> Register here, then pay in cash at
      the registration desk to get your ID card.
    </p>
  );
}
