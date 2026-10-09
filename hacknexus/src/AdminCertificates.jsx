import React, { useEffect, useState } from "react";
import { Download, Mail } from "lucide-react";
import { api } from "./api.js";
import { BASE } from "./base.js";
import { formatDate, useAdminData } from "./adminShared.jsx";

// Participation certificates for every member of a checked-in squad: set
// each member's Mr/Ms, download them all as one PDF, or email each squad's
// lead its members' certificates.
export default function AdminCertificates({ onExpired }) {
  const { data, error, loading, reload } = useAdminData("/admin/certificates", onExpired);
  const [message, setMessage] = useState(null); // { tone, text }
  const [saving, setSaving] = useState("");
  const job = data?.job;
  const running = job?.state === "running";

  // While an email run is going, refresh its progress.
  useEffect(() => {
    if (!running) return;
    const timer = setInterval(reload, 2000);
    return () => clearInterval(timer);
  }, [running, reload]);

  const setTitle = async (squad, member, title) => {
    setSaving(`${squad.id}-${member.position}`);
    try {
      await api("/admin/certificates/title", {
        method: "PUT",
        body: { registrationId: squad.id, position: member.position, title },
      });
      reload();
    } catch (e) {
      if (e.status === 401) return onExpired();
      setMessage({ tone: "bad", text: e.message });
    } finally {
      setSaving("");
    }
  };

  const email = async (resend) => {
    const pending = resend ? totals.squads : totals.squads - totals.emailed;
    if (!window.confirm(`Email certificates to ${pending} squad lead${pending === 1 ? "" : "s"}?`)) return;
    setMessage(null);
    try {
      await api("/admin/certificates/email", { method: "POST", body: { resend } });
      reload();
    } catch (e) {
      if (e.status === 401) return onExpired();
      setMessage({ tone: "bad", text: e.message });
    }
  };

  if (error) return <p className="cert-job bad" role="alert">{error}</p>;
  if (!data) return <p className="admin-empty">{loading ? "Loading…" : ""}</p>;
  const { squads, totals } = data;
  const allEmailed = totals.squads > 0 && totals.emailed === totals.squads;

  return (
    <div>
      <div className="stat-grid">
        {[
          ["Checked-in squads", totals.squads],
          ["Certificates", totals.people, "one per member"],
          ["Mr / Ms missing", totals.missingTitles],
          ["Emailed to leads", `${totals.emailed} / ${totals.squads}`],
        ].map(([label, value, note]) => (
          <div className="stat-tile" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {note && <small>{note}</small>}
          </div>
        ))}
      </div>

      <section className="admin-card">
        <h3>Participation certificates</h3>
        <p className="cert-note">
          Every member of a checked-in squad gets one, on the Techastra ’26 participation template: “Mr./Ms. Name”, their
          college, and Hack Nexus. Emailing sends each squad lead one PDF per member; squads already emailed are skipped.
        </p>
        <div className="admin-toolbar">
          <a
            className="button primary"
            href={`${BASE}/api/admin/certificates.pdf`}
            download
            aria-disabled={!totals.people || undefined}
          >
            <Download size={16} /> Download all ({totals.people})
          </a>
          <button
            className="button ghost"
            onClick={() => email(false)}
            disabled={!data.canEmail || running || totals.missingTitles > 0 || allEmailed}
          >
            <Mail size={16} /> Email squad leads
          </button>
          {allEmailed && (
            <button className="button ghost" onClick={() => email(true)} disabled={!data.canEmail || running}>
              Send again to all
            </button>
          )}
        </div>
        {!data.canEmail && <p className="cert-note">Email isn’t set up on this server (SMTP settings).</p>}
        {totals.missingTitles > 0 && (
          <p className="cert-note">Set Mr or Ms for every member below before emailing ({totals.missingTitles} missing).</p>
        )}
        {job && (
          <p className={`cert-job ${job.failed.length ? "bad" : "ok"}`} role="status">
            {running
              ? `Emailing… ${job.done} of ${job.total} squads`
              : `Emailed ${job.sent} of ${job.total} squads${job.finishedAt ? ` · ${formatDate(job.finishedAt)}` : ""}`}
            {job.failed.length > 0 && ` · failed: ${job.failed.map((f) => `${f.team} (${f.email})`).join(", ")}`}
          </p>
        )}
        {message && <p className={`cert-job ${message.tone}`} role="alert">{message.text}</p>}
      </section>

      <section className="admin-card meal-teams">
        <h3>Members</h3>
        <div className="table-wrap">
          {squads.length ? (
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Member</th>
                  <th>College</th>
                  <th>Mr / Ms</th>
                </tr>
              </thead>
              <tbody>
                {squads.flatMap((squad) =>
                  squad.members.map((member, i) => (
                    <tr key={`${squad.id}-${member.position}`}>
                      <td>
                        {i === 0 && (
                          <>
                            {squad.team_name}
                            <small>
                              {squad.lead_email}
                              {squad.certificates_emailed_at
                                ? ` · emailed ${formatDate(squad.certificates_emailed_at)}`
                                : " · not emailed"}
                            </small>
                          </>
                        )}
                      </td>
                      <td>
                        {member.full_name}
                        {member.position === 1 && <small>Lead</small>}
                      </td>
                      <td>{member.college}</td>
                      <td>
                        <select
                          value={member.title || ""}
                          onChange={(e) => setTitle(squad, member, e.target.value)}
                          disabled={saving === `${squad.id}-${member.position}`}
                          aria-label={`Mr or Ms for ${member.full_name}`}
                        >
                          <option value="">—</option>
                          <option value="Mr">Mr</option>
                          <option value="Ms">Ms</option>
                        </select>
                      </td>
                    </tr>
                  )),
                )}
              </tbody>
            </table>
          ) : (
            <p className="admin-empty">No squad has checked in yet.</p>
          )}
        </div>
      </section>
    </div>
  );
}
