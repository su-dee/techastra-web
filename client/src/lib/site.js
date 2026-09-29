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
  staff: ["Dr. S. Sai Shanmugaraja", "Dr. Syed Ali", "Mrs. C. Subalakshmi"],
  students: ["Ms. Mrinalini P G", "Mr. Thiruvenkatam V", "Mr. Shaik Abdulla M"],
};

export const CATEGORY_COORDINATORS = [
  {
    role: "SENIOR · TECHNICAL",
    staff: ["Dr. T. Kumanan", "Mrs. Chinchu Nair"],
    students: ["Ms. Tanya Mriam", "Mr. Sudeep Krishna"],
  },
  {
    role: "SENIOR · NON-TECHNICAL",
    staff: ["Dr. S. Mohandoss", "Dr. M. Nisha"],
    students: ["Mr. Dhevanathan R", "Ms. Madhumitha T S"],
  },
  {
    role: "JUNIOR · ALL EVENTS",
    staff: ["Dr. Syed Ali", "Mrs. Shyamala"],
    students: ["Ms. Divya R", "Mr. Kalidas K", "Mr. Yashwanth"],
  },
];

export const DAYS = [
  { id: 1, date: "2026-10-08", label: "October 8, 2026 (Day 1)", long: "Thursday, October 8, 2026 (Day 1)" },
  { id: 2, date: "2026-10-09", label: "October 9, 2026 (Day 2)", long: "Friday, October 9, 2026 (Day 2)" },
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

export function levelOf(event) {
  return event.level === "junior" ? "junior" : "senior";
}
