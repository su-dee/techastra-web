import React, { useMemo, useState } from "react";
import Badge from "./ui/Badge";

const PAYMENT = { upi: "UPI", cash: "Cash", free: "Free", razorpay: "Online", later: "Pay later" };
const STATUS_ORDER = { pending: 0, approved: 1, rejected: 2 };
const shortDate = (d) => new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const peopleOf = (r) => (Array.isArray(r.teamMembers) && r.teamMembers.length ? r.teamMembers.length : 1);

// Sortable columns: what each one sorts by.
const SORTS = {
  code: (r) => r.registrationCode,
  name: (r) => (r.user?.name || "").toLowerCase(),
  college: (r) => (r.collegeName || r.user?.collegeName || "").toLowerCase(),
  people: peopleOf,
  amount: (r) => r.totalAmount,
  status: (r) => STATUS_ORDER[r.status] ?? 9,
  registered: (r) => new Date(r.createdAt).getTime(),
};

function SortHeader({ id, label, sort, setSort, className = "" }) {
  const active = sort.key === id;
  return (
    <th scope="col" className={`px-3 py-2.5 text-left font-medium ${className}`} aria-sort={active ? (sort.dir === 1 ? "ascending" : "descending") : "none"}>
      <button
        type="button"
        onClick={() => setSort((s) => ({ key: id, dir: s.key === id ? -s.dir : 1 }))}
        className="inline-flex items-center gap-1 uppercase tracking-wide hover:text-heading"
      >
        {label}
        <span aria-hidden="true" className={active ? "text-amber-light" : "opacity-30"}>
          {active && sort.dir === -1 ? "▼" : "▲"}
        </span>
      </button>
    </th>
  );
}

/**
 * Registrations as a table for the registration committee and the admin:
 * one row per registration, sortable columns, a details button, and
 * `renderActions(r)` for the portal's own buttons in the last column.
 */
export default function ParticipantsTable({ rows, eventsById, onDetails, renderActions, renderFlags }) {
  const [sort, setSort] = useState({ key: "registered", dir: -1 });
  const sorted = useMemo(() => {
    const by = SORTS[sort.key] || SORTS.registered;
    return [...rows].sort((a, b) => {
      const x = by(a), y = by(b);
      return (x < y ? -1 : x > y ? 1 : 0) * sort.dir;
    });
  }, [rows, sort]);

  // Sticky header + sticky Actions column (always on screen, even when the
  // table scrolls sideways on smaller laptops).
  const th = "px-3 py-2.5 text-left font-medium uppercase tracking-wide";
  const actionsCell = "sticky right-0 z-[1] bg-[color:var(--c-38342d)] shadow-[-8px_0_12px_-10px_rgba(0,0,0,0.35)]";
  return (
    <div className="overflow-x-auto rounded-[10px] border border-shade/15">
      <table className="w-full text-sm border-collapse">
        <caption className="sr-only">Registrations - select a column heading to sort</caption>
        <thead className="sticky top-0 z-10 bg-[color:var(--c-38342d)] text-[color:var(--c-d3cdc2)] text-xs">
          <tr>
            <th scope="col" className={`${th} text-right`}>#</th>
            <SortHeader id="code" label="Code" sort={sort} setSort={setSort} />
            <SortHeader id="name" label="Participant" sort={sort} setSort={setSort} />
            <th scope="col" className={th}>Contact</th>
            <SortHeader id="college" label="College" sort={sort} setSort={setSort} />
            <th scope="col" className={th}>Events</th>
            <SortHeader id="people" label="People" sort={sort} setSort={setSort} className="text-right" />
            <SortHeader id="amount" label="Payment" sort={sort} setSort={setSort} />
            <SortHeader id="status" label="Status" sort={sort} setSort={setSort} />
            <SortHeader id="registered" label="Registered" sort={sort} setSort={setSort} />
            <th scope="col" className={`${th} ${actionsCell}`}>Actions</th>
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => {
            const u = r.user || {};
            const events = r.eventIds.map((id) => eventsById.get(id)?.name).filter(Boolean);
            const people = peopleOf(r);
            const flags = renderFlags?.(r);
            return (
              <tr key={r.id} className="border-t border-shade/10 odd:bg-shade/[0.03] hover:bg-amber/[0.06] align-top">
            const study = [u.course, u.department, u.yearOfStudy].filter(Boolean).join(" · ");
                <td className="px-3 py-2.5 text-right text-dim tabular-nums">{i + 1}</td>
                <td className="px-3 py-2.5 font-mono text-[13px] whitespace-nowrap">{r.registrationCode}</td>
                <td className="px-3 py-2.5 min-w-[150px]">
                  <span className="font-medium text-heading">{u.name}</span>
                  {r.teamName && <span className="block text-xs text-dim">Team {r.teamName}</span>}
                  {flags}
                </td>
                <td className="px-3 py-2.5 min-w-[165px] max-w-[220px]">
                  {u.phone ? (
                    <a href={`tel:${u.phone}`} className="underline decoration-dotted whitespace-nowrap">{u.phone}</a>
                  ) : (
                    <span className="text-dim">No phone</span>
                  )}
                  {/* Wraps at "@" or "." when needed instead of mid-word. */}
                  <span className="block text-[13px] text-soft [overflow-wrap:anywhere]">{u.email}</span>
                </td>
                <td className="px-3 py-2.5 min-w-[150px] max-w-[220px]">
                  {r.collegeName || u.collegeName || <span className="text-dim">-</span>}
                  {(study || u.registerNo) && <span className="block text-xs text-dim mt-0.5">{study || u.registerNo}</span>}
                </td>
                <td className="px-3 py-2.5 min-w-[120px] max-w-[190px] text-[13px]">{events.join(", ") || <span className="text-dim">-</span>}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{people}</td>
                <td className="px-3 py-2.5 min-w-[120px] text-[13px]">
                  <span className="whitespace-nowrap">
                    {PAYMENT[r.paymentMethod] || r.paymentMethod} · ₹{r.totalAmount}
                  </span>
                  {r.transactionId && <span className="block font-mono text-xs text-dim">{r.transactionId}</span>}
                </td>
                <td className="px-3 py-2.5 min-w-[120px]">
                  <div className="flex flex-col items-start gap-1">
                    <Badge status={r.status} />
                    {r.paymentMethod === "later" && r.status !== "approved" && <Badge status="info">Payment due</Badge>}
                  </div>
                  {r.reviewedByName && <span className="block text-xs text-dim mt-1">by {r.reviewedByName}</span>}
                </td>
                <td className="px-3 py-2.5 whitespace-nowrap text-[13px]">{shortDate(r.createdAt)}</td>
                <td className={`px-3 py-2.5 ${actionsCell}`}>
                  <div className="grid gap-1.5 w-[150px]">
                    <button type="button" onClick={() => onDetails(r.id)} className="link-cta text-[13px] text-left">
                      Details
                    </button>
                    {renderActions?.(r)}
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
