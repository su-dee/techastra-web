import React, { useEffect, useRef, useState } from "react";
import { Html5Qrcode } from "html5-qrcode";

const SCANNER_ELEMENT_ID = "qr-scanner-viewport";

/** Translates raw getUserMedia/html5-qrcode errors into an actionable message. */
function describeCameraError(err) {
  const name = err?.name || "";
  const message = String(err?.message || err || "");

  if (name === "NotAllowedError" || name === "PermissionDeniedError" || /permission denied/i.test(message)) {
    return "Camera permission was denied. Click the camera/lock icon in your browser's address bar, allow camera access for this site, then reload and try again.";
  }
  if (name === "NotFoundError" || name === "DevicesNotFoundError" || /no camera devices found/i.test(message)) {
    return "No camera was found on this computer. If you're on a desktop with no webcam, use the manual search option instead.";
  }
  if (name === "NotReadableError" || name === "TrackStartError" || /could not start video source/i.test(message)) {
    return "Your camera is already in use by another app or browser tab (e.g. Zoom, Teams, another site). Close it and try again.";
  }
  if (name === "OverconstrainedError" || name === "ConstraintNotSatisfiedError") {
    return "This camera doesn't support the requested settings. Try a different camera if one is available.";
  }
  if (name === "SecurityError") {
    return "Camera access was blocked for security reasons. Make sure you're on HTTPS or http://localhost.";
  }
  return `Could not access the camera (${name || "unknown error"}). Check permissions, close other apps using the camera, and try again — or use manual search instead.`;
}

/**
 * Full-screen-modal-friendly camera QR scanner.
 * Calls onScan(decodedText) once per successful decode, then briefly pauses
 * to avoid firing the same scan multiple times in a row.
 */
export default function QRScanner({ onScan, active = true }) {
  const scannerRef = useRef(null);
  const [error, setError] = useState(null);
  const [ready, setReady] = useState(false);
  const pausedRef = useRef(false);

  useEffect(() => {
    if (!active) return;

    // A secure context (HTTPS, or http://localhost) is required for camera
    // access at all - on plain http://<lan-ip> the browser blocks
    // getUserMedia outright, before any permission prompt even appears.
    if (!window.isSecureContext) {
      setError(
        "Camera access requires a secure connection. Open this page over HTTPS, or via http://localhost (not a plain IP address like http://192.168.x.x), then try again."
      );
      return;
    }

    let cancelled = false;
    let cleanedUp = false;
    const html5QrCode = new Html5Qrcode(SCANNER_ELEMENT_ID);
    scannerRef.current = html5QrCode;

    // Hard fallback: directly stop every MediaStream track feeding any
    // <video> element inside the scanner viewport, independent of
    // whether html5-qrcode's own stop()/clear() promises ever resolve.
    // This is the actual fix for "scan on a phone, then the page never
    // comes back" - the previous cleanup called stop() and clear() in
    // PARALLEL (`.stop().catch(...)` and `.clear().catch(...)` fired
    // back-to-back with no `await` between them), which is a documented
    // html5-qrcode race: clear() can run while stop() is still mid-way
    // through asynchronously releasing the camera track, especially on
    // mobile Safari/Chrome - leaving an active camera stream held open
    // with no UI left able to release it, which is exactly what makes a
    // page "not come back" after scanning (it looks frozen/stuck until
    // force-reloaded, because the camera hardware lock never actually
    // let go).
    // The scanner's own element, kept so the cleanup can still reach its
    // <video> after React has removed it from the page.
    const container = document.getElementById(SCANNER_ELEMENT_ID);
    const forceReleaseCamera = () => {
      const videos = container ? container.querySelectorAll("video") : [];
      videos.forEach((video) => {
        const stream = video.srcObject;
        if (stream && typeof stream.getTracks === "function") {
          stream.getTracks().forEach((track) => track.stop());
        }
        video.srcObject = null;
      });
    };

    const config = { fps: 10, qrbox: { width: 240, height: 240 } };
    const onSuccess = (decodedText) => {
      if (cancelled || pausedRef.current) return;
      pausedRef.current = true;
      onScan(decodedText);
      setTimeout(() => {
        pausedRef.current = false;
      }, 2000);
    };
    const onDecodeError = () => {
      // decode errors fire continuously while no QR is in frame - ignore
    };

    // Prefer the rear/back camera (ideal for phones/tablets at a check-in
    // desk). Most laptops only expose a single front-facing webcam and have
    // no "environment" camera at all, which makes a strict facingMode
    // constraint fail (silently, in some browsers) - so we fall back to
    // whatever camera is actually available instead of erroring out.
    // Settles once the camera is running (or failed to start) - the cleanup
    // waits for it, see below.
    const started = html5QrCode
      .start({ facingMode: "environment" }, config, onSuccess, onDecodeError)
      .then(() => {
        if (!cancelled) setReady(true);
      })
      .catch(async () => {
        try {
          const cameras = await Html5Qrcode.getCameras();
          if (!cameras || cameras.length === 0) {
            throw new Error("No camera devices found on this computer.");
          }
          // Fall back to the first available camera (typically the laptop webcam).
          await html5QrCode.start(cameras[0].id, config, onSuccess, onDecodeError);
          if (!cancelled) setReady(true);
        } catch (err) {
          console.error("QR scanner start error:", err);
          if (!cancelled) setError(describeCameraError(err));
        }
      });

    return () => {
      cancelled = true;
      if (cleanedUp) return;
      cleanedUp = true;

      // Wait for the camera start to settle first: stopping a scanner that
      // is still starting fails ("not running"), and the camera would then
      // come up anyway and keep scanning in the background with no UI
      // (closing the scanner within a second of opening it, or React's
      // dev-mode double mount). Then `stop()` is awaited BEFORE `clear()`
      // (not in parallel, per the bug note above) so the camera track is
      // released first. Both THROW synchronously (rather than rejecting)
      // when the scanner isn't running, so they run inside the chain, where
      // a throw is just a swallowed rejection - never a page crash. Whatever
      // happens, `forceReleaseCamera()` runs last.
      started
        .catch(() => {})
        .then(() => html5QrCode.stop())
        .catch(() => {})
        .then(() => html5QrCode.clear())
        .catch(() => {})
        .finally(forceReleaseCamera);
    };
  }, [active, onScan]);

  return (
    <div className="relative">
      <div id={SCANNER_ELEMENT_ID} className="w-full rounded-xl overflow-hidden bg-black min-h-[280px]" />
      {ready && (
        <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
          <div className="relative w-56 h-56 border-2 border-gold/70 rounded-xl overflow-hidden">
            <div className="absolute left-0 right-0 h-0.5 bg-gold animate-scanline" />
          </div>
        </div>
      )}
      {error && (
        <p className="text-danger text-sm mt-3 text-center">{error}</p>
      )}
    </div>
  );
}
