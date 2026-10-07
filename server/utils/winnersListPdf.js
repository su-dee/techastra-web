const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/**
 * The winners list for the valedictory as a printable PDF: one section per
 * event (in day and time order), one row per person - place, team, name,
 * department, year and college. A4 landscape, Helvetica.
 *
 * `list` is winnersByEvent() from routes/certificates.js:
 * [{ event, places: [{ position, registration, people }] }].
 */
const PAGE = [841.89, 595.28];
const MARGIN = 36;
const PLACE = { 1: "1st", 2: "2nd", 3: "3rd" };
const COLUMNS = [
  { title: "Place", width: 46 },
  { title: "Team", width: 110 },
  { title: "Participant", width: 160 },
  { title: "Department", width: 120 },
  { title: "Year", width: 56 },
  { title: "College", width: 0 }, // the rest of the row
];
const SIZE = 9;
const LINE = 11.5;
const PAD = 5;
const INK = rgb(0.1, 0.1, 0.12);
const MUTED = rgb(0.4, 0.4, 0.45);
const RULE = rgb(0.82, 0.82, 0.85);
const NAVY = rgb(0.06, 0.15, 0.29);
const BAND = rgb(0.93, 0.94, 0.97);

/** Splits text into lines that fit `width`; long words are broken. */
function wrap(text, font, size, width) {
  const words = String(text || "").replace(/\s+/g, " ").trim().split(" ").filter(Boolean);
  const lines = [];
  let line = "";
  for (let word of words) {
    while (font.widthOfTextAtSize(word, size) > width) {
      let i = word.length - 1;
      while (i > 1 && font.widthOfTextAtSize(word.slice(0, i), size) > width) i--;
      if (line) lines.push(line), (line = "");
      lines.push(word.slice(0, i));
      word = word.slice(i);
    }
    const next = line ? `${line} ${word}` : word;
    if (font.widthOfTextAtSize(next, size) <= width) line = next;
    else lines.push(line), (line = word);
  }
  if (line) lines.push(line);
  return lines.length ? lines : [""];
}

// Helvetica only covers Latin-1: anything else would make pdf-lib throw.
const latin1 = (text) => String(text || "").replace(/[^\x20-\x7E\xA0-\xFF]/g, "?");

async function winnersListPdf(list, { nameOf = (person) => person.name } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle("Techastra '26 - Winners List");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const tableWidth = PAGE[0] - 2 * MARGIN;
  const widths = COLUMNS.map((c) => c.width);
  widths[widths.length - 1] = tableWidth - widths.slice(0, -1).reduce((a, b) => a + b, 0);

  let page;
  let y;
  const pages = [];
  const newPage = () => {
    page = doc.addPage(PAGE);
    pages.push(page);
    y = PAGE[1] - MARGIN;
    if (pages.length === 1) {
      page.drawText("Techastra '26 - Winners List", { x: MARGIN, y: y - 16, size: 18, font: bold, color: NAVY });
      page.drawText("18th National Level Technical Symposium  |  Valedictory", { x: MARGIN, y: y - 32, size: 10, font, color: MUTED });
      y -= 48;
    }
  };
  const header = () => {
    const h = LINE + 2 * PAD;
    page.drawRectangle({ x: MARGIN, y: y - h, width: tableWidth, height: h, color: NAVY });
    let x = MARGIN;
    COLUMNS.forEach((c, i) => {
      page.drawText(c.title, { x: x + PAD, y: y - PAD - SIZE, size: SIZE, font: bold, color: rgb(1, 1, 1) });
      x += widths[i];
    });
    y -= h;
  };
  const ensure = (height, event, continued) => {
    if (y - height >= MARGIN + 20) return false;
    newPage();
    if (event) eventTitle(event, continued);
    header();
    return true;
  };
  const eventTitle = (event, continued = false) => {
    const label = `${latin1(event.name)}${event.day ? `  -  Day ${event.day}` : ""}${continued ? "  (continued)" : ""}`;
    page.drawText(label, { x: MARGIN, y: y - 14, size: 12.5, font: bold, color: NAVY });
    y -= 22;
  };

  newPage();
  if (!list.length) {
    page.drawText("No event has locked results yet.", { x: MARGIN, y: y - 14, size: 11, font, color: INK });
  }
  // One team's rows: place and team (in bold) on the first row only.
  const teamRows = (place) => {
    const reg = place.registration;
    const college = reg.collegeName || reg.user?.collegeName || "";
    return place.people.map((person, i) => {
      const cells = [
        i === 0 ? PLACE[place.position] || `${place.position}th` : "",
        i === 0 ? reg.teamName || "-" : "",
        nameOf(person),
        person.department || "-",
        person.yearOfStudy || "-",
        college || "-",
      ].map(latin1);
      const fontOf = (c) => ((c === 0 || c === 1) && i === 0 ? bold : font);
      const lines = cells.map((text, c) => wrap(text, fontOf(c), SIZE, widths[c] - 2 * PAD));
      return { lines, fontOf, height: Math.max(...lines.map((l) => l.length)) * LINE + 2 * PAD };
    });
  };
  const heightOf = (rows) => rows.reduce((h, r) => h + r.height, 0);
  const TITLE = 22;
  const HEADER = LINE + 2 * PAD;

  for (const { event, places } of list) {
    const teams = places.map(teamRows);
    // The event title and table header always start a page together with the
    // first team; a team is never split across pages.
    if (y - 10 - TITLE - HEADER - heightOf(teams[0] || []) < MARGIN + 20) newPage();
    else if (y < PAGE[1] - MARGIN - 60) y -= 10;
    eventTitle(event);
    header();
    teams.forEach((rows, t) => {
      ensure(heightOf(rows), event, true);
      const band = t % 2 === 0;
      for (const { lines, fontOf, height: h } of rows) {
        ensure(h, event, true); // only if one team is taller than a whole page
        if (band) page.drawRectangle({ x: MARGIN, y: y - h, width: tableWidth, height: h, color: BAND });
        let x = MARGIN;
        lines.forEach((cellLines, c) => {
          cellLines.forEach((text, l) => page.drawText(text, { x: x + PAD, y: y - PAD - SIZE - l * LINE, size: SIZE, font: fontOf(c), color: INK }));
          x += widths[c];
        });
        y -= h;
        page.drawLine({ start: { x: MARGIN, y }, end: { x: MARGIN + tableWidth, y }, thickness: 0.5, color: RULE });
      }
    });
  }

  pages.forEach((p, i) => {
    const text = `Page ${i + 1} of ${pages.length}`;
    p.drawText(text, { x: PAGE[0] - MARGIN - font.widthOfTextAtSize(text, 8), y: MARGIN - 14, size: 8, font, color: MUTED });
  });
  return Buffer.from(await doc.save());
}

module.exports = { winnersListPdf };
