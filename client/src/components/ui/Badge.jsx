import React from "react";

// Status colours stay green/amber/red for scannability in dense portal
// tables; the shape is the main site's mono `.pill`.
const STYLES = {
  pending: "bg-warning/10 text-warning border-warning/35",
  approved: "bg-success/10 text-success border-success/35",
  present: "bg-success/10 text-success border-success/35",
  rejected: "bg-danger/10 text-danger border-danger/35",
  absent: "bg-danger/10 text-danger border-danger/35",
  collected: "bg-success/10 text-success border-success/35",
  "not-collected": "bg-shade/5 text-[color:var(--c-d3cdc2)] border-shade/15",
  info: "bg-amber/10 text-amber-pale border-amber/40",
  neutral: "bg-shade/5 text-[color:var(--c-d3cdc2)] border-shade/15",
};

const LABELS = {
  pending: "Pending",
  approved: "Approved",
  present: "Present",
  rejected: "Rejected",
  absent: "Absent",
  collected: "Collected",
  "not-collected": "Not Collected",
};

export default function Badge({ status = "neutral", children, className = "" }) {
  return (
    <span
      className={`inline-flex items-center px-2.5 py-1 rounded-full border font-mono text-[10px] uppercase tracking-[0.1em] whitespace-nowrap ${STYLES[status] || STYLES.neutral} ${className}`}
    >
      {children || LABELS[status] || status}
    </span>
  );
}
