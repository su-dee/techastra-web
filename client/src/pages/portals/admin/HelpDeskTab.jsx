import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { api } from "../../../lib/api";

// Queries sent from the public Help Desk panel (navbar → Help Desk), newest first.
const FILTERS = [
  ["open", "Open"],
  ["resolved", "Resolved"],
  ["all", "All"],
];

export default function HelpDeskTab({ onOpenCount }) {
  const [queries, setQueries] = useState(null);
  const [filter, setFilter] = useState("open");
  const [busy, setBusy] = useState(null);

  const load = () =>
    api
      .get("/api/help")
      .then((data) => setQueries(data.queries || []))
      .catch((err) => {
        setQueries([]);
        toast.error(err.message);
      });

  useEffect(() => {
    load();
  }, []);

  const openCount = queries ? queries.filter((q) => q.status !== "resolved").length : 0;
  useEffect(() => {
    if (queries) onOpenCount?.(openCount);
  }, [openCount, queries, onOpenCount]);

  const setStatus = async (q, action) => {
    setBusy(q.id);
    try {
      await api.patch(`/api/help/${q.id}/${action}`);
      toast.success(action === "resolve" ? "Marked as resolved" : "Reopened");
      await load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(null);
    }
  };

  const visible = (queries || []).filter((q) => filter === "all" || (filter === "open" ? q.status !== "resolved" : q.status === "resolved"));

  return (
    <div>
      <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
        <h2 className="font-heading text-xl font-semibold">
          Help Desk queries {queries && <span className="text-dim text-base font-normal">· {openCount} open</span>}
        </h2>
        <div className="flex gap-2" role="group" aria-label="Filter queries">
          {FILTERS.map(([k, label]) => (
            <button
              key={k}
              type="button"
              aria-pressed={filter === k}
              onClick={() => setFilter(k)}
              className={"chip" + (filter === k ? " is-active" : "")}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {!queries && <p className="text-dim">Loading queries…</p>}
      {queries && visible.length === 0 && (
        <Card className="text-center text-soft">
          {filter === "open" ? "No open queries — all caught up." : "No queries here yet."}
        </Card>
      )}

      <div className="space-y-3">
        {visible.map((q) => {
          const resolved = q.status === "resolved";
          const subject = encodeURIComponent("Re: your Techastra ’26 Help Desk query");
          const body = encodeURIComponent(`Hi ${q.name},\n\n\n\n— Techastra ’26 Team\n\n> ${q.message.replace(/\n/g, "\n> ")}`);
          return (
            <Card key={q.id} className={resolved ? "opacity-80" : ""}>
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-heading font-medium">
                    {q.name}{" "}
                    <a className="text-amber-light hover:underline text-sm font-normal break-all" href={`mailto:${q.email}`}>
                      {q.email}
                    </a>
                  </p>
                  <p className="text-dim text-xs mt-1">
                    {new Date(q.createdAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                </div>
                <Badge status={resolved ? "approved" : "pending"}>{resolved ? "Resolved" : "Open"}</Badge>
              </div>
              <p className="mt-3 text-[15px] text-text whitespace-pre-line break-words">{q.message}</p>
              <div className="flex flex-wrap gap-2 mt-4">
                <a className="btn-ghost-sm" href={`mailto:${q.email}?subject=${subject}&body=${body}`}>
                  Reply by email
                </a>
                {resolved ? (
                  <Button variant="outline" size="sm" disabled={busy === q.id} onClick={() => setStatus(q, "reopen")}>
                    Reopen
                  </Button>
                ) : (
                  <Button size="sm" disabled={busy === q.id} onClick={() => setStatus(q, "resolve")}>
                    Mark resolved
                  </Button>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
