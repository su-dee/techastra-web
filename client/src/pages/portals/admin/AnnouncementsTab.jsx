import React, { useEffect, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../../components/ui/Card";
import Button from "../../../components/ui/Button";
import { Textarea } from "../../../components/ui/Input";
import { api } from "../../../lib/api";

export default function AnnouncementsTab() {
  const [message, setMessage] = useState("");
  const [announcements, setAnnouncements] = useState([]);
  const [sending, setSending] = useState(false);

  const load = () => {
    api.get("/api/announcements").then((data) => setAnnouncements(data.announcements || []));
  };

  useEffect(load, []);

  const send = async (e) => {
    e.preventDefault();
    if (!message.trim()) return;
    setSending(true);
    try {
      await api.post("/api/announcements", { message: message.trim() });
      toast.success("Announcement broadcast");
      setMessage("");
      load();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <div>
      <h2 className="font-heading text-xl font-semibold mb-6">Announcements</h2>

      <Card className="mb-6">
        <form onSubmit={send} className="space-y-3">
          <Textarea
            rows={3}
            placeholder="Type a new announcement to push live to all visitors..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
          />
          <Button type="submit" disabled={sending}>{sending ? "Sending..." : "Broadcast"}</Button>
        </form>
      </Card>

      <div className="space-y-2">
        {announcements.map((a) => (
          <Card key={a.id} className="text-sm">
            <p>{a.message}</p>
            <p className="text-dim text-xs mt-1">{new Date(a.createdAt).toLocaleString()}</p>
          </Card>
        ))}
      </div>
    </div>
  );
}
