import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));

// Public pages worth indexing. Staff portals, the dashboard and checkout
// are private and disallowed in robots.txt.
const PUBLIC_ROUTES = ["/", "/events", "/register", "/status", "/verify-certificate", "/privacy", "/terms"];
const PRIVATE_ROUTES = ["/admin", "/dashboard", "/coordinator", "/registration-team", "/hospitality", "/certificates", "/checkout", "/cart", "/register/form"];
// Security contact for .well-known/security.txt (RFC 9116). PLACEHOLDER -
// keep in sync with LEGAL.contactEmail in src/lib/site.js.
const SECURITY_CONTACT = "mailto:techastra@drmgrdu.ac.in";
const SECURITY_EXPIRES = "2027-10-01T00:00:00.000Z";

/**
 * Fills absolute URLs into index.html (canonical, Open Graph) and emits
 * robots.txt, sitemap.xml and .well-known/security.txt at build time, all
 * from one setting: VITE_SITE_URL (the deployed portal URL, no trailing /).
 */
function seo(siteUrl) {
  return {
    name: "techastra-seo",
    transformIndexHtml: (html) => html.replaceAll("__SITE_URL__", siteUrl),
    generateBundle() {
      const today = new Date().toISOString().slice(0, 10);
      this.emitFile({
        type: "asset",
        fileName: "robots.txt",
        source: `User-agent: *\n${PRIVATE_ROUTES.map((r) => `Disallow: ${r}`).join("\n")}\n\nSitemap: ${siteUrl}/sitemap.xml\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: "sitemap.xml",
        source: `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${PUBLIC_ROUTES.map((r) => `  <url><loc>${siteUrl}${r}</loc><lastmod>${today}</lastmod></url>`).join("\n")}\n</urlset>\n`,
      });
      this.emitFile({
        type: "asset",
        fileName: ".well-known/security.txt",
        source: `Contact: ${SECURITY_CONTACT}\nExpires: ${SECURITY_EXPIRES}\nPreferred-Languages: en\nCanonical: ${siteUrl}/.well-known/security.txt\nPolicy: ${siteUrl}/privacy\n`,
      });
    },
  };
}

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, __dirname, "VITE_");
  const siteUrl = (env.VITE_SITE_URL || "http://localhost:5173").replace(/\/$/, "");
  if (mode === "production" && !env.VITE_SITE_URL) {
    console.warn("\n[techastra] VITE_SITE_URL is not set - canonical/Open Graph URLs and the sitemap will point at localhost.\n");
  }
  return {
    plugins: [react(), seo(siteUrl)],
    resolve: {
      alias: {
        // "@/*" -> "./src/*", mirrored in jsconfig.json for editors.
        "@": path.resolve(__dirname, "./src"),
      },
    },
    server: {
      port: 5173,
      host: true,
    },
  };
});
