import React, { useCallback, useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import Countdown from "../components/Countdown";
import Ticker from "../components/Ticker";
import Partners from "../components/Partners";
import { EventCard, EventFilters, EventModal, useCartToggle, useEventModal, useEvents } from "../components/EventBrowser";
import { formatTimeRange, teamLabel } from "../components/EventInfo";
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

const PREVIEW_COUNT = 6;

// Encoded from stones-backdrop.mp4 (1080p, 11 MB) with ffmpeg: audio stripped,
// 720p landscape + a 540x960 centre crop for portrait screens (phones only
// ever show the middle of the frame), each as AV1 with an H.264 fallback.
// If the clip is re-encoded, rename the files: vercel.json caches
// /videos/backdrop/* as immutable.
const BACKDROP = {
  landscape: {
    av1: "/videos/backdrop/stones-720-av1.mp4", // 0.94 MB
    h264: "/videos/backdrop/stones-720-h264.mp4", // 1.16 MB
    poster: "/videos/backdrop/stones-720-poster.webp",
    width: 1280,
    height: 720,
  },
  portrait: {
    av1: "/videos/backdrop/stones-portrait-av1.mp4", // 0.59 MB
    h264: "/videos/backdrop/stones-portrait-h264.mp4", // 0.72 MB
    poster: "/videos/backdrop/stones-portrait-poster.webp",
    width: 540,
    height: 960,
  },
};
const AV1_TYPE = 'video/mp4; codecs="av01.0.05M.08"';

// AV1 only where the browser decodes it smoothly (Safari without AV1
// hardware, weak phones) - otherwise H.264, which every browser plays.
async function pickCodec(variant) {
  if (!document.createElement("video").canPlayType(AV1_TYPE)) return variant.h264;
  try {
    const info = await navigator.mediaCapabilities?.decodingInfo({
      type: "file",
      video: { contentType: AV1_TYPE, width: variant.width, height: variant.height, bitrate: 800000, framerate: 24 },
    });
    return !info || (info.supported && info.smooth) ? variant.av1 : variant.h264;
  } catch {
    return variant.av1;
  }
}

// Chooses the backdrop files for this screen and delays the video download
// until the page has finished loading, so it never competes with the
// hero's text, logo and fonts. The poster shows until then - and is all that
// loads on Save-Data or 2G connections.
function useBackdropSource() {
  const [variant] = useState(() =>
    window.matchMedia("(max-aspect-ratio: 3/4)").matches ? BACKDROP.portrait : BACKDROP.landscape
  );
  const [src, setSrc] = useState(null);

  useEffect(() => {
    const conn = navigator.connection;
    if (conn && (conn.saveData || /(^|-)2g$/.test(conn.effectiveType || ""))) return;
    let cancelled = false;
    const start = () =>
      pickCodec(variant).then((url) => {
        if (!cancelled) setSrc(url);
      });
    const kick = () => ("requestIdleCallback" in window ? requestIdleCallback(start, { timeout: 1500 }) : setTimeout(start, 200));
    if (document.readyState === "complete") kick();
    else window.addEventListener("load", kick, { once: true });
    return () => {
      cancelled = true;
      window.removeEventListener("load", kick);
    };
  }, [variant]);

  return { poster: variant.poster, src };
}

// Looping video behind the hero.
//
// A plain <video loop> stalls for a moment when it jumps back to the start,
// and this clip's last frame doesn't match its first, so the restart is
// visible. Instead two copies of the clip are stacked: shortly before the
// visible one ends, the other starts from 0 and they crossfade.
//
// It plays even when the OS asks for reduced motion (Windows reports that
// whenever "Animation effects" is off), so a pause button is always shown
// instead; the choice is remembered. Playback also stops while the hero is
// scrolled out of view.
const PAUSE_KEY = "techastra_backdrop_paused";
const CROSSFADE_S = 1.2; // keep in sync with .hero__backdrop video transition

function readPaused() {
  try {
    return localStorage.getItem(PAUSE_KEY) === "1";
  } catch {
    return false;
  }
}

function HeroBackdrop() {
  const refA = useRef(null);
  const refB = useRef(null);
  const active = useRef(0); // index into [refA, refB] of the clip on screen
  const fading = useRef(false);
  const visible = useRef(true);
  const frame = useRef(0);
  const [paused, setPaused] = useState(readPaused);
  const { poster, src } = useBackdropSource();
  // The loop's second copy only starts downloading once the first is fully
  // buffered, so it comes from the HTTP cache instead of a second download.
  const [srcB, setSrcB] = useState(null);
  const shown = useRef(false);

  const videos = () => [refA.current, refB.current];

  const tick = useCallback(() => {
    const [a, b] = videos();
    const cur = active.current === 0 ? a : b;
    const next = active.current === 0 ? b : a;
    if (cur && next && next.readyState >= 2 && !fading.current && cur.duration && cur.currentTime >= cur.duration - CROSSFADE_S - 0.25) {
      fading.current = true;
      next.currentTime = 0;
      next.play().catch(() => {});
      next.classList.add("is-active");
      cur.classList.remove("is-active");
      setTimeout(() => {
        cur.pause();
        cur.currentTime = 0; // decode the first frame now so the next swap starts instantly
        active.current = 1 - active.current;
        fading.current = false;
      }, CROSSFADE_S * 1000);
    }
    frame.current = requestAnimationFrame(tick);
  }, []);

  const sync = useCallback(() => {
    const [a, b] = videos();
    if (!a || !b) return;
    // React doesn't always write the `muted` attribute, and browsers only
    // allow unprompted playback for muted media - set it explicitly.
    a.muted = b.muted = true;
    cancelAnimationFrame(frame.current);
    if (!paused && visible.current) {
      const cur = active.current === 0 ? a : b;
      cur.play().catch(() => {});
      if (fading.current) (cur === a ? b : a).play().catch(() => {});
      frame.current = requestAnimationFrame(tick);
    } else {
      a.pause();
      b.pause();
    }
  }, [paused, tick]);

  useEffect(() => {
    const io = new IntersectionObserver(([entry]) => {
      visible.current = entry.isIntersecting;
      sync();
    });
    io.observe(refA.current);
    sync();
    return () => {
      io.disconnect();
      cancelAnimationFrame(frame.current);
    };
  }, [sync]);

  const toggle = () => {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem(PAUSE_KEY, next ? "1" : "0");
    } catch {
      /* storage unavailable - the toggle still works for this visit */
    }
  };

  // `loop` stays on as a fallback for when requestAnimationFrame is throttled
  // (background tab); normally the crossfade takes over before the end.
  return (
    <>
      <div className="hero__backdrop" aria-hidden="true">
        <img src={poster} alt="" decoding="async" fetchpriority="high" />
        <video
          ref={refA}
          src={src || undefined}
          muted
          loop
          playsInline
          preload="auto"
          onCanPlay={sync}
          onCanPlayThrough={() => setSrcB(src)}
          onPlaying={(e) => {
            // Fade the video in over the poster once real frames are showing.
            if (!shown.current && active.current === 0) e.currentTarget.classList.add("is-active");
            shown.current = true;
          }}
        />
        <video ref={refB} src={srcB || undefined} muted loop playsInline preload="auto" />
        <div className="hero__scrim" />
      </div>
      <button
        type="button"
        className="hero__video-toggle"
        onClick={toggle}
        aria-label={paused ? "Play background video" : "Pause background video"}
        aria-pressed={paused}
        data-log="home-backdrop-toggle"
      >
        {paused ? (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M3 1.5v9l7.5-4.5z" fill="currentColor" /></svg>
        ) : (
          <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 1.5h2.5v9H2.5zM7 1.5h2.5v9H7z" fill="currentColor" /></svg>
        )}
      </button>
    </>
  );
}

