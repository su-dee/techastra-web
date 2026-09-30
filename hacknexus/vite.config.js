import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// BASE_PATH="/hacknexus" builds the site to live under that path inside the
// Techastra '26 site (the server gets the same BASE_PATH).
const base = (process.env.BASE_PATH || "").replace(/\/+$/, "") + "/";

export default defineConfig({
  base,
  plugins: [react()],
  server: { strictPort: true, proxy: { [`${base}api`]: "http://127.0.0.1:3001" } },
  build: { sourcemap: false },
});
