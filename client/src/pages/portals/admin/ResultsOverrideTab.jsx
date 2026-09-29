import React, { useEffect, useState, useCallback } from "react";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { Select } from "../../../components/ui/Input";
import { api } from "../../../lib/api";

export default function ResultsOverrideTab() {
  const [events, setEvents] = useState([]);
  const [eventId, setEventId] = useState("");
  const [roster, setRoster] = useState([]);
  const [winners, setWinners] = useState({ 1: "", 2: "", 3: "" });
  const [existing, setExisting] = useState([]);

  useEffect(() => {
    api.get("/api/events").then((data) => setEvents(data.events || []));
  }, []);

  const load = useCallback(() => {
    if (!eventId) return;
    api.get(`/api/attendance/event/${eventId}`).then((data) => setRoster(data.roster || []));
    api.get(`/api/results?eventId=${eventId}`).then((data) => {
      setExisting(data.results || []);
      const preset = { 1: "", 2: "", 3: "" };
      for (const r of data.results || []) preset[r.position] = r.registrationId;
      setWinners(preset);
    });
  }, [eventId]);

  useEffect(load, [load]);

  const override = async () => {
    const payload = Object.entries(winners)
      .filter(([, regId]) => regId)
      .map(([position, registrationId]) => ({ position: Number(position), registrationId }));

    if (payload.length === 0) return toast.error("Select at least one winner");

    try {
      await api.patch("/api/results/override", { eventId, winners: payload });
      toast.success("Results overridden");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold mb-6">Override Locked Results</h2>

      <div className="max-w-sm mb-6">
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)}>
          <option value="">Select an event</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </Select>
      </div>

      {eventId && (
        <Card className="max-w-md">
          {existing.length > 0 && (
            <p className="text-sm text-warning mb-4">
              This event already has locked results — submitting below will overwrite them.
            </p>
          )}
          <div className="space-y-4">
            {[1, 2, 3].map((pos) => (
              <div key={pos}>
                <label className="block text-sm text-shade/70 mb-1">
                  {pos === 1 ? "🥇 1st" : pos === 2 ? "🥈 2nd" : "🥉 3rd"} Place
                </label>
                <Select value={winners[pos]} onChange={(e) => setWinners((w) => ({ ...w, [pos]: e.target.value }))}>
                  <option value="">Select participant/team</option>
                  {roster.map((r) => (
                    <option key={r.registrationId} value={r.registrationId}>
                      {r.teamName || r.name}
                    </option>
                  ))}
                </Select>
              </div>
            ))}
            <Button className="w-full" onClick={override}>Save Override</Button>
          </div>
        </Card>
      )}
    </div>
  );
}
