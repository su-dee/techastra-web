import React, { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Countdown from "../components/Countdown";
import Partners from "../components/Partners";
import { EventModal, useCartToggle, useEventModal, useEvents } from "../components/EventBrowser";
import { formatTimeRange, teamLabel } from "../components/EventInfo";
import EventArt from "../components/EventArt";
import {
  ADDRESS,
  CATEGORY_COORDINATORS,
  CATEGORY_LABEL,
  LEVEL_AUDIENCE,
  LEVEL_LABEL,
  DAYS,
  EDITION,
  EVENT_DATES,
  INSTITUTE,
  MAP_EMBED,
  MAP_LINK,
  PHONE,
  TECHASTRA_COORDINATORS,
  categoryOf,
  dayOf,
  levelOf,
} from "../lib/site";
import logo from "../assets/logo.webp";
import annaBlock from "../assets/anna-block.webp";

/**
 * Landing page - same sections, order and copy as the main site's home
 * (techastra-web/src/App.jsx): hero, ticker, institute, Techastra, events,
 * schedule, partners, contact. Event and schedule data come from the API,
 * and the calls to action lead into this portal's own registration flow.
 */

const VISION = [
  ["V", "irtual"], ["I", "ntelligence"], ["S", "ustainable"],
  ["I", "nnovation"], ["O", "perations"], ["N", "ext-Gen Network"],
];

const DEPTS = [
  {
    dot: "dot--amber",
    name: "Computer Science & Engineering",
    blurb:
      "Started in 1988, the department is committed to delivering high-quality education to UG, PG and research students, fostering excellence in technology through rigorous academic programmes and pioneering research.",
  },
  {
    dot: "dot--steel",
    name: "Cyber Security",
    blurb:
      "Equipping students with unique research experiences in cyber forensics and information security — shaping the next generation of technocrats with exceptional capabilities.",
  },
];

const COURSES = [
  { faculty: "Faculty of Engineering & Technology", list: ["B.Tech CSE", "B.Tech CFIS", "B.Tech CSE (Cyber Security)", "M.Tech CSE", "M.Tech CFIS"] },
  { faculty: "Faculty of Humanities & Science", list: ["B.Sc ISCF", "B.Sc Criminology", "M.Sc CFIS", "M.Sc Criminology"] },
];

// Camera lens behind the hero (three.js, lib/particleLens.js) - focus,
// perspective, precision: an 8-blade aperture that slowly opens and closes,
// a rotating focus ring and distance scale, and glass reflections. three.js is loaded with a
// dynamic import after the page has loaded, so it never delays first paint;
// the .hero CSS gradient shows until then, and is all that shows without
// WebGL2 or on Save-Data / 2G connections.
//
// Scrolling through the hero flies through the lens: the canvas stays pinned
// while the text scrolls over it, the aperture opens wide and the camera moves
// in as it fades. Rendering stops while the hero is off-screen or paused. On
// desktop the lens tilts toward the cursor and its reflections shift.
//
// It animates even when the OS asks for reduced motion (Windows reports that
// whenever "Animation effects" is off), so a pause button is always shown
// instead; the choice is remembered.
const PAUSE_KEY = "techastra_backdrop_paused";

function readPaused() {
  try {
    return localStorage.getItem(PAUSE_KEY) === "1";
  } catch {
    return false;
  }
}

function canAnimate() {
  const conn = navigator.connection;
  return !(conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || "")));
}

function hasWebGL2() {
  try {
    return !!document.createElement("canvas").getContext("webgl2");
  } catch {
    return false;
  }
}

// The hero text from the headline down to the dates. The lens dims behind
// this area (not behind the logo, which it frames) so the text stays legible.
const TEXT_SELECTORS = [".hero__title", ".hero__depts", ".hero__vision", ".hero__sub", ".hero__details"];
const TEXT_PAD = 24;

