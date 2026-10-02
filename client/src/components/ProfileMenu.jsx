import React, { startTransition, useEffect, useRef, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { usePanels } from "../context/PanelContext";
import { PORTAL_PATH } from "../lib/site";

export const ROLE_LABEL = {
  participant: "Participant",
  registration_team: "Registration Committee",
  coordinator: "Event Coordinator",
  hospitality: "Hospitality",
  certificate_team: "Certificate Team",
  master_admin: "Admin",
};

// Where each role goes from the menu. The admin can open every portal.
const STAFF_PORTALS = [
  ["master_admin", "Admin portal"],
  ["registration_team", "Registration desk"],
  ["coordinator", "Coordinator portal"],
  ["hospitality", "Hospitality portal"],
  ["certificate_team", "Certificate portal"],
];

function linksFor(role) {
  if (role === "participant") {
    return [
      ["/dashboard", "My dashboard"],
      ["/dashboard#id-card", "My ID card"],
      ["/dashboard#my-events", "My events"],
      ["/dashboard#certificates", "My certificates"],
    ];
  }
  if (role === "master_admin") return STAFF_PORTALS.map(([r, label]) => [PORTAL_PATH[r], label]);
  const own = STAFF_PORTALS.find(([r]) => r === role);
  return [[PORTAL_PATH[role] || "/", own ? own[1] : "My portal"]];
}

function initials(name = "") {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return ((parts[0]?.[0] || "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase() || "?";
}

export function PersonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" aria-hidden="true">
      <circle cx="12" cy="8" r="4" />
      <path d="M4 21c0-4 3.6-6.5 8-6.5s8 2.5 8 6.5" strokeLinecap="round" />
    </svg>
  );
}

/** Logged-in avatar in the navbar; opens a menu with the user's links. */
export default function ProfileMenu() {
  const { user, logout } = useAuth();
  const { openPanel } = usePanels();
  const navigate = useNavigate();
  const { pathname, hash } = useLocation();
  const [open, setOpen] = useState(false);
  const rootRef = useRef(null);
  const menuRef = useRef(null);
  const buttonRef = useRef(null);

  useEffect(() => setOpen(false), [pathname, hash]);

  useEffect(() => {
    if (!open) return undefined;
    const onDown = (e) => {
      if (!rootRef.current?.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => {
      if (e.key === "Escape") {
        setOpen(false);
        buttonRef.current?.focus();
        return;
      }
      if (e.key !== "ArrowDown" && e.key !== "ArrowUp") return;
      const items = [...(menuRef.current?.querySelectorAll('[role="menuitem"]') || [])];
      if (!items.length) return;
      e.preventDefault();
      const i = items.indexOf(document.activeElement);
      const next = e.key === "ArrowDown" ? (i + 1) % items.length : (i - 1 + items.length) % items.length;
      items[next].focus();
    };
    document.addEventListener("pointerdown", onDown);
    document.addEventListener("keydown", onKey);
    menuRef.current?.querySelector('[role="menuitem"]')?.focus();
    return () => {
      document.removeEventListener("pointerdown", onDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  if (!user) return null;

  // React Router runs navigations as transitions; logging out in the same
  // transition commits both together, so a protected page (dashboard,
  // portals) doesn't see "no user" first and bounce to /login.
  const signOut = () => {
    setOpen(false);
    startTransition(() => {
      navigate("/");
      logout();
    });
  };

  return (
    <div className="nav__profile" ref={rootRef}>
      <button
        ref={buttonRef}
        type="button"
        className={"nav__avatar" + (open ? " is-open" : "")}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${user.name}`}
        onClick={() => setOpen((o) => !o)}
        data-log="nav-profile"
      >
        {initials(user.name)}
      </button>

      {open && (
        <div ref={menuRef} className="nav__menu" role="menu" aria-label="Account">
          <div className="nav__menu-head">
            <span className="nav__avatar nav__avatar--lg" aria-hidden="true">{initials(user.name)}</span>
            <div className="min-w-0">
              <p className="nav__menu-name">{user.name}</p>
              {user.email && <p className="nav__menu-email">{user.email}</p>}
              <span className="nav__menu-role">{ROLE_LABEL[user.role] || user.role}</span>
            </div>
          </div>
          <div className="nav__menu-group">
            {linksFor(user.role).map(([to, label]) => (
              <Link key={to} to={to} role="menuitem" className="nav__menu-item" data-log={`nav-profile-${label.toLowerCase().replace(/\s+/g, "-")}`}>
                {label}
              </Link>
            ))}
          </div>
          <div className="nav__menu-group">
            <button
              type="button"
              role="menuitem"
              className="nav__menu-item"
              onClick={() => {
                setOpen(false);
                openPanel("help");
              }}
            >
              Help Desk
            </button>
            <button type="button" role="menuitem" className="nav__menu-item nav__menu-item--danger" onClick={signOut} data-log="nav-logout">
              Log out
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
