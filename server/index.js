require("dotenv").config();
const express = require("express");
const http = require("http");
const cors = require("cors");
const path = require("path");
const { Server } = require("socket.io");

const { checkEnv, isProd } = require("./utils/env");
checkEnv(); // exits with a clear message if production config is unsafe

const prisma = require("./db");
const { initSocket } = require("./socket");
const requestLogger = require("./middleware/requestLogger");
const { globalLimiter } = require("./middleware/rateLimiter");
const { uploadDir } = require("./middleware/upload");

const authRoutes = require("./routes/auth");
const eventRoutes = require("./routes/events");
const registrationRoutes = require("./routes/registrations");
const registrationTeamRoutes = require("./routes/registration-team");
const attendanceRoutes = require("./routes/attendance");
const foodRoutes = require("./routes/food");
const resultRoutes = require("./routes/results");
const certificateRoutes = require("./routes/certificates");
const announcementRoutes = require("./routes/announcements");
const feedbackRoutes = require("./routes/feedback");
const helpRoutes = require("./routes/help");
const adminRoutes = require("./routes/admin");
const upiRoutes = require("./routes/upi");
const comboRoutes = require("./routes/combos");

const app = express();
const server = http.createServer(app);

app.disable("x-powered-by");
// Behind Render's (or any) reverse proxy, trust one hop so req.ip is the
// real client address - rate limits depend on it. Override with TRUST_PROXY.
app.set("trust proxy", process.env.TRUST_PROXY !== undefined ? Number(process.env.TRUST_PROXY) : isProd ? 1 : false);
// Defence in depth: password hashes never leave the server, whichever route
// forgets to exclude them (several include the full `user` relation).
app.set("json replacer", (key, value) => (key === "passwordHash" ? undefined : value));

// Hack Nexus at /hacknexus, before everything else here: it has its own
// security headers, body parsing and rate limits.
// - HACKNEXUS_EMBEDDED=1 (or the older HACKNEXUS_START=1): run it inside
//   this process - one app on the server. Its settings are HN_* variables.
// - HACKNEXUS_ORIGIN: forward to it where it runs as a separate app.
if (process.env.HACKNEXUS_EMBEDDED === "1" || process.env.HACKNEXUS_START === "1") {
  const { hackNexusEmbedded } = require("./utils/hacknexusEmbedded");
  app.use(hackNexusEmbedded({ production: isProd, trustProxy: Boolean(app.get("trust proxy")) }));
} else if (process.env.HACKNEXUS_ORIGIN) {
  const { hackNexusProxy } = require("./utils/hacknexusProxy");
  // "/hacknexus" -> "/hacknexus/" (exact path only; Express's own routing
  // treats both the same, which would loop).
  app.use((req, res, next) => (req.path === "/hacknexus" ? res.redirect(301, "/hacknexus/") : next()));
  app.use("/hacknexus", hackNexusProxy(process.env.HACKNEXUS_ORIGIN, process.env.HACKNEXUS_HOST));
}

// Security headers (OWASP Secure Headers Project recommendations).
app.use((req, res, next) => {
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "geolocation=(), microphone=(), camera=(), payment=()");
  res.setHeader("Cross-Origin-Opener-Policy", "same-origin");
  // The legacy XSS auditor is itself exploitable; OWASP now recommends "0".
  res.setHeader("X-XSS-Protection", "0");
  if (isProd) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
  // JSON API responses never need to load anything.
  if (req.path.startsWith("/api/")) {
    res.setHeader("Content-Security-Policy", "default-src 'none'; frame-ancestors 'none'");
    res.setHeader("Cache-Control", "no-store");
  }
  next();
});

// Allowed CORS origins: CLIENT_ORIGIN (comma-separated) in production. In
// development the common local Vite ports are allowed too, because Vite
// silently moves to 5174/5175 when 5173 is taken.
const devOrigins = [5173, 5174, 5175].flatMap((p) => [`http://localhost:${p}`, `http://127.0.0.1:${p}`]);
const envOrigins = (process.env.CLIENT_ORIGIN || "")
  .split(",")
  .map((o) => o.trim().replace(/\/$/, ""))
  .filter(Boolean);
const allowedOrigins = [...new Set([...(isProd ? [] : devOrigins), ...envOrigins])];

// Requests with no Origin header (curl, same-origin, health checks) pass.
const corsOrigin = (origin, callback) => {
  if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
  const err = new Error("Origin not allowed");
  err.status = 403;
  return callback(err);
};

const io = new Server(server, {
  cors: { origin: corsOrigin, methods: ["GET", "POST"] },
});
initSocket(io);

app.use(cors({ origin: corsOrigin }));
app.use(express.json({ limit: "100kb" }));
app.use(requestLogger);
app.use("/api", globalLimiter);

// Only generated certificate PDFs are public (anyone holding a certificate
// can share it; it is also verifiable by code). Payment screenshots stay
// private - see GET /api/registrations/:id/proof.
app.use(
  "/uploads/certificates",
  express.static(path.join(uploadDir, "certificates"), { index: false, dotfiles: "deny", maxAge: "7d" })
);

