import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { Select } from "../../components/ui/Input";
import { api } from "../../lib/api";

export default function CertificatePortal() {
  const [rows, setRows] = useState([]);
  const [events, setEvents] = useState([]);
  const [eventFilter, setEventFilter] = useState("");
  const [winnersOnly, setWinnersOnly] = useState(false);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(null);

  useEffect(() => {
    api.get("/api/events").then((data) => setEvents(data.events || []));
  }, []);

  const load = () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (eventFilter) params.set("eventId", eventFilter);
    if (winnersOnly) params.set("winnersOnly", "true");
    api
      .get(`/api/certificates/participants?${params.toString()}`)
      .then((data) => setRows(data.rows || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [eventFilter, winnersOnly]);

  const generate = async (row, type) => {
    setGenerating(`${row.registrationId}-${row.eventId}-${type}`);
    try {
      await api.post("/api/certificates/generate", {
        registrationId: row.registrationId,
        eventId: row.eventId,
        type,
      });
      toast.success("Certificate generated");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setGenerating(null);
    }
  };

  const eventName = (id) => events.find((e) => e.id === id)?.name || id;

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-heading text-3xl font-bold mb-6">Certificate Portal</h1>

      <div className="flex flex-wrap gap-4 mb-6">
        <Select aria-label="Filter by event" value={eventFilter} onChange={(e) => setEventFilter(e.target.value)} className="max-w-xs">
          <option value="">All Events</option>
          {events.map((e) => (
            <option key={e.id} value={e.id}>{e.name}</option>
          ))}
        </Select>
        <label className="flex items-center gap-2 text-sm text-white/70">
          <input type="checkbox" checked={winnersOnly} onChange={(e) => setWinnersOnly(e.target.checked)} />
          Winners only
        </label>
        <a
          href={`${api.baseUrl}/api/admin/export/registrations.csv`}
          target="_blank"
          rel="noreferrer"
          className="ml-auto btn-ghost-sm"
        >
          Bulk export CSV
        </a>
      </div>

      {loading ? (
        <p className="text-white/50">Loading...</p>
      ) : (
        <div className="space-y-2">
          {rows.map((row) => (
            <Card key={`${row.registrationId}-${row.eventId}`} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{row.participantName} <span className="text-dim text-sm">({row.registrationCode})</span></p>
                <p className="text-sm text-white/60">{eventName(row.eventId)} · {row.college}</p>
                {row.isWinner && <Badge status="approved" className="mt-1">Winner — #{row.position}</Badge>}
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant={row.participationCertGenerated ? "outline" : "primary"}
                  disabled={row.participationCertGenerated || generating === `${row.registrationId}-${row.eventId}-participation`}
                  onClick={() => generate(row, "participation")}
                >
                  {row.participationCertGenerated ? "Participation ✓" : "Generate Participation"}
                </Button>
                {row.isWinner && (
                  <Button
                    size="sm"
                    variant={row.winnerCertGenerated ? "outline" : "secondary"}
                    disabled={row.winnerCertGenerated || generating === `${row.registrationId}-${row.eventId}-winner`}
                    onClick={() => generate(row, "winner")}
                  >
                    {row.winnerCertGenerated ? "Winner ✓" : "Generate Winner"}
                  </Button>
                )}
              </div>
            </Card>
          ))}
          {rows.length === 0 && <p className="text-white/50">No participants match this filter.</p>}
        </div>
      )}
    </div>
  );
}
