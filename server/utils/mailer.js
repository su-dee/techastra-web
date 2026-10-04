const crypto = require("crypto");
const { spawn } = require("child_process");

/**
 * Sends Techastra's emails. Three ways, chosen by MAIL_TRANSPORT:
 *
 * - "smtp": sends through an SMTP account - the techastra@drmgrdu.ac.in
 *   Google Workspace mailbox with an app password. Needs SMTP_HOST,
 *   SMTP_PORT (587 STARTTLS or 465 TLS), SMTP_USER and SMTP_PASS; the
 *   sender is MAIL_FROM (default SMTP_USER), replies go to MAIL_REPLY_TO.
 * - "sendmail": hands the message to the server's sendmail program, exactly
 *   what PHP's mail() does, with the same headers as php-mailer/send.php.
 *   Needs MAIL_FROM (e.g. no-reply@techastra.drmgrdu.ac.in); optional
 *   MAIL_FROM_NAME, MAIL_REPLY_TO, MAIL_SENDMAIL_PATH (default
 *   /usr/sbin/sendmail) and MAIL_SENDMAIL_ARGS (extra leading arguments).
 * - otherwise: posts to the PHP mailer (php-mailer/send.php) at
 *   MAIL_ENDPOINT_URL, signed with MAIL_ENDPOINT_SECRET so only this API can
 *   use it.
 *
 * Attachments ({ filename, content: Buffer, contentType }) go out with
 * "smtp" and "sendmail"; the PHP mailer takes text only, so they are left off
 * there (the certificates email also says where to download them).
 *
 * Never throws: a failed email must not undo or block the action that
 * triggered it. With neither configured the email is printed to the console
 * instead (local development).
 */
async function sendMail({ to, subject, text, attachments = [] }) {
  if (process.env.MAIL_TRANSPORT === "smtp") return sendWithSmtp({ to, subject, text, attachments });
  if (process.env.MAIL_TRANSPORT === "sendmail") return sendWithSendmail({ to, subject, text, attachments });
  if (attachments.length) console.warn(`Email to ${to}: the PHP mailer can't send attachments - ${attachments.length} left off.`);

  const url = process.env.MAIL_ENDPOINT_URL;
  const secret = process.env.MAIL_ENDPOINT_SECRET;

  if (!url || !secret) {
    console.log("\n----- MOCK EMAIL (MAIL_ENDPOINT_URL not set) -----");
    console.log("To:", to);
    console.log("Subject:", subject);
    if (attachments.length) console.log("Attachments:", attachments.map((a) => a.filename).join(", "));
    console.log("Body:\n", text);
    console.log("--------------------------------------------------\n");
    return { sent: false, mocked: true };
  }

  const body = JSON.stringify({ to, subject, text, ts: Math.floor(Date.now() / 1000) });
  const signature = "sha256=" + crypto.createHmac("sha256", secret).update(body).digest("hex");

  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Techastra-Signature": signature },
      body,
      signal: AbortSignal.timeout(10000),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok || !data.ok) {
      console.warn(`Email to ${to} not sent: ${res.status} ${data.error || ""}`.trim());
      return { sent: false };
    }
    return { sent: true };
  } catch (err) {
    console.warn(`Email to ${to} not sent: ${err.message}`);
    return { sent: false };
  }
}

