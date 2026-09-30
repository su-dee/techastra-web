/**
 * Runs the Hack Nexus app as a child process of this server, for hosting
 * where it can't have its own (sub)domain - e.g. a Plesk plan that can't
 * create hn.techastra.drmgrdu.ac.in. Enabled with HACKNEXUS_START=1; the
 * /hacknexus proxy then points at it (see index.js and PRODUCTION.md).
 *
 * Hack Nexus gets a clean environment - never this server's DATABASE_URL,
 * JWT_SECRET etc. Its settings come from hacknexus/.env on the server, or
 * from variables here prefixed HN_ (HN_DATABASE_URL -> DATABASE_URL), which
 * take precedence. It listens on 127.0.0.1:HACKNEXUS_PORT (default 3001) and
 * is restarted if it stops.
 */
const net = require("net");
const path = require("path");
const { spawn } = require("child_process");

// OS variables a Node process needs; everything else is left out.
const PASS_THROUGH = ["PATH", "HOME", "USER", "LANG", "TZ", "TMPDIR", "TEMP", "TMP", "SystemRoot", "PATHEXT", "COMSPEC", "USERPROFILE", "APPDATA", "LOCALAPPDATA"];

function childEnv(port) {
  const env = {};
  for (const key of PASS_THROUGH) if (process.env[key] !== undefined) env[key] = process.env[key];
  env.NODE_ENV = process.env.NODE_ENV || "production";
  env.BASE_PATH = "/hacknexus";
  env.TRUST_PROXY = "1";
  for (const [key, value] of Object.entries(process.env)) if (key.startsWith("HN_")) env[key.slice(3)] = value;
  env.PORT = String(port);
  return env;
}

function portOpen(port) {
  return new Promise((resolve) => {
    const socket = net.connect({ host: "127.0.0.1", port }, () => { socket.destroy(); resolve(true); });
    socket.on("error", () => resolve(false));
    socket.setTimeout(1000, () => { socket.destroy(); resolve(false); });
  });
}

function startHackNexus({ dir = path.join(__dirname, "..", "..", "hacknexus"), port = 3001 } = {}) {
  let child = null;
  let stopping = false;
  let delay = 2000;

  async function launch() {
    if (stopping) return;
    // Another copy of this server may already be running it (e.g. a second
    // Passenger process) - use that one and check again later.
    if (await portOpen(port)) return setTimeout(launch, 30000).unref();
    child = spawn(process.execPath, ["--env-file-if-exists=.env", "server/index.js"], { cwd: dir, env: childEnv(port), stdio: ["ignore", "pipe", "pipe"] });
    const log = (stream, write) => stream.on("data", (d) => String(d).trimEnd().split("\n").forEach((line) => write(`[hacknexus] ${line}`)));
    log(child.stdout, console.log);
    log(child.stderr, console.error);
    const startedAt = Date.now();
    child.on("exit", (code, signal) => {
      child = null;
      if (stopping) return;
      if (Date.now() - startedAt > 60000) delay = 2000; // ran fine for a while - reset the back-off
      console.error(`[hacknexus] stopped (${signal || `exit ${code}`}); restarting in ${delay / 1000}s`);
      setTimeout(launch, delay).unref();
      delay = Math.min(delay * 2, 60000);
    });
  }

  const stop = () => {
    stopping = true;
    if (child) child.kill("SIGTERM");
  };
  process.on("exit", stop);
  for (const signal of ["SIGINT", "SIGTERM"]) process.once(signal, () => { stop(); process.kill(process.pid, signal); });

  launch();

  // Express middleware: hold a request (up to 20 s) while Hack Nexus is still
  // starting, instead of failing it straight away.
  const waitUntilReady = async (req, res, next) => {
    for (let waited = 0; waited < 20000; waited += 500) {
      if (await portOpen(port)) return next();
      await new Promise((r) => setTimeout(r, 500));
    }
    next(); // the proxy then answers "temporarily unavailable"
  };
  return { origin: `http://127.0.0.1:${port}`, waitUntilReady, stop };
}

module.exports = { startHackNexus };
