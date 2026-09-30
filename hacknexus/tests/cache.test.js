import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile, readdir } from "node:fs/promises";
import request from "supertest";
import { createApp } from "../server/app.js";
const app = createApp(
  { query: async () => ({ rows: [] }) },
  { production: true, origin: "https://hacknexus.example" },
);
test("production HTML revalidates and serves direct login routes", async () => {
  const response = await request(app).get("/login").expect(200);
  assert.match(response.text, /HACK_NEXUS/);
  assert.equal(response.headers["cache-control"], "no-cache");
});
test("hashed scripts, styles, and fonts use immutable browser caching", async () => {
  const assets = await readdir(new URL("../dist/assets", import.meta.url));
  for (const ext of [".js", ".css", ".woff2"]) {
    const name = assets.find((name) => name.endsWith(ext));
    assert.ok(name);
    const response = await request(app).get(`/assets/${name}`).expect(200);
    assert.match(response.headers["cache-control"], /max-age=31536000/);
    assert.match(response.headers["cache-control"], /immutable/);
  }
});
test("every challenge has complete brief content and a unique identifier", async () => {
  const { problems, faqs } = JSON.parse(
    await readFile(new URL("../src/content.json", import.meta.url)),
  );
  assert.equal(problems.length, 15);
  assert.equal(faqs.length, 6);
  assert.equal(new Set(problems.map((p) => p.id)).size, 15);
  for (const p of problems)
    for (const field of ["problem", "challenge", "deliverable", "stretch"])
      assert.ok(p[field].length > 20);
});