// One plain address; nothing that could add recipients or headers, or be
// read as a sendmail option.
const EMAIL_RE = /^[A-Za-z0-9.!#$%&'*+/=?^_`{|}~-]+@[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?(?:\.[A-Za-z0-9](?:[A-Za-z0-9-]*[A-Za-z0-9])?)+$/;
const isAddress = (s) => typeof s === "string" && s.length <= 254 && EMAIL_RE.test(s) && !s.startsWith("-");

// RFC 2047 encoded-word for non-ASCII header text (like PHP's encodeHeader).
const encodeHeader = (s) => (/^[\x20-\x7e]*$/.test(s) ? s : `=?UTF-8?B?${Buffer.from(s, "utf8").toString("base64")}?=`);

// The message as sendmail expects it: CRLF-free (sendmail normalises line
// ends), base64 body so no line is ever too long. With attachments it is
// multipart/mixed: the text, then each file.
function buildMessage({ from, fromName, replyTo, to, subject, text, attachments = [] }) {
  const domain = from.split("@")[1];
  const base64 = (buf) => buf.toString("base64").replace(/.{76}/g, "$&\n");
  const body = base64(Buffer.from(text, "utf8"));
  const headers = [
    `From: ${encodeHeader(fromName).replace(/[\r\n"]/g, "")} <${from}>`,
    `To: ${to}`,
    `Reply-To: ${replyTo}`,
    `Subject: ${encodeHeader(subject)}`,
    `Date: ${new Date().toUTCString().replace("GMT", "+0000")}`,
    `Message-ID: <${crypto.randomUUID()}@${domain}>`,
    "MIME-Version: 1.0",
  ];
  if (attachments.length) {
    const boundary = `=_techastra_${crypto.randomUUID()}`;
    const files = attachments.map((a) => {
      const name = String(a.filename).replace(/["\r\n\\]/g, "");
      return [
        `--${boundary}`,
        `Content-Type: ${a.contentType || "application/octet-stream"}; name="${name}"`,
        "Content-Transfer-Encoding: base64",
        `Content-Disposition: attachment; filename="${name}"`,
        "",
        base64(Buffer.from(a.content)),
      ].join("\n");
    });
    return [
      ...headers,
      `Content-Type: multipart/mixed; boundary="${boundary}"`,
      "X-Mailer: Techastra26",
      "",
      `--${boundary}`,
      "Content-Type: text/plain; charset=UTF-8",
      "Content-Transfer-Encoding: base64",
      "",
      body,
      ...files,
      `--${boundary}--`,
      "",
    ].join("\n");
  }
  return [
    ...headers,
    "Content-Type: text/plain; charset=UTF-8",
    "Content-Transfer-Encoding: base64",
    "X-Mailer: Techastra26",
    "",
    body,
    "",
  ].join("\n");
}

// MAIL_FROM may be a bare address or "Name <address>".
function parseFrom(value) {
  const m = String(value || "").trim().match(/^(?:"?([^"<]*?)"?\s*<([^>]+)>|(\S+))$/);
  if (!m) return { name: "", address: "" };
  return { name: (m[1] || "").trim(), address: (m[2] || m[3] || "").trim() };
}

// One transport for the whole process, so connections are pooled.
let smtpTransport;
function getSmtpTransport() {
  if (!smtpTransport) {
    const nodemailer = require("nodemailer");
    const port = Number(process.env.SMTP_PORT || 587);
    smtpTransport = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port,
      secure: port === 465,
      requireTLS: port !== 465,
      pool: true,
      maxConnections: 3,
      auth: {
        user: process.env.SMTP_USER,
        // Google shows app passwords as "abcd efgh ijkl mnop"; the spaces aren't part of it.
        pass: String(process.env.SMTP_PASS || "").replace(/\s+/g, ""),
      },
      connectionTimeout: 15000,
      greetingTimeout: 15000,
      socketTimeout: 20000,
    });
  }
  return smtpTransport;
}

async function sendWithSmtp({ to, subject, text, attachments = [] }) {
  if (!process.env.SMTP_HOST || !process.env.SMTP_USER || !process.env.SMTP_PASS) {
    console.warn("Email not sent: SMTP_HOST / SMTP_USER / SMTP_PASS are not all set.");
    return { sent: false };
  }
  const parsed = parseFrom(process.env.MAIL_FROM || process.env.SMTP_USER);
  const from = parsed.address;
  const fromName = process.env.MAIL_FROM_NAME || parsed.name || "Techastra '26";
  const replyTo = process.env.MAIL_REPLY_TO || from;
  const recipient = String(to || "").trim();
  if (!isAddress(from) || !isAddress(replyTo)) {
    console.warn("Email not sent: MAIL_FROM / MAIL_REPLY_TO is not a valid address.");
    return { sent: false };
  }
  if (!isAddress(recipient)) {
    console.warn("Email not sent: invalid recipient address.");
    return { sent: false };
  }
  const cleanSubject = String(subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const cleanText = String(text || "").replace(/\r\n?/g, "\n").slice(0, 20000);
  if (!cleanSubject || !cleanText) {
    console.warn(`Email to ${recipient} not sent: subject and text are required.`);
    return { sent: false };
  }
  try {
    await getSmtpTransport().sendMail({
      from: { name: fromName.replace(/[\r\n"]/g, ""), address: from },
      to: recipient,
      replyTo,
      subject: cleanSubject,
      text: cleanText,
      attachments: attachments.map((a) => ({ filename: a.filename, content: a.content, contentType: a.contentType })),
      headers: { "X-Mailer": "Techastra26" },
    });
    return { sent: true };
  } catch (err) {
    console.warn(`Email to ${recipient} not sent: ${err.message}`);
    return { sent: false };
  }
}

function sendWithSendmail({ to, subject, text, attachments = [] }) {
  const from = process.env.MAIL_FROM || "";
  const replyTo = process.env.MAIL_REPLY_TO || from;
  const fromName = process.env.MAIL_FROM_NAME || "Techastra '26";
  const recipient = String(to || "").trim();
  if (!isAddress(from) || !isAddress(replyTo)) {
    console.warn("Email not sent: MAIL_FROM / MAIL_REPLY_TO is not a valid address.");
    return Promise.resolve({ sent: false });
  }
  if (!isAddress(recipient)) {
    console.warn("Email not sent: invalid recipient address.");
    return Promise.resolve({ sent: false });
  }
  const cleanSubject = String(subject || "").replace(/[\r\n]+/g, " ").trim().slice(0, 200);
  const cleanText = String(text || "").replace(/\r\n?/g, "\n").slice(0, 20000);
  if (!cleanSubject || !cleanText) {
    console.warn(`Email to ${recipient} not sent: subject and text are required.`);
    return Promise.resolve({ sent: false });
  }
  const message = buildMessage({ from, fromName, replyTo, to: recipient, subject: cleanSubject, text: cleanText, attachments });

  const command = process.env.MAIL_SENDMAIL_PATH || "/usr/sbin/sendmail";
  const extra = (process.env.MAIL_SENDMAIL_ARGS || "").split(" ").filter(Boolean);
  // -i: a line with a single "." doesn't end the message; -f: envelope sender
  // (bounces go there, and SPF checks it) - the same as PHP's mail(..., "-f").
  const args = [...extra, "-i", "-f", from, recipient];

  return new Promise((resolve) => {
    let settled = false;
    let errText = "";
    const done = (result, warning) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (warning) console.warn(`Email to ${recipient} not sent: ${warning}`);
      resolve(result);
    };
    let child;
    try {
      child = spawn(command, args, { stdio: ["pipe", "ignore", "pipe"] });
    } catch (err) {
      return done({ sent: false }, err.message);
    }
    const timer = setTimeout(() => {
      child.kill();
      done({ sent: false }, "sendmail timed out");
    }, 15000);
    child.stderr.on("data", (d) => (errText = (errText + d).slice(-500)));
    child.on("error", (err) => done({ sent: false }, `${command}: ${err.message}`));
    child.on("close", (code) => (code === 0 ? done({ sent: true }) : done({ sent: false }, `sendmail exited ${code} ${errText.trim()}`.trim())));
    child.stdin.on("error", () => {}); // reported through "close"/"error"
    child.stdin.end(message);
  });
}

module.exports = { sendMail, buildMessage };
