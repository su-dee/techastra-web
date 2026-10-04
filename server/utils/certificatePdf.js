const { PDFDocument, rgb, StandardFonts } = require("pdf-lib");
const fs = require("fs");
const path = require("path");

const certDir = path.join(__dirname, "..", "uploads", "certificates");
if (!fs.existsSync(certDir)) {
  fs.mkdirSync(certDir, { recursive: true });
}

/**
 * Renders a simple, clean certificate PDF (participation or winner variant)
 * using pdf-lib and saves it in uploads/certificates. Returns the file name;
 * the file is private (GET /api/certificates/:code/pdf checks who may have it).
 */
async function generateCertificatePdf({
  certificateCode,
  participantName,
  eventName,
  type, // "participation" | "winner"
  position,
  collegeName,
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([842, 595]); // A4 landscape
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);
  const font = await doc.embedFont(StandardFonts.Helvetica);

  const navy = rgb(0.06, 0.08, 0.14);
  const cyan = rgb(0.24, 0.85, 0.92);
  const violet = rgb(0.55, 0.36, 0.96);
  const white = rgb(1, 1, 1);

  // Background
  page.drawRectangle({ x: 0, y: 0, width: 842, height: 595, color: navy });
  // Border accent
  page.drawRectangle({ x: 20, y: 20, width: 802, height: 555, borderColor: cyan, borderWidth: 3 });

  page.drawText("TECHASTRA", {
    x: 60,
    y: 500,
    size: 28,
    font: fontBold,
    color: cyan,
  });
  page.drawText("National Symposium", { x: 60, y: 475, size: 14, font, color: white });

  const title =
    type === "winner"
      ? `CERTIFICATE OF ACHIEVEMENT`
      : `CERTIFICATE OF PARTICIPATION`;
  page.drawText(title, { x: 60, y: 400, size: 26, font: fontBold, color: white });

  page.drawText("This is proud to certify that", { x: 60, y: 355, size: 13, font, color: white });
  page.drawText(participantName, { x: 60, y: 320, size: 30, font: fontBold, color: cyan });

  const collegeLine = collegeName ? ` from ${collegeName}` : "";
  const bodyLine =
    type === "winner"
      ? `secured ${ordinal(position)} place in "${eventName}"${collegeLine}.`
      : `participated in "${eventName}"${collegeLine}.`;
  page.drawText(bodyLine, { x: 60, y: 280, size: 15, font, color: white });

  if (type === "winner") {
    page.drawRectangle({ x: 60, y: 230, width: 180, height: 34, color: violet });
    page.drawText(`${ordinal(position)} PLACE`, { x: 80, y: 240, size: 16, font: fontBold, color: white });
  }

  page.drawText(`Certificate ID: ${certificateCode}`, { x: 60, y: 90, size: 11, font, color: cyan });
  const site = (process.env.CLIENT_ORIGIN || "").split(",")[0].trim().replace(/\/+$/, "");
  page.drawText(`Verify at ${site}/verify-certificate`, { x: 60, y: 72, size: 10, font, color: white });

  const pdfBytes = await doc.save();
  const filename = `${certificateCode}.pdf`;
  fs.writeFileSync(path.join(certDir, filename), pdfBytes);

  return filename;
}

/** Absolute path of a stored certificate PDF (older rows stored "/uploads/certificates/<file>"). */
const certificateFile = (stored) => path.join(certDir, path.basename(String(stored || "")));

function ordinal(n) {
  const num = Number(n);
  if (num === 1) return "1st";
  if (num === 2) return "2nd";
  if (num === 3) return "3rd";
  return `${num}th`;
}

module.exports = { generateCertificatePdf, certificateFile };
