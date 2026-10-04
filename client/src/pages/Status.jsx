import React, { useState, useEffect } from "react";
import { useSearchParams, useLocation, Link } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Badge from "../components/ui/Badge";
import { Label, Input, PasswordInput } from "../components/ui/Input";
import { api } from "../lib/api";
import { fadeUp, staggerContainer, EASE_CINEMATIC } from "../lib/motion";
import { usePanels } from "../context/PanelContext";
import { UPI_ID, upiPayLink } from "../lib/site";

/**
 * A rejected registration can be resubmitted with a corrected payment (new
 * UTR and screenshot). The password proves it's the participant's own.
 * With `firstPayment`, it's a "pay later" registration paying for the first time.
 */
function Resubmit({ code, email, amount, onDone, firstPayment = false }) {
  const [password, setPassword] = useState("");
  const [txn, setTxn] = useState("");
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const submit = async (e) => {
    e.preventDefault();
    setError("");
    if (!password || !txn.trim() || !file) return setError("Enter your password and the new UTR, and choose the payment screenshot.");
    setBusy(true);
    try {
      const fd = new FormData();
      fd.append("code", code);
      fd.append("email", email);
      fd.append("password", password);
      fd.append("transactionId", txn.trim());
      fd.append("paymentProof", file);
      const data = await api.post("/api/registrations/resubmit", fd, { isFormData: true });
      toast.success(firstPayment ? "Payment submitted - the registration desk will check it." : "Resubmitted - the registration desk will check your payment again.");
      onDone(data.registration);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} className="mt-6 space-y-4" noValidate>
      {firstPayment ? (
        <p className="text-sm text-soft">
          Pay ₹{amount} to <span className="text-heading">{UPI_ID}</span> (
          <a className="link-cta" href={upiPayLink(amount)}>
            pay with a UPI app
          </a>
          ), then enter the transaction ID (UTR) and upload the payment screenshot.
        </p>
      ) : (
        <p className="text-sm text-soft">
          Fix it and resubmit: pay ₹{amount} to <span className="text-heading">{UPI_ID}</span> if you haven’t paid the
          right amount (
          <a className="link-cta" href={upiPayLink(amount)}>
            pay with a UPI app
          </a>
          ), then enter the new transaction ID and screenshot.
        </p>
      )}
      <div>
        <Label htmlFor="rs-password" required>Your password</Label>
        <PasswordInput id="rs-password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="rs-txn" required>UPI transaction ID (UTR)</Label>
        <Input id="rs-txn" inputMode="numeric" autoComplete="off" value={txn} onChange={(e) => setTxn(e.target.value)} />
      </div>
      <div>
        <Label htmlFor="rs-proof" required>Payment screenshot</Label>
        <Input id="rs-proof" type="file" accept="image/png,image/jpeg,image/webp" onChange={(e) => setFile(e.target.files?.[0] || null)} />
      </div>
      {error && (
        <p className="text-sm text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="w-full" disabled={busy}>
        {busy ? "Submitting…" : firstPayment ? "Submit payment" : "Resubmit payment"}
      </Button>
    </form>
  );
}

/**
 * Minimal, borderless cinematic layout replacing the old boxed-Card
 * form - plain typography over the dark base, result revealed inline
 * beneath the form with a thin divider rather than a second card.
 */
export default function Status() {
  const [params] = useSearchParams();
  const [code, setCode] = useState(params.get("code") || "");
  // Right after registering, the email arrives in navigation state (never in
  // the URL), so the status shows without retyping.
  const { state } = useLocation();
  const { openPanel } = usePanels();
  const [email, setEmail] = useState(state?.email || "");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);
  const reduce = useReducedMotion();

  const check = async (e) => {
    e?.preventDefault();
    if (!code.trim() || !email.trim()) return toast.error("Enter your registration code and the email you registered with");
    setLoading(true);
    setResult(null);
    try {
      const data = await api.get(
        `/api/registrations/status?code=${encodeURIComponent(code.trim())}&email=${encodeURIComponent(email.trim())}`
      );
      setResult(data);
    } catch (err) {
      toast.error(err.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (params.get("code") && state?.email) check();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="max-w-md mx-auto px-6 py-20">
      <motion.div
        className="text-center mb-12"
        initial={reduce ? false : { opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.6, ease: EASE_CINEMATIC }}
      >
        <p className="kicker">Registration status</p>
        <h1 className="h2">Check your registration</h1>
        <p className="lead mt-3">Enter your registration code and the email you registered with.</p>
      </motion.div>

      {/* Form fields cascade in with a light stagger */}
      <motion.form
        onSubmit={check}
        className="space-y-5"
        variants={staggerContainer}
        initial={reduce ? false : "hidden"}
        animate="show"
      >
        <motion.div variants={fadeUp}>
          <Label htmlFor="code">Registration Code</Label>
          <Input id="code" placeholder="SYM2026-0042" autoComplete="off" spellCheck={false} value={code} onChange={(e) => setCode(e.target.value)} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" inputMode="email" placeholder="you@example.com" value={email} onChange={(e) => setEmail(e.target.value)} />
        </motion.div>
        <motion.div variants={fadeUp}>
          <Button type="submit" size="lg" className="w-full" disabled={loading}>
            {loading ? "Checking…" : "Check status"}
          </Button>
          <p className="text-center text-[13px] text-dim mt-4">
            Lost your registration code?{" "}
            <button type="button" className="link-cta" onClick={() => openPanel("help")}>
              Ask the Help Desk
            </button>
          </p>
        </motion.div>
      </motion.form>

      {/* Result reveals/dismisses smoothly as it arrives or is replaced */}
      <div role="status" aria-live="polite">
      <AnimatePresence mode="wait">
        {result && (
          <motion.div
            key={result.registrationCode}
            className="mt-12 pt-8 border-t border-crimson/15"
            initial={reduce ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduce ? undefined : { opacity: 0, y: -8 }}
            transition={{ duration: 0.45, ease: EASE_CINEMATIC }}
          >
            <div className="flex items-center justify-between mb-4">
              <span className="font-heading text-lg text-offwhite">{result.registrationCode}</span>
              <Badge status={result.status}>{result.paymentDue ? "Payment due" : result.status}</Badge>
            </div>
            <p className="text-sm text-soft">
              {result.paymentDue || (result.status === "rejected" && result.paymentMethod === "later") ? "Amount due" : "Total paid"}: ₹{result.totalAmount}
            </p>
            {result.status === "rejected" && (
              <>
                {result.rejectionReason && <p className="text-sm text-danger mt-3">Reason: {result.rejectionReason}</p>}
                <p className="text-sm text-soft mt-3">
                  Think this is a mistake?{" "}
                  <button type="button" className="link-cta" onClick={() => openPanel("help")}>
                    Ask the Help Desk
                  </button>
                </p>
                {result.totalAmount > 0 && (
                  <Resubmit
                    code={result.registrationCode}
                    email={email.trim()}
                    amount={result.totalAmount}
                    onDone={(r) => setResult((prev) => ({ ...prev, ...r, rejectionReason: null }))}
                  />
                )}
              </>
            )}
            {result.status === "pending" && result.paymentDue && (
              <>
                <div className="mt-4 rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-sm text-text">
                  <p className="font-semibold text-heading">
                    Seat blocked until your first event starts
                    {result.payBy && (
                      <>
                        {" "}(
                        {new Date(result.payBy)
                          .toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
                          .replace(/\b(am|pm)\b/, (m) => m.toUpperCase())}
                        )
                      </>
                    )}
                  </p>
                  <p className="mt-1">
                    Your registration isn’t complete until you pay. Pay online below, or in cash at the registration desk,
                    before then - an unpaid seat is released when the event starts. Your ID card with its QR code is issued
                    once your payment is approved.
                  </p>
                </div>
                <Resubmit
                  firstPayment
                  code={result.registrationCode}
                  email={email.trim()}
                  amount={result.totalAmount}
                  onDone={(r) => setResult((prev) => ({ ...prev, ...r, paymentDue: false, paymentMethod: "upi" }))}
                />
              </>
            )}
            {result.status === "pending" && !result.paymentDue && (
              <p className="text-sm text-soft mt-3">The registration desk is checking your payment. You’ll get an email once it’s approved.</p>
            )}
            {result.status === "approved" && (
              <div className="mt-6">
                <Link to="/login">
                  <Button className="w-full">Sign in to get your ID card</Button>
                </Link>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
      </div>
    </div>
  );
}
