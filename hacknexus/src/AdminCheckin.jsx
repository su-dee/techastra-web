import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  AlertTriangle,
  Camera,
  CameraOff,
  Check,
  LoaderCircle,
  X,
} from "lucide-react";
import { api } from "./api.js";
import { domainLabels, formatDate, useAdminData } from "./adminShared.jsx";

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

function ScanResult({ result, onDismiss }) {
  if (!result) return null;
  const { kind, squad, error } = result;
  const tone =
    kind === "checked_in" ? "ok" : kind === "already" ? "warn" : "bad";
  return (
    <div className={`scan-result ${tone}`} role="alert">
      <span className="scan-icon">
        {tone === "ok" ? (
          <Check size={28} />
        ) : tone === "warn" ? (
          <AlertTriangle size={26} />
        ) : (
          <X size={28} />
        )}
      </span>
      <div>
        <strong>
          {kind === "checked_in"
            ? "Checked in"
            : kind === "already"
              ? "Already checked in"
              : "Not admitted"}
        </strong>
        {squad ? (
          <>
            <p className="scan-team">{squad.team_name}</p>
            <p>
              {squad.squad_size} builders ·{" "}
              {domainLabels[squad.domain] || "Domain undecided"}
              {squad.problem_id ? ` · ${squad.problem_id}` : ""}
            </p>
            {kind === "already" && (
              <p>
                First scanned {formatDate(squad.checked_in_at)}
                {squad.checked_in_by ? ` by @${squad.checked_in_by}` : ""}
              </p>
            )}
          </>
        ) : (
          <p>{error}</p>
        )}
      </div>
      <button className="icon-button" onClick={onDismiss} aria-label="Dismiss">
        <X size={16} />
      </button>
    </div>
  );
}

export default function CheckIn({ onExpired }) {
  const video = useRef(null);
  const stream = useRef(null);
  const timer = useRef(0);
  const busy = useRef(false);
  const last = useRef({ code: "", at: 0 });
  const [camera, setCamera] = useState("off");
  const [cameraMessage, setCameraMessage] = useState("");
  const [result, setResult] = useState(null);
  const [manual, setManual] = useState("");
  const attendance = useAdminData("/admin/attendance", onExpired);
  const { reload } = attendance;

  const submit = useCallback(
    async (code) => {
      busy.current = true;
      try {
        const data = await api("/admin/attendance/scan", {
          method: "POST",
          body: { code },
        });
        setResult({ kind: data.result, squad: data.squad });
        navigator.vibrate?.(data.result === "checked_in" ? 80 : [60, 60, 60]);
        if (data.result === "checked_in") reload();
      } catch (e) {
        if (e.status === 401) return onExpired();
        setResult({ kind: "error", error: e.message });
        navigator.vibrate?.([120, 60, 120]);
      } finally {
        // Brief pause so the same card is not scanned repeatedly.
        setTimeout(() => (busy.current = false), 1500);
      }
    },
    [onExpired, reload],
  );

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
              await submit(code);
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

  const totals = attendance.data?.totals;
  return (
    <div className="checkin-layout">
      <section className="admin-card scanner-card">
        <div className="scanner-view">
          <video ref={video} muted playsInline aria-label="Camera preview" />
          {camera === "on" && (
            <span className="scan-frame" aria-hidden="true" />
          )}
          {camera !== "on" && (
            <div className="scanner-placeholder">
              {camera === "starting" ? (
                <LoaderCircle className="spin" size={28} />
              ) : (
                <Camera size={30} />
              )}
              <p>
                {camera === "starting"
                  ? "Starting camera…"
                  : "Scan squad ID card QR codes to mark attendance."}
              </p>
            </div>
          )}
        </div>
        <div className="scanner-controls">
          {camera === "on" ? (
            <button className="button ghost" onClick={stop}>
              <CameraOff size={16} /> Stop camera
            </button>
          ) : (
            <button
              className="button primary"
              onClick={start}
              disabled={camera === "starting"}
            >
              <Camera size={16} /> Start scanning
            </button>
          )}
        </div>
        {cameraMessage && (
          <p className="form-error" role="alert">
            {cameraMessage}
          </p>
        )}
        <ScanResult result={result} onDismiss={() => setResult(null)} />
        <form
          className="manual-code"
          onSubmit={(e) => {
            e.preventDefault();
            if (manual.trim()) submit(manual.trim());
            setManual("");
          }}
        >
          <label>
            Can’t scan? Type the code printed under the QR
            <span className="manual-row">
              <input
                value={manual}
                onChange={(e) => setManual(e.target.value)}
                placeholder="e.g. K7MQ-X2RT"
                autoComplete="off"
                spellCheck={false}
              />
              <button className="button ghost">Check in</button>
            </span>
          </label>
        </form>
      </section>
      <section className="admin-card">
        <h3>Attendance</h3>
        {totals && (
          <div className="attendance-totals">
            <div>
              <strong>
                {totals.checked_in}
                <small> / {totals.expected}</small>
              </strong>
              <span>squads checked in</span>
            </div>
            <div>
              <strong>{totals.people}</strong>
              <span>builders on site</span>
            </div>
          </div>
        )}
        <h4 className="recent-title">Recent check-ins</h4>
        {attendance.data?.recent.length ? (
          <ol className="recent-list">
            {attendance.data.recent.map((r) => (
              <li key={r.id}>
                <span>
                  <strong>{r.team_name}</strong>
                  <small>
                    {r.squad_size} builders
                    {r.checked_in_by ? ` · @${r.checked_in_by}` : ""}
                  </small>
                </span>
                <time>{formatDate(r.checked_in_at)}</time>
              </li>
            ))}
          </ol>
        ) : (
          <p className="admin-empty">No squads checked in yet.</p>
        )}
      </section>
    </div>
  );
}
