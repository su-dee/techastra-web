import React, { useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Copy,
  Download,
  ImageUp,
  LoaderCircle,
  Printer,
  ShieldCheck,
  X,
} from "lucide-react";
import { api } from "./api.js";
import { useQr } from "./useQr.js";
import {
  ParticipantIDCard,
  QR_OPTIONS,
  readTokens,
  renderIDCard,
} from "./ParticipantIDCard.jsx";
import "./payment.css";
import { to } from "./base.js";

const domainLabels = {
  "HN-AI": "AI & ML",
  "HN-CS": "Cybersecurity & Web3",
  "HN-FT": "FinTech",
  "HN-X": "Cross-Domain",
};
const MAX_UPLOAD = 5 * 1024 * 1024;
const rupees = (n) => `₹${Number(n).toLocaleString("en-IN")}`;

function Brand() {
  return (
    <a className="brand" href={to("/")} aria-label="Hack Nexus home">
      <span className="brand-symbol">
        N<span>↗</span>
      </span>
      <span>
        HACK<span className="brand-underscore">_</span>NEXUS
        <small>1.0 / CSE INNOVATION ALLIANCE</small>
      </span>
    </a>
  );
}

function PageShell({ children }) {
  return (
    <div className="pay-page">
      <div className="container policy-nav">
        <Brand />
        <a href={to("/#register")}>← Back to registration</a>
      </div>
      <main className="container pay-main">{children}</main>
    </div>
  );
}

// Re-encode on a canvas: shrinks large phone screenshots and strips metadata.
async function prepareScreenshot(file) {
  if (!/^image\/(png|jpeg|webp)$/.test(file.type))
    throw new Error("Choose a PNG, JPEG, or WebP screenshot.");
  if (file.size > 20 * 1024 * 1024)
    throw new Error("That image is too large. Choose a screenshot.");
  let bitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("This image could not be read. Try another screenshot.");
  }
  const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  const ctx = canvas.getContext("2d");
  ctx.fillStyle = "#fff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  for (const quality of [0.9, 0.75, 0.6]) {
    const url = canvas.toDataURL("image/jpeg", quality);
    if (url.length * 0.75 < MAX_UPLOAD) return url;
  }
  throw new Error("This screenshot is too large. Crop it and try again.");
}

function redirectToLogin(next) {
  location.href = to(`/login?next=${next}`);
}

function PaymentQr({ upi, fee }) {
  const qr = useQr(upi.uri);
  const [copied, setCopied] = useState(false);
  const touch = matchMedia("(pointer: coarse)").matches;
  async function copy() {
    try {
      await navigator.clipboard.writeText(upi.vpa);
      setCopied(true);
      setTimeout(() => setCopied(false), 1800);
    } catch {}
  }
  return (
    <section className="pay-card qr-panel" aria-labelledby="pay-step-1">
      <span className="pay-step">STEP 01</span>
      <h2 id="pay-step-1">Scan and pay {rupees(fee)}</h2>
      <p className="pay-muted">
        Scan with PhonePe, Google Pay, Paytm, or any UPI app. The amount is
        filled in for you.
      </p>
      <div className="qr-card">
        <div className="qr-amount">
          <span>AMOUNT</span>
          <strong>{rupees(fee)}</strong>
        </div>
        <div className="qr-image">
          {qr ? (
            <img src={qr} alt={`UPI QR code to pay ${rupees(fee)}`} />
          ) : (
            <LoaderCircle className="spin" />
          )}
        </div>
        <div className="qr-payee">
          <strong>{upi.payee}</strong>
          <span>{upi.vpa}</span>
        </div>
      </div>
      <dl className="pay-facts">
        <div>
          <dt>Payment note</dt>
          <dd>HACK_NEXUS {upi.reference}</dd>
        </div>
        <div>
          <dt>UPI ID</dt>
          <dd>
            {upi.vpa}
            <button type="button" onClick={copy} className="copy-button">
              {copied ? <Check size={14} /> : <Copy size={14} />}
              {copied ? "Copied" : "Copy"}
            </button>
          </dd>
        </div>
      </dl>
      {touch && (
        <a className="button primary pay-app-button" href={upi.uri}>
          Open UPI app to pay {rupees(fee)} <ArrowUpRight size={18} />
        </a>
      )}
      <p className="pay-hint">
        Pay exactly {rupees(fee)} once per team. If you type the UPI ID
        manually, add <strong>{upi.reference}</strong> to the payment note.
      </p>
    </section>
  );
}

