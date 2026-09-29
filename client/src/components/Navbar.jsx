import React, { useEffect, useState } from "react";
import { Link, NavLink, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { useCart } from "../context/CartContext";
import { usePanels } from "../context/PanelContext";
import { PORTAL_PATH } from "../lib/site";
import logo from "../assets/logo-sm.webp";
import ThemeToggle from "./ThemeToggle";

const LINKS = [
  ["/", "Home"],
  ["/events", "Events & Register"],
  ["/status", "Status"],
  ["/verify-certificate", "Verify Certificate"],
];

function CartIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
      <circle cx="9" cy="20" r="1.4" />
      <circle cx="18" cy="20" r="1.4" />
      <path d="M2 3h2l2.4 12.4a2 2 0 0 0 2 1.6h8.6a2 2 0 0 0 2-1.6L21 7H6" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// Same layout as the main site's navbar (techastra-web Navbar.jsx): logo +
// text links on the left, primary action on the right, burger menu below 900px.
export default function Navbar() {
  const { user, logout } = useAuth();
  const { items } = useCart();
  const { openPanel } = usePanels();
  const { pathname } = useLocation();
  const [open, setOpen] = useState(false);

  useEffect(() => setOpen(false), [pathname]);

  // Over the (always dark) landing hero the navbar uses the dark palette too,
  // so light mode doesn't put a pale bar on the dark hero. No effect in dark mode.
  const [overHero, setOverHero] = useState(false);
  useEffect(() => {
    if (pathname !== "/") {
      setOverHero(false);
      return undefined;
    }
    const check = () => {
      const hero = document.querySelector(".hero");
      setOverHero(!!hero && hero.getBoundingClientRect().bottom > 64);
    };
    check();
    window.addEventListener("scroll", check, { passive: true });
    window.addEventListener("resize", check);
    return () => {
      window.removeEventListener("scroll", check);
      window.removeEventListener("resize", check);
    };
  }, [pathname]);

  const portal = user ? PORTAL_PATH[user.role] || "/dashboard" : null;

  return (
    <nav className={"nav" + (overHero ? " theme-dark" : "")} aria-label="Main">
      <div className="nav__left">
        <Link to="/" className="nav__brand" aria-label="Techastra ’26 registration home" data-log="nav-logo">
          <img src={logo} alt="Techastra ’26" />
        </Link>
        <div className="nav__links">
          {LINKS.map(([to, label]) => (
            <NavLink key={to} to={to} end className={({ isActive }) => (isActive ? "is-active" : "")} data-log={`nav-${label.toLowerCase().replace(/\s+/g, "-")}`}>
              {label}
            </NavLink>
          ))}
          <a href="#help" onClick={(e) => { e.preventDefault(); openPanel("help"); }} data-log="nav-help">
            Help Desk
          </a>
        </div>
      </div>

      <div className="nav__right">
        <ThemeToggle />
        <Link to="/cart" className="nav__cart" aria-label={`Cart, ${items.length} event${items.length === 1 ? "" : "s"}`} data-log="nav-cart">
          <CartIcon />
          {items.length > 0 && <span className="nav__cart-count">{items.length}</span>}
        </Link>
        {user ? (
          <>
            <button type="button" className="btn-ghost-sm nav__desktop-only" onClick={logout} data-log="nav-logout">
              Log out
            </button>
            <Link to={portal} className="btn-small" data-log="nav-dashboard">
              {user.role === "participant" ? "My Dashboard" : "Portal"}
            </Link>
          </>
        ) : (
          <Link to="/login" className="btn-small" data-log="nav-login">
            Login
          </Link>
        )}
        <button
          className={"nav__burger" + (open ? " is-open" : "")}
          aria-label="Toggle menu"
          aria-expanded={open}
          onClick={() => setOpen((o) => !o)}
          data-log="nav-open-menu"
        >
          <span />
          <span />
          <span />
        </button>
      </div>

      <div className={"nav__mobile" + (open ? " is-open" : "")}>
        {LINKS.map(([to, label]) => (
          <Link key={to} to={to}>
            {label}
          </Link>
        ))}
        <button type="button" onClick={() => { setOpen(false); openPanel("help"); }}>
          Help Desk
        </button>
        {user && (
          <button type="button" onClick={() => { setOpen(false); logout(); }}>
            Log out
          </button>
        )}
      </div>
    </nav>
  );
}
