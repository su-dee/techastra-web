import techastraLogo from "./assets/techastra-logo.webp";
import React, { Suspense, lazy, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  ArrowUpRight,
  ArrowRight,
  ArrowDown,
  Plus,
  X,
  Menu,
  ShieldCheck,
  Network,
  Check,
  Eye,
  EyeOff,
  LoaderCircle,
  LogOut,
  Zap,
  Layers,
  Lock,
  Pencil,
  Download,
} from "lucide-react";
import content from "./content.json";
import { api } from "./api.js";
import useScrollMotion from "./useScrollMotion";
import "./styles.css";
import "./motion.css";
import { to, currentPath, BASE } from "./base.js";

const Admin = lazy(() => import("./Admin.jsx"));
const PaymentPage = lazy(() =>
  import("./Payment.jsx").then((m) => ({ default: m.PaymentPage })),
);
const PassPage = lazy(() =>
  import("./Payment.jsx").then((m) => ({ default: m.PassPage })),
);

function Brand() {
  return (
    <a className="brand" href={to("/")} aria-label="Hack Nexus home">
      <span className="brand-symbol">
        N<span>↗</span>
      </span>
      <span>
        HACK<span className="brand-underscore">_</span>NEXUS
        <small>1.0 / CSE INNOVATION ALLIANCE</small>
      </span>
    </a>
  );
}
function Label({ children }) {
  return (
    <div className="eyebrow">
      <span className="tiny-cross">+</span>
      {children}
    </div>
  );
}
function NexusArt({ small = false }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current,
      ctx = canvas.getContext("2d");
    if (!ctx) return;
    let frame = 0,
      raf,
      visible = true,
      w = 0,
      h = 0;
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const resize = () => {
      const r = canvas.getBoundingClientRect();
      w = r.width;
      h = r.height;
      const d = Math.min(devicePixelRatio, 2);
      canvas.width = w * d;
      canvas.height = h * d;
      ctx.setTransform(d, 0, 0, d, 0, 0);
    };
    // Resizing clears the canvas; a static (reduced-motion) frame must be redrawn.
    const observer = new ResizeObserver(() => {
      resize();
      if (reduced) draw();
    });
    observer.observe(canvas);
    resize();
    const draw = () => {
      if (!visible) {
        raf = requestAnimationFrame(draw);
        return;
      }
      ctx.clearRect(0, 0, w, h);
      const time = frame * 0.002;
      const scale = Math.min(w, h) * 0.285;
      const glow = ctx.createRadialGradient(
        w * 0.5,
        h * 0.48,
        0,
        w * 0.5,
        h * 0.48,
        w * 0.43,
      );
      glow.addColorStop(0, "rgba(129,174,61,.07)");
      glow.addColorStop(1, "rgba(129,174,61,0)");
      ctx.fillStyle = glow;
      ctx.fillRect(0, 0, w, h);
      const project = (u, v) => {
        const r = 1.05 + 0.39 * Math.cos(v);
        const x = r * Math.cos(u),
          y = r * Math.sin(u),
          z = 0.39 * Math.sin(v);
        const a = 0.65 + Math.sin(time * 0.3) * 0.1;
        const yy = y * Math.cos(a) - z * Math.sin(a),
          zz = y * Math.sin(a) + z * Math.cos(a);
        const b = -0.6;
        return {
          x: w / 2 + (x * Math.cos(b) + yy * Math.sin(b)) * scale,
          y: h / 2 + (-x * Math.sin(b) + yy * Math.cos(b)) * 0.94 * scale,
          z: zz,
        };
      };
      for (let i = 0; i < 76; i++) {
        const u = (i / 76) * Math.PI * 2 + time;
        ctx.beginPath();
        let depth = 0;
        for (let j = 0; j <= 90; j++) {
          const v = (j / 90) * Math.PI * 2;
          const p = project(u + 0.19 * Math.sin(v + time), v);
          depth += p.z;
          j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        }
        ctx.strokeStyle = `rgba(186,229,120,${0.18 + (depth / 91 + 1) * 0.16})`;
        ctx.lineWidth = 0.65;
        ctx.stroke();
      }
      for (let i = 0; i < 22; i++) {
        const v = (i / 22) * Math.PI * 2;
        ctx.beginPath();
        for (let j = 0; j <= 140; j++) {
          const u = (j / 140) * Math.PI * 2 + time;
          const p = project(u + 0.19 * Math.sin(v + time), v);
          j ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y);
        }
        ctx.strokeStyle = "rgba(162,204,107,.25)";
        ctx.lineWidth = 0.5;
        ctx.stroke();
      }
      if (!reduced) {
        frame++;
        raf = requestAnimationFrame(draw);
      }
    };
    const onVisibility = () => {
      visible = !document.hidden;
    };
    document.addEventListener("visibilitychange", onVisibility);
    const intersect = new IntersectionObserver(([entry]) => {
      visible = entry.isIntersecting;
    });
    intersect.observe(canvas);
    draw();
    return () => {
      cancelAnimationFrame(raf);
      observer.disconnect();
      intersect.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, []);
  return (
    <div className={`nexus-art ${small ? "small" : ""}`} aria-hidden="true">
      <div className="art-grid" />
      <div className="orbit orbit-one" />
      <div className="orbit orbit-two" />
      <canvas ref={ref} />
      <div className="art-point point-a" />
      <div className="art-point point-b" />
      {!small && (
        <>
          <div className="art-caption">
            <span className="live-dot" /> THE NEXUS CORE
            <span>∞ POSSIBILITIES</span>
          </div>
          <span className="art-coordinate">CAR LAB & GARUDA LAB</span>
          <span className="art-note">IDEAS → IMPACT</span>
        </>
      )}
    </div>
  );
}
function HeroTerminal() {
  const [printed, setPrinted] = useState([]);
  const [active, setActive] = useState({ text: "", complete: false });
  useEffect(() => {
    const transcript = [
      "$ hacknexus --initialize",
      "> loading build systems ........ OK",
      "> problem statements ...... ON SPOT",
      "> challenge window ............ OPEN",
      "> ₹18,000 prize money .......... SET",
      "> assembling the next generation",
      "✓ SYSTEM READY · OCT 08, 2026",
      "$ await your signal_",
    ];
    const reducedMotion = matchMedia("(prefers-reduced-motion: reduce)");
    if (reducedMotion.matches) {
      setPrinted(transcript);
      setActive({ text: "", complete: true });
      return;
    }
    let line = 0;
    let char = 0;
    let timer;
    function tick() {
      const value = transcript[line];
      char += 1;
      setActive({ text: value.slice(0, char), complete: false });
      if (char >= value.length) {
        setPrinted((previous) => [...previous, value]);
        line += 1;
        char = 0;
        setActive({ text: "", complete: false });
        if (line === transcript.length) {
          setActive({ text: "", complete: true });
          return;
        }
        timer = setTimeout(tick, 210);
      } else {
        timer = setTimeout(tick, value[char] === " " ? 19 : 27);
      }
    }
    timer = setTimeout(tick, 260);
    return () => clearTimeout(timer);
  }, []);
  const visible = [...printed, ...(active.text ? [active.text] : [])];
  return (
    <div className="terminal-scene">
      <div className="terminal-scan" aria-hidden="true" />
      <div
        className="hero-terminal"
        role="img"
        aria-label="Animated HACK NEXUS terminal: problem statements revealed on the spot, ₹18,000 prize pool, October 8 2026."
      >
        <div className="terminal-chrome">
          <span className="terminal-lights" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
          <span>HACK_NEXUS — SHELL_01</span>
          <span className="terminal-live">
            <i /> OCT 08
          </span>
        </div>
        <div className="terminal-content" aria-hidden="true">
          <div className="terminal-session">
            CSE INNOVATION ALLIANCE <span> / SESSION 001</span>
          </div>
          <div className="terminal-output">
            {visible.map((line, index) => (
              <div
                className={`terminal-line ${line.startsWith("✓") ? "terminal-success" : ""}`}
                key={`${index}-${line}`}
              >
                <span className="terminal-gutter">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <span>{line}</span>
                {active.complete && index === visible.length - 1 && (
                  <i className="terminal-cursor" />
                )}
              </div>
            ))}
            {!active.complete && (
              <div className="terminal-line terminal-current">
                <span className="terminal-gutter">
                  {String(visible.length + 1).padStart(2, "0")}
                </span>
                <span className="terminal-cursor" />
              </div>
            )}
          </div>
          <div className="terminal-footer">
            <span>IST / 08 OCT 2026</span>
            <span>10 HOURS · INFINITE POSSIBILITIES</span>
          </div>
        </div>
      </div>
      <div className="terminal-caption">
        <span className="terminal-signal">✳</span>
        <span>THE NEXT BIG IDEA STARTS HERE.</span>
        <span>01 / ∞</span>
      </div>
      <span className="terminal-coordinate">
        BUILD SOMETHING THAT MATTERS <span>↗</span>
      </span>
    </div>
  );
}
function AssetLoader() {
  useEffect(() => {
    let mounted = true;
    const images = [...document.images].filter(
      (image) => image.loading !== "lazy",
    );
    const imageLoads = images.map((image) =>
      image.complete
        ? Promise.resolve()
        : new Promise((resolve) => {
            image.addEventListener("load", resolve, { once: true });
            image.addEventListener("error", resolve, { once: true });
          }),
    );
    Promise.allSettled([
      document.fonts.load('500 1em "Space Grotesk"'),
      document.fonts.load('400 1em "Manrope"'),
      ...imageLoads,
    ]).then(() => {
      if (mounted) {
        document.getElementById("root")?.removeAttribute("aria-busy");
        window.dispatchEvent(new Event("hn:assets-ready"));
      }
    });
    return () => {
      mounted = false;
    };
  }, []);
  return null;
}
function FlipDigit({ value }) {
  return (
    <strong key={value} className="countdown-digit" aria-hidden="true">
      {value}
    </strong>
  );
}
function Countdown() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);
  const left = Math.max(
    0,
    new Date("2026-10-08T09:30:00+05:30").getTime() - now,
  );
  const values = [86400000, 3600000, 60000, 1000].map((n, i) =>
    String(
      Math.floor(left / n) % (i === 0 ? 1000 : i === 1 ? 24 : 60),
    ).padStart(2, "0"),
  );
  const unitNames = ["days", "hours", "minutes", "seconds"];
  return (
    <div className="countdown">
      <div className="countdown-label">
        <span className="live-dot" />
        {left ? "THE COUNTDOWN TO CREATION" : "MISSION ACTIVE"}
      </div>
      <div
        className="countdown-numbers"
        role="timer"
        aria-label={values
          .map((value, i) => `${value} ${unitNames[i]}`)
          .join(", ")}
      >
        {[86400000, 3600000, 60000, 1000].map((_, i) => (
          <React.Fragment key={unitNames[i]}>
            {i > 0 && <span className="countdown-colon" aria-hidden="true">:</span>}
            <div>
              <FlipDigit value={values[i]} />
              <small>{["DAYS", "HOURS", "MINS", "SECS"][i]}</small>
            </div>
          </React.Fragment>
        ))}
      </div>
    </div>
  );
}
// Once a squad is registered, the header button leads to its next step.
function squadAction(registration) {
  if (!registration) return ["Register now", "#register"];
  if (registration.payment_status === "verified")
    return ["View ID cards", "/pass"];
  if (registration.payment_status === "submitted")
    return ["Payment status", "/payment"];
  return ["Complete payment", "/payment"];
}
function Header({ user, registration, onLogout }) {
  const [open, setOpen] = useState(false);
  const [actionLabel, actionHref] = squadAction(registration);
  return (
    <>
      <div className="announcement">
        <span className="live-dot" /> REGISTRATIONS ARE LIVE{" "}
        <span className="announcement-divider" aria-hidden="true">/</span>
        <span>OCTOBER 8–9, 2026</span>
        <a href="#register">
          YOUR NEXT BIG IDEA STARTS HERE <ArrowUpRight size={12} />
        </a>
      </div>
      <header>
        <div className="nav-inner">
          <Brand />
          <nav
            className={open ? "nav-links open" : "nav-links"}
            aria-label="Main navigation"
          >
            {[
              ["About", "about"],
              ["Challenge", "challenge"],
              ["Timeline", "timeline"],
              ["Prizes", "prizes"],
              ["FAQs", "faq"],
            ].map(([label, id]) => (
              <a key={id} href={`#${id}`} onClick={() => setOpen(false)}>
                {label}
              </a>
            ))}
          </nav>
          <div className="nav-actions">
            {user ? (
              <button
                className="login-link"
                onClick={onLogout}
                title={`Sign out ${user.username}`}
              >
                <LogOut size={15} />
                <span>Sign out</span>
              </button>
            ) : (
              <a className="login-link" href={to("/login")}>
                Log in <ArrowUpRight size={14} />
              </a>
            )}
            <a className="button primary nav-register" href={actionHref}>
              {actionLabel} <ArrowUpRight size={16} />
            </a>
            <button
              className="menu-toggle"
              onClick={() => setOpen(!open)}
              aria-label={open ? "Close menu" : "Open menu"}
              aria-expanded={open}
            >
              {open ? <X /> : <Menu />}
            </button>
          </div>
        </div>
      </header>
    </>
  );
}
function SectionHead({ number, kicker, title, accent, description }) {
  return (
    <div className="section-heading">
      <div>
        <Label>
          {number} / {kicker}
        </Label>
        <h2>
          {title} {accent && <span>{accent}</span>}
        </h2>
      </div>
      {description && <p>{description}</p>}
    </div>
  );
}
// Problem statements and tracks are revealed at the venue, not before.
function Challenges() {
  return (
    <section className="section challenges" id="challenge">
      <div className="container">
        <SectionHead
          number="02"
          kicker="THE CHALLENGE"
          title="Revealed on the spot."
          accent="Come ready for anything."
          description="Problem statements and tracks will be given on the spot, when the sprint begins on October 8."
        />
        <div className="domain-grid onspot-grid">
          {[
            [Lock, "Problem statements", "Announced at the venue as the 10-hour sprint starts. Nobody sees them before the event."],
            [Network, "Tracks", "The tracks are revealed with the problem statements. Pick yours on the day."],
            [Zap, "Be ready", "Bring your laptops, your stack and your squad. Ideas, design and code all happen in the room."],
          ].map(([Icon, title, text], i) => (
            <div className="domain-card" key={title}>
              <span className="domain-top">
                <Icon size={24} />
                <span>0{i + 1}</span>
              </span>
              <h3>{title}</h3>
              <p>{text}</p>
              <span className="domain-count">ON SPOT</span>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
// Times and venues from the organisers' event sheet (CAR Lab & Garuda Lab on
// Oct 8, 9:30 AM - 7:30 PM; finalist round Oct 9, 9:30 AM - 2:00 PM, Watson Lab).
const timeline = [
  [
    "08:30 AM",
    "OCT 08 · REPORT & CHECK IN",
    "Your squad. Your starting line.",
    "Check in, collect your badge, and set up your workstation. The 10-hour sprint starts at 9:30 AM.",
    "CAR Lab & Garuda Lab",
  ],
  [
    "11:00 AM",
    "REVIEW 1",
    "Turn your idea into a plan.",
    "Walk the mentors through your problem, architecture, data model, and plan for the sprint.",
    "CAR Lab & Garuda Lab",
  ],
  [
    "03:00 PM",
    "REVIEW 2",
    "Make the pieces work together.",
    "Show working APIs, database connections, and your first end-to-end user journey.",
    "CAR Lab & Garuda Lab",
  ],
  [
    "06:00 PM",
    "REVIEW 3",
    "Polish and get ready to present.",
    "Take your working prototype and user experience through the final technical review.",
    "CAR Lab & Garuda Lab",
  ],
  [
    "07:30 PM",
    "CODE FREEZE",
    "Submit what you built.",
    "Lock your repository and submit your final code. The squads shortlisted for the finalist round are announced.",
    "CAR Lab & Garuda Lab",
  ],
  [
    "09:30 AM",
    "OCT 09 · FINALIST ROUND",
    "Present to the industry panel.",
    "Shortlisted squads only. Each squad gives a 5-minute live demo of its prototype, followed by a 2-minute Q&A with the industry panel. Ends by 2:00 PM.",
    "Watson Lab",
  ],
];
function Timeline() {
  return (
    <section className="section" id="timeline">
      <div className="container timeline-layout">
        <div className="timeline-intro">
          <Label>03 / THE BUILD SPRINT</Label>
          <h2>
            Every hour{" "}
            <br />
            moves you{" "}
            <br />
            <span>forward.</span>
          </h2>
          <p>
            From the first spark to the final pitch.{" "}
            <br />
            Your mission, checkpoint by checkpoint.
          </p>
          <div className="timeline-date">
            <span className="live-dot" /> OCT 08–09, 2026{" "}
            <span>ALL TIMES IST</span>
          </div>
          <div className="sprint-note">
            <Zap size={18} />
            <div>
              <strong>Lunch and refreshments are provided.</strong>
              <p>
                The sprint clock keeps running, so take breaks in turns.
              </p>
            </div>
          </div>
        </div>
        <div className="timeline-list">
          {timeline.map(([time, tag, title, desc, venue], i) => (
            <div className="timeline-item" key={tag}>
              <span className="timeline-node">0{i + 1}</span>
              <div className="timeline-time">
                {time}
                <span>{tag}</span>
              </div>
              <h3>{title}</h3>
              <p>{desc}</p>
              <small>{venue}</small>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
function Prizes() {
  return (
    <section className="section prizes" id="prizes">
      <div className="container">
        <SectionHead
          number="04"
          kicker="BUILT TO BE REWARDED"
          title="Great ideas deserve"
          accent="a grand stage."
          description="₹18,000 in cash prizes for the top three squads, chosen by an industry panel in the finalist round."
        />
        <div className="prize-grid">
          {[
            {
              rank: "02",
              name: "First runner-up",
              amount: "5,000",
            },
            {
              rank: "01",
              name: "Grand champion",
              amount: "10,000",
            },
            {
              rank: "03",
              name: "Second runner-up",
              amount: "3,000",
            },
          ].map((p) => (
            <article
              className={`prize-card ${p.rank === "01" ? "champion" : ""}`}
              key={p.rank}
            >
              <div className="prize-top">
                <span className="mono">RANK / {p.rank}</span>
                {p.rank === "01" ? (
                  <span className="winner-star">✳</span>
                ) : (
                  <span className="rank-outline">{p.rank}</span>
                )}
              </div>
              <h3>{p.name}</h3>
              <div className="prize-amount">
                <span>₹</span>
                {p.amount}
              </div>
            </article>
          ))}
        </div>
        {/* Judging criteria from the organisers' event sheet. */}
        <div className="prize-judging">
          <h3>How squads are judged</h3>
          <ul>
            {["Innovation", "Technical implementation", "Functionality", "Problem-solving approach", "Presentation"].map((c) => (
              <li key={c}>{c}</li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}
function FAQ() {
  return (
    <section className="section faq-section" id="faq">
      <div className="container faq-layout">
        <div>
          <Label>05 / GOOD QUESTIONS</Label>
          <h2>
            A little clarity.{" "}
            <br />
            <span>A lot of potential.</span>
          </h2>
          <p>Everything you need before you step into the arena.</p>
          <a className="text-button" href="mailto:techastra@drmgrdu.ac.in">
            Still have a question? <ArrowUpRight size={16} />
          </a>
        </div>
        <div className="faq-list">
          {content.faqs.map((f, i) => (
            <details key={f.q}>
              <summary>
                <span className="faq-number">0{i + 1}</span>
                {f.q}
                <Plus size={18} className="faq-plus" />
              </summary>
              <p>{f.a}</p>
            </details>
          ))}
        </div>
      </div>
    </section>
  );
}
// Details for one squad member. Member 1 is the lead; their email field is
// the lead email (name="email") on the registration form, or read-only when
// editing later.
function MemberFields({ index, member = {}, leadEmail }) {
  const lead = index === 0;
  const field = (key) => `m${index}-${key}`;
  return (
    <fieldset className="member-card">
      <legend>
        <span className="mono">0{index + 1}</span>
        {lead ? "Squad lead" : `Member ${index + 1}`}
      </legend>
      <div className="member-grid">
        <label>
          Full name <span>*</span>
          <input
            name={field("fullName")}
            required
            minLength={2}
            maxLength={80}
            defaultValue={member.fullName}
            placeholder="As on college ID"
            autoComplete={lead ? "name" : "off"}
          />
        </label>
        <label>
          {lead ? "Lead email" : "Email"} <span>*</span>
          <input
            name={lead && leadEmail === undefined ? "email" : field("email")}
            type="email"
            required
            maxLength={254}
            pattern="[^@\s]+@[^@\s]+\.[^@\s]+"
            title="Enter a complete email address, such as name@university.edu."
            defaultValue={lead ? leadEmail : member.email}
            readOnly={lead && leadEmail !== undefined}
            placeholder={lead ? "lead@university.edu" : "name@university.edu"}
            autoComplete={lead ? "email" : "off"}
          />
          {lead && (
            <small>
              {leadEmail === undefined
                ? "Registration and payment emails are sent here."
                : "Contact the organisers to change the lead email."}
            </small>
          )}
        </label>
        <label>
          Mobile number <span>*</span>
          <input
            name={field("phone")}
            type="tel"
            required
            inputMode="numeric"
            pattern="(\+?91[ \-]?|0)?[6-9][0-9]{4}[ \-]?[0-9]{5}"
            title="Enter a 10-digit Indian mobile number, such as 9876543210."
            defaultValue={member.phone}
            placeholder="9876543210"
            autoComplete={lead ? "tel-national" : "off"}
          />
        </label>
        <label>
          College <span>*</span>
          <input
            name={field("college")}
            required
            minLength={2}
            maxLength={120}
            defaultValue={member.college}
            placeholder="College or university"
          />
        </label>
      </div>
    </fieldset>
  );
}
// Reads MemberFields values back out of a submitted form.
const membersFromForm = (form, size) =>
  Array.from({ length: size }, (_, i) => ({
    fullName: form.get(`m${i}-fullName`),
    email: i === 0 ? form.get("email") || "" : form.get(`m${i}-email`),
    phone: form.get(`m${i}-phone`),
    college: form.get(`m${i}-college`),
  }));
// Member list on the registration card, with an editor for the lead.
// Participation certificates, once the organisers release them (they arrive
// as registration.certificates for a checked-in squad).
function SquadCertificates({ registration }) {
  const certificates = registration.certificates;
  if (!certificates?.length) return null;
  const href = (which) => `${BASE}/api/registrations/me/certificates/${which}`;
  return (
    <div className="squad-members squad-certificates">
      <div className="squad-members-head">
        <h4>Participation certificates</h4>
        {certificates.length > 1 && (
          <a className="text-button" href={href("all")} download>
            <Download size={13} /> Download all
          </a>
        )}
      </div>
      <ol>
        {certificates.map((c) => (
          <li key={c.position}>
            <strong>
              {c.name}
              {c.position === 1 && <em>Lead</em>}
            </strong>
            <a className="text-button" href={href(c.position)} download>
              <Download size={13} /> Download certificate
            </a>
          </li>
        ))}
      </ol>
    </div>
  );
}

function SquadMembers({ registration, onSaved }) {
  const members = registration.members || [];
  const [editing, setEditing] = useState(false),
    [saving, setSaving] = useState(false),
    [error, setError] = useState("");
  const locked = Boolean(registration.checked_in_at);
  async function save(e) {
    e.preventDefault();
    setSaving(true);
    setError("");
    try {
      const data = await api("/registrations/me/members", {
        method: "PUT",
        body: {
          members: membersFromForm(
            new FormData(e.target),
            registration.squad_size,
          ),
        },
      });
      onSaved(data.members);
      setEditing(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  if (editing)
    return (
      <form className="members-editor" onSubmit={save}>
        <fieldset disabled={saving}>
          {Array.from({ length: registration.squad_size }, (_, i) => (
            <MemberFields
              key={i}
              index={i}
              member={members[i]}
              leadEmail={i === 0 ? registration.lead_email : undefined}
            />
          ))}
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className="members-actions">
            <button className="button primary" type="submit">
              {saving ? "Saving…" : "Save member details"}
              {saving ? (
                <LoaderCircle size={16} className="spin" />
              ) : (
                <Check size={16} />
              )}
            </button>
            <button
              className="button ghost"
              type="button"
              onClick={() => {
                setEditing(false);
                setError("");
              }}
            >
              Cancel
            </button>
          </div>
        </fieldset>
      </form>
    );
  return (
    <div className="squad-members">
      <div className="squad-members-head">
        <h4>Squad members</h4>
        {!locked && (
          <button
            className="text-button"
            type="button"
            onClick={() => setEditing(true)}
          >
            <Pencil size={13} />
            {members.length ? "Edit" : "Add member details"}
          </button>
        )}
      </div>
      {members.length ? (
        <ol>
          {members.map((m) => (
            <li key={m.position}>
              <strong>
                {m.fullName}
                {m.position === 1 && <em>Lead</em>}
              </strong>
              <span>{m.college}</span>
              <span>
                {m.email} · {m.phone}
              </span>
            </li>
          ))}
        </ol>
      ) : (
        <p className="small-muted">
          Add the name, email, mobile number and college of all{" "}
          {registration.squad_size} members so organisers can prepare your
          squad’s check-in.
        </p>
      )}
    </div>
  );
}
function Registration({
  user,
  registration,
  setRegistration,
  authError,
}) {
  const [loading, setLoading] = useState(false),
    [checking, setChecking] = useState(false),
    [error, setError] = useState(""),
    // Squads have 2 or 3 builders (the server enforces it too).
    [squadSize, setSquadSize] = useState(3);
  useEffect(() => {
    let active = true;
    if (user) {
      setChecking(true);
      api("/registrations/me")
        .then((d) => {
          if (active) setRegistration(d.registration);
        })
        .catch((e) => {
          if (active) setError(e.message);
        })
        .finally(() => {
          if (active) setChecking(false);
        });
    } else setRegistration(null);
    return () => {
      active = false;
    };
  }, [user]);
  // Pick up organizer decisions (payment verified, status changes) when the
  // participant returns to the tab.
  useEffect(() => {
    if (!user) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        api("/registrations/me")
          .then((d) => setRegistration(d.registration))
          .catch(() => {});
    };
    document.addEventListener("visibilitychange", refresh);
    return () => document.removeEventListener("visibilitychange", refresh);
  }, [user]);
  async function submit(e) {
    e.preventDefault();
    if (!user) {
      location.href = to("/login?next=register");
      return;
    }
    setLoading(true);
    setError("");
    const form = new FormData(e.target);
    try {
      const data = await api("/registrations", {
        method: "POST",
        body: {
          teamName: form.get("teamName"),
          email: form.get("email"),
          squadSize,
          abstract: form.get("abstract"),
          conductAccepted: form.get("conduct") === "on",
          members: membersFromForm(form, squadSize),
        },
      });
      setRegistration(data.registration);
      // Registration is saved; payment completes the squad's place.
      location.href = to("/payment");
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  }
  return (
    <section className="section register-section" id="register">
      <div className="container register-layout">
        <div className="register-intro">
          <Label>06 / YOUR NEXT CHAPTER</Label>
          <h2>
            Bring your squad.{" "}
            <br />
            Bring your ambition.{" "}
            <br />
            <span>Build your legacy.</span>
          </h2>
          <p>
            Two or three builders. One shared vision.{" "}
            <br />
            Your place at HACK_NEXUS 1.0 starts here.
          </p>
          <div className="register-meta">
            <span>08–09 OCTOBER 2026</span>
            <span>CAR LAB & GARUDA LAB</span>
            <span>₹1,000 PER SQUAD</span>
          </div>
          <div className="register-mark" aria-hidden="true">
            N↗
          </div>
        </div>
        <div className="registration-panel">
          {registration ? (
            <div className="registration-success" role="status">
              <span className="success-icon">
                <Check size={30} />
              </span>
              <Label>REGISTRATION CONFIRMED</Label>
              <h3>
                You’re in,{" "}
                <br />
                {registration.team_name}.
              </h3>
              <p>Your squad is registered for HACK_NEXUS 1.0.</p>
              <dl>
                <div>
                  <dt>Squad size</dt>
                  <dd>{registration.squad_size} builders</dd>
                </div>
                <div>
                  <dt>Lead email</dt>
                  <dd>{registration.lead_email}</dd>
                </div>
                <div>
                  <dt>Status</dt>
                  <dd>
                    {statusLabels[registration.status] || "Pending review"}
                  </dd>
                </div>
                <div>
                  <dt>Payment</dt>
                  <dd>
                    {paymentLabels[registration.payment_status] ||
                      "Not paid yet"}
                  </dd>
                </div>
              </dl>
              <SquadMembers
                registration={registration}
                onSaved={(members) =>
                  setRegistration((r) => ({ ...r, members }))
                }
              />
              <SquadCertificates registration={registration} />
              {registration.payment_status === "verified" ? (
                <a className="button primary registration-cta" href={to("/pass")}>
                  View squad ID card <ArrowUpRight size={18} />
                </a>
              ) : registration.payment_status === "submitted" ? (
                <a className="button ghost registration-cta" href={to("/payment")}>
                  View payment status <ArrowUpRight size={18} />
                </a>
              ) : (
                <a className="button primary registration-cta" href={to("/payment")}>
                  {registration.payment_status === "rejected"
                    ? "Resubmit payment"
                    : "Complete payment · ₹1,000"}{" "}
                  <ArrowUpRight size={18} />
                </a>
              )}
              <small>Registration ID:</small>
              <code>{registration.id}</code>
              <p className="small-muted">
                Report at 8:30 AM IST on October 8. Contact
                techastra@drmgrdu.ac.in for registration changes.
              </p>
            </div>
          ) : (
            <>
              <div className="form-heading">
                <h3>Squad registration</h3>
                <span className="mono">HACK_NEXUS / 1.0</span>
              </div>
              {!user && (
                <div className="sign-in-notice">
                  {authError ||
                    "Create an account or sign in to reserve your squad’s place."}
                  <a href={to("/login?next=register")}>
                    Sign in <ArrowUpRight size={14} />
                  </a>
                </div>
              )}
              <form onSubmit={submit}>
                <fieldset disabled={loading || checking}>
                  <label>
                    Team call-sign <span>*</span>
                    <input
                      name="teamName"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern=".*\S.*\S.*\S.*"
                      title="Use at least 3 letters or numbers."
                      placeholder="e.g. SPIDER_BYTE_OPS"
                    />
                  </label>
                  <div className="form-row">
                    <label>
                      Squad size
                      <select
                        name="squadSize"
                        value={squadSize}
                        onChange={(e) => setSquadSize(Number(e.target.value))}
                        aria-describedby="squad-size-note"
                      >
                        <option value="2">2 builders</option>
                        <option value="3">3 builders</option>
                      </select>
                      <small id="squad-size-note">2 or 3 builders, including the lead.</small>
                    </label>
                  </div>
                  <div className="members-block">
                    <p className="members-title">
                      Squad members <span>{squadSize} builders</span>
                    </p>
                    {Array.from({ length: squadSize }, (_, i) => (
                      <MemberFields key={i} index={i} />
                    ))}
                  </div>
                  <label>
                    Your big idea <span className="optional">OPTIONAL</span>
                    <textarea
                      name="abstract"
                      rows={3}
                      maxLength={3000}
                      placeholder="A few words about what you want to build…"
                    />
                  </label>
                  <label className="checkbox-label">
                    <input name="conduct" type="checkbox" required />
                    <span>
                      We agree to the{" "}
                      <a
                        href={to("/policies#conduct")}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Code of Conduct
                      </a>{" "}
                      and the 10-hour clean sprint rules.
                    </span>
                  </label>
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button
                    className="button primary submit-button"
                    type="submit"
                  >
                    {loading
                      ? "Registering your squad…"
                      : checking
                        ? "Checking registration…"
                        : user
                          ? "Register your squad"
                          : "Sign in to register"}
                    {loading || checking ? (
                      <LoaderCircle size={18} className="spin" />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </button>
                  <p className="form-footnote">
                    <ShieldCheck size={13} /> Your next big idea is in good
                    company.
                  </p>
                </fieldset>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
const paymentLabels = {
  submitted: "Submitted · awaiting verification",
  verified: "Verified",
  rejected: "Rejected · please resubmit",
};
const statusLabels = {
  pending: "Pending review",
  approved: "Approved",
  waitlisted: "Waitlisted",
  rejected: "Not selected",
};
function Footer() {
  return (
    <footer>
      <div className="container">
        <div className="footer-top">
          <div>
            <Brand />
            <p>
              With great power comes{" "}
              <br />
              great innovation.
            </p>
            <div className="footer-parent">
              <span className="mono">PART OF</span>
              <img
                src={techastraLogo}
                alt="Techastra '26 - 18th National Level Technical Symposium"
                width="900"
                height="335"
                loading="lazy"
              />
              <small>
                Department of Computer Science and Engineering &amp; Department
                of Cyber Security
              </small>
            </div>
          </div>
          <div>
            <span className="mono">EXPLORE</span>
            <a href={to("/#about")}>The alliance</a>
            <a href={to("/#challenge")}>The challenge</a>
            <a href={to("/#timeline")}>Mission timeline</a>
            <a href={to("/#prizes")}>Prizes & recognition</a>
          </div>
          <div>
            <span className="mono">COORDINATORS</span>
            {[
              ["Dr. F. Antony Xavier Bronson", "Faculty coordinator", "+919841302602", "+91 98413 02602"],
              ["Dr. M. Anand", "Faculty coordinator", "+919600686861", "+91 96006 86861"],
              ["Sudeep Krishna", "Student coordinator", "+919176327870", "+91 91763 27870"],
              ["Kishore Kumar", "Student coordinator", "+919499971978", "+91 94999 71978"],
              ["Sriram", "Student coordinator", "+919363352887", "+91 93633 52887"],
            ].map(([name, role, tel, shown]) => (
              <p className="footer-person" key={name}>
                {name}
                <small>
                  {role} · <a href={`tel:${tel}`}>{shown}</a>
                </small>
              </p>
            ))}
          </div>
          <div>
            <span className="mono">LET’S CONNECT</span>
            <a href="mailto:techastra@drmgrdu.ac.in">
              techastra@drmgrdu.ac.in <ArrowUpRight size={13} />
            </a>
            <a
              href="https://www.instagram.com/mgreri_cse/"
              target="_blank"
              rel="noreferrer"
            >
              Follow us on Instagram <ArrowUpRight size={13} />
            </a>
            <p>
              CAR Lab (2nd Floor, Anna Block) & Garuda Lab,{" "}
              <br />
              Main Campus. Finalist round: Watson Lab.
            </p>
          </div>
        </div>
        <div className="footer-bottom">
          <span>© 2026 DEPARTMENT OF COMPUTER SCIENCE & ENGINEERING · DEPARTMENT OF CYBER SECURITY</span>
          <div>
            <a href={to("/policies#conduct")}>Code of conduct</a>
            <a href={to("/policies#safety")}>Lab safety</a>
            <a href={to("/policies#privacy")}>Privacy</a>
            <a href="#" aria-label="Back to top">
              BACK TO TOP ↑
            </a>
          </div>
        </div>
        <div className="footer-wordmark" aria-hidden="true">
          HACK_NEXUS<span>1.0</span>
        </div>
      </div>
    </footer>
  );
}
function Home({ user, authError, onLogout }) {
  const motionRef = useScrollMotion();
  // Shared by the header button and the registration section.
  const [registration, setRegistration] = useState(null);
  return (
    <div ref={motionRef} className="home-page">
      <div className="scroll-progress" aria-hidden="true" />
      <Header user={user} registration={registration} onLogout={onLogout} />
      <main>
        <section className="hero" id="hero">
          <div className="container hero-inner">
            <div className="hero-topline">
              <span className="mono">NATIONAL LEVEL MAKE-A-THON</span>
              <span className="mono">
                NEW IDEAS. REAL IMPACT. <span className="tiny-cross">+</span>
              </span>
            </div>
            <div className="hero-presenter">
              <img
                className="presenter-logo"
                src={techastraLogo}
                alt="Techastra '26 - 18th National Level Technical Symposium"
                width="900"
                height="335"
              />
              <p>
                Department of Computer Science and Engineering &amp; Department
                of Cyber Security presents
              </p>
              <div className="hero-wordmark">
                HACK<span className="brand-underscore">_</span>NEXUS
                <small>1.0</small>
              </div>
            </div>
            <div className="hero-content">
              <div className="hero-copy">
                <div className="hero-badge">
                  <span className="live-dot" /> OCTOBER 8—9, 2026{" "}
                  <span>EDITION 01</span>
                </div>
                <h1>
                  Anyone can{" "}
                  <br />
                  wear the mask.{" "}
                  <br />
                  <span>Will you?</span>
                </h1>
                <p>
                  10 hours. Infinite possibilities.{" "}
                  <br />
                  An arena for the builders, the thinkers, and the
                  <br className="desktop-break" /> ones who dare to create
                  beyond limits.
                </p>
                <div className="hero-actions">
                  <a className="button primary" href="#register">
                    Enter the arena <ArrowUpRight size={19} />
                  </a>
                  <a className="button ghost" href="#challenge">
                    The challenge <ArrowRight size={18} />
                  </a>
                </div>
              </div>
              <div className="hero-visual">
                <HeroTerminal />
              </div>
            </div>
            <div className="hero-bottom">
              <Countdown />
              <div className="hero-bottom-note">
                <span>
                  A LITTLE PRESSURE.{" "}
                  <br />A LOT OF POSSIBILITY.
                </span>
                <a href="#about" aria-label="Discover the event">
                  <ArrowDown size={20} />
                </a>
              </div>
            </div>
          </div>
        </section>
        <div className="stats-strip">
          <div className="container">
            {[
              ["10", "HOURS TO BUILD"],
              ["2–3", "BUILDERS PER SQUAD"],
              ["₹18K", "TOTAL PRIZE MONEY"],
            ].map(([v, l]) => (
              <div key={l}>
                <strong>{v}</strong>
                <span>{l}</span>
              </div>
            ))}
          </div>
        </div>
        <section className="section about" id="about">
          <div className="container">
            <Label>01 / THE ALLIANCE</Label>
            <div className="about-layout">
              <h2>
                Ideas are everywhere.{" "}
                <br />
                <span>
                  Builders make{" "}
                  <br />
                  the difference.
                </span>
              </h2>
              <div>
                <p className="about-lead">
                  A meeting point for curious minds.{" "}
                  <br />A proving ground for bold ideas.
                </p>
                <p>
                  HACK_NEXUS 1.0 brings students from colleges across India
                  together for ten hours of building, in squads of two or three.
                  Take on real-world problems and turn the “what if” into
                  something that works.
                </p>
                <p>
                  Hosted by the Department of Computer Science & Engineering.
                  Powered by a community that believes anyone can wear the mask.
                </p>
                <div className="pillars">
                  <span>
                    <Zap size={16} /> Build.
                  </span>
                  <span>
                    <Network size={16} /> Compete.
                  </span>
                  <span>
                    <Layers size={16} /> Innovate.
                  </span>
                </div>
              </div>
            </div>
          </div>
        </section>
        <Challenges />
        <Timeline />
        <Prizes />
        <FAQ />
        <Registration
          user={user}
          registration={registration}
          setRegistration={setRegistration}
          authError={authError}
        />
      </main>
      <Footer />
    </div>
  );
}
// Where to go after signing in; only known in-app destinations are allowed.
function nextPath() {
  const next = new URLSearchParams(location.search).get("next");
  return next === "payment"
    ? "/payment"
    : next === "pass"
      ? "/pass"
      : "/#register";
}
function PasswordField({ label, name, autoComplete, hint, minLength }) {
  const [show, setShow] = useState(false);
  return (
    <label>
      {label}
      <div className="password-input">
        <input
          name={name}
          type={show ? "text" : "password"}
          required
          minLength={minLength}
          maxLength={128}
          autoComplete={autoComplete}
        />
        <button
          type="button"
          onClick={() => setShow(!show)}
          aria-label={
            show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`
          }
        >
          {show ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </div>
      {hint && <small>{hint}</small>}
    </label>
  );
}
// Choosing a new password: required after signing in with a mobile number or
// an organizer's temporary password, optional otherwise.
function SetPasswordForm({ currentPassword, onDone }) {
  const [error, setError] = useState(""),
    [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    const data = new FormData(e.target);
    if (data.get("newPassword") !== data.get("confirmPassword")) {
      setError("The two new passwords don’t match.");
      return;
    }
    setBusy(true);
    setError("");
    try {
      const response = await api("/auth/password", {
        method: "POST",
        body: {
          currentPassword: currentPassword ?? data.get("currentPassword"),
          newPassword: data.get("newPassword"),
        },
      });
      onDone(response.user);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <form className="auth-set-password" onSubmit={submit}>
      <fieldset disabled={busy}>
        {currentPassword === undefined && (
          <PasswordField
            label="Current password"
            name="currentPassword"
            autoComplete="current-password"
            hint="Your mobile number, if you haven’t chosen a password yet."
          />
        )}
        <PasswordField
          label="New password"
          name="newPassword"
          autoComplete="new-password"
          minLength={8}
          hint="At least 8 characters. Don’t use your mobile number."
        />
        <PasswordField
          label="Confirm new password"
          name="confirmPassword"
          autoComplete="new-password"
          minLength={8}
        />
        {error && (
          <p className="form-error" role="alert">
            {error}
          </p>
        )}
        <button className="button primary submit-button">
          {busy ? "Saving…" : "Save password"}
          {busy ? (
            <LoaderCircle className="spin" size={18} />
          ) : (
            <ArrowUpRight size={18} />
          )}
        </button>
      </fieldset>
    </form>
  );
}
function Login({ user, onAuth }) {
  const formRef = useRef(null);
  const [mode, setMode] = useState("login"),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    // The password just used to sign in, so it isn't asked for twice.
    [justUsed, setJustUsed] = useState(undefined),
    [changing, setChanging] = useState(false);
  useEffect(() => {
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const animation = formRef.current?.animate(
      [
        { opacity: 0, transform: "translateY(12px)" },
        { opacity: 1, transform: "translateY(0)" },
      ],
      { duration: 350, easing: "cubic-bezier(0.22, 1, 0.36, 1)" },
    );
    return () => animation?.cancel();
  }, [mode]);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const data = new FormData(e.target);
    try {
      const response = await api(`/auth/${mode}`, {
        method: "POST",
        body: {
          username: data.get("username"),
          password: data.get("password"),
        },
      });
      if (response.user.mustSetPassword) {
        setJustUsed(data.get("password"));
        onAuth(response.user);
        setBusy(false);
        return;
      }
      onAuth(response.user);
      location.href = to(nextPath());
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  const mustSet = user?.mustSetPassword;
  const settingPassword = mustSet || changing;
  return (
    <main className="auth-page">
      <div className="auth-art-panel">
        <Brand />
        <div className="auth-art">
          <NexusArt small />
        </div>
        <div className="auth-manifesto">
          <Label>YOUR NEXT CHAPTER STARTS HERE</Label>
          <h1>
            The next big thing{" "}
            <br />
            could start{" "}
            <br />
            <span>with you.</span>
          </h1>
          <p>10 hours. One arena. Infinite possibilities.</p>
        </div>
        <div className="auth-panel-foot">
          <span>OCTOBER 8–9, 2026</span>
          <span>HACK_NEXUS / 1.0</span>
        </div>
      </div>
      <div className="auth-form-panel">
        <a className="back-link" href={to("/")}>
          ← Back to the arena
        </a>
        <div className="auth-form-wrap">
          <Label>THE BUILDER’S PORTAL</Label>
          <h2>
            {mustSet
              ? "Choose a password."
              : changing
                ? "Change your password."
                : user
                  ? "You’re connected."
                  : mode === "login"
                    ? "Welcome back."
                    : "Make your first move."}
          </h2>
          <p>
            {mustSet
              ? `Signed in as ${user.username}. Set your own password to keep your account safe; you’ll use it from now on.`
              : changing
                ? `Signed in as ${user.username}. Other devices will be signed out.`
                : user
                  ? `Signed in as ${user.username}. Your squad is waiting.`
                  : mode === "login"
                    ? "Your next breakthrough is waiting."
                    : "Create your account. Find your squad. Start building."}
          </p>
          {settingPassword ? (
            <SetPasswordForm
              currentPassword={mustSet ? justUsed : undefined}
              onDone={(updated) => {
                onAuth(updated);
                location.href = to(nextPath());
              }}
            />
          ) : user ? (
            <div className="auth-connected">
              <a className="button primary" href={nextPath()}>
                Continue <ArrowUpRight size={18} />
              </a>
              <button
                type="button"
                className="auth-text-button"
                onClick={() => setChanging(true)}
              >
                Change password
              </button>
            </div>
          ) : (
            <>
              <div className="auth-tabs">
                <button
                  className={mode === "login" ? "active" : ""}
                  onClick={() => {
                    setMode("login");
                    setError("");
                  }}
                >
                  Log in
                </button>
                <button
                  className={mode === "signup" ? "active" : ""}
                  onClick={() => {
                    setMode("signup");
                    setError("");
                  }}
                >
                  Create account
                </button>
              </div>
              <form ref={formRef} onSubmit={submit}>
                <fieldset disabled={busy}>
                  <label>
                    Username
                    <input
                      name="username"
                      required
                      minLength={3}
                      maxLength={30}
                      pattern="[A-Za-z0-9_]{3,30}"
                      autoComplete="username"
                      placeholder="Your builder identity"
                    />
                    <small>3–30 letters, numbers, or underscores.</small>
                  </label>
                  <PasswordField
                    key={mode}
                    label="Password"
                    name="password"
                    autoComplete={
                      mode === "login" ? "current-password" : "new-password"
                    }
                    minLength={mode === "signup" ? 8 : undefined}
                    hint={
                      mode === "login"
                        ? "Created your account with a mobile number? Enter that number here."
                        : "At least 8 characters. Don’t use your mobile number."
                    }
                  />
                  {error && (
                    <p className="form-error" role="alert">
                      {error}
                    </p>
                  )}
                  <button className="button primary submit-button">
                    {busy
                      ? "Connecting…"
                      : mode === "login"
                        ? "Enter your portal"
                        : "Create your account"}
                    {busy ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <ArrowUpRight size={18} />
                    )}
                  </button>
                </fieldset>
              </form>
              <p className="auth-privacy">
                <ShieldCheck size={14} /> Forgot your password? Ask the crew to
                reset it.
              </p>
            </>
          )}
          <div className="auth-help">
            Need a hand?{" "}
            <a href="mailto:techastra@drmgrdu.ac.in">
              Contact the crew <ArrowUpRight size={13} />
            </a>
          </div>
        </div>
        <span className="auth-copyright">
          © 2026 HACK_NEXUS / CSE INNOVATION ALLIANCE
        </span>
      </div>
    </main>
  );
}
function Policies() {
  return (
    <>
      <div className="container policy-nav">
        <Brand />
        <a href={to("/")}>← Back to the arena</a>
      </div>
      <main className="container policy-page">
        <Label>EVENT GUIDELINES</Label>
        <h1>Build with respect.</h1>
        <section id="conduct">
          <h2>Code of conduct</h2>
          <p>
            Respect fellow participants, mentors, staff, and shared equipment.
            Harassment, discrimination, plagiarism, or interference with other
            teams is not permitted. Squads must contain 2 or 3 enrolled
            undergraduate or postgraduate students.
          </p>
          <p>
            Write all core problem logic during the event sprint. Open-source
            libraries, UI components, and framework scaffolds are allowed.
            Attribute external resources and follow their licenses. Follow
            organizer instructions and the published review checkpoints.
          </p>
        </section>
        <section id="safety">
          <h2>Lab safety</h2>
          <p>
            Use assigned workstations and approved equipment. Keep food and
            drinks away from electrical equipment and work surfaces. Ask a
            mentor before modifying hardware, cabling, or power connections.
            Report safety concerns to event staff immediately.
          </p>
        </section>
        <section id="privacy">
          <h2>Privacy protocol</h2>
          <p>
            Account creation stores your username, a salted hash of your
            password, and a creation timestamp. Registration stores your team
            name, lead email, squad size, each member’s name, email, mobile
            number and college, optional project abstract, and code of conduct acceptance. Payment submission stores
            the UPI transaction ID and the payment screenshot you upload; only
            organizers can view them, to verify the ₹1,000 team fee. Verified
            squads receive an ID card whose QR code is used to record attendance
            at check-in.
          </p>
          <p>
            Your password is stored only as a salted hash; organizers cannot see
            it, but they can issue a temporary one if you forget it. A
            necessary, HTTP-only session cookie keeps you signed in for up to
            seven days. Registration information is used to coordinate the
            event; the application does not sell data or use advertising
            trackers.
          </p>
          <p>
            Contact{" "}
            <a href="mailto:techastra@drmgrdu.ac.in">techastra@drmgrdu.ac.in</a>{" "}
            for access, correction, deletion, and event policy questions.
          </p>
        </section>
      </main>
      <Footer />
    </>
  );
}
function App() {
  const [user, setUser] = useState(null),
    [authError, setAuthError] = useState("");
  useEffect(() => {
    // The browser tries the hash before React renders, so jump to it afterwards.
    try {
      const id = decodeURIComponent(location.hash.slice(1));
      if (id)
        document.getElementById(id)?.scrollIntoView({ behavior: "instant" });
    } catch {}
  }, []);
  useEffect(() => {
    api("/auth/me")
      .then((d) => {
        setUser(d.user);
        // Accounts on a mobile-number or temporary password choose one first.
        const next = { "/payment": "payment", "/pass": "pass" }[
          currentPath()
        ];
        if (d.user.mustSetPassword && currentPath() !== "/login")
          location.replace(to(next ? `/login?next=${next}` : "/login"));
      })
      .catch((e) => {
        if (e.status !== 401) setAuthError(e.message);
      });
  }, []);
  async function logout() {
    try {
      await api("/auth/logout", { method: "POST" });
      setUser(null);
    } catch (e) {
      setAuthError(e.message);
    }
  }
  return (
    <>
      <a href="#main-content" className="skip-link">
        Skip to content
      </a>
      <AssetLoader />
      <div id="main-content" tabIndex={-1}>
        {currentPath() === "/admin" ? (
          <Suspense
            fallback={<p className="admin-loading">Loading admin console…</p>}
          >
            <Admin />
          </Suspense>
        ) : ["/payment", "/pass"].includes(currentPath()) ? (
          <Suspense fallback={<p className="admin-loading">Loading…</p>}>
            {currentPath() === "/payment" ? <PaymentPage /> : <PassPage />}
          </Suspense>
        ) : currentPath() === "/login" ? (
          <Login user={user} onAuth={setUser} />
        ) : currentPath() === "/policies" ? (
          <Policies />
        ) : (
          <Home user={user} authError={authError} onLogout={logout} />
        )}
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
