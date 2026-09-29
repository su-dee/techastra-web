import React from "react";

// Button styles follow the main site: amber->steel gradient for the primary
// action, hairline-bordered ghost buttons for everything secondary.
const VARIANTS = {
  primary:
    "bg-grad-btn text-[#2c2823] font-semibold border border-shade/15 shadow-amber-sm hover:brightness-110 rounded-[7px]",
  secondary:
    "bg-steel-dim/40 text-heading border border-steel/40 hover:bg-steel-dim/60 hover:border-steel/70 rounded-[7px]",
  outline:
    "bg-transparent text-[color:var(--c-e0dacd)] border border-shade/15 hover:border-amber/55 hover:text-heading rounded-[7px]",
  danger:
    "bg-danger/15 text-danger border border-danger/40 hover:bg-danger/25 rounded-[7px]",
  ghost: "bg-transparent text-[color:var(--c-e0dacd)] hover:bg-shade/5 hover:text-heading rounded-[7px]",
  link: "link-cta !p-0",
};

const SIZES = {
  sm: "px-3.5 py-2 text-[13px] min-h-[38px]",
  md: "px-5 py-2.5 text-sm min-h-[42px]",
  lg: "px-7 py-3.5 text-[15px] min-h-[48px]",
};

export default function Button({
  children,
  variant = "primary",
  size = "md",
  className = "",
  disabled = false,
  type = "button",
  plain, // accepted for backwards compatibility; no longer changes anything
  ...props
}) {
  const isLink = variant === "link";
  return (
    <button
      type={type}
      disabled={disabled}
      className={`inline-flex items-center justify-center gap-2 font-medium text-center transition-[filter,border-color,background-color,color] duration-200
        disabled:opacity-45 disabled:cursor-not-allowed disabled:hover:brightness-100
        ${VARIANTS[variant] || VARIANTS.primary} ${isLink ? "" : SIZES[size] || SIZES.md} ${className}`}
      {...props}
    >
      {children}
      {isLink && <span aria-hidden="true">&rarr;</span>}
    </button>
  );
}
