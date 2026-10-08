// Event facts shared with the main Techastra '26 site (techastra-web/src/config.js).
export const INSTITUTE = "Dr. M.G.R. Educational and Research Institute";
export const DEPARTMENTS = "Computer Science & Engineering and Cyber Security";
export const EDITION = "18th";

// Countdown target - first day, 9:00 AM IST.
export const EVENT_START = "2026-10-08T09:00:00+05:30";
export const EVENT_DATES = "8 – 9 October 2026";

export const ADDRESS = ["Poonamallee High Rd, Maduravoyal,", "Chennai, Tamil Nadu 600095"];
export const PHONE = "04423782176";

// Registration fees are paid to this UPI ID. Checkout generates the QR and the
// "Pay with UPI app" link from it with the cart total built in (upiPayLink) -
// to switch to the official account, change UPI_ID and UPI_PAYEE_NAME here
// (and remove UPI_AID, which belongs to this account's GPay QR).
export const UPI_ID = "subalakshmime-1@okaxis";
// Payee name and Google Pay merchant reference exactly as in the organisers'
// original QR, so UPI apps show the same payee students expect.
export const UPI_PAYEE_NAME = "Subalakshmi Velaa PG men's hostel";
const UPI_AID = "uGICAgIDn44v9cA";

/**
 * UPI payment link with the amount pre-filled (NPCI "upi://pay" format) - used
 * for the checkout QR and the "Pay with UPI app" button. Spaces are encoded as
 * %20 (not +), which every UPI app reads correctly.
 */
