import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowUpRight,
  Check,
  Download,
  LoaderCircle,
  LogOut,
  Search,
  Trash2,
  X,
} from "lucide-react";
import { api } from "./api.js";
import {
  domainLabels,
  statuses,
  statusLabel,
  problemTitle,
  formatDate,
  useDebounced,
  useAdminData,
  StatusPill,
  ViewState,
  Pager,
  PaymentPill,
  paymentLabel,
  rupees,
} from "./adminShared.jsx";
import Payments from "./AdminPayments.jsx";
import CheckIn from "./AdminCheckin.jsx";
import AdminTeam, { roleLabels } from "./AdminTeam.jsx";
import "./admin.css";
import { to, BASE } from "./base.js";

const allTabs = [
  ["overview", "Overview"],
  ["registrations", "Registrations"],
  ["payments", "Payments"],
  ["checkin", "Check-in"],
  ["accounts", "Accounts"],
  ["admins", "Admins"],
  ["activity", "Activity"],
];
// Check-in volunteers only see the scanner.
const tabsFor = (role) =>
  role === "admin" ? allTabs : allTabs.filter(([id]) => id === "checkin");
const actionLabels = {
  update_registration: "Updated registration",
  delete_registration: "Deleted registration",
  delete_user: "Deleted account",
  revoke_sessions: "Signed out account",
  reset_password: "Reset account password",
  export_csv: "Exported CSV",
  verify_payment: "Verified payment",
  reject_payment: "Rejected payment",
  approval_email_sent: "Emailed approval to lead",
  approval_email_failed: "Approval email failed",
  rejection_email_sent: "Emailed rejection to lead",
  rejection_email_failed: "Rejection email failed",
  check_in: "Checked in",
  add_admin: "Added admin",
  remove_admin: "Removed admin",
};

function BarList({ rows, label }) {
  const max = Math.max(1, ...rows.map((r) => r.count));
  if (!rows.length) return <p className="admin-empty">No data yet.</p>;
  return (
    <ul className="bar-list" aria-label={label}>
      {rows.map((r) => (
        <li key={r.key} title={`${r.label}: ${r.count}`}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{
                width: r.count ? `max(3px, ${(r.count / max) * 100}%)` : 0,
              }}
            />
          </span>
          <span className="bar-value">{r.count}</span>
        </li>
      ))}
    </ul>
  );
}

function DailyChart({ daily }) {
  // Fill in the last 14 IST days so quiet days show as zero.
  const counts = Object.fromEntries(daily.map((d) => [d.day, d.count]));
  const days = [];
  for (let i = 13; i >= 0; i--) {
    const day = new Date(Date.now() - i * 86400000).toLocaleDateString(
      "en-CA",
      { timeZone: "Asia/Kolkata" },
    );
    days.push({ day, count: counts[day] || 0 });
  }
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <div className="daily-chart">
      <div
        className="daily-bars"
        role="list"
        aria-label="Registrations per day"
      >
        {days.map((d) => (
          <div
            key={d.day}
            className="daily-col"
            role="listitem"
            title={`${d.day}: ${d.count} registration${d.count === 1 ? "" : "s"}`}
            aria-label={`${d.day}: ${d.count}`}
          >
            {d.count > 0 && <span className="daily-value">{d.count}</span>}
            <span
              className="daily-bar"
              style={{ height: `${(d.count / max) * 100}%` }}
            />
          </div>
        ))}
      </div>
      <div className="daily-axis">
        <span>{days[0].day.slice(5)}</span>
        <span>Today</span>
      </div>
    </div>
  );
}

