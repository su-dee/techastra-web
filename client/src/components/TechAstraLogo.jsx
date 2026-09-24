import React from "react";
import logo from "../assets/logo.webp";
import logoSm from "../assets/logo-sm.webp";

// The same Techastra '26 VISION artwork the main site uses. `sm` loads the
// lighter asset used in the navbar/footer.
const WIDTHS = { sm: 140, md: 210, lg: 340, xl: 520 };

export default function TechAstraLogo({ size = "md", showGlow = true, className = "" }) {
  const width = WIDTHS[size] || WIDTHS.md;
  return (
    <img
      src={size === "sm" ? logoSm : logo}
      alt="Techastra ’26"
      width={width}
      className={`block h-auto select-none ${className}`}
      style={{ width, filter: showGlow ? "drop-shadow(0 12px 30px rgba(214, 140, 50, 0.25))" : undefined }}
      draggable={false}
    />
  );
}
