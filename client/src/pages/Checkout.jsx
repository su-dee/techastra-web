import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import { Label, Input, FieldError, FieldHint } from "../components/ui/Input";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { loadDraft, clearDraft } from "../lib/registrationDraft";
import { UPI_ID } from "../lib/site";
import upiQr from "../assets/upi-qr.png";

// Same rules as the server (server/utils/validation.js).
const UPI_TXN = /^[A-Z0-9]{10,35}$/;
const MIN_PASSWORD = 8;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp"];

const normalizeTxn = (v) => v.replace(/\s+/g, "").toUpperCase();

/**
 * Payment - step 3 of 3 (events -> details -> payment), by UPI QR code.
 * The participant scans the organisers' static QR (assets/upi-qr.png, UPI ID
 * in lib/site.js), types the amount shown, then
 * submits the UPI transaction ID (UTR) and optionally a screenshot; the
 * Registration Team verifies it against the bank statement and approves.
 * Reads the draft RegisterForm.jsx left behind; without one (URL opened
 * directly, or a new tab) it sends the user back to the details form.
 */
export default function Checkout() {
  const { items, total, clearCart } = useCart();
  const navigate = useNavigate();
  const formRef = useRef(null);
  const redirected = useRef(false);

  const [draft, setDraft] = useState(null);
  const [txn, setTxn] = useState("");
  const [proof, setProof] = useState(null);
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState({});
  const [submitting, setSubmitting] = useState(false);
  const [serverError, setServerError] = useState("");
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    const d = loadDraft();
    if (!d || !items.length) {
      // Guard: StrictMode runs effects twice in development.
      if (!redirected.current) {
        redirected.current = true;
        toast("Please fill in your details first.", { id: "checkout-no-draft" });
      }
      navigate(items.length ? "/register/form" : "/events", { replace: true });
      return;
    }
    setDraft(d);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  if (!draft) return null; // redirecting, see effect above

  const needsPassword = !draft.form.password;

  function validate() {
    const e = {};
    const t = normalizeTxn(txn);
    if (!t) e.txn = "Enter the UPI transaction ID from your payment app.";
    else if (!UPI_TXN.test(t)) e.txn = "That doesn’t look like a UPI transaction ID. Use the 12-digit UTR / reference number, letters and digits only.";
    if (proof) {
      if (!PROOF_TYPES.includes(proof.type)) e.proof = "Upload a PNG, JPEG or WEBP image.";
      else if (proof.size > MAX_PROOF_BYTES) e.proof = "The screenshot must be smaller than 5 MB.";
    }
    if (needsPassword && password.length < MIN_PASSWORD) e.password = `Re-enter the password you chose (at least ${MIN_PASSWORD} characters).`;
    return e;
  }

  const copyUpiId = async () => {
    try {
      await navigator.clipboard.writeText(UPI_ID);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error("Couldn’t copy - please select the UPI ID and copy it.");
    }
  };

  const submit = async (ev) => {
    ev.preventDefault();
    setServerError("");
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }

    const { mode, form, teamName, members, consent, guardianConsent } = draft;
    const teamMembers =
      mode === "team" ? [{ name: form.name, regNo: form.registerNo, role: "lead" }, ...members] : null;
    const comboIds = [...new Set(items.filter((i) => i.isComboItem && i.comboId).map((i) => i.comboId))];

    const fd = new FormData();
    fd.append("name", form.name);
    fd.append("email", form.email);
    fd.append("phone", form.phone || "");
    fd.append("password", needsPassword ? password : form.password);
    fd.append("collegeName", form.collegeName || "");
    fd.append("registerNo", form.registerNo || "");
    fd.append("teamName", mode === "team" ? teamName : "");
    if (teamMembers) fd.append("teamMembers", JSON.stringify(teamMembers));
    fd.append("eventIds", JSON.stringify(items.map((i) => i.id)));
    fd.append("comboIds", JSON.stringify(comboIds));
    fd.append("transactionId", normalizeTxn(txn));
    fd.append("consent", String(!!consent));
    fd.append("guardianConsent", String(!!guardianConsent));
    if (proof) fd.append("paymentProof", proof);

    setSubmitting(true);
    try {
      const { registration } = await api.post("/api/registrations", fd, { isFormData: true });
      clearDraft();
      clearCart();
      toast.success(`Registration submitted - your code is ${registration.registrationCode}`);
      navigate(`/status?code=${encodeURIComponent(registration.registrationCode)}`);
    } catch (err) {
      setServerError(err.message || "Couldn’t submit your registration. Please try again.");
      requestAnimationFrame(() => document.getElementById("checkout-error")?.focus());
    } finally {
      setSubmitting(false);
    }
  };

  // Group combo items so a pass shows once, with its bundled events.
  const combos = new Map();
  const singles = [];
  for (const item of items) {
    if (item.isComboItem && item.comboId) {
      if (!combos.has(item.comboId)) combos.set(item.comboId, { name: item.comboName, price: item.comboPrice, events: [] });
      combos.get(item.comboId).events.push(item.name);
    } else singles.push(item);
  }

  const fieldProps = (id, key) => ({
    id,
    "aria-invalid": errors[key] ? "true" : undefined,
    "aria-describedby": errors[key] ? `${id}-error` : `${id}-hint`,
  });

  return (
    <div className="max-w-lg mx-auto px-6 py-14">
      <div className="page-head animate-cinematic-fade">
        <Stepper current={3} />
        <div className="kicker">Payment</div>
        <h1 className="h2">Pay by UPI</h1>
        <p className="lead">Registering as <span className="text-heading">{draft.form.name}</span> ({draft.form.email})</p>
      </div>

      <section className="card p-6 mb-5" aria-labelledby="summary-title">
        <h2 id="summary-title" className="mono-label mb-4">Order summary</h2>
        <ul className="space-y-3">
          {[...combos.entries()].map(([comboId, combo]) => (
            <li key={comboId} className="flex justify-between gap-4 border-l-2 border-amber/50 pl-3">
              <div>
                <p className="text-[15px] text-amber-pale">{combo.name}</p>
                <p className="text-[13px] text-dim mt-1">Includes {combo.events.join(", ")}</p>
              </div>
              <p className="text-[15px] text-heading tabular-nums">₹{combo.price}</p>
            </li>
          ))}
          {singles.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <p className="text-[15px] text-text">{item.name}</p>
              <p className="text-[15px] text-heading tabular-nums">₹{item.fee}</p>
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-baseline border-t border-line mt-5 pt-4">
          <p className="text-[15px] text-heading">Amount to pay</p>
          <p className="text-[26px] text-amber-light tabular-nums">₹{total}</p>
        </div>
      </section>

      <section className="card p-6 mb-5 text-center" aria-labelledby="pay-title">
        <h2 id="pay-title" className="mono-label mb-4">1 · Scan and pay ₹{total}</h2>
        <img
          src={upiQr}
          width="260"
          height="286"
          className="mx-auto rounded-[12px] bg-white"
          alt={`UPI QR code. UPI ID ${UPI_ID}`}
        />
        <p className="mt-5 text-[15px] text-text">
          Enter <span className="text-[20px] text-amber-light tabular-nums">₹{total}</span> in your UPI app - the QR doesn’t fill in the amount.
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-[15px] text-heading">
          <span className="text-soft">UPI ID</span>
          <span className="font-mono">{UPI_ID}</span>
          <button type="button" className="link-cta tap-24" onClick={copyUpiId} aria-label="Copy UPI ID">
            {copied ? "Copied" : "Copy"}
          </button>
        </p>
        <span className="sr-only" role="status">{copied ? "UPI ID copied" : ""}</span>
        <a href={upiQr} download="Techastra26-UPI-QR.png" className="btn-ghost-sm mt-5 inline-block">
          Save QR image
        </a>
        <p className="mt-4 text-[13px] text-dim">
          Scan with GPay, PhonePe, Paytm or any UPI app. On this phone? Save the QR and choose “scan from gallery” in your
          UPI app, or copy the UPI ID and pay to it.
        </p>
      </section>

      <form ref={formRef} onSubmit={submit} noValidate className="card p-6 space-y-5" aria-labelledby="confirm-title">
        <h2 id="confirm-title" className="mono-label">2 · Confirm your payment</h2>

        {serverError && (
          <div id="checkout-error" tabIndex={-1} role="alert" className="rounded-[10px] border border-danger/50 bg-danger/10 px-4 py-3 text-[14px] text-danger outline-none">
            {serverError}
          </div>
        )}

        <div>
          <Label htmlFor="pay-txn" required>UPI transaction ID (UTR)</Label>
          <Input
            {...fieldProps("pay-txn", "txn")}
            required
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            inputMode="text"
            placeholder="e.g. 426512345678"
            value={txn}
            onChange={(e) => setTxn(e.target.value)}
          />
          {errors.txn ? (
            <FieldError id="pay-txn">{errors.txn}</FieldError>
          ) : (
            <FieldHint id="pay-txn">In your UPI app, open the payment and copy the 12-digit UTR or “UPI reference number”.</FieldHint>
          )}
        </div>

        <div>
          <Label htmlFor="pay-proof">Payment screenshot (recommended)</Label>
          <input
            {...fieldProps("pay-proof", "proof")}
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-[14px] text-soft file:mr-4 file:rounded-[7px] file:border file:border-white/15 file:bg-transparent file:px-4 file:py-2 file:text-heading hover:file:border-amber/55"
            onChange={(e) => setProof(e.target.files?.[0] || null)}
          />
          {errors.proof ? (
            <FieldError id="pay-proof">{errors.proof}</FieldError>
          ) : (
            <FieldHint id="pay-proof">PNG, JPEG or WEBP, up to 5 MB. It helps the registration desk approve you faster.</FieldHint>
          )}
        </div>

        {needsPassword && (
          <div>
            <Label htmlFor="pay-password" required>Your password</Label>
            <Input
              {...fieldProps("pay-password", "password")}
              type="password"
              required
              autoComplete="new-password"
              minLength={MIN_PASSWORD}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
            />
            {errors.password ? (
              <FieldError id="pay-password">{errors.password}</FieldError>
            ) : (
              <FieldHint id="pay-password">The page was reloaded, so please re-enter the password you chose on the previous step.</FieldHint>
            )}
          </div>
        )}

        <div className="flex flex-col-reverse sm:flex-row gap-3 pt-1">
          <Link to="/register/form" className="btn-ghost-sm text-center !py-3" data-log="checkout-back-to-details">
            Back to details
          </Link>
          <Button type="submit" size="lg" className="flex-1" disabled={submitting} aria-busy={submitting || undefined}>
            {submitting ? "Submitting…" : "Submit registration"}
          </Button>
        </div>
        <p className="text-[13px] text-dim">
          The registration desk checks every payment, usually within a day. You can follow it on the status page, and
          you’ll get an email once it’s approved.
        </p>
      </form>
    </div>
  );
}
