/**
 * Decorative line art for event cards - one motif per event, drawn in a
 * single consistent style (120x120, 2px strokes, round joins) and coloured by
 * CSS through `currentColor`. Keyed by the event's `name`; unknown events get
 * a generic motif for their category so no card is ever blank.
 *
 * Shared by the registration portal and the main site (techastra-web keeps a
 * copy of this file) - keep the two in sync.
 */

const ART = {
  // ---------- Senior · Technical ----------
  "Pen Your Vision": (
    <>
      <path d="M22 18h52l18 18v68H22z" />
      <path d="M74 18v18h18" />
      <path d="M34 50h36M34 62h44M34 74h28" />
      <path d="M84 70l18-30 8 5-18 30-11 5z" />
      <path d="M96 50l8 5" />
    </>
  ),
  "Hack Nexus": (
    <>
      <rect x="20" y="26" width="80" height="52" rx="4" />
      <path d="M10 88h100l-8 10H18z" />
      <path d="M46 42l-10 10 10 10M74 42l10 10-10 10M64 38l-8 28" />
    </>
  ),
  "Crypt Clash": (
    <>
      <rect x="22" y="54" width="46" height="40" rx="5" />
      <path d="M32 54V42a13 13 0 0126 0v12" />
      <circle cx="45" cy="72" r="5" />
      <path d="M45 77v7" />
      <path d="M82 96V24" />
      <path d="M82 26h26l-8 11 8 11H82" />
    </>
  ),
  "Trial of Truth": (
    <>
      <path d="M60 18v80M38 98h44" />
      <path d="M26 34h68" />
      <circle cx="60" cy="24" r="4" />
      <path d="M26 34l-12 30h24zM94 34l-12 30h24z" />
      <path d="M14 64a12 6 0 0024 0M82 64a12 6 0 0024 0" />
    </>
  ),
  "Code Rescue": (
    <>
      <path d="M30 22c-10 0-10 8-10 16s-2 14-8 16c6 2 8 8 8 16s0 16 10 16" />
      <path d="M90 22c10 0 10 8 10 16s2 14 8 16c-6 2-8 8-8 16s0 16-10 16" />
      <ellipse cx="60" cy="60" rx="14" ry="18" />
      <path d="M60 42v36M48 50l-8-6M72 50l8-6M46 62h-8M74 62h8M48 74l-8 6M72 74l8 6" />
      <path d="M54 40l-4-8M66 40l4-8" />
    </>
  ),
  "Pixel Protocol": (
    <>
      <path d="M16 16h16v16H16zM32 32h16v16H32zM16 48h16v16H16zM48 16h16v16H48z" />
      <path d="M64 96c10-30 30-40 42-38" />
      <circle cx="64" cy="96" r="4" />
      <circle cx="106" cy="58" r="4" />
      <path d="M64 96l-18-26M106 58l-4-26" />
      <path d="M82 88l10-10 8 8-10 10z" />
    </>
  ),
  "Forensic Alibi": (
    <>
      <circle cx="50" cy="50" r="30" />
      <path d="M72 72l30 30" strokeWidth="6" />
      <path d="M38 54c0-8 5-14 12-14s12 6 12 14" />
      <path d="M32 58c0-12 8-22 18-22s18 10 18 22" />
      <path d="M44 62c0-5 2-8 6-8s6 3 6 8v6" />
      <path d="M50 62v10" />
    </>
  ),
  "Prompt Arena": (
    <>
      <path d="M18 24h64a8 8 0 018 8v34a8 8 0 01-8 8H46l-16 14V74H18a8 8 0 01-8-8V32a8 8 0 018-8z" />
      <path d="M26 42h40M26 54h28" />
      <path d="M96 70l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
      <path d="M100 30l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    </>
  ),

  // ---------- Senior · Non-technical ----------
  "Rhythm Riot": (
    <>
      <path d="M40 86V30l52-10v56" />
      <path d="M40 44l52-10" />
      <ellipse cx="30" cy="86" rx="10" ry="8" />
      <ellipse cx="82" cy="76" rx="10" ry="8" />
      <path d="M14 30c4-6 10-6 14 0M100 96c4-6 10-6 14 0" />
    </>
  ),
  "Hidden Frames": (
    <>
      <rect x="14" y="22" width="92" height="76" rx="4" />
      <path d="M14 36h92M14 84h92" />
      <path d="M22 26v6M34 26v6M46 26v6M58 26v6M70 26v6M82 26v6M94 26v6" />
      <path d="M22 88v6M34 88v6M46 88v6M58 88v6M70 88v6M82 88v6M94 88v6" />
      <path d="M34 60c8-12 44-12 52 0-8 12-44 12-52 0z" />
      <circle cx="60" cy="60" r="7" />
    </>
  ),
  "Verbal Combat": (
    <>
      <path d="M12 22h46a6 6 0 016 6v24a6 6 0 01-6 6H34l-12 12V58H12a6 6 0 01-6-6V28a6 6 0 016-6z" />
      <path d="M108 52H62a6 6 0 00-6 6v24a6 6 0 006 6h24l12 12V88h10a6 6 0 006-6V58a6 6 0 00-6-6z" />
      <path d="M20 36h30M20 46h20M70 66h30M80 76h20" />
    </>
  ),
  "Blitz Hunt": (
    <>
      <circle cx="46" cy="52" r="32" />
      <path d="M46 20v6M46 78v6M14 52h6M72 52h6" />
      <path d="M36 62l6-16 14-6-6 16z" />
      <path d="M84 84l20 20M104 84l-20 20" strokeWidth="4" />
      <path d="M62 82c6 6 12 8 18 6" strokeDasharray="4 5" />
    </>
  ),
  "Plot Twist": (
    <>
      <path d="M60 32c-12-8-30-10-46-6v64c16-4 34-2 46 6 12-8 30-10 46-6V26c-16-4-34-2-46 6z" />
      <path d="M60 32v64" />
      <path d="M72 50c16-6 26 6 18 16s-22 4-16-6" />
      <path d="M86 70l6 2-2 6" />
      <path d="M24 44h24M24 56h20" />
    </>
  ),
  "Team Feud": (
    <>
      <path d="M30 98V62h60v36" />
      <path d="M20 98h80" />
      <path d="M44 62V50h32v12" />
      <ellipse cx="60" cy="42" rx="18" ry="6" />
      <path d="M42 42c0-10 8-18 18-18s18 8 18 18" />
      <path d="M22 22l8 8M98 22l-8 8M60 10v8" />
    </>
  ),
  "Cap Chaos": (
    <>
      <path d="M24 86L48 24l24 62z" />
      <path d="M32 66h32M40 46h16" />
      <circle cx="48" cy="20" r="5" />
      <rect x="74" y="58" width="34" height="34" rx="6" transform="rotate(12 91 75)" />
      <circle cx="84" cy="70" r="2.5" />
      <circle cx="98" cy="82" r="2.5" />
      <circle cx="92" cy="74" r="2.5" />
      <path d="M14 30l6 4M82 30l8-6M100 44l8 2" />
    </>
  ),
  "Clash Squad E-Sports": (
    <>
      <path d="M34 40h52c14 0 22 14 24 34 1 12-8 18-16 12l-14-12H40L26 86c-8 6-17 0-16-12 2-20 10-34 24-34z" />
      <path d="M36 54v16M28 62h16" />
      <circle cx="82" cy="56" r="3.5" />
      <circle cx="92" cy="66" r="3.5" />
      <path d="M54 52h12" />
    </>
  ),

  // ---------- Junior · Technical ----------
  "Byte Rush": (
    <>
      <path d="M16 20h58a8 8 0 018 8v32a8 8 0 01-8 8H44L28 82V68H16a8 8 0 01-8-8V28a8 8 0 018-8z" />
      <path d="M36 36a9 9 0 1118 2c0 6-9 7-9 13" />
      <circle cx="45" cy="58" r="1.5" />
      <path d="M96 42L84 70h14l-8 28 22-36H98l8-20z" />
    </>
  ),
  "Prompt Wars": (
    <>
      <rect x="14" y="24" width="72" height="60" rx="4" />
      <path d="M14 72l20-20 16 14 12-10 24 18" />
      <circle cx="64" cy="42" r="7" />
      <path d="M96 60l4 10 10 4-10 4-4 10-4-10-10-4 10-4z" />
      <path d="M98 18l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" />
    </>
  ),
  "Vision Forge": (
    <>
      <path d="M44 72c0-8-12-14-12-30a24 24 0 0148 0c0 16-12 22-12 30z" />
      <path d="M46 82h28M50 92h20" />
      <path d="M56 50l4 8 4-8" />
      <path d="M92 60c10-10 18-12 22-12 0 4-2 12-12 22z" />
      <path d="M92 60l-8 2 10 10 2-8M86 76l-6 6" />
      <path d="M14 24l6 4M100 20l-6 6" />
    </>
  ),
  "Cipher Quest": (
    <>
      <circle cx="42" cy="46" r="28" />
      <circle cx="42" cy="46" r="16" />
      <path d="M42 18v6M42 68v6M14 46h6M64 46h6M22 26l4 4M58 62l4 4M62 26l-4 4M26 62l-4 4" />
      <circle cx="84" cy="80" r="10" />
      <path d="M92 74l16-16M102 64l6 6M96 70l6 6" />
    </>
  ),
  "TRACE//X": (
    <>
      <path d="M12 94h20v-16h18v-20h16" />
      <path d="M12 24h24v14h14" />
      <circle cx="12" cy="94" r="3" />
      <circle cx="12" cy="24" r="3" />
      <circle cx="72" cy="54" r="24" />
      <path d="M90 72l20 20" strokeWidth="6" />
      <path d="M62 50l6 6 12-12" />
    </>
  ),

  // ---------- Junior · Non-technical ----------
  "Mind Merge": (
    <>
      <path d="M12 34h24a8 8 0 1116 0h14v18a8 8 0 110 16v18H12V68a8 8 0 100-16z" />
      <path d="M66 52a8 8 0 1116 0h26v34H82a8 8 0 10-16 0z" />
    </>
  ),
  "Whatzit?": (
    <>
      <circle cx="50" cy="50" r="32" />
      <path d="M74 74l30 30" strokeWidth="6" />
      <path d="M40 40a10 10 0 1120 2c0 7-10 8-10 15" />
      <circle cx="50" cy="66" r="1.5" />
      <path d="M22 22l6 6M78 22l-6 6" />
    </>
  ),
  Actventure: (
    <>
      <path d="M22 48h14l44-22v68L36 72H22z" />
      <path d="M36 72l6 24h12l-4-20" />
      <path d="M92 44c6 4 6 20 0 24M100 36c10 8 10 32 0 40" />
    </>
  ),
  Seekret: (
    <>
      <path d="M34 98V58c0-6 10-6 10 0V40c0-6 10-6 10 0v14V34c0-6 10-6 10 0v20V40c0-6 10-6 10 0v36c0 14-8 22-22 22z" />
      <path d="M88 36c6 4 6 16 0 20M96 28c10 8 10 28 0 36" />
      <path d="M16 30c4-4 8-4 12 0" />
    </>
  ),
  Huntify: (
    <>
      <circle cx="44" cy="62" r="30" />
      <path d="M44 62V44M44 62l12 8" />
      <path d="M38 24h12M44 24v8M68 34l6-6" />
      <path d="M84 70h24v12H84zM90 82h24v12H90zM78 94h24v12H78z" />
    </>
  ),
  "Stack N' Dash": (
    <>
      <path d="M50 96l6-24h20l6 24zM40 72l6-24h20l6 24zM60 72l6-24h20l6 24zM50 48l6-24h20l6 24z" />
      <path d="M8 50h22M14 64h18M8 78h24" />
    </>
  ),
};

// Generic motifs for any event without its own art.
const FALLBACK = {
  technical: (
    <>
      <circle cx="60" cy="60" r="12" />
      <path d="M60 48V20M60 72v28M48 60H20M72 60h28M52 52L32 32M68 68l20 20" />
      <circle cx="60" cy="18" r="4" />
      <circle cx="18" cy="60" r="4" />
      <circle cx="102" cy="60" r="4" />
      <circle cx="30" cy="30" r="4" />
      <circle cx="90" cy="90" r="4" />
    </>
  ),
  non_technical: (
    <>
      <path d="M60 14l10 30 32 2-25 20 9 31-26-18-26 18 9-31-25-20 32-2z" />
    </>
  ),
};

/** True when the event has its own motif (used to check coverage). */
export const hasEventArt = (name) => Object.prototype.hasOwnProperty.call(ART, name);

export default function EventArt({ event, className }) {
  const cat = event?.category === "non_technical" || event?.cat === "nontech" ? "non_technical" : "technical";
  return (
    <svg
      className={className}
      viewBox="0 0 120 120"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ART[event?.name] || FALLBACK[cat]}
    </svg>
  );
}
