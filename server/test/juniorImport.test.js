// Unit tests for utils/juniorImport.js. Run: npm test (node's built-in runner).
const test = require("node:test");
const assert = require("node:assert/strict");
const ExcelJS = require("exceljs");
const { parseCsv, readRows, validateRows } = require("../utils/juniorImport");

const EVENTS = [
  { id: "byte", name: "Byte Rush", maxTeamSize: 2 },
  { id: "trace", name: "TRACE//X", maxTeamSize: 3 },
  { id: "huntify", name: "Huntify", maxTeamSize: 1 },
];
const HEAD = ["Student name", "School", "Class", "Event", "Team name"];

test("CSV: quotes, escaped quotes, commas and newlines inside quotes, CRLF and a BOM", () => {
  const rows = parseCsv('﻿a,"b, c","say ""hi"""\r\n"multi\nline",x,\r\n');
  assert.deepEqual(rows, [
    ["a", "b, c", 'say "hi"'],
    ["multi\nline", "x", ""],
  ]);
});

test("headers are matched in any order and spelling; missing required ones are named", () => {
  const ok = validateRows([["event", "CLASS", "School Name", "Name of the Student"], ["Huntify", "8", "ABC School", "Asha"]], EVENTS);
  assert.equal(ok.entries.length, 1);
  assert.equal(ok.entries[0].name, "Asha");
  assert.equal(ok.entries[0].eventId, "huntify");
  const bad = validateRows([["Name", "Event"], ["Asha", "Huntify"]], EVENTS);
  assert.match(bad.error, /Missing: School, Class/);
});

test("event names match loosely, several events in one cell give one entry each", () => {
  const { entries } = validateRows([HEAD, ["Asha", "ABC", "8", "trace x; huntify", ""]], EVENTS);
  assert.deepEqual(entries.map((e) => [e.eventId, e.error]), [["trace", undefined], ["huntify", undefined]]);
});

test("row problems are reported per row with the spreadsheet row number", () => {
  const { entries } = validateRows(
    [
      HEAD,
      ["", "ABC", "8", "Huntify", ""],
      ["Ravi", "ABC", "8", "Chess", ""],
      ["Mia", "", "8", "Huntify", ""],
      ["Zoe", "ABC", "", "Huntify", ""],
    ],
    EVENTS
  );
  assert.deepEqual(entries.map((e) => e.row), [2, 3, 4, 5]);
  assert.match(entries[0].error, /name is empty/);
  assert.match(entries[1].error, /isn't a Junior Techastra event/);
  assert.match(entries[2].error, /School is empty/);
  assert.match(entries[3].error, /Class is empty/);
});

test("phone and email columns in a file are ignored, never stored", () => {
  const { entries } = validateRows(
    [["Student name", "School", "Class", "Event", "Phone", "Email"], ["Asha", "ABC", "8", "Huntify", "12", "not-an-email"]],
    EVENTS
  );
  assert.equal(entries[0].error, undefined);
  assert.equal("phone" in entries[0], false);
  assert.equal("email" in entries[0], false);
});

test("duplicates (in the file or already imported) are rejected; case and spacing don't matter", () => {
  const existing = [{ eventId: "huntify", name: "Asha  K", school: "ABC School", className: "8", teamName: null }];
  const { entries } = validateRows(
    [HEAD, ["asha k", "abc school", "8", "Huntify", ""], ["Ben", "ABC", "8", "Huntify", ""], ["BEN", "abc", "8", "Huntify", ""]],
    EVENTS,
    existing
  );
  assert.match(entries[0].error, /Already registered/);
  assert.equal(entries[1].error, undefined);
  assert.match(entries[2].error, /Already registered/);
});

test("teams are capped at the event's team size, counting students already imported", () => {
  const existing = [{ eventId: "byte", name: "A", school: "ABC", className: "9", teamName: "Bits" }];
  const { entries } = validateRows(
    [
      HEAD,
      ["B", "ABC", "9", "Byte Rush", "bits"], // joins A: 2 of 2
      ["C", "ABC", "9", "Byte Rush", "Bits"], // a third: too many
      ["D", "XYZ", "9", "Byte Rush", "Bits"], // same name, other school: another team
    ],
    EVENTS,
    existing
  );
  assert.equal(entries[0].error, undefined);
  assert.match(entries[1].error, /already has 2 students/);
  assert.equal(entries[2].error, undefined);
});

test("individual events drop the team name", () => {
  const { entries } = validateRows([HEAD, ["Asha", "ABC", "8", "Huntify", "Solo Team"]], EVENTS);
  assert.equal(entries[0].teamName, "");
});

test("an Excel file is read from its first sheet", async () => {
  const wb = new ExcelJS.Workbook();
  const ws = wb.addWorksheet("Students");
  ws.addRow(HEAD);
  ws.addRow(["Asha", "ABC", 8, "Huntify", ""]);
  const rows = await readRows(Buffer.from(await wb.xlsx.writeBuffer()), "students.xlsx");
  const { entries } = validateRows(rows, EVENTS);
  assert.equal(entries[0].className, "8");
  assert.equal(entries[0].error, undefined);
});

test("other file types are refused with a clear message", async () => {
  await assert.rejects(readRows(Buffer.from("x"), "old.xls"), /save as \.xlsx/);
});
