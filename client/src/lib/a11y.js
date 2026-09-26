import { useEffect } from "react";

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

/**
 * Keeps keyboard focus inside `ref` while `active` (WCAG 2.1.2 / 2.4.3):
 * Tab and Shift+Tab wrap around, and when it deactivates focus goes back to
 * whatever was focused before it opened (usually the button that opened it).
 */
export function useFocusTrap(ref, active) {
  useEffect(() => {
    if (!active) return;
    const previous = document.activeElement;
    const onKey = (e) => {
      if (e.key !== "Tab" || !ref.current) return;
      const nodes = [...ref.current.querySelectorAll(FOCUSABLE)].filter((el) => el.offsetParent !== null);
      if (!nodes.length) return;
      const first = nodes[0];
      const last = nodes[nodes.length - 1];
      if (e.shiftKey && (document.activeElement === first || !ref.current.contains(document.activeElement))) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && (document.activeElement === last || !ref.current.contains(document.activeElement))) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("keydown", onKey);
      if (previous && previous.isConnected && typeof previous.focus === "function") previous.focus();
    };
  }, [ref, active]);
}

// Page titles (WCAG 2.4.2). Longest matching prefix wins.
const TITLES = [
  ["/events/", "Event details"],
  ["/events", "Events"],
  ["/cart", "Your cart"],
  ["/register/form", "Your details"],
  ["/register", "Choose events"],
  ["/checkout", "Payment"],
  ["/status", "Registration status"],
  ["/login", "Sign in"],
  ["/verify-certificate", "Verify a certificate"],
  ["/privacy", "Privacy Notice"],
  ["/terms", "Terms of Participation"],
  ["/dashboard", "My dashboard"],
  ["/registration-team", "Registration desk"],
  ["/coordinator", "Coordinator portal"],
  ["/hospitality", "Hospitality portal"],
  ["/certificates", "Certificate portal"],
  ["/volunteer", "Volunteer portal"],
  ["/admin", "Admin portal"],
];
const SITE = "Techastra ’26";

export function titleFor(pathname) {
  if (pathname === "/") return `${SITE} — Registration Portal`;
  const hit = TITLES.find(([prefix]) => pathname === prefix || pathname.startsWith(prefix.endsWith("/") ? prefix : prefix + "/"));
  return hit ? `${hit[1]} · ${SITE}` : `Page not found · ${SITE}`;
}

/**
 * Sets document.title for the route and, after in-app navigation, moves
 * focus to the main content and announces the new page to screen readers
 * (a single-page app otherwise gives no signal that the page changed).
 */
let lastPath = null;
export function useRouteAnnouncer(pathname, mainRef, announceRef) {
  useEffect(() => {
    const title = titleFor(pathname);
    document.title = title;
    const first = lastPath === null;
    const changed = lastPath !== pathname;
    lastPath = pathname;
    if (first || !changed) return; // don't steal focus on first load
    if (announceRef.current) announceRef.current.textContent = title.split(" · ")[0];
    mainRef.current?.focus({ preventScroll: true });
  }, [pathname, mainRef, announceRef]);
}

/** "1 event" / "3 events" */
export const plural = (n, word, many = word + "s") => `${n} ${n === 1 ? word : many}`;
