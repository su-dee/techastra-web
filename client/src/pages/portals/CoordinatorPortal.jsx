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
  // approved). Memoised: the scanner restarts whenever onScan changes.
  const handleScan = useCallback(
    async (decodedText) => {
      setScannerOpen(false);
      try {
        const data = await api.post("/api/attendance/scan", { registrationCode: registrationCodeFromQr(decodedText), eventId });
        setScanResult({ outcome: "checked_in", message: `Checked in: ${data.participant.name}`, details: data.details });
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

  const submitWinners = async () => {
    const payload = Object.entries(winners)
      .filter(([, regId]) => regId)
      .map(([position, registrationId]) => ({ position: Number(position), registrationId }));

    if (payload.length === 0) return toast.error("Select at least one winner");

    try {
      await api.post("/api/results", { eventId, winners: payload });
      toast.success("Results locked!");
      loadResults();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const selectedEvent = events.find((e) => e.id === eventId);

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
            {TABS.map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={`shrink-0 px-4 py-2 rounded-lg text-sm font-medium capitalize ${tab === t ? "bg-[linear-gradient(100deg,#ddbb6a,#c9a24a)] text-[#2c2823] font-semibold" : "bg-shade/5 text-[color:var(--c-b4ab9b)] hover:text-heading"}`}
              >
                {t}
              </button>
            ))}
          </div>

          {tab === "scan" && (
            <Card>
              <p className="text-shade/60 mb-4">Scan a participant's QR code to check them in.</p>
              <Button onClick={() => setScannerOpen(true)}>Open Scanner</Button>
              <p className="text-sm text-shade/50 mt-4">
                Present: {roster.filter((r) => r.present).length} / {roster.length}
              </p>
            </Card>
          )}

          {tab === "roster" && (
            <Card>
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold">Present / Absent List</h3>
                <span className="text-sm text-shade/50">{roster.filter((r) => r.present).length} / {roster.length} present</span>
              </div>
              <div className="space-y-2">
                {roster.map((r) => (
                  <div key={r.registrationId} className="flex items-center justify-between bg-shade/5 rounded-lg px-4 py-2">
                    <div>
                      <p className="text-sm font-medium">{r.name} {r.teamName ? `(${r.teamName})` : ""}</p>
                      <p className="text-xs text-shade/50">{r.registrationCode} · {r.college}</p>
                    </div>
                    <div className="flex items-center gap-2">
                      <Badge status={r.present ? "present" : "absent"} />
                      {r.present && (
                        <Button size="sm" variant="outline" onClick={() => setDetailsId(r.registrationId)}>
                          Details
                        </Button>
                      )}
                      {!r.present && (
                        <Button size="sm" variant="outline" onClick={() => manualCheckIn(r.registrationId)}>
                          Check In
                        </Button>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </Card>
          )}

          {tab === "checked in" && (
            <Card>
              <div className="flex items-center justify-between gap-3 mb-4">
                <h3 className="font-semibold">Checked in ({checkedIn ? checkedIn.length : "…"})</h3>
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
                          <span className="min-w-0">
                            <span className="block text-sm font-medium">
                              {details.person.name} {details.team.name ? `(${details.team.name})` : ""}
                            </span>
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
                          #{r.position} — {roster.find((p) => p.registrationId === r.registrationId)?.name || r.registrationId}
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
                        {roster.filter((r) => r.present).map((r) => (
                          <option key={r.registrationId} value={r.registrationId}>
                            {r.teamName || r.name}
                          </option>
                        ))}
                      </Select>
                    </div>
                  ))}
                  <Button className="w-full" onClick={submitWinners}>Lock Results</Button>
                </div>
              )}
            </Card>
          )}
        </>
      )}

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title="Scan Participant QR" fullScreen>
        <QRScanner active={scannerOpen} onScan={handleScan} />
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
