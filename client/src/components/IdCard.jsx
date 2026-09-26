import React, { forwardRef } from "react";
import { QRCodeCanvas } from "qrcode.react";
import TechAstraLogo from "./TechAstraLogo";

/**
 * Official event badge styling in the TechAstra gold-on-black theme
 * (`gold`/`onyx`/`void` Tailwind tokens - already established for this
 * exact component, matching the real logo artwork's own gold, not a
 * new palette invented for this pass), with the logo at the top.
 * Rendered at a fixed pixel size (rather than responsive %/max-w
 * classes) so the html2canvas snapshot used for the PDF/PNG download is
 * pixel-predictable and doesn't reflow between what's shown on screen
 * and what gets captured.
 *
 * LAYOUT (per the "OFFICIAL DELEGATE ID" mockup, adapted to this app's
 * real data - see the field-by-field mapping agreed before this pass):
 *   - Header: logo + "OFFICIAL DELEGATE ID" banner
 *   - Photo (left) + labeled fields with small icons (right): Name,
 *     Institution/College, Registration Number, Delegate ID
 *     (Delegate ID reuses the SAME `registrationCode` value as
 *     Registration Number - confirmed there's no separate ID field in
 *     the schema, so this is one value shown twice, not two DB fields)
 *   - Boxed section: Team Name / Team Members (ONLY for team
 *     registrations - hidden entirely for individual ones) + Registered
 *     Event(s) (every event in `registration.eventIds`, listed in one
 *     field - one card per REGISTRATION, not one card per event, since
 *     that's how the QR/check-in scanning already works)
 *   - QR code + "SCAN FOR VERIFICATION" label
 *   - Footer tagline
 *
 * Deliberately skips the mockup's decorative diagonal-cut corners /
 * hexagon pattern / circuit-line flourishes - confirmed out of scope,
 * kept clean/reliable for html2canvas export instead.
 *
 * Uses QRCodeCanvas (renders to a real <canvas>) instead of QRCodeSVG -
 * html2canvas does not reliably rasterize inline <svg> elements, which
 * was causing the QR code to come out blank/misplaced in exports.
 *
 * Field icons are inline SVGs (same pattern Navbar.jsx already uses for
 * its cart/hamburger icons) rather than a new icon-library dependency -
 * nothing in this project currently installs Phosphor/Heroicons/lucide,
 * and inline SVG rasterizes reliably under html2canvas without needing
 * to verify a new library's canvas-export behavior.
 */
const CARD_WIDTH = 380;

function FieldIcon({ children }) {
  return (
    <span
      className="flex items-center justify-center rounded-md"
      style={{ width: 22, height: 22, backgroundColor: "rgba(221,187,106,0.15)", flexShrink: 0 }}
    >
      {children}
    </span>
  );
}

const ICONS = {
  person: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ddbb6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4 3.5-6 8-6s8 2 8 6" />
    </svg>
  ),
  institution: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ddbb6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 21h18" />
      <path d="M5 21V9l7-5 7 5v12" />
      <path d="M9 21v-6h6v6" />
    </svg>
  ),
  idCard: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ddbb6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="2.5" y="5.5" width="19" height="13" rx="2" />
      <circle cx="8" cy="12" r="1.8" />
      <path d="M13 10h6M13 14h4" />
    </svg>
  ),
  badge: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ddbb6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <rect x="6" y="2.5" width="12" height="19" rx="2" />
      <circle cx="12" cy="9" r="2.4" />
      <path d="M8.5 17h7" />
    </svg>
  ),
  team: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="#ddbb6a" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="9" cy="9" r="3" />
      <path d="M2.5 20c0-3.3 2.9-5 6.5-5s6.5 1.7 6.5 5" />
      <circle cx="17.5" cy="8" r="2.3" />
      <path d="M16 11.3c2.7.4 4.5 1.9 4.5 4.4" />
    </svg>
  ),
  star: (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="#ddbb6a" stroke="#ddbb6a" strokeWidth="1">
      <path d="M12 2.5l2.9 6 6.6.7-4.9 4.5 1.3 6.5L12 16.9l-5.9 3.3 1.3-6.5-4.9-4.5 6.6-.7z" />
    </svg>
  ),
  silhouette: (
    <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="rgba(221,187,106,0.5)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 20c0-4.4 3.5-7 8-7s8 2.6 8 7" />
    </svg>
  ),
};