function Hero({ eventCount }) {
  return (
    <header id="home" className="hero hero--video">
      <HeroBackdrop />
      <div className="hero__content">
        <div className="hero__badge">{EDITION} National Level Technical Symposium · 2026</div>
        <img className="hero__logo" src={logo} alt="Techastra ’26 — VISION" />
        <h1 className="hero__title">Imagine. Innovate. Ignite.</h1>
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
          <Link className="btn-pill" to="/events?level=senior" data-log="home-hero-senior">Senior Registration</Link>
          <Link className="btn-ghost" to="/events?level=junior" data-log="home-hero-junior">Junior Registration</Link>
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
          <figcaption>Anna Block · Maduravoyal campus, Chennai</figcaption>
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
          <div className="tags mt-7">
            {["Senior (college) events", "Junior (school) events", "Team & solo events", "Technical & non-technical"].map((t) => (
              <span key={t} className="tag">{t}</span>
            ))}
          </div>
          <div className="techastra__ctas">
            <Link className="btn-small" to="/events?level=senior">Senior Registration</Link>
            <Link className="btn-ghost-sm" to="/events?level=junior">Junior Registration</Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function EventsPreview({ events, loading, items, inCart, onOpen, onToggle }) {
  const [level, setLevel] = useState(() => (items[0] ? levelOf(items[0]) : "senior"));
  const [cat, setCat] = useState("all");
  const list = events.filter((e) => levelOf(e) === level && (cat === "all" || categoryOf(e) === cat));
  const shown = list.slice(0, PREVIEW_COUNT);
  const label = `${LEVEL_LABEL[level]} · ${cat === "all" ? "All" : CATEGORY_LABEL[cat]}`;
  return (
    <section id="events" className="section events">
      <div className="wrap">
        <div className="events__head">
          <div>
            <div className="kicker">03 — Events</div>
            <h2 className="h2">{events.length ? `${events.length} ways to compete` : "Ways to compete"}</h2>
          </div>
          <EventFilters level={level} onLevel={setLevel} category={cat} onCategory={setCat} />
        </div>
        <div className="events__count">
          {loading
            ? "LOADING EVENTS…"
            : `${label.toUpperCase()} — ${list.length} EVENT${list.length === 1 ? "" : "S"} · FOR ${LEVEL_AUDIENCE[level].toUpperCase()}`}
        </div>
        <div className="events__grid">
          {shown.map((e) => (
            <EventCard key={e.id} event={e} inCart={inCart(e.id)} onOpen={onOpen} onToggle={onToggle} />
          ))}
        </div>
        {list.length > shown.length && (
          <div className="mt-10 text-center">
            <Link to={`/events?level=${level}`} className="btn-ghost" data-log="home-events-all">
              See all {list.length} {LEVEL_LABEL[level].toLowerCase()} {cat === "all" ? "" : CATEGORY_LABEL[cat].toLowerCase() + " "}events →
            </Link>
          </div>
        )}
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
    (a, b) => new Date(a.startTime) - new Date(b.startTime)
  );

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
        <div className="agenda">
          {list.length === 0 && <p className="schedule__note">No events scheduled for this day yet.</p>}
          {list.map((e) => (
            <button key={e.id} className="agenda__row" onClick={() => onOpen(e)}>
              <span className="agenda__time">{formatTimeRange(e)}</span>
              <div>
                <div className="agenda__title">{e.name}</div>
                <div className="agenda__where">
                  {e.venue || "Venue TBA"} · {e.track || teamLabel(e)}
                </div>
              </div>
              <span className="pill">{LEVEL_LABEL[levelOf(e)].toUpperCase()} · {CATEGORY_LABEL[categoryOf(e)].toUpperCase()}</span>
            </button>
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
          Senior events are open to college students and Junior events to school students — each
          registers separately. Pick your events, register as an individual or a team, and pay
          online. Reach out to the coordinators below for any queries.
        </p>
        <div className="contact__ctas">
          <Link className="btn-pill" to="/events?level=senior" data-log="home-contact-senior">Senior Registration</Link>
          <Link className="btn-ghost" to="/events?level=junior" data-log="home-contact-junior">Junior Registration</Link>
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

  return (
    <>
      <Hero eventCount={events.length} />
      <Ticker eventCount={events.length} />
      <About />
      <AboutTechastra eventCount={events.length} />
      <EventsPreview events={events} loading={loading} items={items} inCart={inCart} onOpen={modal.open} onToggle={toggle} />
      <Schedule events={events} onOpen={modal.open} />
      <Partners />
      <Contact />
      <EventModal event={modal.active} onClose={modal.close} inCart={modal.active && inCart(modal.active.id)} onToggle={toggle} />
    </>
  );
}
