import { BASE } from "./base.js";
// Shared JSON client for the participant site and admin console.
export async function api(url, options = {}) {
  let response;
  try {
    response = await fetch(`${BASE}/api${url}`, {
      credentials: "same-origin",
      ...options,
      headers: { "Content-Type": "application/json", ...options.headers },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    throw new Error("The server could not be reached. Please try again.");
  }
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error("The server could not be reached. Please try again.");
  }
  if (!response.ok) {
    const error = new Error(
      data.error || "Something went wrong. Please try again.",
    );
    error.status = response.status;
    throw error;
  }
  return data;
}
