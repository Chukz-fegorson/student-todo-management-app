import { spawn } from "node:child_process";
import process from "node:process";

const backendBaseUrl = process.env.VITE_API_URL || "http://127.0.0.1:4000";
const backendHealthUrl = new URL("/health", backendBaseUrl).toString();
const backendTimeoutMs = Number(process.env.STUDYFLOW_BACKEND_TIMEOUT_MS || 45000);
const backendUrl = new URL(backendBaseUrl);
const shouldAutoStartLocalBackend =
  backendUrl.hostname === "localhost" || backendUrl.hostname === "127.0.0.1";

let backendChild = null;
let frontendChild = null;
let shuttingDown = false;

function log(message) {
  process.stdout.write(`[studyflow] ${message}\n`);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function isBackendHealthy() {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 2500);

  try {
    const response = await fetch(backendHealthUrl, {
      signal: controller.signal,
    });
    return response.ok;
  } catch {
    return false;
  } finally {
    clearTimeout(timeout);
  }
}

function runNpm(scriptName, name) {
  const child =
    process.platform === "win32"
      ? spawn("cmd.exe", ["/d", "/s", "/c", `npm run ${scriptName}`], {
          cwd: process.cwd(),
          env: process.env,
          stdio: "inherit",
        })
      : spawn("npm", ["run", scriptName], {
          cwd: process.cwd(),
          env: process.env,
          stdio: "inherit",
        });

  child.on("error", (error) => {
    log(`${name} failed to start: ${error.message}`);
  });

  return child;
}

async function waitForBackendReady(child) {
  const start = Date.now();

  while (Date.now() - start < backendTimeoutMs) {
    if (child.exitCode !== null) {
      throw new Error("Backend exited before /health became ready.");
    }

    if (await isBackendHealthy()) {
      return;
    }

    await sleep(1000);
  }

  throw new Error(
    `Backend did not become healthy at ${backendHealthUrl} within ${Math.round(
      backendTimeoutMs / 1000
    )} seconds.`
  );
}

function terminateChild(child) {
  if (!child || child.exitCode !== null) {
    return Promise.resolve();
  }

  if (process.platform === "win32") {
    return new Promise((resolve) => {
      const killer = spawn("taskkill", ["/pid", String(child.pid), "/T", "/F"], {
        stdio: "ignore",
      });
      killer.on("exit", () => resolve());
      killer.on("error", () => resolve());
    });
  }

  child.kill("SIGTERM");
  return Promise.resolve();
}

async function shutdown(exitCode = 0) {
  if (shuttingDown) return;
  shuttingDown = true;

  await Promise.all([terminateChild(frontendChild), terminateChild(backendChild)]);
  process.exit(exitCode);
}

async function main() {
  if (!shouldAutoStartLocalBackend) {
    log(`Skipping local backend auto-start because VITE_API_URL points to ${backendBaseUrl}.`);
    frontendChild = runNpm("frontend", "frontend");
    frontendChild.on("exit", (code) => {
      shutdown(code ?? 0);
    });
    return;
  }

  const backendAlreadyRunning = await isBackendHealthy();

  if (backendAlreadyRunning) {
    log(`Backend already running at ${backendBaseUrl}.`);
  } else {
    log(`Backend not reachable at ${backendBaseUrl}; starting local backend.`);
    backendChild = runNpm("backend", "backend");
    backendChild.on("exit", (code) => {
      if (!shuttingDown && frontendChild && frontendChild.exitCode === null) {
        log(`Backend exited with code ${code ?? 1}; stopping frontend.`);
        shutdown(code ?? 1);
      }
    });
    await waitForBackendReady(backendChild);
    log("Backend is healthy.");
  }

  frontendChild = runNpm("frontend", "frontend");
  frontendChild.on("exit", (code) => {
    shutdown(code ?? 0);
  });
}

process.on("SIGINT", () => {
  shutdown(0);
});

process.on("SIGTERM", () => {
  shutdown(0);
});

main().catch(async (error) => {
  log(error.message);
  await shutdown(1);
});
