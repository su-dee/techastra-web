import React, { useEffect, useState } from "react";
import {
  BarChart, Bar, LineChart, Line, PieChart, Pie, Cell,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend,
} from "recharts";
import Card from "../../../components/ui/Card";
import InteractiveAnalyticsChart from "../../../components/InteractiveAnalyticsChart";
import { api } from "../../../lib/api";

const COLORS = ["#ddbb6a", "#a7afb5", "#22C55E", "#F59E0B", "#EF4444", "#5e666c"];

function StatCard({ label, value }) {
  return (
    <Card className="text-center">
      <p className="text-xs text-white/50 uppercase mb-1">{label}</p>
      <p className="font-heading text-3xl font-bold text-cyan">{value}</p>
    </Card>
  );
}

export default function AnalyticsTab() {
  const [data, setData] = useState(null);

  useEffect(() => {
    api.get("/api/admin/analytics").then(setData).catch(() => {});
  }, []);

  if (!data) return <p className="text-white/50">Loading analytics...</p>;

  return (
    <div className="space-y-8">
      {/* Interactive Chart with Real Data */}
      <InteractiveAnalyticsChart />

      {/* Legacy Charts */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <Card>
          <h2 className="font-heading font-semibold mb-4">Per-Event Headcount</h2>
          <p className="sr-only">
            {data.perEventHeadcount.map((d) => `${d.eventName}: ${d.seatsTaken}`).join("; ")}
          </p>
          <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={280}>
            <BarChart data={data.perEventHeadcount} layout="vertical" margin={{ left: 20 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" />
              <XAxis type="number" stroke="rgba(255,255,255,0.5)" fontSize={12} />
              <YAxis dataKey="eventName" type="category" width={140} stroke="rgba(255,255,255,0.5)" fontSize={11} />
              <Tooltip contentStyle={{ background: "var(--color-bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Bar dataKey="seatsTaken" fill="#ddbb6a" radius={[0, 6, 6, 0]} />
            </BarChart>
          </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <h2 className="font-heading font-semibold mb-4">College-wise Breakdown</h2>
          <p className="sr-only">
            {data.perCollegeStats.map((d) => `${d.college}: ${d.count}`).join("; ")}
          </p>
          <div aria-hidden="true">
          <ResponsiveContainer width="100%" height={280}>
            <PieChart>
              <Pie
                data={data.perCollegeStats}
                dataKey="count"
                nameKey="college"
                cx="50%"
                cy="50%"
                outerRadius={90}
                rootTabIndex={-1}
                label={({ college }) => college}
              >
                {data.perCollegeStats.map((entry, i) => (
                  <Cell key={entry.college} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip contentStyle={{ background: "var(--color-bg-elevated)", border: "1px solid rgba(255,255,255,0.1)" }} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
          </div>
        </Card>
      </div>
    </div>
  );
}
