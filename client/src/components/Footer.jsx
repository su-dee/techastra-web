import React from "react";
import { Link } from "react-router-dom";
import logo from "../assets/logo-sm.webp";
import { INSTITUTE, EDITION, ADDRESS, PHONE, SOCIALS } from "../lib/site";

// Mirrors the main site's footer (techastra-web Footer.jsx), with the
// portal's own utility links in place of the page anchors.
export default function Footer() {
  return (
    <footer className="footer">
      <div className="footer__top">
        <div>
          <img className="footer__logo" src={logo} alt="Techastra ’26" />
          <p className="footer__inst">{INSTITUTE}</p>
          <p className="footer__depts">
            Department of Computer Science and Engineering &amp; Department of Cyber Security
          </p>
        </div>
        <div>
          <div className="mono-label">Portal</div>
          <ul className="footer__links">
            <li><Link to="/">Home</Link></li>
            <li><Link to="/events">Events</Link></li>
            <li><Link to="/status" data-log="footer-status">Registration status</Link></li>
            <li><Link to="/verify-certificate" data-log="footer-verify-certificate">Verify certificate</Link></li>
            <li><Link to="/committee">Committee</Link></li>
            <li><Link to="/privacy">Privacy Notice</Link></li>
            <li><Link to="/terms">Terms &amp; fees</Link></li>
          </ul>
        </div>
        <div>
          <div className="mono-label">Reach us</div>
          <p>{ADDRESS.map((l) => <span key={l}>{l}<br /></span>)}</p>
          <p>
            Phone: <a className="text-amber-light hover:text-amber-pale" href={`tel:${PHONE}`}>{PHONE.replace(/^(\d{3})(\d{8})$/, "$1 $2")}</a>
          </p>
        </div>
        <div>
          <div className="mono-label">Follow</div>
          <ul className="footer__links">
            {SOCIALS.map((s) => (
              <li key={s.label}>
                <a href={s.href} target="_blank" rel="noreferrer">{s.label} ↗</a>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <div className="footer__bottom">
        <span>Techastra ’26 · {EDITION} National Level Technical Symposium</span>
        <span className="footer__tag">#TECHASTRA26 · VISION</span>
      </div>
    </footer>
  );
}
