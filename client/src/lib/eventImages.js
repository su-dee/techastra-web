/**
 * Central mapping of event/section name -> a themed photo URL.
 *
 * WHY THIS FILE EXISTS: every image on the public pages was a plain CSS
 * gradient standing in for a photo. Rather than hardcoding image URLs
 * inside every page component, they're collected here in one place so
 * any single photo can be swapped (or replaced with your own uploaded
 * asset under client/public/) by editing exactly one line.
 *
 * ROOT-CAUSE FIX (2nd round of the "video/image not showing" investigation
 * - this specific bug was caught via the browser's Network tab, which
 * showed `net::ERR_*` failures for one of these URLs):
 *
 * This file previously used `images.unsplash.com/photo-<id>` URLs with
 * IDs that were hand-picked/guessed by a prior pass without any way to
 * verify they were real Unsplash photo IDs (the file's own old comments
 * admitted as much: "have NOT been visually verified"). On investigation,
 * EVERY SINGLE ID in this file 404s - including the ones that were
 * claimed to be "already proven to load correctly elsewhere in this
 * app". That claim was never actually true; the whole file was
 * fabricated IDs, not just the one the Network tab happened to catch.
 *
 * Fix: switched to Lorem Picsum (`picsum.photos/seed/<seed>/<w>/<h>`) -
 * a real, stable, keyless placeholder-photo service (verified live via
 * direct HTTP GET before writing this, unlike the previous approach).
 * Each seed deterministically maps to the same photo every time, so
 * every event/section keeps a stable, distinct image with zero chance
 * of a dead/fabricated ID, and zero API key required.
 *
 * These are still generic placeholder photos, not hand-curated
 * theme-matched photography - swap any of these for your own uploaded
 * asset under client/public/ whenever you have real event photography
 * ready (see "TO SWAP A PHOTO" below).
 *
 * TO SWAP A PHOTO: replace the URL string for that key below. To use
 * your own uploaded photo instead of an external URL, put the file in
 * client/public/events/<name>.jpg and set the value to "/events/<name>.jpg".
 */

const PICSUM = (seed, w = 1200, h = 800) =>
  `https://picsum.photos/seed/${seed}/${w}/${h}`;

/** Keyed by the event's `name` field exactly as it comes back from the API. */
export const EVENT_IMAGES = {
  // ---- TECHNICAL (8) ----
  "Pen Your Vision": PICSUM("pen-your-vision"),
  "Hack Nexus": PICSUM("hack-nexus"),
  "Crypt Clash": PICSUM("crypt-clash"),
  "Trial of Truth": PICSUM("trial-of-truth"),
  "Code Rescue": PICSUM("code-rescue"),
  "Pixel Protocol": PICSUM("pixel-protocol"),
  "Forensic Alibi": PICSUM("forensic-alibi"),
  "Prompt Arena": PICSUM("prompt-arena"),

  // ---- NON-TECHNICAL (7) ----
  "Rhythm Riot": PICSUM("rhythm-riot"),
  "Hidden Frames": PICSUM("hidden-frames"),
  "Verbal Combat": PICSUM("verbal-combat"),
  "Blitz Hunt": PICSUM("blitz-hunt"),
  "Plot Twist": PICSUM("plot-twist"),
  "Team Feud": PICSUM("team-feud"),
  "Cap Chaos": PICSUM("cap-chaos"),
};

/**
 * Generic cover images for the mega-menu's category headers
 * (Section 5D). Shown on the right image panel when a user hovers
 * "Technical" / "Non-Technical" before drilling into a specific event.
 */
export const CATEGORY_IMAGES = {
  technical: PICSUM("category-technical", 1600, 900),
  non_technical: PICSUM("category-non-technical", 1600, 900),
};

/** Generic fallback for any event name not explicitly mapped above (e.g. once real events replace the seed data). */
export const DEFAULT_EVENT_IMAGE = PICSUM("techastra-default-event");

/**
 * Generic cover/backdrop imagery used across this Registration Portal
 * app's own pages - NOT a homepage hero carousel (this app has no
 * homepage of its own; that lives on the separate main marketing site
 * per the scope correction). Current uses:
 *   - `intro`  - Login.jsx's split-screen photo backdrop
 *   - `flagship` - FullScreenMenu's generic cover for "Events" (before
 *      drilling into Technical/Non-Technical) and "My Dashboard"/"Help
 *      Desk" rows
 *   - `registrations` - FullScreenMenu's cover for "Verify Certificate"
 */
