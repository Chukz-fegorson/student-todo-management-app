import assert from "node:assert/strict";
import test from "node:test";

import identityRoutesModule from "../server/domains/identity/routes.js";
import {
  ROLE,
  createStaticAuth,
  createTestApp,
  requestIp,
  withServer,
} from "./serverRouteHarness.js";

const { registerIdentityRoutes } = identityRoutesModule;

function createIdentityFixture() {
  const events = [];
  const service = {
    async listDirectorySchools() {
      return [{ id: "school-1", name: "Alpha Academy" }];
    },
    async login(input) {
      if (input.password !== "correct-password") {
        return {
          status: 401,
          body: { error: "Invalid credentials" },
        };
      }

      return {
        status: 200,
        body: { token: "token-123" },
      };
    },
    register(input, context) {
      events.push({ type: "register", input, context });
      return Promise.resolve({
        status: 201,
        body: { email: input.email, ok: true },
      });
    },
    requestPasswordReset(input) {
      events.push({ type: "forgot", input });
      return Promise.resolve({
        status: 200,
        body: { ok: true, stage: "forgot" },
      });
    },
    resetPassword(input) {
      events.push({ type: "reset", input });
      return Promise.resolve({
        status: 200,
        body: { ok: true, stage: "reset" },
      });
    },
    getCurrentUser(user) {
      return {
        status: 200,
        body: { id: user.id, role: user.role },
      };
    },
    updateCurrentUser(input, user) {
      return Promise.resolve({
        status: 200,
        body: { id: user.id, ...input },
      });
    },
  };
  const validators = {
    parseDirectorySchoolsQuery: (query) => query,
    parseForgotPasswordBody: (body) => body,
    parseLoginBody: (body) => body,
    parseProfileUpdateBody: (body) => body,
    parseRegisterBody: (body) => body,
    parseResetPasswordBody: (body) => body,
  };

  return { events, service, validators };
}

test("identity routes cover register, forgot/reset, and protected me flow", async () => {
  const app = createTestApp();
  const { events, service, validators } = createIdentityFixture();

  registerIdentityRoutes({
    app,
    auth: createStaticAuth({ id: "user-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const registerResponse = await request("/auth/register", {
      body: { email: "ada@example.com", password: "secret" },
      method: "POST",
    });
    assert.equal(registerResponse.status, 201);
    assert.deepEqual(registerResponse.body, { email: "ada@example.com", ok: true });

    const forgotResponse = await request("/auth/forgot-password", {
      body: { email: "ada@example.com" },
      method: "POST",
    });
    assert.equal(forgotResponse.status, 200);
    assert.deepEqual(forgotResponse.body, { ok: true, stage: "forgot" });

    const resetResponse = await request("/auth/reset-password", {
      body: { token: "reset-token", password: "new-secret" },
      method: "POST",
    });
    assert.equal(resetResponse.status, 200);
    assert.deepEqual(resetResponse.body, { ok: true, stage: "reset" });

    const meResponse = await request("/me");
    assert.equal(meResponse.status, 200);
    assert.deepEqual(meResponse.body, { id: "user-1", role: ROLE.STUDENT });
  });

  assert.equal(events.length, 3);
  assert.equal(events[0].type, "register");
  assert.equal(events[0].context.path, "/auth/register");
  assert.equal(events[0].context.requestIp, "127.0.0.1");
});

test("identity routes preserve login failures and protect me when auth is missing", async () => {
  const app = createTestApp();
  const { service, validators } = createIdentityFixture();

  registerIdentityRoutes({
    app,
    auth: createStaticAuth(null),
    asyncRoute: (handler) => handler,
    requestIp,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const loginResponse = await request("/auth/login", {
      body: { email: "ada@example.com", password: "wrong-password" },
      method: "POST",
    });
    assert.equal(loginResponse.status, 401);
    assert.deepEqual(loginResponse.body, { error: "Invalid credentials" });

    const meResponse = await request("/me");
    assert.equal(meResponse.status, 401);
    assert.deepEqual(meResponse.body, { error: "Unauthorized" });
  });
});