function ProofForm({ fee, rejected, onSubmitted }) {
  const [screenshot, setScreenshot] = useState("");
  const [fileName, setFileName] = useState("");
  const [preparing, setPreparing] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const input = useRef(null);
  async function choose(file) {
    if (!file) return;
    setError("");
    setPreparing(true);
    try {
      setScreenshot(await prepareScreenshot(file));
      setFileName(file.name);
    } catch (e) {
      setScreenshot("");
      setFileName("");
      setError(e.message);
    } finally {
      setPreparing(false);
    }
  }
  async function submit(e) {
    e.preventDefault();
    if (!screenshot) {
      setError("Attach your payment screenshot.");
      return;
    }
    setBusy(true);
    setError("");
    const form = new FormData(e.target);
    try {
      const data = await api("/payments", {
        method: "POST",
        body: { transactionId: form.get("transactionId"), screenshot },
      });
      onSubmitted(data.payment);
    } catch (e) {
      if (e.status === 401) return redirectToLogin("payment");
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <section className="pay-card" aria-labelledby="pay-step-2">
      <span className="pay-step">STEP 02</span>
      <h2 id="pay-step-2">Share your payment proof</h2>
      {rejected ? (
        <div className="pay-alert" role="alert">
          <strong>Your previous payment could not be verified.</strong>
          <span>{rejected}</span>
          <span>Check the details and submit again.</span>
        </div>
      ) : (
        <p className="pay-muted">
          After paying {rupees(fee)}, upload the success screen and enter the
          UPI transaction ID.
        </p>
      )}
      <form onSubmit={submit}>
        <fieldset disabled={busy}>
          <div
            className={`drop-zone ${screenshot ? "has-file" : ""}`}
            onDragOver={(e) => e.preventDefault()}
            onDrop={(e) => {
              e.preventDefault();
              choose(e.dataTransfer.files[0]);
            }}
          >
            {screenshot ? (
              <div className="drop-preview">
                <img src={screenshot} alt="Selected payment screenshot" />
                <div>
                  <strong>{fileName}</strong>
                  <button
                    type="button"
                    className="copy-button"
                    onClick={() => {
                      setScreenshot("");
                      setFileName("");
                      input.current.value = "";
                    }}
                  >
                    <X size={14} /> Remove
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                className="drop-button"
                onClick={() => input.current.click()}
              >
                {preparing ? (
                  <LoaderCircle className="spin" />
                ) : (
                  <ImageUp size={26} />
                )}
                <strong>
                  {preparing ? "Preparing image…" : "Attach payment screenshot"}
                </strong>
                <span>PNG, JPEG, or WebP · tap to choose or drop here</span>
              </button>
            )}
            <input
              ref={input}
              type="file"
              accept="image/png,image/jpeg,image/webp"
              onChange={(e) => choose(e.target.files[0])}
              aria-label="Payment screenshot"
              hidden
            />
          </div>
          <label>
            UPI transaction ID <span>*</span>
            <input
              name="transactionId"
              required
              minLength={8}
              maxLength={40}
              autoComplete="off"
              spellCheck={false}
              placeholder="e.g. 512345678901"
            />
            <small>
              Shown as UPI Ref No., UTR, or Transaction ID on your payment
              receipt.
            </small>
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary submit-button" disabled={preparing}>
            {busy ? "Submitting…" : "Submit payment proof"}
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <ArrowUpRight size={18} />
            )}
          </button>
          <p className="form-footnote">
            <ShieldCheck size={13} /> Only organizers can see your screenshot.
          </p>
        </fieldset>
      </form>
    </section>
  );
}

