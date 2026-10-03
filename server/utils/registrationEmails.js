/**
 * The automatic emails:
 *  - received: when a paid registration is submitted (or a rejected one is
 *    resubmitted) and is waiting for the registration desk - or, for "pay
 *    later", that the seat is blocked until the first event starts and how to pay;
 * and, sent once when the desk (or an admin) decides a registration:
 *  - approval: whenever it becomes approved - the desk's Approve, an admin
 *    override or waitlist promotion, a cash or free registration, or a
 *    verified online payment;
 *  - rejection: whenever it becomes rejected - the desk's Reject, an admin
 *    override, or an admin cancellation/refund - with the reason and what
 *    to do next.
 */
const prisma = require("../db");
const { sendMail } = require("./mailer");

// Symposium days, as shown on the website ("October 8, 2026 (Day 1)").
const DAY_NUMBER = { "2026-10-08": 1, "2026-10-09": 2 };
const IST = "Asia/Kolkata";

function formatEventLine(ev) {
  const start = new Date(ev.startTime);
  const ymd = start.toLocaleDateString("en-CA", { timeZone: IST });
  const date = start.toLocaleDateString("en-US", { timeZone: IST, month: "long", day: "numeric", year: "numeric" });
  const time = (d) => new Date(d).toLocaleTimeString("en-US", { timeZone: IST, hour: "numeric", minute: "2-digit" });
  const day = DAY_NUMBER[ymd] ? ` (Day ${DAY_NUMBER[ymd]})` : "";
  const venue = ev.venue ? `, ${ev.venue}` : "";
  const endYmd = new Date(ev.endTime).toLocaleDateString("en-CA", { timeZone: IST });
  if (endYmd !== ymd && DAY_NUMBER[ymd] && DAY_NUMBER[endYmd]) {
    // Runs across both days (Hack Nexus).
    return `- ${ev.name}: October 8-9, 2026 (Day 1-2), ${time(ev.startTime)} (Day ${DAY_NUMBER[ymd]}) - ${time(ev.endTime)} (Day ${DAY_NUMBER[endYmd]})${venue}`;
  }
  return `- ${ev.name}: ${date}${day}, ${time(ev.startTime)} - ${time(ev.endTime)}${venue}`;
}

/** The registration's participant (name, email), loaded if not included. */
async function participantOf(registration) {
  if (registration.user?.email && registration.user?.name) return registration.user;
  return prisma.user.findUnique({ where: { id: registration.userId }, select: { name: true, email: true } });
}

/** The public site's address (first CLIENT_ORIGIN), for links in emails. */
function siteUrl() {
  return (process.env.CLIENT_ORIGIN || "").split(",")[0].trim().replace(/\/+$/, "");
}

/**
 * Sends the approval email for a registration. `registration.user` (name,
 * email) is loaded if the caller didn't include it. Never throws.
 */
