import React, { useEffect, useMemo, useRef, useState } from "react";
import { Link } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import Card from "../components/ui/Card";
import { Textarea, Select } from "../components/ui/Input";
import ParticipantIDCard from "../components/ParticipantIDCard";
import { formatDay, formatFee, formatTimeRange, teamLabel } from "../components/EventInfo";
import { downloadIdCard as saveIdCard, printIdCard } from "../lib/idCardExport";
import { idCardVerifyUrl } from "../lib/idCard";
import { CATEGORY_LABEL, categoryOf } from "../lib/site";
import ApprovalHero from "../components/dashboard/ApprovalHero";
import TeamCard from "../components/dashboard/TeamCard";
import CertificateNames from "../components/dashboard/CertificateNames";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";
import { usePanels } from "../context/PanelContext";

// One-time-per-user welcome screen: localStorage (not a query param or
// plain in-memory state) since the requirement is "don't show this again
// on a FUTURE LOGIN" - a fresh login is a fresh page load, wiping any
// plain useState flag, and a query param would need every link that ever
// leads to /dashboard to remember to append/strip it. localStorage
// naturally persists across sessions and is keyed per-user (not global)
// so a shared/kiosk browser correctly re-shows the moment for a
// DIFFERENT participant logging in afterward.
function welcomeSeenKey(userId) {
  return `techastra_welcome_seen_${userId}`;
}

const PLACE = { 1: "1st place", 2: "2nd place", 3: "3rd place" };
const MEAL_LABEL = { breakfast: "Breakfast", lunch: "Lunch", snacks: "Snacks" };
const PAY_METHOD = { upi: "UPI", razorpay: "Online", cash: "Cash" };

const when = (iso) =>
  new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" });

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

function Section({ id, title, action, children, className = "" }) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className={className}>
      <div className="flex items-baseline justify-between gap-3 mb-3">
        <h2 id={`${id}-title`} className="mono-label">{title}</h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function Fact({ label, wide = false, children }) {
  return (
    <div className={"fact" + (wide ? " col-span-2" : "")}>
      <div className="mono-label">{label}</div>
      <div className="break-words">{children}</div>
    </div>
  );
}

/** Top-of-page card: what state the registration is in and what to do next. */
function StatusPanel({ registration, email, onHelp }) {
  const { status, rejectionReason, registrationCode, totalAmount } = registration;
  if (status === "rejected") {
    // Free (Junior) registrations have no payment to resubmit.
    if (!(totalAmount > 0)) {
      return (
        <Card className="!border-danger/40">
          <Badge status="rejected" />
          <h2 className="h3 !mt-3">Your registration was not accepted</h2>
          {rejectionReason && <p className="text-sm text-danger mt-2">Reason: {rejectionReason}</p>}
          <button type="button" className="btn-ghost-sm mt-5" onClick={onHelp}>
            Think this is a mistake? Ask the Help Desk
          </button>
        </Card>
      );
    }
    return (
      <Card className="!border-danger/40">
        <Badge status="rejected" />
        <h2 className="h3 !mt-3">Your registration needs a fix</h2>
        {rejectionReason && <p className="text-sm text-danger mt-2">Reason: {rejectionReason}</p>}
        <p className="text-sm text-soft mt-2">Correct the payment details and resubmit - your registration code stays the same.</p>
        <Link
          to={`/status?code=${encodeURIComponent(registrationCode)}`}
          state={{ email }}
          className="btn-small inline-block mt-5"
          data-log="dashboard-fix-registration"
        >
          Fix and resubmit
        </Link>
      </Card>
    );
  }
  if (status !== "approved") {
    return (
      <Card>
        <Badge status="pending">Under review</Badge>
        <h2 className="h3 !mt-3">We’re checking your payment</h2>
        <p className="text-sm text-soft mt-2">
          The registration desk is verifying your payment. You’ll get an email once it’s approved, and your ID card
          will appear here.
        </p>
      </Card>
    );
  }
  return null; // approved: see TodayPanel
}

const clock = (iso) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit", timeZone: "Asia/Kolkata" });
const istDay = (t) => new Date(t).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });

/** "Starts in 45 min", "Starts in 3 h 20 min", "Tomorrow, 9:30 am", "In 3 days". */
function startsIn(event, now) {
  const mins = Math.round((new Date(event.startTime).getTime() - now) / 60000);
  if (mins <= 0) return "Happening now";
  if (mins < 60) return `Starts in ${mins} min`;
  if (mins < 6 * 60) return `Starts in ${Math.floor(mins / 60)} h${mins % 60 ? ` ${mins % 60} min` : ""}`;
  const days = Math.round((new Date(istDay(event.startTime)) - new Date(istDay(now))) / 86400000);
  if (days === 0) return `Today, ${clock(event.startTime)}`;
  if (days === 1) return `Tomorrow, ${clock(event.startTime)}`;
  return `In ${days} days`;
}

/**
 * The top of an approved participant's dashboard: the event that's on now
 * or next (countdown, place, check-in, WhatsApp group), the team, and
 * progress so far. Check-in is per registration: scanning one ID card
 * checks in the whole team.
 */
function TodayPanel({ registration, registeredEvents, attendedAt, whatsappGroups, certificateCount, mealCount }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 60000);
    return () => clearInterval(id);
  }, []);

  const next = registeredEvents.find((e) => new Date(e.endTime).getTime() > now);
  const members = Array.isArray(registration.teamMembers) ? registration.teamMembers.filter((m) => m?.name) : [];
  const isTeam = members.length > 1;
  const nextIn = next && attendedAt.get(next.id);
  const whatsapp = next && whatsappGroups.find((g) => g.eventId === next.id)?.url;
  const checkedInCount = registeredEvents.filter((e) => attendedAt.has(e.id)).length;

  return (
    <Card glow>
      <div className="flex flex-wrap items-center gap-2">
        <Badge status="approved">You’re registered</Badge>
        {isTeam && (
          <span className="pill">
            {registration.teamName ? `Team ${registration.teamName}` : "Your team"} · {members.length}
          </span>
        )}
      </div>

      {next ? (
        <div className="mt-5">
          <p className="kicker">{startsIn(next, now)}</p>
          <h2 className="text-[24px] sm:text-[28px] leading-tight text-heading mt-1.5">{next.name}</h2>
          <p className="text-sm text-soft mt-1.5">
            {formatDay(next)} · {formatTimeRange(next)}
            {next.venue && <> · {next.venue}</>}
          </p>
          {nextIn ? (
            <p className="text-sm text-success mt-3">
              ✓ {isTeam ? "Your team is" : "You’re"} checked in · {clock(nextIn)}
            </p>
          ) : (
            <p className="text-[13px] text-dim mt-3">
              Show your ID card QR at the event check-in.{isTeam && " One scan checks in your whole team."}
            </p>
          )}
          <div className="flex flex-wrap gap-2 mt-5">
            <a href="#id-card" className="btn-small !py-2.5" data-log="dashboard-show-id-card">Show my ID card</a>
            {whatsapp && (
              <a href={whatsapp} target="_blank" rel="noopener noreferrer" className="btn-ghost-sm !py-2.5" data-log="dashboard-hero-whatsapp">
                WhatsApp group ↗
              </a>
            )}
          </div>
        </div>
      ) : (
        <div className="mt-5">
          <h2 className="h3 !mt-0">Thanks for taking part</h2>
          <p className="text-sm text-soft mt-1">Your certificates appear below once they’re issued.</p>
        </div>
      )}

      {isTeam && (
        <div className="mt-6">
          <p className="mono-label mb-2">Team</p>
          <ul className="flex flex-wrap gap-1.5">
            {members.map((m, i) => (
              <li key={`${m.name}-${i}`} className="pill">
                {m.name}
                {m.role === "lead" && <span className="opacity-60"> · lead</span>}
              </li>
            ))}
          </ul>
        </div>
      )}

      <dl className="grid grid-cols-3 gap-2 mt-6 pt-5 border-t border-shade/10">
        {[
          ["Checked in", `${checkedInCount} / ${registeredEvents.length}`],
          ["Certificates", certificateCount],
          ["Meals", mealCount],
        ].map(([label, value]) => (
          <div key={label}>
            <dt className="mono-label">{label}</dt>
            <dd className="text-[20px] text-heading mt-1 tabular-nums">{value}</dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}

function EventRow({ event, attendedAt, place, approved, whatsappUrl, choice, isTeam }) {
  const ended = new Date(event.endTime).getTime() < Date.now();
  let state = null;
  if (place) state = <Badge status="info">🏆 {PLACE[place] || `Position ${place}`}</Badge>;
  else if (attendedAt) state = <Badge status="present">{isTeam ? "Team in" : "Checked in"} · {clock(attendedAt)}</Badge>;
  else if (approved && !ended) state = <Badge>Upcoming</Badge>;
  return (
    <li className="card p-4 sm:p-5">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <Link to={`/events/${event.id}`} className="text-[17px] text-heading hover:text-amber-light">
            {event.name}
          </Link>
          <p className="text-[13px] text-soft mt-1">
            {formatDay(event)} · {formatTimeRange(event)}
          </p>
          {event.venue && <p className="text-[13px] text-dim mt-0.5">{event.venue}</p>}
        </div>
        {state && <div className="shrink-0">{state}</div>}
      </div>
      <div className="flex flex-wrap gap-2 mt-3">
        <span className="pill">{CATEGORY_LABEL[categoryOf(event)]}</span>
        <span className="pill">{teamLabel(event)}</span>
        {choice && <span className="pill">{event.choiceLabel || "Choice"}: {choice}</span>}
      </div>
      {whatsappUrl && (
        <a
          href={whatsappUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="btn-small inline-block mt-4 !py-2.5 text-center w-full sm:w-auto"
          data-log="dashboard-join-whatsapp"
        >
          Join the {event.name} WhatsApp group ↗
        </a>
      )}
    </li>
  );
}

export default function Dashboard() {
  const { user } = useAuth();
  const { openPanel } = usePanels();
  const [registration, setRegistration] = useState(null);
  const [activity, setActivity] = useState({ attendance: [], results: [], meals: [] });
  const [whatsappGroups, setWhatsappGroups] = useState([]); // [{ eventId, name, url }] - approved only
  // loading | ready | none (no registration on this account) | error
  const [loadState, setLoadState] = useState("loading");
  const [events, setEvents] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [feedbackEventId, setFeedbackEventId] = useState("");
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const cardRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    api
      .get("/api/registrations/mine")
      .then((data) => {
        setRegistration(data.registration);
        if (data.activity) setActivity(data.activity);
        setWhatsappGroups(data.whatsappGroups || []);
        setLoadState("ready");
      })
      .catch((err) => setLoadState(err.status === 404 ? "none" : "error"));
    api.get("/api/certificates/mine").then((data) => setCertificates(data.certificates || [])).catch(() => {});
    api.get("/api/events").then((data) => setEvents(data.events || [])).catch(() => {});
  }, [user]);

  // Decide whether to show the one-time welcome hero once we actually
  // know both who the user is AND their registration's status - checked
  // together (not registration alone) so a still-loading registration
  // can't briefly read as "not approved" and skip showing it.
  useEffect(() => {
    if (!user || !registration) return;
    if (registration.status !== "approved") return;
    let alreadySeen = true;
    try { alreadySeen = localStorage.getItem(welcomeSeenKey(user.id)) === "1"; } catch { /* storage unavailable */ }
    if (!alreadySeen) setShowWelcome(true);
  }, [user, registration]);

  const dismissWelcome = () => {
    try { if (user) localStorage.setItem(welcomeSeenKey(user.id), "1"); } catch { /* storage unavailable */ }
    setShowWelcome(false);
  };

  // Shared between the welcome hero's feature cards, the events list and
  // the feedback picker, in schedule order.
  const registeredEvents = useMemo(
    () =>
      events
        .filter((e) => registration?.eventIds?.includes?.(e.id))
        .sort((a, b) => new Date(a.startTime) - new Date(b.startTime)),
    [events, registration]
  );
  const attendedAt = useMemo(() => new Map(activity.attendance.map((a) => [a.eventId, a.scannedAt])), [activity]);
  const placeOf = useMemo(() => new Map(activity.results.map((r) => [r.eventId, r.position])), [activity]);
  const eventName = useMemo(() => new Map(events.map((e) => [e.id, e.name])), [events]);
  // My events under a heading per day ("October 8, 2026 (Day 1)"), in schedule order.
  const eventDays = useMemo(() => {
    const days = new Map();
    for (const e of registeredEvents) days.set(formatDay(e), [...(days.get(formatDay(e)) || []), e]);
    return [...days];
  }, [registeredEvents]);
  const teamSize = Array.isArray(registration?.teamMembers) ? registration.teamMembers.filter((m) => m?.name).length : 1;

  const approved = registration?.status === "approved";
  const profile = registration?.user || user;

  // ID card data: Registration No. = college register number, Delegate ID
  // = registration code; the QR opens the card's verification page.
  const idCard = {
    name: profile?.name,
    registrationNumber: profile?.registerNo,
    delegateId: registration?.registrationCode,
    institution: registration?.collegeName || profile?.collegeName,
    qrValue: idCardVerifyUrl(registration?.registrationCode, registration?.idCardToken),
  };
  const downloadIdCard = async () => {
    try {
      await saveIdCard(cardRef.current, idCard.name);
    } catch {
      toast.error("Couldn't create the ID card image. Please try again.");
    }
  };
  const printCard = async () => {
    try {
      await printIdCard(cardRef.current, idCard.name);
    } catch {
      toast.error("Couldn't prepare the ID card for printing. Please try again.");
    }
  };

  // Certificates are private files: fetched with the sign-in token.
  const downloadCertificate = async (c) => {
    try {
      const blob = await api.blob(`/api/certificates/${encodeURIComponent(c.certificateCode)}/pdf`);
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `Techastra26-${(eventName.get(c.eventId) || "Certificate").replace(/[^A-Za-z0-9]+/g, "-")}-${(c.recipientName || "").replace(/[^A-Za-z0-9]+/g, "-")}.pdf`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (err) {
      toast.error(err.message || "Couldn't download the certificate.");
    }
  };

  const submitFeedback = async (e) => {
    e.preventDefault();
    if (!feedbackEventId) return toast.error("Select an event");
    try {
      await api.post("/api/feedback", { eventId: feedbackEventId, rating: Number(rating), comments });
      toast.success("Thanks for your feedback!");
      setComments("");
    } catch (err) {
      toast.error(err.message);
    }
  };

  // "DOWNLOAD ID CARD" on the welcome hero should actually download the
  // card (not just dismiss the hero and leave the participant to go find
  // the button below) - runs the real export, then dismisses.
  const handleWelcomeDownloadIdCard = async () => {
    dismissWelcome();
    await downloadIdCard();
  };

  // "VIEW MY EVENTS" dismisses the one-time hero and smooth-scrolls down
  // to the normal dashboard content - "the rest of the normal dashboard
  // ... continues below it on scroll" per the brief, rather than
  // navigating away from /dashboard entirely.
  const handleWelcomeViewEvents = () => {
    dismissWelcome();
    requestAnimationFrame(() => {
      document.getElementById("my-events")?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

  const header = (
    <div className="flex items-center gap-4 mb-6">
      <div
        aria-hidden="true"
        className="grid place-items-center w-14 h-14 sm:w-16 sm:h-16 shrink-0 rounded-full border border-amber/40 bg-amber/10 text-amber-light text-xl font-heading"
      >
        {initials(profile?.name)}
      </div>
      <div className="min-w-0">
        <p className="kicker">My dashboard</p>
        <h1 className="text-[26px] sm:text-[32px] leading-tight text-heading truncate">Hi, {profile?.name?.split(" ")[0] || "there"}</h1>
        {registration && (
          <p className="text-[13px] text-soft mt-0.5">
            <span className="font-mono tracking-[0.06em] text-heading">{registration.registrationCode}</span>
            {(registration.collegeName || profile?.collegeName) && <> · {registration.collegeName || profile.collegeName}</>}
          </p>
        )}
      </div>
    </div>
  );

  if (loadState !== "ready") {
    return (
      <div className="max-w-xl mx-auto px-6 pt-6 pb-16 sm:py-14">
        {header}
        {loadState === "loading" && <div className="card h-40 animate-pulse" aria-busy="true" aria-label="Loading your dashboard" />}
        {loadState === "none" && (
          <Card>
            <h2 className="h3 !mt-0">You haven’t registered for any events yet</h2>
            <p className="text-sm text-soft mt-2">Pick your events, then come back here for your ID card and certificates.</p>
            <Link to="/events" className="btn-small inline-block mt-5">Browse events</Link>
          </Card>
        )}
        {loadState === "error" && (
          <Card>
            <h2 className="h3 !mt-0">Couldn’t load your dashboard</h2>
            <p className="text-sm text-soft mt-2">Check your connection and try again.</p>
            <button type="button" className="btn-ghost-sm mt-5" onClick={() => window.location.reload()}>Reload</button>
          </Card>
        )}
      </div>
    );
  }

  const quickLinks = [
    approved && ["#id-card", "ID card"],
    ["#my-events", "Events"],
    certificates.length > 0 && ["#certificates", "Certificates"],
    ["#profile", "Profile"],
  ].filter(Boolean);

  return (
    <div>
      {/*
        Section 5C-adjacent exception: the ONE deliberate full-viewport
        hero in this app, per App.jsx's "no marketing hero anywhere"
        scope note - justified because this is gated (registration.status
        === "approved"), post-login, and one-time (see welcomeSeenKey
        above), not public/pre-approval marketing. Rendered above the
        normal dashboard content, which continues below it on scroll -
        never in place of it.
      */}
      {showWelcome && (
        <ApprovalHero
          participantName={profile?.name || "Participant"}
          registeredEvents={registeredEvents}
          onDownloadIdCard={handleWelcomeDownloadIdCard}
          onViewEvents={handleWelcomeViewEvents}
        />
      )}

      <div className="max-w-5xl mx-auto px-6 pt-6 pb-16 sm:py-14">
        {header}

        {approved ? (
          <TodayPanel
            registration={registration}
            registeredEvents={registeredEvents}
            attendedAt={attendedAt}
            whatsappGroups={whatsappGroups}
            certificateCount={certificates.length}
            mealCount={activity.meals.length}
          />
        ) : (
          <StatusPanel registration={registration} email={profile?.email} onHelp={() => openPanel("help")} />
        )}

        {/* Jump links - the page is long on phones. */}
        <nav aria-label="Dashboard sections" className="flex gap-2 mt-5 -mx-6 px-6 overflow-x-auto lg:hidden">
          {quickLinks.map(([href, label]) => (
            <a key={href} href={href} className="chip shrink-0">{label.toUpperCase()}</a>
          ))}
        </nav>

        {/* Phones: one column in the order below (ID card first - it's what
            people open this page for on event day). Desktop: two columns,
            the side column (ID card, profile, payment) on the right. The
            column wrappers are display:contents on phones so `order` can
            interleave their children. */}
        <div className="flex flex-col gap-10 mt-8 lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-10 lg:items-start">
          <div className="contents lg:flex lg:flex-col lg:gap-10">
            <Section id="my-events" title={`My events · ${registeredEvents.length}`} className="order-2 lg:order-none">
              {registeredEvents.length === 0 ? (
                <p className="text-sm text-dim">Loading your events…</p>
              ) : (
                <div className="space-y-6">
                  {eventDays.map(([day, list]) => (
                    <div key={day}>
                      {eventDays.length > 1 && <h3 className="text-[13px] text-soft mb-2">{day}</h3>}
                      <ul className="space-y-3">
                        {list.map((e) => (
                          <EventRow
                            key={e.id}
                            event={e}
                            attendedAt={attendedAt.get(e.id)}
                            place={placeOf.get(e.id)}
                            approved={approved}
                            isTeam={teamSize > 1}
                            choice={registration.eventChoices?.[e.id]}
                            whatsappUrl={approved ? whatsappGroups.find((g) => g.eventId === e.id)?.url : undefined}
                          />
                        ))}
                      </ul>
                    </div>
                  ))}
                </div>
              )}
              <TeamCard registration={registration} onSaved={(teamMembers) => setRegistration((r) => ({ ...r, teamMembers }))} />
            </Section>

            {(approved || certificates.length > 0) && (
              <Section id="certificates" title="Certificates" className="order-3 lg:order-none">
                {approved && (
                  <CertificateNames
                    registration={registration}
                    onSaved={(memberTitles) => setRegistration((r) => ({ ...r, memberTitles }))}
                  />
                )}
                {certificates.length === 0 ? (
                  <p className="text-sm text-dim">
                    Participation certificates are sent at the end of each event day - they’ll appear here and in your email.
                  </p>
                ) : (
                  <ul className="space-y-3">
                    {certificates.map((c) => (
                      <li key={c.id} className="card p-4 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <p className="text-heading truncate">{eventName.get(c.eventId) || "Techastra ’26"}</p>
                          <p className="text-[13px] text-soft truncate">{c.recipientName}</p>
                          <p className="text-[12px] text-dim font-mono tracking-[0.06em] mt-0.5">PARTICIPATION · {c.certificateCode}</p>
                        </div>
                        <button type="button" className="btn-ghost-sm shrink-0" onClick={() => downloadCertificate(c)}>
                          Download
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </Section>
            )}

            {approved && registeredEvents.length > 0 && (
              <Section id="feedback" title="Event feedback" className="order-6 lg:order-none">
                <form onSubmit={submitFeedback} className="card p-4 sm:p-5 space-y-3">
                  <Select aria-label="Event to give feedback on" value={feedbackEventId} onChange={(e) => setFeedbackEventId(e.target.value)}>
                    <option value="">Select an event</option>
                    {registeredEvents.map((e) => (
                      <option key={e.id} value={e.id}>{e.name}</option>
                    ))}
                  </Select>
                  <Select aria-label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                    {[5, 4, 3, 2, 1].map((n) => (
                      <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>
                    ))}
                  </Select>
                  <Textarea aria-label="Comments (optional)" rows={3} placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
                  <Button type="submit" className="w-full">Submit feedback</Button>
                </form>
              </Section>
            )}
          </div>

          <div className="contents lg:flex lg:flex-col lg:gap-10">
            {approved && (
              <Section id="id-card" title="Your ID card" className="order-1 lg:order-none">
                <div className="max-w-[360px] mx-auto lg:mx-0">
                  <ParticipantIDCard ref={cardRef} {...idCard} />
                  <div className="grid grid-cols-2 gap-3 mt-4">
                    <Button onClick={downloadIdCard}>Download</Button>
                    <Button variant="outline" onClick={printCard}>Print</Button>
                  </div>
                  <p className="text-xs text-dim mt-3 text-center">Show this QR at event check-in and food counters.</p>
                </div>
              </Section>
            )}

            <Section
              id="profile"
              title="Profile"
              className="order-4 lg:order-none"
              action={
                <button type="button" className="link-cta text-[13px]" onClick={() => openPanel("help")}>
                  Need a correction?
                </button>
              }
            >
              <div className="grid grid-cols-2 gap-2">
                {/* Full-width facts first, so the short ones pair up two per row. */}
                <Fact label="Name" wide>{profile?.name}</Fact>
                <Fact label="Email" wide>{profile?.email}</Fact>
                {(registration.collegeName || profile?.collegeName) && (
                  <Fact label="College / school" wide>{registration.collegeName || profile.collegeName}</Fact>
                )}
                {profile?.department && <Fact label="Department" wide>{profile.department}</Fact>}
                {profile?.phone && <Fact label="Mobile">{profile.phone}</Fact>}
                {profile?.registerNo && <Fact label="Register no.">{profile.registerNo}</Fact>}
                {profile?.course && <Fact label="Course">{profile.course}</Fact>}
                {profile?.yearOfStudy && <Fact label="Year">{profile.yearOfStudy}</Fact>}
              </div>
            </Section>

            <Section id="payment" title="Payment" className="order-5 lg:order-none">
              <div className="grid grid-cols-2 gap-2">
                <Fact label="Amount">{formatFee(registration.totalAmount)}</Fact>
                {registration.totalAmount > 0 && <Fact label="Method">{PAY_METHOD[registration.paymentMethod] || registration.paymentMethod}</Fact>}
                {registration.transactionId && <Fact label="UTR / transaction ID" wide><span className="font-mono text-[13px]">{registration.transactionId}</span></Fact>}
                <Fact label="Registered on">{when(registration.createdAt)}</Fact>
              </div>
              {activity.meals.length > 0 && (
                <div className="mt-4">
                  <p className="mono-label mb-2">Meals collected</p>
                  <div className="flex flex-wrap gap-2">
                    {activity.meals.map((m) => (
                      <Badge key={m.mealSession} status="collected">{MEAL_LABEL[m.mealSession] || m.mealSession}</Badge>
                    ))}
                  </div>
                </div>
              )}
            </Section>
          </div>
        </div>
      </div>
    </div>
  );
}