function textZone(canvasEl) {
  const hero = canvasEl?.closest(".hero");
  if (!hero) return null;
  const boxes = TEXT_SELECTORS.map((sel) => hero.querySelector(sel)?.getBoundingClientRect()).filter(Boolean);
  if (!boxes.length) return null;
  const c = canvasEl.getBoundingClientRect();
  const left = Math.min(...boxes.map((b) => b.left)) - TEXT_PAD;
  const top = Math.min(...boxes.map((b) => b.top)) - TEXT_PAD;
  const right = Math.max(...boxes.map((b) => b.right)) + TEXT_PAD;
  const bottom = Math.max(...boxes.map((b) => b.bottom)) + TEXT_PAD;
  return { x: left - c.left, y: top - c.top, width: right - left, height: bottom - top };
}

// Fewer particles on small screens and low-core devices.
function particleCount() {
  const small = window.innerWidth < 768 || (navigator.hardwareConcurrency || 8) <= 4;
  return small ? 5000 : 10000;
}

function HeroBackdrop() {
  const wrapRef = useRef(null);
  const stickyRef = useRef(null);
  const canvasRef = useRef(null);
  const scene = useRef(null);
  const [paused, setPaused] = useState(readPaused);
  const [visible, setVisible] = useState(true);
  const [enabled] = useState(() => canAnimate() && hasWebGL2());
  const [ready, setReady] = useState(false);

  // Build the scene once the page has finished loading.
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    const start = () =>
      import("../lib/particleLens")
        .then(({ createLens }) => {
          if (cancelled || !canvasRef.current) return;
          const v = createLens(canvasRef.current, { count: particleCount() });
          const el = stickyRef.current;
          v.resize(el.clientWidth, el.clientHeight);
          v.setTextZone(textZone(el));
          scene.current = v;
          if (import.meta.env.DEV) window.__heroLens = v;
          setReady(true);
        })
        .catch(() => {
          /* three.js failed to load - keep the CSS gradient */
        });
    const kick = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1200 }) : setTimeout(start, 150));
    if (document.readyState === "complete") kick();
    else window.addEventListener("load", kick, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", kick);
      scene.current?.dispose();
      scene.current = null;
    };
  }, [enabled]);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting));
    io.observe(wrapRef.current);
    return () => io.disconnect();
  }, []);

  // Run only while on screen and not paused; paused shows a still frame.
  useEffect(() => {
    const v = scene.current;
    if (!v) return;
    if (visible && !paused) v.start();
    else {
      v.stop();
      if (visible) v.renderOnce();
    }
  }, [ready, visible, paused]);

  // Fly-through: 0 at the top of the page, 1 once the hero has scrolled away.
  useEffect(() => {
    if (!ready) return;
    let raf = 0;
    const update = () => {
      raf = 0;
      const v = scene.current;
      const hero = wrapRef.current?.parentElement;
      if (!v || !hero) return;
      v.setScroll(window.scrollY / hero.offsetHeight);
      // The text scrolls over the pinned canvas, so the dimmed zone follows it.
      v.setTextZone(textZone(stickyRef.current));
      if (paused && visible) v.renderOnce();
    };
    const onScroll = () => {
      if (!raf) raf = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      window.removeEventListener("scroll", onScroll);
      cancelAnimationFrame(raf);
    };
  }, [ready, paused, visible]);

  // Gentle tilt toward the cursor (mouse/trackpad only).
  useEffect(() => {
    if (!ready || !window.matchMedia("(pointer: fine)").matches) return;
    const onMove = (e) => scene.current?.setPointer((e.clientX / window.innerWidth) * 2 - 1, (e.clientY / window.innerHeight) * 2 - 1);
    window.addEventListener("pointermove", onMove, { passive: true });
    return () => window.removeEventListener("pointermove", onMove);
  }, [ready]);

  useEffect(() => {
    if (!ready) return;
    const el = stickyRef.current;
    const ro = new ResizeObserver(() => {
      scene.current?.resize(el.clientWidth, el.clientHeight);
      scene.current?.setTextZone(textZone(el));
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [ready]);

  // The same switch pauses the ticker and other page motion (WCAG 2.2.2).
  useEffect(() => {
    document.documentElement.classList.toggle("motion-paused", paused);
    return () => document.documentElement.classList.remove("motion-paused");
  }, [paused]);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem(PAUSE_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable - the toggle still works for this visit */
    }
  };

  return (
    <>
      <div ref={wrapRef} className="hero__backdrop" aria-hidden="true">
        {/* Pinned to the viewport while the hero scrolls, so the fly-through
            stays in view; it leaves with the end of the hero. */}
        <div ref={stickyRef} className="hero__sticky">
          {enabled && <canvas ref={canvasRef} className={"hero__particles" + (ready ? " is-ready" : "")} />}
        </div>
        <div className="hero__scrim" />
      </div>
      {(
        <button
          type="button"
          className="hero__bg-toggle"
          onClick={toggle}
          aria-label={paused ? "Play animations" : "Pause animations"}
          title={paused ? "Play animations" : "Pause animations"}
          aria-pressed={paused}
          data-log="home-backdrop-toggle"
        >
          {paused ? (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
          ) : (
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" /></svg>
          )}
        </button>
      )}
    </>
  );
}

function Hero({ eventCount }) {
  return (
    <header id="home" className="hero">
      <HeroBackdrop />
      <div className="hero__content">
        <div className="hero__badge">{EDITION} National Level Technical Symposium · 2026</div>
        <img className="hero__logo" src={logo} alt="Techastra ’26 — VISION" />
        <h1 className="hero__title">Where Vision Meets Innovation.</h1>
        <p className="hero__depts">C S E &nbsp;×&nbsp; C Y B E R &nbsp; S E C U R I T Y</p>
        <div className="hero__vision" aria-label="VISION">
          {VISION.map(([l, rest], i) => (
            <span key={i}><b>{l}</b>{rest}</span>
          ))}
        </div>
        <p className="hero__sub">
          Two days of code, cryptography, design and play at Dr. M.G.R. Educational and Research
          Institute — hosted by the Department of Computer Science &amp; Engineering and the
          Department of Cyber Security.
        </p>
        <div className="hero__details">
          <span>{EVENT_DATES}</span>
          <span>{INSTITUTE}, Chennai</span>
        </div>
        <Countdown />
        <div className="hero__ctas">
          <Link className="btn-reg" to="/events?level=senior" data-log="home-hero-senior">Senior Registration</Link>
          <Link className="btn-reg" to="/events?level=junior" data-log="home-hero-junior">Junior Events</Link>
        </div>
        <a className="hero__explore" href="#events">
          Explore {eventCount ? `all ${eventCount}` : "the"} events ↓
        </a>
      </div>
    </header>
  );
}

function About() {
  return (
    <section id="about" className="section about">
      <div className="wrap about__grid">
        <div>
          <div className="kicker">01 — About the Institute</div>
          <h2 className="h2">Dr. M.G.R. Educational and Research Institute</h2>
          <p className="lead mt-6">
            Aiming to bring about change and progress through education, the Tmt. Kannammal
            Educational Trust was constituted in 1985 and started Thai Moogambigai Polytechnic College.
            Within three years of its inception, Dr. M.G.R. Engineering College was founded in 1988 —
            the same year the Department of Computer Science and Engineering was started.
          </p>
          <p className="lead mt-4">
            The institute acquired Deemed University status in 2003 as Dr. M.G.R. Educational and
            Research Institute, as per the orders of the University Grants Commission, New Delhi and
            the Union Ministry of Human Resource Development, Government of India.
          </p>
        </div>
        <figure className="about__photo">
          <img src={annaBlock} alt="Anna Block, Dr. M.G.R. Educational and Research Institute campus" loading="lazy" />
        </figure>
      </div>

      <div className="wrap about__grid about__inst">
        <div className="dept-list">
          {DEPTS.map((d) => (
            <div key={d.name} className="card dept">
              <div className="dept__head">
                <div className={"dot " + d.dot} />
                <div className="mono-label">Department of</div>
              </div>
              <h3>{d.name}</h3>
              <p>{d.blurb}</p>
            </div>
          ))}
        </div>
        <div className="card dept">
          <div className="mono-label">Programmes offered</div>
          <div className="courses">
            {COURSES.map((c) => (
              <div key={c.faculty}>
                <div className="courses__faculty">{c.faculty}</div>
                <ul>{c.list.map((x) => <li key={x}>{x}</li>)}</ul>
              </div>
            ))}
          </div>
          <p className="mt-4">and Ph.D for the above programmes.</p>
        </div>
      </div>
    </section>
  );
}

function AboutTechastra({ eventCount }) {
  const highlights = [
    { k: "When", v: EVENT_DATES },
    { k: "Where", v: INSTITUTE },
    { k: "Events", v: eventCount ? `${eventCount} across senior & junior` : "Senior & junior" },
  ];
  return (
    <section id="techastra" className="section techastra">
      <div className="wrap about__grid techastra__grid">
        <div>
          <div className="card techastra__logo-card">
            <div className="orb orb--amber" style={{ left: -30, top: -30, width: 110, height: 110, opacity: 0.6 }} aria-hidden="true" />
            <div className="orb orb--steel" style={{ right: -20, bottom: -24, width: 80, height: 80, opacity: 0.8 }} aria-hidden="true" />
            <img src={logo} alt="Techastra ’26 — VISION" loading="lazy" />
          </div>
          <div className="techastra__highlights">
            {highlights.map((h) => (
              <div key={h.k} className="card techastra__hl">
                <div className="mono-label">{h.k}</div>
                <div>{h.v}</div>
              </div>
            ))}
          </div>
        </div>

        <div>
          <div className="kicker">02 — About Techastra</div>
          <h2 className="h2">One campus, two disciplines, one vision.</h2>
          <p className="lead mt-6">
            The Department of Computer Science and Engineering and the Department of Cyber Security at
            Dr. M.G.R. Educational and Research Institute are honoured to announce the {EDITION} National
            Level Technical Symposium, <b className="accent">TECHASTRA ’26</b>, scheduled for 8 and 9
            October 2026 at our vibrant university campus.
          </p>
          <p className="lead mt-4">
            Techastra stands as the flagship event of our department, celebrated for its consistent
            success and remarkable impact year after year. This year’s theme, <b className="accent">VISION</b> —
            Virtual, Intelligence, Sustainable, Innovation, Operations and Next-Generation Network —
            brings together a dynamic and diverse audience, making it a premier platform for young
            engineers and school students to showcase their talents.
          </p>
          <p className="lead mt-4">
            By participating in Techastra ’26, you get the opportunity to enrich your technical skills
            with insights from academicians, professionals and industry experts, and to forge valuable
            connections. We warmly invite you to be part of this event — your presence will make it a
            grand success.
          </p>
          <div className="tags tags--grid mt-7">
            {["Senior events (college students)", "Junior events (school students)", "Individual & Team participation", "Technical Events & Non-Technical Events"].map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
          <div className="techastra__ctas">
            <Link className="btn-reg" to="/events?level=senior">Senior Registration</Link>
            <Link className="btn-reg" to="/events?level=junior">Junior Events</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// Home "Events" section: pick Senior or Junior, then every event name is
// listed under Technical and Non-Technical. A name opens its details pop-up;
// cards, filters and registration live on /events.
function EventsPreview({ events, loading, items, inCart, onOpen }) {
  const [level, setLevel] = useState(() => (items[0] ? levelOf(items[0]) : "senior"));
  const ofLevel = events.filter((e) => levelOf(e) === level);
  const byStart = (a, b) => new Date(a.startTime) - new Date(b.startTime) || a.name.localeCompare(b.name);
  const groups = ["technical", "non_technical"].map((cat) => ({ cat, list: ofLevel.filter((e) => categoryOf(e) === cat).sort(byStart) }));
  return (
    <section id="events" className="section events">
      <div className="wrap">
        <div className="events__head">
          <div>
            <div className="kicker">03 — Events</div>
            <h2 className="h2">Choose your arena</h2>
          </div>
          <div className="seg" role="group" aria-label="Level">
            {Object.entries(LEVEL_LABEL).map(([k, v]) => (
              <button key={k} className={level === k ? "is-active" : ""} aria-pressed={level === k} onClick={() => setLevel(k)} data-log={`home-events-level-${k}`}>
                {v} events
              </button>
            ))}
          </div>
        </div>
        <div className="events__count" aria-live="polite">
          {loading
            ? "LOADING EVENTS…"
            : `${LEVEL_LABEL[level].toUpperCase()} EVENTS · FOR ${LEVEL_AUDIENCE[level].toUpperCase()} — ${ofLevel.length} EVENTS`}
        </div>

        <div className="evcats">
          {groups.map(({ cat, list }) => (
            <section key={cat} className="card evcat" aria-labelledby={`evcat-${cat}`}>
              <div className="evcat__head">
                <h3 id={`evcat-${cat}`} className="evcat__title">
                  {LEVEL_LABEL[level]} {CATEGORY_LABEL[cat]} Events
                </h3>
                <span className="evcat__n">{list.length}</span>
              </div>
              <ul className="evcat__list">
                {list.map((e) => (
                  <li key={e.id}>
                    <button type="button" className="evcat__row" onClick={() => onOpen(e)} aria-label={`${e.name}, view details`}>
                      <EventArt event={e} className="evcat__art" />
                      <span className="evcat__main">
                        <span className="evcat__name">
                          {e.name}
                          {inCart(e.id) && <span className="evcat__in">✓ In cart</span>}
                        </span>
                        <span className="evcat__meta">{e.track}</span>
                      </span>
                      <span className="evcat__when">
                        Day {dayOf(e) || "TBA"} · {formatTimeRange(e)}
                      </span>
                    </button>
                  </li>
                ))}
                {!loading && list.length === 0 && <li className="evcat__empty">To be announced</li>}
              </ul>
            </section>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link to={`/events?level=${level}`} className="btn-reg" data-log="home-events-all">
            See all {LEVEL_LABEL[level]} Events &amp; register →
          </Link>
        </div>
      </div>
    </section>
  );
}

function Schedule({ events, onOpen }) {
  const [day, setDay] = useState(DAYS[0].id);
  const undated = events.filter((e) => !dayOf(e));
  const tabs = undated.length ? [...DAYS, { id: "tba", label: "Date TBA", long: "Dates to be announced" }] : DAYS;
  const current = tabs.find((t) => t.id === day) || tabs[0];
  const list = (day === "tba" ? undated : events.filter((e) => dayOf(e) === day)).sort(
    (a, b) => new Date(a.startTime) - new Date(b.startTime) || a.name.localeCompare(b.name)
  );
  // Same grouping as the Events section: level, then category. Groups with
  // no events on this day are left out.
  const groups = ["senior", "junior"]
    .flatMap((lv) => ["technical", "non_technical"].map((cat) => ({ lv, cat, list: list.filter((e) => levelOf(e) === lv && categoryOf(e) === cat) })))
    .filter((g) => g.list.length);

  return (
    <section id="schedule" className="section schedule">
      <div className="wrap">
        <div className="kicker">04 — Schedule</div>
        <div className="schedule__head">
          <h2 className="h2">8 – 9 October</h2>
          <div className="seg" role="tablist" aria-label="Day">
            {tabs.map((t) => (
              <button key={t.id} role="tab" aria-selected={day === t.id} className={day === t.id ? "is-active" : ""} onClick={() => setDay(t.id)}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
        <div className="schedule__day">
          {current.long} · {list.length} event{list.length === 1 ? "" : "s"}
        </div>
        {list.length === 0 && <p className="schedule__note">No events scheduled for this day yet.</p>}
        <div className="agenda-groups">
          {groups.map(({ lv, cat, list: rows }) => (
            <section
              key={`${lv}-${cat}`}
              className="card agenda-group"
              // Distinct from the Events section's groups with the same heading.
              aria-label={`Schedule, Day ${day}: ${LEVEL_LABEL[lv]} ${CATEGORY_LABEL[cat]} Events`}
            >
              <div className="evcat__head">
                <h3 id={`agenda-${day}-${lv}-${cat}`} className="evcat__title">
                  {LEVEL_LABEL[lv]} {CATEGORY_LABEL[cat]} Events
                </h3>
                <span className="evcat__n">{rows.length}</span>
              </div>
              <div className="agenda">
                {rows.map((e) => (
                  <button key={e.id} className="agenda__row" onClick={() => onOpen(e)}>
                    <span className="agenda__time">{formatTimeRange(e)}</span>
                    <div>
                      <div className="agenda__title">{e.name}</div>
                      <div className="agenda__where">
                        {e.venue || "Venue TBA"} · {e.track || teamLabel(e)}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </section>
          ))}
        </div>
        <p className="schedule__note">
          Timings and venues may change closer to the symposium. Tap any event for full details.
        </p>
      </div>
    </section>
  );
}

function Contact() {
  return (
    <section id="contact" className="section contact">
      <div className="orb orb--amber" style={{ left: "8%", top: "6%", width: 72, height: 72 }} aria-hidden="true" />
      <div className="orb orb--steel" style={{ right: "9%", top: "10%", width: 52, height: 52 }} aria-hidden="true" />
      <div className="contact__inner">
        <div className="kicker mb-[18px]">05 — Register &amp; Contact</div>
        <h2>See you on 8 October</h2>
        <p className="lead mx-auto mt-[18px] max-w-[560px]">
          Senior events are open to college students: pick your events, register as an individual or
          a team, and pay online. Junior events are for school students, registered by their school
          through the Junior Techastra coordinator. Reach out to the coordinators below for any queries.
        </p>
        <div className="contact__ctas">
          <Link className="btn-reg" to="/events?level=senior" data-log="home-contact-senior">Senior Registration</Link>
          <Link className="btn-reg" to="/events?level=junior" data-log="home-contact-junior">Junior Events</Link>
        </div>

        <div className="overall card">
          <div className="orb orb--amber" style={{ right: -36, top: -36, width: 120, height: 120, opacity: 0.45 }} aria-hidden="true" />
          <div className="overall__head">
            <div className="kicker">Techastra ’26</div>
            <h3>Overall Coordinators</h3>
          </div>
          <div className="overall__cols">
            <div>
              <div className="mono-label">Staff coordinators</div>
              <ul>{TECHASTRA_COORDINATORS.staff.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
            <div>
              <div className="mono-label">Student coordinators</div>
              <ul>{TECHASTRA_COORDINATORS.students.map((n) => <li key={n}>{n}</li>)}</ul>
            </div>
          </div>
        </div>

        <div className="contact__sub mono-label">Category coordinators</div>
        <div className="contact__grid">
          {CATEGORY_COORDINATORS.map((c) => (
            <div key={c.role} className="coord">
              <div className="mono-label">{c.role}</div>
              <div className="coord__group">
                <div>Staff coordinators</div>
                <ul>{c.staff.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
              <div className="coord__group">
                <div>Student coordinators</div>
                <ul>{c.students.map((n) => <li key={n}>{n}</li>)}</ul>
              </div>
            </div>
          ))}
        </div>

        <div className="venue card">
          <div className="venue__info">
            <div className="mono-label">Venue</div>
            <h3>{INSTITUTE}</h3>
            <p>{ADDRESS.map((l) => <span key={l}>{l}<br /></span>)}</p>
            <p>
              Phone: <a href={`tel:${PHONE}`}>{PHONE.replace(/^(\d{3})(\d{8})$/, "$1 $2")}</a>
            </p>
            <a className="btn-ghost venue__dir" href={MAP_LINK} target="_blank" rel="noreferrer">Get directions ↗</a>
          </div>
          <iframe
            className="venue__map"
            title="Map to Dr. M.G.R. Educational and Research Institute"
            src={MAP_EMBED}
            loading="lazy"
            referrerPolicy="no-referrer-when-downgrade"
            allowFullScreen
          />
        </div>
      </div>
    </section>
  );
}

export default function Home() {
  const { events, loading } = useEvents();
  const { items, inCart, toggle } = useCartToggle();
  const modal = useEventModal(events);
  // Prev/Next in the modal walks the events of the open event's level.
  const modalList = modal.active ? events.filter((e) => levelOf(e) === levelOf(modal.active)) : [];

  return (
    <>
      <Hero eventCount={events.length} />
      <About />
      <AboutTechastra eventCount={events.length} />
      <EventsPreview events={events} loading={loading} items={items} inCart={inCart} onOpen={modal.open} />
      <Schedule events={events} onOpen={modal.open} />
      <Partners />
      <Contact />
      <EventModal
        event={modal.active}
        onClose={modal.close}
        inCart={modal.active && inCart(modal.active.id)}
        onToggle={toggle}
        list={modalList}
        onNavigate={modal.go}
      />
    </>
  );
}
