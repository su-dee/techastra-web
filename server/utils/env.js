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
  if (!isProd && !process.env.SMTP_HOST) {
    console.log("SMTP_HOST not set: emails are printed to this console instead of being sent.");
  }
}

module.exports = { checkEnv, isProd };