export function upiPayLink(amount, note = "Techastra 26 registration") {
  const enc = (v) => encodeURIComponent(v).replace(/'/g, "%27");
  // The UPI ID goes in as-is (like the organisers' original QR): some apps
  // don't decode "%40" in the payee address. VPAs only use URL-safe characters.
  return (
    `upi://pay?pa=${UPI_ID}&pn=${enc(UPI_PAYEE_NAME)}&aid=${enc(UPI_AID)}` +
    `&am=${Number(amount).toFixed(2)}&cu=INR&tn=${enc(note)}`
  );
}

// Organising committee (Committee page) - "Techastra 26 Event coordinator
// List.pdf", Committee Information.
export const COMMITTEE = {
  staff: ["Dr. V. Saishanmugaraja", "Mrs. C. Subalakshmi", "Mr. Syed Ali D"],
  students: [
    { name: "Mr. Thiruvenkatam V", dept: "CSE" },
    { name: "Mr. Shaik Abdulla", dept: "CSE" },
    { name: "Ms. Mrinalini P G", dept: "CFIS" },
  ],
  // Working teams, in the list's order. `lead` = in charge (I/C).
  teams: [
    { name: "Event Management", members: ["Dr. S. Geetha", "Dr. P. Dinesh Kumar", "Dr. G. Victo Sudha George"] },
    { name: "Design & Website", lead: ["Mr. Saravanan Elumalai"], members: ["Mr. P. Jayakrishnan"] },
    { name: "Video & Photography", lead: ["Dr. V. Vidhya"], members: ["Mrs. Chinchu Nair"] },
    { name: "Purchase", lead: ["Dr. G. Senthilvelan"], members: ["Mr. P. Jayakrishnan"] },
    {
      name: "Decoration",
      lead: ["Dr. F. Antony Xavier Bronson"],
      members: ["Mrs. Chinchu Nair", "Mr. M. Arun", "Mr. P. Sudharsan", "Mrs. K. C. Anu", "Mrs. K. Menaka", "Mrs. S. Divya", "Mr. R. Muthukrishnan", "Mr. S. Suresh Kumar", "Ms. D. Sangeetha"],
    },
    { name: "Sponsor", lead: ["Dr. S. Mohandoss"], members: ["Dr. M. Manikandan", "Dr. J. Jayaprakash"] },
    {
      name: "Digital Bridge",
      lead: ["Mr. M. Arun"],
      members: ["Mrs. E. Nalini", "Dr. M. Nisha", "Dr. S. Mohandoss", "Dr. M. Sujitha", "Dr. T. Kumanan", "Mr. Saravanan Elumalai", "Mrs. Chinchu Nair", "Mrs. M. Kanagapriya"],
    },
    {
      name: "Hospitality",
      lead: ["Dr. B. Raja"],
      members: ["Dr. M. Anand", "Dr. S. Mohandoss", "Mr. M. Arun", "Dr. K. K. Rekha", "Mr. P. Sudharsan", "Mr. L. Magnus Jesrus", "Mrs. D. Vidhyalakshmi", "Mrs. S. Divya", "Mr. P. Rahul", "Mr. P. S. Deepak", "Mr. M. R. Mohanakrishnan"],
    },
    { name: "Invitation", lead: ["Mrs. M. Kanagapriya"], members: ["Mrs. E. Nalini", "Ms. G. Priyanka", "Mrs. K. C. Anu"] },
    { name: "Certificate", lead: ["Dr. M. Sujitha"], members: ["Mrs. M. Kanagapriya", "Dr. M. Nisha", "Mrs. E. Nalini", "Mr. S. Dhanush"] },
    { name: "Registration", lead: ["Mrs. E. Nalini"], members: ["Dr. S. Akhila", "Dr. M. Sujitha", "Dr. M. Nisha", "Mr. M. Manikandan", "Mr. P. Kamalanand"] },
    { name: "Transport", lead: ["Mr. S. Mohan"], members: ["Mr. E. Murali", "Mr. L. Magnus Jesrus", "Mr. S. Sivasankar"] },
    { name: "Reception", lead: ["Ms. G. Priyanka"], members: ["Mrs. K. Menaka", "Mrs. D. Vidhyalakshmi", "Mr. K. Jagan"] },
    { name: "Advertisement", members: ["Mrs. S. Amudha", "Dr. P. S. Rajakumar"] },
    { name: "Souvenir", lead: ["Dr. K. K. Rekha"], members: ["Mrs. P. Shyamala", "Mr. M. Uma Mahesh", "Mrs. Ruth Rubavathy", "Mr. S. Paramasivam"] },
    { name: "Technical", lead: ["Dr. T. Kumanan", "Mrs. Chinchu Nair"], members: ["Mrs. Ruth Rubavathy", "Mr. P. Rajesh"] },
    { name: "Non-Technical", lead: ["Dr. S. Mohandoss"], members: ["Dr. M. Sujitha", "Dr. M. Nisha", "Mr. S. Paramasivam"] },
    { name: "Junior Techastra", lead: ["Mrs. P. Shyamala"], members: ["Mr. S. Mohan", "Mrs. D. Vidhyalakshmi", "Mrs. K. C. Anu", "Mr. S. Suresh Kumar"] },
    { name: "Backup", members: ["Mrs. K. Kanchana", "Mrs. H. Aarthi", "Mr. T. Dhandapani"] },
    { name: "Finance", members: ["Dr. P. Dinesh Kumar", "Mr. S. Mohan"] },
    {
      name: "Discipline",
      lead: ["Dr. M. Anand"],
      members: ["Dr. J. Jayaprakash", "Mr. P. Sudharsan", "Dr. B. Raja", "Mr. E. Murali", "Mr. M. Uma Mahesh", "Mr. J. R. Jayavelu", "Mr. P. S. Deepak", "Mr. S. Dhanush", "Mr. K. Jagan", "Mr. S. Sivasankar", "Mr. P. Kamalanand"],
    },
    { name: "Compering", members: ["Dr. G. Victo Sudha George", "Dr. K. K. Rekha"] },
  ],
};

// Privacy / legal contact shown on the Privacy Notice and Terms pages (DPDP
// Act 2023 needs a named contact for data requests and grievances).
// PLACEHOLDERS - replace with the organisers' confirmed details before launch.
export const LEGAL = {
  organiser: "Department of Computer Science & Engineering and Department of Cyber Security, Dr. M.G.R. Educational and Research Institute",
  contactName: "Techastra ’26 Organising Committee",
  contactEmail: "techastra@drmgrdu.ac.in", // PLACEHOLDER - confirm the real mailbox
  // Personal data is deleted this long after the symposium (certificates
  // and results are issued first).
  retention: "90 days after the symposium (by 7 January 2027)",
  // Set to true once the college has approved the fees & refunds section.
  refundPolicyConfirmed: true,
};

export const SOCIALS = [
  { label: "X", href: "https://x.com/MGRERI_CSE" },
  { label: "Instagram", href: "https://www.instagram.com/mgreri_cse/" },
  { label: "LinkedIn", href: "https://www.linkedin.com/company/mgreri-cse/" },
  { label: "YouTube", href: "https://www.youtube.com/@MGRERICSE/" },
];

export const PORTAL_PATH = {
  registration_team: "/registration-team",
  coordinator: "/coordinator",
  hospitality: "/hospitality",
  certificate_team: "/certificates",
  junior_coordinator: "/junior",
  master_admin: "/admin",
  participant: "/dashboard",
};

export function categoryOf(event) {
  return event.category === "non_technical" ? "non_technical" : "technical";
}

export const CATEGORY_LABEL = { technical: "Technical", non_technical: "Non-Technical" };

export const MAP_EMBED =
  "https://www.google.com/maps/embed?pb=!1m18!1m12!1m3!1d3886.4698268083566!2d80.17538597588073!3d13.069383212725272!2m3!1f0!2f0!3f0!3m2!1i1024!2i768!4f13.1!3m3!1m2!1s0x3a5261504145fe7d%3A0x58810f43c3a748ae!2sDr.%20M.G.R.%20Educational%20And%20Research%20Institute!5e0!3m2!1sen!2sin!4v1755858648806!5m2!1sen!2sin";
export const MAP_LINK = "https://maps.google.com/?q=Dr.+M.G.R.+Educational+And+Research+Institute";

// Symposium-wide coordinators - same lists as techastra-web/src/data/events.js.
export const TECHASTRA_COORDINATORS = {
  staff: ["Dr. V. Saishanmugaraja", "Mr. Syed Ali D", "Mrs. C. Subalakshmi"],
  students: ["Ms. Mrinalini P G", "Mr. Thiruvenkatam V", "Mr. Shaik Abdulla"],
};

export const CATEGORY_COORDINATORS = [
  {
    role: "SENIOR · TECHNICAL",
    staff: ["Dr. T. Kumanan", "Mrs. Chinchu Nair"],
    students: ["Ms. Tanya Miriam", "Mr. Sudeep Krishna"],
  },
  {
    role: "SENIOR · NON-TECHNICAL",
    staff: ["Dr. S. Mohandoss", "Dr. M. Nisha"],
    students: ["Mr. Dhevanathan R", "Ms. Madhumitha T S", "Ms. Charulatha R"],
  },
  {
    role: "JUNIOR · ALL EVENTS",
    staff: ["Mr. Syed Ali D", "Mrs. Shyamala"],
    students: ["Ms. Divya R", "Mr. Kalidas K", "Mr. Yashwanth Kumar"],
  },
];

export const DAYS = [
  { id: 1, date: "2026-10-08", label: "October 8, 2026 (Day 1)", short: "Day 1 · Oct 8", long: "Thursday, October 8, 2026 (Day 1)" },
  { id: 2, date: "2026-10-09", label: "October 9, 2026 (Day 2)", short: "Day 2 · Oct 9", long: "Friday, October 9, 2026 (Day 2)" },
];

// Which symposium day an event falls on: the explicit `day` field if the
// organisers set one, otherwise the calendar date of its start time (IST).
export function dayOf(event) {
  if (event.day) return event.day;
  const date = new Date(event.startTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return DAYS.find((d) => d.date === date)?.id ?? null;
}

// Senior events are for college students, Junior events for school students.
export const LEVEL_LABEL = { senior: "Senior", junior: "Junior" };
export const LEVEL_AUDIENCE = { senior: "college students", junior: "school students" };
// Junior Techastra has no online registration: the Junior Techastra
// coordinator imports each school's students (server routes/junior.js).
export const JUNIOR_REGISTRATION_NOTE =
  "Junior Techastra has no online registration. Schools register their students through the Junior Techastra coordinator.";

export function levelOf(event) {
  return event.level === "junior" ? "junior" : "senior";
}

/** The end (23:59:59 IST) of the symposium day a time falls on. */
export function endOfDayIST(time) {
  const ymd = new Date(time).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" }); // YYYY-MM-DD
  return new Date(`${ymd}T23:59:59.999+05:30`);
}

/**
 * Online registration for an event stays open until the end of its day (IST),
 * also after it has started (the server checks this too).
 */
export function registrationClosed(event) {
  return !!event?.startTime && endOfDayIST(event.startTime) <= new Date();
}

/** Until when a pay-later seat is held: the first event's start, or the end of its day if that has passed. */
export function holdEndsAt(firstStart, now = new Date()) {
  return now >= firstStart ? endOfDayIST(firstStart) : firstStart;
}
