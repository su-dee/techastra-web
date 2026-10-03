import React from "react";
import Badge from "./ui/Badge";

const time = (d) => new Date(d).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });
const dateTime = (d) =>
  new Date(d).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
const PAYMENT = { upi: "UPI", cash: "Cash", free: "Free", razorpay: "Online", later: "Pay later - not paid yet" };

function Row({ label, children }) {
  if (children === null || children === undefined || children === "") return null;
  return (
    <div className="flex gap-3 py-1.5 border-b border-shade/10 last:border-0">
      <dt className="w-28 shrink-0 text-shade/60">{label}</dt>
      <dd className="min-w-0 break-words">{children}</dd>
    </div>
  );
}

function Section({ title, children }) {
  return (
    <section>
      <h3 className="font-mono text-[11px] tracking-[0.14em] uppercase text-dim mb-1.5">{title}</h3>
      {children}
    </section>
  );
}

/**
 * A participant's full record after an ID card scan (registration desk and
 * event coordinators): `details` comes from server/utils/participantDetails.js.
 * `highlightEventId` marks the coordinator's own event in the list.
 */
export default function ParticipantDetails({ details, highlightEventId }) {
  if (!details) return null;
  const { person, team, events, payment, meals, kit } = details;
  return (
    <div className="space-y-5 text-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-lg leading-tight text-heading">{person.name}</p>
          <p className="font-mono text-dim">{details.registrationCode}</p>
        </div>
        <div className="flex flex-col items-end gap-1.5 shrink-0">
          <Badge status={details.status} />
          {details.junior && <Badge status="info">Junior</Badge>}
        </div>
      </div>

      <Section title="Participant">
        <dl>
          <Row label="Phone">{person.phone && <a href={`tel:${person.phone}`} className="underline">{person.phone}</a>}</Row>
          <Row label="Email">{person.email && <a href={`mailto:${person.email}`} className="underline">{person.email}</a>}</Row>
          <Row label="College / school">{person.college}</Row>
          <Row label="Register no.">{person.registerNo}</Row>
          <Row label="Course">{person.course}</Row>
          <Row label="Department">{person.department}</Row>
          <Row label="Year">{person.yearOfStudy}</Row>
          {details.junior && <Row label="Guardian consent">{details.guardianConsent ? "Yes" : "No"}</Row>}
        </dl>
      </Section>

      {team.members.length > 1 && (
        <Section title={team.name ? `Team ${team.name} (${team.size})` : `Team (${team.size})`}>
          <ul className="space-y-1">
            {team.members.map((m, i) => (
              <li key={`${m.name}-${i}`} className="flex justify-between gap-3">
                <span className="min-w-0 break-words">
                  {m.name}
                  {m.role === "lead" && <span className="text-dim"> (lead)</span>}
                </span>
                {m.regNo && <span className="font-mono text-dim shrink-0">{m.regNo}</span>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      <Section title={`Events (${events.length})`}>
        <ul className="space-y-1.5">
          {events.map((e) => (
            <li
              key={e.id}
              className={`rounded-lg px-3 py-2 ${e.id === highlightEventId ? "bg-amber/10 border border-amber/40" : "bg-shade/5"}`}
            >
              <div className="flex justify-between gap-3">
                <span className="font-medium min-w-0 break-words">{e.name}</span>
                {e.checkedInAt ? (
                  <span className="text-success shrink-0">✓ In {time(e.checkedInAt)}</span>
                ) : (
                  <span className="text-shade/50 shrink-0">Not checked in</span>
                )}
              </div>
              <p className="text-shade/60 text-[13px]">
                {dateTime(e.startTime)}
                {e.venue && <> · {e.venue}</>}
              </p>
            </li>
          ))}
        </ul>
      </Section>

      <Section title="Registration & payment">
        <dl>
          <Row label="Payment">
            {PAYMENT[payment.method] || payment.method} · ₹{payment.amount}
          </Row>
          <Row label="UTR / Txn">{payment.transactionId && <span className="font-mono">{payment.transactionId}</span>}</Row>
          <Row label="Registered">{dateTime(payment.registeredAt)}</Row>
          <Row label="Reviewed by">
            {payment.reviewedByName && (
              <>
                {payment.reviewedByName}
                {payment.reviewedAt && <> · {dateTime(payment.reviewedAt)}</>}
              </>
            )}
          </Row>
          {details.status === "rejected" && <Row label="Reason">{details.rejectionReason}</Row>}
        </dl>
      </Section>

      <Section title="Kit & food">
        <dl>
          <Row label="Kit">
            {kit ? `${kit.kits} given by ${kit.givenByName} · ${time(kit.givenAt)}` : "Not collected yet"}
          </Row>
          <Row label="Food">
            {meals.length ? meals.map((m) => `${m.mealSession.charAt(0).toUpperCase()}${m.mealSession.slice(1)} (${time(m.collectedAt)})`).join(", ") : "None collected yet"}
          </Row>
        </dl>
      </Section>
    </div>
  );
}
