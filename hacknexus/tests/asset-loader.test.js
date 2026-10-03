import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";

const script = await readFile(
  new URL("../public/asset-loader.js", import.meta.url),
  "utf8",
);

function boot() {
  const timers = new Map(),
    listeners = new Map();
  let id = 0;
  const elements = {
    "boot-loader": {
      hidden: true,
      removed: false,
      classes: new Set(),
      handlers: new Map(),
      classList: {
        add(name) {
          this.owner.classes.add(name);
        },
        owner: null,
      },
      remove() {
        this.removed = true;
      },
      addEventListener(name, fn) {
        this.handlers.set(name, fn);
      },
    },
    "boot-message": { textContent: "Loading assets" },
    "boot-state": { textContent: "INITIALIZING" },
    "boot-retry": { hidden: true },
    "boot-output": {
      children: [{ textContent: "$ hacknexus --initialize" }],
      dataset: {},
      append(child) {
        this.children.push(child);
      },
    },
  };
  elements["boot-loader"].classList.owner = elements["boot-loader"];
  // <html>: the loader marks it "hn-loading", then "hn-loaded" once it's gone.
  const rootClasses = new Set();
  const documentElement = {
    classList: { add: (n) => rootClasses.add(n), remove: (n) => rootClasses.delete(n) },
  };
  const createElement = (tag) => ({
    children: [],
    textContent: "",
    className: "",
    append(...children) {
      this.children.push(...children);
    },
  });
  vm.runInNewContext(script, {
    document: { getElementById: (key) => elements[key], createElement, documentElement },
    window: {
      addEventListener: (name, fn) => listeners.set(name, fn),
      matchMedia: () => ({ matches: false }),
    },
    setInterval: (fn, delay) => {
      timers.set(++id, { fn, delay, interval: true });
      return id;
    },
    clearInterval: (key) => timers.delete(key),
    setTimeout: (fn, delay) => {
      timers.set(++id, { fn, delay });
      return id;
    },
    clearTimeout: (key) => timers.delete(key),
  });
  return {
    elements,
    rootClasses,
    event: (name, event = {}) => listeners.get(name)?.(event),
    advance: (delay) => {
      for (const [key, timer] of [...timers])
        if (!timer.interval && timer.delay <= delay) {
          timers.delete(key);
          timer.fn();
        }
    },
  };
}

test("cached assets bypass the terminal loader", () => {
  const b = boot();
  assert.equal(b.rootClasses.has("hn-loading"), true);
  b.event("hn:assets-ready");
  b.advance(220);
  assert.equal(b.elements["boot-loader"].hidden, true);
  assert.equal(b.elements["boot-loader"].removed, true);
  // The page's entrance animations may start.
  assert.equal(b.rootClasses.has("hn-loading"), false);
  assert.equal(b.rootClasses.has("hn-loaded"), true);
});

test("pending assets show the terminal, then hand off to the website", () => {
  const b = boot();
  b.advance(220);
  assert.equal(b.elements["boot-loader"].hidden, false);
  b.event("hn:assets-ready");
  assert.equal(b.elements["boot-state"].textContent, "SYSTEM READY");
  assert.equal(b.elements["boot-loader"].classes.has("boot-exit"), true);
  assert.match(
    b.elements["boot-output"].children.at(-1).textContent,
    /all assets online/,
  );
  // Still covered during the exit animation; handed off once it ends.
  assert.equal(b.rootClasses.has("hn-loaded"), false);
  b.elements["boot-loader"].handlers.get("animationend")();
  assert.equal(b.elements["boot-loader"].removed, true);
  assert.equal(b.rootClasses.has("hn-loaded"), true);
});

test("asset failures reveal a retry instead of leaving the terminal loading", () => {
  const b = boot();
  b.event("error", { target: { tagName: "SCRIPT" } });
  assert.equal(b.elements["boot-loader"].hidden, false);
  assert.equal(b.elements["boot-retry"].hidden, false);
  assert.match(b.elements["boot-message"].textContent, /could not load/);
});
