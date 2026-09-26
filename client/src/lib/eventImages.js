/**
 * Official senior event icons, keyed by the event's `name` from the API.
 * Files live in client/public/icons/events/ as 256px WebP (~10 KB each),
 * converted from the design team's PNG originals (1-4 MB each). Events with
 * no icon (Hidden Frames, junior events) get a monogram tile instead - see
 * EventRow in pages/Register.jsx.
 *
 * To add one: save a square-ish WebP as icons/events/<slug>.webp and add the
 * event name below.
 */
const ICONS = {
  "Code Rescue": "code-rescue",
  "Crypt Clash": "crypt-clash",
  "Forensic Alibi": "forensic-alibi",
  "Hack Nexus": "hack-nexus",
  "Pen Your Vision": "pen-your-vision",
  "Pixel Protocol": "pixel-protocol",
  "Prompt Arena": "prompt-arena",
  "Trial of Truth": "trial-of-truth",
  "Blitz Hunt": "blitz-hunt",
  "Cap Chaos": "cap-chaos",
  "Plot Twist": "plot-twist",
  "Rhythm Riot": "rhythm-riot",
  "Team Feud": "team-feud",
  "Clash Squad E-Sports": "clash-squad-e-sports",
  "Verbal Combat": "verbal-combat",
};

export function getEventIconSrc(event) {
  const slug = ICONS[event.name];
  return slug ? `/icons/events/${slug}.webp` : null;
}
