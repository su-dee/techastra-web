/**
 * Hand-off between the details form (RegisterForm.jsx) and payment
 * (Checkout.jsx). The draft lives in sessionStorage so it survives a refresh
 * of the payment page, but the password is never written to browser
 * storage (OWASP ASVS 8.2): it stays in memory only, and Checkout asks for
 * it again if the page was reloaded.
 */
export const REGISTRATION_DRAFT_KEY = "techastra_registration_draft";

let password = "";

export function saveDraft({ form, ...rest }) {
  password = form.password || "";
  const { password: _omit, ...safeForm } = form;
  sessionStorage.setItem(REGISTRATION_DRAFT_KEY, JSON.stringify({ ...rest, form: safeForm }));
}

export function loadDraft() {
  try {
    const draft = JSON.parse(sessionStorage.getItem(REGISTRATION_DRAFT_KEY) || "null");
    if (!draft) return null;
    return { ...draft, form: { ...draft.form, password } };
  } catch {
    return null;
  }
}

export function clearDraft() {
  password = "";
  sessionStorage.removeItem(REGISTRATION_DRAFT_KEY);
}
