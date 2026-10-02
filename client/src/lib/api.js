// Production: the API is on the same domain (the server also serves this
// site), so calls are relative. Development: the local API on :4000.
// VITE_API_URL overrides both (e.g. an API on another domain).
const API_URL = import.meta.env.VITE_API_URL ?? (import.meta.env.DEV ? "http://localhost:4000" : "");

function getToken() {
  return localStorage.getItem("techastra_token");
}

/**
 * Thin fetch wrapper: prefixes the API base URL, attaches the JWT if present,
 * JSON-encodes bodies (unless FormData is passed), and throws a normalized
 * Error with the server's message on non-2xx responses.
 */
async function request(path, { method = "GET", body, headers = {}, isFormData = false } = {}) {
  const token = getToken();
  const finalHeaders = { ...headers };
  if (!isFormData) finalHeaders["Content-Type"] = "application/json";
  if (token) finalHeaders["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers: finalHeaders,
    body: body ? (isFormData ? body : JSON.stringify(body)) : undefined,
  });

  let data = null;
  try {
    data = await res.json();
  } catch {
    // no JSON body (e.g. CSV download) - handled by caller
  }

  if (!res.ok) {
    const message = data?.error || `Request failed with status ${res.status}`;
    throw Object.assign(new Error(message), { status: res.status });
  }

  return data;
}

export const api = {
  get: (path) => request(path),
  post: (path, body, opts = {}) => request(path, { method: "POST", body, ...opts }),
  put: (path, body) => request(path, { method: "PUT", body }),
  patch: (path, body) => request(path, { method: "PATCH", body }),
  delete: (path) => request(path, { method: "DELETE" }),
  baseUrl: API_URL,
  /** Fetches an authenticated file (e.g. a payment screenshot) as a Blob. */
  blob: async (path) => {
    const token = getToken();
    const res = await fetch(`${API_URL}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      let message = `Request failed with status ${res.status}`;
      try {
        message = (await res.json()).error || message;
      } catch {
        /* not JSON */
      }
      throw new Error(message);
    }
    return res.blob();
  },
};

export function setToken(token) {
  if (token) localStorage.setItem("techastra_token", token);
  else localStorage.removeItem("techastra_token");
}

export function getStoredToken() {
  return getToken();
}
