/**
 * Seed script for TechAstra Symposium Portal.
 *
 * Populates:
 *  - the 16 senior events (8 Technical + 8 Non-Technical) with real names,
 *    descriptions and coordinators - see eventData.js for which details
 *    (times, fees, seats) are still unconfirmed
 *  - 4 sample colleges (used indirectly via registration collegeName)
 *  - one login per staff role (+ one coordinator per event)
 *  - ~14 dummy registrations spread across pending/approved/rejected
 *  - a few locked results + generated certificates for demo purposes
 *
 * Run with: npm run seed  (inside /server, after `npx prisma migrate dev`)
 * Safe to re-run: events are updated in place (matched on name + level),
 * staff logins are upserted, and the demo data is skipped once it exists.
 * It does NOT clear existing data - see the note at the bottom of this file
 * if you need a clean slate.
 */

const bcrypt = require("bcrypt");
const prisma = require("../db");
const { generateCertificatePdf } = require("../utils/certificatePdf");
const { buildEvents } = require("./eventData");

const DEMO_PASSWORD = "TechAstra@2026";

const COLLEGES = [
  "Sri Venkateswara College of Engineering",
  "St. Joseph's Institute of Technology",
  "Anna Institute of Technology",
  "PSG College of Technology",
];

// Real event list, coordinators and known dates live in eventData.js;
// see the header there for which fields are still unconfirmed.

async function upsertStaff({ name, email, role, assignedEventId, dutyDesk, dutyTiming, dutyRole }) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      passwordHash,
      role,
      assignedEventId: assignedEventId || null,
      dutyDesk: dutyDesk || null,
      dutyTiming: dutyTiming || null,
      dutyRole: dutyRole || null,
    },
  });
}

async function createParticipantWithRegistration({
  name, email, college, registerNo, eventIds, teamName, teamMembers, status, rejectionReason, txnPrefix, index,
}) {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const events = await prisma.event.findMany({ where: { id: { in: eventIds } } });
  const totalAmount = events.reduce((sum, e) => sum + e.fee, 0);

  const user = await prisma.user.create({
    data: {
      name,
      email,
      passwordHash,
      role: "participant",
      collegeName: college,
      registerNo,
    },
  });

  const registrationCode = `SYM${new Date().getFullYear()}-${String(index).padStart(4, "0")}`;

  const registration = await prisma.registration.create({
    data: {
      registrationCode,
      userId: user.id,
      eventIds,
      teamName: teamName || null,
      teamMembers: teamMembers || undefined,
      collegeName: college,
      totalAmount,
      transactionId: `${txnPrefix}${index}`,
      status,
      rejectionReason: rejectionReason || null,
    },
  });

  if (status === "approved") {
    await Promise.all(
      eventIds.map((id) => prisma.event.update({ where: { id }, data: { seatsTaken: { increment: 1 } } }))
    );
  }

  return { user, registration };
}

