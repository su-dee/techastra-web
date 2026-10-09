// Participation certificates for checked-in squads, on the same organiser
// template as the Techastra '26 senior events (techweb/server/utils/
// certificatePdf.js): Sr_Part.PDF's page image, with the member's name and
// college and the event name in black Lora Bold Italic.
import { readFileSync } from "node:fs";
import { PDFDocument, rgb } from "pdf-lib";
import fontkit from "@pdf-lib/fontkit";

const EVENT_NAME = "Hack Nexus";
export const TITLES = ["Mr", "Ms"];

const asset = (name) =>
  readFileSync(new URL(`./assets/certificate/${name}`, import.meta.url));
let assets = null;
const loadAssets = () =>
  (assets ||= {
    background: asset("participation-senior.jpg"),
    font: asset("lora-700-italic.ttf"),
  });

// A4 landscape, like the template. Its blank lines, in points from the
// bottom left: [left end, right end, text baseline].
const PAGE = [842.16, 595.44];
const LINES = {
  name: [251, 741, 217],
  college: [75, 764, 182.5],
  event: [208, 520, 148],
};

/** "Mr. Arjun Ramesh" - the prefix the organisers gave, then the name. */
export const certificateName = (member) =>
  `${TITLES.includes(member.title) ? `${member.title}. ` : ""}${member.full_name}`;

/** Writes text centred on a blank line, shrinking it until it fits. */
function fillLine(page, text, font, maxSize, [left, right, y]) {
  const supported = new Set(font.getCharacterSet());
  const value = [...String(text || "")]
    .filter((ch) => supported.has(ch.codePointAt(0)))
    .join("")
    .replace(/\s+/g, " ")
    .trim();
  if (!value) return;
  let size = maxSize;
  while (size > 8 && font.widthOfTextAtSize(value, size) > right - left - 8)
    size -= 0.5;
  const width = font.widthOfTextAtSize(value, size);
  page.drawText(value, {
    x: left + (right - left - width) / 2,
    y,
    size,
    font,
    color: rgb(0, 0, 0),
  });
}

/**
 * One PDF with a page per member, in the order given. `members` are rows
 * with full_name, college and title.
 */
export async function certificatesPdf(members, title = `${EVENT_NAME} certificates`) {
  const { background, font: fontBytes } = loadAssets();
  const doc = await PDFDocument.create();
  doc.registerFontkit(fontkit);
  doc.setTitle(`Techastra '26 ${title}`);
  const image = await doc.embedJpg(background);
  const font = await doc.embedFont(fontBytes, { subset: true });
  for (const member of members) {
    const page = doc.addPage(PAGE);
    page.drawImage(image, { x: 0, y: 0, width: PAGE[0], height: PAGE[1] });
    fillLine(page, certificateName(member), font, 21, LINES.name);
    fillLine(page, member.college, font, 19, LINES.college);
    fillLine(page, EVENT_NAME, font, 20, LINES.event);
  }
  return Buffer.from(await doc.save());
}

/** "Priya-Lakshmi-S" for file names. */
export const fileSafe = (text) =>
  String(text || "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "") || "member";

// Squads see their certificates on their dashboard only once the organisers
// release them (Admin -> Certificates).
const RELEASED_KEY = "certificates_released";
export async function certificatesReleased(db) {
  try {
    const result = await db.query("SELECT value FROM app_settings WHERE key=$1", [RELEASED_KEY]);
    return result.rows[0]?.value === true;
  } catch (error) {
    // Before migration 010 has run there's no settings table: not released.
    if (error.code === "42P01") return false;
    throw error;
  }
}
export async function setCertificatesReleased(db, released, by) {
  await db.query(
    `INSERT INTO app_settings (key,value,updated_at,updated_by) VALUES ($1,$2,NOW(),$3)
     ON CONFLICT (key) DO UPDATE SET value=EXCLUDED.value,updated_at=NOW(),updated_by=EXCLUDED.updated_by`,
    [RELEASED_KEY, JSON.stringify(released), by],
  );
}
