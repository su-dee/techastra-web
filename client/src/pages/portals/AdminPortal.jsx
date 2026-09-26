import React, { useState } from "react";
import AnalyticsTab from "./admin/AnalyticsTab";
import RegistrationsTab from "./admin/RegistrationsTab";
import AccountsTab from "./admin/AccountsTab";
import EventsTab from "./admin/EventsTab";
import ResultsOverrideTab from "./admin/ResultsOverrideTab";
import AnnouncementsTab from "./admin/AnnouncementsTab";

const TABS = [
  { key: "analytics", label: "Analytics" },
  { key: "registrations", label: "Registrations" },
  { key: "accounts", label: "Accounts" },
  { key: "events", label: "Events" },
  { key: "results", label: "Override Results" },
  { key: "announcements", label: "Announcements" },
];

export default function AdminPortal() {
  const [tab, setTab] = useState("analytics");

  return (
    <div className="max-w-7xl mx-auto px-6 py-10">
      <h1 className="font-heading text-3xl font-bold mb-6">Master Admin Portal</h1>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === t.key ? "bg-[linear-gradient(100deg,#ddbb6a,#c9a24a)] text-[#2c2823] font-semibold" : "bg-white/5 text-[#b4ab9b] hover:text-white"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "registrations" && <RegistrationsTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "events" && <EventsTab />}
      {tab === "results" && <ResultsOverrideTab />}
      {tab === "announcements" && <AnnouncementsTab />}
    </div>
  );
}
