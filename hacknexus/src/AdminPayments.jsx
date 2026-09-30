import React, { useEffect, useRef, useState } from "react";
import { Check, ExternalLink, Search, X } from "lucide-react";
import { api } from "./api.js";
import { BASE } from "./base.js";
import {
  formatDate,
  useDebounced,
  useAdminData,
  ViewState,
  Pager,
  PaymentPill,
  StatusPill,
  rupees,
} from "./adminShared.jsx";

const filters = [
  ["submitted", "Awaiting check"],
  ["verified", "Verified"],
  ["rejected", "Rejected"],
  ["", "All"],
];

function PaymentDialog({ payment, onClose, onChanged, onExpired }) {
  const ref = useRef(null);
  const [reason, setReason] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const screenshot = `${BASE}/api/admin/payments/${payment.id}/screenshot`;
  useEffect(() => ref.current.showModal(), []);
  async function act(action) {
    setBusy(true);
    setError("");
    try {
      await api(`/admin/payments/${payment.id}/${action}`, {
        method: "POST",
        body: action === "reject" ? { reason } : {},
      });
      onChanged();
      onClose();
    } catch (e) {
      if (e.status === 401) onExpired();
      else setError(e.message);
      setBusy(false);
    }
  }
  return (
    <dialog
      ref={ref}
      className="admin-dialog payment-dialog"
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="payment-title"
    >
      <div className="dialog-top">
        <span className="mono">PAYMENT PROOF · {payment.reference}</span>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>
      <div className="payment-review">
        <a
          className="screenshot-frame"
          href={screenshot}
          target="_blank"
          rel="noreferrer"
          title="Open full size"
        >
          <img
            src={screenshot}
            alt={`Payment screenshot from ${payment.team_name}`}
          />
          <span>
            <ExternalLink size={13} /> Open full size
          </span>
        </a>
        <div>
          <h2 id="payment-title">{payment.team_name}</h2>
          <p className="admin-muted">
            @{payment.username} · {payment.lead_email}
          </p>
          <dl className="detail-grid single">
            <div>
              <dt>Transaction ID</dt>
              <dd className="txn">{payment.transaction_id}</dd>
            </div>
            <div>
              <dt>Expected amount</dt>
              <dd>{rupees(payment.amount)}</dd>
            </div>
            <div>
              <dt>Payment note to look for</dt>
              <dd>HACK_NEXUS {payment.reference}</dd>
            </div>
            <div>
              <dt>Submitted</dt>
              <dd>{formatDate(payment.submitted_at)}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>
                <PaymentPill status={payment.status} />
                {payment.reviewed_by && (
                  <small className="admin-muted">
                    {" "}
                    by @{payment.reviewed_by}, {formatDate(payment.reviewed_at)}
                  </small>
                )}
              </dd>
            </div>
            {payment.rejection_reason && (
              <div>
                <dt>Rejection reason</dt>
                <dd>{payment.rejection_reason}</dd>
              </div>
            )}
          </dl>
          <p className="verify-tip">
            Before verifying, find this transaction ID in your UPI app or bank
            statement and confirm {rupees(payment.amount)} was received.
          </p>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          {rejecting ? (
            <form
              className="review-form"
              onSubmit={(e) => {
                e.preventDefault();
                act("reject");
              }}
            >
              <fieldset disabled={busy}>
                <label>
                  Reason shown to the squad
                  <textarea
                    rows={2}
                    maxLength={500}
                    required
                    minLength={3}
                    value={reason}
                    onChange={(e) => setReason(e.target.value)}
                    placeholder="e.g. No payment found for this transaction ID."
                    autoFocus
                  />
                </label>
                <div className="dialog-actions">
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setRejecting(false)}
                  >
                    Cancel
                  </button>
                  <button className="danger-button">Reject payment</button>
                </div>
              </fieldset>
            </form>
          ) : (
            <div className="dialog-actions">
              {payment.status !== "rejected" ? (
                <button
                  className="danger-button"
                  disabled={busy}
                  onClick={() => setRejecting(true)}
                >
                  <X size={15} />
                  {payment.status === "verified" ? "Revoke & reject" : "Reject"}
                </button>
              ) : (
                <span />
              )}
              {payment.status !== "verified" && (
                <button
                  className="button primary"
                  disabled={busy}
                  onClick={() => act("verify")}
                >
                  Verify & approve squad <Check size={16} />
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </dialog>
  );
}

export default function Payments({ onExpired, initialStatus = "submitted" }) {
  const [status, setStatus] = useState(initialStatus);
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [open, setOpen] = useState(null);
  useEffect(() => setPage(1), [status, q]);
  const { data, error, loading, reload } = useAdminData(
    `/admin/payments?${new URLSearchParams({ status, q, page })}`,
    onExpired,
  );
  return (
    <div>
      <div className="admin-toolbar">
        <div className="segmented" role="group" aria-label="Payment status">
          {filters.map(([id, label]) => (
            <button
              key={id || "all"}
              className={status === id ? "active" : ""}
              aria-pressed={status === id}
              onClick={() => setStatus(id)}
            >
              {label}
            </button>
          ))}
        </div>
        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, transaction ID, email, or username"
            aria-label="Search payments"
          />
        </label>
      </div>
      {!data ? (
        <ViewState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <div className={`table-wrap ${loading ? "is-loading" : ""}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Transaction ID</th>
                  <th>Amount</th>
                  <th>Payment</th>
                  <th>Squad</th>
                  <th>Submitted</th>
                </tr>
              </thead>
              <tbody>
                {data.payments.map((p) => (
                  <tr key={p.id}>
                    <td>
                      <button className="row-link" onClick={() => setOpen(p)}>
                        {p.team_name}
                      </button>
                      <small>
                        @{p.username} · {p.reference}
                      </small>
                    </td>
                    <td className="txn">{p.transaction_id}</td>
                    <td>{rupees(p.amount)}</td>
                    <td>
                      <PaymentPill status={p.status} />
                    </td>
                    <td>
                      <StatusPill status={p.registration_status} />
                    </td>
                    <td className="nowrap">{formatDate(p.submitted_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.payments.length && (
              <p className="admin-empty">
                {status === "submitted"
                  ? "No payments are waiting for verification."
                  : "No payments match."}
              </p>
            )}
          </div>
          <Pager
            page={data.page}
            limit={data.limit}
            total={data.total}
            onPage={setPage}
          />
        </>
      )}
      {open && (
        <PaymentDialog
          payment={open}
          onClose={() => setOpen(null)}
          onChanged={reload}
          onExpired={onExpired}
        />
      )}
    </div>
  );
}
