import React, { useState } from "react";
import { Eye, EyeOff, UserPlus } from "lucide-react";
import { api } from "./api.js";
import { formatDate, useAdminData, ViewState } from "./adminShared.jsx";

export const roleLabels = {
  admin: "Full admin",
  scanner: "Check-in volunteer",
};

export default function AdminTeam({ me, onExpired }) {
  const { data, error, loading, reload } = useAdminData(
    "/admin/admins",
    onExpired,
  );
  const [busy, setBusy] = useState(false);
  const [formError, setFormError] = useState("");
  const [notice, setNotice] = useState("");
  const [show, setShow] = useState(false);
  async function add(e) {
    e.preventDefault();
    const form = e.target;
    const fields = new FormData(form);
    setBusy(true);
    setFormError("");
    setNotice("");
    try {
      const { admin } = await api("/admin/admins", {
        method: "POST",
        body: {
          username: fields.get("username"),
          password: fields.get("password"),
          role: fields.get("role"),
        },
      });
      form.reset();
      setNotice(
        `@${admin.username} was added as a ${roleLabels[admin.role].toLowerCase()}. Share the password with them privately.`,
      );
      reload();
    } catch (e) {
      if (e.status === 401) return onExpired();
      setFormError(e.message);
    } finally {
      setBusy(false);
    }
  }
  async function remove(admin) {
    if (
      !confirm(
        `Remove admin access for @${admin.username}? They are signed out of the admin console immediately.`,
      )
    )
      return;
    setNotice("");
    try {
      await api(`/admin/admins/${admin.id}`, { method: "DELETE" });
      setNotice(`Removed admin access for @${admin.username}.`);
      reload();
    } catch (e) {
      if (e.status === 401) onExpired();
      else setNotice(e.message);
    }
  }
  return (
    <div className="team-layout">
      <section className="admin-card">
        <h3>Add an admin</h3>
        <p className="admin-muted team-help">
          Full admins manage registrations, payments, and other admins. Check-in
          volunteers can only open the scanner and mark attendance.
        </p>
        <form className="review-form" onSubmit={add}>
          <fieldset disabled={busy}>
            <label>
              Username
              <input
                name="username"
                required
                minLength={3}
                maxLength={30}
                pattern="[A-Za-z0-9_]{3,30}"
                autoComplete="off"
                placeholder="e.g. door_volunteer_1"
              />
            </label>
            <label>
              Temporary password
              <div className="password-input">
                <input
                  name="password"
                  type={show ? "text" : "password"}
                  required
                  minLength={12}
                  maxLength={200}
                  autoComplete="new-password"
                  placeholder="At least 12 characters"
                />
                <button
                  type="button"
                  onClick={() => setShow(!show)}
                  aria-label={show ? "Hide password" : "Show password"}
                >
                  {show ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </label>
            <label>
              Role
              <select name="role" defaultValue="scanner">
                <option value="scanner">
                  Check-in volunteer (scanner only)
                </option>
                <option value="admin">Full admin</option>
              </select>
            </label>
            {formError && (
              <p className="form-error" role="alert">
                {formError}
              </p>
            )}
            <button className="button primary">
              Add admin <UserPlus size={16} />
            </button>
          </fieldset>
        </form>
      </section>
      <section>
        {notice && (
          <p className="admin-notice" role="status">
            {notice}
          </p>
        )}
        {!data ? (
          <ViewState loading={loading} error={error} onRetry={reload} />
        ) : (
          <div className="table-wrap">
            <table className="admin-table">
              <thead>
                <tr>
                  <th>Admin</th>
                  <th>Role</th>
                  <th>Added</th>
                  <th>
                    <span className="sr-only">Actions</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.admins.map((a) => (
                  <tr key={a.id}>
                    <td>
                      @{a.username}
                      {a.id === me.id && (
                        <span className="admin-badge">YOU</span>
                      )}
                    </td>
                    <td>{roleLabels[a.role]}</td>
                    <td className="nowrap">
                      {formatDate(a.created_at)}
                      <small>
                        {a.created_by
                          ? `by @${a.created_by}`
                          : "via command line"}
                      </small>
                    </td>
                    <td className="row-actions">
                      {a.id !== me.id && (
                        <button
                          className="text-link danger"
                          onClick={() => remove(a)}
                        >
                          Remove
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
