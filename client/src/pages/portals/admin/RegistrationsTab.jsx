import React, { useEffect, useMemo, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Badge from "../../../components/ui/Badge";
import { Input, Select } from "../../../components/ui/Input";
import { api } from "../../../lib/api";
import ParticipantDetailsModal from "../../../components/ParticipantDetailsModal";

const STATUSES = ["pending", "approved", "rejected"];

export default function RegistrationsTab() {
  const [registrations, setRegistrations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [exporting, setExporting] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [detailsId, setDetailsId] = useState(null); // registration whose full details are open
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
        <div className="space-y-2">
          {shown.map((r) => (
            <Card key={r.id} className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{r.user.name} <span className="text-dim text-sm">({r.registrationCode})</span></p>
                <p className="text-sm text-shade/60">{r.user.email} · {r.collegeName} · ₹{r.totalAmount}</p>
                {r.reviewedAt && (
                  <p className="text-xs text-dim mt-1">
                    {r.status === "rejected" ? "Rejected" : r.status === "approved" ? "Approved" : "Updated"} by {r.reviewedByName || "staff"} ·{" "}
                    {new Date(r.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <Badge status={r.status} />
                {r.paymentMethod === "later" && r.status !== "approved" && <Badge status="info">Payment due</Badge>}
                <Button size="sm" variant="outline" onClick={() => setDetailsId(r.id)}>Details</Button>
                <Select
                  value={r.status}
                  onChange={(e) => override(r.id, e.target.value)}
                  className="max-w-[140px]"
                >
                  {STATUSES.map((s) => (
                    <option key={s} value={s}>{s}</option>
                  ))}
                </Select>
                <Button size="sm" variant="outline" onClick={() => promoteWaitlist(r.id)}>Promote</Button>
                <Button size="sm" variant="danger" onClick={() => refund(r.id)}>Refund</Button>
              </div>
            </Card>
          ))}
        </div>
      )}

      <ParticipantDetailsModal registrationId={detailsId} onClose={() => setDetailsId(null)} />
    </div>
  );
}
