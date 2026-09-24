/** @type {import('tailwindcss').Config} */

// Design tokens mirror the main Techastra '26 site (techastra-web/src/index.css):
// near-black base, warm amber accent, steel-blue secondary, Space Grotesk +
// IBM Plex Mono. Keep the two sites visually in sync when changing these.
const amber = {
  DEFAULT: "#d98c46",
  light: "#e8a25c",
  pale: "#f6c392",
  dim: "#9c6a35",
  deep: "#5a3a1c",
};
const steel = {
  DEFAULT: "#7ba3cf",
  light: "#9dbde0",
  dim: "#3d5f85",
};

export default {
  content: ["./index.html", "./src/**/*.{js,jsx}"],
  theme: {
    extend: {
      colors: {
        ink: {
          DEFAULT: "#07070a",
          2: "#08080b",
          3: "#0a0a0e",
          panel: "#0c0c10",
        },
        text: "#e9e6e2",
        heading: "#f2ece5",
        soft: "#a29b93",
        muted: { DEFAULT: "var(--muted)", foreground: "var(--muted-foreground)" },
        dim: "#8e877d",
        amber,
        steel,
        line: "rgba(255, 255, 255, 0.08)",

        // Legacy token names from the previous crimson/cyan theme. Many
        // portal pages still use them, so they point at the new palette
        // instead of being removed. Prefer the names above in new code.
        void: "#07070a",
        surface: "#0c0c10",
        onyx: { DEFAULT: "#07070a", light: "#0f0f14" },
        crimson: { DEFAULT: amber.DEFAULT, light: amber.light, dim: amber.deep, glow: amber.pale },
        arc: { DEFAULT: amber.light, light: amber.pale, dim: amber.dim },
        gold: { DEFAULT: amber.DEFAULT, light: amber.pale, dim: amber.dim, glow: amber.pale },
        offwhite: "#e9e6e2",
        cyan: { DEFAULT: steel.DEFAULT, dim: steel.dim },

        success: "#4ade80",
        warning: "#f5b453",
        danger: "#f87171",

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
        amber: "0 18px 50px rgba(196, 120, 50, 0.28)",
        "amber-lg": "0 22px 60px rgba(196, 120, 50, 0.38)",
        "amber-sm": "0 6px 20px rgba(200, 118, 47, 0.24)",
        panel: "0 30px 90px rgba(0, 0, 0, 0.6)",
        // Legacy names
        glow: "0 6px 20px rgba(200, 118, 47, 0.2)",
        gold: "0 6px 20px rgba(200, 118, 47, 0.24)",
        "gold-lg": "0 22px 60px rgba(196, 120, 50, 0.38)",
        crimson: "0 6px 20px rgba(200, 118, 47, 0.24)",
        "crimson-lg": "0 22px 60px rgba(196, 120, 50, 0.38)",
        arc: "0 6px 20px rgba(200, 118, 47, 0.24)",
        cinematic: "0 30px 70px rgba(0, 0, 0, 0.5)",
        "3d": "0 30px 70px rgba(0, 0, 0, 0.5)",
      },
      backgroundImage: {
        "grad-cta": "linear-gradient(104deg, #9c6a35 0%, #d8903f 34%, #c3803c 58%, #3d5f85 100%)",
        "grad-btn": "linear-gradient(100deg, #c8762f 0%, #a4622c 42%, #2f4d6d 100%)",
        "grad-card": "linear-gradient(150deg, rgba(255,255,255,0.045) 0%, rgba(255,255,255,0.012) 100%)",
        // Legacy names
        "cta-gradient": "linear-gradient(100deg, #c8762f 0%, #a4622c 42%, #2f4d6d 100%)",
        "gold-gradient": "linear-gradient(104deg, #9c6a35 0%, #d8903f 34%, #c3803c 58%, #3d5f85 100%)",
        "hero-gradient": "linear-gradient(104deg, #9c6a35 0%, #d8903f 34%, #c3803c 58%, #3d5f85 100%)",
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
