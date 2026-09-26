import React from "react";

/**
 * Shared panel primitive - the main site's glass `.card` (hairline border,
 * faint diagonal sheen, 14px corners).
 *
 *   - `glow`  : amber-tinted corner wash, for the one card a page is about.
 *   - `hover` : lifts slightly and warms the border on hover.
 *   - `hud` / `reveal` are accepted for older callers and ignored.
 */
export default function Card({
  children,
  className = "",
  glow = false,
  hover = false,
  hud,
  reveal,
  as: Tag = "div",
  ...props
}) {
  const classes = [
    "card p-6",
    glow ? "border-amber/35 bg-[radial-gradient(90%_120%_at_0%_0%,rgba(176,140,58,0.16)_0%,rgba(56,52,45,0)_60%),linear-gradient(150deg,rgba(255,255,255,0.05)_0%,rgba(255,255,255,0.015)_100%)]" : "",
    hover ? "transition-[transform,border-color] duration-200 hover:-translate-y-[3px] hover:border-amber/50" : "",
    className,
  ].join(" ");

  return (
    <Tag className={classes} {...props}>
      {children}
    </Tag>
  );
}
