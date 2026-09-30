import React, { useId } from "react";
import { useQr } from "./useQr.js";
import "./participant-id-card.css";

// Participant ID card in the HACK_NEXUS website style. Everything on the card
// comes from props; the layout is drawn with CSS and SVG. `renderIDCard` draws
// the same card on a canvas for the PNG download.
//
// Card geometry is in card units: the card is 100 units wide and 140 tall, and
// 1 unit is 1cqw in participant-id-card.css. Keep the two in sync.

export const HACKATHON = {
  name: "HACK_NEXUS",
  edition: "1.0",
  organizer: "CSE INNOVATION ALLIANCE",
  dates: "OCT 08—09",
  year: "2026",
  venue: "CAR Lab, 2nd Floor, Anna Block, Main Campus",
  reporting: "08:30 AM IST",
};

// The "↗" of the N↗ brand symbol, in a 10×10 box.
const ARROW = "M1.5 8.5L8.5 1.5M3.5 1.5H8.5V6.5";
// The large arrow cut into the corner shape, in a 100×100 box.
const BIG_ARROW = "M18 82L72 28M36 22H78V64";
const BIG_ARROW_AT = { x: 62, y: 104, scale: 0.42 };
const BLOB = { cx: 112, cy: 154, r: 52 };

export const QR_OPTIONS = { size: 480, margin: 1, dark: "#0b0f0a" };

const DEFAULT_TOKENS = {
  surface: "#11170e",
  surfaceDeep: "#080a0b",
  panel: "#172112",
  line: "#2d3924",
  lineStrong: "#3b4b2d",
  lime: "#c2f478",
  limeBright: "#d3ff97",
  limeDeep: "#7e9f45",
  text: "#edeeeb",
  soft: "#dce6d2",
  muted: "#8fa37d",
};
const cssName = (key) =>
  `--idc-${key.replace(/[A-Z]/g, (c) => `-${c.toLowerCase()}`)}`;

// Reads the colour tokens from a rendered card so the PNG matches the CSS.
export function readTokens(element) {
  if (!element) return DEFAULT_TOKENS;
  const style = getComputedStyle(element);
  return Object.fromEntries(
    Object.entries(DEFAULT_TOKENS).map(([key, fallback]) => [
      key,
      style.getPropertyValue(cssName(key)).trim() || fallback,
    ]),
  );
}

// Long names get a smaller size so they stay within the card.
function nameStyle(name) {
  if (name.length <= 20) return { size: 6.2, lines: 2 };
  if (name.length <= 30) return { size: 5.4, lines: 2 };
  return { size: 4.7, lines: 3 };
}

// College and venue span the full row; up to four fields fill two columns.
function detailFields(card, event) {
  const pairs = [
    ["Team", card.teamName],
    ["Team ID", card.teamId],
    ["Department", card.department],
    ["Year", card.year],
    ["Domain", card.domain],
    ["Reporting", event.reporting],
  ]
    .filter(([, value]) => value)
    .slice(0, 4);
  return [
    ...(card.college ? [["College", card.college, true]] : []),
    ...pairs,
    ...(event.venue ? [["Venue", event.venue, true]] : []),
  ];
}

const initials = (name) =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((word) => word[0].toUpperCase())
    .join("");

// Short codes ("K7MQ-X2RT") print on one line; older 32-character codes
// print as two groups of four per line.
const isShortCode = (code) => code.length <= 9;
function codeLines(code) {
  if (!code) return [];
  if (isShortCode(code)) return [code];
  const groups = code.split(" ");
  const lines = [];
  for (let i = 0; i < groups.length; i += 2)
    lines.push(groups.slice(i, i + 2).join(" "));
  return lines;
}

const eventDate = (event) => `${event.dates} · ${event.year}`;

function Wordmark({ name }) {
  return name.split("_").map((part, i) => (
    <React.Fragment key={i}>
      {i > 0 && <span className="idc-underscore">_</span>}
      {part}
    </React.Fragment>
  ));
}

