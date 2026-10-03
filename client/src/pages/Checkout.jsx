import React, { useState, useEffect, useRef } from "react";
import { Link, useNavigate } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import { Label, Input, FieldError, FieldHint } from "../components/ui/Input";
import { api } from "../lib/api";
import { useCart } from "../context/CartContext";
import { loadDraft, clearDraft } from "../lib/registrationDraft";
import { QRCodeCanvas } from "qrcode.react";
import { UPI_ID, upiPayLink, registrationClosed } from "../lib/site";
import { formatFee } from "../components/EventInfo";
import { computeTotal } from "../lib/pricing";

// Same rules as the server (server/utils/validation.js).
const UPI_TXN = /^[A-Z0-9]{10,35}$/;
const MIN_PASSWORD = 8;
const MAX_PROOF_BYTES = 5 * 1024 * 1024;
const PROOF_TYPES = ["image/png", "image/jpeg", "image/webp"];

const normalizeTxn = (v) => v.replace(/\s+/g, "").toUpperCase();
const UPI_OPENED = "techastra_upi_app_opened";

/**
 * Payment - step 3 of 3 (events -> details -> payment), by UPI.
 * The QR (and, on phones, a "Pay with UPI app" button) is generated here from
 * the cart total, so the UPI app opens with the exact amount already filled in
 * (upiPayLink in lib/site.js). The participant then
 * submits the UPI transaction ID (UTR) and optionally a screenshot; the
 * Registration Team verifies it against the bank statement and approves.
 * Reads the draft RegisterForm.jsx left behind; without one (URL opened
 * directly, or a new tab) it sends the user back to the details form.
 */
