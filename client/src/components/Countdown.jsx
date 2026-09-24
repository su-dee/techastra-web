import React, { useEffect, useState } from "react";
import { EVENT_START } from "../lib/site";

const target = new Date(EVENT_START).getTime();

function remaining() {
  const ms = Math.max(0, target - Date.now());
  return {
    Days: Math.floor(ms / 86400000),
    Hours: Math.floor(ms / 3600000) % 24,
    Minutes: Math.floor(ms / 60000) % 60,
    Seconds: Math.floor(ms / 1000) % 60,
  };
}

export default function Countdown() {
  const [t, setT] = useState(remaining);

  useEffect(() => {
    const id = setInterval(() => setT(remaining()), 1000);
    return () => clearInterval(id);
  }, []);

  if (target <= Date.now()) return null;

  return (
    <div className="countdown" role="timer" aria-label="Time until Techastra ’26 begins">
      <div className="kicker">Event starts in</div>
      <div className="countdown__units">
        {Object.entries(t).map(([k, v]) => (
          <div className="countdown__unit" key={k}>
            <span className="countdown__v">{String(v).padStart(2, "0")}</span>
            <span className="stat__k">{k}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
