import React, { useEffect, useState } from "react";
import { useParams, useSearchParams } from "react-router-dom";
import Badge from "../components/ui/Badge";
import { api } from "../lib/api";

const IST = "Asia/Kolkata";
const when = (e) => {
  const d = new Date(e.startTime);
  const date = d.toLocaleDateString("en-IN", { timeZone: IST, day: "numeric", month: "short" });
  const t = (x) => new Date(x).toLocaleTimeString("en-IN", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  return `${date}, ${t(e.startTime)} – ${t(e.endTime)}${e.venue ? ` · ${e.venue}` : ""}`;
};

/**
 * What a participant ID card's QR opens (/verify/<code>?t=<token>): confirms
 * the card is genuine and approved, with the details printed on it and the
 * participant's events. Same layout as the certificate check.
 */
export default function VerifyDelegate() {
  const { code } = useParams();
  const [params] = useSearchParams();
  const [result, setResult] = useState(null);

  useEffect(() => {
    api
      .get(`/api/registrations/verify/${encodeURIComponent(code)}?t=${encodeURIComponent(params.get("t") || "")}`)
      .then(setResult)
      .catch((err) => setResult({ valid: false, error: err.message }));
  }, [code, params]);

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <div className="text-center mb-10 animate-cinematic-fade">
        <p className="kicker">ID card check</p>
        <h1 className="h2">Techastra ’26 delegate</h1>
      </div>

      <div role="status" aria-live="polite" className="text-center">
        {!result ? (
          <p className="text-soft text-sm">Checking…</p>
        ) : result.valid ? (
          <div className="pt-8 border-t border-line animate-cinematic-fade">
            <Badge status="approved" className="mb-4">Valid ID card</Badge>
            <p className="text-2xl text-heading">{result.name}</p>
            <p className="text-soft text-sm mt-1">{result.institution}</p>
            <dl className="mt-5 grid grid-cols-2 gap-3 text-left">
              <div className="fact">
                <dt className="mono-label">Delegate ID</dt>
                <dd>{result.registrationCode}</dd>
              </div>
              <div className="fact">
                <dt className="mono-label">Registration No.</dt>
                <dd>{result.registerNo || "—"}</dd>
              </div>
            </dl>
            {result.teamName && <p className="text-soft text-sm mt-4">Team: <span className="text-heading">{result.teamName}</span></p>}
            {result.events?.length > 0 && (
              <div className="mt-6 text-left">
                <p className="mono-label mb-2">Registered events</p>
                <ul className="space-y-2">
                  {result.events.map((e) => (
                    <li key={e.name} className="fact">
                      <div className="text-heading">{e.name}</div>
                      <div className="text-[13px] text-soft">{when(e)}</div>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        ) : (
          <div className="pt-8 border-t border-line animate-cinematic-fade">
            <Badge status="rejected">Not valid</Badge>
            <p className="text-soft text-sm mt-3">{result.error || "This is not a valid Techastra ’26 ID card."}</p>
            <p className="text-dim text-[13px] mt-2">Scan the QR on the participant’s card again, or check them in by name at the desk.</p>
          </div>
        )}
      </div>
    </div>
  );
}
