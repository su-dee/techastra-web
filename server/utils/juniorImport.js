/**
 * Junior Techastra import: the overall Junior coordinator uploads an Excel
 * (.xlsx) or CSV file with one student per row. Columns are matched by their
 * header (any order, case and spacing ignored):
 *
 *   Student name | School | Class | Event | Team name (optional)
 *
 * No phone number or email is collected for junior students (any such
 * column in the file is ignored).
 *
 * "Event" may list several events separated by ; , or |. A student is entered
 * once per event. Students with the same team name and school in one team
 * event form a team (up to the event's team size).
 */
const ExcelJS = require("exceljs");

const MAX_ROWS = 2000;

// Header aliases, compared after norm() (lowercase letters and digits only).
const COLUMNS = {
  name: ["name", "studentname", "fullname", "participantname", "nameofthestudent", "student"],
  school: ["school", "schoolname", "nameoftheschool", "institution"],
  className: ["class", "classsection", "standard", "std", "grade", "classandsection"],
  event: ["event", "events", "eventname", "eventnames"],
  teamName: ["team", "teamname"],
};
const REQUIRED = { name: "Student name", school: "School", className: "Class", event: "Event" };

const norm = (s) => String(s ?? "").toLowerCase().replace(/[^a-z0-9]/g, "");
const clean = (s) => String(s ?? "").replace(/\s+/g, " ").trim();

/** RFC 4180 CSV: quoted fields, "" escapes, commas and newlines inside quotes. */
function parseCsv(text) {
  const rows = [];
  let row = [], field = "", quoted = false;
  const src = text.replace(/^﻿/, "");
  for (let i = 0; i < src.length; i++) {
    const c = src[i];
    if (quoted) {
      if (c === '"' && src[i + 1] === '"') { field += '"'; i++; }
      else if (c === '"') quoted = false;
      else field += c;
    } else if (c === '"') quoted = true;
    else if (c === ",") { row.push(field); field = ""; }
    else if (c === "\n" || c === "\r") {
      if (c === "\r" && src[i + 1] === "\n") i++;
      row.push(field); rows.push(row); row = []; field = "";
    } else field += c;
  }
  if (field !== "" || row.length) { row.push(field); rows.push(row); }
  return rows;
}

/** The file's rows as arrays of strings (first sheet for Excel). */
async function readRows(buffer, filename) {
  const ext = String(filename || "").toLowerCase().split(".").pop();
  if (ext === "csv") return parseCsv(buffer.toString("utf8"));
  if (ext === "xlsx") {
    const workbook = new ExcelJS.Workbook();
    try {
      await workbook.xlsx.load(buffer);
    } catch {
      throw new Error("Couldn't read this Excel file. Save it as .xlsx or .csv and try again.");
    }
    const sheet = workbook.worksheets[0];
    if (!sheet) return [];
    const rows = [];
    sheet.eachRow({ includeEmpty: true }, (r) => {
      const cells = [];
      for (let i = 1; i <= r.cellCount; i++) cells.push(r.getCell(i).text ?? "");
      rows[r.number - 1] = cells;
    });
    return Array.from(rows, (r) => r || []);
  }
  throw new Error("Upload an Excel (.xlsx) or CSV (.csv) file. Older .xls files: open them and save as .xlsx first.");
}

/** Which column holds what: { name: 0, school: 1, ... }, or the missing headers. */
function mapHeader(header) {
  const map = {};
  header.forEach((h, i) => {
    const key = norm(h);
    for (const [field, aliases] of Object.entries(COLUMNS)) {
      if (map[field] === undefined && aliases.includes(key)) map[field] = i;
    }
  });
  const missing = Object.entries(REQUIRED).filter(([f]) => map[f] === undefined).map(([, label]) => label);
  return { map, missing };
}

const studentKey = (eventId, name, school, className) => [eventId, norm(name), norm(school), norm(className)].join("|");
const teamKey = (eventId, school, teamName) => [eventId, norm(school), norm(teamName)].join("|");

/**
 * Checks every row against the junior events and what's already imported.
 * Returns one entry per (row, event): { row, name, school, className,
 * teamName, eventId, eventName, error }. Entries without `error` can
 * be saved.
 */
function validateRows(rows, events, existing = []) {
  const firstRow = rows.findIndex((r) => r.some((c) => clean(c)));
  if (firstRow === -1) return { error: "The file is empty." };
  const { map, missing } = mapHeader(rows[firstRow]);
  if (missing.length) {
    return { error: `The first row must be the column headings. Missing: ${missing.join(", ")}. Download the template to see the expected columns.` };
  }
  const body = rows.slice(firstRow + 1).map((cells, i) => ({ cells, row: firstRow + i + 2 })).filter(({ cells }) => cells.some((c) => clean(c)));
  if (!body.length) return { error: "No students found under the headings." };
  if (body.length > MAX_ROWS) return { error: `At most ${MAX_ROWS} students per file. Split it into smaller files.` };

  const byName = new Map(events.map((e) => [norm(e.name), e]));
  const seen = new Set(existing.map((p) => studentKey(p.eventId, p.name, p.school, p.className)));
  const teamCount = new Map();
  for (const p of existing) {
    if (p.teamName) {
      const k = teamKey(p.eventId, p.school, p.teamName);
      teamCount.set(k, (teamCount.get(k) || 0) + 1);
    }
  }

  const entries = [];
  for (const { cells, row } of body) {
    const get = (f) => (map[f] === undefined ? "" : clean(cells[map[f]]));
    const base = {
      row,
      name: get("name"),
      school: get("school"),
      className: get("className"),
      teamName: get("teamName"),
    };

    let rowError = null;
    if (!base.name) rowError = "Student name is empty.";
    else if (base.name.length > 80) rowError = "Student name is too long (80 characters at most).";
    else if (!base.school) rowError = "School is empty.";
    else if (base.school.length > 150) rowError = "School name is too long (150 characters at most).";
    else if (!base.className) rowError = "Class is empty.";
    else if (base.className.length > 20) rowError = "Class is too long (20 characters at most).";
    else if (base.teamName.length > 40) rowError = "Team name is too long (40 characters at most).";

    const names = get("event").split(/[;,|]/).map(clean).filter(Boolean);
    if (!names.length) {
      entries.push({ ...base, eventId: null, eventName: "", error: rowError || "Event is empty." });
      continue;
    }
    for (const eventName of names) {
      const event = byName.get(norm(eventName));
      const entry = { ...base, eventId: event?.id || null, eventName: event?.name || eventName };
      if (rowError) entry.error = rowError;
      else if (!event) entry.error = `"${eventName}" isn't a Junior Techastra event.`;
      else {
        if (event.maxTeamSize <= 1) entry.teamName = ""; // individual event: no teams
        const sk = studentKey(event.id, entry.name, entry.school, entry.className);
        if (seen.has(sk)) entry.error = `Already registered for ${event.name}.`;
        else if (entry.teamName) {
          const tk = teamKey(event.id, entry.school, entry.teamName);
          const n = (teamCount.get(tk) || 0) + 1;
          if (n > event.maxTeamSize) entry.error = `Team "${entry.teamName}" already has ${event.maxTeamSize} students (the most for ${event.name}).`;
          else teamCount.set(tk, n);
        }
        if (!entry.error) seen.add(sk);
      }
      entries.push(entry);
    }
  }
  return { entries };
}

module.exports = { parseCsv, readRows, mapHeader, validateRows, teamKey, norm, MAX_ROWS };
