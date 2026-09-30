/**
 * Serves the Hack Nexus app (../hacknexus, an ES module on Express 5) inside
 * this server at /hacknexus - one process, one Plesk app, no proxying.
 * Enabled with HACKNEXUS_EMBEDDED=1. Hack Nexus reads only HN_-prefixed
 * variables (HN_DATABASE_URL, HN_APP_ORIGIN, HN_SMTP_*, ...), so it never
 * sees this server's own settings. See PRODUCTION.md.
 *
 * Mount it before this server's own middleware: Hack Nexus sets its own
 * security headers (its QR check-in needs the camera, which ours block),
 * parses its own bodies and has its own rate limits.
 */
const path = require("path");
const { pathToFileURL } = require("url");

const PREFIX = "/hacknexus";

function hackNexusEmbedded({ dir = path.join(__dirname, "..", "..", "hacknexus"), production, trustProxy } = {}) {
  process.env.HACKNEXUS_EMBEDDED = "1"; // read by hacknexus/server/env.js
  const entry = pathToFileURL(path.join(dir, "server", "embedded.js")).href;
  const loading = import(entry).then((m) => m.createEmbeddedApp({ production, trustProxy }));
  loading.then(
    () => console.log(`Hack Nexus is served at ${PREFIX}/`),
    (err) => console.error("Hack Nexus failed to load - /hacknexus is unavailable:", err.message)
  );

  const middleware = async (req, res, next) => {
    if (req.path !== PREFIX && !req.path.startsWith(`${PREFIX}/`)) return next();
    if (req.path === PREFIX) {
      const query = req.originalUrl.slice(req.originalUrl.indexOf(PREFIX) + PREFIX.length);
      return res.redirect(301, `${PREFIX}/${query}`);
    }
    let hn;
    try {
      hn = await loading;
    } catch {
      return res.status(503).type("text/plain").send("Hack Nexus is temporarily unavailable. Please try again shortly.");
    }
    // Hand the request over as if it had arrived at Hack Nexus directly:
    // Express 5 swaps in its own req/res prototypes; drop the query object
    // this server's Express 4 parsed so Hack Nexus parses it its own way.
    // Everything is put back if Hack Nexus passes the request on.
    const reqProto = Object.getPrototypeOf(req);
    const resProto = Object.getPrototypeOf(res);
    const saved = { query: req.query, params: req.params, baseUrl: req.baseUrl, url: req.url };
    delete req.query;
    hn.app(req, res, (err) => {
      Object.setPrototypeOf(req, reqProto);
      Object.setPrototypeOf(res, resProto);
      Object.assign(req, saved);
      next(err);
    });
  };
  middleware.ready = loading;
  return middleware;
}

module.exports = { hackNexusEmbedded };
