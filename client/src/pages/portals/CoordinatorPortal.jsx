import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import QRScanner from "../../components/QRScanner";
import ParticipantDetails from "../../components/ParticipantDetails";
import ParticipantDetailsModal from "../../components/ParticipantDetailsModal";
import { Select } from "../../components/ui/Input";
import { api } from "../../lib/api";
import { registrationCodeFromQr } from "../../lib/idCard";
import { useAuth } from "../../context/AuthContext";

const TABS = ["scan", "roster", "checked in", "winners"];
// Junior Techastra: students are imported by the Junior coordinator - no ID
// cards or check-in, and winners are picked from everyone imported.
const JUNIOR_TABS = ["students", "winners"];
// Check-in (scan or manual) opens an hour before the event starts; the
// server enforces the same window (server/utils/checkinWindow.js).
const CHECKIN_OPENS_BEFORE_MS = 60 * 60 * 1000;
const istTime = (d) =>
  d.toLocaleString("en-IN", { timeZone: "Asia/Kolkata", weekday: "short", day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });

// One scan of the lead's ID card checks in everyone on the registration.
// The team's members (lead first) from a roster row or scan details.
const membersOf = (r) => (r.members?.length ? r.members : [{ name: r.name, role: "lead" }]);
const teamTitle = (r) => (r.teamName ? r.teamName : membersOf(r).length > 1 ? `${r.name}'s team` : r.name);

/** Every member's name as a chip, ticked when they're checked in. */
function MemberChips({ members, present }) {
  return (
    <ul className="flex flex-wrap gap-1.5" aria-label="Team members">
      {members.map((m, i) => (
        <li
          key={`${m.name}-${i}`}
          className={`rounded-full border px-2.5 py-0.5 text-[13px] ${present ? "border-success/35 bg-success/10 text-success" : "border-shade/15 bg-shade/5 text-shade/70"}`}
        >
          {present && "✓ "}
          {m.name}
          {m.role === "lead" && members.length > 1 && <span className="opacity-70"> (lead)</span>}
        </li>
      ))}
    </ul>
  );
}

