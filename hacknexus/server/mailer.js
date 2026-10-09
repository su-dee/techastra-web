import nodemailer from "nodemailer";
import { settings } from "./env.js";

// Event details quoted in emails; keep in sync with the timeline in src/main.jsx.
const EVENT = {
  name: "HACK_NEXUS 1.0",
  date: "Thursday, 8 October 2026",
  reporting: "8:30 AM IST",
  kickoff: "9:00 AM IST",
  venue: "CAR Lab, 2nd Floor, Anna Block, Main Campus",
};

const escapeHtml = (text) =>
  String(text).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const rupees = (amount) =>
  `₹${Number(amount).toLocaleString("en-IN", { maximumFractionDigits: 0 })}`;
// A "Squad members" section, or nothing when no member details were given.
const membersSection = (members = []) =>
  members.length
    ? [
        {
          title: "Squad members",
          items: members.map(
            (m, i) =>
              `${m.fullName}${i === 0 ? " (Squad lead)" : ""}, ${m.college}, ${m.email}, ${m.phone}`,
          ),
        },
      ]
    : [];
const reference = (registrationId) =>
  `HN-${registrationId.slice(0, 8).toUpperCase()}`;

// A plain, table-based layout that renders consistently across mail clients.
function layout({
  heading,
  accent,
  paragraphs,
  details,
  sections = [],
  action,
  signoffHtml,
}) {
  const rows = details
    .map(
      ([label, value]) =>
        `<tr><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#6b7280;width:40%">${escapeHtml(label)}</td><td style="padding:8px 12px;border-bottom:1px solid #e5e7eb;color:#111827;font-weight:600">${escapeHtml(value)}</td></tr>`,
    )
    .join("");
  const blocks = sections
    .map(
      ({ title, items, note }) =>
        `<h3 style="margin:28px 0 8px;font-size:16px;color:#111827">${escapeHtml(title)}</h3>` +
        (note
          ? `<p style="margin:0 0 8px;padding:12px 16px;background:#fef2f2;border-left:4px solid #b91c1c;color:#111827">${escapeHtml(note)}</p>`
          : "") +
        (items
          ? `<ol style="margin:0;padding-left:20px;color:#374151">${items.map((i) => `<li style="margin:6px 0">${escapeHtml(i)}</li>`).join("")}</ol>`
          : ""),
    )
    .join("");
  return `<!doctype html><html><body style="margin:0;padding:0;background:#f3f4f6">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f3f4f6;padding:24px 0"><tr><td align="center">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#ffffff;border-radius:8px;overflow:hidden;font-family:Arial,Helvetica,sans-serif;font-size:15px;line-height:1.6">
<tr><td style="background:#0b0f0a;padding:24px 32px;color:#ffffff;font-size:20px;font-weight:700;letter-spacing:1px">${EVENT.name}</td></tr>
<tr><td style="height:4px;background:${accent}"></td></tr>
<tr><td style="padding:32px">
<h2 style="margin:0 0 16px;font-size:22px;color:#111827">${escapeHtml(heading)}</h2>
${paragraphs.map((p) => `<p style="margin:0 0 14px;color:#374151">${p}</p>`).join("")}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:20px 0;border:1px solid #e5e7eb;border-radius:6px;border-collapse:separate;font-size:14px">${rows}</table>
${blocks}
${
  action
    ? `<p style="margin:28px 0 8px"><a href="${escapeHtml(action.url)}" style="display:inline-block;padding:12px 24px;background:#111827;color:#ffffff;text-decoration:none;font-weight:600;border-radius:6px">${escapeHtml(action.label)}</a></p>
<p style="margin:0 0 20px;font-size:13px;color:#6b7280">If the button does not work, copy this link into your browser: ${escapeHtml(action.url)}</p>`
    : ""
}
${signoffHtml}
</td></tr>
<tr><td style="padding:20px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">This is an automated message about your ${EVENT.name} registration. You received it because this address is listed as the squad lead's email.</td></tr>
</table></td></tr></table></body></html>`;
}

// Plain-text version of the same content; mail clients and spam filters expect both.
function plainText({
  greeting,
  paragraphs,
  details,
  sections = [],
  action,
  signoff,
}) {
  const strip = (html) => html.replace(/<[^>]+>/g, "");
  return [
    greeting,
    "",
    ...paragraphs.flatMap((p) => [strip(p), ""]),
    ...details.map(([label, value]) => `${label}: ${value}`),
    "",
    ...sections.flatMap(({ title, items, note }) => [
      title.toUpperCase(),
      ...(note ? [note] : []),
      ...(items || []).map((item, i) => `${i + 1}. ${item}`),
      "",
    ]),
    ...(action ? [`${action.label}: ${action.url}`, ""] : []),
    ...signoff,
  ].join("\n");
}

