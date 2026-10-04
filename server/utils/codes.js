/**
 * Human-readable code generators for registrations and certificates.
 * Format: SYM2026-0042, CERT2026-K7MQX2RT
 */
const { randomInt } = require("crypto");

function pad(num, size) {
  return String(num).padStart(size, "0");
}

function currentSymposiumYear() {
  return new Date().getFullYear();
}

async function generateRegistrationCode(prisma) {
  const year = currentSymposiumYear();
  const count = await prisma.registration.count();
  return `SYM${year}-${pad(count + 1, 4)}`;
}

// Certificate codes are random, not sequential: the public verify page shows
// the name on a certificate, so codes must not be guessable one after another.
// No 0/O, 1/I/L, so a printed code is easy to type.
const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
async function generateCertificateCode(prisma) {
  const year = currentSymposiumYear();
  for (;;) {
    const code = `CERT${year}-${Array.from({ length: 8 }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join("")}`;
    if (!(await prisma.certificate.findUnique({ where: { certificateCode: code } }))) return code;
  }
}

module.exports = { generateRegistrationCode, generateCertificateCode };
