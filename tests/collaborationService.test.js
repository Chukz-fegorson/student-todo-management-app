import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createCollaborationService } = require("../server/domains/collaboration/service.js");
const crypto = require("node:crypto");

function createService(options = {}) {
  return createCollaborationService({
    aiSummaryProvider: options.aiSummaryProvider,
    crypto,
    DEFAULT_REMINDER_OFFSETS: [],
    JITSI_BASE_URL: "https://meet.studyflow.test",
    makeId: options.makeId || (() => "job-1"),
    mapUser: (user) => user,
    normalizeIdArray: (value) => (Array.isArray(value) ? value : []),
    normalizeOptionalText: (value) => String(value || "").trim(),
    normalizeText: (value) => String(value || "").trim(),
    nowIso: options.nowIso || (() => new Date().toISOString()),
    parseOptionalDeadline: (value) => value,
    repo: {
      isMeetingParticipant: async () => true,
      ...(options.repo || {}),
    },
    safeAudit: () => {},
    safeNotify: () => {},
    listAccessibleUsers: async () => [],
  });
}

test("collaboration service queues transcript jobs and exposes completed results", async () => {
  let resolveTranscript;
  const service = createService({
    aiSummaryProvider: {
      canTranscribeAudio: () => true,
      transcribeMeetingAudio: async () =>
        new Promise((resolve) => {
          resolveTranscript = resolve;
        }),
    },
  });

  const created = await service.createMeetingTranscriptJob(
    { id: "student-1", role: "student" },
    {
      audio: {
        dataUrl: "data:audio/mpeg;base64,QUJDRA==",
        mimeType: "audio/mpeg",
        name: "meeting.mp3",
      },
      meetingId: "meeting-1",
      meetingTitle: "Weekly Sync",
    },
    {}
  );

  assert.equal(created.status, 202);
  assert.equal(created.body.id, "job-1");
  assert.equal(created.body.status, "queued");

  const initialRead = await service.getMeetingTranscriptJob(
    { id: "student-1", role: "student" },
    "job-1"
  );
  assert.equal(initialRead.status, 200);
  assert.match(initialRead.body.status, /queued|processing/);

  resolveTranscript({
    generatedAt: "2026-03-19T13:02:00.000Z",
    provider: {
      model: "gpt-4o-mini-transcribe",
      source: "external",
      type: "transcription",
    },
    text: "Jude should go shopping by 2pm.",
  });

  await new Promise((resolve) => setTimeout(resolve, 0));

  const completed = await service.getMeetingTranscriptJob(
    { id: "student-1", role: "student" },
    "job-1"
  );

  assert.equal(completed.status, 200);
  assert.equal(completed.body.status, "completed");
  assert.equal(completed.body.result.text, "Jude should go shopping by 2pm.");
  assert.equal(completed.body.result.provider.type, "transcription");
});

test("collaboration service keeps transcript jobs scoped to the creating user", async () => {
  const service = createService({
    aiSummaryProvider: {
      canTranscribeAudio: () => true,
      transcribeMeetingAudio: async () => ({
        generatedAt: "2026-03-19T13:02:00.000Z",
        provider: {
          source: "external",
          type: "transcription",
        },
        text: "Transcript body.",
      }),
    },
  });

  await service.createMeetingTranscriptJob(
    { id: "student-1", role: "student" },
    {
      audio: {
        dataUrl: "data:audio/mpeg;base64,QUJDRA==",
        mimeType: "audio/mpeg",
        name: "meeting.mp3",
      },
      meetingId: "meeting-1",
    },
    {}
  );

  await new Promise((resolve) => setTimeout(resolve, 0));

  const denied = await service.getMeetingTranscriptJob(
    { id: "student-2", role: "student" },
    "job-1"
  );

  assert.equal(denied.status, 404);
  assert.deepEqual(denied.body, { error: "Transcript job not found" });
});