export const HERO_IMAGES = {
  intro: PICSUM("techastra-hero-intro", 1920, 1080),
  flagship: PICSUM("techastra-hero-flagship", 1920, 1080),
  registrations: PICSUM("techastra-hero-registrations", 1920, 1080),
};

export function getEventImage(eventName) {
  return EVENT_IMAGES[eventName] || DEFAULT_EVENT_IMAGE;
}

/**
 * Per-event custom icon/emblem path (replaces the stock/Picsum photo in
 * the Events carousel cards, one icon per event).
 *
 * REAL FOLDER STRUCTURE (confirmed via an actual recursive directory
 * listing of client/public/icons/ - NOT assumed/guessed, after three
 * prior guesses at this path were all wrong):
 *
 *   client/public/icons/senior-techastra/
 *     Senior Techastra icons/
 *       Technical Events/
 *         CODE RESCUE.png
 *         Crypt clash.png
 *         FORENSIC ALIBI.png
 *         Hack nexus.png
 *         pen your vision.png
 *         Pixel protocol.png
 *         Prompt arena.png
 *         TRIAL OF TRUTH.png
 *       Non-Technical Events/
 *         70mm DECODE.png        <- old event name, not used
 *         BLITZ HUNT.png
 *         CAP CHAOS.png
 *         Free fire.png          <- Clash Squad E-Sports
 *         plot twist.png
 *         RHYTHM RIOT.png
 *         Team FUED.png
 *         VERBAL COMBAT.png
 *
 * WHY THIS IS AN EXPLICIT MAP, NOT A DERIVED PATH: the filenames don't
 * consistently match `event.name` even case-insensitively - most just
 * differ in capitalization, but some are different words entirely
 * ("Team FUED.png" for Team Feud, "Free fire.png" for Clash Squad
 * E-Sports). No string transform derives one from the other,
 * so a lookup table keyed by the exact `event.name` is the only
 * reliable option, same pattern as EVENT_IMAGES above.
 *
 * Filenames legitimately contain spaces (both in the two folder
 * segments and the .png names themselves) - `encodeURIComponent` on
 * each path SEGMENT (not the whole path, which would also encode the
 * `/` separators) handles that correctly for use as a URL/`src`.
 */
const ICON_BASE = "/icons/senior-techastra/Senior Techastra icons";

const EVENT_ICON_FILES = {
  // ---- TECHNICAL ----
  "Code Rescue": { folder: "Technical Events", file: "CODE RESCUE.png" },
  "Crypt Clash": { folder: "Technical Events", file: "Crypt clash.png" },
  "Forensic Alibi": { folder: "Technical Events", file: "FORENSIC ALIBI.png" },
  "Hack Nexus": { folder: "Technical Events", file: "Hack nexus.png" },
  "Pen Your Vision": { folder: "Technical Events", file: "pen your vision.png" },
  "Pixel Protocol": { folder: "Technical Events", file: "Pixel protocol.png" },
  "Prompt Arena": { folder: "Technical Events", file: "Prompt arena.png" },
  "Trial of Truth": { folder: "Technical Events", file: "TRIAL OF TRUTH.png" },

  // ---- NON-TECHNICAL ----
  "Blitz Hunt": { folder: "Non-Technical Events", file: "BLITZ HUNT.png" },
  "Cap Chaos": { folder: "Non-Technical Events", file: "CAP CHAOS.png" },
  "Plot Twist": { folder: "Non-Technical Events", file: "plot twist.png" },
  "Rhythm Riot": { folder: "Non-Technical Events", file: "RHYTHM RIOT.png" },
  "Team Feud": { folder: "Non-Technical Events", file: "Team FUED.png" },
  "Clash Squad E-Sports": { folder: "Non-Technical Events", file: "Free fire.png" },
  // Hidden Frames has no icon yet - it falls back to the stock photo.
  "Verbal Combat": { folder: "Non-Technical Events", file: "VERBAL COMBAT.png" },
};

/** Encodes each `/`-separated path segment individually, so spaces in
 * folder/file names become `%20` without also escaping the slashes
 * themselves. */
function encodePathSegments(path) {
  return path.split("/").map(encodeURIComponent).join("/");
}

/**
 * Returns the icon path for this event if one is mapped above, or `null`
 * if this event has no icon yet (or its name doesn't match the map,
 * e.g. seed-data drift) - callers fall back to the existing stock photo
 * in that case, same as any other event whose icon hasn't been added.
 */
export function getEventIconSrc(event) {
  const entry = EVENT_ICON_FILES[event.name];
  if (!entry) return null;
  return encodePathSegments(`${ICON_BASE}/${entry.folder}/${entry.file}`);
}
