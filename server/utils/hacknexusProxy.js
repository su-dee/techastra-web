/**
 * Forwards /hacknexus/... to the Hack Nexus app (a separate Node app, see
 * hacknexus/ and PRODUCTION.md), so both sites share one domain. The path is
 * passed through unchanged - Hack Nexus runs with BASE_PATH=/hacknexus.
 * Enabled when HACKNEXUS_ORIGIN is set, e.g. "http://127.0.0.1:3001" or the
 * Plesk subdomain it runs on ("https://hn.techastra.drmgrdu.ac.in").
 * hostHeader (HACKNEXUS_HOST) names the site to ask for while connecting to
 * the origin's address - e.g. origin "http://127.0.0.1" + host
 * "hn.techastra.drmgrdu.ac.in" reaches the Plesk subdomain on the same server
 * without a public DNS record for it.
 * Mounted before the body parsers so request bodies stream through untouched.
 */
const http = require("http");
const https = require("https");

function hackNexusProxy(targetOrigin, hostHeader) {
  const target = new URL(targetOrigin);
  const client = target.protocol === "https:" ? https : http;
  return (req, res) => {
    const headers = { ...req.headers, host: hostHeader || target.host };
    headers["x-forwarded-host"] = req.headers.host || "";
    headers["x-forwarded-proto"] = req.protocol;
    headers["x-forwarded-for"] = req.headers["x-forwarded-for"] ? `${req.headers["x-forwarded-for"]}, ${req.ip}` : req.ip;
    const upstream = client.request(
      {
        protocol: target.protocol,
        hostname: target.hostname,
        port: target.port || (target.protocol === "https:" ? 443 : 80),
        method: req.method,
        path: req.originalUrl, // keeps the /hacknexus prefix
        headers,
        ...(hostHeader && target.protocol === "https:" ? { servername: hostHeader.split(":")[0] } : {}),
        timeout: 30_000,
      },
      (upRes) => {
        res.writeHead(upRes.statusCode || 502, upRes.headers);
        upRes.pipe(res);
      }
    );
    upstream.on("timeout", () => upstream.destroy(new Error("Hack Nexus timed out")));
    upstream.on("error", (err) => {
      console.error("Hack Nexus proxy error:", err.message);
      if (!res.headersSent) res.status(502).type("text/plain").send("Hack Nexus is temporarily unavailable. Please try again shortly.");
      else res.end();
    });
    req.pipe(upstream);
  };
}

module.exports = { hackNexusProxy };