export default function Checkout() {
  const { items, clearCart } = useCart();
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
  // "Pay later": block the seats now, pay before the first event starts
  // (online from the status page, or cash at the desk).
  const [payMode, setPayMode] = useState("now"); // "now" | "later"
  const qrRef = useRef(null);
  // UPI apps never send people back to the website, so when someone returns to
  // this tab after tapping "Pay with UPI app" we take them straight to the UTR
  // box. The flag lives in sessionStorage too, in case the phone reloads the
  // tab while they're in the UPI app.
  const [backFromApp, setBackFromApp] = useState(false);
  const leftForApp = useRef(false);
  useEffect(() => {
    const goToUtr = () => {
      setBackFromApp(true);
      setTimeout(() => {
        const el = document.getElementById("pay-txn");
        el?.scrollIntoView({ block: "center", behavior: "smooth" });
        el?.focus({ preventScroll: true });
      }, 150);
    };
    let reloaded = false;
    try {
      reloaded = sessionStorage.getItem(UPI_OPENED) === "1";
    } catch {
      /* storage blocked */
    }
    if (reloaded && draft) goToUtr();
    const onVisible = () => {
      if (document.visibilityState === "visible" && leftForApp.current) {
        leftForApp.current = false;
        goToUtr();
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, [draft]);
  // Phones/tablets get a one-tap "Pay with UPI app" button (upi:// links do
  // nothing on desktop, where the QR is scanned with a phone instead).
  const [onPhone] = useState(
    () => window.matchMedia?.("(pointer: coarse)").matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent)
  );

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

  // The cart keeps copies of the events from when they were added, so check
  // the current start times before showing the QR: an event that has started
  // since can't be registered (the server refuses it too).
  const [startedIds, setStartedIds] = useState(null);
  useEffect(() => {
    api
      .get("/api/events")
      .then((data) => setStartedIds(new Set((data.events || []).filter(registrationClosed).map((e) => e.id))))
      .catch(() => setStartedIds(new Set()));
  }, []);

  if (!draft || !startedIds) return null; // redirecting / checking, see effects above

  const needsPassword = !draft.form.password;
  // Fees are per person: the exact amount uses the team from the details
  // form (the server recalculates it the same way).
  const teamSize = draft.mode === "team" ? 1 + (draft.members?.length || 0) : 1;
  const total = computeTotal(items, teamSize);
  const times = (unit, n) => (n > 1 ? `₹${unit} × ${n} = ₹${unit * n}` : `₹${unit}`);
  // Junior events are free: no payment step, the registration just collects
  // the student's details and is confirmed straight away.
  const free = total === 0;
  // The seat is held until the earliest event in the cart starts (the server
  // releases it then if it's still unpaid).
  const firstStart = items.length ? new Date(Math.min(...items.map((i) => new Date(i.startTime).getTime()))) : null;
  const holdUntil = firstStart
    ? firstStart
        .toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" })
        .replace(/\b(am|pm)\b/, (m) => m.toUpperCase())
    : "";
  const canPayLater = !free && !!firstStart;
  const later = canPayLater && payMode === "later";

  function validate() {
    const e = {};
    if (!free && !later) {
      const t = normalizeTxn(txn);
      if (!t) e.txn = "Enter the UPI transaction ID from your payment app.";
      else if (!UPI_TXN.test(t)) e.txn = "That doesn’t look like a UPI transaction ID. Use the 12-digit UTR / reference number, letters and digits only.";
      if (!proof) e.proof = "Upload a screenshot of your payment’s success screen.";
      else {
        if (!PROOF_TYPES.includes(proof.type)) e.proof = "Upload a PNG, JPEG or WEBP image.";
        else if (proof.size > MAX_PROOF_BYTES) e.proof = "The screenshot must be smaller than 5 MB.";
      }
    }
    if (needsPassword && password.length < MIN_PASSWORD) e.password = `Re-enter the password you chose (at least ${MIN_PASSWORD} characters).`;
    return e;
  }

  const payLink = upiPayLink(total);

  // Save the generated QR (with the amount in it) as a PNG.
  const saveQr = () => {
    const canvas = qrRef.current?.querySelector("canvas");
    if (!canvas) return;
    const a = document.createElement("a");
    a.href = canvas.toDataURL("image/png");
    a.download = `Techastra26-UPI-Rs${total}.png`;
    a.click();
  };

  const openUpiApp = () => {
    leftForApp.current = true;
    try {
      sessionStorage.setItem(UPI_OPENED, "1");
    } catch {
      /* storage blocked - the visibility check still works */
    }
  };

  // Most UPI apps have a copy button for the UTR - one tap to paste it here.
  const canPaste = typeof navigator !== "undefined" && !!navigator.clipboard?.readText;
  const pasteUtr = async () => {
    try {
      const text = (await navigator.clipboard.readText()).trim();
      if (!text) return toast("Nothing to paste - copy the UTR in your UPI app first.");
      setTxn(text);
      document.getElementById("pay-txn")?.focus();
    } catch {
      toast("Couldn’t read the clipboard - long-press the box and choose Paste.");
    }
  };

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
    fd.append("course", form.course || "");
    fd.append("department", form.department || "");
    fd.append("yearOfStudy", form.yearOfStudy || "");
    fd.append("teamName", mode === "team" ? teamName : "");
    if (teamMembers) fd.append("teamMembers", JSON.stringify(teamMembers));
    fd.append("eventIds", JSON.stringify(items.map((i) => i.id)));
    fd.append("comboIds", JSON.stringify(comboIds));
    if (later) fd.append("payLater", "true");
    else if (!free) fd.append("transactionId", normalizeTxn(txn));
    fd.append("consent", String(!!consent));
    fd.append("guardianConsent", String(!!guardianConsent));
    if (!free && !later && proof) fd.append("paymentProof", proof);

    setSubmitting(true);
    try {
      const { registration } = await api.post("/api/registrations", fd, { isFormData: true });
      clearDraft();
      try {
        sessionStorage.removeItem(UPI_OPENED);
      } catch {
        /* ignore */
      }
      clearCart();
      toast.success(
        free
          ? `You’re registered - your code is ${registration.registrationCode}`
          : later
          ? `Seat blocked - your code is ${registration.registrationCode}. Pay before ${holdUntil}.`
          : `Registration submitted - your code is ${registration.registrationCode}`
      );
      // Email travels in navigation state, not the URL (no personal data in URLs).
      navigate(`/status?code=${encodeURIComponent(registration.registrationCode)}`, { state: { email: form.email } });
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

  // An event in the saved cart may have started since it was added: stop here,
  // before the QR, so nobody pays for a registration the server would refuse.
  const closedItem = items.find((i) => registrationClosed(i) || startedIds.has(i.id));
  if (closedItem) {
    return (
      <div className="max-w-lg mx-auto px-6 pt-6 pb-14 sm:py-14 text-center">
        <div className="kicker">Registration closed</div>
        <h1 className="h2">{closedItem.name} has already started</h1>
        <p className="lead mt-3">
          Online registration for an event closes when it starts. Remove it from your cart{closedItem.isComboItem ? ` (with ${closedItem.comboName})` : ""} to
          continue - please don’t pay for it.
        </p>
        <Link to="/cart" className="btn-small inline-block mt-6">Go to your cart</Link>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto px-6 pt-6 pb-14 sm:py-14">
      <div className="page-head animate-cinematic-fade">
        <Stepper current={3} />
        <div className="kicker">{free ? "Confirm" : "Payment"}</div>
        <h1 className="h2">{free ? "Confirm your registration" : later ? "Block your seat" : "Pay by UPI"}</h1>
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
              <p className="text-[15px] text-heading tabular-nums text-right">{times(combo.price, teamSize)}</p>
            </li>
          ))}
          {singles.map((item) => (
            <li key={item.id} className="flex justify-between gap-4">
              <div>
                <p className="text-[15px] text-text">{item.name}</p>
                {!item.isTeamEvent && teamSize > 1 && (
                  <p className="text-[13px] text-dim mt-0.5">Individual event - each of the {teamSize} members takes part</p>
                )}
              </div>
              <p className="text-[15px] text-heading tabular-nums text-right">
                {!item.fee ? "Free" : item.feePerTeam ? `₹${item.fee} per team` : times(item.fee, teamSize)}
              </p>
            </li>
          ))}
        </ul>
        <div className="flex justify-between items-baseline border-t border-line mt-5 pt-4">
          <p className="text-[15px] text-heading">{free ? "Registration fee" : "Amount to pay"}</p>
          <p className="text-[26px] text-amber-light tabular-nums">{formatFee(total)}</p>
        </div>
      </section>

      {canPayLater && (
        <fieldset className="card p-6 mb-5">
          <legend className="sr-only">When do you want to pay?</legend>
          <p className="mono-label mb-3" aria-hidden="true">When do you want to pay?</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {[
              ["now", "Pay now", "Pay by UPI and upload the screenshot. The desk approves it, then you get your ID card."],
              ["later", "Pay later - block my seat", `Your seat is held until your first event starts (${holdUntil}). Pay online or in cash at the desk before then.`],
            ].map(([value, title, text]) => (
              <label
                key={value}
                className={`block cursor-pointer rounded-[10px] border px-4 py-3 ${payMode === value ? "border-amber/70 bg-amber/10" : "border-shade/15 hover:border-amber/40"}`}
              >
                <span className="flex items-center gap-2">
                  <input
                    type="radio"
                    name="pay-mode"
                    value={value}
                    checked={payMode === value}
                    onChange={() => {
                      setPayMode(value);
                      setErrors({});
                    }}
                  />
                  <span className="text-[15px] text-heading">{title}</span>
                </span>
                <span className="block mt-1 text-[13px] text-dim">{text}</span>
              </label>
            ))}
          </div>
          {later && (
            <p role="status" className="mt-4 rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-[14px] text-text">
              <strong className="font-semibold text-heading">Your registration isn’t complete until you pay.</strong> Your
              ID card with its QR code is issued only after your payment of ₹{total} is approved. Unpaid seats are released
              when the event starts ({holdUntil}).
            </p>
          )}
        </fieldset>
      )}

      {!free && !later && (
      <section className="card p-6 mb-5 text-center" aria-labelledby="pay-title">
        <h2 id="pay-title" className="mono-label mb-4">1 · Pay ₹{total}</h2>

        {onPhone && (
          <>
            <a href={payLink} onClick={openUpiApp} className="btn-small w-full !py-3.5 !text-[15px] text-center" data-log="checkout-pay-upi-app">
              Pay ₹{total} with UPI app
            </a>
            <p className="mt-2 text-[13px] text-dim">
              Opens GPay, PhonePe, Paytm or your bank’s UPI app with ₹{total} already filled in.{" "}
              <span className="text-soft">
                After paying, <strong className="font-semibold text-heading">take a screenshot of the success screen</strong> and
                copy the UTR, then come back to this page.
              </span>
            </p>
            <p className="mt-5 mb-4 text-[11px] uppercase tracking-wider text-dim">— or scan from another phone —</p>
          </>
        )}

        <div
          ref={qrRef}
          className="mx-auto w-fit overflow-hidden rounded-[12px] bg-white"
          role="img"
          aria-label={`UPI QR code for ₹${total} to ${UPI_ID}`}
          data-upi-link={payLink}
        >
          {/* includeMargin: the white quiet zone scanners need, also in the saved PNG */}
          <QRCodeCanvas value={payLink} size={256} level="M" includeMargin />
        </div>
        <p className="mt-5 text-[15px] text-text">
          Scan with any UPI app - <span className="text-[20px] text-amber-light tabular-nums">₹{total}</span> is filled in
          automatically.
        </p>
        <p className="mt-2 text-[13px] text-dim">
          After paying, take a screenshot of the success screen - you’ll upload it with the UTR below.
        </p>
        <p className="mt-3 flex items-center justify-center gap-2 text-[15px] text-heading flex-wrap">
          <span className="text-soft">Can’t scan? Pay ₹{total} to</span>
          <span className="font-mono">{UPI_ID}</span>
          <button type="button" className="link-cta tap-24" onClick={copyUpiId} aria-label="Copy UPI ID">
            {copied ? "Copied" : "Copy"}
          </button>
        </p>
        <span className="sr-only" role="status">{copied ? "UPI ID copied" : ""}</span>
        <button type="button" onClick={saveQr} className="btn-ghost-sm mt-5 inline-block">
          Save QR image
        </button>
      </section>
      )}

      <form ref={formRef} onSubmit={submit} noValidate className="card p-6 space-y-5" aria-labelledby="confirm-title">
        <h2 id="confirm-title" className="mono-label">{free || later ? "Confirm your registration" : "2 · Confirm your payment"}</h2>
        {free && (
          <p className="text-[15px] text-text">
            Junior Techastra events are free. Check your details, then complete your registration - there’s nothing to pay.
          </p>
        )}

        {serverError && (
          <div id="checkout-error" tabIndex={-1} role="alert" className="rounded-[10px] border border-danger/50 bg-danger/10 px-4 py-3 text-[14px] text-danger outline-none">
            {serverError}
          </div>
        )}

        {!free && !later && (
        <>
        {backFromApp && (
          <p role="status" className="rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-[14px] text-text">
            <strong className="font-semibold text-heading">Welcome back!</strong> Paid? Paste your UTR - the 12-digit
            reference in your UPI app’s payment details - and upload the success screenshot below.
          </p>
        )}
        <div>
          <Label htmlFor="pay-txn" required>UPI transaction ID (UTR)</Label>
          <div className="flex gap-2">
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
            {canPaste && (
              <Button type="button" variant="outline" onClick={pasteUtr} className="shrink-0" aria-label="Paste UTR from clipboard">
                Paste
              </Button>
            )}
          </div>
          {errors.txn ? (
            <FieldError id="pay-txn">{errors.txn}</FieldError>
          ) : (
            <FieldHint id="pay-txn">In your UPI app, open the payment and copy the 12-digit UTR or “UPI reference number”.</FieldHint>
          )}
        </div>

        <div>
          <Label htmlFor="pay-proof" required>Payment screenshot</Label>
          <input
            {...fieldProps("pay-proof", "proof")}
            required
            type="file"
            accept="image/png,image/jpeg,image/webp"
            className="block w-full text-[14px] text-soft file:mr-4 file:rounded-[7px] file:border file:border-shade/15 file:bg-transparent file:px-4 file:py-2 file:text-heading hover:file:border-amber/55"
            onChange={(e) => setProof(e.target.files?.[0] || null)}
          />
          {errors.proof ? (
            <FieldError id="pay-proof">{errors.proof}</FieldError>
          ) : (
            <FieldHint id="pay-proof">
              A screenshot of the payment’s success screen, showing the amount and UTR. PNG, JPEG or WEBP, up to 5 MB.
            </FieldHint>
          )}
        </div>
        </>
        )}

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
            {submitting ? "Submitting…" : free ? "Complete registration" : later ? "Block my seat" : "Submit registration"}
          </Button>
        </div>
        <p className="text-[13px] text-dim">
          {free
            ? "Your registration is confirmed straight away, and you’ll get an email with your registration code and events."
            : later
            ? `You’ll get an email with your registration code and how to pay. Pay ₹${total} before ${holdUntil} on the status page or at the registration desk.`
            : "The registration desk checks every payment, usually within a day. You can follow it on the status page, and you’ll get an email once it’s approved."}
        </p>
      </form>
    </div>
  );
}
