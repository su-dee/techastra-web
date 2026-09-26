const colors = {
  reset: "\x1b[0m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  yellow: "\x1b[33m",
  red: "\x1b[31m",
  cyan: "\x1b[36m",
  magenta: "\x1b[35m",
};

function statusColor(status) {
  if (status >= 500) return colors.red;
  if (status >= 400) return colors.yellow;
  if (status >= 300) return colors.cyan;
  return colors.green;
}

/**
 * Prints every incoming API request to the terminal running `npm run dev` -
 * this is the server-side half of end-to-end logging. Browser console.log()
 * calls never reach this terminal (they run in a completely separate
 * process - the browser tab), so this middleware plus the /api/logs/client
 * route (which the frontend posts click events to) are what actually make
 * activity visible here in VS Code.
 *
 * Example line:
 *   [12:04:31] POST /api/registrations 201 (42ms)
 */
function requestLogger(req, res, next) {
  const start = Date.now();
  const timestamp = new Date().toLocaleTimeString();

  res.on("finish", () => {
    const duration = Date.now() - start;
    // Production: one JSON line per request, path only - query strings can
    // carry personal data (e.g. /status?email=...), so they are never logged.
    if (process.env.NODE_ENV === "production") {
      console.log(JSON.stringify({ t: new Date().toISOString(), method: req.method, path: req.path, status: res.statusCode, ms: duration }));
      return;
    }
    const color = statusColor(res.statusCode);
    console.log(
      `${colors.dim}[${timestamp}]${colors.reset} ${colors.magenta}${req.method}${colors.reset} ${req.originalUrl} ${color}${res.statusCode}${colors.reset} ${colors.dim}(${duration}ms)${colors.reset}`
    );
  });

  next();
}

module.exports = requestLogger;
