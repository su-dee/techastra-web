import React, { useEffect, useState } from "react";
import AnalyticsTab from "./admin/AnalyticsTab";
import RegistrationsTab from "./admin/RegistrationsTab";
import AccountsTab from "./admin/AccountsTab";
import EventsTab from "./admin/EventsTab";
import ResultsOverrideTab from "./admin/ResultsOverrideTab";
import AnnouncementsTab from "./admin/AnnouncementsTab";
import HelpDeskTab from "./admin/HelpDeskTab";
import { api } from "../../lib/api";

const TABS = [
  { key: "analytics", label: "Analytics" },
  { key: "registrations", label: "Registrations" },
  { key: "accounts", label: "Accounts" },
  { key: "events", label: "Events" },
  { key: "results", label: "Override Results" },
  { key: "announcements", label: "Announcements" },
  { key: "help", label: "Help Desk" },
];

export default function AdminPortal() {
  const [tab, setTab] = useState("analytics");
  // Open Help Desk queries, shown on the tab so new ones get noticed.
  const [openHelp, setOpenHelp] = useState(0);
  useEffect(() => {
    api
      .get("/api/help")
      .then((d) => setOpenHelp((d.queries || []).filter((q) => q.status !== "resolved").length))
      .catch(() => {});
  }, []);

  return (
    <div className={`${tab === "registrations" ? "max-w-[1500px]" : "max-w-7xl"} mx-auto px-6 py-10`}>
      <h1 className="font-heading text-3xl font-bold mb-6">Master Admin Portal</h1>

      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap ${
              tab === t.key ? "bg-[linear-gradient(100deg,#ddbb6a,#c9a24a)] text-[#2c2823] font-semibold" : "bg-shade/5 text-[color:var(--c-b4ab9b)] hover:text-heading"
            }`}
          >
            {t.label}
            {t.key === "help" && openHelp > 0 && (
              <span className={`ml-2 inline-flex min-w-[20px] h-5 px-1.5 items-center justify-center rounded-full border text-[11px] font-bold align-middle ${tab === t.key ? "border-transparent bg-[#2c2823] text-[#f0dcaa]" : "border-danger/40 bg-danger/15 text-danger"}`} aria-label={`${openHelp} open`}>
                {openHelp}
              </span>
            )}
          </button>
        ))}
      </div>

      {tab === "analytics" && <AnalyticsTab />}
      {tab === "registrations" && <RegistrationsTab />}
      {tab === "accounts" && <AccountsTab />}
      {tab === "events" && <EventsTab />}
      {tab === "results" && <ResultsOverrideTab />}
      {tab === "announcements" && <AnnouncementsTab />}
      {tab === "help" && <HelpDeskTab onOpenCount={setOpenHelp} />}
    </div>
  );
}
