const express = require("express");
const ExcelJS = require("exceljs");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { exportLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../middleware/securityLogger");
const { collections, paymentKind } = require("../utils/collections");

const router = express.Router();

// Apply auth middleware - registration_team or master_admin only
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== "registration_team" && req.user.role !== "master_admin") {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
});

/**
 * GET /api/registration-team/collections - money collected from approved
 * registrations: total, online (UPI), on spot (cash) and pay later (paid at
 * the desk), plus pay-later holds still unpaid. See utils/collections.js.
 */
router.get("/collections", async (req, res) => {
  try {
    const registrations = await prisma.registration.findMany({
      where: { status: { in: ["approved", "pending"] } },
      select: { status: true, paymentMethod: true, onSpot: true, totalAmount: true, createdAt: true, reviewedAt: true },
    });
    res.json(collections(registrations));
  } catch (err) {
    console.error("Collections error:", err);
    res.status(500).json({ error: "Failed to load the collections" });
  }
});

const KIND_LABEL = { online: "Online", onSpot: "On spot", payLater: "Pay later", due: "Pay later - not paid" };
const METHOD_LABEL = { upi: "UPI", razorpay: "Razorpay", cash: "Cash", later: "Not paid yet" };

/**
 * GET /api/registration-team/collections.xlsx?kind=all|online|onSpot|payLater|due
 * The registrations behind "Money collected" as a list. kind=all: a summary
 * sheet, every collected registration, then a sheet per kind.
 */
router.get("/collections.xlsx", exportLimiter, async (req, res) => {
  try {
    const kind = String(req.query.kind || "all");
    if (kind !== "all" && !KIND_LABEL[kind]) return res.status(400).json({ error: "Unknown list." });
    const [registrations, events] = await Promise.all([
      prisma.registration.findMany({
        where: { status: { in: ["approved", "pending"] } },
        include: { user: { select: { name: true, email: true, phone: true, collegeName: true } } },
        orderBy: { createdAt: "asc" },
      }),
      prisma.event.findMany({ select: { id: true, name: true } }),
    ]);
    const eventName = new Map(events.map((e) => [e.id, e.name]));
    const when = (d) => (d ? new Date(d).toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }) : "");
    const rows = registrations
      .map((reg) => ({ reg, kind: paymentKind(reg) }))
      .filter((r) => r.kind)
      .map(({ reg, kind: k }) => ({
        kind: k,
        code: reg.registrationCode,
        payment: KIND_LABEL[k],
        method: METHOD_LABEL[reg.paymentMethod] || reg.paymentMethod,
        amount: reg.totalAmount,
        name: reg.user?.name || "",
        phone: reg.user?.phone || "",
        email: reg.user?.email || "",
        college: reg.collegeName || reg.user?.collegeName || "",
        team: reg.teamName || "",
        people: Array.isArray(reg.teamMembers) && reg.teamMembers.length ? reg.teamMembers.length : 1,
        events: (reg.eventIds || []).map((id) => eventName.get(id) || id).join(", "),
        utr: reg.transactionId || "",
        registered: when(reg.createdAt),
        approved: k === "due" ? "" : when(reg.reviewedAt),
        approvedBy: k === "due" ? "" : reg.reviewedByName || "",
      }));

    const columns = [
      { header: "Registration Code", key: "code", width: 17 },
      { header: "Payment", key: "payment", width: 18 },
      { header: "Method", key: "method", width: 12 },
      { header: "Amount (₹)", key: "amount", width: 11 },
      { header: "Name", key: "name", width: 24 },
      { header: "Phone", key: "phone", width: 14 },
      { header: "Email", key: "email", width: 28 },
      { header: "College", key: "college", width: 34 },
      { header: "Team", key: "team", width: 18 },
      { header: "People", key: "people", width: 8 },
      { header: "Events", key: "events", width: 40 },
      { header: "UTR", key: "utr", width: 18 },
      { header: "Registered", key: "registered", width: 21 },
      { header: "Approved", key: "approved", width: 21 },
      { header: "Approved by", key: "approvedBy", width: 20 },
    ];
    const workbook = new ExcelJS.Workbook();
    const addList = (name, list) => {
      const sheet = workbook.addWorksheet(name);
      sheet.columns = columns;
      sheet.addRows(list);
      const total = list.reduce((sum, r) => sum + r.amount, 0);
      const totalRow = sheet.addRow({ code: "Total", amount: total, name: `${list.length} registration${list.length === 1 ? "" : "s"}` });
      totalRow.font = { bold: true };
      sheet.getRow(1).font = { bold: true };
      sheet.views = [{ state: "frozen", ySplit: 1 }];
    };
    const collected = rows.filter((r) => r.kind !== "due");
    if (kind === "all") {
      const summary = workbook.addWorksheet("Summary");
      summary.columns = [
        { header: "Payment", key: "label", width: 26 },
        { header: "Registrations", key: "count", width: 14 },
        { header: "Amount (₹)", key: "amount", width: 14 },
      ];
      const line = (label, list) => ({ label, count: list.length, amount: list.reduce((s, r) => s + r.amount, 0) });
      summary.addRows([
        line("Online", rows.filter((r) => r.kind === "online")),
        line("On spot", rows.filter((r) => r.kind === "onSpot")),
        line("Pay later", rows.filter((r) => r.kind === "payLater")),
      ]);
      summary.addRow(line("Total collected", collected)).font = { bold: true };
      summary.addRow({});
      summary.addRow(line("Still due (pay later, not paid)", rows.filter((r) => r.kind === "due")));
      summary.getRow(1).font = { bold: true };
      addList("All collected", collected);
      for (const k of ["online", "onSpot", "payLater", "due"]) addList(KIND_LABEL[k], rows.filter((r) => r.kind === k));
    } else {
      addList(KIND_LABEL[kind], rows.filter((r) => r.kind === kind));
    }

    const file = kind === "all" ? "All" : KIND_LABEL[kind].replace(/[^A-Za-z]+/g, "-");
    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", `attachment; filename="Techastra26-Collections-${file}.xlsx"`);
    res.send(Buffer.from(await workbook.xlsx.writeBuffer()));
  } catch (err) {
    console.error("Collections export error:", err);
    res.status(500).json({ error: "Failed to export the collections" });
  }
});

