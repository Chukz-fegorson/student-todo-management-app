import assert from "node:assert/strict";
import test from "node:test";

import collaborationRoutesModule from "../server/domains/collaboration/routes.js";
import {
  ROLE,
  createStaticAuth,
  createTestApp,
  requestIp,
  requireRole,
  withServer,
} from "./serverRouteHarness.js";

const { registerCollaborationRoutes } = collaborationRoutesModule;

test("collaboration routes expose external AI summary generation for authenticated users", async () => {
  const app = createTestApp();
  const service = {
    async generateMeetingSummary(actor, input) {
      return {
        status: 200,
        body: {
          actionPlan: [],
          generatedAt: "2026-03-19T12:00:00.000Z",
          keyPoints: ["Follow-up locked"],
          provider: {
            mode: "openai_compatible",
            model: "gpt-4.1-mini",
            source: "external",
          },
          requestedBy: actor.id,
          summaryText: `Summary for ${input.meetingTitle}`,
          todos: ["Send recap"],
        },
      };
    },
  };
  const validators = {
    parseAiMeetingSummaryBody: (body) => body,
  };

  registerCollaborationRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    requireRole,
    ROLE,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/ai/meeting-summary", {
      body: {
        meetingTitle: "Weekly Sync",
        transcript: "We agreed to send the recap today and confirm the blocker owner.",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.requestedBy, "student-1");
    assert.equal(response.body.summaryText, "Summary for Weekly Sync");
    assert.equal(response.body.provider.source, "external");
    assert.deepEqual(response.body.todos, ["Send recap"]);
  });
});

test("collaboration routes keep AI summary endpoint behind the same role guard", async () => {
  const app = createTestApp();

  registerCollaborationRoutes({
    app,
    auth: createStaticAuth({ id: "parent-1", role: ROLE.PARENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    requireRole,
    ROLE,
    service: {
      async generateMeetingSummary() {
        return { status: 200, body: { ok: true } };
      },
    },
    validators: {
      parseAiMeetingSummaryBody: (body) => body,
    },
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/ai/meeting-summary", {
      body: {
        meetingTitle: "Weekly Sync",
        transcript: "We agreed to send the recap today and confirm the blocker owner.",
      },
      method: "POST",
    });

    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Forbidden for this role" });
  });
});
