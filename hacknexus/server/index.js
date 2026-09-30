import { createApp } from "./app.js";
import { db } from "./db.js";
import { createMailer } from "./mailer.js";
const production = process.env.NODE_ENV === "production";
if (
  production &&
  (!process.env.DATABASE_URL || !process.env.APP_ORIGIN?.startsWith("https://"))
)
  throw new Error("Production requires DATABASE_URL and an HTTPS APP_ORIGIN.");
const mailer = createMailer();
if (!mailer)
  console.log(
    "Approval emails are off: set SMTP_HOST, SMTP_USER and SMTP_PASS to enable them.",
  );
const app = createApp(db, {
  production,
  origin: process.env.APP_ORIGIN || "http://localhost:5173",
  trustProxy: process.env.TRUST_PROXY === "1",
  mailer,
  // "/hacknexus" when served inside the Techastra '26 site.
  basePath: process.env.BASE_PATH || "",
  serveClient: production || process.env.SERVE_CLIENT === "1",
});
const server = app.listen(Number(process.env.PORT || 3001), "127.0.0.1", () =>
  console.log(
    `HACK_NEXUS server: http://localhost:${process.env.PORT || 3001}${process.env.BASE_PATH || ""}`,
  ),
);
for (const signal of ["SIGINT", "SIGTERM"])
  process.on(signal, () =>
    server.close(() => db.end().then(() => process.exit(0))),
  );
