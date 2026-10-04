import React, { useEffect, useRef, useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import Button from "../components/ui/Button";
import Stepper from "../components/ui/Stepper";
import { Label, Input, Select, FieldError, FieldHint } from "../components/ui/Input";
import { useCart } from "../context/CartContext";
import { api } from "../lib/api";
import { levelOf } from "../lib/site";
import { plural } from "../lib/a11y";
import { computeTotal, registrationKind, teamSizeRange } from "../lib/pricing";
import { REGISTRATION_DRAFT_KEY, loadDraft, saveDraft } from "../lib/registrationDraft";

export { REGISTRATION_DRAFT_KEY };

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE = /^(?:\+?91[\s-]?)?[6-9]\d{4}[\s-]?\d{5}$/;
const MIN_PASSWORD = 8;
// Same options as the server (YEARS_OF_STUDY in server/utils/validation.js).
const YEARS_OF_STUDY = ["1st Year", "2nd Year", "3rd Year", "4th Year"];
// Senior team members also give their department and year of study.
const EMPTY_MEMBER = { name: "", regNo: "", department: "", yearOfStudy: "", role: "member" };
const EMPTY_FORM = { name: "", email: "", phone: "", password: "", collegeName: "", registerNo: "", course: "", department: "", yearOfStudy: "" };

/**
 * Registration details - step 2 of 3 (events -> details -> payment). The
 * form data is handed to Checkout.jsx through lib/registrationDraft.js:
 * sessionStorage for the details (survives a refresh of the payment page),
 * memory only for the password.
 *
 * Validation runs on submit and then live on each changed field; errors are
 * shown inline under the field (WCAG 3.3.1 / 3.3.3) and focus moves to the
 * first invalid field.
 */
export default function RegisterForm() {
  const { items } = useCart();
  const navigate = useNavigate();
  const formRef = useRef(null);

  const saved = loadDraft();
  const [chosenMode, setMode] = useState(saved?.mode || "individual");
  // Merged with the defaults so a draft saved before a field existed still works.
  const [form, setForm] = useState({ ...EMPTY_FORM, ...(saved?.form || {}) });
  const [teamName, setTeamName] = useState(saved?.teamName || "");
  const [members, setMembers] = useState(saved?.members || [{ ...EMPTY_MEMBER }]);
  const [consent, setConsent] = useState(saved?.consent || false);
  const [guardianConsent, setGuardianConsent] = useState(saved?.guardianConsent || false);
  // Options picked for events that have them, e.g. { [clashSquadId]: "BGMI" }.
  const [eventChoices, setEventChoices] = useState(saved?.eventChoices || {});
  const [errors, setErrors] = useState({});
  const [submitted, setSubmitted] = useState(false);
  // The cart keeps copies of events from when they were added, so read each
  // event's current choices (e.g. the Clash Squad game) from the event list.
  const [currentEvents, setCurrentEvents] = useState({});
  useEffect(() => {
    api
      .get("/api/events")
      .then((data) => setCurrentEvents(Object.fromEntries((data.events || []).map((e) => [e.id, e]))))
      .catch(() => {});
  }, []);
  const choiceEvents = items
    .map((i) => ({ ...i, choices: currentEvents[i.id]?.choices ?? i.choices, choiceLabel: currentEvents[i.id]?.choiceLabel ?? i.choiceLabel }))
    .filter((i) => i.choices?.length);

  // Junior events are for school students, so ask for school and class
  // instead of college and register number (stored in the same fields).
  const junior = items.length > 0 && levelOf(items[0]) === "junior";
  // The cart decides the form: team events that need 2+ people -> team form
  // (required); only individual events -> individual form; team events that
  // also allow one person -> the student chooses. Juniors always register
  // individually (teams are formed at the venue).
  const kind = junior ? "individual" : registrationKind(items);
  const mode = kind === "team" ? "team" : kind === "individual" ? "individual" : chosenMode;
  // In a team registration every member also takes part in the individual events.
  const individualEvents = items.filter((i) => !i.isTeamEvent);
  // The member list follows the team size: a fixed size (team of 3) gets
  // exactly that many slots; a range (1-4) can add/remove within it.
  const [minPeople, maxPeople] = teamSizeRange(items);
  const minMembers = minPeople - 1;
  const maxMembers = maxPeople - 1;
  const fixedSize = minPeople === maxPeople;
  useEffect(() => {
    setMembers((prev) => {
      if (prev.length >= minMembers && prev.length <= maxMembers) return prev;
      const next = prev.slice(0, maxMembers);
      while (next.length < minMembers) next.push({ ...EMPTY_MEMBER });
      return next;
    });
  }, [minMembers, maxMembers]);
  // Fees are per person: the exact amount follows the team being entered here.
  const teamSize = !junior && mode === "team" ? 1 + members.length : 1;
  const total = computeTotal(items, teamSize);
  const orgLabel = junior ? "School name" : "College name";
  const idLabel = junior ? "Class / grade" : "Register number";

  function validate(next = { mode, form, teamName, members, consent, guardianConsent, eventChoices }) {
    const e = {};
    if (!next.form.name.trim()) e.name = "Enter your full name.";
    if (!next.form.email.trim()) e.email = "Enter your email address.";
    else if (!EMAIL.test(next.form.email.trim())) e.email = "Enter an email address like name@example.com.";
    if (next.form.phone && !PHONE.test(next.form.phone.trim())) e.phone = "Enter a 10-digit Indian mobile number, like 98765 43210.";
    if (!next.form.password) e.password = "Create a password.";
    else if (next.form.password.length < MIN_PASSWORD) e.password = `Use at least ${MIN_PASSWORD} characters.`;
    // The college / school name is printed on the ID card exactly as entered.
    if (!next.form.collegeName.trim()) e.collegeName = `Enter your ${orgLabel.toLowerCase()}.`;
    if (!junior) {
      if (!next.form.course.trim()) e.course = "Enter your course, for example B.E. or B.Tech.";
      if (!next.form.department.trim()) e.department = "Enter your department.";
      if (!next.form.yearOfStudy) e.yearOfStudy = "Choose your year of study.";
    }
    // Junior Techastra: school students register individually and teams are
    // formed at the venue, so there are no team details to check.
    if (junior) next = { ...next, mode: "individual" };
    if (next.mode === "team") {
      if (!next.teamName.trim()) e.teamName = "Enter a team name.";
      next.members.forEach((m, i) => {
        if (!m.name.trim()) e[`member-${i}-name`] = "Enter this member’s name.";
        if (!m.regNo.trim()) e[`member-${i}-regno`] = `Enter this member’s ${idLabel.toLowerCase()}.`;
        if (!(m.department || "").trim()) e[`member-${i}-department`] = "Enter this member’s department.";
        if (!m.yearOfStudy) e[`member-${i}-year`] = "Choose this member’s year of study.";
      });
    }
    // Team events need the right number of people (you plus your members).
    // Events in a combo pass may use a team as large as the combo's biggest
    // team event (same rule as the server's checkTeamSizes).
    const size = next.mode === "team" ? 1 + next.members.length : 1;
    const comboCap = (i) => {
      if (!i.comboId) return null;
      const teamItems = items.filter((x) => x.comboId === i.comboId && x.isTeamEvent);
      return Math.max(1, ...teamItems.map((x) => x.maxTeamSize || x.minTeamSize || 1));
    };
    const limits = (i) => {
      const min = i.minTeamSize || 1;
      return [min, comboCap(i) ?? (i.maxTeamSize || min)];
    };
    const bad = items.find((i) => {
      if (!i.isTeamEvent || levelOf(i) === "junior") return false;
      const [min, max] = limits(i);
      return size < min || size > max;
    });
    if (bad) {
      const [min, max] = limits(bad);
      const range = min === max ? min : `${min}–${max}`;
      e.teamSize = bad.comboId
        ? `${bad.comboName || "Your combo pass"} needs a team of ${range} people including you (you have ${size}).`
        : `${bad.name} needs a team of ${range} people including you (you have ${size}).`;
    }
    choiceEvents.forEach((i) => {
      if (!i.choices.includes(next.eventChoices[i.id])) e[`choice-${i.id}`] = `Choose your ${(i.choiceLabel || "option").toLowerCase()} for ${i.name}.`;
    });
    if (!next.consent) e.consent = "Please accept the Terms and the Privacy Notice.";
    if (junior && !next.guardianConsent) e.guardianConsent = "A parent or guardian must agree before a school student can register.";
    return e;
  }

  // After the first submit attempt, re-check as the user types.
  const revalidate = (patch) => {
    if (submitted) setErrors(validate({ mode, form, teamName, members, consent, guardianConsent, eventChoices, ...patch }));
  };
  const updateForm = (key, value) => {
    const f = { ...form, [key]: value };
    setForm(f);
    revalidate({ form: f });
  };
  const updateMember = (idx, key, value) => {
    const m = members.map((x, i) => (i === idx ? { ...x, [key]: value } : x));
    setMembers(m);
    revalidate({ members: m });
  };
  const updateChoice = (eventId, value) => {
    const c = { ...eventChoices, [eventId]: value };
    setEventChoices(c);
    revalidate({ eventChoices: c });
  };
  const addMember = () =>
    setMembers((prev) => (prev.length >= maxMembers ? prev : [...prev, { ...EMPTY_MEMBER }]));
  const removeMember = (idx) => {
    const m = members.filter((_, i) => i !== idx);
    setMembers(m);
    revalidate({ members: m });
  };

  const goToCheckout = (e) => {
    e.preventDefault();
    setSubmitted(true);
    const found = validate();
    setErrors(found);
    if (Object.keys(found).length) {
      // Focus the first invalid field (in DOM order).
      requestAnimationFrame(() => formRef.current?.querySelector('[aria-invalid="true"]')?.focus());
      return;
    }
    const choices = Object.fromEntries(choiceEvents.map((i) => [i.id, eventChoices[i.id]]));
    saveDraft({ mode: junior ? "individual" : mode, form, teamName, members, consent, guardianConsent, eventChoices: choices });
    navigate("/checkout");
  };

  // Props shared by every validated field.
  const field = (id, key) => ({
    id,
    "aria-invalid": errors[key] ? "true" : undefined,
    "aria-describedby": errors[key] ? `${id}-error` : undefined,
  });
  const errorCount = Object.keys(errors).length;

  return (
    <div className="max-w-xl mx-auto px-6 pt-6 pb-14 sm:py-14">
      <div className="page-head animate-cinematic-fade">
        <Stepper current={2} />
        <div className="kicker">Your details</div>
        <h1 className="h2">Register for Techastra ’26</h1>
        {items.length > 0 && (
          <p className="lead">
            {plural(items.length, "event")} selected ·{" "}
            {total > 0 ? (
              <>
                Total <span className="text-heading tabular-nums">₹{total}</span>
                {teamSize > 1 ? ` for a team of ${teamSize}` : ""}
              </>
            ) : (
              "Free registration"
            )}{" "}
            ·{" "}
            <Link to="/cart" className="link-cta">Edit</Link>
          </p>
        )}
      </div>

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="lead mb-6">Your cart is empty — add an event first.</p>
          <Link to="/events" className="btn-small">Browse events</Link>
        </div>
      ) : (
        <form ref={formRef} onSubmit={goToCheckout} noValidate className="space-y-6">
          <p className="text-[13px] text-dim">
            Fields marked <span className="text-amber-light">*</span> are required.
          </p>

          {submitted && errorCount > 0 && (
            <div role="alert" className="rounded-[10px] border border-danger/50 bg-danger/10 px-4 py-3 text-[14px] text-danger">
              Please fix {plural(errorCount, "field")} below.
            </div>
          )}

          {junior ? (
            <p className="rounded-[10px] border border-line bg-shade/5 px-4 py-3 text-[14px] text-soft">
              Register just yourself — for team events, <span className="text-heading">teams are formed at the venue</span> on
              the day.
            </p>
          ) : kind !== "either" ? (
            <div>
              <p className="mono-label mb-2">{kind === "team" ? "Team registration" : "Individual registration"}</p>
              <p className="rounded-[10px] border border-line bg-shade/5 px-4 py-3 text-[14px] text-soft">
                {kind === "team" ? (
                  <>
                    Your cart has team events, so you register <span className="text-heading">as a team</span> - add your
                    team members below.
                    {individualEvents.length > 0 && (
                      <>
                        {" "}Every team member also takes part <span className="text-heading">individually</span> in{" "}
                        {individualEvents.map((i) => i.name).join(", ")}.
                      </>
                    )}
                  </>
                ) : (
                  <>
                    These are <span className="text-heading">individual events</span> - register just yourself. Friends
                    taking part register separately.
                  </>
                )}
              </p>
              {errors.teamSize && (
                <p id="reg-team-size-error" className="mt-2 text-[13px] text-danger" role="alert">{errors.teamSize}</p>
              )}
            </div>
          ) : (
          <fieldset>
            <legend className="mono-label mb-2">Registering as</legend>
            <div className="seg" role="radiogroup" aria-label="Registering as">
              {[
                ["individual", "Individual"],
                ["team", "Team"],
              ].map(([k, label]) => (
                <button
                  key={k}
                  type="button"
                  role="radio"
                  aria-checked={mode === k}
                  className={mode === k ? "is-active" : ""}
                  onClick={() => {
                    setMode(k);
                    revalidate({ mode: k });
                  }}
                  data-log={`registration-mode-${k}`}
                >
                  {label}
                </button>
              ))}
            </div>
            {errors.teamSize && (
              <p id="reg-team-size-error" className="mt-2 text-[13px] text-danger" role="alert">{errors.teamSize}</p>
            )}
          </fieldset>
          )}

          <div className="space-y-5">
            <div>
              <Label htmlFor="reg-name" required>Full name</Label>
              <Input {...field("reg-name", "name")} required autoComplete="name" value={form.name} onChange={(e) => updateForm("name", e.target.value)} />
              <FieldError id="reg-name">{errors.name}</FieldError>
            </div>
            <div>
              <Label htmlFor="reg-email" required>Email</Label>
              <Input {...field("reg-email", "email")} type="email" required autoComplete="email" inputMode="email" value={form.email} onChange={(e) => updateForm("email", e.target.value)} />
              <FieldError id="reg-email">{errors.email}</FieldError>
            </div>
            <div>
              <Label htmlFor="reg-phone">Mobile number</Label>
              <Input {...field("reg-phone", "phone")} type="tel" autoComplete="tel" inputMode="tel" placeholder="98765 43210" value={form.phone} onChange={(e) => updateForm("phone", e.target.value)} />
              <FieldError id="reg-phone">{errors.phone}</FieldError>
            </div>
            <div>
              <Label htmlFor="reg-password" required>Password</Label>
              <Input
                {...field("reg-password", "password")}
                aria-describedby={errors.password ? "reg-password-error" : "reg-password-hint"}
                type="password"
                required
                autoComplete="new-password"
                minLength={MIN_PASSWORD}
                value={form.password}
                onChange={(e) => updateForm("password", e.target.value)}
              />
              {errors.password ? (
                <FieldError id="reg-password">{errors.password}</FieldError>
              ) : (
                <FieldHint id="reg-password">At least {MIN_PASSWORD} characters. You’ll use it to sign in once your registration is approved.</FieldHint>
              )}
            </div>
            <div>
              <Label htmlFor="reg-college" required>{orgLabel}</Label>
              <Input
                {...field("reg-college", "collegeName")}
                aria-describedby={errors.collegeName ? "reg-college-error" : "reg-college-hint"}
                required
                autoComplete="organization"
                value={form.collegeName}
                onChange={(e) => updateForm("collegeName", e.target.value)}
              />
              {errors.collegeName ? (
                <FieldError id="reg-college">{errors.collegeName}</FieldError>
              ) : (
                <FieldHint id="reg-college">Printed on your ID card exactly as you type it - use the full name.</FieldHint>
              )}
            </div>
            <div>
              <Label htmlFor="reg-regno">{idLabel}</Label>
              <Input id="reg-regno" autoComplete="off" value={form.registerNo} onChange={(e) => updateForm("registerNo", e.target.value)} />
            </div>
            {!junior && (
              <>
                <div className="grid sm:grid-cols-2 gap-5">
                  <div>
                    <Label htmlFor="reg-course" required>Course</Label>
                    <Input {...field("reg-course", "course")} required placeholder="B.E. / B.Tech / B.Sc" value={form.course} onChange={(e) => updateForm("course", e.target.value)} />
                    <FieldError id="reg-course">{errors.course}</FieldError>
                  </div>
                  <div>
                    <Label htmlFor="reg-department" required>Department</Label>
                    <Input {...field("reg-department", "department")} required placeholder="Computer Science and Engineering" value={form.department} onChange={(e) => updateForm("department", e.target.value)} />
                    <FieldError id="reg-department">{errors.department}</FieldError>
                  </div>
                </div>
                <div>
                  <Label htmlFor="reg-year" required>Year of study</Label>
                  <Select {...field("reg-year", "yearOfStudy")} required value={form.yearOfStudy} onChange={(e) => updateForm("yearOfStudy", e.target.value)}>
                    <option value="">Select your year</option>
                    {YEARS_OF_STUDY.map((y) => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </Select>
                  <FieldError id="reg-year">{errors.yearOfStudy}</FieldError>
                </div>
              </>
            )}
          </div>

          {mode === "team" && !junior && (
            <fieldset className="border-t border-line pt-6 space-y-5">
              <legend className="h3 !text-[20px] !mt-0 pt-6">Team details</legend>
              <div>
                <Label htmlFor="reg-team-name" required>Team name</Label>
                <Input {...field("reg-team-name", "teamName")} required value={teamName} onChange={(e) => { setTeamName(e.target.value); revalidate({ teamName: e.target.value }); }} />
                <FieldError id="reg-team-name">{errors.teamName}</FieldError>
              </div>
              <div>
                <p className="mono-label mb-1">Team members (besides you)</p>
                <p className="text-[13px] text-soft mb-3" id="reg-team-size-hint">
                  {fixedSize
                    ? `Team of ${minPeople}: you plus ${plural(minMembers, "member")}.`
                    : `Team of ${minPeople}–${maxPeople} people: you plus ${minMembers}–${maxMembers} members.`}
                </p>
                <ul className="space-y-4">
                  {members.map((m, idx) => (
                    <li key={idx} className="card p-4">
                      <div className="flex items-center justify-between mb-3">
                        <span className="text-[14px] text-heading">Member {idx + 2}</span>
                        {members.length > minMembers && (
                          <button type="button" className="link-cta !text-danger text-[13px] tap-24" onClick={() => removeMember(idx)} aria-label={`Remove member ${idx + 2}`}>
                            Remove
                          </button>
                        )}
                      </div>
                      <div className="grid sm:grid-cols-2 gap-3">
                        <div>
                          <Label htmlFor={`m${idx}-name`} required>Name</Label>
                          <Input {...field(`m${idx}-name`, `member-${idx}-name`)} required value={m.name} onChange={(e) => updateMember(idx, "name", e.target.value)} />
                          <FieldError id={`m${idx}-name`}>{errors[`member-${idx}-name`]}</FieldError>
                        </div>
                        <div>
                          <Label htmlFor={`m${idx}-regno`} required>{idLabel}</Label>
                          <Input {...field(`m${idx}-regno`, `member-${idx}-regno`)} required value={m.regNo} onChange={(e) => updateMember(idx, "regNo", e.target.value)} />
                          <FieldError id={`m${idx}-regno`}>{errors[`member-${idx}-regno`]}</FieldError>
                        </div>
                        <div>
                          <Label htmlFor={`m${idx}-department`} required>Department</Label>
                          <Input {...field(`m${idx}-department`, `member-${idx}-department`)} required value={m.department || ""} onChange={(e) => updateMember(idx, "department", e.target.value)} />
                          <FieldError id={`m${idx}-department`}>{errors[`member-${idx}-department`]}</FieldError>
                        </div>
                        <div>
                          <Label htmlFor={`m${idx}-year`} required>Year of study</Label>
                          <Select {...field(`m${idx}-year`, `member-${idx}-year`)} required value={m.yearOfStudy || ""} onChange={(e) => updateMember(idx, "yearOfStudy", e.target.value)}>
                            <option value="">Select year</option>
                            {YEARS_OF_STUDY.map((y) => (
                              <option key={y} value={y}>{y}</option>
                            ))}
                          </Select>
                          <FieldError id={`m${idx}-year`}>{errors[`member-${idx}-year`]}</FieldError>
                        </div>
                      </div>
                    </li>
                  ))}
                </ul>
                {members.length < maxMembers && (
                  <Button type="button" variant="outline" size="sm" className="mt-3" onClick={addMember}>
                    + Add member
                  </Button>
                )}
              </div>
            </fieldset>
          )}

          {choiceEvents.map((ev) => {
            const label = ev.choiceLabel || "Option";
            const err = errors[`choice-${ev.id}`];
            return (
              <fieldset key={ev.id} className="border-t border-line pt-6" aria-describedby={err ? `choice-${ev.id}-error` : undefined}>
                <legend className="h3 !text-[20px] !mt-0 pt-6">
                  {ev.name}: choose your {label.toLowerCase()} <span className="text-amber-light" aria-hidden="true">*</span>
                </legend>
                {mode === "team" && !junior && !ev.isTeamEvent && (
                  <p className="text-[13px] text-soft mb-3">Your whole team plays this {label.toLowerCase()}.</p>
                )}
                <div className="grid gap-3 sm:grid-cols-2">
                  {ev.choices.map((option, idx) => (
                    <label
                      key={option}
                      className={`flex items-center gap-2 cursor-pointer rounded-[10px] border px-4 py-3 ${eventChoices[ev.id] === option ? "border-amber/70 bg-amber/10" : "border-shade/15 hover:border-amber/40"}`}
                    >
                      <input
                        type="radio"
                        name={`choice-${ev.id}`}
                        value={option}
                        required
                        checked={eventChoices[ev.id] === option}
                        aria-invalid={err && idx === 0 ? "true" : undefined}
                        onChange={() => updateChoice(ev.id, option)}
                      />
                      <span className="text-[15px] text-heading">{option}</span>
                    </label>
                  ))}
                </div>
                <FieldError id={`choice-${ev.id}`}>{err}</FieldError>
              </fieldset>
            );
          })}

          <fieldset className="border-t border-line pt-6 space-y-4">
            <legend className="sr-only">Consent</legend>
            <div>
              <label className="consent" htmlFor="reg-consent">
                <input
                  id="reg-consent"
                  type="checkbox"
                  checked={consent}
                  aria-invalid={errors.consent ? "true" : undefined}
                  aria-describedby={errors.consent ? "reg-consent-error" : undefined}
                  onChange={(e) => { setConsent(e.target.checked); revalidate({ consent: e.target.checked }); }}
                />
                <span>
                  I agree to the <Link to="/terms" target="_blank" rel="noopener">Terms of Participation</Link> and consent to my data being used as described in the{" "}
                  <Link to="/privacy" target="_blank" rel="noopener">Privacy Notice</Link>. <span className="text-amber-light" aria-hidden="true">*</span>
                </span>
              </label>
              <FieldError id="reg-consent">{errors.consent}</FieldError>
            </div>
            {junior && (
              <div>
                <label className="consent" htmlFor="reg-guardian">
                  <input
                    id="reg-guardian"
                    type="checkbox"
                    checked={guardianConsent}
                    aria-invalid={errors.guardianConsent ? "true" : undefined}
                    aria-describedby={errors.guardianConsent ? "reg-guardian-error" : undefined}
                    onChange={(e) => { setGuardianConsent(e.target.checked); revalidate({ guardianConsent: e.target.checked }); }}
                  />
                  <span>
                    I am the parent or guardian of this student (or have their permission), and I consent to their taking part and to their data being used as described. <span className="text-amber-light" aria-hidden="true">*</span>
                  </span>
                </label>
                <FieldError id="reg-guardian">{errors.guardianConsent}</FieldError>
              </div>
            )}
          </fieldset>

          <div className="flex flex-col-reverse sm:flex-row gap-3 pt-2">
            <Link to="/events" className="btn-ghost-sm text-center !py-3">Back to events</Link>
            <Button type="submit" size="lg" className="flex-1">
              Continue to payment
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}
