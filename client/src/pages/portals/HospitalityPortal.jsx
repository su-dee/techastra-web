import React, { useState, useEffect } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Modal from "../../components/ui/Modal";
import QRScanner from "../../components/QRScanner";
import { Select } from "../../components/ui/Input";
import { api } from "../../lib/api";

const SESSIONS = ["breakfast", "lunch", "snacks"];

export default function HospitalityPortal() {
  const [mealSession, setMealSession] = useState("breakfast");
  const [scannerOpen, setScannerOpen] = useState(false);
  const [logs, setLogs] = useState([]);

  const loadLogs = () => {
    api.get(`/api/food/session/${mealSession}`).then((data) => setLogs(data.logs || []));
  };

  useEffect(loadLogs, [mealSession]);

  const handleScan = async (decodedText) => {
    try {
      const data = await api.post("/api/food/scan", { registrationCode: decodedText, mealSession });
      toast.success(`Food collected: ${data.participant.name}`);
      loadLogs();
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <div className="max-w-3xl mx-auto px-6 py-10">
      <h1 className="font-heading text-3xl font-bold mb-6">Hospitality Portal</h1>

      <Card className="mb-6">
        <label className="block text-sm text-shade/70 mb-2">Meal Session</label>
        <Select aria-label="Meal session" value={mealSession} onChange={(e) => setMealSession(e.target.value)} className="max-w-xs mb-4">
          {SESSIONS.map((s) => (
            <option key={s} value={s} className="capitalize">{s}</option>
          ))}
        </Select>
        <Button onClick={() => setScannerOpen(true)}>Open Scanner</Button>
      </Card>

      <Card>
        <h2 className="font-semibold mb-3 capitalize">{mealSession} — Collected ({logs.length})</h2>
        {logs.length === 0 ? (
          <p className="text-shade/50 text-sm">No collections logged yet for this session.</p>
        ) : (
          <div className="space-y-2">
            {logs.map((l) => (
              <div key={l.id} className="flex items-center justify-between bg-shade/5 rounded-lg px-4 py-2 text-sm">
                <span>Registration: {l.registrationId}</span>
                <span className="text-shade/50">{new Date(l.collectedAt).toLocaleTimeString()}</span>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Modal open={scannerOpen} onClose={() => setScannerOpen(false)} title={`Scan for ${mealSession}`} fullScreen>
        <QRScanner active={scannerOpen} onScan={handleScan} />
      </Modal>
    </div>
  );
}
