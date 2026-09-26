/** @type {import('tailwindcss').Config} */

// Design tokens mirror the main Techastra '26 site (techastra-web/src/index.css):
// near-black base, warm amber accent, steel-blue secondary, Space Grotesk +
// IBM Plex Mono. Keep the two sites visually in sync when changing these.
const amber = {
  DEFAULT: "#c9a24a",
  light: "#ddbb6a",
  pale: "#eed49c",
  dim: "#8f7330",
  deep: "#4a3b18",
};
const steel = {
  DEFAULT: "#a7afb5",
  light: "#c6ccd0",
  dim: "#5e666c",
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#2c2823",
          2: "#2f2b26",
          3: "#34302a",
          panel: "#38342d",
        },
        text: "#efe8da",
        heading: "#f5eee2",
        soft: "#b1a898",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        dim: "#afa697",
        amber,
        steel,
        line: "rgba(255, 255, 255, 0.08)",

        // Legacy token names from the previous crimson/cyan theme. Many
        // portal pages still use them, so they point at the new palette
        // instead of being removed. Prefer the names above in new code.
        void: "#2c2823",
        surface: "#38342d",
        onyx: { DEFAULT: "#2c2823", light: "#3c3731" },
        crimson: { DEFAULT: amber.DEFAULT, light: amber.light, dim: amber.deep, glow: amber.pale },
        arc: { DEFAULT: amber.light, light: amber.pale, dim: amber.dim },
        gold: { DEFAULT: amber.DEFAULT, light: amber.pale, dim: amber.dim, glow: amber.pale },
        offwhite: "#efe8da",
        cyan: { DEFAULT: steel.DEFAULT, dim: steel.dim },

        success: "#4ade80",
        warning: "#f5b453",
        danger: "#fa8585",

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