export default function CoordinatorPortal() {
  const { user } = useAuth();
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState(user?.assignedEventId || "");
  const [tab, setTab] = useState("scan");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scanResult, setScanResult] = useState(null); // { outcome, message, details } after a scan
  const [detailsId, setDetailsId] = useState(null); // roster entry whose full details are open
  const [checkedIn, setCheckedIn] = useState(null); // [{ checkedInAt, details }] for the "checked in" tab
  const [openCode, setOpenCode] = useState(null); // expanded entry in that list
  const [roster, setRoster] = useState([]);
  const [winners, setWinners] = useState({ 1: "", 2: "", 3: "" });
  const [locked, setLocked] = useState(false);
  const [existingResults, setExistingResults] = useState([]);
  // Re-checked every 30 s so the scanner unlocks on its own when check-in opens.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const t = setInterval(() => setNow(new Date()), 30000);
    return () => clearInterval(t);
  }, []);
  const [confirmLock, setConfirmLock] = useState(false); // "are you sure?" before results are locked
  const [agreed, setAgreed] = useState(false);
  const [locking, setLocking] = useState(false);

  useEffect(() => {
    api.get("/api/events").then((data) => setEvents(data.events || []));
  }, []);

  const loadRoster = useCallback(() => {
    if (!eventId) return;
    api
      .get(`/api/attendance/event/${eventId}`)
      .then((data) => setRoster(data.roster || []))
      .catch((err) => toast.error(err.message));
  }, [eventId]);

  const loadResults = useCallback(() => {
    if (!eventId) return;
    api.get(`/api/results?eventId=${eventId}`).then((data) => {
      setExistingResults(data.results || []);
      setLocked((data.results || []).length > 0);
    });
  }, [eventId]);

  useEffect(() => {
    loadRoster();
    loadResults();
  }, [loadRoster, loadResults]);

  useEffect(() => {
    const junior = events.find((e) => e.id === eventId)?.level === "junior";
    setTab((t) => ((junior ? JUNIOR_TABS : TABS).includes(t) ? t : junior ? "students" : "scan"));
  }, [events, eventId]);

  // Everyone checked in at this event, with their full details.
  const loadCheckedIn = useCallback(() => {
    if (!eventId) return;
    api
      .get(`/api/participants/checked-in?eventId=${encodeURIComponent(eventId)}`)
      .then((data) => setCheckedIn(data.participants || []))
      .catch((err) => toast.error(err.message));
  }, [eventId]);
  useEffect(() => {
    if (tab === "checked in") loadCheckedIn();
  }, [tab, loadCheckedIn]);

  // A scan checks the participant in, then shows the outcome with their
  // full details (also when they're already in, in another event, or not
  // approved).
  const handleScan = useCallback(
    async (decodedText) => {
      setScannerOpen(false);
      try {
        const data = await api.post("/api/attendance/scan", { registrationCode: registrationCodeFromQr(decodedText), eventId });
        setScanResult({ outcome: "checked_in", message: `Checked in: ${data.team?.label || data.participant.name}`, details: data.details });
        loadRoster();
      } catch (err) {
        if (err.data?.details) setScanResult({ outcome: err.data.outcome, message: err.message, details: err.data.details });
        else toast.error(err.message);
      }
    },
    [eventId, loadRoster]
  );
  const scanNext = () => {
    setScanResult(null);
    setScannerOpen(true);
  };

  const manualCheckIn = async (registrationId) => {
    try {
      await api.post("/api/attendance/manual", { registrationId, eventId });
      toast.success("Checked in");
      loadRoster();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const winnerPayload = () =>
    Object.entries(winners)
      .filter(([, regId]) => regId)
      .map(([position, registrationId]) => ({ position: Number(position), registrationId }));

  // Locking can't be undone by the coordinator, so ask first.
  const askToLock = () => {
    if (winnerPayload().length === 0) return toast.error("Select at least one winner");
    setAgreed(false);
    setConfirmLock(true);
  };

  const submitWinners = async () => {
    setLocking(true);
    try {
      await api.post("/api/results", { eventId, winners: winnerPayload() });
      toast.success("Results locked!");
      setConfirmLock(false);
      loadResults();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLocking(false);
    }
  };

  const selectedEvent = events.find((e) => e.id === eventId);
  const isJunior = selectedEvent?.level === "junior";
  const tabs = isJunior ? JUNIOR_TABS : TABS;
  const present = roster.filter((r) => r.present);
  const candidates = isJunior ? roster : present;
  const checkinOpensAt = selectedEvent ? new Date(new Date(selectedEvent.startTime).getTime() - CHECKIN_OPENS_BEFORE_MS) : null;
  const checkinLocked = !!checkinOpensAt && !isJunior && now < checkinOpensAt;
  const lockedNote = checkinOpensAt ? `Check-in opens at ${istTime(checkinOpensAt)}, an hour before the event.` : "";
  const rosterById = new Map(roster.map((r) => [r.registrationId, r]));
  const people = (rows) => rows.reduce((n, r) => n + membersOf(r).length, 0);
  const hasTeams = roster.some((r) => membersOf(r).length > 1);
  // "4 / 10 teams · 11 / 27 people" for team events, "4 / 10 present" otherwise.
  const presentSummary = hasTeams
    ? `${present.length} / ${roster.length} teams · ${people(present)} / ${people(roster)} people present`
    : `${present.length} / ${roster.length} present`;

  return (
    <div className="max-w-5xl mx-auto px-6 py-10">
      <h1 className="font-heading text-3xl font-bold mb-6">Event Coordinator Portal</h1>

      {user?.role === "master_admin" && (
        <div className="mb-6 max-w-sm">
          <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
            <option value="">Select an event to manage</option>
            {events.map((e) => (
              <option key={e.id} value={e.id}>{e.name}</option>
            ))}
          </Select>
        </div>
      )}

      {!eventId ? (
        <p className="text-shade/50">No event assigned to this account.</p>
      ) : (
        <>
          <h2 className="font-heading text-xl font-semibold mb-4 text-cyan">{selectedEvent?.name}</h2>

          <div className="flex gap-2 mb-6 overflow-x-auto">
            {tabs.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-[linear-gradient(100deg,#ddbb6a,#c9a24a)] text-[#2c2823] font-semibold" : "bg-shade/5 text-[color:var(--c-b4ab9b)] hover:text-heading"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "students" && isJunior && (
            <Card>
              <div className="flex items-center justify-between gap-3 mb-2">
                <h3 className="font-semibold">Junior students</h3>
                <span className="text-sm text-shade/50">
                  {hasTeams ? `${roster.length} teams/students · ${people(roster)} people` : `${roster.length} students`}
                </span>
              </div>
              <p className="text-sm text-shade/60 mb-4">
                Imported by the Junior Techastra coordinator. Junior events have no ID cards or check-in.
              </p>
              {roster.length === 0 ? (
                <p className="text-shade/50 text-sm">No students imported for this event yet.</p>
              ) : (
                <div className="space-y-2">
                  {roster.map((r) => (
                    <div key={r.registrationId} className="bg-shade/5 rounded-lg px-4 py-3 space-y-1.5">
                      <p className="text-sm font-medium">
                        {teamTitle(r)}
                        {membersOf(r).length > 1 && <span className="text-shade/50 font-normal"> · {membersOf(r).length} members</span>}
                      </p>
                      {membersOf(r).length > 1 && (
                        <p className="text-[13px] text-shade/70">{membersOf(r).map((m) => `${m.name}${m.className ? ` (${m.className})` : ""}`).join(", ")}</p>
                      )}
                      <p className="text-xs text-shade/50">
                        {r.registrationCode} · {r.college}
                        {membersOf(r).length === 1 && r.members?.[0]?.className ? ` · Class ${r.members[0].className}` : ""}
                      </p>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          )}

          {tab === "scan" && !isJunior && (
            <Card>
              {checkinLocked ? (
                <p role="status" className="mb-4 rounded-lg border border-warning/35 bg-warning/10 px-4 py-3 text-warning font-medium">
                  🔒 {lockedNote}
                </p>
              ) : (
                <p className="text-shade/60 mb-4">Scan a participant's QR code to check them in.</p>
              )}
              <Button onClick={() => setScannerOpen(true)} disabled={checkinLocked}>
                Open Scanner
              </Button>
              {hasTeams && <p className="text-sm text-shade/60 mt-3">Scanning any team member’s ID card checks in the whole team.</p>}
              <p className="text-sm text-shade/50 mt-4">{presentSummary}</p>
            </Card>
          )}

          {tab === "roster" && !isJunior && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Present / Absent List</h3>
                <span className="text-sm text-shade/50">{presentSummary}</span>
              </div>
              {checkinLocked && <p className="text-sm text-warning mb-3">🔒 {lockedNote}</p>}
              <div className="space-y-2">
                {roster.map((r) => (
                  <div key={r.registrationId} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-shade/5 rounded-lg px-4 py-3">
                    <div className="min-w-0 space-y-1.5">
                      <p className="text-sm font-medium">
                        {teamTitle(r)}
                        {membersOf(r).length > 1 && <span className="text-shade/50 font-normal"> · {membersOf(r).length} members</span>}
                        {r.choice && <span className="ml-2 pill">{r.choice}</span>}
                      </p>
                      {membersOf(r).length > 1 && <MemberChips members={membersOf(r)} present={r.present} />}
                      <p className="text-xs text-shade/50">{r.registrationCode} · {r.college}</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Badge status={r.present ? "present" : "absent"} />
                      <Button size="sm" variant="outline" onClick={() => setDetailsId(r.registrationId)}>
                        Details
                      </Button>
                      {!r.present && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => manualCheckIn(r.registrationId)}
                          disabled={checkinLocked}
                          title={checkinLocked ? lockedNote : undefined}
                        >
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "checked in" && !isJunior && (
            <Card>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold">
                  Checked in ({checkedIn ? (hasTeams ? `${checkedIn.length} teams · ${checkedIn.reduce((n, c) => n + c.details.team.size, 0)} people` : checkedIn.length) : "…"})
                </h3>
                <Button size="sm" variant="outline" onClick={loadCheckedIn} aria-label="Refresh checked-in list">
                  ↻
                </Button>
              </div>
              {!checkedIn ? (
                <p className="text-shade/50 text-sm">Loading…</p>
              ) : checkedIn.length === 0 ? (
                <p className="text-shade/50 text-sm">No one has checked in yet.</p>
              ) : (
                <div className="space-y-2">
                  {checkedIn.map(({ checkedInAt, details }) => {
                    const open = openCode === details.registrationCode;
                    return (
                      <div key={details.registrationCode} className="bg-shade/5 rounded-lg">
                        <button
                          type="button"
                          aria-expanded={open}
                          onClick={() => setOpenCode(open ? null : details.registrationCode)}
                          className="w-full flex items-center justify-between gap-3 px-4 py-3 text-left"
                        >
                          <span className="min-w-0 space-y-1">
                            <span className="block text-sm font-medium">
                              {details.team.size > 1 ? `${details.team.name || `${details.person.name}'s team`} · ${details.team.size} members` : details.person.name}
                            </span>
                            {details.team.size > 1 && (
                              <span className="block text-[13px] text-success">✓ {details.team.members.map((m) => m.name).join(", ")}</span>
                            )}
                            <span className="block text-xs text-shade/60">
                              {details.registrationCode} · {details.person.phone || details.person.email} · in at{" "}
                              {new Date(checkedInAt).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" })}
                            </span>
                          </span>
                          <span className="shrink-0 text-shade/60 text-sm">{open ? "Hide ▲" : "Details ▼"}</span>
                        </button>
                        {open && (
                          <div className="px-4 pb-4 border-t border-shade/10 pt-4">
                            <ParticipantDetails details={details} highlightEventId={eventId} />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </Card>
          )}

          {tab === "winners" && (
            <Card>
              {locked ? (
                <div>
                  <p className="text-warning mb-4 font-semibold">Results are locked. Contact a Master Admin to override.</p>
                  <div className="space-y-2">
                    {existingResults
                      .sort((a, b) => a.position - b.position)
                      .map((r) => (
                        <div key={r.id} className="bg-shade/5 rounded-lg px-4 py-2 text-sm">
                          #{r.position} — {rosterById.has(r.registrationId) ? teamTitle(rosterById.get(r.registrationId)) : r.registrationId}
                        </div>
                      ))}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  {[1, 2, 3].map((pos) => (
                    <div key={pos}>
                      <label className="block text-sm text-shade/70 mb-1">
                        {pos === 1 ? "🥇 1st Place" : pos === 2 ? "🥈 2nd Place" : "🥉 3rd Place"}
                      </label>
                      <Select
                        value={winners[pos]}
                        onChange={(e) => setWinners((w) => ({ ...w, [pos]: e.target.value }))}
                      >
                        <option value="">Select participant/team</option>
                        {candidates.map((r) => (
                          <option key={r.registrationId} value={r.registrationId}>
                            {teamTitle(r)}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                  <Button className="w-full" onClick={askToLock}>Lock Results</Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Scan Participant QR" fullScreen>
        <QRScanner active={scannerOpen} onScan={handleScan} />
      </Modal>

      <Modal open={confirmLock} onClose={() => !locking && setConfirmLock(false)} title="Lock these results?" size="sm">
        <div className="space-y-5">
          <ul className="space-y-2">
            {winnerPayload().map(({ position, registrationId }) => (
              <li key={position} className="bg-shade/5 rounded-lg px-4 py-2 text-sm">
                {position === 1 ? "🥇 1st" : position === 2 ? "🥈 2nd" : "🥉 3rd"} —{" "}
                {rosterById.has(registrationId) ? teamTitle(rosterById.get(registrationId)) : registrationId}
              </li>
            ))}
          </ul>
          <p className="text-sm text-warning">
            Once locked, you can't change the results. Only a Master Admin can override them, and certificates are issued from them.
          </p>
          <label className="flex items-start gap-3 text-sm cursor-pointer">
            <input type="checkbox" className="mt-0.5 h-4 w-4 accent-[#c9a24a]" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} />
            <span>I have checked the winners and agree to lock these results.</span>
          </label>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirmLock(false)} disabled={locking}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={submitWinners} disabled={!agreed || locking}>
              {locking ? "Locking…" : "Agree & lock"}
            </Button>
          </div>
        </div>
      </Modal>

      <ParticipantDetailsModal registrationId={detailsId} onClose={() => setDetailsId(null)} highlightEventId={eventId} />

      <Modal open={!!scanResult} onClose={() => setScanResult(null)} title="Participant">
        {scanResult && (
          <div className="space-y-5">
            <div
              role="status"
              className={`rounded-lg border px-4 py-3 font-semibold ${
                scanResult.outcome === "checked_in"
                  ? "border-success/35 bg-success/10 text-success"
                  : "border-danger/40 bg-danger/10 text-danger"
              }`}
            >
              {scanResult.outcome === "checked_in" ? "✓ " : ""}
              {scanResult.message}
            </div>
            {(scanResult.outcome === "checked_in" || scanResult.outcome === "already") && scanResult.details?.team.size > 1 && (
              <div>
                <p className="font-mono text-[11px] tracking-[0.14em] uppercase text-dim mb-2">
                  {scanResult.details.team.name ? `Team ${scanResult.details.team.name}` : "Team"} · checked in together
                </p>
                <MemberChips members={scanResult.details.team.members} present />
              </div>
            )}
            <Button variant="outline" className="w-full" onClick={scanNext}>
              Scan next
            </Button>
            <div className="border-t border-shade/15 pt-5">
              <ParticipantDetails details={scanResult.details} highlightEventId={eventId} />
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
