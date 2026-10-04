import React, { useCallback, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { api } from "./api.js";
import { domainLabels, formatDate, useAdminData } from "./adminShared.jsx";
import useCameraScanner from "./useCameraScanner.js";
import ScannerPanel from "./ScannerPanel.jsx";

function ScanResult({ result, onDismiss }) {
  if (!result) return null;
  const { kind, squad, error } = result;
  const tone =
    kind === "checked_in" ? "ok" : kind === "already" ? "warn" : "bad";
  return (
    <div className={`scan-result ${tone}`} role="alert">
      <span className="scan-icon">
        {tone === "ok" ? (
          <Check size={28} />
        ) : tone === "warn" ? (
          <AlertTriangle size={26} />
        ) : (
          <X size={28} />
        )}
      </span>
      <div>
        <strong>
          {kind === "checked_in"
            ? "Checked in"
            : kind === "already"
              ? "Already checked in"
              : "Not admitted"}
        </strong>
        {squad ? (
          <>
            <p className="scan-team">{squad.team_name}</p>
            <p>
              {squad.squad_size} builders ·{" "}
              {domainLabels[squad.domain] || "Domain undecided"}
              {squad.problem_id ? ` · ${squad.problem_id}` : ""}
            </p>
            {kind === "already" && (
              <p>
                First scanned {formatDate(squad.checked_in_at)}
                {squad.checked_in_by ? ` by @${squad.checked_in_by}` : ""}
              </p>
            )}
          </>
        ) : (
          <p>{error}</p>
        )}
      </div>
      <button className="icon-button" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

export default function CheckIn({ onExpired }) {
  const [result, setResult] = useState(null);
  const attendance = useAdminData("/admin/attendance", onExpired);
  const { reload } = attendance;

  const submit = useCallback(
    async (code) => {
      try {
        const data = await api("/admin/attendance/scan", {
          method: "POST",
          body: { code },
        });
        setResult({ kind: data.result, squad: data.squad });
        navigator.vibrate?.(data.result === "checked_in" ? 80 : [60, 60, 60]);
        if (data.result === "checked_in") reload();
      } catch (e) {
        if (e.status === 401) return onExpired();
        setResult({ kind: "error", error: e.message });
        navigator.vibrate?.([120, 60, 120]);
      }
    },
    [onExpired, reload],
  );
  const scanner = useCameraScanner(submit);

  const totals = attendance.data?.totals;
  return (
    <div className="checkin-layout">
      <section className="admin-card scanner-card">
        <ScannerPanel
          scanner={scanner}
          idleText="Scan squad ID card QR codes to mark attendance."
          submitLabel="Check in"
        >
          <ScanResult result={result} onDismiss={() => setResult(null)} />
        </ScannerPanel>
      </section>
      <section className="admin-card">
        <h3>Attendance</h3>
        {totals && (
          <div className="attendance-totals">
            <div>
              <strong>
                {totals.checked_in}
                <small> / {totals.expected}</small>
              </strong>
              <span>squads checked in</span>
            </div>
            <div>
              <strong>{totals.people}</strong>
              <span>builders on site</span>
            </div>
          </div>
        )}
        <h4 className="recent-title">Recent check-ins</h4>
        {attendance.data?.recent.length ? (
          <ol className="recent-list">
            {attendance.data.recent.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.team_name}</strong>
                  <small>
                    {r.squad_size} builders
                    {r.checked_in_by ? ` · @${r.checked_in_by}` : ""}
                  </small>
                </span>
                <time>{formatDate(r.checked_in_at)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="admin-empty">No squads checked in yet.</p>
        )}
      </section>
    </div>
  );
}