// Returns a mailer for squad emails, or null when SMTP is not configured.
// Works with any SMTP provider; Gmail with an app password is free.
export function createMailer(env = settings) {
  const { SMTP_HOST, SMTP_USER, SMTP_PASS } = env;
  if (!SMTP_HOST || !SMTP_USER || !SMTP_PASS) return null;
  const port = Number(env.SMTP_PORT || 465);
  const transport = nodemailer.createTransport({
    host: SMTP_HOST,
    port,
    secure: port === 465,
    auth: { user: SMTP_USER, pass: SMTP_PASS },
  });
  const from = env.MAIL_FROM || `${EVENT.name} <${SMTP_USER}>`;
  const contact = env.MAIL_REPLY_TO || SMTP_USER;
  const signoff = [
    "Warm regards,",
    `Organising Committee, ${EVENT.name}`,
    contact,
  ];
  const signoffHtml = `<p style="margin:24px 0 0;color:#374151">Warm regards,<br><strong>Organising Committee, ${EVENT.name}</strong><br><a href="mailto:${escapeHtml(contact)}" style="color:#374151">${escapeHtml(contact)}</a></p>`;

  async function send({ to, subject, greeting, accent, heading, attachments, ...content }) {
    const html = layout({
      heading,
      accent,
      ...content,
      paragraphs: [escapeHtml(greeting), ...content.paragraphs],
      signoffHtml,
    });
    await transport.sendMail({
      from,
      to,
      replyTo: contact,
      subject,
      text: plainText({ greeting, ...content, signoff }),
      html,
      ...(attachments?.length ? { attachments } : {}),
    });
  }

  return {
    async sendRegistrationEmail({
      to,
      teamName,
      registrationId,
      squadSize,
      fee,
      members,
      paymentUrl,
    }) {
      const team = escapeHtml(teamName);
      await send({
        to,
        subject: `Registration received: ${teamName}, ${EVENT.name}`,
        greeting: `Dear Squad Lead of ${teamName},`,
        accent: "#2563eb",
        heading: "We have received your registration",
        paragraphs: [
          `Thank you for registering your squad, <strong>${team}</strong>, for ${EVENT.name}. Your registration has been recorded successfully.`,
          `Please note that your place is <strong>not yet confirmed</strong>. To complete your registration, the registration fee of ${rupees(fee)} per team must be paid and verified by the organising committee.`,
        ],
        details: [
          ["Squad name", teamName],
          ["Registration reference", reference(registrationId)],
          ["Squad size", `${squadSize} members`],
          ["Problem statement & track", "Given on the spot at the event"],
          ["Registration fee", `${rupees(fee)} per team`],
          ["Status", "Registered, payment pending"],
        ],
        sections: [
          ...membersSection(members),
          {
            title: "How to complete your registration",
            items: [
              "Sign in to your account and open the payment page using the button below.",
              `Pay ${rupees(fee)} by scanning the UPI QR code shown on that page. Keep the payment note "HACK_NEXUS ${reference(registrationId)}" so we can identify your squad.`,
              "Upload a screenshot of the successful payment and enter the UPI transaction ID.",
              "The organising committee will verify your payment. You will receive an email once it is approved, along with your squad ID card.",
            ],
          },
          {
            title: "Event details",
            items: [
              `Date: ${EVENT.date}`,
              `Reporting time: ${EVENT.reporting} (the sprint begins at ${EVENT.kickoff})`,
              `Venue: ${EVENT.venue}`,
            ],
          },
        ],
        action: { label: "Complete payment", url: paymentUrl },
      });
    },

    async sendPaymentReceivedEmail({
      to,
      teamName,
      registrationId,
      squadSize,
      transactionId,
      amount,
      members,
      statusUrl,
    }) {
      const team = escapeHtml(teamName);
      await send({
        to,
        subject: `Registration completed: ${teamName}, ${EVENT.name}`,
        greeting: `Dear Squad Lead of ${teamName},`,
        accent: "#2563eb",
        heading: "Your registration is complete",
        paragraphs: [
          `Thank you. We have received the payment details for your squad, <strong>${team}</strong>, and your registration for ${EVENT.name} is now complete.`,
          "The organising committee will now verify your payment against our UPI records. Once it is verified, you will receive a confirmation email along with your squad ID card. No further action is required from you at this stage.",
        ],
        details: [
          ["Squad name", teamName],
          ["Registration reference", reference(registrationId)],
          ["Squad size", `${squadSize} members`],
          ["Amount paid", rupees(amount)],
          ["UPI transaction ID", transactionId],
          ["Status", "Payment under verification"],
        ],
        sections: [
          ...membersSection(members),
          {
            title: "What happens next",
            items: [
              "The organising committee verifies your payment screenshot and transaction ID.",
              "Once verified, you will receive a confirmation email and your squad ID card will be available in your account.",
              "If there is a problem with the payment, you will receive an email explaining the reason and how to resubmit.",
              "You can check the status of your payment at any time using the button below.",
            ],
          },
          {
            title: "Event details",
            items: [
              `Date: ${EVENT.date}`,
              `Reporting time: ${EVENT.reporting} (the sprint begins at ${EVENT.kickoff})`,
              `Venue: ${EVENT.venue}`,
            ],
          },
        ],
        action: { label: "View payment status", url: statusUrl },
      });
    },

    async sendApprovalEmail({
      to,
      teamName,
      registrationId,
      squadSize,
      transactionId,
      amount,
      members,
      passUrl,
    }) {
      const team = escapeHtml(teamName);
      await send({
        to,
        subject: `Registration confirmed: ${teamName}, ${EVENT.name}`,
        greeting: `Dear Squad Lead of ${teamName},`,
        accent: "#16a34a",
        heading: "Your registration is confirmed",
        paragraphs: [
          `We are pleased to inform you that the organising committee has verified your registration payment. Your squad, <strong>${team}</strong>, is now formally approved to participate in ${EVENT.name}.`,
          "Your squad ID card has been issued. Please review the details below and keep this email for your records.",
        ],
        details: [
          ["Squad name", teamName],
          ["Registration reference", reference(registrationId)],
          ["Squad size", `${squadSize} members`],
          ["Amount received", rupees(amount)],
          ["UPI transaction ID", transactionId],
          ["Status", "Approved"],
        ],
        sections: [
          ...membersSection(members),
          {
            title: "Event details",
            items: [
              `Date: ${EVENT.date}`,
              `Reporting time: ${EVENT.reporting} (the sprint begins at ${EVENT.kickoff})`,
              `Venue: ${EVENT.venue}`,
            ],
          },
          {
            title: "Before the event",
            items: [
              "Sign in to your account and open your squad ID card using the button below.",
              "Download the card as an image or print it. The QR code on the card is scanned at check-in.",
              "Ensure all squad members arrive together at the reporting time with a valid college ID.",
              "Bring your laptops, chargers, and any hardware your project requires.",
            ],
          },
        ],
        action: { label: "View squad ID card", url: passUrl },
      });
    },

    async sendRejectionEmail({
      to,
      teamName,
      registrationId,
      transactionId,
      amount,
      reason,
      paymentUrl,
    }) {
      const team = escapeHtml(teamName);
      await send({
        to,
        subject: `Action required: payment not verified for ${teamName}, ${EVENT.name}`,
        greeting: `Dear Squad Lead of ${teamName},`,
        accent: "#b91c1c",
        heading: "We could not verify your payment",
        paragraphs: [
          `Thank you for registering <strong>${team}</strong> for ${EVENT.name}. After reviewing the payment details you submitted, the organising committee was unable to verify your payment at this time.`,
          "Your registration has <strong>not</strong> been cancelled. It will remain on hold until a valid payment is verified.",
        ],
        details: [
          ["Squad name", teamName],
          ["Registration reference", reference(registrationId)],
          ["Submitted transaction ID", transactionId],
          ["Registration fee", rupees(amount)],
          ["Status", "Payment not verified"],
        ],
        sections: [
          { title: "Reason given by the organisers", note: reason },
          {
            title: "What to do next",
            items: [
              "Sign in to your account and open the payment page using the button below.",
              `If you have not paid yet, complete the payment of ${rupees(amount)} using the UPI QR code shown on that page.`,
              "Upload a clear screenshot of the successful payment and enter the correct UPI transaction ID.",
              "Submit the form. The organising committee will review it again and notify you by email.",
            ],
          },
          {
            title: "Already paid?",
            items: [
              `If you believe this is a mistake, reply to this email with your payment screenshot and registration reference (${reference(registrationId)}) and we will look into it.`,
            ],
          },
        ],
        action: { label: "Resubmit payment", url: paymentUrl },
      });
    },
    // Participation certificates for a checked-in squad, one PDF per
    // member, sent to the squad lead.
    async sendCertificatesEmail({ to, teamName, members, attachments }) {
      await send({
        to,
        subject: `Your participation certificates: ${teamName}, ${EVENT.name}`,
        greeting: `Dear Squad Lead of ${teamName},`,
        accent: "#16a34a",
        heading: "Your participation certificates",
        paragraphs: [
          `Thank you for taking part in ${EVENT.name} at Techastra '26. The participation certificates for <strong>${escapeHtml(teamName)}</strong> are attached, one for each member.`,
          "Please forward each member their own certificate.",
        ],
        details: members.map((m, i) => [i === 0 ? "Squad lead" : `Member ${i + 1}`, m]),
        attachments,
      });
    },
  };
}
