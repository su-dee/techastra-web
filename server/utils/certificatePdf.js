const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fontkit = require("@pdf-lib/fontkit");
const fs = require("fs");
const path = require("path");

const certDir = path.join(__dirname, "..", "uploads", "certificates");
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

// The organisers' certificates (7 Oct 2026): participation from Sr_Part.PDF,
// winner from Sr_App.PDF. Each is the template's page image; the participant's
// details are set in black Lora Bold Italic, to stand out from the template's
// upright text (chosen by the organisers). Files are read once, when first needed.
const assetDir = path.join(__dirname, "..", "assets", "certificate");
const assets = {};
const asset = (name) => (assets[name] ||= fs.readFileSync(path.join(assetDir, name)));

// A4 landscape, like the templates. Each template's blank lines, in points
// from the bottom left: [left end, right end, text baseline].
const PAGE = [842.16, 595.44];
const TEMPLATES = {
  participation: {
    title: "Certificate of Participation",
    background: "participation-senior.jpg",
    lines: {
      name: [251, 741, 217], // "This to certify that ____ from"
      college: [75, 764, 182.5], // "____ has"
      event: [208, 520, 148], // "participated in ____ Event at Techastra'26"
    },
  },
  winner: {
    title: "Certificate of Appreciation",
    background: "winner-senior.jpg",
    lines: {
      name: [251, 741, 228.5],
      college: [75, 764, 194],
      place: [113.5, 178.5, 159.5], // the short blank before the event
      event: [245.5, 515.5, 159.5],
    },
  },
};
const PLACES = { 1: "First", 2: "Second", 3: "Third" };
const FOOTER_Y = 40; // certificate ID line, below the signatures

const STUDY_SCALE = 0.7; // department and year, after the name, are printed smaller

/**
 * Writes text centred on a blank line, shrinking it until it fits. `text`
 * is a string, or [text, scale] parts printed side by side on one baseline
 * (e.g. the department and year smaller than the name).
 */
function fillLine(page, text, font, maxSize, [left, right, y], color) {
  const supported = new Set(font.getCharacterSet());
  const clean = (t) => [...String(t || "")].filter((ch) => supported.has(ch.codePointAt(0))).join("").replace(/\s+/g, " ");
  const parts = (Array.isArray(text) ? text : [[text, 1]]).map(([t, scale]) => [clean(t), scale]).filter(([t]) => t.trim());
  if (!parts.length) return;
  parts[0][0] = parts[0][0].trimStart();
  parts[parts.length - 1][0] = parts[parts.length - 1][0].trimEnd();
  const widthAt = (size) => parts.reduce((w, [t, scale]) => w + font.widthOfTextAtSize(t, size * scale), 0);
  const room = right - left - 8;
  let size = maxSize;
  while (size > 8 && widthAt(size) > room) size -= 0.5;
  let x = left + (right - left - widthAt(size)) / 2;
  for (const [t, scale] of parts) {
    page.drawText(t, { x, y, size: size * scale, font, color });
    x += font.widthOfTextAtSize(t, size * scale);
  }
}

/**
 * Renders a certificate PDF on the organisers' template (participation or
 * winner) and saves it in uploads/certificates. Returns the file name; the
 * file is private (GET /api/certificates/:code/pdf checks who may have it).
 */
async function generateCertificatePdf({
  certificateCode,
  participantName,
  participantStudy = "", // department and year, printed smaller after the name
  eventName,
  type, // "participation" | "winner"
  position,
  collegeName,
}) {
  const template = TEMPLATES[type === "winner" ? "winner" : "participation"];
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Techastra '26 ${template.title} - ${participantName}${participantStudy}`);
  const page = doc.addPage(PAGE);
  page.drawImage(await doc.embedJpg(asset(template.background)), { x: 0, y: 0, width: PAGE[0], height: PAGE[1] });
  const font = await doc.embedFont(asset("lora-700-italic.ttf"), { subset: true });
  const ink = rgb(0, 0, 0);

  const { lines } = template;
  fillLine(page, [[participantName, 1], [participantStudy, STUDY_SCALE]], font, 21, lines.name, ink);
  fillLine(page, collegeName, font, 19, lines.college, ink);
  if (lines.place) fillLine(page, PLACES[Number(position)] || ordinal(position), font, 20, lines.place, ink);
  fillLine(page, eventName, font, 20, lines.event, ink);

  // Certificate code and where to verify it, small, below the signatures.
  const site = (process.env.CLIENT_ORIGIN || "").split(",")[0].trim().replace(/\/+$/, "").replace(/^https?:\/\//, "");
  const footer = `Certificate ID: ${certificateCode}${site ? `   |   Verify at ${site}/verify-certificate` : ""}`;
  // Helvetica: plain and small, so the code reads clearly.
  const plain = await doc.embedFont(StandardFonts.Helvetica);
  const footerSize = 7;
  const footerWidth = plain.widthOfTextAtSize(footer, footerSize);
  page.drawText(footer, { x: (PAGE[0] - footerWidth) / 2, y: FOOTER_Y, size: footerSize, font: plain, color: rgb(0.3, 0.3, 0.3) });

  const filename = `${certificateCode}.pdf`;
  fs.writeFileSync(path.join(certDir, filename), await doc.save());
  return filename;
}

/** Absolute path of a stored certificate PDF (older rows stored "/uploads/certificates/<file>"). */
const certificateFile = (stored) => path.join(certDir, path.basename(String(stored || "")));

function ordinal(n) {
  const num = Number(n);
  if (num === 1) return "1st";
  if (num === 2) return "2nd";
  if (num === 3) return "3rd";
  return `${num}th`;
}

module.exports = { generateCertificatePdf, certificateFile };
