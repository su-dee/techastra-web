/** @type {import('tailwindcss').Config} */

// Design tokens mirror the main Techastra '26 site (techastra-web/src/index.css):
// near-black base, warm amber accent, steel-blue secondary, Space Grotesk +
// IBM Plex Mono. Keep the two sites visually in sync when changing these.
// Colours come from CSS variables (src/index.css) so the dark/light theme
// switch applies to Tailwind classes too; <alpha-value> keeps /opacity working.
const c = (k) => `rgb(var(--tw-${k}) / <alpha-value>)`;
const amber = { DEFAULT: c("amber"), light: c("amber-light"), pale: c("amber-pale"), dim: c("amber-dim"), deep: c("amber-deep") };
const steel = { DEFAULT: c("steel"), light: c("steel-light"), dim: c("steel-dim") };

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: { DEFAULT: c("ink"), 2: c("ink-2"), 3: c("ink-3"), panel: c("panel") },
        text: c("text"),
        heading: c("heading"),
        soft: c("soft"),
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        dim: c("dim"),
        amber,
        steel,
        line: "rgb(var(--tw-shade) / 0.08)",
        shade: c("shade"),

        // Legacy token names from the previous crimson/cyan theme. Many
        // portal pages still use them, so they point at the new palette
        // instead of being removed. Prefer the names above in new code.
        void: c("ink"),
        surface: c("panel"),
        onyx: { DEFAULT: c("ink"), light: c("onyx-light") },
        crimson: { DEFAULT: amber.DEFAULT, light: amber.light, dim: amber.deep, glow: amber.pale },
        arc: { DEFAULT: amber.light, light: amber.pale, dim: amber.dim },
        gold: { DEFAULT: amber.DEFAULT, light: amber.pale, dim: amber.dim, glow: amber.pale },
        offwhite: c("text"),
        cyan: { DEFAULT: steel.DEFAULT, dim: steel.dim },

        success: c("success"),
        warning: c("warning"),
        danger: c("danger"),

        // shadcn-style tokens (components/shadcn/*), wired to index.css :root.
        background: "var(--background)",
        foreground: "var(--foreground)",
        card: { DEFAULT: "var(--card)", foreground: "var(--card-foreground)" },
        popover: { DEFAULT: "var(--popover)", foreground: "var(--popover-foreground)" },
        primary: { DEFAULT: "var(--primary)", foreground: "var(--primary-foreground)" },
        secondary: { DEFAULT: "var(--secondary)", foreground: "var(--secondary-foreground)" },
        accent: { DEFAULT: "var(--accent)", foreground: "var(--accent-foreground)" },
        destructive: { DEFAULT: "var(--destructive)", foreground: "var(--destructive-foreground)" },
        border: "var(--border)",
        input: "var(--input)",
      },
      ringColor: {
        DEFAULT: "var(--ring)",
      },
      borderRadius: {
        lg: "var(--radius, 0.75rem)",
        md: "calc(var(--radius, 0.75rem) - 2px)",
        sm: "calc(var(--radius, 0.75rem) - 4px)",
      },
      fontFamily: {
        sans: ["Space Grotesk", "Helvetica", "Arial", "sans-serif"],
        mono: ["IBM Plex Mono", "ui-monospace", "monospace"],
        // Legacy family names all resolve to the single site typeface.
        display: ["Space Grotesk", "sans-serif"],
        heading: ["Space Grotesk", "sans-serif"],
        serif: ["Space Grotesk", "sans-serif"],
        body: ["Space Grotesk", "sans-serif"],
        italiana: ["Space Grotesk", "sans-serif"],
      },
      boxShadow: {
        amber: "0 18px 50px rgba(180, 144, 62, 0.28)",
        "amber-lg": "0 22px 60px rgba(180, 144, 62, 0.38)",
        "amber-sm": "0 6px 20px rgba(184, 145, 62, 0.24)",
        panel: "0 30px 90px rgba(0, 0, 0, 0.6)",
        // Legacy names
        glow: "0 6px 20px rgba(184, 145, 62, 0.2)",
        gold: "0 6px 20px rgba(184, 145, 62, 0.24)",
        "gold-lg": "0 22px 60px rgba(180, 144, 62, 0.38)",
        crimson: "0 6px 20px rgba(184, 145, 62, 0.24)",
        "crimson-lg": "0 22px 60px rgba(180, 144, 62, 0.38)",
        arc: "0 6px 20px rgba(184, 145, 62, 0.24)",
        cinematic: "0 30px 70px rgba(0, 0, 0, 0.5)",
        "3d": "0 30px 70px rgba(0, 0, 0, 0.5)",
      },
      backgroundImage: {
        "grad-cta": "linear-gradient(104deg, #b08c3e 0%, #ddbb6a 34%, #c9a24a 58%, #a7afb5 100%)",
        "grad-btn": "linear-gradient(100deg, #ddbb6a 0%, #c9a24a 50%, #a7afb5 100%)",
        "grad-card": "linear-gradient(150deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%)",
        // Legacy names
        "cta-gradient": "linear-gradient(100deg, #ddbb6a 0%, #c9a24a 50%, #a7afb5 100%)",
        "gold-gradient": "linear-gradient(104deg, #b08c3e 0%, #ddbb6a 34%, #c9a24a 58%, #a7afb5 100%)",
        "hero-gradient": "linear-gradient(104deg, #b08c3e 0%, #ddbb6a 34%, #c9a24a 58%, #a7afb5 100%)",
      },
      letterSpacing: {
        kicker: "0.2em",
        cinematic: "0.2em",
      },
      keyframes: {
        fade: { from: { opacity: "0" } },
        rise: { from: { opacity: "0", transform: "translateY(12px)" } },
        float: { "0%, 100%": { transform: "translateY(0)" }, "50%": { transform: "translateY(-14px)" } },
      },
      animation: {
        fade: "fade 0.18s ease-out",
        rise: "rise 0.22s ease-out",
        float: "float 9s ease-in-out infinite",
      },
    },
  },
  plugins: [],
};
