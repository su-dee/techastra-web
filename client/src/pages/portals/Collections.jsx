import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import Button from "../../components/ui/Button";
import { api } from "../../lib/api";

const rupees = (n) => `₹${Number(n || 0).toLocaleString("en-IN")}`;
const FILE = { all: "All", online: "Online", onSpot: "On-spot", payLater: "Pay-later", due: "Pay-later-not-paid" };

/**
 * Money collected from approved registrations: the total, then online (UPI),
 * on spot (cash from walk-ups) and pay later (paid at the desk afterwards).
 * GET /api/registration-team/collections (server/utils/collections.js).
 */
export default function Collections() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const load = useCallback(() => {
    setLoading(true);
    api
      .get("/api/registration-team/collections")
      .then((d) => {
        setData(d);
        setError("");
      })
      .catch((e) => setError(e.message || "Couldn’t load the collections."))
      .finally(() => setLoading(false));
  }, []);
  useEffect(load, [load]);

  // The list behind a figure (or everything) as an Excel file.
  const [busy, setBusy] = useState("");
  const download = async (kind) => {
    setBusy(kind);
    try {
      const blob = await api.blob(`/api/registration-team/collections.xlsx?kind=${kind}`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Techastra26-Collections-${FILE[kind]}.xlsx`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (e) {
      toast.error(e.message || "Couldn’t download the list.");
    } finally {
      setBusy("");
    }
  };

  const tiles = data
    ? [
        ["Total collected", data.total, "approved registrations", "all"],
        ["Online", data.online, "UPI, checked by the desk", "online"],
        ["On spot", data.onSpot, "cash from walk-ups", "onSpot"],
        ["Pay later", data.payLater, "paid at the desk afterwards", "payLater"],
      ]
    : [];

  return (
    <section className="mb-10" aria-labelledby="collections-title">
      <div className="flex items-center justify-between gap-3 mb-3">
        <h2 id="collections-title" className="font-heading font-semibold text-xl">Money collected</h2>
        <div className="flex gap-2">
          <Button size="sm" onClick={() => download("all")} disabled={!data || busy === "all"}>
            {busy === "all" ? "Preparing…" : "Download all (Excel)"}
          </Button>
          <Button variant="outline" size="sm" onClick={load} disabled={loading} aria-label="Refresh collections">
            ↻
          </Button>
        </div>
      </div>
      {error ? (
        <p className="text-danger text-sm" role="alert">{error}</p>
      ) : !data ? (
        <p className="text-shade/50 text-sm">Loading…</p>
      ) : (
        <>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
            {tiles.map(([label, value, note, kind], i) => (
              <div key={label} className={`card p-4 ${i === 0 ? "border-amber/50" : ""}`}>
                <p className="mono-label">{label}</p>
                <p className={`mt-1 tabular-nums ${i === 0 ? "text-[28px] text-amber-light" : "text-[24px] text-heading"}`}>
                  {rupees(value.amount)}
                </p>
                <p className="text-[12px] text-dim mt-0.5">
                  {value.count} registration{value.count === 1 ? "" : "s"} · {note}
                </p>
                {kind !== "all" && (
                  <button
                    type="button"
                    className="link-cta text-[12px] mt-2 tap-24"
                    onClick={() => download(kind)}
                    disabled={busy === kind || !value.count}
                  >
                    {busy === kind ? "Preparing…" : "Download list"}
                  </button>
                )}
              </div>
            ))}
          </div>
          <p className="text-[13px] text-dim mt-3">
            Still due from pay-later registrations not yet paid: <strong className="text-heading">{rupees(data.due.amount)}</strong> (
            {data.due.count}
            {data.due.count > 0 && (
              <>
                ,{" "}
                <button type="button" className="link-cta tap-24" onClick={() => download("due")} disabled={busy === "due"}>
                  {busy === "due" ? "preparing…" : "download list"}
                </button>
              </>
            )}
            ). A pay-later registration that paid online counts as Online. “Download all” has a summary and every list.
          </p>
        </>
      )}
    </section>
  );
}
