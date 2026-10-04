import { Router } from "express";
import { rateLimit } from "express-rate-limit";
import { randomBytes, randomInt, randomUUID } from "node:crypto";
import { hashPassword, verifyPassword, tokenHash } from "./auth.js";
import { newPassCode, parsePassCode, paymentReference } from "./payments.js";
import { membersOf } from "./members.js";
import { MEALS, mealById } from "./meals.js";

export const ADMIN_COOKIE = "hn_admin";
export const STATUSES = ["pending", "approved", "waitlisted", "rejected"];
const DOMAINS = ["HN-AI", "HN-CS", "HN-FT", "HN-X"];
const duration = 8 * 60 * 60 * 1000;
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const dummyHash = await hashPassword(randomBytes(20).toString("hex"));
// Easy to read aloud: no 0/o, 1/l/i. About 59 bits.
const tempAlphabet = "abcdefghjkmnpqrstuvwxyz23456789";
const temporaryPassword = () =>
  Array.from({ length: 12 }, () => tempAlphabet[randomInt(tempAlphabet.length)])
    .join("")
    .match(/.{4}/g)
    .join("-");
export const ROLES = ["admin", "scanner"];
const PAYMENT_STATUSES = ["submitted", "verified", "rejected"];
const registrationColumns =
  "r.id,r.team_name,r.lead_email,r.domain,r.squad_size,r.problem_id,r.abstract,r.status,r.checked_in_at,r.checked_in_by,r.admin_notes,r.created_at,r.updated_at,u.username,p.status AS payment_status,p.transaction_id,(r.pass_code IS NOT NULL) AS has_pass";
const registrationFrom =
  "registrations r JOIN users u ON u.id=r.user_id LEFT JOIN payments p ON p.registration_id=r.id";
// Scanners (check-in volunteers) may only use these routes.
const scannerRoutes = new Set([
  "/me",
  "/attendance",
  "/attendance/scan",
  "/meals",
  "/meals/scan",
]);
const sorts = {
  newest: "r.created_at DESC",
  oldest: "r.created_at ASC",
  team: "LOWER(r.team_name) ASC",
  status: "r.status ASC, r.created_at DESC",
};

// Escape LIKE wildcards so search text is matched literally.
const likePattern = (q) => `%${q.replace(/[\\%_]/g, (c) => `\\${c}`)}%`;
// Prefix spreadsheet formula characters so exported cells are inert.
function csvCell(value) {
  let text = value == null ? "" : String(value);
  if (/^[=+\-@\t\r]/.test(text)) text = `'${text}`;
  return `"${text.replace(/"/g, '""')}"`;
}

