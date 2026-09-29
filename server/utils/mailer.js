const crypto = require("crypto");

/**
 * Sends an email through the PHP mailer on the website host
 * (php-mailer/send.php), which uses PHP's built-in mail() - no SMTP account
 * or paid email service. The request is signed with MAIL_ENDPOINT_SECRET so
 * only this API can use the mailer.
 *
 * Never throws: a failed email must not undo or block the action that
 * triggered it. Without MAIL_ENDPOINT_URL the email is printed to the
 * console instead (local development).
 */
async function sendMail({ to, subject, text }) {
  const url = process.env.MAIL_ENDPOINT_URL;
  const secret = process.env.MAIL_ENDPOINT_SECRET;

  if (!url || !secret) {
    console.log("\n----- MOCK EMAIL (MAIL_ENDPOINT_URL not set) -----");
    console.log("To:", to);
    console.log("Subject:", subject);
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

module.exports = { sendMail };
