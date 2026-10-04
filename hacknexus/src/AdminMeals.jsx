import React, { useCallback, useState } from "react";
import { AlertTriangle, Check, X } from "lucide-react";
import { api } from "./api.js";
import { formatDate, useAdminData } from "./adminShared.jsx";
import useCameraScanner from "./useCameraScanner.js";
import ScannerPanel from "./ScannerPanel.jsx";

// The meal this device is serving, kept across reloads on this device.
const MEAL_KEY = "hn_food_meal";
const savedMeal = () => {
  try {
    return localStorage.getItem(MEAL_KEY) || "";
  } catch {
    return "";
  }
};

function MealResult({ result, onDismiss }) {
  if (!result) return null;
  const { kind, squad, meal, handout, error } = result;
  const tone = kind === "given" ? "ok" : kind === "already" ? "warn" : "bad";
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
          {kind === "given"
            ? `Serve ${handout.people} builders`
            : kind === "already"
              ? "Already collected"
              : "Don’t serve"}
        </strong>
        {squad ? (
          <>
            <p className="scan-team">{squad.team_name}</p>
            <p>
              {meal.label} · {squad.squad_size} builders
            </p>
            {kind === "already" && (
              <p>
                Collected {formatDate(handout.given_at)}
                {handout.given_by ? ` at @${handout.given_by}` : ""}
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

// Food counter: scan a squad's ID card for the chosen meal. Each squad
// collects each meal once, for all its members.
export default function Meals({ onExpired }) {
  const summary = useAdminData("/admin/meals", onExpired);
  const { reload } = summary;
  const meals = summary.data?.meals || [];
  const [chosen, setChosen] = useState(savedMeal);
  const meal = meals.find((m) => m.id === chosen) ? chosen : "";
  const [result, setResult] = useState(null);

  const choose = (id) => {
    setChosen(id);
    setResult(null);
    try {
      localStorage.setItem(MEAL_KEY, id);
    } catch {}
  };

  const submit = useCallback(
    async (code) => {
      if (!meal) {
        setResult({ kind: "error", error: "Choose the meal you’re serving first." });
        return;
      }
      try {
        const data = await api("/admin/meals/scan", {
          method: "POST",
          body: { code, meal },
        });
        setResult({ kind: data.result, squad: data.squad, meal: data.meal, handout: data.handout });
        navigator.vibrate?.(data.result === "given" ? 80 : [60, 60, 60]);
        if (data.result === "given") reload();
      } catch (e) {
        if (e.status === 401) return onExpired();
        setResult({ kind: "error", error: e.message });
        navigator.vibrate?.([120, 60, 120]);
      }
    },
    [meal, onExpired, reload],
  );
  const scanner = useCameraScanner(submit);
  const expected = summary.data?.expected;

  return (
    <div className="checkin-layout">
      <section className="admin-card scanner-card">
        <p className="meal-picker-label" id="meal-picker-label">
          Serving
        </p>
        <div className="segmented meal-picker" role="group" aria-labelledby="meal-picker-label">
          {meals.map((m) => (
            <button
              key={m.id}
              className={meal === m.id ? "active" : ""}
              aria-pressed={meal === m.id}
              onClick={() => choose(m.id)}
            >
              {m.label}
            </button>
          ))}
        </div>
        <ScannerPanel
          scanner={scanner}
          idleText={
            meal
              ? "Scan the squad’s ID card QR to hand out the meal."
              : "Choose the meal you’re serving, then start scanning."
          }
          submitLabel="Give meal"
        >
          <MealResult result={result} onDismiss={() => setResult(null)} />
        </ScannerPanel>
      </section>
      <section className="admin-card">
        <h3>Food served</h3>
        {expected && (
          <ul className="meal-totals">
            {meals.map((m) => (
              <li key={m.id} className={meal === m.id ? "current" : ""}>
                <span>{m.label}</span>
                <strong>
                  {m.squads}
                  <small> / {expected.squads} squads</small>
                </strong>
                <small>{m.people} builders</small>
              </li>
            ))}
          </ul>
        )}
        <h4 className="recent-title">Recently served</h4>
        {summary.data?.recent.length ? (
          <ol className="recent-list">
            {summary.data.recent.map((r) => (
              <li key={`${r.team_name}-${r.meal}`}>
                <span>
                  <strong>{r.team_name}</strong>
                  <small>
                    {r.label} · {r.people} builders
                    {r.given_by ? ` · @${r.given_by}` : ""}
                  </small>
                </span>
                <time>{formatDate(r.given_at)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="admin-empty">No meals handed out yet.</p>
        )}
      </section>
    </div>
  );
}
