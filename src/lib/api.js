import { clearAllAuth, getToken, setToken, clearToken } from "./storage";

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:4000";

async function request(path, options = {}) {
  const token = getToken();
  let response;

  try {
    response = await fetch(`${BASE_URL}${path}`, {
      method: options.method || "GET",
      headers: {
        "Content-Type": "application/json",
        ...(options.headers || {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: options.body ? JSON.stringify(options.body) : undefined,
    });
  } catch {
    // Surface a stable message when the API is down or blocked by the browser.
    throw new Error(
      `Cannot reach StudyFlow backend at ${BASE_URL}. Check that the server is running and CORS is configured for this frontend origin.`
    );
  }

  const text = await response.text();
  let payload = null;

  try {
    payload = text ? JSON.parse(text) : null;
  } catch {
    payload = { message: text };
  }

  if (!response.ok) {
    if (response.status === 401) clearAllAuth();
    const errorMessage =
      payload?.error ||
      payload?.message ||
      `Request failed with status ${response.status}`;
    throw new Error(errorMessage);
  }

  return payload;
}

export const api = (path, options) => request(path, options);
export const apiGet = (path) => request(path, { method: "GET" });
export const apiPost = (path, body) => request(path, { method: "POST", body });
export const apiPut = (path, body) => request(path, { method: "PUT", body });
export const apiDel = (path) => request(path, { method: "DELETE" });

export { getToken, setToken, clearToken };
