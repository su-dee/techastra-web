import React from "react";
import { COMMITTEE, EVENT_DATES } from "../lib/site";

/** Organising committee: staff and student coordinators, then the working teams (COMMITTEE in lib/site.js). */

function CommitteeCard({ title, children }) {
  return (
    <div className="card committee__card">
      <h3 className="committee__card-title">{title}</h3>
      <ul className="committee__card-list">{children}</ul>
    </div>
  );
}

export default function Committee() {
  return (
    <div className="max-w-5xl mx-auto px-6 py-14 animate-cinematic-fade">
      <header className="page-head">
        <div className="kicker">Organising committee</div>
        <h1 className="h2">Committee</h1>
        <p className="lead">The coordinators behind Techastra ’26, {EVENT_DATES}.</p>
      </header>

      <section aria-labelledby="committee-coordinators">
        <h2 id="committee-coordinators" className="sr-only">Coordinators</h2>
        <div className="committee__grid">
          <CommitteeCard title="Staff Coordinators">
            {COMMITTEE.staff.map((name) => (
              <li key={name}>{name}</li>
            ))}
          </CommitteeCard>
          <CommitteeCard title="Student Coordinators">
            {COMMITTEE.students.map((s) => (
              <li key={s.name}>
                {s.name} <span className="committee__dept">· {s.dept}</span>
              </li>
            ))}
          </CommitteeCard>
        </div>
      </section>

      <section className="committee__teams" aria-labelledby="committee-teams">
        <div className="page-head !mb-8">
          <div className="kicker">Teams</div>
          <h2 id="committee-teams" className="h3">Working committees</h2>
        </div>
        <div className="committee__grid">
          {COMMITTEE.teams.map((team) => (
            <CommitteeCard key={team.name} title={team.name}>
              {[...(team.lead || []), ...team.members].map((name) => (
                <li key={name}>{name}</li>
              ))}
            </CommitteeCard>
          ))}
        </div>
      </section>
    </div>
  );
}
