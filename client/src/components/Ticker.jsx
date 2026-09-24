import React from "react";
import { EDITION } from "../lib/site";

export default function Ticker({ eventCount }) {
  const items = [
    "08–09 OCT 2026",
    "DR. MGR EDUCATIONAL & RESEARCH INSTITUTE",
    eventCount ? `${eventCount} EVENTS` : "REGISTRATIONS OPEN",
    "TECHNICAL & NON-TECHNICAL",
    "COMBO PASSES AVAILABLE",
    `${EDITION.toUpperCase()} EDITION`,
    "CSE × CYBER SECURITY",
  ];
  // Items are doubled so the -50% marquee loops seamlessly.
  const loop = [...items, ...items];
  return (
    <div className="ticker" aria-hidden="true">
      <div className="ticker__track">
        {loop.map((t, i) => (
          <div key={i} className="ticker__item">{t}</div>
        ))}
      </div>
    </div>
  );
}
