import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import toast from "react-hot-toast";
import Button from "../components/ui/Button";
import { Label, Input } from "../components/ui/Input";
import { useCart } from "../context/CartContext";
import { levelOf } from "../lib/site";

export const REGISTRATION_DRAFT_KEY = "techastra_registration_draft";

/**
 * Registration details form - step 1 of the two-page registration flow
 * (Register -> Checkout), per the corrected Section 4 page list.
 *
 * This was previously a single two-step SlidePanel overlay
 * (RegistrationPanel.jsx) per an earlier "forms as overlays, not pages"
 * brief. That brief has been superseded: this app is now a standalone
 * Registration Portal opened from a separate marketing site, and the
 * corrected brief explicitly lists /register and /checkout as their own
 * routed pages. Since the two steps no longer live in one component with
 * shared React state, the form data collected here is handed off to
 * Checkout.jsx via sessionStorage (REGISTRATION_DRAFT_KEY) rather than
 * lifted state - sessionStorage (not localStorage) is deliberate: this
 * draft should NOT survive across browser sessions/devices the way the
 * cart does, it's just a hand-off for one in-progress registration.
 */
export default function Register() {
  const { items, total } = useCart();
  const navigate = useNavigate();

  const [mode, setMode] = useState("individual");
  const [form, setForm] = useState({ name: "", email: "", phone: "", password: "", collegeName: "", registerNo: "" });
  const [teamName, setTeamName] = useState("");
  const [members, setMembers] = useState([{ name: "", regNo: "", role: "member" }]);

  const anyTeamEvent = items.some((i) => i.isTeamEvent);
  // Junior events are for school students, so ask for school and class
  // instead of college and register number (stored in the same fields).
  const junior = items.length > 0 && levelOf(items[0]) === "junior";
  const orgLabel = junior ? "School Name" : "College Name";
  const idLabel = junior ? "Class / Grade" : "Register Number";

  const updateForm = (key, value) => setForm((f) => ({ ...f, [key]: value }));
  const updateMember = (idx, key, value) =>
    setMembers((prev) => prev.map((m, i) => (i === idx ? { ...m, [key]: value } : m)));
  const addMember = () => setMembers((prev) => [...prev, { name: "", regNo: "", role: "member" }]);
  const removeMember = (idx) => setMembers((prev) => prev.filter((_, i) => i !== idx));

  const goToCheckout = (e) => {
    e.preventDefault();
    if (items.length === 0) {
      toast.error("Your cart is empty");
      return navigate("/events");
    }
    if (!form.name || !form.email || !form.password) {
      return toast.error("Name, email and password are required");
    }
    if (mode === "team" && (!teamName || members.some((m) => !m.name || !m.regNo))) {
      return toast.error("Fill in the team name and all member details");
    }

    sessionStorage.setItem(
      REGISTRATION_DRAFT_KEY,
      JSON.stringify({ mode, form, teamName, members })
    );
    navigate("/checkout");
  };

  return (
    <div className="max-w-xl mx-auto px-6 py-16">
      <div className="text-center mb-10 animate-cinematic-fade">
        <p className="text-arc text-[11px] tracking-cinematic uppercase mb-4">Step 1 of 2</p>
        <h1 className="font-serif text-3xl sm:text-4xl text-offwhite mb-3">Register for TechAstra</h1>
        <p className="text-offwhite/50 text-sm">
          {items.length} event(s) selected &middot; Total &#8377;{total}
        </p>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-10 border-t border-b border-crimson/10">
          <p className="text-offwhite/50 mb-6">Your cart is empty &mdash; add an event first.</p>
          <Link to="/events">
            <Button>Browse Events</Button>
          </Link>
        </div>
      ) : (
        <>
          <div className="flex gap-3 mb-8 justify-center">
            <button
              onClick={() => setMode("individual")}
              className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors duration-300 ${
                mode === "individual" ? "bg-arc text-void" : "border border-crimson/20 text-offwhite/70"
              }`}
              data-log="registration-mode-individual"
            >
              Individual
            </button>
            <button
              onClick={() => setMode("team")}
              className={`px-4 py-2 text-xs uppercase tracking-wide transition-colors duration-300 ${
                mode === "team" ? "bg-arc text-void" : "border border-crimson/20 text-offwhite/70"
              }`}
              data-log="registration-mode-team"
            >
              Team {anyTeamEvent ? "" : "(optional)"}
            </button>
          </div>

          <form onSubmit={goToCheckout} className="space-y-6">
            <div className="space-y-4">
              <div>
                <Label htmlFor="reg-name">Full Name</Label>
                <Input id="reg-name" required value={form.name} onChange={(e) => updateForm("name", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="reg-email">Email</Label>
                <Input id="reg-email" type="email" required value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="reg-phone">Phone</Label>
                <Input id="reg-phone" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="reg-password">Password (for post-approval login)</Label>
                <Input id="reg-password" type="password" required value={form.password} onChange={(e) => updateForm("password", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="reg-college">{orgLabel}</Label>
                <Input id="reg-college" value={form.collegeName} onChange={(e) => updateForm("collegeName", e.target.value)} />
              </div>
              <div>
                <Label htmlFor="reg-regno">{idLabel}</Label>
                <Input id="reg-regno" value={form.registerNo} onChange={(e) => updateForm("registerNo", e.target.value)} />
              </div>
            </div>

            {mode === "team" && (
              <div className="border-t border-crimson/10 pt-6">
                <h3 className="text-offwhite text-sm uppercase tracking-wide mb-4">Team Details</h3>
                <div className="mb-4">
                  <Label htmlFor="reg-team-name">Team Name</Label>
                  <Input id="reg-team-name" required value={teamName} onChange={(e) => setTeamName(e.target.value)} />
                </div>
                <p className="text-xs text-offwhite/50 mb-2 uppercase tracking-wide">Team Members</p>
                <div className="space-y-3">
                  {members.map((m, idx) => (
                    <div key={idx} className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-end">
                      <Input placeholder="Name" value={m.name} onChange={(e) => updateMember(idx, "name", e.target.value)} />
                      <Input placeholder={junior ? "Class / Grade" : "Register No."} value={m.regNo} onChange={(e) => updateMember(idx, "regNo", e.target.value)} />
                      <button type="button" className="text-danger text-xs px-2 sm:shrink-0" onClick={() => removeMember(idx)}>
                        Remove
                      </button>
                    </div>
                  ))}
                </div>
                <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addMember}>
                  + Add Member
                </Button>
              </div>
            )}

            <Button type="submit" size="lg" className="w-full">
              Continue to Payment
            </Button>
          </form>
        </>
      )}
    </div>
  );
}
