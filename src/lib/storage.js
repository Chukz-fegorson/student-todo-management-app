const PREFIX = "studyflow_";
const SESSION_KEY = "stu_session";
const TOKEN_KEY = "stu_token";

export function storageGet(key, fallback = null) {
  try {
    const raw = localStorage.getItem(PREFIX + key);
    if (!raw) return fallback;
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function storageSet(key, value) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch (error) {
    console.warn("Storage set failed:", error);
  }
}

export function storageDel(key) {
  try {
    localStorage.removeItem(PREFIX + key);
  } catch (error) {
    console.warn("Storage delete failed:", error);
  }
}

export function getSession() {
  return storageGet(SESSION_KEY, null);
}

export function setSession(user) {
  storageSet(SESSION_KEY, user);
}

export function clearSession() {
  storageDel(SESSION_KEY);
}

export function getToken() {
  return storageGet(TOKEN_KEY, "");
}

export function setToken(token) {
  storageSet(TOKEN_KEY, token || "");
}

export function clearToken() {
  storageDel(TOKEN_KEY);
}

export function clearAllAuth() {
  clearSession();
  clearToken();
}