function Overview({ onExpired, onFilter, onPayments }) {
  const { data, error, loading, reload } = useAdminData(
    "/admin/stats",
    onExpired,
  );
  if (!data)
    return <ViewState loading={loading} error={error} onRetry={reload} />;
  const { totals, byDomain, byStatus, byProblem, daily, payments } = data;
  const statusCount = Object.fromEntries(
    byStatus.map((s) => [s.status, s.count]),
  );
  return (
    <div className="admin-overview">
      <div className="stat-grid">
        {[
          ["Registered squads", totals.registrations],
          ["Participants", totals.participants],
          ["Accounts", totals.users],
          [
            "Checked in",
            totals.checked_in,
            totals.registrations
              ? `${Math.round((totals.checked_in / totals.registrations) * 100)}% of squads`
              : "",
          ],
        ].map(([label, value, note]) => (
          <div className="stat-tile" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
            {note && <small>{note}</small>}
          </div>
        ))}
      </div>
      <div className="status-grid">
        {[
          [
            "submitted",
            "Awaiting verification",
            payments.submitted,
            () => onPayments("submitted"),
          ],
          [
            "verified",
            "Payments verified",
            payments.verified,
            () => onPayments("verified"),
          ],
          [
            "collected",
            "Collected",
            rupees(payments.collected),
            () => onPayments("verified"),
          ],
          [
            "none",
            "Not paid yet",
            payments.unpaid,
            () => onFilter({ payment: "none" }),
          ],
        ].map(([id, label, value, open]) => (
          <button key={id} className="status-tile" onClick={open}>
            <span className="tile-label">{label}</span>
            <strong>{value}</strong>
            <span>
              {id === "none" ? "View squads" : "View payments"}{" "}
              <ArrowUpRight size={13} />
            </span>
          </button>
        ))}
      </div>
      <div className="status-grid">
        {statuses.map(([id, label]) => (
          <button
            key={id}
            className="status-tile"
            onClick={() => onFilter({ status: id })}
          >
            <StatusPill status={id} />
            <strong>{statusCount[id] || 0}</strong>
            <span>
              View {label.toLowerCase()} <ArrowUpRight size={13} />
            </span>
          </button>
        ))}
      </div>
      <div className="chart-grid">
        <section className="admin-card">
          <h3>Squads by domain</h3>
          <BarList
            label="Squads by domain"
            rows={[...Object.keys(domainLabels), null].map((id) => ({
              key: id || "none",
              label: id ? domainLabels[id] : "Undecided",
              count: byDomain.find((d) => d.domain === id)?.count || 0,
            }))}
          />
        </section>
        <section className="admin-card">
          <h3>Registrations, last 14 days</h3>
          <DailyChart daily={daily} />
        </section>
        <section className="admin-card wide">
          <h3>Most chosen challenges</h3>
          <BarList
            label="Squads per challenge"
            rows={byProblem.slice(0, 8).map((p) => ({
              key: p.problem_id,
              label: `${p.problem_id} · ${problemTitle[p.problem_id] || ""}`,
              count: p.count,
            }))}
          />
        </section>
      </div>
    </div>
  );
}

