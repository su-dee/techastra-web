const fs = require("fs");
const path = require("path");
const { PDFDocument, StandardFonts, rgb } = require("pdf-lib");

/**
 * The valedictory winners sheet, laid out like the department's paper form
 * (9 Oct 2026): university header, "Senior Techastra", then a Technical and
 * a Non Technical section, each a grid of S.No | Event Name | Name | College
 * Name | Year/Branch/Degree | Place, with three rows (I, II, III) per event.
 * The rows of a place without a locked result stay blank to fill in.
 *
 * `events` are every senior event; `winners` is winnersByEvent()'s list.
 */
const PAGE = [595.28, 841.89]; // A4 portrait
const MARGIN = 28;
const COLUMNS = [
  { title: "S.No", width: 30, align: "center" },
  { title: "Event Name", width: 84 },
  { title: "Name", width: 140 },
  { title: "College Name", width: 136 },
  { title: "Year / Branch / Degree", width: 110 },
  { title: "Place", width: 39, align: "center" },
];
const SIZE = 8;
const LINE = 10;
const PAD = 4;
const MIN_ROW = 26;
const PLACE = ["I", "II", "III"];
const INK = rgb(0, 0, 0);
const GRID = rgb(0.25, 0.25, 0.25);

// The paper form's order; any other senior event follows in time order.
const ORDER = {
  technical: ["Pen Your Vision", "Hack Nexus", "Crypt Clash", "Prompt Arena", "Code Rescue", "Pixel Protocol", "Forensic Alibi", "Trial of Truth"],
  non_technical: ["Rhythm Riot", "Hidden Frames", "Verbal Combat", "Cap Chaos", "Blitz Hunt", "Plot Twist", "Team Feud", "Clash Squad E-Sports"],
};
const SECTIONS = [
  ["technical", "TECHNICAL EVENT"],
  ["non_technical", "NON TECHNICAL EVENT"],
];

const headerImage = path.join(__dirname, "..", "assets", "certificate", "mgr-header.jpg");
// Helvetica only covers Latin-1: anything else (e.g. emoji in a team name)
// is left out rather than making pdf-lib throw.
const latin1 = (text) =>
  String(text || "")
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, "")
    .replace(/\(\s*\)/g, "")
    .replace(/\(\s+/g, "(")
    .replace(/\s+\)/g, ")")
    .trim();

