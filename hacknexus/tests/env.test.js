import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";

// Reads settings the way the app does, in a fresh process with the given environment.
const read = (env, names) =>
  JSON.parse(
    execFileSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        `import { setting, settings } from "./server/env.js";
         const names = ${JSON.stringify(names)};
         console.log(JSON.stringify(Object.fromEntries(names.map((n) => [n, [setting(n) ?? null, settings[n] ?? null]]))));`,
      ],
      { env: { PATH: process.env.PATH, SystemRoot: process.env.SystemRoot, ...env }, encoding: "utf8" },
    ),
  );

test("standalone, settings come from the environment as is", () => {
  const got = read({ DATABASE_URL: "postgres://hn", UPI_ID: "hn@upi" }, ["DATABASE_URL", "UPI_ID"]);
  assert.deepEqual(got, { DATABASE_URL: ["postgres://hn", "postgres://hn"], UPI_ID: ["hn@upi", "hn@upi"] });
});

test("embedded in the Techastra server, only HN_ settings are used", () => {
  const got = read(
    {
      HACKNEXUS_EMBEDDED: "1",
      DATABASE_URL: "postgres://techastra", // the host server's own - must be ignored
      SMTP_HOST: "techastra-smtp",
      HN_DATABASE_URL: "postgres://hn",
    },
    ["DATABASE_URL", "SMTP_HOST"],
  );
  assert.deepEqual(got, { DATABASE_URL: ["postgres://hn", "postgres://hn"], SMTP_HOST: [null, null] });
});
