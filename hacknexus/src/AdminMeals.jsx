import React, { useCallback, useMemo, useState } from "react";
import { AlertTriangle, Check, Search, X } from "lucide-react";
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

// Every squad (approved, payment verified) and whether it has collected the
// chosen meal - the full list behind the "Food served" totals.
function TeamsByMeal({ teams, meals, servingMeal }) {
  const [picked, setPicked] = useState("");
  const [show, setShow] = useState("pending"); // pending | collected | all
  const [search, setSearch] = useState("");
  const mealId = picked || servingMeal || meals[0]?.id || "";
  const label = meals.find((m) => m.id === mealId)?.label || "";
  const expected = teams.filter((t) => t.expected);
  const done = expected.filter((t) => t.meals[mealId]).length;
  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    return teams.filter((t) => {
      const got = !!t.meals[mealId];
      if (show === "pending" && (got || !t.expected)) return false;
      if (show === "collected" && !got) return false;
      return !q || t.team_name.toLowerCase().includes(q);
    });
  }, [teams, mealId, show, search]);

  return (
    <section className="admin-card meal-teams">
      <h3>Teams by meal</h3>
      <p className="meal-teams-count">
        {label}: <strong>{done}</strong> of {expected.length} squads collected · {expected.length - done} not yet
      </p>
      <div className="admin-toolbar">
        <div className="segmented" role="group" aria-label="Meal">
          {meals.map((m) => (
            <button key={m.id} className={mealId === m.id ? "active" : ""} aria-pressed={mealId === m.id} onClick={() => setPicked(m.id)}>
              {m.label}
            </button>
          ))}
        </div>
        <select value={show} onChange={(e) => setShow(e.target.value)} aria-label="Show">
          <option value="pending">Not collected yet</option>
          <option value="collected">Collected</option>
          <option value="all">All squads</option>
        </select>
        <label className="search-field">
          <Search size={16} />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search team" aria-label="Search team" />
        </label>
      </div>
      <div className="table-wrap">
        {rows.length ? (
          <table className="admin-table">
            <thead>
              <tr>
                <th>Team</th>
                <th>Builders</th>
                <th>{label}</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((t) => {
                const got = t.meals[mealId];
                return (
                  <tr key={t.team_name}>
                    <td>
                      {t.team_name}
                      {!t.expected && <small>No longer approved or paid</small>}
                    </td>
                    <td>{t.squad_size}</td>
                    <td>
                      {got ? (
                        <>
                          <span className="status-pill status-approved">Collected</span>
                          <small>
                            {formatDate(got.given_at)} · {got.people} builders{got.given_by ? ` · @${got.given_by}` : ""}
                          </small>
                        </>
                      ) : (
                        <span className="status-pill status-pending">Not yet</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <p className="admin-empty">
            {show === "pending" ? "Every squad has collected this meal." : show === "collected" ? "No squad has collected this meal yet." : "No squads to show."}
          </p>
        )}
      </div>
    </section>
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
    <>
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
    {summary.data?.teams && <TeamsByMeal teams={summary.data.teams} meals={meals} servingMeal={meal} />}
    </>
  );
}