function Field({ icon, label, value }) {
  return (
    <div className="flex items-start gap-2.5" style={{ marginTop: 10 }}>
      <FieldIcon>{icon}</FieldIcon>
      <div style={{ minWidth: 0, flex: 1 }}>
        <p
          className="uppercase font-semibold"
          style={{ fontSize: 9.5, letterSpacing: "0.08em", color: "#ddbb6a", margin: 0, lineHeight: "13px" }}
        >
          {label}
        </p>
        <p
          className="text-white"
          style={{ fontSize: 13, lineHeight: "17px", margin: "2px 0 0", wordBreak: "break-word", fontWeight: 500 }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}

const IdCard = forwardRef(function IdCard({ registration, user, events }, ref) {
  const isTeamRegistration = !!registration?.teamName;
  const eventNames = (events || []).map((e) => e.name).join(", ") || "Not registered yet";
  const teamMemberNames =
    Array.isArray(registration?.teamMembers) && registration.teamMembers.length > 0
      ? registration.teamMembers.map((m) => m.name).join(", ")
      : null;

  // Responsive scaling wrapper - scales down at narrow viewports to prevent horizontal overflow
  // while preserving the fixed 380px CARD_WIDTH for html2canvas export reliability.
  // At 375px viewport: scale(0.86) = 327px visible width (375 - 48px container padding).
  // At 390px viewport: scale(0.90) = 342px visible width.
  // At 414px+ viewport: scale(1) = 380px (no scaling, fits naturally).
  return (
    <div className="w-full" style={{ 
      transform: 'scale(min(1, calc((100vw - 48px) / 380)))',
      transformOrigin: 'top center',
      marginBottom: 'calc(max(0px, (380px - (100vw - 48px)) * 0.5))'
    }}>
      <div
        ref={ref}
        style={{ width: CARD_WIDTH, backgroundColor: "#221f1b" }}
        className="mx-auto rounded-2xl overflow-hidden border-2 border-gold/60"
      >
      {/* Header: logo + official id label, solid gold gradient (no blur/backdrop-filter) */}
      <div
        style={{
          background: "linear-gradient(135deg, #f2e2b4 0%, #ddbb6a 50%, #866c2a 100%)",
        }}
        className="px-5 py-4 flex flex-col items-center gap-1"
      >
        {/* ROOT-CAUSE FIX ("logo not visible"): this previously hardcoded
            a raw <img src="/logo.png"> - that file doesn't exist anywhere
            in client/public (the real asset is a differently-named PNG,
            already correctly referenced by the shared TechAstraLogo
            component everywhere else in the app). Reusing that component
            here instead of a second, wrong hardcoded path. */}
        <TechAstraLogo size="sm" showGlow={false} />
        <span
          className="uppercase font-bold text-onyx"
          style={{ fontSize: 12, letterSpacing: "0.12em", marginTop: 2 }}
        >
          Official Delegate ID
        </span>
      </div>

      {/*
        NOTE: no Tailwind `truncate` (overflow:hidden + text-overflow:ellipsis
        + white-space:nowrap) anywhere below - html2canvas does not compute
        box height correctly for ellipsis-truncated lines, which collapsed
        each line's height to ~0 and made every following line render on
        top of the previous one. Fixed-width columns + normal wrapping
        instead, so long text wraps to a second line rather than relying
        on ellipsis truncation.
      */}
      <div className="p-5" style={{ backgroundColor: "#1e1b17", display: "flex", gap: 14 }}>
        {/* Photo, left - silhouette placeholder matches the mockup's
            "YOUR PHOTO HERE" box exactly when user.photoUrl is empty,
            instead of the previous emoji fallback. */}
        <div
          className="rounded-xl overflow-hidden flex flex-col items-center justify-center border-2 border-gold/50"
          style={{ width: 92, height: 108, backgroundColor: "#2f2a24", flexShrink: 0, gap: 6 }}
        >
          {user?.photoUrl ? (
            <img src={user.photoUrl} alt={user.name} className="w-full h-full object-cover" crossOrigin="anonymous" />
          ) : (
            <>
              {ICONS.silhouette}
              <span
                className="uppercase text-center"
                style={{ fontSize: 8, letterSpacing: "0.05em", color: "#ddbb6a", lineHeight: "10px", padding: "0 6px" }}
              >
                Your Photo Here
              </span>
            </>
          )}
        </div>

        {/* Labeled fields, right - Name / Institution / Registration
            Number / Delegate ID, each with a small icon (mockup
            structure), all bound to real data. */}
        <div style={{ flex: 1, minWidth: 0 }}>
          <Field icon={ICONS.person} label="Participant Name" value={user?.name || "—"} />
          <Field icon={ICONS.institution} label="Institution / College" value={user?.collegeName || "—"} />
          <Field icon={ICONS.idCard} label="Registration Number" value={registration?.registrationCode || "—"} />
          {/* Delegate ID intentionally reuses the SAME registrationCode
              value - confirmed there is no separate delegate-id field in
              the schema, so this is one value surfaced twice to match
              the mockup's two labeled rows, not two different DB
              columns. */}
          <Field icon={ICONS.badge} label="Delegate ID" value={registration?.registrationCode || "—"} />
        </div>
      </div>

      {/* Boxed section - Team Name / Team Members (only for team
          registrations, hidden entirely otherwise) + Registered
          Event(s) (always shown - every event in eventIds, in ONE
          field, since this is one card per REGISTRATION not per
          event). Bordered box matches the mockup's outlined
          rounded-rect group for these three rows. */}
      <div className="px-5 pb-4" style={{ backgroundColor: "#1e1b17" }}>
        <div className="rounded-xl border border-gold/30 px-4 py-3" style={{ backgroundColor: "rgba(221,187,106,0.04)" }}>
          {isTeamRegistration && (
            <>
              <Field icon={ICONS.team} label="Team Name" value={registration.teamName} />
              {teamMemberNames && (
                <Field icon={ICONS.team} label="Team Members" value={teamMemberNames} />
              )}
            </>
          )}
          <Field icon={ICONS.star} label="Registered Event(s)" value={eventNames} />
        </div>
      </div>

      {/* QR code + "SCAN FOR VERIFICATION" label, per the mockup. */}
      <div className="flex flex-col items-center gap-3 px-5 pb-3" style={{ backgroundColor: "#1e1b17" }}>
        <div className="bg-white rounded-lg p-3">
          <QRCodeCanvas value={registration?.registrationCode || ""} size={130} />
        </div>
        <span
          className="uppercase font-semibold"
          style={{ fontSize: 10.5, letterSpacing: "0.14em", color: "#ddbb6a" }}
        >
          Scan for Verification
        </span>
      </div>

      {/* Footer tagline, per the mockup. */}
      <div
        className="text-center py-3"
        style={{ backgroundColor: "#1e1b17", borderTop: "1px solid rgba(221,187,106,0.25)" }}
      >
        <span
          className="uppercase font-semibold"
          style={{ fontSize: 9.5, letterSpacing: "0.18em", color: "rgba(221,187,106,0.7)" }}
        >
          Innovate &nbsp;/&nbsp; Collaborate &nbsp;/&nbsp; Build Tomorrow
        </span>
      </div>
    </div>
    </div>
  );
});

export default IdCard;