export function ParticipantIDCard({
  ref,
  name,
  participantId,
  photo,
  role = "Participant",
  college,
  department,
  year,
  teamName,
  teamId,
  domain,
  qrValue,
  qrCode,
  code,
  event = HACKATHON,
}) {
  const generated = useQr(qrCode ? "" : qrValue, QR_OPTIONS);
  const qr = qrCode || generated;
  const id = useId().replace(/[^a-zA-Z0-9]/g, "");
  const { size, lines } = nameStyle(name);
  const fields = detailFields(
    { college, department, year, teamName, teamId, domain },
    event,
  );
  return (
    <div className="idc-frame">
      <article
        ref={ref}
        className="idc"
        aria-label={`${event.name} ${event.edition} ID card for ${name}`}
      >
        <svg
          className="idc-art"
          viewBox="0 0 100 140"
          preserveAspectRatio="none"
          aria-hidden="true"
        >
          <defs>
            <linearGradient
              id={`${id}-blob`}
              x1="62"
              y1="104"
              x2="100"
              y2="140"
              gradientUnits="userSpaceOnUse"
            >
              <stop
                offset="0"
                style={{ stopColor: "var(--idc-lime-bright)" }}
              />
              <stop offset="0.5" style={{ stopColor: "var(--idc-lime)" }} />
              <stop offset="1" style={{ stopColor: "var(--idc-lime-deep)" }} />
            </linearGradient>
            <clipPath id={`${id}-clip`}>
              <circle cx={BLOB.cx} cy={BLOB.cy} r={BLOB.r} />
            </clipPath>
          </defs>
          <circle
            cx={BLOB.cx}
            cy={BLOB.cy}
            r={BLOB.r}
            fill={`url(#${id}-blob)`}
          />
          <g clipPath={`url(#${id}-clip)`}>
            <path
              className="idc-big-arrow"
              d={BIG_ARROW}
              transform={`translate(${BIG_ARROW_AT.x} ${BIG_ARROW_AT.y}) scale(${BIG_ARROW_AT.scale})`}
            />
          </g>
        </svg>
        <span className="idc-slot" aria-hidden="true" />

        <div className="idc-brand">
          <span className="idc-symbol" aria-hidden="true">
            N
            <svg viewBox="0 0 10 10">
              <path className="idc-symbol-cut" d={ARROW} />
              <path d={ARROW} />
            </svg>
          </span>
          <p className="idc-wordmark">
            <strong>
              <Wordmark name={event.name} />
            </strong>
            <small>
              {event.edition} / {event.organizer}
            </small>
          </p>
        </div>
        <p className="idc-chip">
          <i aria-hidden="true" />
          {eventDate(event)}
        </p>
        <span className="idc-rule" aria-hidden="true" />

        <div className="idc-identity">
          <div className="idc-photo">
            {photo ? (
              <img src={photo} alt={`Photo of ${name}`} />
            ) : (
              <span aria-hidden="true">{initials(name)}</span>
            )}
          </div>
          <div className="idc-info">
            <p className="idc-role">
              <span aria-hidden="true">+</span>
              {role}
            </p>
            <h2
              className="idc-name"
              style={{ "--idc-name-size": size, WebkitLineClamp: lines }}
            >
              {name}
            </h2>
            {participantId && (
              <dl className="idc-pid">
                <dt>Participant ID</dt>
                <dd>{participantId}</dd>
              </dl>
            )}
          </div>
        </div>

        <dl className="idc-details">
          {fields.map(([label, value, wide]) => (
            <div key={label} className={wide ? "idc-wide" : undefined}>
              <dt>{label}</dt>
              <dd title={value}>{value}</dd>
            </div>
          ))}
        </dl>

        <div className="idc-qr">
          {qr && <img src={qr} alt={`Check-in QR code for ${name}`} />}
        </div>
        <div className="idc-code">
          <p>Check-in code</p>
          {code && (
            <p
              className={`idc-code-value${isShortCode(code) ? " idc-code-short" : ""}`}
              aria-label={code}
            >
              {codeLines(code).map((line) => (
                <span key={line}>{line}</span>
              ))}
            </p>
          )}
          <p className="idc-code-note">Show at entry</p>
        </div>
        <span className="idc-shine" aria-hidden="true" />
      </article>
    </div>
  );
}

// ---------------------------------------------------------------------------
// PNG rendering. Mirrors the CSS layout above, unit for unit.

const HEADING = '"Space Grotesk", Arial, sans-serif';
const BODY = '"Manrope", Arial, sans-serif';
const MONO = '"Courier New", monospace';

