const test = require("node:test");
const assert = require("node:assert");
const { peopleOf, certificateName, certificateNameParts } = require("../utils/certificates");

test("certificate names: Mr/Ms, then department-year", () => {
  const reg = {
    memberTitles: ["Mr", "Ms", ""],
    teamMembers: [
      { name: "Arjun Ramesh", role: "lead", department: "CSE", yearOfStudy: "3rd Year" },
      { name: "Priya Lakshmi S", role: "member", department: "IT", yearOfStudy: "2nd Year" },
      { name: "Karthik N", role: "member" },
    ],
  };
  assert.deepEqual(peopleOf(reg).map(certificateName), ["Mr. Arjun Ramesh, CSE-3rd Year", "Ms. Priya Lakshmi S, IT-2nd Year", "Karthik N"]);
});

test("certificate names: a solo registrant uses their account's details", () => {
  const reg = { memberTitles: ["Ms"], user: { name: "Divya R", department: "ECE", yearOfStudy: "1st Year" } };
  assert.equal(certificateName(peopleOf(reg)[0]), "Ms. Divya R, ECE-1st Year");
  assert.equal(certificateName(peopleOf({ memberTitles: ["Dr"], user: { name: "Divya R", yearOfStudy: "1st Year" } })[0]), "Divya R, 1st Year");
});

test("certificate names: department and year are their own (smaller) part", () => {
  const p = (department, yearOfStudy) => ({ title: "Mr", name: "Arjun Ramesh", department, yearOfStudy });
  assert.deepEqual(certificateNameParts(p("CSE", "3rd Year")), { main: "Mr. Arjun Ramesh, ", study: "CSE-3rd Year" });
  assert.deepEqual(certificateNameParts(p("", "3rd Year")), { main: "Mr. Arjun Ramesh, ", study: "3rd Year" });
  assert.deepEqual(certificateNameParts(p("", "")), { main: "Mr. Arjun Ramesh", study: "" });
});
