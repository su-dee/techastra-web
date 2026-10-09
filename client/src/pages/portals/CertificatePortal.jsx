import React, { useCallback, useEffect, useRef, useState } from "react";
import toast from "react-hot-toast";
import Card from "../../components/ui/Card";
import Button from "../../components/ui/Button";
import Badge from "../../components/ui/Badge";
import { api } from "../../lib/api";

const PLACE = { 1: "1st", 2: "2nd", 3: "3rd" };
const STATUS = {
  ready: ["approved", "Ready"],
  not_ended: ["pending", "Not over yet"],
  no_results: ["pending", "Results not locked"],
};

/** Saves an authenticated download (Excel / PDF) under `filename`. */
async function download(path, filename) {
  const blob = await api.blob(path);
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
const fileSafe = (s) => s.replace(/[^A-Za-z0-9]+/g, "-");

/**
 * Certificate committee:
 * - Participation: at the end of each day, send that day's certificates - to
 *   checked-in participants only, never to the event's winners. Each person
 *   gets their own; a team's all go to the registrant's email and dashboard.
 * - Winners: print the winner certificates and download the winners list
 *   (Excel) for the valedictory. Winners never receive certificates online.
 */
export default function CertificatePortal() {
  return (
    <div className="max-w-6xl mx-auto px-6 py-10">
      <h1 className="font-heading text-3xl font-bold mb-8">Certificate Portal</h1>
      <ParticipationSection />
      <WinnersSection />
    </div>
  );
}

function ParticipationSection() {
  const [day, setDay] = useState(1);
  const [plan, setPlan] = useState(null);
  const [job, setJob] = useState(null);
  const [confirming, setConfirming] = useState(false);
  const poll = useRef(0);

  const load = useCallback(() => {
    api
      .get(`/api/certificates/participation/plan?day=${day}`)
      .then((data) => {
        setPlan(data.events || []);
        setJob(data.job);
      })
      .catch((err) => toast.error(err.message));
  }, [day]);
  useEffect(() => {
    setPlan(null);
    setConfirming(false);
    load();
  }, [load]);

  // While a send runs, follow its progress, then refresh the plan.
  useEffect(() => {
    if (job?.state !== "running") return undefined;
    poll.current = setTimeout(async () => {
      try {
        const data = await api.get("/api/certificates/participation/status");
        setJob(data.job);
        if (data.job?.state !== "running") load();
      } catch {
        /* try again on the next tick */
      }
    }, 2000);
    return () => clearTimeout(poll.current);
  }, [job, load]);

  const ready = (plan || []).filter((e) => e.status === "ready");
  const toSend = ready.reduce((n, e) => n + Math.max(e.eligible - e.alreadySent, 0), 0);
  const running = job?.state === "running";

  const send = async () => {
    setConfirming(false);
    try {
      const data = await api.post("/api/certificates/participation/send", { day });
      setJob(data.job);
      toast.success("Sending participation certificates…");
    } catch (err) {
      toast.error(err.message);
    }
  };

  return (
    <section className="mb-12" aria-labelledby="participation-title">
      <h2 id="participation-title" className="font-heading font-semibold text-xl mb-1">Participation certificates</h2>
      <p className="text-sm text-shade/60 mb-4 max-w-3xl">
        Send them at the end of each day. They go only to participants who were <strong>checked in</strong> at the
        event, and never to its <strong>winners</strong>. An event is included once it has ended and its results are
        locked. Each person gets their own certificate; a team’s are all emailed to the registrant and shown on their
        dashboard. Sending again only sends what’s new.
      </p>

      <div className="flex gap-2 mb-4" role="group" aria-label="Event day">
        {[1, 2].map((d) => (
          <Button key={d} size="sm" variant={day === d ? "primary" : "outline"} aria-pressed={day === d} onClick={() => setDay(d)}>
            Day {d} ({d === 1 ? "8 Oct" : "9 Oct"})
          </Button>
        ))}
      </div>

      {!plan ? (
        <p className="text-shade/50">Loading…</p>
      ) : (
        <Card className="!p-0 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-shade/60 border-b border-shade/10">
                <th scope="col" className="px-4 py-3 font-medium">Event</th>
                <th scope="col" className="px-4 py-3 font-medium">Status</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Checked in</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Winners (left out)</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Certificates</th>
                <th scope="col" className="px-4 py-3 font-medium text-right">Sent</th>
              </tr>
            </thead>
            <tbody>
              {plan.map((e) => (
                <tr key={e.eventId} className="border-b border-shade/5 last:border-0">
                  <td className="px-4 py-2.5">{e.name}</td>
                  <td className="px-4 py-2.5">
                    <Badge status={STATUS[e.status][0]}>{STATUS[e.status][1]}</Badge>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e.checkedIn}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e.winners}</td>
                  <td className="px-4 py-2.5 text-right tabular-nums">
                    {e.people}
                    <span className="text-shade/50"> for {e.eligible} reg.</span>
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{e.alreadySent} / {e.eligible}</td>
                </tr>
              ))}
              {plan.length === 0 && (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-shade/50">No events on Day {day}.</td>
                </tr>
              )}
            </tbody>
          </table>
        </Card>
      )}

      <div className="mt-4 flex flex-wrap items-center gap-3">
        {confirming ? (
          <>
            <span className="text-sm">
              Email participation certificates to <strong>{toSend}</strong> registration{toSend === 1 ? "" : "s"} for{" "}
              {ready.length} event{ready.length === 1 ? "" : "s"}?
            </span>
            <Button size="sm" onClick={send}>Yes, send now</Button>
            <Button size="sm" variant="outline" onClick={() => setConfirming(false)}>Cancel</Button>
          </>
        ) : (
          <Button onClick={() => setConfirming(true)} disabled={running || toSend === 0}>
            {running ? "Sending…" : `Send Day ${day} participation certificates`}
          </Button>
        )}
        {!running && plan && toSend === 0 && (
          <span className="text-sm text-shade/60">
            {ready.length ? "Everything ready has been sent." : "Nothing is ready yet - events must end and have locked results."}
          </span>
        )}
      </div>

      {job && job.day === day && (
        <p role="status" className="mt-3 text-sm text-shade/70">
          {job.state === "running"
            ? `Sending… ${job.done} of ${job.total} registrations done.`
            : job.state === "error"
            ? `Stopped with an error: ${job.error}`
            : `Last send: ${job.emails} email${job.emails === 1 ? "" : "s"} sent, ${job.certificates} certificates.`}
          {job.failed?.length > 0 && (
            <span className="block text-danger">
              Not delivered ({job.failed.length}): {job.failed.map((f) => f.registrationCode).join(", ")} - send again later to retry.
            </span>
          )}
        </p>
      )}
    </section>
  );
}