function withAlpha(color, alpha) {
  const hex = color.replace("#", "");
  if (!/^([0-9a-f]{3}|[0-9a-f]{6})$/i.test(hex)) return color;
  const full = hex.length === 3 ? [...hex].map((c) => c + c).join("") : hex;
  const [r, g, b] = [0, 2, 4].map((i) => parseInt(full.slice(i, i + 2), 16));
  return `rgba(${r},${g},${b},${alpha})`;
}

function loadImage(src, crossOrigin) {
  if (!src) return Promise.resolve(null);
  const image = new Image();
  if (crossOrigin) image.crossOrigin = "anonymous";
  image.src = src;
  return image.decode().then(
    () => image,
    () => null,
  );
}

// Draws the card at `scale` pixels per card unit and returns a PNG data URL.
export async function renderIDCard(
  card,
  { tokens = DEFAULT_TOKENS, scale = 12 } = {},
) {
  const event = card.event || HACKATHON;
  const role = card.role || "Participant";
  await Promise.all(
    [
      `700 40px ${HEADING}`,
      `650 40px ${HEADING}`,
      `600 40px ${HEADING}`,
      `500 40px ${HEADING}`,
      `600 40px ${BODY}`,
    ].map((font) => document.fonts.load(font)),
  );
  const [qr, photo] = await Promise.all([
    loadImage(card.qrCode),
    loadImage(card.photo, true),
  ]);

  const u = (value) => value * scale;
  const canvas = document.createElement("canvas");
  canvas.width = u(100);
  canvas.height = u(140);
  const ctx = canvas.getContext("2d");
  const t = tokens;

  // Letter spacing is given in em, like the CSS.
  const font = (weight, size, family, em = 0) => {
    ctx.font = `${weight} ${u(size)}px ${family}`;
    if ("letterSpacing" in ctx) ctx.letterSpacing = `${u(em * size)}px`;
  };
  const width = (text) => ctx.measureText(text).width / scale;
  // Text is positioned by the middle of its CSS line box.
  const text = (value, x, top, lineHeight, align = "left") => {
    ctx.textAlign = align;
    ctx.textBaseline = "middle";
    ctx.fillText(value, u(x), u(top + lineHeight / 2));
  };
  // Wraps to `maxLines`, ending a cut-off line with an ellipsis.
  const wrap = (value, maxWidth, maxLines) => {
    const lines = [];
    let line = "";
    for (const word of value.split(/\s+/)) {
      const next = line ? `${line} ${word}` : word;
      if (line && width(next) > maxWidth) {
        lines.push(line);
        line = word;
      } else line = next;
    }
    lines.push(line);
    if (lines.length <= maxLines) return lines;
    const kept = lines.slice(0, maxLines);
    let last = `${kept[maxLines - 1]} ${lines[maxLines]}`;
    while (last.length > 1 && width(`${last}…`) > maxWidth)
      last = last.slice(0, -1).trimEnd();
    kept[maxLines - 1] = `${last}…`;
    return kept;
  };
  const gradient = (x1, y1, x2, y2, stops) => {
    const g = ctx.createLinearGradient(u(x1), u(y1), u(x2), u(y2));
    for (const [offset, color] of stops) g.addColorStop(offset, color);
    return g;
  };
  const roundRect = (x, y, w, h, r) => {
    ctx.beginPath();
    ctx.roundRect(u(x), u(y), u(w), u(h), u(r));
  };
  // Strokes an SVG path drawn in its own box, placed at x, y and scaled by s.
  const strokePath = (d, x, y, s, lineWidth, style) => {
    ctx.save();
    ctx.translate(u(x), u(y));
    ctx.scale(u(s), u(s));
    ctx.strokeStyle = style;
    ctx.lineWidth = lineWidth;
    ctx.lineCap = "square";
    ctx.lineJoin = "miter";
    ctx.stroke(new Path2D(d));
    ctx.restore();
  };
  const label = (value, x, top, color = t.muted) => {
    font(700, 2.2, MONO, 0.12);
    ctx.fillStyle = color;
    text(value.toUpperCase(), x, top, 2.2 * 1.2);
  };

  // Card surface
  ctx.save();
  roundRect(0, 0, 100, 140, 5);
  ctx.clip();
  // linear-gradient(160deg, …) spans the CSS gradient line.
  const angle = (160 * Math.PI) / 180;
  const half =
    (Math.abs(100 * Math.sin(angle)) + Math.abs(140 * Math.cos(angle))) / 2;
  const [dx, dy] = [Math.sin(angle) * half, -Math.cos(angle) * half];
  ctx.fillStyle = gradient(50 - dx, 70 - dy, 50 + dx, 70 + dy, [
    [0, t.surface],
    [0.5, t.surface],
    [1, t.surfaceDeep],
  ]);
  ctx.fillRect(0, 0, u(100), u(140));
  // radial-gradient(90% 55% at 100% 0%, …)
  ctx.save();
  ctx.translate(u(100), 0);
  ctx.scale(90 / 77, 1);
  const glow = ctx.createRadialGradient(0, 0, 0, 0, 0, u(77));
  glow.addColorStop(0, withAlpha(t.lime, 0.1));
  glow.addColorStop(0.6, withAlpha(t.lime, 0));
  ctx.fillStyle = glow;
  ctx.fillRect(-u(200), 0, u(400), u(140));
  ctx.restore();

  // Corner shape with the arrow cut into it
  ctx.save();
  ctx.beginPath();
  ctx.arc(u(BLOB.cx), u(BLOB.cy), u(BLOB.r), 0, Math.PI * 2);
  ctx.fillStyle = gradient(62, 104, 100, 140, [
    [0, t.limeBright],
    [0.5, t.lime],
    [1, t.limeDeep],
  ]);
  ctx.fill();
  ctx.clip();
  ctx.globalAlpha = 0.88;
  strokePath(
    BIG_ARROW,
    BIG_ARROW_AT.x,
    BIG_ARROW_AT.y,
    BIG_ARROW_AT.scale,
    14,
    t.surfaceDeep,
  );
  ctx.restore();

  // Card edge and slot rim; the slot itself is cut out at the end.
  roundRect(0.1, 0.1, 99.8, 139.8, 4.9);
  ctx.strokeStyle = t.line;
  ctx.lineWidth = u(0.2);
  ctx.stroke();
  roundRect(40.4, 3.9, 19.2, 4.8, 2.4);
  ctx.fillStyle = t.line;
  ctx.fill();

  // Brand: N↗ symbol, wordmark, organizer line
  font(700, 8.6, HEADING);
  ctx.fillStyle = t.lime;
  text("N", 8, 11.5, 8);
  strokePath(ARROW, 12, 10.6, 0.42, 3, t.surface);
  strokePath(ARROW, 12, 10.6, 0.42, 1.5, t.lime);
  font(650, 5.4, HEADING, -0.035);
  let x = 17.8;
  event.name.split("_").forEach((part, i) => {
    if (i > 0) {
      ctx.fillStyle = t.lime;
      text("_", x, 11.11, 5.4);
      x += width("_");
    }
    ctx.fillStyle = t.text;
    text(part, x, 11.11, 5.4);
    x += width(part);
  });
  font(700, 1.9, MONO, 0.14);
  ctx.fillStyle = t.muted;
  text(`${event.edition} / ${event.organizer}`, 17.8, 17.61, 1.9 * 1.2);

  // Date chip, right-aligned with the brand
  font(700, 1.9, MONO, 0.12);
  const chipText = eventDate(event);
  const chipWidth = 0.5 + 3 + 0.9 + 1 + width(chipText);
  const chipLeft = 92 - chipWidth;
  roundRect(chipLeft + 0.125, 13.235, chipWidth - 0.25, 4.53, 0.6);
  ctx.strokeStyle = t.lineStrong;
  ctx.lineWidth = u(0.25);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(u(chipLeft + 1.75 + 0.45), u(15.5), u(0.45), 0, Math.PI * 2);
  ctx.fillStyle = t.lime;
  ctx.fill();
  ctx.fillStyle = t.soft;
  text(chipText, chipLeft + 1.75 + 0.9 + 1, 15.5 - 1.14, 2.28);

  // Rule under the brand
  ctx.fillStyle = t.line;
  ctx.fillRect(u(8), u(22), u(84), u(0.2));

  // Photo
  roundRect(8, 25.5, 24, 30, 2);
  ctx.fillStyle = t.panel;
  ctx.fill();
  if (photo) {
    ctx.save();
    ctx.clip();
    const ratio = Math.max(
      u(24) / photo.naturalWidth,
      u(30) / photo.naturalHeight,
    );
    const [w, h] = [photo.naturalWidth * ratio, photo.naturalHeight * ratio];
    ctx.drawImage(photo, u(20) - w / 2, u(40.5) - h / 2, w, h);
    ctx.restore();
  } else {
    font(700, 9, HEADING, -0.02);
    ctx.fillStyle = t.lime;
    text(initials(card.name), 20, 40.5 - 4.5, 9, "center");
  }
  roundRect(8.15, 25.65, 23.7, 29.7, 1.85);
  ctx.strokeStyle = t.lineStrong;
  ctx.lineWidth = u(0.3);
  ctx.stroke();

  // Role, name and participant ID, centred against the photo
  const name = nameStyle(card.name);
  font(600, name.size, HEADING, -0.03);
  const nameLines = wrap(card.name, 55, name.lines);
  const infoHeight =
    2.3 * 1.4 +
    1.4 +
    nameLines.length * name.size * 1.04 +
    (card.participantId ? 2.6 + 2.2 * 1.2 + 0.7 + 3.6 * 1.2 : 0);
  let y = 25.5 + (30 - infoHeight) / 2;
  font(700, 2.3, MONO, 0.16);
  ctx.fillStyle = t.lime;
  text("+", 37, y, 2.3 * 1.4);
  const roleLeft = 37 + width("+") + 1;
  text(wrap(role.toUpperCase(), 92 - roleLeft, 1)[0], roleLeft, y, 2.3 * 1.4);
  y += 2.3 * 1.4 + 1.4;
  font(600, name.size, HEADING, -0.03);
  ctx.fillStyle = t.text;
  for (const line of nameLines) {
    text(line, 37, y, name.size * 1.04);
    y += name.size * 1.04;
  }
  if (card.participantId) {
    y += 2.6;
    label("Participant ID", 37, y);
    y += 2.2 * 1.2 + 0.7;
    font(500, 3.6, HEADING, 0.03);
    ctx.fillStyle = t.soft;
    text(card.participantId, 37, y, 3.6 * 1.2);
  }

  // Details: two columns; college and venue span both.
  y = 59;
  let column = 0;
  let rowHeight = 0;
  for (const [field, value, wide] of detailFields(card, event)) {
    if (wide || column === 2) {
      if (column) y += rowHeight + 2.4;
      column = 0;
      rowHeight = 0;
    }
    const left = 8 + column * (39.5 + 5);
    label(field, left, y);
    font(600, 3.3, BODY);
    ctx.fillStyle = t.soft;
    const lines = wrap(value, wide ? 84 : 39.5, wide ? 2 : 1);
    lines.forEach((line, i) =>
      text(line, left, y + 2.2 * 1.2 + 0.8 + i * 3.3 * 1.28, 3.3 * 1.28),
    );
    rowHeight = Math.max(
      rowHeight,
      2.2 * 1.2 + 0.8 + lines.length * 3.3 * 1.28,
    );
    column = wide ? 2 : column + 1;
  }

  // QR and printed code
  roundRect(8, 103, 30, 30, 1.6);
  ctx.fillStyle = "#ffffff";
  ctx.fill();
  if (qr) {
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(qr, u(9.6), u(104.6), u(26.8), u(26.8));
    ctx.imageSmoothingEnabled = true;
  }
  label("Check-in code", 42, 103.4, t.lime);
  const codeTop = 103.4 + 2.2 * 1.2 + 1.4;
  if (card.code && isShortCode(card.code)) {
    font(700, 4.4, MONO, 0.06);
    ctx.fillStyle = t.text;
    text(card.code, 42, codeTop, 4.4 * 1.2);
  } else {
    font(700, 2.5, MONO, 0.06);
    ctx.fillStyle = t.soft;
    codeLines(card.code).forEach((line, i) =>
      text(line, 42, codeTop + i * 2.5 * 1.45, 2.5 * 1.45),
    );
  }
  label("Show at entry", 42, 133 - 2.2 * 1.2);

  // Cut out the lanyard slot.
  ctx.globalCompositeOperation = "destination-out";
  roundRect(41, 4.5, 18, 3.6, 1.8);
  ctx.fill();
  ctx.restore();
  return canvas.toDataURL("image/png");
}
