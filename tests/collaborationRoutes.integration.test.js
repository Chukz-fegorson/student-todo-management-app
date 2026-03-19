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

test("collaboration routes expose AI summary provider status for authenticated users", async () => {
  const app = createTestApp();

  registerCollaborationRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    requireRole,
    ROLE,
    service: {
      async getAiMeetingSummaryStatus() {
        return {
          status: 200,
          body: {
            checkedAt: "2026-03-19T12:30:00.000Z",
            effectiveProvider: {
              source: "external",
              mode: "openai_compatible",
              model: "gpt-4.1-mini",
            },
            externalProvider: {
              available: true,
              readiness: "ready",
              mode: "openai_compatible",
              model: "gpt-4.1-mini",
              timeoutMs: 35000,
            },
            capabilities: {
              summary: true,
              transcription: true,
            },
            transcriptionProvider: {
              available: true,
              model: "gpt-4o-mini-transcribe",
              path: "/audio/transcriptions",
            },
            fallbackProvider: {
              available: true,
              source: "local",
              mode: "deterministic_nlp",
            },
          },
        };
      },
    },
    validators: {
      parseAiMeetingSummaryBody: (body) => body,
    },
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/ai/meeting-summary/status");

    assert.equal(response.status, 200);
    assert.equal(response.body.effectiveProvider.source, "external");
    assert.equal(response.body.externalProvider.readiness, "ready");
    assert.equal(response.body.fallbackProvider.mode, "deterministic_nlp");
  });
});

test("collaboration routes expose external AI transcript generation for authenticated users", async () => {
  const app = createTestApp();

  registerCollaborationRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    requireRole,
    ROLE,
    service: {
      async generateMeetingTranscript(actor, input) {
        return {
          status: 200,
          body: {
            generatedAt: "2026-03-19T12:45:00.000Z",
            provider: {
              mode: "openai_compatible",
              model: "gpt-4o-mini-transcribe",
              source: "external",
              type: "transcription",
            },
            requestedBy: actor.id,
            text: `Transcript for ${input.meetingTitle}`,
          },
        };
      },
    },
    validators: {
      parseAiMeetingSummaryBody: (body) => body,
      parseAiMeetingTranscriptBody: (body) => body,
    },
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/ai/meeting-transcript", {
      body: {
        audio: {
          dataUrl: "data:audio/mpeg;base64,QUJDRA==",
          mimeType: "audio/mpeg",
          name: "meeting.mp3",
        },
        meetingTitle: "Weekly Sync",
      },
      method: "POST",
    });

    assert.equal(response.status, 200);
    assert.equal(response.body.requestedBy, "student-1");
    assert.equal(response.body.provider.type, "transcription");
    assert.equal(response.body.text, "Transcript for Weekly Sync");
  });
});

test("collaboration routes queue AI transcript jobs for authenticated users", async () => {
  const app = createTestApp();

  registerCollaborationRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    requireRole,
    ROLE,
    service: {
      async createMeetingTranscriptJob(actor, input) {
        return {
          status: 202,
          body: {
            attachmentName: input.audio?.name || "meeting.mp3",
            createdAt: "2026-03-19T13:00:00.000Z",
            id: "job-1",
            meetingId: input.meetingId || null,
            pollAfterMs: 2500,
            status: "queued",
            updatedAt: "2026-03-19T13:00:00.000Z",
          },
        };
      },
    },
    validators: {
      parseAiMeetingSummaryBody: (body) => body,
      parseAiMeetingTranscriptBody: (body) => body,
      parseAiMeetingTranscriptJobIdParam: (params) => ({ transcriptJobId: params.id }),
    },
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/ai/meeting-transcript/jobs", {
      body: {
        audio: {
          dataUrl: "data:audio/mpeg;base64,QUJDRA==",
          mimeType: "audio/mpeg",
          name: "meeting.mp3",
        },
        meetingId: "meeting-1",
        meetingTitle: "Weekly Sync",
      },
      method: "POST",
    });

    assert.equal(response.status, 202);
    assert.equal(response.body.id, "job-1");
    assert.equal(response.body.status, "queued");
    assert.equal(response.body.meetingId, "meeting-1");
  });
});

test("collaboration routes expose transcript job status for authenticated users", async () => {
  const app = createTestApp();

  registerCollaborationRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requestIp,
    requireRole,
    ROLE,
    service: {
      async getMeetingTranscriptJob(actor, jobId) {
        return {
          status: 200,
          body: {
            attachmentName: "meeting.mp3",
            createdAt: "2026-03-19T13:00:00.000Z",
            id: jobId,
            pollAfterMs: 2500,
            result: {
              generatedAt: "2026-03-19T13:02:00.000Z",
              provider: {
                source: "external",
                type: "transcription",
              },
              text: `Transcript ready for ${actor.id}`,
            },
            status: "completed",
            updatedAt: "2026-03-19T13:02:00.000Z",
          },
        };
      },
    },
    validators: {
      parseAiMeetingSummaryBody: (body) => body,
      parseAiMeetingTranscriptBody: (body) => body,
      parseAiMeetingTranscriptJobIdParam: (params) => ({ transcriptJobId: params.id }),
    },
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/ai/meeting-transcript/jobs/job-1");

    assert.equal(response.status, 200);
    assert.equal(response.body.id, "job-1");
    assert.equal(response.body.status, "completed");
    assert.equal(response.body.result.provider.type, "transcription");
    assert.equal(response.body.result.text, "Transcript ready for student-1");
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
      async generateMeetingTranscript() {
        return { status: 200, body: { ok: true } };
      },
    },
    validators: {
      parseAiMeetingSummaryBody: (body) => body,
      parseAiMeetingTranscriptBody: (body) => body,
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
