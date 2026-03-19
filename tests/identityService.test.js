import assert from "node:assert/strict";
import test from "node:test";

import identityServiceModule from "../server/domains/identity/service.js";

const { createIdentityService } = identityServiceModule;

const ROLE = Object.freeze({
  STUDENT: "student",
  PARENT: "parent",
  SCHOOL: "school",
  STATE: "state",
  FEDERAL: "federal",
});

function createHarness(overrides = {}) {
  const calls = {
    audit: [],
    createSchool: [],
    createUser: [],
    setSchoolOwnerIfMissing: [],
  };

  const repo = {
    findUserIdByEmail: async () => null,
    findSchoolByNameStateLga: async () => null,
    createSchool: async (payload) => {
      calls.createSchool.push(payload);
    },
    createUser: async (payload) => {
      calls.createUser.push(payload);
    },
    setSchoolOwnerIfMissing: async (payload) => {
      calls.setSchoolOwnerIfMissing.push(payload);
    },
    findUserById: async (userId) => ({
      id: userId,
      name: calls.createUser[0]?.name || "Alpha College Owner",
      email: calls.createUser[0]?.email || "owner@example.com",
      role: calls.createUser[0]?.role || ROLE.SCHOOL,
      school_id: calls.createUser[0]?.schoolId || null,
      state_name: calls.createUser[0]?.stateName || "Lagos",
      lga_name: calls.createUser[0]?.lgaName || "Ikeja",
    }),
    findStudentByEmail: async () => null,
    upsertParentStudentLink: async () => {},
    ...overrides.repo,
  };

  const generatedIds = ["school-1", "user-1", "link-1"];
  let idIndex = 0;

  const service = createIdentityService({
    bcrypt: {
      hash: async (value) => `hashed:${value}`,
      compare: async () => true,
    },
    env: {
      JWT_SECRET: "test-secret",
      JWT_EXPIRES_IN: "7d",
      AUTH_RATE_WINDOW_MS: 60_000,
      AUTH_RATE_MAX_ATTEMPTS: 3,
      RESET_PASSWORD_TOKEN_TTL_MINUTES: 30,
      AUTH_DEBUG_RESET: false,
      APP_BASE_URL: "http://localhost:5173",
    },
    isUnder18Dob: () => true,
    makeId: () => generatedIds[idIndex++] || `generated-${idIndex}`,
    makeParentLinkCode: () => "PARENT42",
    mapUser: (user) => ({
      id: user.id,
      email: user.email,
      role: user.role,
      schoolId: user.school_id || null,
      stateName: user.state_name || null,
      lgaName: user.lga_name || null,
    }),
    nowIso: () => "2026-03-18T12:00:00.000Z",
    repo,
    ROLE,
    roleSignupLabels: {
      [ROLE.SCHOOL]: "School",
      [ROLE.STATE]: "State ministry",
      [ROLE.FEDERAL]: "Federal ministry",
    },
    safeAudit: (payload) => {
      calls.audit.push(payload);
    },
    signupKeysByRole: {
      [ROLE.SCHOOL]: "school-key",
      [ROLE.STATE]: "state-key",
      [ROLE.FEDERAL]: "federal-key",
    },
  });

  return {
    calls,
    context: {
      method: "POST",
      path: "/auth/register",
      forwardedFor: "",
      rawIp: "127.0.0.1",
      socketIp: "127.0.0.1",
      requestIp: "127.0.0.1",
      userAgent: "node-test",
    },
    repo,
    service,
  };
}

test("school registration rejects an invalid privileged signup key", async () => {
  const { calls, context, service } = createHarness();

  const result = await service.register(
    {
      name: "Alpha College Owner",
      email: "owner@example.com",
      password: "password123",
      role: ROLE.SCHOOL,
      schoolName: "Alpha College",
      stateName: "Lagos",
      lgaName: "Ikeja",
      providedSignupKey: "wrong-key",
    },
    context
  );

  assert.equal(result.status, 403);
  assert.match(result.body.error, /signup key is invalid/i);
  assert.equal(calls.createSchool.length, 0);
  assert.equal(calls.createUser.length, 0);
});

test("school registration keeps the school scope and assigns the owner", async () => {
  const { calls, context, service } = createHarness();

  const result = await service.register(
    {
      name: "Alpha College Owner",
      email: "owner@example.com",
      password: "password123",
      role: ROLE.SCHOOL,
      schoolName: "Alpha College",
      stateName: "Lagos",
      lgaName: "Ikeja",
      providedSignupKey: "school-key",
    },
    context
  );

  assert.equal(result.status, 201);
  assert.equal(calls.createSchool.length, 1);
  assert.equal(calls.createSchool[0].id, "school-1");
  assert.equal(calls.createUser.length, 1);
  assert.equal(calls.createUser[0].schoolId, "school-1");
  assert.equal(calls.setSchoolOwnerIfMissing.length, 1);
  assert.deepEqual(calls.setSchoolOwnerIfMissing[0], {
    userId: "user-1",
    schoolId: "school-1",
  });
  assert.equal(result.body.user.schoolId, "school-1");
  assert.equal(result.body.user.role, ROLE.SCHOOL);
  assert.equal(typeof result.body.token, "string");
  assert.ok(result.body.token.length > 20);
});
