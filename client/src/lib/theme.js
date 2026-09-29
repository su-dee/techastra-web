import { useEffect, useState } from "react";

// Current colour theme ("dark" | "light"), from <html data-theme> (set by
// public/theme-init.js and components/ThemeToggle.jsx). For places that can't
// use CSS variables - e.g. chart colours passed to SVG attributes.
const read = () => document.documentElement.getAttribute("data-theme") || "dark";

export function useThemeMode() {
  const [theme, setTheme] = useState(read);
  useEffect(() => {
    const mo = new MutationObserver(() => setTheme(read()));
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => mo.disconnect();
  }, []);
  return theme;
}