function PaymentStatus({ payment, registration }) {
  const verified = payment.status === "verified";
  return (
    <section className="pay-card pay-status" role="status">
      <span className={`success-icon ${verified ? "" : "pending"}`}>
        {verified ? <ShieldCheck size={30} /> : <Check size={30} />}
      </span>
      <span className="pay-step">
        {verified ? "PAYMENT VERIFIED" : "PAYMENT SUBMITTED"}
      </span>
      <h2>
        {verified
          ? "You’re confirmed."
          : "Thank you! We’ve received your payment proof."}
      </h2>
      <p className="pay-muted">
        {verified
          ? `${registration.team_name} is approved for HACK_NEXUS 1.0. Your squad ID card is ready.`
          : `Organizers will check it against the transaction. Your ID card appears here once ${registration.team_name}'s payment is verified.`}
      </p>
      <dl className="pay-facts">
        <div>
          <dt>Amount</dt>
          <dd>{rupees(payment.amount)}</dd>
        </div>
        <div>
          <dt>Transaction ID</dt>
          <dd>{payment.transaction_id}</dd>
        </div>
        <div>
          <dt>Status</dt>
          <dd>{verified ? "Verified" : "Awaiting verification"}</dd>
        </div>
      </dl>
      {verified ? (
        <a className="button primary" href={to("/pass")}>
          View squad ID card <ArrowUpRight size={18} />
        </a>
      ) : (
        <a className="button ghost" href={to("/#register")}>
          Back to the arena <ArrowUpRight size={18} />
        </a>
      )}
    </section>
  );
}

export function PaymentPage() {
  const [data, setData] = useState(null);
  const [error, setError] = useState("");
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    document.title = "Payment — HACK_NEXUS 1.0";
    api("/payments/me")
      .then(setData)
      .catch((e) => {
        if (e.status === 401) redirectToLogin("payment");
        else if (e.status === 404) setMissing(true);
        else setError(e.message);
      });
  }, []);
  // While organizers review the payment, check back so the page updates
  // without a manual refresh once it is verified or rejected.
  const awaiting = data?.payment?.status === "submitted";
  useEffect(() => {
    if (!awaiting) return;
    const refresh = () => {
      if (document.visibilityState === "visible")
        api("/payments/me")
          .then(setData)
          .catch(() => {});
    };
    const timer = setInterval(refresh, 15000);
    document.addEventListener("visibilitychange", refresh);
    return () => {
      clearInterval(timer);
      document.removeEventListener("visibilitychange", refresh);
    };
  }, [awaiting]);
  let body;
  if (missing)
    body = (
      <section className="pay-card pay-status">
        <h2>Register your squad first.</h2>
        <p className="pay-muted">
          The payment page opens after your squad registration is saved.
        </p>
        <a className="button primary" href={to("/#register")}>
          Go to registration <ArrowUpRight size={18} />
        </a>
      </section>
    );
  else if (error)
    body = (
      <p className="form-error" role="alert">
        {error}
      </p>
    );
  else if (!data)
    body = (
      <p className="pay-loading">
        <LoaderCircle className="spin" size={18} /> Loading payment details…
      </p>
    );
  else if (data.payment && data.payment.status !== "rejected")
    body = (
      <PaymentStatus payment={data.payment} registration={data.registration} />
    );
  else
    body = (
      <div className="pay-grid">
        <PaymentQr upi={data.upi} fee={data.fee} />
        <ProofForm
          fee={data.fee}
          rejected={data.payment?.rejection_reason}
          onSubmitted={(payment) => {
            setData((d) => ({ ...d, payment }));
            scrollTo({ top: 0 });
          }}
        />
      </div>
    );
  return (
    <PageShell>
      <div className="eyebrow">
        <span className="tiny-cross">+</span>SQUAD PAYMENT
      </div>
      <h1 className="pay-title">
        {data ? (
          <>
            Complete payment for <span>{data.registration.team_name}</span>
          </>
        ) : (
          "Complete your payment"
        )}
      </h1>
      {body}
    </PageShell>
  );
}

// ---------------------------------------------------------------------------
// Participant ID cards: one per squad member, all carrying the squad's
// check-in QR.

// The pass code printed beside the QR for manual entry at check-in:
// "K7MQ-X2RT", or groups of four for cards issued before short codes.
function printedCode(qr) {
  const code = qr.slice(qr.indexOf(":") + 1).toUpperCase();
  return code.length === 8
    ? `${code.slice(0, 4)}-${code.slice(4)}`
    : code.match(/.{1,4}/g).join(" ");
}

