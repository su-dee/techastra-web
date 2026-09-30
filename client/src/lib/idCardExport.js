import { toCanvas } from "html-to-image";

/**
 * Download / print for ParticipantIDCard, rendered at 4x its 400x600 layout
 * (1600x2400 px) - sharp enough to print. html-to-image has the browser
 * itself draw the card (SVG foreignObject), so text sits exactly where it
 * does on screen (html2canvas misplaced this font's text). Only the card
 * node is captured, so the on-screen fit-to-width scaling doesn't apply.
 */
async function renderCard(node) {
  if (document.fonts?.ready) await document.fonts.ready;
  await Promise.all(
    [...node.querySelectorAll("img")].map((img) =>
      img.complete ? null : new Promise((resolve) => img.addEventListener("load", resolve, { once: true }))
    )
  );
  const options = { pixelRatio: 4, width: node.offsetWidth, height: node.offsetHeight, cacheBust: false };
  // The first render can miss web fonts / images that are still being
  // inlined; the second is reliable.
  await toCanvas(node, options);
  return toCanvas(node, options);
}

const fileName = (name) => `Techastra26-ID-${String(name || "card").trim().replace(/[^a-z0-9]+/gi, "-")}.png`;

/** Saves the card as a high-resolution PNG. */
export async function downloadIdCard(node, name) {
  if (!node) return;
  const canvas = await renderCard(node);
  const a = document.createElement("a");
  a.href = canvas.toDataURL("image/png");
  a.download = fileName(name);
  document.body.appendChild(a);
  a.click();
  a.remove();
}

/**
 * Opens a print view with the card at 64 x 96 mm (2:3, fits a standard
 * badge holder) and a thin cut guide. The tab is opened inside the click so
 * pop-up blockers allow it; if it's blocked anyway, the PNG is downloaded.
 */
export async function printIdCard(node, name) {
  if (!node) return;
  const win = window.open("", "_blank");
  const canvas = await renderCard(node);
  const src = canvas.toDataURL("image/png");
  if (!win) {
    downloadIdCard(node, name);
    return;
  }
  win.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Techastra '26 ID card</title>
<style>
  @page { size: A4 portrait; margin: 15mm; }
  html, body { margin: 0; background: #fff; }
  .sheet { display: flex; justify-content: center; padding-top: 10mm; }
  img { width: 64mm; height: 96mm; outline: 0.2mm dashed #999; outline-offset: 1.5mm; }
</style></head><body><div class="sheet"><img alt="ID card"></div></body></html>`);
  win.document.close();
  // Print from here (no inline script in the new tab, so a strict CSP can't block it).
  const img = win.document.querySelector("img");
  img.addEventListener("load", () => setTimeout(() => { win.focus(); win.print(); }, 150), { once: true });
  img.src = src;
}