async function sendApprovalEmail(registration) {
  try {
    const user = await participantOf(registration);
    if (!user?.email) return { sent: false };
    const events = await prisma.event.findMany({
      where: { id: { in: registration.eventIds } },
      orderBy: { startTime: "asc" },
    });
    const groups = events.filter((e) => e.whatsappUrl);
    const lines = [
      `Hi ${user.name},`,
      "",
      `Your Techastra '26 registration (${registration.registrationCode}) has been approved. See you there!`,
      "",
      "Your events:",
      ...events.map(formatEventLine),
      "",
      // Only the groups of the events in this registration.
      ...(groups.length
        ? [
            `Join your event WhatsApp group${groups.length > 1 ? "s" : ""} for updates and announcements:`,
            ...groups.map((e) => `- ${e.name}: ${e.whatsappUrl}`),
            "",
          ]
        : []),
      "Log in to the Techastra '26 portal to see your digital ID card, and bring it (on your phone or printed) along with your college/school ID on the day.",
      "",
      "For any queries, reply to this email.",
      "",
      "- Techastra '26 Team",
    ];
    return await sendMail({
      to: user.email,
      subject: `Techastra '26 registration approved - ${registration.registrationCode}`,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.warn("Approval email error:", err.message);
    return { sent: false };
  }
}

/**
 * Sends the rejection email: the reason, and how to put it right (resubmit
 * a corrected payment on the status page, or ask the Help Desk). With
 * `cancelled`, it's worded as a cancellation/refund instead, with no
 * resubmission. Never throws.
 */
async function sendRejectionEmail(registration, { cancelled = false } = {}) {
  try {
    const user = await participantOf(registration);
    if (!user?.email) return { sent: false };
    const site = siteUrl();
    const statusLink = site ? `${site}/status?code=${encodeURIComponent(registration.registrationCode)}` : null;
    const reason = registration.rejectionReason || "Payment could not be verified";
    // Free (Junior) registrations have no payment to fix, refund or resubmit.
    const paid = registration.totalAmount > 0;
    // A "pay later" hold released when its first event started: nothing was
    // paid, so it's "pay at the desk if you still want to come", not "fix your
    // payment" (online registration has closed for a started event).
    const releasedHold = registration.paymentMethod === "later" && !cancelled;
    const lines = releasedHold
      ? [
          `Hi ${user.name},`,
          "",
          `The seat blocked for your Techastra '26 registration (${registration.registrationCode}) has been released.`,
          "",
          `Reason: ${reason}`,
          "",
          `You can still take part while seats remain: pay ₹${registration.totalAmount} in cash at the registration desk.`,
          "",
          "For any queries, reply to this email.",
          "",
          "- Techastra '26 Team",
        ]
      : cancelled
      ? [
          `Hi ${user.name},`,
          "",
          `Your Techastra '26 registration (${registration.registrationCode}) has been cancelled.`,
          "",
          `Reason: ${reason}`,
          "",
          paid
            ? "If you have any questions about this or about a refund, reply to this email."
            : "If you think this is a mistake, reply to this email or use the Help Desk on the website.",
          "",
          "- Techastra '26 Team",
        ]
      : [
          `Hi ${user.name},`,
          "",
          `We couldn't approve your Techastra '26 registration (${registration.registrationCode}).`,
          "",
          `Reason: ${reason}`,
          "",
          ...(paid
            ? [
                "What to do next:",
                `- Open the registration status page${statusLink ? ` (${statusLink})` : ""}, enter your registration code and email, and resubmit your payment with the correct UPI transaction ID (UTR) and screenshot. Your registration then goes back to the registration desk.`,
                "- If you think this is a mistake, reply to this email or use the Help Desk on the website.",
              ]
            : ["If you think this is a mistake, reply to this email or use the Help Desk on the website."]),
          "",
          "- Techastra '26 Team",
        ];
    return await sendMail({
      to: user.email,
      subject: releasedHold
        ? `Techastra '26 seat released - ${registration.registrationCode}`
        : cancelled
        ? `Techastra '26 registration cancelled - ${registration.registrationCode}`
        : `Techastra '26 registration not approved - ${registration.registrationCode}`,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.warn("Rejection email error:", err.message);
    return { sent: false };
  }
}

/**
 * Sends the "we received your registration" email for a paid registration
 * waiting for the desk: the code, events, amount and UTR, and what happens
 * next. With `resubmitted`, it confirms a resubmitted payment. With
 * `payBy` (when the first event starts, e.g. "8 Oct, 9:30 AM"), it's a "pay
 * later" registration: the seat is blocked until then, and how to pay. Never throws.
 */
async function sendReceivedEmail(registration, { resubmitted = false, payBy = null } = {}) {
  try {
    const user = await participantOf(registration);
    if (!user?.email) return { sent: false };
    const events = await prisma.event.findMany({
      where: { id: { in: registration.eventIds } },
      orderBy: { startTime: "asc" },
    });
    const site = siteUrl();
    const statusLink = site ? `${site}/status?code=${encodeURIComponent(registration.registrationCode)}` : null;
    if (payBy) {
      const lines = [
        `Hi ${user.name},`,
        "",
        `Thank you for registering for Techastra '26 - your seat is blocked until your first event starts (${payBy}).`,
        "",
        `Registration code: ${registration.registrationCode}`,
        `Amount due: ₹${registration.totalAmount}`,
        "",
        "Your events:",
        ...events.map(formatEventLine),
        "",
        `Your registration is not complete until you pay. Pay ₹${registration.totalAmount} before ${payBy}, either:`,
        `- Online: open the registration status page${statusLink ? ` (${statusLink})` : ""}, enter your registration code and email, and submit your UPI transaction ID (UTR) and payment screenshot. The registration desk then checks it.`,
        "- Or in cash at the registration desk, before your event starts.",
        "",
        "Your digital ID card (with its QR code) is issued only after your payment is approved - you'll get an email then.",
        `If you haven't paid when your event starts (${payBy}), your seat is released for other participants.`,
        "",
        "Keep your registration code - you'll need it to pay and to check your status. For any queries, reply to this email.",
        "",
        "- Techastra '26 Team",
      ];
      return await sendMail({
        to: user.email,
        subject: `Techastra '26 seat blocked - pay before ${payBy} - ${registration.registrationCode}`,
        text: lines.join("\n"),
      });
    }
    const lines = [
      `Hi ${user.name},`,
      "",
      resubmitted
        ? `We've received your resubmitted payment for your Techastra '26 registration.`
        : `Thank you for registering for Techastra '26 - we've received your registration.`,
      "",
      `Registration code: ${registration.registrationCode}`,
      `Amount: ₹${registration.totalAmount}`,
      `UPI transaction ID (UTR): ${registration.transactionId || "-"}`,
      "",
      "Your events:",
      ...events.map(formatEventLine),
      "",
      "What happens next: the registration desk checks your payment. You'll get another email once your registration is approved - you can then sign in to get your digital ID card.",
      statusLink ? `Check your status any time: ${statusLink}` : "Check your status any time on the website's status page.",
      "",
      "Keep your registration code - you'll need it to check your status. For any queries, reply to this email.",
      "",
      "- Techastra '26 Team",
    ];
    return await sendMail({
      to: user.email,
      subject: resubmitted
        ? `Techastra '26 payment resubmitted - ${registration.registrationCode}`
        : `Techastra '26 registration received - ${registration.registrationCode}`,
      text: lines.join("\n"),
    });
  } catch (err) {
    console.warn("Received email error:", err.message);
    return { sent: false };
  }
}

module.exports = { sendReceivedEmail, sendApprovalEmail, sendRejectionEmail };
