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
    async getScorecard() {
      return { status: 200, body: { ok: true } };
    },
    async listAuditEvents() {
      return { status: 200, body: [] };
    },
  };
  const validators = {
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
