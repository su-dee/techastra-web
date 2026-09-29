// Sets the colour theme before the page paints (no flash of the wrong theme).
// Saved choice ("light" / "dark", from the navbar toggle) wins; otherwise the
// device setting is followed. Kept as a file, not inline, for the CSP.
(function () {
  var saved = null;
  try { saved = localStorage.getItem("techastra-theme"); } catch (e) {}
  var light = saved ? saved === "light" : window.matchMedia && window.matchMedia("(prefers-color-scheme: light)").matches;
  document.documentElement.setAttribute("data-theme", light ? "light" : "dark");
})();
