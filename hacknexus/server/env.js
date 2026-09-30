// Where Hack Nexus reads its settings.
// Standalone it uses the environment as is. Embedded in the Techastra '26
// server (HACKNEXUS_EMBEDDED=1) it shares that process's environment, so it
// reads only HN_-prefixed variables (HN_DATABASE_URL -> DATABASE_URL) and
// never picks up Techastra's own DATABASE_URL, SMTP settings etc.
export const embedded = process.env.HACKNEXUS_EMBEDDED === "1";

export const setting = (name) =>
  embedded ? process.env[`HN_${name}`] : process.env[name];

// The same, as an object: settings.DATABASE_URL, { SMTP_HOST } = settings.
export const settings = new Proxy(
  {},
  {
    get: (_, name) => (typeof name === "string" ? setting(name) : undefined),
    has: (_, name) => typeof name === "string" && setting(name) !== undefined,
  },
);