async function main() {
  console.log("Seeding TechAstra database...\n");

  // 1. Events - matched on (name, level) so a re-run refreshes the details
  // from eventData.js instead of inserting a second copy. seatsTaken isn't
  // in the seed data, so live seat counts survive the update.
  const events = [];
  for (const data of buildEvents()) {
    const level = data.level || "senior";
    const existing = await prisma.event.findFirst({
      where: { name: data.name, level },
      orderBy: { createdAt: "asc" },
    });
    const event = existing
      ? await prisma.event.update({ where: { id: existing.id }, data })
      : await prisma.event.create({ data });
    events.push(event);
    console.log(`${existing ? "Updated" : "Created"} event: ${event.name} (${data.coordinatorContacts.length} coordinator contacts)`);
  }
  const [
    penVision, hackNexus, cryptClash, trialOfTruth, codeRescue, pixelProtocol, forensicAlibi, promptArena,
    rhythmRiot, hiddenFrames, verbalCombat, blitzHunt, plotTwist, teamFeud, capChaos,
  ] = events;

  // 2. Staff accounts
  const masterAdmin = await upsertStaff({ name: "Dr. HOD Admin", email: "admin@techastra.dev", role: "master_admin" });
  const regTeam1 = await upsertStaff({ name: "Reg Desk Alpha", email: "regteam1@techastra.dev", role: "registration_team" });
  const regTeam2 = await upsertStaff({ name: "Reg Desk Beta", email: "regteam2@techastra.dev", role: "registration_team" });
  const hospitality = await upsertStaff({ name: "Hospitality Lead", email: "hospitality@techastra.dev", role: "hospitality" });
  const certTeam = await upsertStaff({ name: "Certificate Desk", email: "certificates@techastra.dev", role: "certificate_team" });
  const volunteer1 = await upsertStaff({
    name: "Volunteer One", email: "volunteer1@techastra.dev", role: "volunteer",
    dutyDesk: "Main Entrance", dutyTiming: "8:00 AM - 1:00 PM", dutyRole: "Registration Desk Support",
  });
  const volunteer2 = await upsertStaff({
    name: "Volunteer Two", email: "volunteer2@techastra.dev", role: "volunteer",
    dutyDesk: "Food Court", dutyTiming: "12:00 PM - 4:00 PM", dutyRole: "Hospitality Support",
  });

  // One coordinator per event
  const coordinators = [];
  for (const event of events) {
    const slug = event.name.toLowerCase().replace(/[^a-z0-9]+/g, "");
    const coordinator = await upsertStaff({
      name: `${event.name} Coordinator`,
      email: `coordinator.${slug}@techastra.dev`,
      role: "coordinator",
      assignedEventId: event.id,
    });
    coordinators.push(coordinator);
    console.log(`Created coordinator for: ${event.name} (${coordinator.email})`);
  }

  // 3-6 are one-off demo data (participants, results, certificates,
  // announcements, combo pass). They're created together, so if the first
  // demo participant exists they all do - skip them rather than crash on
  // duplicate emails / registration codes.
  if (await prisma.user.findUnique({ where: { email: "arun.kumar@example.com" } })) {
    console.log("\nDemo registrations already exist - skipping demo data.");
    console.log("\nSeeding complete.\n");
    return;
  }

  // 3. Dummy registrations (spread across pending/approved/rejected)
  const registrations = [];
  let idx = 1;

  const approvedSeed = [
    { name: "Arun Kumar", email: "arun.kumar@example.com", college: COLLEGES[0], registerNo: "21CS001", eventIds: [codeRescue.id, trialOfTruth.id] },
    { name: "Divya Sree", email: "divya.sree@example.com", college: COLLEGES[1], registerNo: "21IT014", eventIds: [penVision.id] },
    { name: "Karthik Raja", email: "karthik.raja@example.com", college: COLLEGES[2], registerNo: "20EC022", eventIds: [pixelProtocol.id] },
    {
      name: "Meena Priya", email: "meena.priya@example.com", college: COLLEGES[0], registerNo: "21CS045",
      eventIds: [hackNexus.id], teamName: "Byte Busters",
      teamMembers: [
        { name: "Meena Priya", regNo: "21CS045", role: "lead" },
        { name: "Suresh Babu", regNo: "21CS046", role: "member" },
        { name: "Priyanka R", regNo: "21CS047", role: "member" },
      ],
    },
    { name: "Vignesh S", email: "vignesh.s@example.com", college: COLLEGES[3], registerNo: "21ME011", eventIds: [cryptClash.id] },
    { name: "Lakshmi Narayanan", email: "lakshmi.n@example.com", college: COLLEGES[1], registerNo: "21CS078", eventIds: [promptArena.id] },
    {
      name: "Ramya Devi", email: "ramya.devi@example.com", college: COLLEGES[2], registerNo: "21AI009",
      eventIds: [plotTwist.id], teamName: "NextGen Founders",
      teamMembers: [
        { name: "Ramya Devi", regNo: "21AI009", role: "lead" },
        { name: "Ashok Kumar", regNo: "21AI010", role: "member" },
      ],
    },
  ];

  for (const p of approvedSeed) {
    const { registration } = await createParticipantWithRegistration({
      ...p, status: "approved", txnPrefix: "UPI2026APR", index: idx,
    });
    registrations.push(registration);
    idx++;
  }

  const pendingSeed = [
    { name: "Bala Subramanian", email: "bala.s@example.com", college: COLLEGES[0], registerNo: "21CS002", eventIds: [codeRescue.id] },
    { name: "Nithya Shree", email: "nithya.shree@example.com", college: COLLEGES[3], registerNo: "21IT033", eventIds: [pixelProtocol.id] },
    { name: "Prakash Raj", email: "prakash.raj@example.com", college: COLLEGES[1], registerNo: "20EC055", eventIds: [trialOfTruth.id, promptArena.id] },
    { name: "Anitha Kumari", email: "anitha.k@example.com", college: COLLEGES[2], registerNo: "21CS091", eventIds: [penVision.id] },
  ];
  for (const p of pendingSeed) {
    const { registration } = await createParticipantWithRegistration({
      ...p, status: "pending", txnPrefix: "UPI2026PND", index: idx,
    });
    registrations.push(registration);
    idx++;
  }

  const rejectedSeed = [
    { name: "Gokul Nathan", email: "gokul.nathan@example.com", college: COLLEGES[0], registerNo: "21CS013", eventIds: [codeRescue.id], reason: "Transaction ID could not be matched to any payment" },
    { name: "Swathi M", email: "swathi.m@example.com", college: COLLEGES[3], registerNo: "21ME028", eventIds: [cryptClash.id], reason: "Duplicate registration for the same event" },
    { name: "Harish Chandra", email: "harish.c@example.com", college: COLLEGES[1], registerNo: "21IT061", eventIds: [pixelProtocol.id], reason: "Payment amount did not match event fee" },
  ];
  for (const p of rejectedSeed) {
    const { registration } = await createParticipantWithRegistration({
      name: p.name, email: p.email, college: p.college, registerNo: p.registerNo, eventIds: p.eventIds,
      status: "rejected", rejectionReason: p.reason, txnPrefix: "UPI2026REJ", index: idx,
    });
    registrations.push(registration);
    idx++;
  }

  console.log(`\nCreated ${registrations.length} sample registrations (7 approved, 4 pending, 3 rejected).`);

  // 4. Sample locked results (for Code Rescue and Hack Nexus) + certificates
  const codeRescueApproved = registrations.find((r) => r.eventIds.includes(codeRescue.id) && r.status === "approved");
  const hackNexusApproved = registrations.find((r) => r.eventIds.includes(hackNexus.id) && r.status === "approved");

  if (codeRescueApproved) {
    await prisma.result.create({
      data: { eventId: codeRescue.id, position: 1, registrationId: codeRescueApproved.id, lockedBy: coordinators[4].id },
    });
    console.log(`Locked result: ${codeRescueApproved.registrationCode} placed 1st in Code Rescue`);

    const certUser = await prisma.user.findUnique({ where: { id: codeRescueApproved.userId } });
    const code1 = `CERT${new Date().getFullYear()}-000001`;
    const pdfUrl1 = await generateCertificatePdf({
      certificateCode: code1,
      participantName: certUser.name,
      eventName: codeRescue.name,
      type: "winner",
      position: 1,
      collegeName: codeRescueApproved.collegeName,
    });
    await prisma.certificate.create({
      data: { certificateCode: code1, registrationId: codeRescueApproved.id, eventId: codeRescue.id, type: "winner", pdfUrl: pdfUrl1 },
    });
    console.log(`Generated demo winner certificate: ${code1}`);
  }

  if (hackNexusApproved) {
    await prisma.result.create({
      data: { eventId: hackNexus.id, position: 1, registrationId: hackNexusApproved.id, lockedBy: coordinators[1].id },
    });
    console.log(`Locked result: ${hackNexusApproved.registrationCode} placed 1st in Hack Nexus`);

    const certUser = await prisma.user.findUnique({ where: { id: hackNexusApproved.userId } });
    const code2 = `CERT${new Date().getFullYear()}-000002`;
    const pdfUrl2 = await generateCertificatePdf({
      certificateCode: code2,
      participantName: `${certUser.name} (${hackNexusApproved.teamName})`,
      eventName: hackNexus.name,
      type: "winner",
      position: 1,
      collegeName: hackNexusApproved.collegeName,
    });
    await prisma.certificate.create({
      data: { certificateCode: code2, registrationId: hackNexusApproved.id, eventId: hackNexus.id, type: "winner", pdfUrl: pdfUrl2 },
    });
    console.log(`Generated demo winner certificate: ${code2}`);

    // Also generate a plain participation certificate for a different approved reg
    const penVisionApproved = registrations.find((r) => r.eventIds.includes(penVision.id) && r.status === "approved");
    if (penVisionApproved) {
      const puser = await prisma.user.findUnique({ where: { id: penVisionApproved.userId } });
      const code3 = `CERT${new Date().getFullYear()}-000003`;
      const pdfUrl3 = await generateCertificatePdf({
        certificateCode: code3,
        participantName: puser.name,
        eventName: penVision.name,
        type: "participation",
        collegeName: penVisionApproved.collegeName,
      });
      await prisma.certificate.create({
        data: { certificateCode: code3, registrationId: penVisionApproved.id, eventId: penVision.id, type: "participation", pdfUrl: pdfUrl3 },
      });
      console.log(`Generated demo participation certificate: ${code3}`);
    }
  }

  // 5. A couple of sample announcements
  await prisma.announcement.create({
    data: { message: "Welcome to TechAstra 2026! Registration desks open at 8:00 AM.", createdBy: masterAdmin.id },
  });
  await prisma.announcement.create({
    data: { message: "Venue change: Crypt Clash has moved to Computer Lab 1 (Block C).", createdBy: masterAdmin.id },
  });

  // 6. Combo Pass: 1 Technical + 2 Non-Technical events
  const comboEvents = [hackNexus, verbalCombat, blitzHunt]; // 1 technical + 2 non-technical
  const individualPrice = comboEvents.reduce((sum, e) => sum + e.fee, 0); // 300 + 80 + 60 = 440
  const comboPrice = Math.round(individualPrice * 0.85); // 15% discount = 374
  const savings = individualPrice - comboPrice; // 66

  await prisma.comboPass.create({
    data: {
      name: "Tech & Culture Combo",
      description: "Build a prototype at Hack Nexus, then compete in sharp debates and crack clues in a campus-wide treasure hunt. Save ₹66 on this power combo.",
      eventIds: comboEvents.map(e => e.id),
      individualPrice,
      comboPrice,
      savings,
      category: "mixed",
      availableSeats: 30,
      isActive: true,
    },
  });
  console.log(`Created combo pass: Tech & Culture Combo (₹${comboPrice}, saves ₹${savings})`);

  console.log("\nSeeding complete.\n");
  console.log("All staff/demo accounts use the password:", DEMO_PASSWORD);
  console.log("See SEED_CREDENTIALS.md at the repo root for the full list of logins.");
}

main()
  .catch((err) => {
    console.error("Seeding failed:", err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

/*
 * NOTE: To reset and reseed from a clean slate, run:
 *   npx prisma migrate reset
 * This drops and recreates the database, then automatically re-runs this
 * seed script (configured via the "prisma.seed" field in package.json).
 */
