const test = require("node:test");
const assert = require("node:assert/strict");

const { peopleOf } = require("../utils/certificates");

test("each team member gets their own certificate; a solo registration has one", () => {
  const team = peopleOf({
    teamMembers: [
      { name: "Lead", regNo: "R1", role: "lead" },
      { name: "Priya", regNo: "R2", department: "ECE", yearOfStudy: "2nd Year", role: "member" },
    ],
    user: { name: "Lead", department: "CSE", yearOfStudy: "3rd Year" },
  });
  assert.deepEqual(team.map((p) => [p.index, p.name, p.department]), [[0, "Lead", "CSE"], [1, "Priya", "ECE"]]);
  const solo = peopleOf({ teamMembers: null, user: { name: "Arun", registerNo: "21CS001" } });
  assert.deepEqual(solo.map((p) => [p.index, p.name, p.regNo]), [[0, "Arun", "21CS001"]]);
});
