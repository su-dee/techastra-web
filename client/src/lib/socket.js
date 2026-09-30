import { io } from "socket.io-client";

// Same rule as lib/api.js: same domain in production, :4000 in development.
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");

let socket = null;

/** Lazily creates a single shared Socket.io connection for the app. */
export function getSocket() {
  if (!socket) {
    socket = API_URL ? io(API_URL, { autoConnect: true, reconnection: true }) : io({ autoConnect: true, reconnection: true });
  }
  return socket;
}
