import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { Label, Input, Textarea, Select } from "../../../components/ui/Input";
import { api } from "../../../lib/api";

const EMPTY_FORM = {
  name: "", description: "", track: "", level: "senior", category: "technical", startTime: "", endTime: "",
  fee: "", maxSeats: "", onSpotSeats: 0, isTeamEvent: false, minTeamSize: 1, maxTeamSize: 1,
  venue: "", rulebook: "", externalRegistration: false, registrationUrl: "", whatsappUrl: "",
};

function toLocalInput(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  const pad = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function EventsTab() {
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [form, setForm] = useState(EMPTY_FORM);

  const load = () => {
    api.get("/api/events").then((data) => setEvents(data.events || []));
  };

  useEffect(load, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setModalOpen(true);
  };

  const openEdit = (event) => {
    setEditingId(event.id);
    setForm({
      ...event,
      startTime: toLocalInput(event.startTime),
      endTime: toLocalInput(event.endTime),
    });
    setModalOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    try {
      if (editingId) {
        await api.put(`/api/events/${editingId}`, form);
        toast.success("Event updated");
      } else {
        await api.post("/api/events", form);
        toast.success("Event created");
      }
      setModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async (id) => {
    try {
      await api.delete(`/api/events/${id}`);
      toast.success("Event deleted");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-semibold">Manage Events</h2>
        <Button size="sm" onClick={openCreate}>+ New Event</Button>
      </div>

      <div className="space-y-2">
        {events.map((ev) => (
          <Card key={ev.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{ev.name}</p>
              <p className="text-sm text-shade/60">
                {ev.level === "junior" ? "Junior" : "Senior"} · {ev.category === "non_technical" ? "Non-Technical" : "Technical"} · ₹{ev.fee} · {ev.seatsTaken}/{ev.maxSeats} seats{ev.onSpotSeats > 0 ? ` (${ev.onSpotSeats} on-spot)` : ""} · {new Date(ev.startTime).toLocaleString()}
                {ev.externalRegistration && ` · Own website${ev.registrationUrl ? "" : " (link not set)"}`}
                {ev.whatsappUrl && " · WhatsApp group ✓"}
              </p>
            </div>
            <div className="flex gap-2">
              <Button size="sm" variant="outline" onClick={() => openEdit(ev)}>Edit</Button>
              <Button size="sm" variant="danger" onClick={() => remove(ev.id)}>Delete</Button>
            </div>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title={editingId ? "Edit Event" : "New Event"} fullScreen>
        <form onSubmit={save} className="space-y-4 max-w-lg mx-auto">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="description">Description</Label>
            <Textarea id="description" rows={2} value={form.description} onChange={(e) => update("description", e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="level">Level</Label>
              <Select id="level" value={form.level || "senior"} onChange={(e) => update("level", e.target.value)}>
                <option value="senior">Senior (college students)</option>
                <option value="junior">Junior (school students)</option>
              </Select>
            </div>
            <div>
              <Label htmlFor="category">Category</Label>
              <Select id="category" value={form.category || "technical"} onChange={(e) => update("category", e.target.value)}>
                <option value="technical">Technical</option>
                <option value="non_technical">Non-Technical</option>
              </Select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="track">Track</Label>
              <Input id="track" value={form.track || ""} onChange={(e) => update("track", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="venue">Venue</Label>
              <Input id="venue" value={form.venue || ""} onChange={(e) => update("venue", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label htmlFor="startTime">Start Time</Label>
              <Input id="startTime" type="datetime-local" required value={form.startTime} onChange={(e) => update("startTime", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="endTime">End Time</Label>
              <Input id="endTime" type="datetime-local" required value={form.endTime} onChange={(e) => update("endTime", e.target.value)} />
            </div>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
            <div>
              <Label htmlFor="fee">Fee (₹)</Label>
              <Input id="fee" type="number" required value={form.fee} onChange={(e) => update("fee", e.target.value)} />
            </div>
            <div>
              <Label htmlFor="maxSeats">Max Seats</Label>
              <Input id="maxSeats" type="number" required value={form.maxSeats} onChange={(e) => update("maxSeats", e.target.value)} />
            </div>
            <div className="col-span-2 sm:col-span-1">
              <Label htmlFor="onSpotSeats">On-spot seats</Label>
              <Input
                id="onSpotSeats"
                type="number"
                min="0"
                aria-describedby="onSpotSeats-hint"
                value={form.onSpotSeats ?? 0}
                onChange={(e) => update("onSpotSeats", e.target.value)}
              />
            </div>
          </div>
          <p id="onSpotSeats-hint" className="text-[13px] text-shade/60 -mt-2">
            On-spot seats are kept for walk-ups who register through the desk’s on-spot QR on the day. Online registration
            can fill only Max Seats minus these. 0 keeps no seats back.
          </p>
          <label className="flex items-center gap-2 text-sm text-shade/70">
            <input type="checkbox" checked={!!form.isTeamEvent} onChange={(e) => update("isTeamEvent", e.target.checked)} />
            Team Event
          </label>
          {form.isTeamEvent && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="minTeamSize">Min Team Size</Label>
                <Input id="minTeamSize" type="number" value={form.minTeamSize} onChange={(e) => update("minTeamSize", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="maxTeamSize">Max Team Size</Label>
                <Input id="maxTeamSize" type="number" value={form.maxTeamSize} onChange={(e) => update("maxTeamSize", e.target.value)} />
              </div>
            </div>
          )}
          <label className="flex items-center gap-2 text-sm text-shade/70">
            <input type="checkbox" checked={!!form.externalRegistration} onChange={(e) => update("externalRegistration", e.target.checked)} />
            Registers on its own website (not through this portal's cart)
          </label>
          {form.externalRegistration && (
            <div>
              <Label htmlFor="registrationUrl">Registration link</Label>
              <Input
                id="registrationUrl"
                type="url"
                placeholder="https://"
                value={form.registrationUrl || ""}
                onChange={(e) => update("registrationUrl", e.target.value)}
              />
              <p className="text-xs text-shade/60 mt-1">Leave empty to show “Registration link coming soon”.</p>
            </div>
          )}
          <div>
            <Label htmlFor="whatsappUrl">WhatsApp group link</Label>
            <Input
              id="whatsappUrl"
              type="url"
              placeholder="https://chat.whatsapp.com/..."
              value={form.whatsappUrl || ""}
              onChange={(e) => update("whatsappUrl", e.target.value)}
            />
            <p className="text-xs text-shade/60 mt-1">
              Sent only to this event’s approved participants (approval email and their dashboard). Leave empty if there’s no group.
            </p>
          </div>
          <div>
            <Label htmlFor="rulebook">Rulebook</Label>
            <Textarea id="rulebook" rows={4} value={form.rulebook || ""} onChange={(e) => update("rulebook", e.target.value)} />
          </div>
          <Button type="submit" className="w-full">{editingId ? "Save Changes" : "Create Event"}</Button>
        </form>
      </Modal>
    </div>
  );
}