app.get("/api/health", async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: "ok", db: "ok", time: new Date().toISOString() });
  } catch {
    res.status(503).json({ status: "degraded", db: "unreachable", time: new Date().toISOString() });
  }
});

app.use("/api/auth", authRoutes);
app.use("/api/events", eventRoutes);
app.use("/api/registrations", registrationRoutes);
app.use("/api/registration-team", registrationTeamRoutes);
app.use("/api/attendance", attendanceRoutes);
app.use("/api/food", foodRoutes);
app.use("/api/kits", require("./routes/kits"));
app.use("/api/participants", require("./routes/participants"));
app.use("/api/results", resultRoutes);
app.use("/api/certificates", certificateRoutes);
app.use("/api/announcements", announcementRoutes);
app.use("/api/feedback", feedbackRoutes);
app.use("/api/help", helpRoutes);
app.use("/api/admin", adminRoutes);
app.use("/api/upi", upiRoutes);
app.use("/api/combos", comboRoutes);

// Development only: the browser click logger (client/src/lib/clickLogger.js)
// posts here. Never exposed in production - it is unauthenticated.
if (!isProd) app.use("/api/logs", require("./routes/logs"));

// Razorpay is optional (payments currently go by UPI QR). Its routes are only
// mounted when both keys are configured.
if (process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET) {
  app.use("/api/payment", require("./routes/payment"));
}

app.use("/api", (req, res) => res.status(404).json({ error: "Not found" }));

// The website itself (client/dist, built with `npm run build`) is served by
// this same app in production, so the portal and API share one domain.
// Headers match the old client/vercel.json, with every source same-origin.
const clientDist = process.env.CLIENT_DIST || path.join(__dirname, "..", "client", "dist");
if ((isProd || process.env.SERVE_CLIENT === "1") && require("fs").existsSync(path.join(clientDist, "index.html"))) {
  const SITE_CSP = [
    "default-src 'self'",
    "script-src 'self'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src 'self' https://fonts.gstatic.com",
    "img-src 'self' data: blob:",
    "connect-src 'self'",
    "media-src 'self' blob:",
    "frame-src https://www.google.com",
    "worker-src 'self' blob:",
    "object-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    "frame-ancestors 'none'",
    ...(isProd ? ["upgrade-insecure-requests"] : []),
  ].join("; ");
  const siteHeaders = (res) => {
    res.setHeader("Content-Security-Policy", SITE_CSP);
    // The camera is needed for QR scanning (attendance / food counters).
    res.setHeader("Permissions-Policy", "camera=(self), microphone=(), geolocation=(), payment=()");
  };
  app.use(
    "/assets",
    express.static(path.join(clientDist, "assets"), { immutable: true, maxAge: "1y", index: false, fallthrough: false })
  );
  app.use(
    express.static(clientDist, {
      index: false,
      setHeaders: (res) => {
        siteHeaders(res);
        res.setHeader("Cache-Control", "no-cache");
      },
    })
  );
  // Every other page is the single-page app (React Router decides).
  app.get(/^\/(?!api\/|uploads\/|hacknexus(\/|$)|socket\.io\/).*/, (req, res) => {
    siteHeaders(res);
    res.setHeader("Cache-Control", "no-cache");
    res.sendFile(path.join(clientDist, "index.html"));
  });
}

// Centralised error handler. 4xx messages are meant for the user; anything
// else is logged and replaced with a generic message so internals don't leak.
// eslint-disable-next-line no-unused-vars
app.use((err, req, res, next) => {
  let status = err.status || err.statusCode || 500;
  if (err.name === "MulterError") status = 400;
  if (err.type === "entity.too.large") status = 413;
  if (status >= 500) console.error("Unhandled error:", err);
  const message =
    err.name === "MulterError" && err.code === "LIMIT_FILE_SIZE"
      ? "The screenshot is too large (max 5 MB)."
      : status < 500
        ? err.message
        : "Something went wrong. Please try again.";
  res.status(status).json({ error: message });
});

const PORT = process.env.PORT || 4000;
server.listen(PORT, () => {
  console.log(`\nTechastra API listening on port ${PORT} (${isProd ? "production" : "development"})`);
  // "Pay later": release unpaid seat holds once the payment deadline passes.
  require("./utils/payLater").startHoldReleaser();
});

// Graceful shutdown: finish in-flight requests, then close the DB pool.
// Render and most hosts send SIGTERM before replacing an instance.
let shuttingDown = false;
function shutdown(signal) {
  if (shuttingDown) return;
  shuttingDown = true;
  console.log(`${signal} received, shutting down…`);
  io.close();
  server.close(async () => {
    await prisma.$disconnect().catch(() => {});
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}
process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));
process.on("unhandledRejection", (reason) => console.error("Unhandled promise rejection:", reason));

module.exports = { app, server };
