import React, { useCallback, useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import QRScanner from "../../components/QRScanner";
import ParticipantDetails from "../../components/ParticipantDetails";
import { Input } from "../../components/ui/Input";
import { api } from "../../lib/api";
import { registrationCodeFromQr } from "../../lib/idCard";
import { useAuth } from "../../context/AuthContext";

const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const kitsLabel = (n) => `${n} kit${n === 1 ? "" : "s"}`;

/**
 * Registration desk: scan a participant's ID card, check who it is, hand
 * over the welcome kits (one per person on the registration) - once.
 */
export default function KitDesk() {
  const { user } = useAuth();
  const [scannerOpen, setScannerOpen] = useState(false);
  const [code, setCode] = useState("");
  const [result, setResult] = useState(null); // the scanned registration (GET /api/kits/:code)
  const [busy, setBusy] = useState(false);
  const [summary, setSummary] = useState({ registrations: 0, kits: 0, recent: [] });

  const loadSummary = useCallback(() => {
    api.get("/api/kits").then(setSummary).catch(() => {});
  }, []);
  useEffect(loadSummary, [loadSummary]);

  const lookUp = async (registrationCode) => {
    if (!registrationCode) return;
    setBusy(true);
    try {
      setResult(await api.get(`/api/kits/${encodeURIComponent(registrationCode)}`));
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const onScan = useCallback((text) => {
    setScannerOpen(false);
    lookUp(registrationCodeFromQr(text));
  }, []);

  const give = async () => {
    setBusy(true);
    try {
      const data = await api.post(`/api/kits/${encodeURIComponent(result.registrationCode)}`);
      setResult(data);
      toast.success(`${kitsLabel(data.handout.kits)} given to ${data.name}`);
      loadSummary();
    } catch (err) {
      toast.error(err.message);
      lookUp(result.registrationCode); // show what the server has now (e.g. another desk got there first)
    } finally {
      setBusy(false);
    }
  };

  const undo = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/kits/${encodeURIComponent(result.registrationCode)}`);
      toast.success("Kit handout undone");
      await lookUp(result.registrationCode);
      loadSummary();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  const scanNext = () => {
    setResult(null);
    setScannerOpen(true);
  };

  const canGive = result && result.status === "approved" && !result.handout;

  return (
    <section className="mb-10" aria-label="Kit handout">
      <h2 className="font-heading font-semibold text-xl mb-3">Kit handout</h2>
      <Card className="!p-4 sm:!p-5">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <p className="text-sm text-shade/70">
              Scan the participant's ID card QR, check the name, then hand over the kits.
            </p>
            <p className="mt-1 font-mono text-[13px] text-dim">
              Given so far: {kitsLabel(summary.kits)} · {summary.registrations} registration{summary.registrations === 1 ? "" : "s"}
            </p>
          </div>
          <Button onClick={() => setScannerOpen(true)} className="sm:w-auto w-full">
            Scan ID card
          </Button>
        </div>
        <form
          className="flex gap-2 mt-4"
          onSubmit={(e) => {
            e.preventDefault();
            lookUp(registrationCodeFromQr(code));
          }}
        >
          <Input
            aria-label="Registration code"
            placeholder="Or type the code, e.g. SYM2026-0042"
            value={code}
            onChange={(e) => setCode(e.target.value)}
          />
          <Button type="submit" variant="outline" disabled={busy || !code.trim()}>
            Find
          </Button>
        </form>

        {summary.recent.length > 0 && (
          <details className="mt-4">
            <summary className="cursor-pointer text-sm text-shade/70">Latest handouts</summary>
            <ul className="mt-2 space-y-1.5">
              {summary.recent.map((h) => (
                <li key={`${h.registrationCode}-${h.givenAt}`} className="flex flex-col sm:flex-row sm:justify-between gap-0.5 sm:gap-3 bg-shade/5 rounded-lg px-3 py-2 text-sm">
                  <span className="min-w-0 break-words">
                    {h.name} <span className="font-mono text-dim text-[12px]">{h.registrationCode}</span>
                  </span>
                  <span className="sm:shrink-0 text-shade/60">
                    {kitsLabel(h.kits)} · {h.givenByName} · {time(h.givenAt)}
                  </span>
                </li>
              ))}
            </ul>
          </details>
        )}
      </Card>

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Scan ID card for kit" fullScreen>
        <QRScanner active={scannerOpen} onScan={onScan} />
      </Modal>

      <Modal open={!!result} onClose={() => setResult(null)} title="Kit handout">
        {result && (
          <div className="space-y-5">
            {/* The decision and the buttons first, so they're on screen without scrolling. */}
            <div className="space-y-3">
              <p className="font-semibold text-lg leading-tight">
                {result.name} <span className="font-mono text-sm text-dim">{result.registrationCode}</span>
              </p>
              {result.handout ? (
                <div role="status" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger">
                  <p className="font-semibold">Already given - don't hand over again</p>
                  <p className="text-sm">
                    {kitsLabel(result.handout.kits)} by {result.handout.givenByName} at {time(result.handout.givenAt)}
                  </p>
                </div>
              ) : result.status !== "approved" ? (
                <div role="status" className="rounded-lg border border-danger/40 bg-danger/10 px-4 py-3 text-danger">
                  <p className="font-semibold">Not approved - no kit</p>
                  <p className="text-sm">Send them to the review desk to sort out the registration first.</p>
                </div>
              ) : (
                <p className="rounded-lg border border-success/35 bg-success/10 px-4 py-3 text-success font-semibold">
                  Hand over {kitsLabel(result.kitsDue)}
                </p>
              )}
              <div className="flex flex-col sm:flex-row gap-2">
                {canGive && (
                  <Button onClick={give} disabled={busy} className="flex-1">
                    {busy ? "Saving..." : `Give ${kitsLabel(result.kitsDue)}`}
                  </Button>
                )}
                <Button variant="outline" onClick={scanNext} disabled={busy} className="flex-1">
                  Scan next
                </Button>
                {result.handout && user?.role === "master_admin" && (
                  <Button variant="danger" onClick={undo} disabled={busy}>
                    Undo handout
                  </Button>
                )}
              </div>
            </div>

            <div className="border-t border-shade/15 pt-5">
              <ParticipantDetails details={result.details} />
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
