import http from "node:http";
import { once } from "node:events";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const express = require("../server/node_modules/express");
const { asyncRoute, requireRole } = require("../server/shared/http");

export const ROLE = Object.freeze({
  STUDENT: "student",
  PARENT: "parent",
  SCHOOL: "school",
  STATE: "state",
  FEDERAL: "federal",
});

export function createStaticAuth(user) {
  return (req, res, next) => {
    if (!user) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    req.user = user;
    return next();
  };
}

export function createTestApp() {
  const app = express();
  app.use(
    express.json({
      limit: "4mb",
      verify(req, _res, buffer) {
        req.rawBody = buffer?.length ? buffer.toString("utf8") : "";
      },
    })
  );
  return app;
}

export async function withServer(app, run) {
  app.use((err, _req, res, next) => {
    void next;
    res.status(err?.status || 500).json({
      error: err?.message || "Internal server error",
    });
  });

  const server = http.createServer(app);
  server.listen(0, "127.0.0.1");
  await once(server, "listening");

  const address = server.address();
  const port = typeof address === "object" && address ? address.port : null;
  if (!Number.isInteger(port)) {
    throw new Error("Failed to resolve test server port");
  }

  async function request(path, options = {}) {
    const headers = new Headers(options.headers || {});
    let body = options.body;

    if (
      body !== undefined &&
      body !== null &&
      typeof body === "object" &&
      !(body instanceof ArrayBuffer) &&
      !(body instanceof URLSearchParams)
    ) {
      if (!headers.has("content-type")) {
        headers.set("content-type", "application/json");
      }
      body = JSON.stringify(body);
    }

    const response = await fetch(`http://127.0.0.1:${port}${path}`, {
      ...options,
      body,
      headers,
    });
    const text = await response.text();

    let payload = null;
    if (text) {
      try {
        payload = JSON.parse(text);
      } catch {
        payload = text;
      }
    }

    return {
      body: payload,
      response,
      status: response.status,
    };
  }

  try {
    return await run({
      asyncRoute,
      request,
      requireRole,
    });
  } finally {
    await new Promise((resolve, reject) => {
      server.close((error) => {
        if (error) reject(error);
        else resolve();
      });
    });
  }
}

export function requestIp() {
  return "127.0.0.1";
}

export { asyncRoute, requireRole };
