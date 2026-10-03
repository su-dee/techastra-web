import express from "express";
import helmet from "helmet";
import { rateLimit } from "express-rate-limit";
import { randomBytes, randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import {
  hashPassword,
  verifyPassword,
  passwordCandidate,
  passwordProblem,
  tokenHash,
} from "./auth.js";
import { createAdminRouter } from "./admin.js";
import { createPaymentRouter, paymentConfig } from "./payments.js";
import {
  memberValues,
  membersOf,
  saveMembers,
  validateMembers,
} from "./members.js";

const { problems } = JSON.parse(
  readFileSync(new URL("../src/content.json", import.meta.url)),
);
// Builders per squad - every new registration has exactly this many.
export const SQUAD_SIZE = 3;
const cookieName = "hn_session";
const duration = 7 * 24 * 60 * 60 * 1000;
const dummyHash = await hashPassword(randomBytes(20).toString("hex"));
const loginName = (value) =>
  typeof value === "string" ? value.trim().toLowerCase() : "";
export function createApp(
  db,
  {
    production = false,
    origin = "http://localhost:5173",
    trustProxy = false,
    mailer = null,
    // Serve the site under a path prefix, e.g. "/hacknexus" when it runs inside
    // the Techastra '26 site. Pages, API, cookies and email links follow it.
    basePath = "",
    // Serve the built client (dist/). On in production; can be turned on in
    // development to run behind the Techastra site locally.
    serveClient = production,
  } = {},
) {
  const base = basePath && basePath !== "/" ? "/" + basePath.replace(/^\/+|\/+$/g, "") : "";
  // Links in emails point at the site's public address, prefix included.
  const siteUrl = origin + base;
  const app = express();
  const allowedOrigins = new Set([origin]);
  if (!production && origin === "http://localhost:5173")
    allowedOrigins.add("http://127.0.0.1:5173");
  if (trustProxy) app.set("trust proxy", 1);
  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: production ? undefined : false,
      strictTransportSecurity: production ? undefined : false,
    }),
  );
  const smallJson = express.json({ limit: "16kb" });
  // Payment screenshots use a larger, route-specific limit.
  app.use((req, res, next) =>
    req.method === "POST" && req.path === "/api/payments"
      ? next()
      : smallJson(req, res, next),
  );
  app.use("/api", (req, res, next) => {
    res.set("Cache-Control", "no-store");
    if (
      !["GET", "HEAD", "OPTIONS"].includes(req.method) &&
      (!allowedOrigins.has(req.get("origin")) ||
        req.get("sec-fetch-site") === "cross-site")
    ) {
      return res.status(403).json({ error: "Request origin not allowed." });
    }
    next();
  });
  app.use(
    "/api",
    rateLimit({
      windowMs: 60_000,
      limit: 100,
      standardHeaders: "draft-8",
      legacyHeaders: false,
      message: { error: "Too many requests. Please try again shortly." },
    }),
  );
  // Wrong passwords are limited per account, so one shared campus network
  // is not locked out by a few typos. Per network, only failures count.
  const accountFailures = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
    keyGenerator: (req) =>
      `user:${req.user?.username ?? loginName(req.body?.username).slice(0, 30)}`,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: {
      error:
        "Too many wrong passwords for this account. Try again in 15 minutes.",
    },
  });
  const networkFailures = rateLimit({
    windowMs: 15 * 60_000,
    limit: 100,
    skipSuccessfulRequests: true,
    requestWasSuccessful: (req, res) => res.statusCode !== 401,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  const signupLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 50,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many new accounts. Try again in 15 minutes." },
  });
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    path: base || "/",
  };
  const getToken = (req) => {
    const value = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${cookieName}=`))
      ?.slice(cookieName.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  };
  async function issueSession(req, res, user) {
    const old = getToken(req);
    if (old)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(old),
      ]);
    await db.query("DELETE FROM sessions WHERE expires_at <= NOW()");
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions (token_hash,user_id,expires_at) VALUES ($1,$2,$3)",
      [tokenHash(token), user.id, new Date(Date.now() + duration)],
    );
    res.cookie(cookieName, token, { ...cookieOptions, maxAge: duration });
  }
  async function requireUser(req, res, next) {
    const token = getToken(req);
    if (!token)
      return res.status(401).json({ error: "Please sign in to continue." });
    const result = await db.query(
      `SELECT u.id,u.username,u.password_kind<>'chosen' AS "mustSetPassword" FROM users u JOIN sessions s ON u.id=s.user_id WHERE s.token_hash=$1 AND NOT s.is_admin AND s.expires_at>NOW()`,
      [tokenHash(token)],
    );
    if (!result.rows[0])
      return res
        .status(401)
        .json({ error: "Your session has expired. Please sign in again." });
    req.user = result.rows[0];
    next();
  }
  app.get("/api/health", async (req, res) => {
    try {
      await db.query("SELECT 1");
      res.json({ status: "ok", database: "connected" });
    } catch {
      res.status(503).json({
        status: "unavailable",
        error: "Database unavailable. Please try again later.",
      });
    }
  });
  app.post("/api/auth/signup", signupLimiter, async (req, res) => {
    const username = loginName(req.body.username);
    if (!/^[a-z0-9_]{3,30}$/.test(username))
      return res.status(400).json({
        error: "Use a 3–30 character username (letters, numbers, underscores).",
      });
    const problem = passwordProblem(req.body.password, username);
    if (problem) return res.status(400).json({ error: problem });
    const hash = await hashPassword(req.body.password);
    let user;
    try {
      const result = await db.query(
        "INSERT INTO users (id,username,password_hash,password_kind) VALUES ($1,$2,$3,'chosen') RETURNING id,username",
        [randomUUID(), username, hash],
      );
      user = { ...result.rows[0], mustSetPassword: false };
    } catch (error) {
      if (error.code === "23505")
        return res
          .status(409)
          .json({ error: "That username is already taken." });
      throw error;
    }
    await issueSession(req, res, user);
    res.status(201).json({ user });
  });
  app.post(
    "/api/auth/login",
    networkFailures,
    accountFailures,
    async (req, res) => {
      const username = loginName(req.body.username);
      const incorrect = () =>
        res.status(401).json({ error: "Username or password is incorrect." });
      if (!/^[a-z0-9_]{3,30}$/.test(username)) return incorrect();
      const result = await db.query(
        "SELECT id,username,password_hash,password_kind FROM users WHERE username=$1",
        [username],
      );
      const row = result.rows[0];
      // Unknown usernames still pay for a hash, so timing does not reveal them.
      const candidate = passwordCandidate(
        req.body.password,
        row?.password_kind,
      );
      const valid = await verifyPassword(
        candidate ?? "",
        row?.password_hash || dummyHash,
      );
      if (!row || !candidate || !valid) return incorrect();
      await accountFailures.resetKey(`user:${username}`);
      const user = {
        id: row.id,
        username: row.username,
        mustSetPassword: row.password_kind !== "chosen",
      };
      await issueSession(req, res, user);
      res.json({ user });
    },
  );
  // Sets a chosen password; signs out the account's other sessions.
  app.post(
    "/api/auth/password",
    requireUser,
    accountFailures,
    async (req, res) => {
      const { rows } = await db.query(
        "SELECT password_hash,password_kind FROM users WHERE id=$1",
        [req.user.id],
      );
      const candidate = passwordCandidate(
        req.body.currentPassword,
        rows[0].password_kind,
      );
      if (
        !candidate ||
        !(await verifyPassword(candidate, rows[0].password_hash))
      )
        return res
          .status(401)
          .json({ error: "Your current password is incorrect." });
      const problem = passwordProblem(req.body.newPassword, req.user.username);
      if (problem) return res.status(400).json({ error: problem });
      if (req.body.newPassword === req.body.currentPassword)
        return res.status(400).json({
          error: "Choose a password different from your current one.",
        });
      await db.query(
        "UPDATE users SET password_hash=$1,password_kind='chosen' WHERE id=$2",
        [await hashPassword(req.body.newPassword), req.user.id],
      );
      await db.query(
        "DELETE FROM sessions WHERE user_id=$1 AND token_hash<>$2 AND NOT is_admin",
        [req.user.id, tokenHash(getToken(req))],
      );
      res.json({ user: { ...req.user, mustSetPassword: false } });
    },
  );
  app.post("/api/auth/logout", async (req, res) => {
    const token = getToken(req);
    if (token)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(token),
      ]);
    res.clearCookie(cookieName, cookieOptions);
    res.json({ ok: true });
  });
  app.get("/api/auth/me", requireUser, (req, res) =>
    res.json({ user: req.user }),
  );
  app.get("/api/registrations/me", requireUser, async (req, res) => {
    const result = await db.query(
      "SELECT r.id,r.team_name,r.lead_email,r.domain,r.squad_size,r.problem_id,r.abstract,r.status,r.checked_in_at,r.created_at,p.status AS payment_status FROM registrations r LEFT JOIN payments p ON p.registration_id=r.id WHERE r.user_id=$1",
      [req.user.id],
    );
    const registration = result.rows[0];
    if (registration)
      registration.members = await membersOf(db, registration.id);
    res.json({ registration: registration || null });
  });
  // The lead can add or correct member details until the squad checks in.
  app.put("/api/registrations/me/members", requireUser, async (req, res) => {
    const registration = (
      await db.query(
        "SELECT id,squad_size,lead_email,checked_in_at FROM registrations WHERE user_id=$1",
        [req.user.id],
      )
    ).rows[0];
    if (!registration)
      return res.status(404).json({ error: "Register your squad first." });
    if (registration.checked_in_at)
      return res.status(409).json({
        error:
          "Your squad has already checked in. Ask the help desk to change member details.",
      });
    const { members, error } = validateMembers(
      req.body.members,
      registration.squad_size,
      registration.lead_email,
    );
    if (error) return res.status(400).json({ error });
    await saveMembers(db, registration.id, members);
    res.json({ members: await membersOf(db, registration.id) });
  });
  app.post("/api/registrations", requireUser, async (req, res) => {
    const {
      teamName,
      email,
      domain,
      squadSize,
      problemId,
      abstract = "",
      conductAccepted,
    } = req.body;
    const team =
      typeof teamName === "string" ? teamName.trim().replace(/\s+/g, " ") : "";
    const chosenProblem = problems.find((p) => p.id === problemId);
    const selectedDomain =
      domain === "" || domain == null ? chosenProblem?.domain || null : domain;
    const leadEmail = typeof email === "string" ? email.trim() : "";
    // Report the first problem specifically so the lead knows what to fix.
    const problem = (() => {
      if (team.length < 3 || team.length > 30)
        return "Team call-sign must be 3–30 characters (spaces at the ends don’t count).";
      if (
        leadEmail.length > 254 ||
        !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(leadEmail)
      )
        return "Enter a complete lead email address, such as lead@university.edu.";
      if (
        selectedDomain !== null &&
        !["HN-AI", "HN-CS", "HN-FT", "HN-X"].includes(selectedDomain)
      )
        return "Choose a target domain from the list.";
      // Squads are exactly 3 builders (organisers, 3 Oct 2026). The database
      // still allows 2-4, so squads registered before the change stay valid.
      if (Number(squadSize) !== SQUAD_SIZE)
        return `Squads must have exactly ${SQUAD_SIZE} builders.`;
      if (typeof abstract !== "string" || abstract.length > 3000)
        return "Your big idea must be at most 3,000 characters.";
      if (
        problemId &&
        (!chosenProblem || chosenProblem.domain !== selectedDomain)
      )
        return "The selected challenge doesn’t belong to the selected domain. Pick the challenge again.";
      if (conductAccepted !== true)
        return "Agree to the Code of Conduct to register.";
      return null;
    })();
    if (problem) return res.status(400).json({ error: problem });
    // Member details are optional here; leads can add them later.
    let members = [];
    if (req.body.members !== undefined) {
      const checked = validateMembers(
        req.body.members,
        Number(squadSize),
        leadEmail.toLowerCase(),
      );
      if (checked.error) return res.status(400).json({ error: checked.error });
      members = checked.members;
    }
    try {
      // Registration and members are inserted in one statement so a squad is
      // never saved without the members it was submitted with.
      const rows = memberValues(members, 9, "(SELECT id FROM r)");
      const result = await db.query(
        `WITH r AS (
           INSERT INTO registrations (id,user_id,team_name,lead_email,domain,squad_size,problem_id,abstract,conduct_accepted)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
           RETURNING id,team_name,lead_email,domain,squad_size,problem_id,abstract,status,checked_in_at,created_at
         )${members.length ? `, m AS (INSERT INTO registration_members (registration_id,position,full_name,email,phone,college) VALUES ${rows.sql})` : ""}
         SELECT * FROM r`,
        [
          randomUUID(),
          req.user.id,
          team,
          leadEmail.toLowerCase(),
          selectedDomain,
          Number(squadSize),
          problemId || null,
          abstract.trim(),
          true,
          ...rows.params,
        ],
      );
      const registration = result.rows[0];
      registration.members = await membersOf(db, registration.id);
      res.status(201).json({ registration });
      // Sent after responding so a slow or failing mail server never blocks
      // registration.
      mailer
        ?.sendRegistrationEmail({
          to: registration.lead_email,
          teamName: registration.team_name,
          registrationId: registration.id,
          squadSize: registration.squad_size,
          domain: registration.domain,
          challenge: chosenProblem
            ? `${chosenProblem.id}: ${chosenProblem.title}`
            : null,
          fee: paymentConfig.fee,
          members: registration.members,
          paymentUrl: `${siteUrl}/payment`,
        })
        .catch((error) =>
          console.error(
            `Registration email to ${registration.lead_email} failed:`,
            error.message,
          ),
        );
    } catch (error) {
      if (error.code === "23505")
        return res.status(409).json({
          error:
            error.constraint === "registrations_user_id_key"
              ? "Your account already has a registered squad. Sign in to view your registration."
              : "This team name is already registered. Use the existing squad account to view its registration.",
        });
      throw error;
    }
  });
  app.use("/api", createPaymentRouter(db, requireUser, { mailer, origin: siteUrl }));
  app.use("/api/admin", createAdminRouter(db, { production, origin: siteUrl, mailer, cookiePath: `${base}/api/admin` }));
  app.use("/api", (req, res) =>
    res.status(404).json({ error: "Endpoint not found." }),
  );
  if (serveClient) {
    // Next to this folder, whatever the working directory (it differs when
    // embedded in the Techastra server).
    const dist = fileURLToPath(new URL("../dist", import.meta.url));
    app.use(
      "/assets",
      express.static(path.join(dist, "assets"), {
        immutable: true,
        maxAge: "1y",
      }),
    );
    app.use(
      express.static(dist, {
        maxAge: 0,
        setHeaders(res) {
          res.set("Cache-Control", "no-cache");
        },
      }),
    );
    app.get("/{*path}", (req, res) =>
      res.sendFile(path.join(dist, "index.html"), {
        headers: { "Cache-Control": "no-cache" },
      }),
    );
  }
  app.use((error, req, res, next) => {
    if (error.type === "entity.parse.failed")
      return res.status(400).json({ error: "Invalid request body." });
    if (error.type === "entity.too.large")
      return res.status(413).json({ error: "Request is too large." });
    console.error("Request failed:", error.code || error.name);
    res.status(503).json({
      error:
        "The registration service is temporarily unavailable. Please try again shortly.",
    });
  });
  if (!base) return app;
  // Under a prefix: the app sees paths without it (/api/..., /payment).
  const outer = express();
  outer.disable("x-powered-by");
  if (trustProxy) outer.set("trust proxy", 1);
  outer.use(base, app);
  return outer;
}