function idCards(pass, qrCode) {
  const squad = {
    teamName: pass.team_name,
    teamId: pass.reference,
    domain: domainLabels[pass.domain] || "Deciding at keynote",
    qrValue: pass.qr,
    qrCode,
    code: printedCode(pass.qr),
  };
  // Squads registered before member details were collected get one card.
  if (!pass.members.length)
    return [
      {
        ...squad,
        key: pass.reference,
        name: pass.team_name,
        role: "Squad pass",
      },
    ];
  return pass.members.map((member) => ({
    ...squad,
    key: member.participantId,
    name: member.fullName,
    participantId: member.participantId,
    college: member.college,
    role: member.position === 1 ? "Squad Lead" : "Participant",
  }));
}

const fileSlug = (text) =>
  text
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();

export function PassPage() {
  const [pass, setPass] = useState(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [selected, setSelected] = useState(0);
  const cardRef = useRef(null);
  const qr = useQr(pass?.qr, QR_OPTIONS);
  useEffect(() => {
    document.title = "Squad ID cards — HACK_NEXUS 1.0";
    api("/pass/me")
      .then((d) => setPass(d.pass))
      .catch((e) =>
        e.status === 401 ? redirectToLogin("pass") : setError(e.message),
      );
  }, []);
  const cards = pass ? idCards(pass, qr) : [];
  const card = cards[selected];
  const { key: _key, ...cardProps } = card || {};
  async function download() {
    setBusy(true);
    try {
      const url = await renderIDCard(card, {
        tokens: readTokens(cardRef.current),
      });
      const link = document.createElement("a");
      link.href = url;
      link.download = `hacknexus-id-${fileSlug(pass.team_name)}-${fileSlug(card.name)}.png`;
      link.click();
    } finally {
      setBusy(false);
    }
  }
  return (
    <PageShell>
      <div className="eyebrow">
        <span className="tiny-cross">+</span>SQUAD ID CARDS
      </div>
      <h1 className="pay-title">
        {pass ? (
          <>
            See you at the arena, <span>{pass.team_name}</span>.
          </>
        ) : (
          "Your squad ID cards"
        )}
      </h1>
      {error ? (
        <section className="pay-card pay-status">
          <p className="pay-muted">{error}</p>
          <a className="button primary" href={to("/payment")}>
            Go to payment <ArrowUpRight size={18} />
          </a>
        </section>
      ) : !pass ? (
        <p className="pay-loading">
          <LoaderCircle className="spin" size={18} /> Loading your ID cards…
        </p>
      ) : (
        <div className="pass-layout">
          <div className="pass-card">
            <ParticipantIDCard key={card.key} ref={cardRef} {...cardProps} />
          </div>
          {cards.length > 1 && (
            <div
              className="pass-picker"
              role="group"
              aria-label="Choose a squad member's ID card"
            >
              {cards.map((c, i) => (
                <button
                  key={c.key}
                  type="button"
                  aria-pressed={i === selected}
                  onClick={() => setSelected(i)}
                >
                  <strong>{c.name}</strong>
                  <span>{c.role}</span>
                </button>
              ))}
            </div>
          )}
          <aside className="pass-actions">
            <p className="pay-muted">
              Every squad member has their own card. Each one carries your
              squad’s check-in QR, so organizers can check the squad in from any
              member’s card.
            </p>
            <button
              className="button primary"
              onClick={download}
              disabled={!qr || busy}
            >
              Download {cards.length > 1 ? "this card" : "ID card"}{" "}
              <Download size={18} />
            </button>
            <button className="button ghost" onClick={() => print()}>
              Print {cards.length > 1 ? "this card" : "ID card"}{" "}
              <Printer size={18} />
            </button>
            {pass.checked_in_at && (
              <p className="pass-checked">
                <Check size={16} /> Checked in
              </p>
            )}
            <p className="pay-hint">
              Registration ID: <code>{pass.id}</code>
              <br />
              Payment: {rupees(pass.amount)} · {pass.transaction_id}
            </p>
          </aside>
        </div>
      )}
    </PageShell>
  );
}
