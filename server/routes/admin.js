const express = require("express");
const bcrypt = require("bcrypt");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { exportLimiter } = require("../middleware/rateLimiter");
const { toCsv } = require("../utils/csv");
const { logSecurityEvent } = require("../middleware/securityLogger");
const { applySeatChange } = require("../utils/seats");
const { sendApprovalEmail, sendRejectionEmail } = require("../utils/registrationEmails");

const router = express.Router();

// Staff roles an admin can create or assign (participants sign up via registration).
const STAFF_ROLES = ["registration_team", "coordinator", "hospitality", "certificate_team", "master_admin"];

// Every route below is master_admin only.
router.use(requireAuth, requireRole("master_admin"));

/** GET /api/admin/analytics - aggregate stats for the dashboard charts. */
router.get("/analytics", async (req, res) => {
  try {
    const [totalRegistrations, approved, pending, rejected, events, registrations] = await Promise.all([
      prisma.registration.count(),
      prisma.registration.count({ where: { status: "approved" } }),
      prisma.registration.count({ where: { status: "pending" } }),
      prisma.registration.count({ where: { status: "rejected" } }),
      prisma.event.findMany(),
      prisma.registration.findMany(),
    ]);

    const revenue = registrations
      .filter((r) => r.status === "approved")
      .reduce((sum, r) => sum + r.totalAmount, 0);

    const perEventHeadcount = events.map((e) => ({
      eventId: e.id,
      eventName: e.name,
      seatsTaken: e.seatsTaken,
      maxSeats: e.maxSeats,
    }));

    const collegeCounts = {};
    for (const r of registrations) {
      if (!r.collegeName) continue;
      collegeCounts[r.collegeName] = (collegeCounts[r.collegeName] || 0) + 1;
    }
    const perCollegeStats = Object.entries(collegeCounts).map(([college, count]) => ({ college, count }));

    // Registrations over time, bucketed by day
    const byDay = {};
    for (const r of registrations) {
      const day = r.createdAt.toISOString().slice(0, 10);
      byDay[day] = (byDay[day] || 0) + 1;
    }
    const registrationsOverTime = Object.entries(byDay)
      .sort((a, b) => (a[0] > b[0] ? 1 : -1))
      .map(([date, count]) => ({ date, count }));

    res.json({
      totalRegistrations,
      approved,
      pending,
      rejected,
      revenue,
      perEventHeadcount,
      perCollegeStats,
      registrationsOverTime,
    });
  } catch (err) {
    console.error("Analytics error:", err);
    res.status(500).json({ error: "Failed to load analytics" });
  }
});

/** GET /api/admin/analytics/timeseries - daily registration counts and revenue for interactive chart */
router.get("/analytics/timeseries", async (req, res) => {
  try {
    const registrations = await prisma.registration.findMany({
      orderBy: { createdAt: "asc" },
    });

    // Group by date and status
    const dailyData = {};

    for (const reg of registrations) {
      const date = reg.createdAt.toISOString().slice(0, 10);
      
      if (!dailyData[date]) {
        dailyData[date] = {
          date,
          totalRegistrations: 0,
          approved: 0,
          pending: 0,
          rejected: 0,
          revenue: 0,
        };
      }

      dailyData[date].totalRegistrations += 1;
      dailyData[date][reg.status] = (dailyData[date][reg.status] || 0) + 1;

      // Add revenue only for approved registrations
      if (reg.status === "approved") {
        dailyData[date].revenue += reg.totalAmount;
      }
    }

    // Convert to array and sort by date
    const timeseriesData = Object.values(dailyData).sort((a, b) => 
      a.date.localeCompare(b.date)
    );

    res.json(timeseriesData);
  } catch (err) {
    console.error("Timeseries analytics error:", err);
    res.status(500).json({ error: "Failed to load timeseries data" });
  }
});

/** GET /api/admin/accounts - list all non-participant staff accounts. */
router.get("/accounts", async (req, res) => {
  try {
    const users = await prisma.user.findMany({
      where: { role: { not: "participant" } },
      orderBy: { createdAt: "desc" },
    });
    res.json({ users: users.map(({ passwordHash, ...u }) => u) });
  } catch (err) {
    console.error("List accounts error:", err);
    res.status(500).json({ error: "Failed to load accounts" });
  }
});

