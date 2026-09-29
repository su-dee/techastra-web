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
const { buildEvents, COMBOS, COMBO_PRICE } = require("./eventData");

const IS_PROD = process.env.NODE_ENV === "production";
// Demo participants, results and certificates: on by default locally, off in
// production unless SEED_DEMO=true is set explicitly.
const SEED_DEMO = process.env.SEED_DEMO ? process.env.SEED_DEMO === "true" : !IS_PROD;
// Demo participants always use this; staff use STAFF_PASSWORD when set, which
// is required in production so the public demo password never guards a live
// staff account.
const DEMO_PASSWORD = "TechAstra@2026";
const STAFF_PASSWORD = process.env.STAFF_PASSWORD || (IS_PROD ? "" : DEMO_PASSWORD);
if (IS_PROD && STAFF_PASSWORD.length < 12) {
  console.error("Set STAFF_PASSWORD (at least 12 characters) to seed staff accounts in production.");
  process.exit(1);
}

const COLLEGES = [
  "Sri Venkateswara College of Engineering",
  "St. Joseph's Institute of Technology",
  "Anna Institute of Technology",
  "PSG College of Technology",
];

// Real event list, coordinators and known dates live in eventData.js;
// see the header there for which fields are still unconfirmed.

async function upsertStaff({ name, email, role, assignedEventId }) {
  const passwordHash = await bcrypt.hash(STAFF_PASSWORD, 10);
  return prisma.user.upsert({
    where: { email },
    update: {},
    create: {
      name,
      email,
      passwordHash,
      role,
      assignedEventId: assignedEventId || null,
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

  // 2b. Combo passes (real, not demo) - matched on name so a re-run
  // refreshes events and price. Senior passes cost COMBO_PRICE; a combo can
  // set its own `price` (Junior combos are free) and `level` (default senior).
  for (const combo of COMBOS) {
    const level = combo.level || "senior";
    const comboEvents = combo.events.map((name) => {
      const ev = events.find((e) => e.name === name && e.level === level);
      if (!ev) throw new Error(`Combo "${combo.name}": ${level} event "${name}" not found`);
      return ev;
    });
    const individualPrice = comboEvents.reduce((sum, e) => sum + e.fee, 0);
    const comboPrice = combo.price ?? COMBO_PRICE;
    const data = {
      name: combo.name,
      description: combo.description,
      eventIds: comboEvents.map((e) => e.id),
      individualPrice,
      comboPrice,
      savings: individualPrice - comboPrice,
      category: "mixed",
      availableSeats: Math.min(...comboEvents.map((e) => e.maxSeats)),
      isActive: true,
    };
    const existing = await prisma.comboPass.findFirst({ where: { name: combo.name } });
    if (existing) await prisma.comboPass.update({ where: { id: existing.id }, data });
    else await prisma.comboPass.create({ data });
    console.log(`${existing ? "Updated" : "Created"} combo: ${combo.name} (₹${comboPrice}, saves ₹${individualPrice - comboPrice})`);
  }
  // Retire the old demo combo (kept, just hidden, so past carts stay readable).
  const retired = await prisma.comboPass.updateMany({
    where: { name: { notIn: COMBOS.map((c) => c.name) }, isActive: true },
    data: { isActive: false },
  });
  if (retired.count) console.log(`Deactivated ${retired.count} other combo pass(es)`);

  // 3-6 are one-off demo data (participants, results, certificates,
  // announcements). They're created together, so if the first
  // demo participant exists they all do - skip them rather than crash on
  // duplicate emails / registration codes.
  if (!SEED_DEMO) {
    console.log("\nSkipping demo registrations, results and certificates (production). Set SEED_DEMO=true to include them.");
    console.log("\nSeeding complete. Staff accounts use STAFF_PASSWORD - have each person change it after first sign-in.\n");
    return;
  }
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

  console.log("\nSeeding complete.\n");
  if (!IS_PROD) console.log("All staff/demo accounts use the password:", DEMO_PASSWORD);
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
