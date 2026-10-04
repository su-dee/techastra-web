import React, { useState } from "react";
import { Camera, CameraOff, LoaderCircle } from "lucide-react";

// The camera view, start/stop button and "type the code" box shared by the
// check-in and food counters. `scanner` comes from useCameraScanner; the
// scan result (or anything else) goes in `children`, above the code box.
export default function ScannerPanel({ scanner, idleText, submitLabel, children }) {
  const { video, camera, cameraMessage, start, stop, run } = scanner;
  const [manual, setManual] = useState("");
  return (
    <>
      <div className="scanner-view">
        <video ref={video} muted playsInline aria-label="Camera preview" />
        {camera === "on" && <span className="scan-frame" aria-hidden="true" />}
        {camera !== "on" && (
          <div className="scanner-placeholder">
            {camera === "starting" ? (
              <LoaderCircle className="spin" size={28} />
            ) : (
              <Camera size={30} />
            )}
            <p>{camera === "starting" ? "Starting camera…" : idleText}</p>
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
      {children}
      <form
        className="manual-code"
        onSubmit={(e) => {
          e.preventDefault();
          if (manual.trim()) run(manual.trim());
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
            <button className="button ghost">{submitLabel}</button>
          </span>
        </label>
      </form>
    </>
  );
}
