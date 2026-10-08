import React, { useState } from "react";
import toast from "react-hot-toast";
import Button from "./ui/Button";
import { Input, Label } from "./ui/Input";
import { api } from "../lib/api";

const MIN_PASSWORD = 8; // same limits as the server (utils/validation.js)
const MAX_PASSWORD = 128;
// No 0/O, 1/l/I: easy to read out at the desk.
const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

function generatePassword(length = 10) {
  const bytes = new Uint32Array(length);
  crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => ALPHABET[b % ALPHABET.length]).join("");
}

/**
 * Registration desk: set a new login password for a participant who has
 * forgotten theirs (POST /api/registrations/:id/password). The new password
 * is shown in full so the desk can tell the participant.
 */
export default function SetParticipantPassword({ registrationId, email, status }) {
  const [open, setOpen] = useState(false);
  const [password, setPassword] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [done, setDone] = useState(null); // { password, email, canSignIn }

  const start = () => {
    setPassword(generatePassword());
    setError("");
    setDone(null);
    setOpen(true);
  };

  const save = async (e) => {
    e.preventDefault();
    if (password.length < MIN_PASSWORD || password.length > MAX_PASSWORD) {
      setError(`The password must be ${MIN_PASSWORD}–${MAX_PASSWORD} characters.`);
      return;
    }
    setSaving(true);
    setError("");
    try {
      const data = await api.post(`/api/registrations/${encodeURIComponent(registrationId)}/password`, { password });
      setDone({ password, email: data.email || email, canSignIn: data.canSignIn });
      setOpen(false);
      toast.success("Password changed");
    } catch (err) {
      setError(err.message || "Couldn’t change the password.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="mt-6 pt-5 border-t border-shade/10">
      <h3 className="font-mono text-[11px] tracking-[0.14em] uppercase text-dim mb-1.5">Login password</h3>

      {done && (
        <div role="status" className="rounded-[10px] border border-amber/40 bg-amber/10 px-4 py-3 text-[14px] text-text mb-3">
          <p>
            New password: <strong className="font-mono text-[15px] text-heading select-all">{done.password}</strong>
          </p>
          <p className="mt-1 text-[13px] text-soft">
            Tell the participant to sign in with <strong className="text-heading">{done.email}</strong> and this password.
            {!done.canSignIn && " They can sign in once their registration is approved."}
          </p>
        </div>
      )}

      {open ? (
        <form onSubmit={save} noValidate className="space-y-3">
          <div>
            <Label htmlFor="desk-new-password" required>New password</Label>
            <div className="flex gap-2">
              <Input
                id="desk-new-password"
                className="font-mono"
                autoComplete="off"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                aria-invalid={!!error || undefined}
                aria-describedby={error ? "desk-new-password-error" : undefined}
              />
              <Button type="button" variant="outline" onClick={() => setPassword(generatePassword())}>
                Generate
              </Button>
            </div>
            {error && (
              <p id="desk-new-password-error" role="alert" className="mt-1.5 text-[13px] text-danger">{error}</p>
            )}
          </div>
          <p className="text-[13px] text-dim">
            Their current password stops working. Check the participant’s identity (ID or college ID card) first.
          </p>
          <div className="flex gap-3">
            <Button type="submit" size="sm" disabled={saving} aria-busy={saving || undefined}>
              {saving ? "Saving…" : "Save new password"}
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={() => setOpen(false)} disabled={saving}>
              Cancel
            </Button>
          </div>
        </form>
      ) : (
        <Button type="button" size="sm" variant="outline" onClick={start}>
          Set new password
        </Button>
      )}
      {!open && status !== "approved" && !done && (
        <p className="mt-2 text-[13px] text-dim">This registration isn’t approved yet, so they can’t sign in until it is.</p>
      )}
    </section>
  );
}
