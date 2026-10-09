const test = require("node:test");
const assert = require("node:assert/strict");
const { paymentKind, collections } = require("../utils/collections");

const at = (min) => new Date(Date.UTC(2026, 9, 8, 4, min));
const reg = (o) => ({ status: "approved", totalAmount: 300, onSpot: false, createdAt: at(0), reviewedAt: at(0), ...o });

test("payments are split into online, on spot and pay later", () => {
  assert.equal(paymentKind(reg({ paymentMethod: "upi", reviewedAt: at(30) })), "online");
  assert.equal(paymentKind(reg({ paymentMethod: "cash", onSpot: true })), "onSpot"); // desk cash form
  assert.equal(paymentKind(reg({ paymentMethod: "cash", onSpot: true, reviewedAt: at(45) })), "onSpot"); // on-spot QR, paid at the desk
  assert.equal(paymentKind(reg({ paymentMethod: "cash", reviewedAt: at(1) })), "payLater"); // website, chose pay later, paid at the desk
  assert.equal(paymentKind(reg({ status: "pending", paymentMethod: "later" })), "due");
  assert.equal(paymentKind(reg({ status: "rejected", paymentMethod: "upi" })), null);
  assert.equal(paymentKind(reg({ paymentMethod: "free", totalAmount: 0 })), null);
});

test("collections add up per kind and in total", () => {
  const c = collections([
    reg({ paymentMethod: "upi", totalAmount: 200 }),
    reg({ paymentMethod: "upi", totalAmount: 100 }),
    reg({ paymentMethod: "cash", onSpot: true, totalAmount: 300 }),
    reg({ paymentMethod: "cash", totalAmount: 50, reviewedAt: at(120) }),
    reg({ status: "pending", paymentMethod: "later", totalAmount: 600 }),
  ]);
  assert.deepEqual(c.online, { amount: 300, count: 2 });
  assert.deepEqual(c.onSpot, { amount: 300, count: 1 });
  assert.deepEqual(c.payLater, { amount: 50, count: 1 });
  assert.deepEqual(c.due, { amount: 600, count: 1 });
  assert.deepEqual(c.total, { amount: 650, count: 4 });
});
