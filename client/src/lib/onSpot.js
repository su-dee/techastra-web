/**
 * On-spot registration mode. The registration desk shows a QR that opens
 * /events?onspot=<token>; the token (valid only that day) lets the
 * registration use the events' on-spot seats, and payment is cash at the
 * desk. It's kept in sessionStorage for this tab, so it survives moving
 * between pages and ends when the tab closes. The server checks the token;
 * /api/events answers { onSpot: false } for an expired one (confirmOnSpot).
 */
const KEY = "techastra_onspot";

/** Today's on-spot token, if this tab was opened from the desk's QR. */
export function getOnSpotToken() {
  try {
    const fromUrl = new URLSearchParams(window.location.search).get("onspot");
    if (fromUrl) sessionStorage.setItem(KEY, fromUrl);
    return sessionStorage.getItem(KEY) || "";
  } catch {
    return "";
  }
}

export function clearOnSpot() {
  try {
    sessionStorage.removeItem(KEY);
  } catch {
    /* storage blocked */
  }
}

/** The event list, with the on-spot seats counted when in on-spot mode. */
export function eventsPath() {
  const token = getOnSpotToken();
  return token ? `/api/events?onspot=${encodeURIComponent(token)}` : "/api/events";
}

/**
 * After loading eventsPath(): an expired or wrong token comes back as
 * onSpot: false - leave on-spot mode. Returns whether on-spot mode is on.
 */
export function confirmOnSpot(data) {
  if (!getOnSpotToken()) return false;
  if (data && data.onSpot === false) {
    clearOnSpot();
    return false;
  }
  return true;
}
