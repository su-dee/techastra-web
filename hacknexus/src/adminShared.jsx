import React, { useCallback, useEffect, useState } from "react";
import { LoaderCircle } from "lucide-react";
import content from "./content.json";
import { api } from "./api.js";

// Helpers shared by the admin console views.
export const domainLabels = {
  "HN-AI": "AI & ML",
  "HN-CS": "Cybersecurity & Web3",
  "HN-FT": "FinTech",
  "HN-X": "Cross-Domain",
};
export const statuses = [
  ["pending", "Pending"],
  ["approved", "Approved"],
  ["waitlisted", "Waitlisted"],
  ["rejected", "Rejected"],
];
export const statusLabel = Object.fromEntries(statuses);
export const problemTitle = Object.fromEntries(
  content.problems.map((p) => [p.id, p.title]),
);
const dateFormat = new Intl.DateTimeFormat("en-IN", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Kolkata",
});
export const formatDate = (value) =>
  value ? dateFormat.format(new Date(value)) : "—";
export function useDebounced(value, delay = 300) {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

// Loads data for a view; a 401 anywhere returns the console to sign-in.
export function useAdminData(path, onExpired) {
  const [state, setState] = useState({ data: null, error: "", loading: true });
  const [version, setVersion] = useState(0);
  useEffect(() => {
    let active = true;
    setState((s) => ({ ...s, loading: true, error: "" }));
    api(path)
      .then((data) => active && setState({ data, error: "", loading: false }))
      .catch((e) => {
        if (!active) return;
        if (e.status === 401) onExpired();
        else setState((s) => ({ ...s, error: e.message, loading: false }));
      });
    return () => {
      active = false;
    };
  }, [path, version, onExpired]);
  const reload = useCallback(() => setVersion((v) => v + 1), []);
  return { ...state, reload };
}

export function StatusPill({ status }) {
  return (
    <span className={`status-pill status-${status}`}>
      {statusLabel[status] || status}
    </span>
  );
}

export function ViewState({ loading, error, onRetry }) {
  if (error)
    return (
      <div className="admin-empty" role="alert">
        {error}{" "}
        <button className="text-link" onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  return (
    <p className="admin-empty">
      {loading && <LoaderCircle size={16} className="spin" />} Loading…
    </p>
  );
}

export function Pager({ page, limit, total, onPage }) {
  const pages = Math.max(1, Math.ceil(total / limit));
  return (
    <div className="pager">
      <span>
        {total
          ? `${(page - 1) * limit + 1}–${Math.min(total, page * limit)} of ${total}`
          : "0 results"}
      </span>
      <button disabled={page <= 1} onClick={() => onPage(page - 1)}>
        Previous
      </button>
      <button disabled={page >= pages} onClick={() => onPage(page + 1)}>
        Next
      </button>
    </div>
  );
}

export const paymentLabel = {
  submitted: "Awaiting check",
  verified: "Verified",
  rejected: "Rejected",
};
export function PaymentPill({ status }) {
  return (
    <span className={`status-pill payment-${status || "none"}`}>
      {paymentLabel[status] || "Unpaid"}
    </span>
  );
}
export const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
