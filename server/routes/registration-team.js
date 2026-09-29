const express = require("express");
const ExcelJS = require("exceljs");
const prisma = require("../db");
const { requireAuth, requireRole } = require("../middleware/auth");
const { exportLimiter } = require("../middleware/rateLimiter");
const { logSecurityEvent } = require("../middleware/securityLogger");

const router = express.Router();

// Apply auth middleware - registration_team or master_admin only
router.use(requireAuth, (req, res, next) => {
  if (req.user.role !== "registration_team" && req.user.role !== "master_admin") {
    return res.status(403).json({ error: "Access denied" });
  }
  next();
});

/**
 * GET /api/registration-team/export/:eventId
 * Export all participants for a specific event as Excel (.xlsx)
 * Columns: name, email, phone, college, registerNo, team name, team members, status, transactionId, totalAmount, createdAt
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

    // Prepare data rows for Excel
    const rows = registrations.map((reg) => {
      // Format team members if it's a team event
      let teamMembersStr = "";
      if (reg.teamMembers && Array.isArray(reg.teamMembers)) {
        teamMembersStr = reg.teamMembers
          .map((member) => `${member.name} (${member.regNo || "N/A"})`)
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
        "Register No": reg.registerNo || "",
        "Team Name": reg.teamName || "",
        "Team Members": teamMembersStr,
        Events: eventsStr,
        Status: reg.status || "",
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

    // Create workbook and worksheet, with column widths for readability
    const workbook = new ExcelJS.Workbook();
    const worksheet = workbook.addWorksheet("Participants");
    const widths = {
      Name: 20,
      Email: 30,
      Phone: 15,
      College: 40,
      "Register No": 15,
      "Team Name": 25,
      "Team Members": 50,
      Events: 40,
      Status: 12,
      "Transaction ID": 20,
      "Total Amount": 12,
      "Registration Date": 20,
      "Registration Code": 20,
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
