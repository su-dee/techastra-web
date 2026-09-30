(() => {
  const overlay = document.getElementById("boot-loader");
  const output = document.getElementById("boot-output");
  const message = document.getElementById("boot-message");
  const state = document.getElementById("boot-state");
  const retry = document.getElementById("boot-retry");
  let finished = false;
  let failed = false;
  let characterTimer;
  let currentOutput;
  let sequence = 0;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
  const transcript = [
    "// loading application bundle",
    "// resolving local stylesheets",
    "// checking fonts and visual assets",
    "// waking up the challenge library",
  ];
  function typeLine(line) {
    if (finished || failed) return;
    const row = document.createElement("p");
    const number = document.createElement("span");
    const text = document.createElement("code");
    number.textContent = String(output.children.length + 1).padStart(2, "0");
    text.textContent = "$ ";
    row.append(number, text);
    output.append(row);
    currentOutput = text;
    if (reducedMotion.matches) {
      text.textContent += line;
      currentOutput = undefined;
      if (sequence < transcript.length) {
        const next = transcript[sequence++];
        setTimeout(() => typeLine(next), 0);
      }
      return;
    }
    let cursor = 0;
    characterTimer = setInterval(() => {
      text.textContent += line[cursor++];
      if (cursor >= line.length) {
        clearInterval(characterTimer);
        characterTimer = undefined;
        currentOutput = undefined;
        if (sequence < transcript.length) {
          const next = transcript[sequence++];
          setTimeout(() => typeLine(next), 240);
        }
      }
    }, 17);
  }
  function showLoader(force = false) {
    if (finished || (failed && !force)) return;
    overlay.hidden = false;
    if (!output.dataset.started) {
      output.dataset.started = "true";
      typeLine(transcript[sequence++]);
    }
  }
  // Warm-cache visits bypass the loader. A real pending load gets the terminal.
  const showTimer = setTimeout(showLoader, 220);
  const slowTimer = setTimeout(() => {
    if (!finished && !failed) {
      showLoader();
      state.textContent = "CONNECTION DELAYED";
      message.textContent =
        "Assets are taking longer than expected. Check your connection.";
      retry.hidden = false;
    }
  }, 15000);
  window.addEventListener(
    "hn:assets-ready",
    () => {
      finished = true;
      clearTimeout(showTimer);
      clearTimeout(slowTimer);
      clearInterval(characterTimer);
      if (overlay.hidden || reducedMotion.matches) {
        overlay.remove();
        return;
      }
      if (currentOutput) {
        currentOutput.textContent += " …";
        currentOutput = undefined;
      }
      state.textContent = "SYSTEM READY";
      const ready = document.createElement("p");
      ready.className = "boot-ready";
      ready.textContent = "✓ all assets online — entering the arena";
      output.append(ready);
      message.textContent = "Welcome to HACK_NEXUS 1.0.";
      overlay.classList.add("boot-exit");
      overlay.addEventListener("animationend", () => overlay.remove(), {
        once: true,
      });
      setTimeout(() => overlay.remove(), 850);
    },
    { once: true },
  );
  window.addEventListener(
    "error",
    (event) => {
      const failedAppAsset =
        event.target?.tagName === "SCRIPT" ||
        (event.target?.tagName === "LINK" &&
          event.target.rel?.toLowerCase() === "stylesheet");
      if (!finished && failedAppAsset) {
        failed = true;
        clearInterval(characterTimer);
        clearTimeout(showTimer);
        clearTimeout(slowTimer);
        showLoader(true);
        state.textContent = "BOOT INTERRUPTED";
        message.textContent =
          "An application asset could not load. Please retry.";
        retry.hidden = false;
      }
    },
    true,
  );
})();
