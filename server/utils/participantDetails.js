const prisma = require("../db");

/**
 * Everything the desk and event coordinators see when they scan a
 * participant's ID card: who they are, how to reach them, the registration
 * and payment, the team, each event (with check-in), meals and kits.
 * `registration` needs at least `id`; returns null if it doesn't exist.
 */
async function participantDetails(registration) {
  const reg = await prisma.registration.findUnique({
    where: { id: registration.id },
    include: {
      user: {
        select: {
          name: true, email: true, phone: true, collegeName: true, registerNo: true,
          course: true, department: true, yearOfStudy: true,
        },
      },
    },
  });
  if (!reg) return null;

  const [events, attendance, meals, kit] = await Promise.all([
    prisma.event.findMany({
      where: { id: { in: reg.eventIds } },
      select: { id: true, name: true, level: true, isTeamEvent: true, startTime: true, endTime: true, venue: true },
      orderBy: { startTime: "asc" },
    }),
    prisma.attendance.findMany({ where: { registrationId: reg.id }, select: { eventId: true, scannedAt: true } }),
    prisma.foodLog.findMany({ where: { registrationId: reg.id }, select: { mealSession: true, collectedAt: true }, orderBy: { collectedAt: "asc" } }),
    prisma.kitHandout.findUnique({ where: { registrationId: reg.id }, select: { kits: true, givenByName: true, givenAt: true } }),
  ]);
  const checkedIn = new Map(attendance.map((a) => [a.eventId, a.scannedAt]));
  const u = reg.user;
  const members = Array.isArray(reg.teamMembers)
    ? reg.teamMembers.filter((m) => m && m.name).map((m) => ({ name: m.name, regNo: m.regNo || null, role: m.role === "lead" ? "lead" : "member" }))
    : [];

  return {
    registrationCode: reg.registrationCode,
    status: reg.status,
    rejectionReason: reg.rejectionReason,
    junior: events.some((e) => e.level === "junior"),
    person: {
      name: u.name,
      email: u.email,
      phone: u.phone,
      college: reg.collegeName || u.collegeName || null,
      registerNo: u.registerNo,
      course: u.course,
      department: u.department,
      yearOfStudy: u.yearOfStudy,
    },
    team: { name: reg.teamName, members, size: members.length || 1 },
    events: events.map((e) => ({
      id: e.id,
      name: e.name,
      startTime: e.startTime,
      endTime: e.endTime,
      venue: e.venue,
      checkedInAt: checkedIn.get(e.id) || null,
    })),
    payment: {
      method: reg.paymentMethod,
      amount: reg.totalAmount,
      transactionId: reg.transactionId,
      registeredAt: reg.createdAt,
      reviewedByName: reg.reviewedByName,
      reviewedAt: reg.reviewedAt,
    },
    guardianConsent: reg.guardianConsent,
    meals,
    kit,
  };
}

module.exports = { participantDetails };