function WinnersSection() {
  const [events, setEvents] = useState(null);
  const [busy, setBusy] = useState("");

  useEffect(() => {
    api
      .get("/api/certificates/winners")
      .then((data) => setEvents(data.events || []))
      .catch((err) => toast.error(err.message));
  }, []);

  const run = async (key, path, filename) => {
    setBusy(key);
    try {
      await download(path, filename);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy("");
    }
  };

  return (
    <section aria-labelledby="winners-title">
      <div className="flex flex-wrap items-end justify-between gap-3 mb-1">
        <h2 id="winners-title" className="font-heading font-semibold text-xl">Winners (valedictory)</h2>
        <div className="flex flex-wrap gap-2">
          <Button
            size="sm"
            onClick={() => run("valedictory", "/api/certificates/valedictory.pdf", "Techastra26-Valedictory.pdf")}
            disabled={busy === "valedictory"}
          >
            {busy === "valedictory" ? "Preparing…" : "Valedictory sheet (PDF)"}
          </Button>
          <Button
            size="sm"
            onClick={() => run("all-pdf", "/api/certificates/winners.pdf", "Techastra26-Winners-All-Events.pdf")}
            disabled={busy === "all-pdf" || !events?.length}
          >
            {busy === "all-pdf" ? "Preparing…" : "Download all certificates (PDF)"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("list-pdf", "/api/certificates/winners-list.pdf", "Techastra26-Winners-List.pdf")}
            disabled={busy === "list-pdf" || !events?.length}
          >
            {busy === "list-pdf" ? "Preparing…" : "Download winners list (PDF)"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => run("all-xlsx", "/api/certificates/winners.xlsx", "Techastra26-Winners.xlsx")}
            disabled={busy === "all-xlsx" || !events?.length}
          >
            {busy === "all-xlsx" ? "Preparing…" : "Download winners list (Excel)"}
          </Button>
        </div>
      </div>
      <p className="text-sm text-shade/60 mb-4 max-w-3xl">
        Winner certificates are only for printing here - winners don’t receive them online, and they don’t get a
        participation certificate for the event they won. “All certificates” has every event’s winner certificates (one
        page per person, events in day and time order, then 1st, 2nd, 3rd). The winners list (PDF or Excel) has each
        winner’s place, team, name, course, department, year and college; the Excel also has a sheet per event. The
        valedictory sheet is the department’s form: every event with rows I–III, Prize Amount and Signature to fill in.
      </p>

      {!events ? (
        <p className="text-shade/50">Loading…</p>
      ) : events.length === 0 ? (
        <p className="text-shade/50">No event has locked results yet.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {events.map((e) => (
            <Card key={e.eventId} className="!p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="font-semibold">{e.name}</p>
                  {e.day && <p className="text-xs text-shade/50">Day {e.day}</p>}
                </div>
              </div>
              <ol className="mt-3 space-y-1.5 text-sm">
                {e.places.map((p) => (
                  <li key={p.registrationCode}>
                    <span className="font-semibold text-amber-light">{PLACE[p.position] || `${p.position}th`}</span>{" "}
                    {p.names.join(", ")}
                    {p.teamName && <span className="text-shade/50"> · {p.teamName}</span>}
                    <span className="block text-xs text-shade/50">{p.college}</span>
                  </li>
                ))}
              </ol>
              {e.external && (
                <p className="mt-3 text-xs text-shade/50">Locked in the Hack Nexus admin (Certificates tab). No winner certificates here.</p>
              )}
              <div className="flex flex-wrap gap-2 mt-4">
                {!e.external && (
                  <Button
                    size="sm"
                    onClick={() => run(`pdf-${e.eventId}`, `/api/certificates/winners/${e.eventId}/pdf`, `Techastra26-Winners-${fileSafe(e.name)}.pdf`)}
                    disabled={busy === `pdf-${e.eventId}`}
                  >
                    {busy === `pdf-${e.eventId}` ? "Preparing…" : "Winner certificates (PDF)"}
                  </Button>
                )}
                <Button
                  size="sm"
                  variant="outline"
                  onClick={() => run(`xlsx-${e.eventId}`, `/api/certificates/winners.xlsx?eventId=${e.eventId}`, `Techastra26-Winners-${fileSafe(e.name)}.xlsx`)}
                  disabled={busy === `xlsx-${e.eventId}`}
                >
                  Excel
                </Button>
              </div>
            </Card>
          ))}
        </div>
      )}
    </section>
  );
}
