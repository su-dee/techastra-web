/**
 * Data retention (DPDP Act 2023, s.8(7)): erase participants' personal data
 * once the purpose is served. The Privacy Notice promises this within 90
 * days after the symposium - run it after results and certificates are out.
 *
 *   node scripts/purge-personal-data.js            # dry run: shows counts only
 *   node scripts/purge-personal-data.js --confirm  # anonymise for real
 *
 * What happens:
 *  - participant accounts: name/email/phone/college/register no. replaced,
 *    password made unusable (staff accounts are untouched)
 *  - registrations: team details and college cleared; payment screenshots
 *    deleted from disk. Amount, UTR and status are kept as financial records.
 *  - help-desk queries: deleted. Feedback: comments cleared, ratings kept.
 * Certificate codes stay valid, so issued certificates can still be verified.
 */
require("dotenv").config();
const crypto = require("crypto");
const fs = require("fs");
const path = require("path");
const prisma = require("../db");
const { uploadDir } = require("../middleware/upload");

const confirm = process.argv.includes("--confirm");

(async () => {
  const participants = await prisma.user.findMany({ where: { role: "participant" }, include: { registration: true } });
  const proofs = participants.map((u) => u.registration?.paymentProofUrl).filter(Boolean);
  const help = await prisma.helpQuery.count();
  const feedback = await prisma.feedback.count({ where: { comments: { not: null } } });
  console.log(`${participants.length} participant accounts, ${proofs.length} payment screenshots, ${help} help-desk queries, ${feedback} feedback comments.`);
  if (!confirm) {
    console.log("Dry run - nothing changed. Re-run with --confirm to anonymise.");
    return;
  }

  for (const u of participants) {
    await prisma.$transaction([
      prisma.user.update({
        where: { id: u.id },
        data: {
          name: "Deleted participant",
          email: `deleted-${u.id}@invalid.invalid`,
          phone: null,
          collegeName: null,
          registerNo: null,
          photoUrl: null,
          passwordHash: `!disabled-${crypto.randomBytes(16).toString("hex")}`,
        },
      }),
      ...(u.registration
        ? [prisma.registration.update({ where: { id: u.registration.id }, data: { teamName: null, collegeName: null, paymentProofUrl: null } })]
        : []),
    ]);
  }
  // Prisma needs JsonNull to clear a Json column.
  await prisma.registration.updateMany({ where: {}, data: { teamMembers: require("@prisma/client").Prisma.DbNull } });

  let removed = 0;
  for (const p of proofs) {
    const file = path.join(uploadDir, path.basename(p));
    if (fs.existsSync(file)) {
      fs.unlinkSync(file);
      removed++;
    }
  }
  await prisma.helpQuery.deleteMany({});
  await prisma.feedback.updateMany({ data: { comments: null } });
  console.log(`Done: ${participants.length} accounts anonymised, ${removed} screenshots deleted, help-desk queries removed, feedback comments cleared.`);
})()
  .catch((err) => {
    console.error("Purge failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
