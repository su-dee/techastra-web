import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Input, Textarea, Select, Label } from "../../components/ui/Input";
import { api } from "../../lib/api";
import ParticipantIDCard from "../../components/ParticipantIDCard";
import { idCardVerifyUrl } from "../../lib/idCard";

// Payment screenshots are private: fetched with the staff token and shown
// from a blob URL. The tab is opened synchronously (inside the click) so
// pop-up blockers allow it, then pointed at the image once it arrives.
async function openProof(registrationId) {
  const win = window.open("", "_blank");
  try {
    const blob = await api.blob(`/api/registrations/${registrationId}/proof`);
    // Only ever opened as an image (a blob opens under this portal's origin).
    if (!/^image\/(png|jpeg|webp)$/.test(blob.type)) throw new Error("This payment screenshot isn't an image file");
    const url = URL.createObjectURL(blob);
    if (win) win.location.href = url;
    else window.location.href = url;
    setTimeout(() => URL.revokeObjectURL(url), 60_000);
  } catch (err) {
    win?.close();
    toast.error(err.message || "Couldn't load the payment screenshot");
  }
}

export default function RegistrationTeamPortal() {
  const [registrations, setRegistrations] = useState([]);
  const [filter, setFilter] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [rejectTarget, setRejectTarget] = useState(null);
  const [reason, setReason] = useState("");

  const [lookupQuery, setLookupQuery] = useState("");
  const [lookupResults, setLookupResults] = useState([]);

  // Excel export states
  const [events, setEvents] = useState([]);
  const [selectedEvent, setSelectedEvent] = useState("");
  const [exporting, setExporting] = useState(false);

  // Cash registration states
  const [showCashForm, setShowCashForm] = useState(false);
  const [cashRegistration, setCashRegistration] = useState({
    name: "",
    email: "",
    phone: "",
    collegeName: "",
    registerNo: "",
    consent: false, // the participant agrees to the Terms and Privacy Notice
    eventIds: [],
    isTeam: false,
    teamName: "",
    teamMembers: [],
    amountCollected: 0,
  });
  const [createdRegistration, setCreatedRegistration] = useState(null);
  const [creatingCash, setCreatingCash] = useState(false);

  // Load events for export dropdown
  useEffect(() => {
    api
      .get("/api/events")
      .then((data) => setEvents(data.events || []))
      .catch((err) => console.error("Failed to load events:", err));
  }, []);

  const load = () => {
    setLoading(true);
    const query = filter ? `?status=${filter}` : "";
    api
      .get(`/api/registrations${query}`)
      .then((data) => setRegistrations(data.registrations || []))
      .catch((err) => toast.error(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(load, [filter]);

  const approve = async (id) => {
    try {
      const data = await api.patch(`/api/registrations/${id}/approve`);
      toast.success(data.alreadyApproved ? "Already approved" : "Registration approved");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const reject = async () => {
    try {
      await api.patch(`/api/registrations/${rejectTarget}/reject`, { reason });
      toast.success("Registration rejected");
      setRejectTarget(null);
      setReason("");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const runLookup = async (e) => {
    e.preventDefault();
    if (!lookupQuery.trim()) return;
    try {
      const data = await api.get(`/api/registrations/lookup?q=${encodeURIComponent(lookupQuery)}`);
      setLookupResults(data.registrations || []);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const exportEventParticipants = async () => {
    if (!selectedEvent) {
      toast.error("Please select an event");
      return;
    }

    setExporting(true);
    try {
      const token = localStorage.getItem("techastra_token");
      const response = await fetch(
        `${api.baseUrl}/api/registration-team/export/${selectedEvent}`,
        {
          method: "GET",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        }
      );

      if (!response.ok) {
        throw new Error("Export failed");
      }

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      
      // Get event name for filename
      const event = events.find((e) => e.id === selectedEvent);
      const eventName = event ? event.name.replace(/[^a-z0-9]/gi, "-") : "event";
      a.download = `${eventName}-participants-${new Date().toISOString().slice(0, 10)}.xlsx`;
      
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      window.URL.revokeObjectURL(url);

      toast.success("Excel file exported successfully");
    } catch (err) {
      toast.error(err.message || "Failed to export Excel file");
    } finally {
      setExporting(false);
    }
  };

  const submitCashRegistration = async (e) => {
    e.preventDefault();
    
    // Validation
    if (!cashRegistration.name || !cashRegistration.email || !cashRegistration.phone) {
      toast.error("Please fill in all required fields");
      return;
    }
    
    if (cashRegistration.eventIds.length === 0) {
      toast.error("Please select at least one event");
      return;
    }
    
    if (cashRegistration.amountCollected <= 0) {
      toast.error("Please enter the amount collected");
      return;
    }

    if (cashRegistration.isTeam && (!cashRegistration.teamName || cashRegistration.teamMembers.length === 0)) {
      toast.error("Please add team name and at least one team member");
      return;
    }

    if (!cashRegistration.consent) {
      toast.error("Confirm the participant agrees to the Terms and Privacy Notice");
      return;
    }

    setCreatingCash(true);

    try {
      const formData = new FormData();
      formData.append("name", cashRegistration.name);
      formData.append("email", cashRegistration.email);
      formData.append("phone", cashRegistration.phone);
      formData.append("collegeName", cashRegistration.collegeName || "");
      formData.append("registerNo", cashRegistration.registerNo || "");
      formData.append("eventIds", JSON.stringify(cashRegistration.eventIds));
      formData.append("amountCollected", String(cashRegistration.amountCollected));
      formData.append("consent", "true");

      if (cashRegistration.isTeam) {
        formData.append("teamName", cashRegistration.teamName);
        // The server adds the participant as team lead.
        formData.append("teamMembers", JSON.stringify(cashRegistration.teamMembers));
      }

      // Created, approved and emailed in one step; the server computes the
      // amount and generates the participant's password.
      const data = await api.post("/api/registrations/cash", formData, { isFormData: true });
      const approvedReg = await api.get(`/api/registrations/${data.registration.id}`);

      setCreatedRegistration({ ...approvedReg.registration, temporaryPassword: data.temporaryPassword });
      toast.success(`Cash registration created! Code: ${data.registration.registrationCode}`);
      
      // Reset form
      setCashRegistration({
        name: "",
        email: "",
        phone: "",
        collegeName: "",
        registerNo: "",
        consent: false,
        eventIds: [],
        isTeam: false,
        teamName: "",
        teamMembers: [],
        amountCollected: 0,
      });
      
      // Refresh registration list
      load();
    } catch (err) {
      toast.error(err.message || "Failed to create cash registration");
    } finally {
      setCreatingCash(false);
    }
  };

  const addTeamMember = () => {
    setCashRegistration({
      ...cashRegistration,
      teamMembers: [...cashRegistration.teamMembers, { name: "", regNo: "", role: "member" }],
    });
  };

  const removeTeamMember = (index) => {
    setCashRegistration({
      ...cashRegistration,
      teamMembers: cashRegistration.teamMembers.filter((_, i) => i !== index),
    });
  };

  const updateTeamMember = (index, field, value) => {
    const updated = [...cashRegistration.teamMembers];
    updated[index][field] = value;
    setCashRegistration({ ...cashRegistration, teamMembers: updated });
  };

  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-heading text-3xl font-bold mb-6">Registration Team Portal</h1>

      {/* Cash Registration Section */}
      <Card className="mb-8">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="font-heading font-semibold text-xl mb-1">Walk-up Cash Registration</h2>
            <p className="text-sm text-shade/60">Register participants who pay cash in person</p>
          </div>
          <Button onClick={() => setShowCashForm(!showCashForm)}>
            {showCashForm ? "Cancel" : "New Cash Registration"}
          </Button>
        </div>

        {showCashForm && (
          <form onSubmit={submitCashRegistration} className="mt-6 space-y-6">
            {/* Personal Information */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b border-shade/10 pb-2">Personal Information</h3>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <Label htmlFor="cash-name">Full Name *</Label>
                  <Input
                    id="cash-name"
                    required
                    value={cashRegistration.name}
                    onChange={(e) => setCashRegistration({ ...cashRegistration, name: e.target.value })}
                    placeholder="Participant name"
                  />
                </div>

                <div>
                  <Label htmlFor="cash-email">Email *</Label>
                  <Input
                    id="cash-email"
                    type="email"
                    required
                    value={cashRegistration.email}
                    onChange={(e) => setCashRegistration({ ...cashRegistration, email: e.target.value })}
                    placeholder="participant@example.com"
                  />
                </div>

                <div>
                  <Label htmlFor="cash-phone">Phone Number *</Label>
                  <Input
                    id="cash-phone"
                    type="tel"
                    required
                    value={cashRegistration.phone}
                    onChange={(e) => setCashRegistration({ ...cashRegistration, phone: e.target.value })}
                    placeholder="1234567890"
                  />
                </div>

                <div>
                  <Label htmlFor="cash-college">College/Institution</Label>
                  <Input
                    id="cash-college"
                    value={cashRegistration.collegeName}
                    onChange={(e) => setCashRegistration({ ...cashRegistration, collegeName: e.target.value })}
                    placeholder="College name (optional)"
                  />
                </div>

                <div>
                  <Label htmlFor="cash-regno">Register Number</Label>
                  <Input
                    id="cash-regno"
                    value={cashRegistration.registerNo}
                    onChange={(e) => setCashRegistration({ ...cashRegistration, registerNo: e.target.value })}
                    placeholder="Student register number (optional)"
                  />
                </div>

                <div>
                  <Label htmlFor="cash-amount">Amount Collected (₹) *</Label>
                  <Input
                    id="cash-amount"
                    type="number"
                    required
                    min="0"
                    value={cashRegistration.amountCollected}
                    onChange={(e) => setCashRegistration({ ...cashRegistration, amountCollected: parseFloat(e.target.value) || 0 })}
                    placeholder="Amount paid in cash"
                  />
                </div>
              </div>
            </div>

            {/* Event Selection */}
            <div className="space-y-4">
              <h3 className="font-semibold text-lg border-b border-shade/10 pb-2">Event Selection *</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {events.map((event) => (
                  <label
                    key={event.id}
                    className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-all ${
                      cashRegistration.eventIds.includes(event.id)
                        ? "border-amber/55 bg-amber/10"
                        : "border-shade/10 bg-shade/5 hover:border-shade/20"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={cashRegistration.eventIds.includes(event.id)}
                      onChange={(e) => {
                        if (e.target.checked) {
                          setCashRegistration({
                            ...cashRegistration,
                            eventIds: [...cashRegistration.eventIds, event.id],
                          });
                        } else {
                          setCashRegistration({
                            ...cashRegistration,
                            eventIds: cashRegistration.eventIds.filter((id) => id !== event.id),
                          });
                        }
                      }}
                      className="w-4 h-4"
                    />
                    <span className="text-sm">{event.name}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Team Registration Toggle */}
            <div className="space-y-4">
              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={cashRegistration.isTeam}
                  onChange={(e) =>
                    setCashRegistration({ ...cashRegistration, isTeam: e.target.checked })
                  }
                  className="w-5 h-5"
                />
                <span className="font-semibold">This is a team registration</span>
              </label>

              {cashRegistration.isTeam && (
                <div className="space-y-4 pl-8">
                  <div>
                    <Label htmlFor="team-name">Team Name *</Label>
                    <Input
                      id="team-name"
                      required={cashRegistration.isTeam}
                      value={cashRegistration.teamName}
                      onChange={(e) =>
                        setCashRegistration({ ...cashRegistration, teamName: e.target.value })
                      }
                      placeholder="Enter team name"
                    />
                  </div>

                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Label>Team Members (excluding lead)</Label>
                      <Button type="button" size="sm" onClick={addTeamMember}>
                        + Add Member
                      </Button>
                    </div>

                    {cashRegistration.teamMembers.map((member, index) => (
                      <div
                        key={index}
                        className="grid grid-cols-1 md:grid-cols-2 gap-3 p-3 bg-shade/5 rounded-lg"
                      >
                        <Input
                          placeholder="Member name"
                          value={member.name}
                          onChange={(e) => updateTeamMember(index, "name", e.target.value)}
                          required={cashRegistration.isTeam}
                        />
                        <div className="flex gap-2">
                          <Input
                            placeholder="Register number"
                            value={member.regNo}
                            onChange={(e) => updateTeamMember(index, "regNo", e.target.value)}
                          />
                          <Button
                            type="button"
                            size="sm"
                            variant="danger"
                            onClick={() => removeTeamMember(index)}
                          >
                            Remove
                          </Button>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <label className="flex items-start gap-3 cursor-pointer text-sm">
              <input
                type="checkbox"
                checked={!!cashRegistration.consent}
                onChange={(e) => setCashRegistration({ ...cashRegistration, consent: e.target.checked })}
                className="w-4 h-4 mt-0.5"
              />
              <span>The participant agrees to the Terms of Participation and the Privacy Notice.</span>
            </label>

            {/* Submit Button */}
            <div className="flex gap-3 pt-4 border-t border-shade/10">
              <Button type="submit" disabled={creatingCash} className="flex-1">
                {creatingCash ? "Creating Registration..." : "Create & Approve Registration"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                onClick={() => {
                  setShowCashForm(false);
                  setCashRegistration({
                    name: "",
                    email: "",
                    phone: "",
                    collegeName: "",
                    registerNo: "",
                    consent: false,
                    eventIds: [],
                    isTeam: false,
                    teamName: "",
                    teamMembers: [],
                    amountCollected: 0,
                  });
                }}
              >
                Cancel
              </Button>
            </div>
          </form>
        )}

        {/* Display created registration with ID card */}
        {createdRegistration && (
          <div className="mt-6 p-6 bg-shade/5 rounded-lg">
            <h3 className="font-semibold text-lg mb-4 text-center">✓ Registration Created Successfully!</h3>
            {createdRegistration.temporaryPassword && (
              <p className="text-center text-sm mb-4">
                Tell the participant their sign-in password (shown only once):{" "}
                <code className="font-mono text-base text-heading bg-shade/10 rounded px-2 py-1">{createdRegistration.temporaryPassword}</code>
              </p>
            )}
            <div className="max-w-md mx-auto">
              <ParticipantIDCard
                name={createdRegistration.user?.name}
                registrationNumber={createdRegistration.user?.registerNo}
                delegateId={createdRegistration.registrationCode}
                institution={createdRegistration.collegeName || createdRegistration.user?.collegeName}
                qrValue={idCardVerifyUrl(createdRegistration.registrationCode, createdRegistration.idCardToken)}
              />
            </div>
            <div className="mt-4 text-center">
              <p className="text-sm text-shade/60 mb-2">Participant can take a photo of this QR code</p>
              <Button
                onClick={() => setCreatedRegistration(null)}
                variant="secondary"
                size="sm"
              >
                Close
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Card className="mb-8">
        <h2 className="font-heading font-semibold mb-3">Lost-ID Lookup</h2>
        <form onSubmit={runLookup} className="flex gap-3">
          <Input
            placeholder="Search by name, register no., email, or reg code"
            value={lookupQuery}
            onChange={(e) => setLookupQuery(e.target.value)}
          />
          <Button type="submit">Search</Button>
        </form>
        {lookupResults.length > 0 && (
          <div className="mt-4 space-y-2">
            {lookupResults.map((r) => (
              <div key={r.id} className="flex items-center justify-between bg-shade/5 rounded-lg px-4 py-2 text-sm">
                <span>{r.user.name} · {r.registrationCode} · {r.user.email}</span>
                <Badge status={r.status} />
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card className="mb-8">
        <h2 className="font-heading font-semibold mb-3">Export Event Participants</h2>
        <p className="text-sm text-shade/60 mb-4">
          Download Excel file with all participants for a specific event (name, email, phone, college, team details, status, transaction info)
        </p>
        <div className="flex gap-3">
          <Select
            aria-label="Event to export"
            value={selectedEvent}
            onChange={(e) => setSelectedEvent(e.target.value)}
            className="flex-1"
          >
            <option value="">Select Event</option>
            {events.map((event) => (
              <option key={event.id} value={event.id}>
                {event.name}
              </option>
            ))}
          </Select>
          <Button
            onClick={exportEventParticipants}
            disabled={!selectedEvent || exporting}
          >
            {exporting ? "Exporting..." : "Export Excel"}
          </Button>
        </div>
      </Card>

      <div className="flex gap-3 mb-6">
        {["pending", "approved", "rejected"].map((s) => (
          <button
            key={s}
            onClick={() => setFilter(s)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize ${filter === s ? "bg-[linear-gradient(100deg,#ddbb6a,#c9a24a)] text-[#2c2823] font-semibold" : "bg-shade/5 text-[color:var(--c-b4ab9b)] hover:text-heading"}`}
          >
            {s}
          </button>
        ))}
      </div>

      {loading ? (
        <p className="text-shade/50">Loading...</p>
      ) : registrations.length === 0 ? (
        <p className="text-shade/50">No {filter} registrations.</p>
      ) : (
        <div className="space-y-3">
          {registrations.map((r) => (
            <Card key={r.id} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <p className="font-semibold">{r.user.name} <span className="text-dim text-sm">({r.registrationCode})</span></p>
                <p className="text-sm text-shade/60">{r.user.email} · {r.collegeName}</p>
                <p className="text-sm text-shade/60">
                  {r.paymentMethod === "cash" ? "Paid in cash" : r.paymentMethod === "free" ? "Free" : `Txn ID: ${r.transactionId}`} · ₹{r.totalAmount}
                </p>
                {r.possibleDuplicates?.length > 0 && (
                  <p className="text-sm text-amber-light mt-1" role="note">
                    ⚠ Possible duplicate: same register or mobile number as {r.possibleDuplicates.join(", ")}
                  </p>
                )}
                {r.paymentProofUrl && (
                  <button type="button" onClick={() => openProof(r.id)} className="text-cyan text-sm underline">
                    View payment screenshot
                  </button>
                )}
                {r.rejectionReason && <p className="text-sm text-danger mt-1">Reason: {r.rejectionReason}</p>}
                {r.reviewedAt && (
                  <p className="text-xs text-dim mt-1">
                    {r.status === "rejected" ? "Rejected" : r.status === "approved" ? "Approved" : "Updated"} by {r.reviewedByName || "staff"} ·{" "}
                    {new Date(r.reviewedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}
                  </p>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Badge status={r.status} />
                {r.status === "pending" && (
                  <>
                    <Button size="sm" onClick={() => approve(r.id)}>Approve</Button>
                    <Button size="sm" variant="danger" onClick={() => setRejectTarget(r.id)}>Reject</Button>
                  </>
                )}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={!!rejectTarget} onClose={() => setRejectTarget(null)} title="Reject Registration">
        <p className="text-sm text-shade/60 mb-3">
          The participant sees this reason on the status page and can resubmit a corrected payment there. The
          registration’s seats are released.
        </p>
        <Textarea
          rows={3}
          aria-label="Reason for rejection"
          placeholder="Reason for rejection"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
        <Button className="w-full mt-4" variant="danger" onClick={reject}>Confirm Reject</Button>
      </Modal>
    </div>
  );
}
