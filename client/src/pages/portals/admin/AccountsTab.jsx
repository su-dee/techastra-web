import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import Modal from "../../../components/ui/Modal";
import { Label, Input, Select, PasswordInput } from "../../../components/ui/Input";
import { api } from "../../../lib/api";

const ROLES = ["registration_team", "coordinator", "hospitality", "certificate_team", "master_admin"];

export default function AccountsTab() {
  const [users, setUsers] = useState([]);
  const [events, setEvents] = useState([]);
  const [modalOpen, setModalOpen] = useState(false);
  const [form, setForm] = useState({
    name: "", email: "", password: "", role: "coordinator",
    assignedEventId: "",
  });

  const load = () => {
    api.get("/api/admin/accounts").then((data) => setUsers(data.users || []));
  };

  useEffect(() => {
    load();
    api.get("/api/events").then((data) => setEvents(data.events || []));
  }, []);

  const update = (key, value) => setForm((f) => ({ ...f, [key]: value }));

  const createAccount = async (e) => {
    e.preventDefault();
    try {
      await api.post("/api/admin/accounts", form);
      toast.success("Account created");
      setModalOpen(false);
      setForm({ name: "", email: "", password: "", role: "coordinator", assignedEventId: "" });
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  const deleteAccount = async (id) => {
    try {
      await api.delete(`/api/admin/accounts/${id}`);
      toast.success("Account deleted");
      load();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <h2 className="font-heading text-xl font-semibold">Manage Staff Accounts</h2>
        <Button size="sm" onClick={() => setModalOpen(true)}>+ New Account</Button>
      </div>

      <div className="space-y-2">
        {users.map((u) => (
          <Card key={u.id} className="flex items-center justify-between">
            <div>
              <p className="font-semibold">{u.name} <span className="text-dim text-sm capitalize">({u.role.replace("_", " ")})</span></p>
              <p className="text-sm text-shade/60">{u.email}</p>
            </div>
            <Button size="sm" variant="danger" onClick={() => deleteAccount(u.id)}>Delete</Button>
          </Card>
        ))}
      </div>

      <Modal open={modalOpen} onClose={() => setModalOpen(false)} title="Create Staff Account">
        <form onSubmit={createAccount} className="space-y-4">
          <div>
            <Label htmlFor="name">Name</Label>
            <Input id="name" required value={form.name} onChange={(e) => update("name", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" required value={form.email} onChange={(e) => update("email", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="password">Password</Label>
            <PasswordInput id="password" required value={form.password} onChange={(e) => update("password", e.target.value)} />
          </div>
          <div>
            <Label htmlFor="role">Role</Label>
            <Select id="role" value={form.role} onChange={(e) => update("role", e.target.value)}>
              {ROLES.map((r) => (
                <option key={r} value={r}>{r.replace("_", " ")}</option>
              ))}
            </Select>
          </div>

          {form.role === "coordinator" && (
            <div>
              <Label htmlFor="assignedEventId">Assigned Event</Label>
              <Select id="assignedEventId" value={form.assignedEventId} onChange={(e) => update("assignedEventId", e.target.value)}>
                <option value="">Select event</option>
                {events.map((ev) => (
                  <option key={ev.id} value={ev.id}>{ev.name}</option>
                ))}
              </Select>
            </div>
          )}

          <Button type="submit" className="w-full">Create Account</Button>
        </form>
      </Modal>
    </div>
  );
}
