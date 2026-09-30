import React, { useEffect, useMemo, useRef, useState } from "react";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { Textarea, Select } from "../components/ui/Input";
import ParticipantIDCard from "../components/ParticipantIDCard";
import { downloadIdCard as saveIdCard, printIdCard } from "../lib/idCardExport";
import { idCardVerifyUrl } from "../lib/idCard";
import ApprovalHero from "../components/dashboard/ApprovalHero";
import { api } from "../lib/api";
import { useAuth } from "../context/AuthContext";

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

export default function Dashboard() {
  const { user } = useAuth();
  const [registration, setRegistration] = useState(null);
  const [events, setEvents] = useState([]);
  const [certificates, setCertificates] = useState([]);
  const [feedbackEventId, setFeedbackEventId] = useState("");
  const [rating, setRating] = useState(5);
  const [comments, setComments] = useState("");
  const [showWelcome, setShowWelcome] = useState(false);
  const cardRef = useRef(null);
  // The rest of the normal dashboard (ID card / certificates / feedback)
  // scrolls into view when "VIEW MY EVENTS" is clicked from the welcome
  // hero, per "the rest of the normal dashboard continues below it on
  // scroll" - this ref marks where that content actually starts.
  const dashboardContentRef = useRef(null);

  useEffect(() => {
    if (!user) return;
    api.get("/api/registrations/mine").then((data) => setRegistration(data.registration)).catch(() => {});
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
    const alreadySeen = localStorage.getItem(welcomeSeenKey(user.id)) === "1";
    if (!alreadySeen) setShowWelcome(true);
  }, [user, registration]);

  const dismissWelcome = () => {
    if (user) localStorage.setItem(welcomeSeenKey(user.id), "1");
    setShowWelcome(false);
  };

  // Shared between the welcome hero's feature cards and the ID card
  // panel below - both need "the events this participant is actually
  // registered for," computed once rather than duplicated inline twice.
  const registeredEvents = useMemo(
    () => events.filter((e) => registration?.eventIds?.includes?.(e.id)),
    [events, registration]
  );

  // ID card data: Registration No. = college register number, Delegate ID
  // = registration code; the QR opens the card's verification page.
  const cardUser = registration?.user || user;
  const idCard = {
    name: cardUser?.name,
    registrationNumber: cardUser?.registerNo,
    delegateId: registration?.registrationCode,
    institution: registration?.collegeName || cardUser?.collegeName,
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
      dashboardContentRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    });
  };

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
          participantName={user?.name || "Participant"}
          registeredEvents={registeredEvents}
          onDownloadIdCard={handleWelcomeDownloadIdCard}
          onViewEvents={handleWelcomeViewEvents}
        />
      )}

      <div ref={dashboardContentRef} className="max-w-4xl mx-auto px-6 py-14">
        <p className="text-arc text-[11px] tracking-cinematic uppercase mb-3">My Dashboard</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-offwhite mb-2">Welcome, {user?.name}</h1>
        <p className="text-offwhite/50 mb-10">{user?.collegeName}</p>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-10">
        <div>
          <h2 className="font-heading text-sm uppercase tracking-wider text-offwhite/70 mb-4">Your Digital ID Card</h2>
          <ParticipantIDCard ref={cardRef} {...idCard} />
          <div className="grid grid-cols-2 gap-3 mt-4">
            <Button onClick={downloadIdCard} disabled={!registration}>Download ID card</Button>
            <Button variant="outline" onClick={printCard} disabled={!registration}>Print ID card</Button>
          </div>
          <p className="text-xs text-dim mt-3 text-center">
            Show this QR at event check-in and food counters.
          </p>
        </div>

        <div className="space-y-10">
          <div>
            <h2 className="font-heading text-sm uppercase tracking-wider text-offwhite/70 mb-4">Your Certificates</h2>
            {certificates.length === 0 ? (
              <p className="text-dim text-sm">No certificates issued yet. Check back after your events conclude.</p>
            ) : (
              <ul className="divide-y divide-crimson/10 border-t border-b border-crimson/10">
                {certificates.map((c) => (
                  <li key={c.id} className="flex items-center justify-between px-1 py-3">
                    <span className="text-sm text-offwhite/80 capitalize">{c.type} &mdash; {c.certificateCode}</span>
                    {c.pdfUrl && (
                      <a href={`${api.baseUrl}${c.pdfUrl}`} target="_blank" rel="noreferrer" className="text-arc text-sm hover:underline">
                        Download
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div>
            <h2 className="font-heading text-sm uppercase tracking-wider text-offwhite/70 mb-4">Event Feedback</h2>
            <form onSubmit={submitFeedback} className="space-y-3">
              <Select aria-label="Event to give feedback on" value={feedbackEventId} onChange={(e) => setFeedbackEventId(e.target.value)}>
                <option value="">Select an event</option>
                {events.map((e) => (
                  <option key={e.id} value={e.id}>{e.name}</option>
                ))}
              </Select>
              <Select aria-label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>
                {[5, 4, 3, 2, 1].map((n) => (
                  <option key={n} value={n}>{n} Star{n > 1 ? "s" : ""}</option>
                ))}
              </Select>
              <Textarea aria-label="Comments (optional)" rows={3} placeholder="Comments (optional)" value={comments} onChange={(e) => setComments(e.target.value)} />
              <Button type="submit" className="w-full">Submit Feedback</Button>
            </form>
          </div>
        </div>
      </div>
      </div>
    </div>
  );
}
