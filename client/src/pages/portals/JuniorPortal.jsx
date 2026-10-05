import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import Modal from "../../components/ui/Modal";
import { Input, Select } from "../../components/ui/Input";
import { api } from "../../lib/api";

const HEADERS = ["Student name", "School", "Class", "Event", "Team name"];

/** Saves text as a file (the template). */
function saveText(text, filename, type = "text/csv;charset=utf-8") {
  const url = URL.createObjectURL(new Blob(["﻿" + text], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const csvCell = (v) => (/[",\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);

/** A template with the expected headings and example rows for real events. */
function templateCsv(events) {
  const solo = events.find((e) => e.maxTeamSize <= 1) || events[0];
  const team = events.find((e) => e.maxTeamSize > 1) || events[0];
  const rows = [HEADERS];
  if (solo) rows.push(["Arun Kumar", "St. Mary's Matric. Hr. Sec. School", "9 A", solo.name, ""]);
  if (team) {
    rows.push(["Divya S", "Velammal Vidyalaya", "11", team.name, "Byte Busters"]);
    rows.push(["Rahul M", "Velammal Vidyalaya", "11", team.name, "Byte Busters"]);
  }
  return rows.map((r) => r.map(csvCell).join(",")).join("\n") + "\n";
}

/**
 * Junior Techastra coordinator: registers the schools' students by importing
 * an Excel/CSV file (one student per row). Junior students get no ID card,
 * QR check-in or certificate; event coordinators pick winners from them.
 */
export default function JuniorPortal() {
  const [events, setEvents] = useState(null);
  const [students, setStudents] = useState(null);

  const loadEvents = useCallback(() => {
    api
      .get("/api/junior/events")
      .then((d) => setEvents(d.events || []))
      .catch((err) => toast.error(err.message));
  }, []);
  const loadStudents = useCallback(() => {
    api
      .get("/api/junior/participants")
      .then((d) => setStudents(d.participants || []))
      .catch((err) => toast.error(err.message));
  }, []);
  const reload = useCallback(() => {
    loadEvents();
    loadStudents();
  }, [loadEvents, loadStudents]);
  useEffect(reload, [reload]);

  return (
    <div className="max-w-6xl mx-auto px-4 sm:px-6 py-10">
      <h1 className="font-heading text-3xl font-bold">Junior Techastra</h1>
      <p className="text-shade/60 mt-2 mb-8 max-w-3xl">
        Register the schools’ students by importing an Excel or CSV file. Junior students don’t get an ID card, QR
        check-in or certificate. Each event’s coordinators pick the winners from the students imported here.
      </p>
      <ImportSection events={events} onImported={reload} />
      <EventCounts events={events} />
      <StudentList students={students} events={events} onChanged={reload} />
    </div>
  );
}

function ImportSection({ events, onImported }) {
  const [file, setFile] = useState(null);
  const [preview, setPreview] = useState(null); // { summary, entries }
  const [busy, setBusy] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [showAll, setShowAll] = useState(false);
  const inputRef = useRef(null);

  const send = (dryRun) => {
    const form = new FormData();
    form.append("file", file);
    return api.post(`/api/junior/import${dryRun ? "?dryRun=1" : ""}`, form, { isFormData: true });
  };

  const check = async () => {
    if (!file) return toast.error("Choose a file first.");
    setBusy("check");
    setPreview(null);
    try {
      setPreview(await send(true));
      setShowAll(false);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  const importNow = async () => {
    setBusy("import");
    try {
      const data = await send(false);
      toast.success(`Imported ${data.imported} student entr${data.imported === 1 ? "y" : "ies"}.`);
      setConfirming(false);
      setPreview(null);
      setFile(null);
      if (inputRef.current) inputRef.current.value = "";
      onImported();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  const problems = preview?.entries.filter((e) => e.error) || [];
  const shown = showAll ? preview?.entries || [] : problems.length ? problems : (preview?.entries || []).slice(0, 50);

  return (
    <section aria-labelledby="import-title" className="mb-10">
      <h2 id="import-title" className="font-heading font-semibold text-xl mb-3">Import students</h2>
      <Card>
        <ol className="list-decimal pl-5 space-y-1.5 text-sm text-shade/70 mb-5">
          <li>
            One student per row, with the columns <strong className="text-heading">{HEADERS.join(", ")}</strong>. Team
            name is optional. No phone number or email is needed.
          </li>
          <li>
            Use the event names exactly as on the website. A student in several events: list them in one cell separated by
            “;”, or add one row per event.
          </li>
          <li>Students with the same team name and school in a team event form one team.</li>
        </ol>
        <div className="flex flex-wrap items-center gap-3">
          <Button variant="outline" size="sm" disabled={!events?.length} onClick={() => saveText(templateCsv(events), "junior-techastra-template.csv")}>
            Download template
          </Button>
          <label className="sr-only" htmlFor="junior-file">Excel or CSV file</label>
          <input
            id="junior-file"
            ref={inputRef}
            type="file"
            accept=".xlsx,.csv"
            onChange={(e) => {
              setFile(e.target.files?.[0] || null);
              setPreview(null);
            }}
            className="block text-[14px] text-soft file:mr-4 file:rounded-[7px] file:border file:border-shade/15 file:bg-transparent file:px-4 file:py-2 file:text-heading hover:file:border-amber/55 max-w-full"
          />
          <Button size="sm" onClick={check} disabled={!file || busy === "check"}>
            {busy === "check" ? "Checking…" : "Check file"}
          </Button>
        </div>

        {preview && (
          <div className="mt-6">
            <div role="status" className="flex flex-wrap items-center gap-2 mb-3">
              <Badge status="approved">{preview.summary.valid} ready</Badge>
              {preview.summary.errors > 0 && <Badge status="rejected">{preview.summary.errors} with problems</Badge>}
              <span className="text-sm text-shade/60">
                {preview.summary.errors > 0
                  ? "Rows with problems are skipped. Fix them in the file and import it again later."
                  : "Everything looks good."}
              </span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-shade/10">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-shade/60 border-b border-shade/10">
                    <th scope="col" className="px-3 py-2 font-medium">Row</th>
                    <th scope="col" className="px-3 py-2 font-medium">Student</th>
                    <th scope="col" className="px-3 py-2 font-medium">Class</th>
                    <th scope="col" className="px-3 py-2 font-medium">School</th>
                    <th scope="col" className="px-3 py-2 font-medium">Event</th>
                    <th scope="col" className="px-3 py-2 font-medium">Team</th>
                    <th scope="col" className="px-3 py-2 font-medium">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {shown.map((e, i) => (
                    <tr key={`${e.row}-${e.eventName}-${i}`} className="border-b border-shade/5 last:border-0 align-top">
                      <td className="px-3 py-2 tabular-nums text-shade/60">{e.row}</td>
                      <td className="px-3 py-2">{e.name || "—"}</td>
                      <td className="px-3 py-2">{e.className || "—"}</td>
                      <td className="px-3 py-2 min-w-[10rem]">{e.school || "—"}</td>
                      <td className="px-3 py-2">{e.eventName || "—"}</td>
                      <td className="px-3 py-2">{e.teamName || "—"}</td>
                      <td className="px-3 py-2 min-w-[12rem]">
                        {e.error ? <span className="text-danger">{e.error}</span> : <span className="text-success">Ready</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {!showAll && preview.entries.length > shown.length && (
              <button type="button" className="mt-2 text-sm text-amber-light hover:underline" onClick={() => setShowAll(true)}>
                Show all {preview.entries.length} entries
              </button>
            )}
            <div className="flex flex-wrap gap-3 mt-5">
              <Button onClick={() => setConfirming(true)} disabled={!preview.summary.valid}>
                Import {preview.summary.valid} student entr{preview.summary.valid === 1 ? "y" : "ies"}
              </Button>
              <Button variant="outline" onClick={() => setPreview(null)}>
                Cancel
              </Button>
            </div>
          </div>
        )}
      </Card>

      <Modal open={confirming} onClose={() => busy !== "import" && setConfirming(false)} title="Import these students?" size="sm">
        <div className="space-y-5">
          <p className="text-sm text-shade/70">
            {preview?.summary.valid} entr{preview?.summary.valid === 1 ? "y" : "ies"} will be added to the Junior events
            {preview?.summary.errors ? `; ${preview.summary.errors} with problems will be skipped` : ""}.
          </p>
          <div className="flex gap-3">
            <Button variant="outline" className="flex-1" onClick={() => setConfirming(false)} disabled={busy === "import"}>
              Cancel
            </Button>
            <Button className="flex-1" onClick={importNow} disabled={busy === "import"}>
              {busy === "import" ? "Importing…" : "Import"}
            </Button>
          </div>
        </div>
      </Modal>
    </section>
  );
}

function EventCounts({ events }) {
  if (!events?.length) return null;
  return (
    <section aria-labelledby="events-title" className="mb-10">
      <h2 id="events-title" className="font-heading font-semibold text-xl mb-3">Students per event</h2>
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {events.map((e) => (
          <Card key={e.id} className="!p-4 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="font-semibold truncate">{e.name}</p>
              <p className="text-xs text-shade/50">{e.maxTeamSize > 1 ? `Teams of up to ${e.maxTeamSize}` : "Individual"}</p>
            </div>
            <span className="font-heading text-2xl tabular-nums">{e.students}</span>
          </Card>
        ))}
      </div>
    </section>
  );
}

function StudentList({ students, events, onChanged }) {
  const [eventId, setEventId] = useState("");
  const [q, setQ] = useState("");
  const [deleting, setDeleting] = useState(null);
  const [busy, setBusy] = useState(false);

  const shown = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return (students || []).filter(
      (s) =>
        (!eventId || s.eventId === eventId) &&
        (!needle || [s.name, s.school, s.code, s.teamName].some((v) => (v || "").toLowerCase().includes(needle)))
    );
  }, [students, eventId, q]);

  const exportCsv = async () => {
    try {
      const blob = await api.blob("/api/junior/export");
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "junior-techastra-students.csv";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(err.message);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await api.delete(`/api/junior/participants/${deleting.id}`);
      toast.success(`Removed ${deleting.name} from ${deleting.eventName}.`);
      setDeleting(null);
      onChanged();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <section aria-labelledby="students-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-3">
        <h2 id="students-title" className="font-heading font-semibold text-xl">
          Imported students {students && <span className="text-shade/50 font-normal text-base">({students.length})</span>}
        </h2>
        <Button size="sm" variant="outline" onClick={exportCsv} disabled={!students?.length}>
          Export CSV
        </Button>
      </div>
      <div className="flex flex-col sm:flex-row gap-3 mb-4">
        <Select value={eventId} onChange={(e) => setEventId(e.target.value)} aria-label="Filter by event" className="sm:max-w-xs">
          <option value="">All events</option>
          {(events || []).map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </Select>
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search name, school, code or team" aria-label="Search students" />
      </div>

      {!students ? (
        <p className="text-shade/50">Loading…</p>
      ) : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-shade/60 border-b border-shade/10">
                <th scope="col" className="px-4 py-3 font-medium">Code</th>
                <th scope="col" className="px-4 py-3 font-medium">Student</th>
                <th scope="col" className="px-4 py-3 font-medium">School</th>
                <th scope="col" className="px-4 py-3 font-medium">Event</th>
                <th scope="col" className="px-4 py-3 font-medium">Team</th>
                <th scope="col" className="px-4 py-3 font-medium">
                  <span className="sr-only">Actions</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {shown.map((s) => (
                <tr key={s.id} className="border-b border-shade/5 last:border-0 align-top">
                  <td className="px-4 py-2.5 font-mono text-xs whitespace-nowrap">{s.code}</td>
                  <td className="px-4 py-2.5">
                    {s.name}
                    <span className="block text-xs text-shade/50">Class {s.className}</span>
                  </td>
                  <td className="px-4 py-2.5 min-w-[10rem]">{s.school}</td>
                  <td className="px-4 py-2.5">{s.eventName}</td>
                  <td className="px-4 py-2.5">{s.teamName || "—"}</td>
                  <td className="px-4 py-2.5 text-right">
                    <Button size="sm" variant="outline" onClick={() => setDeleting(s)} aria-label={`Remove ${s.name} from ${s.eventName}`}>
                      Remove
                    </Button>
                  </td>
                </tr>
              ))}
              {shown.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-shade/50">
                    {students.length ? "No students match." : "No students imported yet."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <Modal open={!!deleting} onClose={() => !busy && setDeleting(null)} title="Remove this student?" size="sm">
        {deleting && (
          <div className="space-y-5">
            <p className="text-sm text-shade/70">
              {deleting.name} ({deleting.school}) will be removed from {deleting.eventName}.
            </p>
            <div className="flex gap-3">
              <Button variant="outline" className="flex-1" onClick={() => setDeleting(null)} disabled={busy}>
                Cancel
              </Button>
              <Button className="flex-1" onClick={remove} disabled={busy}>
                {busy ? "Removing…" : "Remove"}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </section>
  );
}
