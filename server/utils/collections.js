/**
 * Money collected, for the registration desk: approved registrations only,
 * split by how they paid.
 * - online:   UPI (screenshot checked by the desk) or Razorpay
 * - onSpot:   cash from walk-ups - the desk's cash form and the on-spot QR
 *             both mark the registration onSpot (routes/registrations.js)
 * - payLater: a website registration paid in cash - only "pay later" ones
 *             can be (the desk's "collect cash")
 * A pay-later registration that later paid online is stored as UPI, so it
 * counts as online. Unpaid pay-later holds are `due`, not collected.
 */
function paymentKind(reg) {
  if (reg.status === "pending" && reg.paymentMethod === "later") return "due";
  if (reg.status !== "approved" || !(reg.totalAmount > 0)) return null;
  if (reg.paymentMethod === "upi" || reg.paymentMethod === "razorpay") return "online";
  if (reg.paymentMethod === "cash") return reg.onSpot ? "onSpot" : "payLater";
  return null;
}

function collections(registrations) {
  const sum = () => ({ amount: 0, count: 0 });
  const out = { online: sum(), onSpot: sum(), payLater: sum(), due: sum() };
  for (const reg of registrations) {
    const kind = paymentKind(reg);
    if (!kind) continue;
    out[kind].amount += reg.totalAmount;
    out[kind].count++;
  }
  out.total = {
    amount: out.online.amount + out.onSpot.amount + out.payLater.amount,
    count: out.online.count + out.onSpot.count + out.payLater.count,
  };
  return out;
}

module.exports = { paymentKind, collections };
