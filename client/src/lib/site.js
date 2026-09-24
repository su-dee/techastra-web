// Event facts shared with the main Techastra '26 site (techastra-web/src/config.js).
export const INSTITUTE = "Dr. M.G.R. Educational and Research Institute";
export const DEPARTMENTS = "Computer Science & Engineering and Cyber Security";
export const EDITION = "18th";

// Countdown target - first day, 9:00 AM IST.
export const EVENT_START = "2026-10-08T09:00:00+05:30";
export const EVENT_DATES = "8 – 9 October 2026";

export const ADDRESS = ["Poonamallee High Rd, Vishwas Nagar, Maduravoyal,", "Chennai, Tamil Nadu 600095"];
export const PHONE = "04423782176";

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
  volunteer: "/volunteer",
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
    students: ["Tanya Mriam (IV Yr CFIS)", "Sudeep Krishna (IV Yr CSE)"],
  },
  {
    role: "SENIOR · NON-TECHNICAL",
    staff: ["Dr. S. Mohandoss", "Dr. M. Nisha"],
    students: ["Dhevanathan R (IV Yr CSE)", "Madhumitha T S (IV Yr CFIS)"],
  },
  {
    role: "JUNIOR · ALL EVENTS",
    staff: ["Dr. Syed Ali", "Mrs. Shyamala"],
    students: ["Divya R (IV Yr CSE)", "Kalidas K (IV Yr CSE)", "Yashwanth (IV Yr CFIS)"],
  },
];

export const DAYS = [
  { id: 1, date: "2026-10-08", label: "Day 01", long: "Thursday, 8 October 2026" },
  { id: 2, date: "2026-10-09", label: "Day 02", long: "Friday, 9 October 2026" },
];

// Which symposium day an event falls on: the explicit `day` field if the
// organisers set one, otherwise the calendar date of its start time (IST).
export function dayOf(event) {
  if (event.day) return event.day;
  const date = new Date(event.startTime).toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
  return DAYS.find((d) => d.date === date)?.id ?? null;
}
