// The site's path prefix ("" at the domain root, "/hacknexus" inside the
// Techastra '26 site) - set at build time by Vite's `base` (BASE_PATH).
export const BASE = import.meta.env.BASE_URL.replace(/\/$/, "");

/** A site path with the prefix: to("/payment") -> "/hacknexus/payment". */
export const to = (path) => BASE + path;

/** The current page's path without the prefix ("/", "/login", "/admin"...). */
export const currentPath = () => {
  const p = location.pathname;
  const rest = BASE && p.startsWith(BASE) ? p.slice(BASE.length) : p;
  return rest.replace(/\/+$/, "") || "/";
};
