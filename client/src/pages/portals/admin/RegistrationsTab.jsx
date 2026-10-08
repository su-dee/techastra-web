import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Button from "../../../components/ui/Button";
import { Input, Select } from "../../../components/ui/Input";
import { api } from "../../../lib/api";
import ParticipantDetailsModal from "../../../components/ParticipantDetailsModal";
import ParticipantsTable from "../../../components/ParticipantsTable";

const STATUSES = ["pending", "approved", "rejected"];

export default function RegistrationsTab() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailsId, setDetailsId] = useState(null); // registration whose full details are open
  const [events, setEvents] = useState([]);
  useEffect(() => {
    api.get("/api/events").then((d) => setEvents(d.events || [])).catch(() => {});
  }, []);
  const eventsById = useMemo(() => new Map(events.map((e) => [e.id, e])), [events]);
  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return registrations.filter(
      (r) =>
        (statusFilter === "all" || r.status === statusFilter) &&
        (!q ||
          [r.user?.name, r.user?.email, r.user?.phone, r.registrationCode, r.collegeName, r.transactionId, r.teamName]
            .filter(Boolean)
            .some((v) => String(v).toLowerCase().includes(q)))
    );
  }, [registrations, search, statusFilter]);

  const load = () => {
    setLoading(true);
    api
      .get("/api/registrations")
      .then((data) => setRegistrations(data.registrations || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  const exportCSV = async () => {
    setExporting(true);
    try {
      const token = localStorage.getItem("techastra_token");
      const response = await fetch(`${api.baseUrl}/api/admin/export/registrations.csv`, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        },
      });

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `registrations-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);
      
      toast.success("CSV exported successfully");
    } catch (err) {
      toast.error(err.message || "Failed to export CSV");
    } finally {
      setExporting(false);
    }
  };

  const override = async (id, status) => {
    try {
      await api.patch(`/api/registrations/${id}/override`, { status });
      toast.success("Registration updated");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const promoteWaitlist = async (id) => {
    try {
      await api.patch(`/api/admin/registrations/${id}/waitlist-promote`);
      toast.success("Promoted to approved");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const refund = async (id) => {
    try {
      await api.post(`/api/admin/registrations/${id}/refund`);
      toast.success("Marked as refunded/cancelled");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-semibold">All Registrations (Full Override)</h2>
        <Button 
          variant="outline" 
          size="sm" 
          onClick={exportCSV}
          disabled={exporting}
        >
          {exporting ? "Exporting..." : "Export CSV"}
        </Button>
      </div>

      <div className="flex flex-col sm:flex-row gap-2 mb-4">
        <Input
          type="search"
          aria-label="Search registrations"
          placeholder="Search name, code, email, phone, UTR, college"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <Select aria-label="Filter by status" value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="sm:max-w-[180px]">
          <option value="all">All statuses ({registrations.length})</option>
          {STATUSES.map((st) => (
            <option key={st} value={st}>
              {st} ({registrations.filter((r) => r.status === st).length})
            </option>
          ))}
        </Select>
      </div>

      {loading ? (
        <p className="text-shade/50">Loading...</p>
      ) : shown.length === 0 ? (
        <p className="text-shade/50">No registrations match.</p>
      ) : (
        <ParticipantsTable
          rows={shown}
          eventsById={eventsById}
          onDetails={setDetailsId}
          renderActions={(r) => (
            <>
              <Select
                aria-label={`Override status for ${r.registrationCode}`}
                value={r.status}
                onChange={(e) => override(r.id, e.target.value)}
                className="!py-1 !text-[13px] w-full"
              >
                {STATUSES.map((st) => (
                  <option key={st} value={st}>{st}</option>
                ))}
              </Select>
              <div className="flex gap-1.5">
                <Button size="sm" variant="outline" className="flex-1 !px-2" onClick={() => promoteWaitlist(r.id)}>Promote</Button>
                <Button size="sm" variant="danger" className="flex-1 !px-2" onClick={() => refund(r.id)}>Refund</Button>
              </div>
            </>
          )}
        />
      )}

      <ParticipantDetailsModal registrationId={detailsId} onClose={() => setDetailsId(null)} canSetPassword />
    </div>
  );
}
