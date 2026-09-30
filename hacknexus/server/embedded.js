// Hack Nexus inside the Techastra '26 server (one process, one Plesk app):
// that server imports this with HACKNEXUS_EMBEDDED=1 and hands /hacknexus/*
// requests to the returned app. Settings come from HN_-prefixed variables
// (see env.js); the site is always served under /hacknexus.
import { embedded, setting } from "./env.js";
import { createApp } from "./app.js";
import { db } from "./db.js";
import { createMailer } from "./mailer.js";

export const BASE_PATH = "/hacknexus";

export function createEmbeddedApp({ production = process.env.NODE_ENV === "production", trustProxy = false } = {}) {
  if (!embedded) throw new Error("Set HACKNEXUS_EMBEDDED=1 to embed Hack Nexus.");
  const origin = setting("APP_ORIGIN") || "http://localhost:5173";
  if (!setting("DATABASE_URL")) throw new Error("Hack Nexus needs HN_DATABASE_URL.");
  if (production && !origin.startsWith("https://"))
    throw new Error("Hack Nexus in production needs an https HN_APP_ORIGIN.");
  const mailer = createMailer();
  if (!mailer) console.log("Hack Nexus: approval emails are off (set HN_SMTP_HOST, HN_SMTP_USER and HN_SMTP_PASS).");
  const app = createApp(db, {
    production,
    origin,
    trustProxy,
    mailer,
    basePath: BASE_PATH,
    serveClient: production || setting("SERVE_CLIENT") === "1",
  });
  return { app, close: () => db.end() };
}
