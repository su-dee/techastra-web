import React, { useState } from "react";
import toast from "react-hot-toast";
import Button from "../ui/Button";
import { api } from "../../lib/api";

const TITLES = ["Mr", "Ms"];

// The same people and printed name as the server (utils/certificates.js
// peopleOf and certificateNameParts): "Mr. Arjun Ramesh, CSE-3rd Year".
function peopleOf(registration) {
  const team = Array.isArray(registration.teamMembers) ? registration.teamMembers.filter((m) => m?.name) : [];
  const u = registration.user || {};
  if (team.length) {
    return team.map((m, i) => ({
      name: m.name,
      department: m.department || (i === 0 ? u.department : "") || "",
      yearOfStudy: m.yearOfStudy || (i === 0 ? u.yearOfStudy : "") || "",
    }));
  }
  return [{ name: u.name, department: u.department || "", yearOfStudy: u.yearOfStudy || "" }];
}

// The department and year are printed smaller (certificateNameParts on the server).
function printedName(person, title) {
  const name = `${title ? `${title}. ` : ""}${person.name}`;
  const study = [person.department, person.yearOfStudy].map((x) => String(x || "").trim()).filter(Boolean).join("-");
  if (!study) return name;
  return (
    <>
      {`${name}, `}
      <span className="text-[0.7em]">{study}</span>
    </>
  );
}

/**
 * Mr or Ms for each name on the certificates (the lead picks for the whole
 * team), with a preview of the printed line. Saves through
 * PUT /api/certificates/mine/titles.
 */
export default function CertificateNames({ registration, onSaved }) {
  const people = peopleOf(registration);
  const saved = people.map((_, i) => (TITLES.includes(registration.memberTitles?.[i]) ? registration.memberTitles[i] : ""));
  const missing = saved.some((t) => !t);

  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(saved);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const open = editing || missing;
  const titles = open ? draft : saved;

  const save = async (e) => {
    e.preventDefault();
    if (draft.some((t) => !t)) {
      setError(people.length > 1 ? "Choose Mr or Ms for every team member." : "Choose Mr or Ms.");
      return;
    }
    setSaving(true);
    try {
      const data = await api.put("/api/certificates/mine/titles", { titles: draft });
      onSaved(data.memberTitles);
      setEditing(false);
      setError("");
      toast.success("Saved - your certificates will use these names");
    } catch (err) {
      setError(err.message || "Couldn’t save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={save} noValidate className="card p-4 sm:p-5 mb-3">
      <div className="flex items-start justify-between gap-3">
        <p className="mono-label">Name on certificate</p>
        {!open && (
          <button type="button" className="link-cta text-[13px] tap-24 shrink-0" onClick={() => { setDraft(saved); setEditing(true); }}>
            Change
          </button>
        )}
      </div>
      {missing && (
        <p className="mt-2 text-[14px] text-text">
          Choose <strong className="font-semibold text-heading">Mr</strong> or <strong className="font-semibold text-heading">Ms</strong>
          {people.length > 1 ? " for each person" : ""} - it’s printed before the name on the certificate.
        </p>
      )}
      <ul className="mt-3 space-y-3">
        {people.map((p, i) => (
          <li key={i} className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-[15px] text-heading min-w-0 break-words">{printedName(p, titles[i])}</span>
            {open && (
              <span className="flex gap-2 shrink-0" role="group" aria-label={`Mr or Ms for ${p.name}`}>
                {TITLES.map((t) => (
                  <button
                    key={t}
                    type="button"
                    className={"chip" + (draft[i] === t ? " is-active" : "")}
                    aria-pressed={draft[i] === t}
                    onClick={() => setDraft((d) => d.map((x, j) => (j === i ? t : x)))}
                  >
                    {t}
                  </button>
                ))}
              </span>
            )}
          </li>
        ))}
      </ul>
      {open && (
        <>
          {error && (
            <p role="alert" className="mt-3 text-[13px] text-danger">{error}</p>
          )}
          <div className="flex gap-3 mt-4">
            <Button type="submit" size="sm" disabled={saving} aria-busy={saving || undefined}>
              {saving ? "Saving…" : "Save"}
            </Button>
            {!missing && (
              <Button type="button" size="sm" variant="outline" onClick={() => setEditing(false)} disabled={saving}>
                Cancel
              </Button>
            )}
          </div>
        </>
      )}
    </form>
  );
}
