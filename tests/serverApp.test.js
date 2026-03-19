import assert from "node:assert/strict";
import http from "node:http";
import { once } from "node:events";
import test from "node:test";

import appModule from "../server/app.js";

const { createApp } = appModule;

test("createApp builds a health endpoint from injected dependencies", async () => {
  const queries = [];
  const pool = {
    async query(sql) {
      queries.push(sql);
      return { rows: [{ ok: 1 }] };
    },
  };

  const { app } = createApp({
    env: {
      PORT: 4000,
      JWT_SECRET: "test-secret",
      JWT_EXPIRES_IN: "7d",
      JITSI_BASE_URL: "https://meet.jit.si",
      AUTH_RATE_WINDOW_MS: 60_000,
      AUTH_RATE_MAX_ATTEMPTS: 10,
      RESET_PASSWORD_TOKEN_TTL_MINUTES: 30,
      AUTH_DEBUG_RESET: false,
      APP_BASE_URL: "http://localhost:5173",
      SCHOOL_SIGNUP_KEY: "",
      STATE_SIGNUP_KEY: "",
      FEDERAL_SIGNUP_KEY: "",
    },
    pool,
  });

  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  assert.ok(Number.isInteger(port));

  try {
    const response = await fetch(`http://127.0.0.1:${port}/health`);
    const payload = await response.json();

    assert.equal(response.status, 200);
    assert.deepEqual(payload, { ok: true });
    assert.equal(queries.length, 1);
    assert.match(String(queries[0]), /SELECT 1 AS ok/);
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
});
