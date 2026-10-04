import React, { useState } from "react";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import { Label, Input, Select } from "../ui/Input";
import { api } from "../../lib/api";

// Same options as the server (YEARS_OF_STUDY in server/utils/validation.js).
const YEARS_OF_STUDY = ["1st Year", "2nd Year", "3rd Year", "4th Year"];

/**
 * The team on the lead's dashboard. The lead can add or correct each
 * member's department and year of study (teams that registered before
 * these were asked have them blank); names and register numbers stay as
 * registered. Saves through PATCH /api/registrations/mine/team-members.
 */
export default function TeamCard({ registration, onSaved }) {
  const team = Array.isArray(registration.teamMembers) ? registration.teamMembers : [];
  const members = team.filter((m) => m.role !== "lead");
  const missing = members.some((m) => !m.department || !m.yearOfStudy);
  const canEdit = members.length > 0 && registration.status !== "rejected";

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const startEditing = () => {
    setDraft(members.map((m) => ({ department: m.department || "", yearOfStudy: m.yearOfStudy || "" })));
    setError("");
    setEditing(true);
  };
  const update = (i, key, value) => setDraft((d) => d.map((x, j) => (j === i ? { ...x, [key]: value } : x)));

  const save = async (e) => {
    e.preventDefault();
    if (draft.some((d) => !d.department.trim() || !d.yearOfStudy)) {
      setError("Enter every member’s department and year of study.");
      return;
    }
    setSaving(true);
    try {
      const data = await api.patch("/api/registrations/mine/team-members", { members: draft });
      onSaved(data.teamMembers);
      setEditing(false);
      toast.success("Team details saved");
    } catch (err) {
      setError(err.message || "Couldn’t save the team details. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  if (!registration.teamName && team.length === 0) return null;

  return (
    <div className="card p-4 sm:p-5 mt-3">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="mono-label">Team</p>
          {registration.teamName && <p className="text-[17px] text-heading mt-1">{registration.teamName}</p>}
        </div>
        {canEdit && !editing && !missing && (
          <button type="button" className="link-cta text-[13px] tap-24 shrink-0" onClick={startEditing}>
            Edit details
          </button>
        )}
      </div>

      {canEdit && !editing && missing && (
        <div className="mt-3 rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-[14px] text-text">
          <p>
            <strong className="font-semibold text-heading">Add your team members’ details.</strong> We need each
            member’s department and year of study.
          </p>
          <Button type="button" size="sm" className="mt-3" onClick={startEditing}>
            Add department &amp; year
          </Button>
        </div>
      )}

      {editing ? (
        <form onSubmit={save} noValidate className="mt-4 space-y-4">
          {members.map((m, i) => (
            <fieldset key={i} className="rounded-[10px] border border-line p-3">
              <legend className="px-1 text-[14px] text-heading">
                {m.name}
                {m.regNo && <span className="text-dim"> · {m.regNo}</span>}
              </legend>
              <div className="grid sm:grid-cols-2 gap-3">
                <div>
                  <Label htmlFor={`tm${i}-department`} required>Department</Label>
                  <Input
                    id={`tm${i}-department`}
                    required
                    value={draft[i].department}
                    onChange={(e) => update(i, "department", e.target.value)}
                  />
                </div>
                <div>
                  <Label htmlFor={`tm${i}-year`} required>Year of study</Label>
                  <Select id={`tm${i}-year`} required value={draft[i].yearOfStudy} onChange={(e) => update(i, "yearOfStudy", e.target.value)}>
                    <option value="">Select year</option>
                    {YEARS_OF_STUDY.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                </div>
              </div>
            </fieldset>
          ))}
          {error && (
            <p role="alert" className="text-[13px] text-danger">{error}</p>
          )}
          <div className="flex gap-3">
            <Button type="submit" size="sm" disabled={saving} aria-busy={saving || undefined}>
              {saving ? "Saving…" : "Save"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        team.length > 0 && (
          <ul className="mt-3 space-y-2">
            {team.map((m, i) => (
              <li key={i} className="flex items-center justify-between gap-3 text-sm">
                <span className="text-soft truncate">
                  {m.name}
                  {[m.regNo, m.department, m.yearOfStudy].filter(Boolean).map((x) => (
                    <span key={x} className="text-dim"> · {x}</span>
                  ))}
                </span>
                {m.role === "lead" && <span className="pill shrink-0">LEAD</span>}
              </li>
            ))}
          </ul>
        )
      )}
    </div>
  );
}