function wrap(text, font, size, width) {
  const lines = [];
  for (const para of String(text || "").split("\n").map(latin1)) {
    let line = "";
    for (let word of para.replace(/\s+/g, " ").trim().split(" ").filter(Boolean)) {
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
    lines.push(line);
  }
  return lines.filter((l, i) => l || i === 0);
}

/** "B.Tech CSE"; just one of them when it already contains the other ("BBA" + "BBA General"). */
function degree(course, department) {
  const c = String(course || "").trim();
  const d = String(department || "").trim();
  if (!c || !d) return c || d;
  const cl = c.toLowerCase(), dl = d.toLowerCase();
  if (dl === cl || dl.startsWith(`${cl} `)) return d; // "BBA" + "BBA General"
  if (cl.startsWith(`${dl} `) || cl.endsWith(` ${dl}`)) return c; // "Btech cse ai" + "Cse ai"
  return `${c} ${d}`;
}

/** The cells for one place: the lead "& team" (team name below), college, year/branch. */
function placeCells(place, nameOf) {
  if (!place) return ["", "", ""];
  const lead = place.people[0] || {};
  const team = place.people.length > 1;
  const name = `${nameOf(lead)}${team ? " & team" : ""}${team && place.registration.teamName ? `\n(${place.registration.teamName})` : ""}`;
  const college = lead.college || place.registration.collegeName || place.registration.user?.collegeName || "";
  const branch = degree(lead.course, lead.department);
  const study = [lead.yearOfStudy, branch].filter(Boolean).join(" / ");
  return [name, college, study];
}

async function valedictoryPdf(events, winners, { nameOf = (p) => p.name } = {}) {
  const doc = await PDFDocument.create();
  doc.setTitle("Techastra '26 - Valedictory Winners");
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);
  const logo = fs.existsSync(headerImage) ? await doc.embedJpg(fs.readFileSync(headerImage)) : null;
  const placesFor = new Map(winners.map((w) => [w.event.id, w.places]));
  const tableWidth = COLUMNS.reduce((s, c) => s + c.width, 0);
  const left = (PAGE[0] - tableWidth) / 2;

  let page, y;
  const centred = (text, size, f, at) =>
    page.drawText(text, { x: (PAGE[0] - f.widthOfTextAtSize(text, size)) / 2, y: at, size, font: f, color: INK });
  const newPage = (title) => {
    page = doc.addPage(PAGE);
    y = PAGE[1] - MARGIN;
    if (logo) {
      const w = 290;
      const h = (logo.height / logo.width) * w;
      page.drawImage(logo, { x: (PAGE[0] - w) / 2, y: y - h, width: w, height: h });
      y -= h + 14;
    }
    centred("DEPARTMENT OF COMPUTER SCIENCE AND ENGINEERING & CYBER SECURITY", 11, bold, y);
    y -= 16;
    centred("SENIOR TECHASTRA", 11, bold, y);
    y -= 14;
    centred(title, 10, bold, y);
    y -= 12;
    header();
  };
  const header = () => {
    const h = 2 * LINE + 2 * PAD;
    let x = left;
    for (const c of COLUMNS) {
      page.drawRectangle({ x, y: y - h, width: c.width, height: h, borderColor: GRID, borderWidth: 0.7 });
      const lines = wrap(c.title, bold, SIZE, c.width - 2 * PAD);
      lines.forEach((t, i) => {
        const w = bold.widthOfTextAtSize(t, SIZE);
        page.drawText(t, { x: x + (c.width - w) / 2, y: y - PAD - SIZE - i * LINE + (lines.length === 1 ? -LINE / 2 : 0), size: SIZE, font: bold, color: INK });
      });
      x += c.width;
    }
    y -= h;
  };
  const cellText = (text, column, x, top, height, f = font) => {
    const lines = wrap(text, f, SIZE, column.width - 2 * PAD);
    const blockTop = top - (height - lines.length * LINE) / 2; // vertically centred
    lines.forEach((t, i) => {
      const w = f.widthOfTextAtSize(t, SIZE);
      const tx = column.align === "center" ? x + (column.width - w) / 2 : x + PAD;
      page.drawText(t, { x: tx, y: blockTop - SIZE - i * LINE + 1, size: SIZE, font: f, color: INK });
    });
    return lines.length;
  };

  for (const [category, title] of SECTIONS) {
    const order = ORDER[category];
    const list = events
      .filter((e) => e.category === category && e.level !== "junior")
      .sort((a, b) => {
        const ia = order.indexOf(a.name), ib = order.indexOf(b.name);
        if (ia !== -1 || ib !== -1) return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
        return new Date(a.startTime) - new Date(b.startTime);
      });
    newPage(title);
    list.forEach((event, n) => {
      const places = placesFor.get(event.id) || [];
      const rows = [1, 2, 3].map((pos) => placeCells(places.find((p) => p.position === pos), nameOf));
      const heights = rows.map((cells) =>
        Math.max(MIN_ROW, ...cells.map((t, i) => wrap(t, font, SIZE, COLUMNS[i + 2].width - 2 * PAD).length * LINE + 2 * PAD)),
      );
      const total = heights.reduce((a, b) => a + b, 0);
      if (y - total < MARGIN) {
        page = doc.addPage(PAGE);
        y = PAGE[1] - MARGIN;
        header();
      }
      // S.No and Event Name span the event's three rows.
      let x = left;
      for (const [i, text] of [String(n + 1), event.name].entries()) {
        page.drawRectangle({ x, y: y - total, width: COLUMNS[i].width, height: total, borderColor: GRID, borderWidth: 0.7 });
        cellText(text, COLUMNS[i], x, y, total, i === 1 ? bold : font);
        x += COLUMNS[i].width;
      }
      let top = y;
      rows.forEach((cells, r) => {
        let cx = x;
        const values = [...cells, PLACE[r]];
        values.forEach((text, i) => {
          const column = COLUMNS[i + 2];
          page.drawRectangle({ x: cx, y: top - heights[r], width: column.width, height: heights[r], borderColor: GRID, borderWidth: 0.7 });
          cellText(text, column, cx, top, heights[r]);
          cx += column.width;
        });
        top -= heights[r];
      });
      y -= total;
    });
  }
  return Buffer.from(await doc.save());
}

module.exports = { valedictoryPdf };
