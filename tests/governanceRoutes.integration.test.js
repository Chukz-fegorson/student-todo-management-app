import assert from "node:assert/strict";
import test from "node:test";

import governanceRoutesModule from "../server/domains/governance/routes.js";
import {
  ROLE,
  createStaticAuth,
  createTestApp,
  requireRole,
  withServer,
} from "./serverRouteHarness.js";

const { registerGovernanceRoutes } = governanceRoutesModule;

function createGovernanceFixture() {
  const service = {
    async getOverview(actor, input) {
      return {
        status: 200,
        body: { role: actor.role, schoolId: input.schoolId || null },
      };
    },
    async getIntelligence(actor, input) {
      return {
        status: 200,
        body: {
          days: input.days || null,
          role: actor.role,
        },
      };
    },
    async getScorecard() {
      return { status: 200, body: { ok: true } };
    },
    async listAuditEvents() {
      return { status: 200, body: [] };
    },
  };
  const validators = {
    parseAnalyticsIntelligenceQuery: (query) => query,
    parseAnalyticsOverviewQuery: (query) => query,
    parseAnalyticsScorecardQuery: (query) => query,
    parseAuditEventsQuery: (query) => query,
  };

  return { service, validators };
}

test("governance routes return analytics for school-scoped actors", async () => {
  const app = createTestApp();
  const { service, validators } = createGovernanceFixture();

  registerGovernanceRoutes({
    app,
    auth: createStaticAuth({ id: "school-1", role: ROLE.SCHOOL }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/analytics/overview?schoolId=school-9");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      role: ROLE.SCHOOL,
      schoolId: "school-9",
    });
  });
});

test("governance routes expose intelligence reporting for governance actors", async () => {
  const app = createTestApp();
  const { service, validators } = createGovernanceFixture();

  registerGovernanceRoutes({
    app,
    auth: createStaticAuth({ id: "state-1", role: ROLE.STATE }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/analytics/intelligence?days=45");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, {
      days: "45",
      role: ROLE.STATE,
    });
  });
});

test("governance routes reject analytics access for students", async () => {
  const app = createTestApp();
  const { service, validators } = createGovernanceFixture();

  registerGovernanceRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/analytics/overview");
    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Forbidden for this role" });
  });
});