/** POST /api/admin/accounts - create a login for any staff role. */
router.post("/accounts", async (req, res) => {
  try {
    const { name, email, password, role, assignedEventId } = req.body;
    if (!name || !email || !password || !STAFF_ROLES.includes(role)) {
      return res.status(400).json({ error: `role must be one of ${STAFF_ROLES.join(", ")}` });
    }

    const passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.create({
      data: {
        name,
        email: email.toLowerCase().trim(),
        passwordHash,
        role,
        assignedEventId: role === "coordinator" ? assignedEventId || null : null,
      },
    });
    const { passwordHash: _, ...safeUser } = user;
    if (role === "master_admin") logSecurityEvent("MASTER_ADMIN_CREATED", { by: req.user.id, email: user.email });
    res.status(201).json({ user: safeUser });
  } catch (err) {
    console.error("Create account error:", err);
    res.status(500).json({ error: "Failed to create account (email may already be in use)" });
  }
});

/** PUT /api/admin/accounts/:id - edit a staff login. */
router.put("/accounts/:id", async (req, res) => {
  try {
    // Only these fields may change (no mass assignment of role/passwordHash etc.).
    const { name, email, password, role, assignedEventId } = req.body || {};
    const data = {};
    if (typeof name === "string" && name.trim()) data.name = name.trim();
    if (typeof email === "string" && email.trim()) data.email = email.toLowerCase().trim();
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true } });
    if (!target) return res.status(404).json({ error: "Account not found" });
    if (target.role === "participant") {
      return res.status(400).json({ error: "Participant accounts are managed through their registration." });
    }
    if (role !== undefined) {
      if (!STAFF_ROLES.includes(role)) {
        return res.status(400).json({ error: `role must be one of ${STAFF_ROLES.join(", ")}` });
      }
      // Lockout protection: nobody removes their own admin rights, and the
      // last master admin can't be demoted.
      if (target.role === "master_admin" && role !== "master_admin") {
        if (req.params.id === req.user.id) {
          return res.status(400).json({ error: "You can't remove your own admin role." });
        }
        if ((await prisma.user.count({ where: { role: "master_admin" } })) <= 1) {
          return res.status(400).json({ error: "This is the last master admin account - it can't be demoted." });
        }
      }
      data.role = role;
    }
    // Only coordinators have an assigned event.
    if (role !== undefined || assignedEventId !== undefined) {
      const finalRole = role ?? target.role;
      if (finalRole !== "coordinator") data.assignedEventId = null;
      else if (assignedEventId !== undefined) data.assignedEventId = assignedEventId || null;
    }
    if (typeof password === "string" && password) data.passwordHash = await bcrypt.hash(password, 10);
    const user = await prisma.user.update({ where: { id: req.params.id }, data });
    const { passwordHash, ...safeUser } = user;
    res.json({ user: safeUser });
  } catch (err) {
    console.error("Update account error:", err);
    res.status(500).json({ error: "Failed to update account" });
  }
});

/** DELETE /api/admin/accounts/:id */
router.delete("/accounts/:id", async (req, res) => {
  try {
    if (req.params.id === req.user.id) {
      return res.status(400).json({ error: "You can't delete your own account." });
    }
    const target = await prisma.user.findUnique({ where: { id: req.params.id }, select: { role: true, email: true } });
    if (!target) return res.status(404).json({ error: "Account not found" });
    if (target.role === "participant") {
      return res.status(400).json({ error: "Participant accounts are managed through their registration." });
    }
    if (target.role === "master_admin" && (await prisma.user.count({ where: { role: "master_admin" } })) <= 1) {
      return res.status(400).json({ error: "This is the last master admin account - create another one before deleting it." });
    }
    await prisma.user.delete({ where: { id: req.params.id } });
    logSecurityEvent("STAFF_ACCOUNT_DELETED", { by: req.user.id, email: target.email, role: target.role });
    res.json({ success: true });
  } catch (err) {
    console.error("Delete account error:", err);
    res.status(500).json({ error: "Failed to delete account" });
  }
});