export function createAdminRouter(
  db,
  {
    production = false,
    origin = "http://localhost:5173",
    mailer = null,
    // "/api/admin", or with the site's path prefix ("/hacknexus/api/admin").
    cookiePath = "/api/admin",
  } = {},
) {
  const router = Router();
  const cookieOptions = {
    httpOnly: true,
    sameSite: "strict",
    secure: production,
    path: cookiePath,
  };
  const loginLimiter = rateLimit({
    windowMs: 15 * 60_000,
    limit: 10,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    message: { error: "Too many sign-in attempts. Try again in 15 minutes." },
  });
  const getToken = (req) => {
    const value = req.headers.cookie
      ?.split(";")
      .map((v) => v.trim())
      .find((v) => v.startsWith(`${ADMIN_COOKIE}=`))
      ?.slice(ADMIN_COOKIE.length + 1);
    return value && /^[a-f0-9]{64}$/.test(value) ? value : null;
  };
  async function audit(req, action, targetType, targetId, details = {}) {
    await db.query(
      "INSERT INTO admin_audit_log (id,admin_user_id,admin_username,action,target_type,target_id,details) VALUES ($1,$2,$3,$4,$5,$6,$7)",
      [
        randomUUID(),
        req.admin.id,
        req.admin.username,
        action,
        targetType,
        String(targetId),
        JSON.stringify(details),
      ],
    );
  }
  // Runs `issue` with a fresh check-in code, retrying on the rare clash with
  // an existing one.
  async function withPassCode(issue) {
    for (let attempt = 1; ; attempt++) {
      try {
        return await issue(newPassCode());
      } catch (error) {
        if (error.code !== "23505" || attempt === 5) throw error;
      }
    }
  }
  // Verifies a payment, approves its squad, and issues the ID card in one
  // statement. Returns null when the payment is missing or already verified.
  async function verifyPayment(req, paymentId) {
    const result = await withPassCode((code) =>
      db.query(
        `WITH p AS (
         UPDATE payments SET status='verified',rejection_reason='',reviewed_at=NOW(),reviewed_by=$2
         WHERE id=$1 AND status<>'verified' RETURNING registration_id,transaction_id,amount
       )
       UPDATE registrations r SET status='approved',pass_code=COALESCE(r.pass_code,$3),updated_at=NOW()
       FROM p WHERE r.id=p.registration_id RETURNING r.id,r.team_name,r.lead_email,r.squad_size,p.transaction_id,p.amount`,
        [paymentId, req.admin.username, code],
      ),
    );
    const row = result.rows[0];
    if (row)
      await audit(req, "verify_payment", "payment", paymentId, {
        team: row.team_name,
        transaction: row.transaction_id,
        amount: row.amount,
      });
    if (row) emailApproval(req, row);
    return row || null;
  }
  // Emails the squad lead in the background so a slow or failing mail server
  // never blocks a review. The outcome is recorded in the audit log.
  function emailLead(req, kind, row, send) {
    if (!mailer) return;
    const details = { team: row.team_name, to: row.lead_email };
    send()
      .then(
        () => audit(req, `${kind}_email_sent`, "registration", row.id, details),
        (error) => {
          console.error(
            `${kind} email to ${row.lead_email} failed:`,
            error.message,
          );
          return audit(req, `${kind}_email_failed`, "registration", row.id, {
            ...details,
            error: error.message.slice(0, 200),
          });
        },
      )
      .catch((error) =>
        console.error("Audit log write failed:", error.message),
      );
  }
  const emailApproval = (req, row) =>
    emailLead(req, "approval", row, async () =>
      mailer.sendApprovalEmail({
        to: row.lead_email,
        teamName: row.team_name,
        registrationId: row.id,
        squadSize: row.squad_size,
        transactionId: row.transaction_id,
        amount: row.amount,
        members: await membersOf(db, row.id),
        passUrl: `${origin}/pass`,
      }),
    );
  const emailRejection = (req, row, reason) =>
    emailLead(req, "rejection", row, () =>
      mailer.sendRejectionEmail({
        to: row.lead_email,
        teamName: row.team_name,
        registrationId: row.id,
        transactionId: row.transaction_id,
        amount: row.amount,
        reason,
        paymentUrl: `${origin}/payment`,
      }),
    );
  async function requireAdmin(req, res, next) {
    const token = getToken(req);
    if (!token)
      return res.status(401).json({ error: "Admin sign-in required." });
    const result = await db.query(
      "SELECT u.id,u.username,a.role FROM sessions s JOIN users u ON u.id=s.user_id JOIN admins a ON a.user_id=u.id WHERE s.token_hash=$1 AND s.is_admin AND s.expires_at>NOW()",
      [tokenHash(token)],
    );
    if (!result.rows[0])
      return res
        .status(401)
        .json({ error: "Your admin session has expired. Sign in again." });
    req.admin = result.rows[0];
    next();
  }
  const validId = (req, res) => {
    if (uuidPattern.test(req.params.id)) return true;
    res.status(404).json({ error: "Record not found." });
    return false;
  };

  router.post("/login", loginLimiter, async (req, res) => {
    const username =
      typeof req.body.username === "string"
        ? req.body.username.trim().toLowerCase()
        : "";
    const password =
      typeof req.body.password === "string" ? req.body.password : "";
    const result =
      /^[a-z0-9_]{3,30}$/.test(username) && password.length <= 200
        ? await db.query(
            "SELECT u.id,u.username,a.role,a.password_hash FROM users u JOIN admins a ON a.user_id=u.id WHERE u.username=$1",
            [username],
          )
        : { rows: [] };
    const row = result.rows[0];
    const valid = await verifyPassword(
      password,
      row?.password_hash || dummyHash,
    );
    if (!row || !valid)
      return res
        .status(401)
        .json({ error: "Admin username or password is incorrect." });
    const old = getToken(req);
    if (old)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(old),
      ]);
    await db.query("DELETE FROM sessions WHERE expires_at <= NOW()");
    const token = randomBytes(32).toString("hex");
    await db.query(
      "INSERT INTO sessions (token_hash,user_id,expires_at,is_admin) VALUES ($1,$2,$3,TRUE)",
      [tokenHash(token), row.id, new Date(Date.now() + duration)],
    );
    res.cookie(ADMIN_COOKIE, token, { ...cookieOptions, maxAge: duration });
    res.json({ admin: { id: row.id, username: row.username, role: row.role } });
  });
  router.post("/logout", async (req, res) => {
    const token = getToken(req);
    if (token)
      await db.query("DELETE FROM sessions WHERE token_hash=$1", [
        tokenHash(token),
      ]);
    res.clearCookie(ADMIN_COOKIE, cookieOptions);
    res.json({ ok: true });
  });

  router.use(requireAdmin);
  router.use((req, res, next) =>
    req.admin.role === "admin" || scannerRoutes.has(req.path)
      ? next()
      : res
          .status(403)
          .json({ error: "Check-in volunteers can only use the check-in and food scanners." }),
  );
  router.get("/me", (req, res) => res.json({ admin: req.admin }));

  router.get("/stats", async (req, res) => {
    const [totals, byDomain, byStatus, byProblem, daily, payments] =
      await Promise.all([
        db.query(
          "SELECT (SELECT COUNT(*)::int FROM users WHERE id NOT IN (SELECT user_id FROM admins)) AS users, COUNT(r.id)::int AS registrations, COALESCE(SUM(r.squad_size),0)::int AS participants, COUNT(r.checked_in_at)::int AS checked_in FROM registrations r",
        ),
        db.query(
          "SELECT domain, COUNT(*)::int AS count FROM registrations GROUP BY domain",
        ),
        db.query(
          "SELECT status, COUNT(*)::int AS count FROM registrations GROUP BY status",
        ),
        db.query(
          "SELECT problem_id, COUNT(*)::int AS count FROM registrations WHERE problem_id IS NOT NULL GROUP BY problem_id ORDER BY count DESC, problem_id",
        ),
        db.query(
          "SELECT to_char(created_at AT TIME ZONE 'Asia/Kolkata','YYYY-MM-DD') AS day, COUNT(*)::int AS count FROM registrations WHERE created_at > NOW() - INTERVAL '14 days' GROUP BY day ORDER BY day",
        ),
        db.query(
          "SELECT COUNT(*) FILTER (WHERE p.status='submitted')::int AS submitted, COUNT(*) FILTER (WHERE p.status='verified')::int AS verified, COUNT(*) FILTER (WHERE p.status='rejected')::int AS rejected, (SELECT COUNT(*)::int FROM registrations r WHERE NOT EXISTS (SELECT 1 FROM payments x WHERE x.registration_id=r.id)) AS unpaid, COALESCE(SUM(p.amount) FILTER (WHERE p.status='verified'),0)::int AS collected FROM payments p",
        ),
      ]);
    res.json({
      totals: totals.rows[0],
      byDomain: byDomain.rows,
      byStatus: byStatus.rows,
      byProblem: byProblem.rows,
      daily: daily.rows,
      payments: payments.rows[0],
    });
  });

  function registrationFilters(query) {
    const where = [];
    const params = [];
    const q = typeof query.q === "string" ? query.q.trim().slice(0, 100) : "";
    if (q) {
      params.push(likePattern(q));
      where.push(
        `(r.team_name ILIKE $${params.length} OR r.lead_email ILIKE $${params.length} OR u.username ILIKE $${params.length} OR r.id::text ILIKE $${params.length})`,
      );
    }
    if (query.domain === "none") where.push("r.domain IS NULL");
    else if (DOMAINS.includes(query.domain)) {
      params.push(query.domain);
      where.push(`r.domain=$${params.length}`);
    }
    if (STATUSES.includes(query.status)) {
      params.push(query.status);
      where.push(`r.status=$${params.length}`);
    }
    if (query.payment === "none") where.push("p.id IS NULL");
    else if (PAYMENT_STATUSES.includes(query.payment)) {
      params.push(query.payment);
      where.push(`p.status=$${params.length}`);
    }
    if (query.checkedIn === "yes") where.push("r.checked_in_at IS NOT NULL");
    if (query.checkedIn === "no") where.push("r.checked_in_at IS NULL");
    return {
      clause: where.length ? `WHERE ${where.join(" AND ")}` : "",
      params,
      order: sorts[query.sort] || sorts.newest,
    };
  }

  router.get("/registrations", async (req, res) => {
    const { clause, params, order } = registrationFilters(req.query);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT ${registrationColumns} FROM ${registrationFrom} ${clause} ORDER BY ${order}, r.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM ${registrationFrom} ${clause}`,
        params,
      ),
    ]);
    res.json({
      registrations: rows.rows,
      total: count.rows[0].total,
      page,
      limit,
    });
  });

  router.get("/registrations.csv", async (req, res) => {
    const { clause, params, order } = registrationFilters(req.query);
    // Members are flattened into one cell: "Name | email | phone | college; ...".
    const result = await db.query(
      `SELECT ${registrationColumns},
         (SELECT string_agg(m.full_name||' | '||m.email||' | '||m.phone||' | '||m.college, '; ' ORDER BY m.position)
            FROM registration_members m WHERE m.registration_id=r.id) AS members
       FROM ${registrationFrom} ${clause} ORDER BY ${order}, r.id`,
      params,
    );
    const headers = [
      "id",
      "team_name",
      "username",
      "lead_email",
      "domain",
      "problem_id",
      "squad_size",
      "members",
      "status",
      "payment_status",
      "transaction_id",
      "checked_in_at",
      "checked_in_by",
      "created_at",
      "abstract",
      "admin_notes",
    ];
    const toText = (v) => (v instanceof Date ? v.toISOString() : v);
    const csv = [
      headers.join(","),
      ...result.rows.map((row) =>
        headers.map((h) => csvCell(toText(row[h]))).join(","),
      ),
    ].join("\r\n");
    await audit(req, "export_csv", "registrations", "*", {
      rows: result.rows.length,
    });
    res
      .type("text/csv")
      .attachment(
        `hacknexus-registrations-${new Date().toISOString().slice(0, 10)}.csv`,
      )
      .send(`﻿${csv}\r\n`);
  });

  router.get("/registrations/:id", async (req, res) => {
    if (!validId(req, res)) return;
    const result = await db.query(
      `SELECT ${registrationColumns} FROM ${registrationFrom} WHERE r.id=$1`,
      [req.params.id],
    );
    if (!result.rows[0])
      return res.status(404).json({ error: "Registration not found." });
    const registration = result.rows[0];
    registration.members = await membersOf(db, registration.id);
    res.json({ registration });
  });

  router.patch("/registrations/:id", async (req, res) => {
    if (!validId(req, res)) return;
    const { status, notes, checkedIn } = req.body;
    const sets = [];
    const params = [req.params.id];
    const changes = {};
    if (status !== undefined) {
      if (!STATUSES.includes(status))
        return res.status(400).json({ error: "Unknown status." });
      params.push(status);
      sets.push(`status=$${params.length}`);
      changes.status = status;
    }
    if (notes !== undefined) {
      if (typeof notes !== "string" || notes.length > 2000)
        return res
          .status(400)
          .json({ error: "Notes must be at most 2,000 characters." });
      params.push(notes.trim());
      sets.push(`admin_notes=$${params.length}`);
      changes.notes = true;
    }
    if (checkedIn !== undefined) {
      if (typeof checkedIn !== "boolean")
        return res.status(400).json({ error: "Invalid check-in value." });
      if (checkedIn) {
        params.push(req.admin.username);
        sets.push(
          `checked_in_by=CASE WHEN checked_in_at IS NULL THEN $${params.length} ELSE checked_in_by END`,
          "checked_in_at=COALESCE(checked_in_at,NOW())",
        );
      } else sets.push("checked_in_at=NULL", "checked_in_by=NULL");
      changes.checkedIn = checkedIn;
    }
    if (!sets.length)
      return res.status(400).json({ error: "No changes supplied." });
    if (status === "approved") {
      // Approval and payment verification are one decision: approving a
      // squad verifies its payment and issues the ID card.
      const payment = (
        await db.query(
          "SELECT id,status FROM payments WHERE registration_id=$1",
          [req.params.id],
        )
      ).rows[0];
      if (!payment) {
        const exists = await db.query(
          "SELECT 1 FROM registrations WHERE id=$1",
          [req.params.id],
        );
        return exists.rows[0]
          ? res.status(409).json({
              error:
                "This squad hasn’t submitted a payment yet. It can be approved once its payment is verified.",
            })
          : res.status(404).json({ error: "Registration not found." });
      }
      if (payment.status !== "verified") await verifyPayment(req, payment.id);
    }
    await db.query(
      `UPDATE registrations SET ${sets.join(",")},updated_at=NOW() WHERE id=$1`,
      params,
    );
    const updated = await db.query(
      `SELECT ${registrationColumns} FROM ${registrationFrom} WHERE r.id=$1`,
      [req.params.id],
    );
    if (!updated.rows[0])
      return res.status(404).json({ error: "Registration not found." });
    await audit(req, "update_registration", "registration", req.params.id, {
      team: updated.rows[0].team_name,
      ...changes,
    });
    const registration = updated.rows[0];
    registration.members = await membersOf(db, registration.id);
    res.json({ registration });
  });

  router.delete("/registrations/:id", async (req, res) => {
    if (!validId(req, res)) return;
    const deleted = await db.query(
      "DELETE FROM registrations WHERE id=$1 RETURNING team_name",
      [req.params.id],
    );
    if (!deleted.rows[0])
      return res.status(404).json({ error: "Registration not found." });
    await audit(req, "delete_registration", "registration", req.params.id, {
      team: deleted.rows[0].team_name,
    });
    res.json({ ok: true });
  });

  router.get("/users", async (req, res) => {
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const params = q ? [likePattern(q)] : [];
    const clause = q ? "WHERE u.username ILIKE $1" : "";
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT u.id,u.username,u.created_at,(a.user_id IS NOT NULL) AS is_admin,r.id AS registration_id,r.team_name,(SELECT COUNT(*)::int FROM sessions s WHERE s.user_id=u.id AND s.expires_at>NOW()) AS active_sessions FROM users u LEFT JOIN admins a ON a.user_id=u.id LEFT JOIN registrations r ON r.user_id=u.id ${clause} ORDER BY u.created_at DESC, u.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      ),
      db.query(`SELECT COUNT(*)::int AS total FROM users u ${clause}`, params),
    ]);
    res.json({ users: rows.rows, total: count.rows[0].total, page, limit });
  });

  router.delete("/users/:id", async (req, res) => {
    if (!validId(req, res)) return;
    const admin = await db.query("SELECT 1 FROM admins WHERE user_id=$1", [
      req.params.id,
    ]);
    if (admin.rows[0])
      return res.status(400).json({
        error: "Admin accounts cannot be deleted from the panel.",
      });
    const deleted = await db.query(
      "DELETE FROM users WHERE id=$1 RETURNING username",
      [req.params.id],
    );
    if (!deleted.rows[0])
      return res.status(404).json({ error: "Account not found." });
    await audit(req, "delete_user", "user", req.params.id, {
      username: deleted.rows[0].username,
    });
    res.json({ ok: true });
  });

  // Issues a one-time password for a participant who forgot theirs. It is
  // shown to the organizer once; the participant must replace it on sign-in.
  router.post("/users/:id/reset-password", async (req, res) => {
    if (!validId(req, res)) return;
    const admin = await db.query("SELECT 1 FROM admins WHERE user_id=$1", [
      req.params.id,
    ]);
    if (admin.rows[0])
      return res.status(400).json({
        error: "Admin passwords are changed with npm run admin:create.",
      });
    const password = temporaryPassword();
    const updated = await db.query(
      "UPDATE users SET password_hash=$1,password_kind='temporary' WHERE id=$2 RETURNING username",
      [await hashPassword(password), req.params.id],
    );
    if (!updated.rows[0])
      return res.status(404).json({ error: "Account not found." });
    await db.query("DELETE FROM sessions WHERE user_id=$1 AND NOT is_admin", [
      req.params.id,
    ]);
    await audit(req, "reset_password", "user", req.params.id, {
      username: updated.rows[0].username,
    });
    res.json({ password });
  });

  router.post("/users/:id/revoke-sessions", async (req, res) => {
    if (!validId(req, res)) return;
    const result = await db.query(
      "DELETE FROM sessions WHERE user_id=$1 AND NOT is_admin",
      [req.params.id],
    );
    await audit(req, "revoke_sessions", "user", req.params.id, {
      sessions: result.rowCount ?? result.affectedRows ?? 0,
    });
    res.json({ ok: true });
  });

  // --- Payments ---------------------------------------------------------
  const paymentColumns =
    "p.id,p.registration_id,p.amount,p.transaction_id,p.screenshot_type,p.status,p.rejection_reason,p.submitted_at,p.reviewed_at,p.reviewed_by,r.team_name,r.lead_email,r.squad_size,r.status AS registration_status,u.username";
  const paymentFrom =
    "payments p JOIN registrations r ON r.id=p.registration_id JOIN users u ON u.id=r.user_id";
  const withReference = (row) => ({
    ...row,
    reference: paymentReference(row.registration_id),
  });

  router.get("/payments", async (req, res) => {
    const where = [];
    const params = [];
    if (PAYMENT_STATUSES.includes(req.query.status)) {
      params.push(req.query.status);
      where.push(`p.status=$${params.length}`);
    }
    const q =
      typeof req.query.q === "string" ? req.query.q.trim().slice(0, 100) : "";
    if (q) {
      params.push(likePattern(q));
      where.push(
        `(r.team_name ILIKE $${params.length} OR p.transaction_id ILIKE $${params.length} OR u.username ILIKE $${params.length} OR r.lead_email ILIKE $${params.length} OR r.id::text ILIKE $${params.length})`,
      );
    }
    const clause = where.length ? `WHERE ${where.join(" AND ")}` : "";
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const page = Math.max(1, Math.floor(Number(req.query.page)) || 1);
    const [rows, count] = await Promise.all([
      db.query(
        `SELECT ${paymentColumns} FROM ${paymentFrom} ${clause} ORDER BY (p.status='submitted') DESC, p.submitted_at DESC, p.id LIMIT ${limit} OFFSET ${(page - 1) * limit}`,
        params,
      ),
      db.query(
        `SELECT COUNT(*)::int AS total FROM ${paymentFrom} ${clause}`,
        params,
      ),
    ]);
    res.json({
      payments: rows.rows.map(withReference),
      total: count.rows[0].total,
      page,
      limit,
    });
  });

  router.get("/payments/:id/screenshot", async (req, res) => {
    if (!validId(req, res)) return;
    const result = await db.query(
      "SELECT screenshot,screenshot_type FROM payments WHERE id=$1",
      [req.params.id],
    );
    const row = result.rows[0];
    if (!row) return res.status(404).json({ error: "Payment not found." });
    // Served as an inert image: no scripts, no sniffing, never cached.
    res.set({
      "Content-Type": row.screenshot_type,
      "Content-Security-Policy": "default-src 'none'; sandbox",
      "Content-Disposition": "inline",
    });
    res.send(Buffer.from(row.screenshot));
  });

  router.post("/payments/:id/verify", async (req, res) => {
    if (!validId(req, res)) return;
    const row = await verifyPayment(req, req.params.id);
    if (!row) {
      const exists = await db.query("SELECT status FROM payments WHERE id=$1", [
        req.params.id,
      ]);
      return exists.rows[0]
        ? res.status(409).json({ error: "This payment is already verified." })
        : res.status(404).json({ error: "Payment not found." });
    }
    res.json({ ok: true });
  });

  router.post("/payments/:id/reject", async (req, res) => {
    if (!validId(req, res)) return;
    const reason =
      typeof req.body.reason === "string" ? req.body.reason.trim() : "";
    if (reason.length < 3 || reason.length > 500)
      return res.status(400).json({
        error: "Give the squad a short reason (3–500 characters).",
      });
    // Rejecting revokes any pass that verification issued.
    const result = await db.query(
      `WITH p AS (
         UPDATE payments SET status='rejected',rejection_reason=$2,reviewed_at=NOW(),reviewed_by=$3
         WHERE id=$1 AND status<>'rejected' RETURNING registration_id,transaction_id,amount
       )
       UPDATE registrations r SET pass_code=NULL,status=CASE WHEN r.status='approved' THEN 'pending' ELSE r.status END,updated_at=NOW()
       FROM p WHERE r.id=p.registration_id RETURNING r.id,r.team_name,r.lead_email,p.transaction_id,p.amount`,
      [req.params.id, reason, req.admin.username],
    );
    const row = result.rows[0];
    if (!row) {
      const exists = await db.query("SELECT status FROM payments WHERE id=$1", [
        req.params.id,
      ]);
      return exists.rows[0]
        ? res.status(409).json({ error: "This payment is already rejected." })
        : res.status(404).json({ error: "Payment not found." });
    }
    await audit(req, "reject_payment", "payment", req.params.id, {
      team: row.team_name,
      transaction: row.transaction_id,
      reason,
    });
    emailRejection(req, row, reason);
    res.json({ ok: true });
  });

  // --- Attendance (admins and scanners) ---------------------------------
  // The squad on a scanned ID card (a QR or the code typed from the card),
  // if it may be admitted: { squad } or { status, error }.
  async function admittedSquad(rawCode) {
    const code = parsePassCode(rawCode);
    if (!code)
      return { status: 400, error: "This is not a HACK_NEXUS ID card QR code." };
    const found = await db.query(
      `SELECT r.id,r.team_name,r.squad_size,r.domain,r.problem_id,r.status,r.checked_in_at,r.checked_in_by,u.username,p.status AS payment_status
       FROM registrations r JOIN users u ON u.id=r.user_id LEFT JOIN payments p ON p.registration_id=r.id
       WHERE r.pass_code=$1`,
      [code],
    );
    const squad = found.rows[0];
    if (!squad)
      return {
        status: 404,
        error: "Invalid or revoked ID card. Send the squad to the help desk.",
      };
    if (squad.payment_status !== "verified")
      return { status: 409, error: "Payment for this squad is not verified." };
    if (squad.status !== "approved")
      return {
        status: 409,
        error: `This squad is ${squad.status}, not approved. Send them to the help desk.`,
      };
    return { squad };
  }

  router.post("/attendance/scan", async (req, res) => {
    const { squad, status, error } = await admittedSquad(req.body.code);
    if (!squad) return res.status(status).json({ error });
    if (squad.checked_in_at) return res.json({ result: "already", squad });
    const updated = await db.query(
      "UPDATE registrations SET checked_in_at=NOW(),checked_in_by=$2,updated_at=NOW() WHERE id=$1 AND checked_in_at IS NULL RETURNING checked_in_at,checked_in_by",
      [squad.id, req.admin.username],
    );
    if (!updated.rows[0]) {
      // Another scanner checked this squad in at the same moment.
      const current = await db.query(
        "SELECT checked_in_at,checked_in_by FROM registrations WHERE id=$1",
        [squad.id],
      );
      return res.json({
        result: "already",
        squad: { ...squad, ...current.rows[0] },
      });
    }
    await audit(req, "check_in", "registration", squad.id, {
      team: squad.team_name,
    });
    res.json({ result: "checked_in", squad: { ...squad, ...updated.rows[0] } });
  });

  router.get("/attendance", async (req, res) => {
    const [recent, totals] = await Promise.all([
      db.query(
        "SELECT id,team_name,squad_size,checked_in_at,checked_in_by FROM registrations WHERE checked_in_at IS NOT NULL ORDER BY checked_in_at DESC LIMIT 20",
      ),
      db.query(
        "SELECT COUNT(r.checked_in_at)::int AS checked_in, COALESCE(SUM(r.squad_size) FILTER (WHERE r.checked_in_at IS NOT NULL),0)::int AS people, COUNT(*)::int AS expected FROM registrations r JOIN payments p ON p.registration_id=r.id AND p.status='verified'",
      ),
    ]);
    res.json({ recent: recent.rows, totals: totals.rows[0] });
  });

  // --- Food counter (admins and scanners) ---------------------------------
  // Each squad collects each meal once, for all its members.
  router.post("/meals/scan", async (req, res) => {
    const meal = mealById(req.body.meal);
    if (!meal) return res.status(400).json({ error: "Choose the meal first." });
    const { squad, status, error } = await admittedSquad(req.body.code);
    if (!squad) return res.status(status).json({ error });
    const given = await db.query(
      `INSERT INTO meal_handouts (registration_id,meal,people,given_by) VALUES ($1,$2,$3,$4)
       ON CONFLICT (registration_id,meal) DO NOTHING RETURNING given_at,given_by,people`,
      [squad.id, meal.id, squad.squad_size, req.admin.username],
    );
    if (!given.rows[0]) {
      // Already collected (or another counter scanned it at the same moment).
      const first = await db.query(
        "SELECT given_at,given_by,people FROM meal_handouts WHERE registration_id=$1 AND meal=$2",
        [squad.id, meal.id],
      );
      return res.json({ result: "already", meal, squad, handout: first.rows[0] });
    }
    await audit(req, "meal_given", "registration", squad.id, {
      team: squad.team_name,
      meal: meal.label,
    });
    res.json({ result: "given", meal, squad, handout: given.rows[0] });
  });

  router.get("/meals", async (req, res) => {
    const [counts, expected, recent] = await Promise.all([
      db.query(
        "SELECT meal, COUNT(*)::int AS squads, COALESCE(SUM(people),0)::int AS people FROM meal_handouts GROUP BY meal",
      ),
      db.query(
        "SELECT COUNT(*)::int AS squads, COALESCE(SUM(r.squad_size),0)::int AS people FROM registrations r JOIN payments p ON p.registration_id=r.id AND p.status='verified' WHERE r.status='approved'",
      ),
      db.query(
        `SELECT m.meal,m.people,m.given_at,m.given_by,r.team_name FROM meal_handouts m JOIN registrations r ON r.id=m.registration_id
         ORDER BY m.given_at DESC LIMIT 20`,
      ),
    ]);
    const byMeal = new Map(counts.rows.map((c) => [c.meal, c]));
    res.json({
      meals: MEALS.map((m) => ({
        ...m,
        squads: byMeal.get(m.id)?.squads || 0,
        people: byMeal.get(m.id)?.people || 0,
      })),
      expected: expected.rows[0],
      recent: recent.rows.map((r) => ({ ...r, label: mealById(r.meal)?.label || r.meal })),
    });
  });

  // --- Admin accounts -----------------------------------------------------
  router.get("/admins", async (req, res) => {
    const result = await db.query(
      "SELECT u.id,u.username,a.role,a.created_at,a.created_by FROM admins a JOIN users u ON u.id=a.user_id ORDER BY a.created_at, u.username",
    );
    res.json({ admins: result.rows });
  });

  router.post("/admins", async (req, res) => {
    const username =
      typeof req.body.username === "string"
        ? req.body.username.trim().toLowerCase()
        : "";
    const { password, role } = req.body;
    if (!/^[a-z0-9_]{3,30}$/.test(username))
      return res.status(400).json({
        error: "Use a 3–30 character username (letters, numbers, underscores).",
      });
    if (
      typeof password !== "string" ||
      password.length < 12 ||
      password.length > 200
    )
      return res
        .status(400)
        .json({ error: "The password must be 12–200 characters." });
    if (!ROLES.includes(role))
      return res.status(400).json({ error: "Choose a role." });
    const existingAdmin = await db.query(
      "SELECT 1 FROM admins a JOIN users u ON u.id=a.user_id WHERE u.username=$1",
      [username],
    );
    if (existingAdmin.rows[0])
      return res
        .status(409)
        .json({ error: `@${username} is already an admin.` });
    let user = (
      await db.query("SELECT id FROM users WHERE username=$1", [username])
    ).rows[0];
    if (!user) {
      // Organizer-only account: the participant credential is random and unusable.
      user = (
        await db.query(
          "INSERT INTO users (id,username,password_hash) VALUES ($1,$2,$3) RETURNING id",
          [
            randomUUID(),
            username,
            await hashPassword(randomBytes(32).toString("hex")),
          ],
        )
      ).rows[0];
    }
    await db.query(
      "INSERT INTO admins (user_id,password_hash,role,created_by) VALUES ($1,$2,$3,$4)",
      [user.id, await hashPassword(password), role, req.admin.username],
    );
    await audit(req, "add_admin", "user", user.id, { username, role });
    res.status(201).json({ admin: { id: user.id, username, role } });
  });

  router.delete("/admins/:id", async (req, res) => {
    if (!validId(req, res)) return;
    if (req.params.id === req.admin.id)
      return res
        .status(400)
        .json({ error: "You cannot remove your own admin access." });
    const target = (
      await db.query(
        "SELECT a.role,u.username FROM admins a JOIN users u ON u.id=a.user_id WHERE a.user_id=$1",
        [req.params.id],
      )
    ).rows[0];
    if (!target) return res.status(404).json({ error: "Admin not found." });
    await db.query("DELETE FROM admins WHERE user_id=$1", [req.params.id]);
    await db.query("DELETE FROM sessions WHERE user_id=$1 AND is_admin", [
      req.params.id,
    ]);
    await audit(req, "remove_admin", "user", req.params.id, {
      username: target.username,
      role: target.role,
    });
    res.json({ ok: true });
  });

  router.get("/audit", async (req, res) => {
    const result = await db.query(
      "SELECT id,admin_username,action,target_type,target_id,details,created_at FROM admin_audit_log ORDER BY created_at DESC LIMIT 100",
    );
    res.json({ entries: result.rows });
  });

  return router;
}
