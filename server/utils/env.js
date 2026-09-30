/**
 * Start-up configuration checks. In production the server refuses to start
 * with missing or placeholder secrets instead of running insecurely.
 */
const isProd = process.env.NODE_ENV === "production";

const PLACEHOLDERS = ["replace-this-with-a-long-random-secret", "changeme", "secret"];

function checkEnv() {
  const problems = [];
  if (!process.env.DATABASE_URL) problems.push("DATABASE_URL is not set.");

  const secret = process.env.JWT_SECRET || "";
  if (!secret) problems.push("JWT_SECRET is not set.");
  else if (isProd && (secret.length < 32 || PLACEHOLDERS.includes(secret)))
    problems.push("JWT_SECRET must be a random string of at least 32 characters.");

  if (isProd && !process.env.CLIENT_ORIGIN)
    problems.push("CLIENT_ORIGIN must list the deployed frontend URL(s), comma-separated.");

  if (problems.length) {
    console.error("\nConfiguration error - the API will not start:\n  - " + problems.join("\n  - ") + "\n");
    if (isProd || !process.env.JWT_SECRET || !process.env.DATABASE_URL) process.exit(1);
  }
  // Email goes through the host's sendmail (MAIL_TRANSPORT=sendmail) or
  // php-mailer/send.php (PHP mail()) - no SMTP. Missing config only means
  // approval emails aren't sent.
  const mailSecret = process.env.MAIL_ENDPOINT_SECRET || "";
  if (process.env.MAIL_TRANSPORT === "sendmail") {
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(process.env.MAIL_FROM || ""))
      console.warn("Warning: MAIL_TRANSPORT=sendmail needs MAIL_FROM (e.g. no-reply@techastra.drmgrdu.ac.in) - emails won't be sent.");
  } else if (!process.env.MAIL_ENDPOINT_URL || !mailSecret) {
    const msg = "MAIL_ENDPOINT_URL / MAIL_ENDPOINT_SECRET not set: approval emails are printed to this console instead of being sent.";
    isProd ? console.warn("Warning: " + msg) : console.log(msg);
  } else if (mailSecret.length < 32) {
    console.warn("Warning: MAIL_ENDPOINT_SECRET should be at least 32 random characters.");
  }
}

module.exports = { checkEnv, isProd };