/** GET /api/admin/export/registrations.csv - full data export. Rate limited to prevent abuse. */
router.get("/export/registrations.csv", exportLimiter, async (req, res) => {
  try {
    const registrations = await prisma.registration.findMany({ include: { user: true } });
    
    // Collect all unique event IDs from all registrations
    const allEventIds = [...new Set(registrations.flatMap((r) => r.eventIds || []))];
    
    // Fetch all events at once
    const events = await prisma.event.findMany({
      where: { id: { in: allEventIds } },
      select: { id: true, name: true },
    });
    
    // Create a map for quick lookup: eventId -> eventName
    const eventMap = new Map(events.map((e) => [e.id, e.name]));
    
    const csv = toCsv(registrations, [
      { label: "Registration Code", value: "registrationCode" },
      { label: "Name", value: (r) => r.user.name },
      { label: "Email", value: (r) => r.user.email },
      { label: "College", value: "collegeName" },
      { label: "Register No", value: (r) => r.user.registerNo || "" },
      { label: "Course", value: (r) => r.user.course || "" },
      { label: "Department", value: (r) => r.user.department || "" },
      { label: "Year of Study", value: (r) => r.user.yearOfStudy || "" },
      { label: "Team Name", value: "teamName" },
      { label: "Events", value: (r) => (r.eventIds || []).map((id) => eventMap.get(id) || id).join(" | ") },
      { label: "Total Amount", value: "totalAmount" },
      { label: "Transaction ID", value: "transactionId" },
      { label: "Status", value: "status" },
      { label: "Reviewed By", value: (r) => r.reviewedByName || "" },
      { label: "Reviewed At", value: (r) => (r.reviewedAt ? r.reviewedAt.toISOString() : "") },
      { label: "Created At", value: (r) => r.createdAt.toISOString() },
    ]);
    res.setHeader("Content-Type", "text/csv");
    res.setHeader("Content-Disposition", "attachment; filename=registrations.csv");
    res.send(csv);
  } catch (err) {
    console.error("Export CSV error:", err);
    res.status(500).json({ error: "Failed to export data" });
  }
});

/**
 * PATCH /api/admin/registrations/:id/waitlist-promote - approve a waiting
 * registration. A rejected one takes its seats back first (409 if they're
 * gone); newly approved registrations get the approval email.
 */
router.patch("/registrations/:id/waitlist-promote", async (req, res) => {
  try {
    const current = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Registration not found" });
    if (current.status === "approved") return res.json({ registration: current, alreadyApproved: true });
    const registration = await prisma.$transaction(async (tx) => {
      await applySeatChange(tx, current, current.status, "approved");
      return tx.registration.update({
        where: { id: current.id },
        data: { status: "approved", rejectionReason: null, reviewedById: req.user.id, reviewedByName: req.user.name, reviewedAt: new Date() },
      });
    });
    res.json({ registration });
    sendApprovalEmail(registration);
  } catch (err) {
    if (err.status) return res.status(err.status).json({ error: err.message });
    console.error("Waitlist promote error:", err);
    res.status(500).json({ error: "Failed to promote registration" });
  }
});

/** POST /api/admin/registrations/:id/refund - cancel a registration (refunded); its seats are released. */
router.post("/registrations/:id/refund", async (req, res) => {
  try {
    const current = await prisma.registration.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: "Registration not found" });
    const registration = await prisma.$transaction(async (tx) => {
      await applySeatChange(tx, current, current.status, "rejected");
      return tx.registration.update({
        where: { id: current.id },
        data: { status: "rejected", rejectionReason: "Cancelled/refunded by admin", reviewedById: req.user.id, reviewedByName: req.user.name, reviewedAt: new Date() },
      });
    });
    res.json({ registration });
    if (current.status !== "rejected") sendRejectionEmail(registration, { cancelled: true });
  } catch (err) {
    console.error("Refund error:", err);
    res.status(500).json({ error: "Failed to process refund" });
  }
});

module.exports = router;