function RegistrationDialog({ id, onClose, onChanged, onExpired }) {
  const ref = useRef(null);
  const [registration, setRegistration] = useState(null);
  const [status, setStatus] = useState("pending");
  const [notes, setNotes] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  useEffect(() => {
    ref.current.showModal();
    api(`/admin/registrations/${id}`)
      .then(({ registration }) => {
        setRegistration(registration);
        setStatus(registration.status);
        setNotes(registration.admin_notes);
      })
      .catch((e) => (e.status === 401 ? onExpired() : setError(e.message)));
  }, [id, onExpired]);
  async function update(body, success) {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const data = await api(`/admin/registrations/${id}`, {
        method: "PATCH",
        body,
      });
      setRegistration(data.registration);
      setMessage(success);
      onChanged();
    } catch (e) {
      if (e.status === 401) onExpired();
      else setError(e.message);
    } finally {
      setBusy(false);
    }
  }
  // Approving verifies the payment too, so confirm it was actually received.
  function confirmApproval() {
    if (registration.payment_status === "verified") return true;
    if (!registration.payment_status) {
      setError(
        "This squad hasn’t submitted a payment yet. It can be approved once its payment is verified.",
      );
      return false;
    }
    return confirm(
      `Approving ${registration.team_name} also verifies their payment (transaction ${registration.transaction_id}) and issues their ID card.\n\nHave you confirmed ₹1,000 was received for this transaction?`,
    );
  }
  async function remove() {
    if (
      !confirm(
        `Delete the registration for “${registration.team_name}”? The account stays, and the squad can register again.`,
      )
    )
      return;
    setBusy(true);
    try {
      await api(`/admin/registrations/${id}`, { method: "DELETE" });
      onChanged();
      onClose();
    } catch (e) {
      if (e.status === 401) onExpired();
      else setError(e.message);
      setBusy(false);
    }
  }
  const dirty =
    registration &&
    (status !== registration.status ||
      notes.trim() !== registration.admin_notes);
  return (
    <dialog
      ref={ref}
      className="admin-dialog"
      onCancel={onClose}
      onClick={(e) => e.target === e.currentTarget && onClose()}
      aria-labelledby="registration-title"
    >
      <div className="dialog-top">
        <span className="mono">SQUAD REGISTRATION</span>
        <button className="icon-button" onClick={onClose} aria-label="Close">
          <X />
        </button>
      </div>
      {!registration ? (
        <ViewState loading={!error} error={error} onRetry={onClose} />
      ) : (
        <>
          <h2 id="registration-title">{registration.team_name}</h2>
          <p className="admin-muted">
            Registered {formatDate(registration.created_at)} by @
            {registration.username}
          </p>
          <dl className="detail-grid">
            <div>
              <dt>Lead email</dt>
              <dd>
                <a href={`mailto:${registration.lead_email}`}>
                  {registration.lead_email}
                </a>
              </dd>
            </div>
            <div>
              <dt>Squad size</dt>
              <dd>{registration.squad_size} builders</dd>
            </div>
            <div>
              <dt>Domain</dt>
              <dd>{domainLabels[registration.domain] || "Undecided"}</dd>
            </div>
            <div>
              <dt>Challenge</dt>
              <dd>
                {registration.problem_id
                  ? `${registration.problem_id} · ${problemTitle[registration.problem_id] || ""}`
                  : "Deciding at keynote"}
              </dd>
            </div>
            <div>
              <dt>Payment</dt>
              <dd>
                <PaymentPill status={registration.payment_status} />
                {registration.transaction_id && (
                  <small className="admin-muted">
                    {" "}
                    {registration.transaction_id}
                  </small>
                )}
                {["submitted", "rejected"].includes(
                  registration.payment_status,
                ) && (
                  <button
                    className="text-link verify-inline"
                    disabled={busy}
                    onClick={() =>
                      confirmApproval() &&
                      update(
                        { status: "approved" },
                        "Payment verified and squad approved. The ID card is now available to the squad.",
                      )
                    }
                  >
                    Verify payment & issue ID card
                  </button>
                )}
              </dd>
            </div>
            <div>
              <dt>ID card</dt>
              <dd>
                {registration.has_pass
                  ? "Issued"
                  : "Issued when payment is verified"}
              </dd>
            </div>
            <div className="full">
              <dt>Registration ID</dt>
              <dd>
                <code>{registration.id}</code>
              </dd>
            </div>
            <div className="full">
              <dt>Squad members</dt>
              <dd>
                {registration.members?.length ? (
                  <table className="member-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Name</th>
                        <th>Email</th>
                        <th>Mobile</th>
                        <th>College</th>
                      </tr>
                    </thead>
                    <tbody>
                      {registration.members.map((m) => (
                        <tr key={m.position}>
                          <td>{m.position === 1 ? "Lead" : m.position}</td>
                          <td>{m.fullName}</td>
                          <td>
                            <a href={`mailto:${m.email}`}>{m.email}</a>
                          </td>
                          <td>
                            <a href={`tel:+91${m.phone}`}>{m.phone}</a>
                          </td>
                          <td>{m.college}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <span className="admin-muted">
                    The lead has not added member details yet.
                  </span>
                )}
              </dd>
            </div>
            <div className="full">
              <dt>Big idea</dt>
              <dd className="abstract">
                {registration.abstract || "No abstract provided."}
              </dd>
            </div>
          </dl>
          <div className="checkin-row">
            <div>
              <strong>
                {registration.checked_in_at ? "Checked in" : "Not checked in"}
              </strong>
              <span className="admin-muted">
                {registration.checked_in_at
                  ? `${formatDate(registration.checked_in_at)}${registration.checked_in_by ? ` by @${registration.checked_in_by}` : ""}`
                  : "Scan their ID card, or mark them here."}
              </span>
            </div>
            <button
              className={`button ${registration.checked_in_at ? "ghost" : "primary"}`}
              disabled={busy}
              onClick={() =>
                update(
                  { checkedIn: !registration.checked_in_at },
                  registration.checked_in_at
                    ? "Check-in removed."
                    : "Squad checked in.",
                )
              }
            >
              {registration.checked_in_at ? "Undo check-in" : "Check in"}
              {!registration.checked_in_at && <Check size={16} />}
            </button>
          </div>
          <form
            className="review-form"
            onSubmit={(e) => {
              e.preventDefault();
              const approving =
                status === "approved" &&
                (registration.status !== "approved" ||
                  registration.payment_status !== "verified");
              if (approving && !confirmApproval()) return;
              update(
                { status, notes },
                approving
                  ? "Squad approved and payment verified. The ID card is now available to the squad."
                  : "Review saved.",
              );
            }}
          >
            <fieldset disabled={busy}>
              <label>
                Status
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value)}
                >
                  {statuses.map(([id, label]) => (
                    <option key={id} value={id}>
                      {label}
                    </option>
                  ))}
                </select>
                <small>
                  Approving verifies the squad’s payment and issues their ID
                  card. Other statuses hide the ID card.
                </small>
              </label>
              <label>
                Organizer notes <span className="optional">PRIVATE</span>
                <textarea
                  rows={3}
                  maxLength={2000}
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Only visible to organizers."
                />
              </label>
              {error && (
                <p className="form-error" role="alert">
                  {error}
                </p>
              )}
              {message && (
                <p className="form-success" role="status">
                  {message}
                </p>
              )}
              <div className="dialog-actions">
                <button
                  type="button"
                  className="danger-button"
                  onClick={remove}
                >
                  <Trash2 size={15} /> Delete registration
                </button>
                <button className="button primary" disabled={!dirty}>
                  Save review
                </button>
              </div>
            </fieldset>
          </form>
        </>
      )}
    </dialog>
  );
}

