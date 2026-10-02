import React, { useEffect, useState } from "react";
import Modal from "./ui/Modal";

// Remembered for the browser session, so a school student isn't asked again
// on every tab switch, but a new visit (or a shared device) sees it again.
const ACK_KEY = "techastra_junior_notice_ack";

function acknowledged() {
  try { return sessionStorage.getItem(ACK_KEY) === "1"; } catch { return false; }
}

/**
 * Pops up whenever Junior events are opened: Junior Techastra is for school
 * students only, and college students' registrations are rejected.
 * `onCollege` sends a college student back to the Senior events.
 */
export default function JuniorNotice({ active, onCollege }) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (active && !acknowledged()) setOpen(true);
    if (!active) setOpen(false);
  }, [active]);

  const confirmSchool = () => {
    try { sessionStorage.setItem(ACK_KEY, "1"); } catch { /* storage unavailable */ }
    setOpen(false);
  };

  return (
    <Modal open={open} onClose={() => setOpen(false)} size="sm" kicker="Important notice" title="Junior events are for school students only">
      <p className="text-[15px] leading-relaxed text-soft">
        <strong className="text-heading">Junior Techastra</strong> and all Junior events are exclusively for{" "}
        <strong className="text-heading">school students</strong>.
      </p>
      <p role="alert" className="mt-4 rounded-[10px] border border-danger/40 bg-danger/10 px-4 py-3 text-[14px] text-danger">
        If you are a college student, your Junior registration will be rejected.
      </p>
      <div className="flex flex-col gap-3 mt-6">
        <button type="button" className="btn-small !py-3 text-center" onClick={confirmSchool} data-log="junior-notice-school">
          I’m a school student - continue
        </button>
        <button
          type="button"
          className="btn-ghost-sm !py-3 text-center"
          onClick={() => {
            setOpen(false);
            onCollege();
          }}
          data-log="junior-notice-college"
        >
          I’m a college student - show Senior events
        </button>
      </div>
    </Modal>
  );
}
