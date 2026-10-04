import { useCallback, useEffect, useRef, useState } from "react";

// Returns a function that reads a QR string from the current video frame.
async function createReader() {
  if ("BarcodeDetector" in window) {
    try {
      const formats = await window.BarcodeDetector.getSupportedFormats();
      if (formats.includes("qr_code")) {
        const detector = new window.BarcodeDetector({ formats: ["qr_code"] });
        return async (video) =>
          (await detector.detect(video))[0]?.rawValue || null;
      }
    } catch {}
  }
  // Fallback for browsers without BarcodeDetector (e.g. Safari).
  const { default: jsQR } = await import("jsqr");
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  // Read at up to 1280px wide: shrinking further makes the QR on a phone
  // screen too small to decode.
  return async (video) => {
    const scale = Math.min(1, 1280 / video.videoWidth);
    canvas.width = Math.round(video.videoWidth * scale);
    canvas.height = Math.round(video.videoHeight * scale);
    if (!canvas.width) return null;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
    return (
      jsQR(image.data, canvas.width, canvas.height, {
        inversionAttempts: "dontInvert",
      })?.data || null
    );
  };
}

function cameraError(error) {
  if (!window.isSecureContext)
    return "The camera needs a secure (HTTPS) connection. Open the admin console over HTTPS, or enter the code manually.";
  if (error?.name === "NotAllowedError")
    return "Camera permission was denied. Allow camera access for this site in your browser settings.";
  if (error?.name === "NotFoundError")
    return "No camera was found on this device.";
  return "The camera could not be started. Close other apps using it and try again.";
}

// Camera QR scanning for the check-in and food counters. `onCode(code)` runs
// for each new code (scanned, or typed via `run`); while it runs and for 1.5 s
// after, scanning pauses so the same card is not read repeatedly.
export default function useCameraScanner(onCode) {
  const video = useRef(null);
  const stream = useRef(null);
  const timer = useRef(0);
  const busy = useRef(false);
  const last = useRef({ code: "", at: 0 });
  const handler = useRef(onCode);
  handler.current = onCode;
  const [camera, setCamera] = useState("off");
  const [cameraMessage, setCameraMessage] = useState("");

  const run = useCallback(async (code) => {
    busy.current = true;
    try {
      await handler.current(code);
    } finally {
      setTimeout(() => (busy.current = false), 1500);
    }
  }, []);

  const stop = useCallback(() => {
    clearTimeout(timer.current);
    stream.current?.getTracks().forEach((t) => t.stop());
    stream.current = null;
    if (video.current) video.current.srcObject = null;
    setCamera("off");
  }, []);

  async function start() {
    setCameraMessage("");
    setCamera("starting");
    try {
      if (!navigator.mediaDevices?.getUserMedia)
        throw Object.assign(new Error(), { name: "Unsupported" });
      stream.current = await navigator.mediaDevices.getUserMedia({
        // Without a size, many phones give a 640×480 feed, too coarse for a
        // QR shown on another phone.
        video: {
          facingMode: { ideal: "environment" },
          width: { ideal: 1920 },
          height: { ideal: 1080 },
        },
        audio: false,
      });
      video.current.srcObject = stream.current;
      await video.current.play();
      const read = await createReader();
      setCamera("on");
      const tick = async () => {
        if (!stream.current) return;
        if (!busy.current && video.current.readyState >= 2) {
          try {
            const code = await read(video.current);
            const now = Date.now();
            if (
              code &&
              !(code === last.current.code && now - last.current.at < 6000)
            ) {
              last.current = { code, at: now };
              await run(code);
            }
          } catch {}
        }
        timer.current = setTimeout(tick, 180);
      };
      tick();
    } catch (error) {
      stop();
      setCameraMessage(cameraError(error));
    }
  }

  useEffect(() => stop, [stop]);

  return { video, camera, cameraMessage, start, stop, run };
}
