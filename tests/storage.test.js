import assert from "node:assert/strict";
import test from "node:test";

import {
  clearAllAuth,
  getSession,
  getToken,
  setSession,
  setToken,
  storageDel,
  storageGet,
  storageSet,
} from "../src/lib/storage.js";

function createLocalStorageMock() {
  const store = new Map();
  return {
    getItem(key) {
      return store.has(key) ? store.get(key) : null;
    },
    setItem(key, value) {
      store.set(key, String(value));
    },
    removeItem(key) {
      store.delete(key);
    },
    clear() {
      store.clear();
    },
  };
}

test("storage helpers persist values and clear auth state", () => {
  const previousLocalStorage = globalThis.localStorage;
  globalThis.localStorage = createLocalStorageMock();

  storageSet("prefs", { compact: true });
  assert.deepEqual(storageGet("prefs"), { compact: true });

  setSession({ id: "user-1", role: "student" });
  setToken("token-1");
  assert.deepEqual(getSession(), { id: "user-1", role: "student" });
  assert.equal(getToken(), "token-1");

  storageDel("prefs");
  assert.equal(storageGet("prefs", null), null);

  clearAllAuth();
  assert.equal(getSession(), null);
  assert.equal(getToken(), "");

  globalThis.localStorage = previousLocalStorage;
});
