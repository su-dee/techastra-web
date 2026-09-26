const express = require("express");
const { buildUpiLink, generateQrDataUrl } = require("../utils/qr");

const router = express.Router();

/**
 * GET /api/upi/qr?amount=250&note=SYM2026-0042
 * Returns a base64 PNG data URL of the UPI payment QR, prefilled with the
 * amount and a reference note (typically the registration code).
 */
router.get("/qr", async (req, res) => {
  try {
    const amount = Number(req.query.amount);
    if (!Number.isFinite(amount) || amount <= 0 || amount > 100000) {
      return res.status(400).json({ error: "A valid amount is required" });
    }
    // Payment note shown in the payer's UPI app: plain text, short.
    const note = String(req.query.note || "").replace(/[^A-Za-z0-9 .'-]/g, "").slice(0, 50).trim();

    const link = buildUpiLink({
      payeeId: process.env.UPI_PAYEE_ID || "college@upi",
      payeeName: process.env.UPI_PAYEE_NAME || "TechAstra Symposium",
      amount: amount.toFixed(2),
      note: note || "TechAstra Registration",
    });

    const qrDataUrl = await generateQrDataUrl(link);
    res.json({ upiLink: link, qrDataUrl, payeeId: process.env.UPI_PAYEE_ID || "college@upi", payeeName: process.env.UPI_PAYEE_NAME || "TechAstra Symposium", amount });
  } catch (err) {
    console.error("UPI QR error:", err);
    res.status(500).json({ error: "Failed to generate payment QR" });
  }
});

module.exports = router;