/**
 * GET /api/registration-team/export/:eventId
 * Export all participants for a specific event as Excel (.xlsx)
 * Columns: name, email, phone, college, registerNo, team name, team members, status, payment, transactionId, totalAmount, createdAt
 */
router.get("/export/:eventId", exportLimiter, async (req, res) => {
  try {
    const { eventId } = req.params;

    // Validate event exists
    const event = await prisma.event.findUnique({
      where: { id: eventId },
    });

    if (!event) {
      return res.status(404).json({ error: "Event not found" });
    }

    // Find all registrations that include this event
    const registrations = await prisma.registration.findMany({
      where: {
        eventIds: {
          has: eventId,
        },
      },
      include: {
        user: true,
      },
      orderBy: {
        createdAt: "desc",
      },
    });

    // Collect all unique event IDs from all registrations
    const allEventIds = [...new Set(registrations.flatMap((r) => r.eventIds || []))];
    
    // Fetch all events at once
    const events = await prisma.event.findMany({
      where: { id: { in: allEventIds } },
      select: { id: true, name: true },
    });
    
    // Create a map for quick lookup: eventId -> eventName
    const eventMap = new Map(events.map((e) => [e.id, e.name]));

    // The option each participant picked for this event (e.g. the game).
    const choiceKey = event.choices?.length ? event.choiceLabel || "Choice" : null;
    const choiceOf = (reg) => (choiceKey ? { [choiceKey]: reg.eventChoices?.[event.id] || "" } : {});

    // Prepare data rows for Excel
    let rows = registrations.map((reg) => {
      // Format team members if it's a team event
      let teamMembersStr = "";
      if (reg.teamMembers && Array.isArray(reg.teamMembers)) {
        teamMembersStr = reg.teamMembers
          .map((member) => `${member.name} (${[member.regNo || "N/A", member.department, member.yearOfStudy].filter(Boolean).join(", ")})`)
          .join("; ");
      }

      // Format events - map IDs to names
      const eventsStr = (reg.eventIds || [])
        .map((id) => eventMap.get(id) || id)
        .join(" | ");

      return {
        Name: reg.user.name || "",
        Email: reg.user.email || "",
        Phone: reg.user.phone || "",
        College: reg.collegeName || "",
        "Register No": reg.user.registerNo || "",
        Course: reg.user.course || "",
        Department: reg.user.department || "",
        "Year of Study": reg.user.yearOfStudy || "",
        "Team Name": reg.teamName || "",
        "Team Members": teamMembersStr,
        Events: eventsStr,
        ...choiceOf(reg),
        Status: reg.status || "",
        Payment: reg.paymentMethod === "later" ? "pay later (not paid)" : reg.paymentMethod || "",
        "On-spot": reg.onSpot ? "Yes" : "",
        "Transaction ID": reg.transactionId || "",
        "Total Amount": reg.totalAmount || 0,
        "Registration Date": reg.createdAt
          ? new Date(reg.createdAt).toLocaleString("en-IN", {
              dateStyle: "medium",
              timeStyle: "short",
            })
          : "",
        "Registration Code": reg.registrationCode || "",
      };
    });

    // Individual event: every member of a team registration takes part on
    // their own, so list one row per participant (the team's details stay
    // with the lead; members show which registration they came with).
    if (!event.isTeamEvent) {
      rows = registrations.flatMap((reg) => {
        const members = Array.isArray(reg.teamMembers) && reg.teamMembers.length ? reg.teamMembers : null;
        const people = members
          ? members.map((m, i) => ({ name: m.name, regNo: m.regNo, department: m.department, yearOfStudy: m.yearOfStudy, lead: m.role === "lead" || (i === 0 && !members.some((x) => x.role === "lead")) }))
          : [{ name: reg.user.name, regNo: reg.user.registerNo, lead: true }];
        return people.map((p) => ({
          Name: p.name || "",
          "Register No": p.regNo || (p.lead ? reg.user.registerNo || "" : ""),
          College: reg.collegeName || "",
          // Course is asked of the registrant only; members give their
          // department and year (not in registrations made before 4 Oct).
          Course: p.lead ? reg.user.course || "" : "",
          Department: p.department || (p.lead ? reg.user.department || "" : ""),
          "Year of Study": p.yearOfStudy || (p.lead ? reg.user.yearOfStudy || "" : ""),
          ...choiceOf(reg),
          "Registered With": members ? `${reg.teamName || "Team"} (lead: ${reg.user.name})` : "Self",
          Email: p.lead ? reg.user.email || "" : "",
          Phone: p.lead ? reg.user.phone || "" : "",
          Status: reg.status || "",
          "On-spot": reg.onSpot ? "Yes" : "",
          "Registration Code": reg.registrationCode || "",
        }));
      });
    }

    // Create workbook and worksheet, with column widths for readability
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");
    const widths = {
      Name: 20,
      Email: 30,
      Phone: 15,
      College: 40,
      "Register No": 15,
      Course: 16,
      Department: 28,
      "Year of Study": 13,
      "Team Name": 25,
      "Team Members": 50,
      Events: 40,
      Status: 12,
      "Transaction ID": 20,
      "Total Amount": 12,
      "Registration Date": 20,
      "Registration Code": 20,
      "Registered With": 36,
    };
    const headers = rows.length ? Object.keys(rows[0]) : Object.keys(widths);
    worksheet.columns = headers.map((key) => ({ header: key, key, width: widths[key] || 20 }));
    worksheet.getRow(1).font = { bold: true };
    worksheet.addRows(rows);

    // Generate Excel file buffer
    const excelBuffer = Buffer.from(await workbook.xlsx.writeBuffer());

    // Set response headers for file download
    const filename = `${event.name.replace(/[^a-z0-9]/gi, "-")}-participants-${Date.now()}.xlsx`;
    res.setHeader(
      "Content-Type",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    );
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    
    // Log export activity
    logSecurityEvent(
      "registration_export",
      req.user.id,
      { eventId, eventName: event.name, rowCount: rows.length },
      req
    );
    
    res.send(excelBuffer);
  } catch (err) {
    console.error("Export event participants error:", err);
    res.status(500).json({ error: "Failed to export participants" });
  }
});

module.exports = router;