function Registrations({ onExpired, filters, setFilters }) {
  const [search, setSearch] = useState(filters.q || "");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [openId, setOpenId] = useState(null);
  useEffect(() => {
    setFilters((f) => (f.q === q ? f : { ...f, q }));
  }, [q, setFilters]);
  useEffect(() => setPage(1), [filters]);
  const params = new URLSearchParams(
    Object.entries(filters).filter(([, v]) => v),
  );
  const listParams = new URLSearchParams(params);
  listParams.set("page", page);
  const { data, error, loading, reload } = useAdminData(
    `/admin/registrations?${listParams}`,
    onExpired,
  );
  const set = (key) => (e) =>
    setFilters((f) => ({ ...f, [key]: e.target.value }));
  return (
    <div>
      <div className="admin-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search team, email, username, or ID"
            aria-label="Search registrations"
          />
        </label>
        <select
          value={filters.status || ""}
          onChange={set("status")}
          aria-label="Status"
        >
          <option value="">All statuses</option>
          {statuses.map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
        </select>
        <select
          value={filters.payment || ""}
          onChange={set("payment")}
          aria-label="Payment"
        >
          <option value="">Any payment</option>
          {Object.entries(paymentLabel).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          <option value="none">Unpaid</option>
        </select>
        <select
          value={filters.domain || ""}
          onChange={set("domain")}
          aria-label="Domain"
        >
          <option value="">All domains</option>
          {Object.entries(domainLabels).map(([id, label]) => (
            <option key={id} value={id}>
              {label}
            </option>
          ))}
          <option value="none">Undecided</option>
        </select>
        <select
          value={filters.checkedIn || ""}
          onChange={set("checkedIn")}
          aria-label="Check-in"
        >
          <option value="">Any check-in</option>
          <option value="yes">Checked in</option>
          <option value="no">Not checked in</option>
        </select>
        <select
          value={filters.sort || "newest"}
          onChange={set("sort")}
          aria-label="Sort"
        >
          <option value="newest">Newest first</option>
          <option value="oldest">Oldest first</option>
          <option value="team">Team name</option>
          <option value="status">Status</option>
        </select>
        <a
          className="button ghost export-button"
          href={`${BASE}/api/admin/registrations.csv?${params}`}
          download
        >
          <Download size={15} /> Export CSV
        </a>
      </div>
      {!data ? (
        <ViewState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <div className={`table-wrap ${loading ? "is-loading" : ""}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Team</th>
                  <th>Lead</th>
                  <th>Domain / challenge</th>
                  <th>Size</th>
                  <th>Status</th>
                  <th>Payment</th>
                  <th>Check-in</th>
                  <th>Registered</th>
                </tr>
              </thead>
              <tbody>
                {data.registrations.map((r) => (
                  <tr key={r.id}>
                    <td>
                      <button
                        className="row-link"
                        onClick={() => setOpenId(r.id)}
                      >
                        {r.team_name}
                      </button>
                      <small>@{r.username}</small>
                    </td>
                    <td>{r.lead_email}</td>
                    <td>
                      {domainLabels[r.domain] || "Undecided"}
                      <small>{r.problem_id || "No challenge yet"}</small>
                    </td>
                    <td>{r.squad_size}</td>
                    <td>
                      <StatusPill status={r.status} />
                    </td>
                    <td>
                      <PaymentPill status={r.payment_status} />
                    </td>
                    <td>
                      {r.checked_in_at ? (
                        <span className="checked">
                          <Check size={14} /> Yes
                        </span>
                      ) : (
                        <span className="admin-muted">No</span>
                      )}
                    </td>
                    <td className="nowrap">{formatDate(r.created_at)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.registrations.length && (
              <p className="admin-empty">
                No registrations match these filters.
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
      {openId && (
        <RegistrationDialog
          id={openId}
          onClose={() => setOpenId(null)}
          onChanged={reload}
          onExpired={onExpired}
        />
      )}
    </div>
  );
}

function Accounts({ onExpired }) {
  const [search, setSearch] = useState("");
  const q = useDebounced(search);
  const [page, setPage] = useState(1);
  const [notice, setNotice] = useState("");
  const [issued, setIssued] = useState(null);
  useEffect(() => setPage(1), [q]);
  const { data, error, loading, reload } = useAdminData(
    `/admin/users?${new URLSearchParams({ q, page })}`,
    onExpired,
  );
  const actions = {
    revoke: {
      ask: (u) => `Sign @${u.username} out of every device?`,
      path: (u) => `/admin/users/${u.id}/revoke-sessions`,
      method: "POST",
      done: (u) => `Signed out @${u.username}.`,
    },
    reset: {
      ask: (u) =>
        `Reset the password for @${u.username}? Their current password stops working and they are signed out everywhere.`,
      path: (u) => `/admin/users/${u.id}/reset-password`,
      method: "POST",
      done: () => "",
    },
    delete: {
      ask: (u) =>
        `Permanently delete @${u.username}${u.team_name ? ` and their squad “${u.team_name}”` : ""}? This cannot be undone.`,
      path: (u) => `/admin/users/${u.id}`,
      method: "DELETE",
      done: (u) => `Deleted @${u.username}.`,
    },
  };
  async function act(user, name) {
    const action = actions[name];
    if (!confirm(action.ask(user))) return;
    setNotice("");
    setIssued(null);
    try {
      const result = await api(action.path(user), { method: action.method });
      if (name === "reset")
        setIssued({ username: user.username, password: result.password });
      else setNotice(action.done(user));
      reload();
    } catch (e) {
      if (e.status === 401) onExpired();
      else setNotice(e.message);
    }
  }
  return (
    <div>
      <div className="admin-toolbar">
        <label className="search-field">
          <Search size={16} />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search usernames"
            aria-label="Search accounts"
          />
        </label>
      </div>
      {notice && (
        <p className="admin-notice" role="status">
          {notice}
        </p>
      )}
      {issued && (
        <div className="admin-notice temp-password" role="status">
          <p>
            Temporary password for <strong>@{issued.username}</strong>:
          </p>
          <code>{issued.password}</code>
          <p>
            Share it with them privately; it is shown only once. They will
            choose a new password when they sign in.
          </p>
        </div>
      )}
      {!data ? (
        <ViewState loading={loading} error={error} onRetry={reload} />
      ) : (
        <>
          <div className={`table-wrap ${loading ? "is-loading" : ""}`}>
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Squad</th>
                  <th>Active sessions</th>
                  <th>Created</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.users.map((u) => (
                  <tr key={u.id}>
                    <td>
                      @{u.username}{" "}
                      {u.is_admin && <span className="admin-badge">ADMIN</span>}
                    </td>
                    <td>
                      {u.team_name || <span className="admin-muted">None</span>}
                    </td>
                    <td>{u.active_sessions}</td>
                    <td className="nowrap">{formatDate(u.created_at)}</td>
                    <td className="row-actions">
                      {!u.is_admin && (
                        <>
                          <button
                            className="text-link"
                            disabled={!u.active_sessions}
                            onClick={() => act(u, "revoke")}
                          >
                            Sign out
                          </button>
                          <button
                            className="text-link"
                            onClick={() => act(u, "reset")}
                          >
                            Reset password
                          </button>
                          <button
                            className="text-link danger"
                            onClick={() => act(u, "delete")}
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            {!data.users.length && (
              <p className="admin-empty">No accounts found.</p>
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
    </div>
  );
}

function Activity({ onExpired }) {
  const { data, error, loading, reload } = useAdminData(
    "/admin/audit",
    onExpired,
  );
  if (!data)
    return <ViewState loading={loading} error={error} onRetry={reload} />;
  if (!data.entries.length)
    return <p className="admin-empty">No organizer actions recorded yet.</p>;
  return (
    <ol className="audit-list">
      {data.entries.map((e) => (
        <li key={e.id}>
          <span className="audit-time">{formatDate(e.created_at)}</span>
          <span>
            <strong>@{e.admin_username}</strong>{" "}
            {actionLabels[e.action] || e.action}
            {e.details.team && <> · {e.details.team}</>}
            {e.details.username && <> · @{e.details.username}</>}
            {e.details.status && <> → {statusLabel[e.details.status]}</>}
            {e.details.checkedIn !== undefined && (
              <> · {e.details.checkedIn ? "checked in" : "check-in removed"}</>
            )}
            {e.details.rows !== undefined && <> · {e.details.rows} rows</>}
            {e.details.transaction && <> · txn {e.details.transaction}</>}
            {e.details.reason && <> · “{e.details.reason}”</>}
            {e.details.role && <> · {roleLabels[e.details.role]}</>}
          </span>
        </li>
      ))}
    </ol>
  );
}

function AdminLogin({ onAuth, expired }) {
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(e) {
    e.preventDefault();
    setBusy(true);
    setError("");
    const form = new FormData(e.target);
    try {
      const data = await api("/admin/login", {
        method: "POST",
        body: {
          username: form.get("username"),
          password: form.get("password"),
        },
      });
      onAuth(data.admin);
    } catch (e) {
      setError(e.message);
      setBusy(false);
    }
  }
  return (
    <main className="admin-login">
      <form onSubmit={submit} className="admin-login-card">
        <a className="brand" href={to("/")} aria-label="Hack Nexus home">
          <span className="brand-symbol">
            N<span>↗</span>
          </span>
          <span>
            HACK<span className="brand-underscore">_</span>NEXUS
            <small>ORGANIZER CONSOLE</small>
          </span>
        </a>
        <h1>Organizer sign-in</h1>
        <p className="admin-muted">
          {expired
            ? "Your session ended. Sign in again to continue."
            : "Use your admin password — not your mobile number."}
        </p>
        <fieldset disabled={busy}>
          <label>
            Username
            <input name="username" required autoComplete="username" autoFocus />
          </label>
          <label>
            Admin password
            <input
              name="password"
              type="password"
              required
              autoComplete="current-password"
            />
          </label>
          {error && (
            <p className="form-error" role="alert">
              {error}
            </p>
          )}
          <button className="button primary submit-button">
            {busy ? "Signing in…" : "Sign in"}
            {busy ? (
              <LoaderCircle size={18} className="spin" />
            ) : (
              <ArrowUpRight size={18} />
            )}
          </button>
        </fieldset>
      </form>
    </main>
  );
}

export default function Admin() {
  const [admin, setAdmin] = useState(undefined);
  const [expired, setExpired] = useState(false);
  const [tab, setTab] = useState(location.hash.slice(1));
  const [filters, setFilters] = useState({});
  const [paymentStatus, setPaymentStatus] = useState("submitted");
  useEffect(() => {
    document.title = "Admin — HACK_NEXUS 1.0";
    const robots = document.createElement("meta");
    robots.name = "robots";
    robots.content = "noindex";
    document.head.append(robots);
    api("/admin/me")
      .then((d) => setAdmin(d.admin))
      .catch(() => setAdmin(null));
    return () => robots.remove();
  }, []);
  const onExpired = useCallback(() => {
    setAdmin(null);
    setExpired(true);
  }, []);
  function go(id) {
    setTab(id);
    history.replaceState(null, "", `#${id}`);
  }
  async function logout() {
    await api("/admin/logout", { method: "POST" }).catch(() => {});
    setExpired(false);
    setAdmin(null);
  }
  if (admin === undefined)
    return <p className="admin-loading">Loading admin console…</p>;
  const tabs = admin ? tabsFor(admin.role) : [];
  const current = tabs.some(([id]) => id === tab) ? tab : tabs[0]?.[0];
  if (!admin)
    return (
      <AdminLogin
        expired={expired}
        onAuth={(a) => {
          setExpired(false);
          setAdmin(a);
        }}
      />
    );
  return (
    <div className="admin-shell">
      <header className="admin-header">
        <a className="brand" href={to("/")} aria-label="Hack Nexus home">
          <span className="brand-symbol">
            N<span>↗</span>
          </span>
          <span>
            HACK<span className="brand-underscore">_</span>NEXUS
            <small>ORGANIZER CONSOLE</small>
          </span>
        </a>
        <nav className="admin-tabs" aria-label="Admin sections">
          {tabs.map(([id, label]) => (
            <button
              key={id}
              className={current === id ? "active" : ""}
              aria-current={current === id ? "page" : undefined}
              onClick={() => go(id)}
            >
              {label}
            </button>
          ))}
        </nav>
        <div className="admin-user">
          <span>
            @{admin.username}
            {admin.role === "scanner" && " · check-in volunteer"}
          </span>
          <button className="login-link" onClick={logout}>
            <LogOut size={15} /> Sign out
          </button>
        </div>
      </header>
      <main className="admin-main">
        <h1 className="admin-title">
          {tabs.find(([id]) => id === current)[1]}
        </h1>
        {current === "overview" && (
          <Overview
            onExpired={onExpired}
            onFilter={(f) => {
              setFilters(f);
              go("registrations");
            }}
            onPayments={(status) => {
              setPaymentStatus(status);
              go("payments");
            }}
          />
        )}
        {current === "payments" && (
          <Payments onExpired={onExpired} initialStatus={paymentStatus} />
        )}
        {current === "checkin" && <CheckIn onExpired={onExpired} />}
        {current === "admins" && <AdminTeam me={admin} onExpired={onExpired} />}
        {current === "registrations" && (
          <Registrations
            onExpired={onExpired}
            filters={filters}
            setFilters={setFilters}
          />
        )}
        {current === "accounts" && <Accounts onExpired={onExpired} />}
        {current === "activity" && <Activity onExpired={onExpired} />}
      </main>
    </div>
  );
}
