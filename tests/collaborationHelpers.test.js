import assert from "node:assert/strict";
import test from "node:test";

import {
  buildMeetingCallJoinUrl,
  buildMeetingCallPreflightReport,
  buildMeetingTaskSuggestions,
  buildMeetingDraftStorageKey,
  createMeetingDraftSnapshot,
  parseMeetingDraftSnapshot,
  resolveMeetingTaskDeadline,
  summarizeMeetingDeviceInventory,
  shouldRestoreMeetingDraft,
} from "../src/lib/collaboration.js";

test("collaboration draft snapshots keep recoverable text data and omit media payloads", () => {
  const snapshot = createMeetingDraftSnapshot({
    acceptedSummaryTodos: [
      "Send recap to the parent group",
      "Send recap to the parent group",
      "short",
    ],
    attachments: [
      {
        id: "transcript-1",
        kind: "transcript",
        name: "meeting.txt",
        content: "We agreed to send the recap today.",
        mimeType: "text/plain",
        size: 36,
      },
      {
        id: "audio-1",
        kind: "audio",
        name: "recording.mp3",
        url: "data:audio/mpeg;base64,AAAA",
      },
    ],
    callSession: {
      active: true,
      meetingId: "meeting-1",
      startedAt: "2026-03-19T14:00:00.000Z",
      joinUrl: "https://studyflow.test/call",
    },
    meetingId: "meeting-1",
    summary: {
      summaryText: "Budget recap ready.",
      attachments: [{ id: "audio-1", kind: "audio", url: "data:audio/mpeg;base64,AAAA" }],
    },
    transcript: "We agreed to send the recap today.",
    transcriptionJob: {
      attachmentName: "meeting.mp3",
      id: "job-1",
      meetingId: "meeting-1",
      pollAfterMs: 2500,
      status: "processing",
      updatedAt: "2026-03-19T14:10:00.000Z",
    },
  });

  assert.equal(
    buildMeetingDraftStorageKey({ userId: "student-1", meetingId: "meeting-1" }),
    "studyflow:collab:draft:student-1:meeting-1"
  );
  assert.equal(snapshot.mediaAttachmentCount, 1);
  assert.deepEqual(snapshot.acceptedSummaryTodos, ["Send recap to the parent group"]);
  assert.deepEqual(snapshot.transcriptAttachments, [
    {
      id: "transcript-1",
      kind: "transcript",
      name: "meeting.txt",
      content: "We agreed to send the recap today.",
      mimeType: "text/plain",
      size: 36,
    },
  ]);
  assert.deepEqual(snapshot.summary.attachments, snapshot.transcriptAttachments);
  assert.deepEqual(snapshot.transcriptionJob, {
    attachmentName: "meeting.mp3",
    createdAt: null,
    error: "",
    finishedAt: null,
    id: "job-1",
    meetingId: "meeting-1",
    meetingTitle: null,
    pollAfterMs: 2500,
    result: null,
    startedAt: null,
    status: "processing",
    updatedAt: "2026-03-19T14:10:00.000Z",
  });
});

test("collaboration draft snapshots parse safely and restore only when they are still relevant", () => {
  const parsed = parseMeetingDraftSnapshot(
    JSON.stringify({
      acceptedSummaryTodos: ["Prepare follow-up agenda"],
      callSession: {
        active: false,
        meetingId: "meeting-2",
        startedAt: "2026-03-19T10:00:00.000Z",
        joinUrl: "",
      },
      meetingId: "meeting-2",
      savedAt: "2026-03-19T11:30:00.000Z",
      summary: {
        summaryText: "Agenda notes kept locally.",
      },
      transcript: "Draft notes from the interrupted session.",
      transcriptAttachments: [
        {
          id: "transcript-2",
          kind: "transcript",
          name: "agenda.txt",
          content: "Draft notes from the interrupted session.",
          mimeType: "text/plain",
          size: 41,
        },
      ],
      transcriptionJob: {
        attachmentName: "meeting.mp3",
        id: "job-2",
        meetingId: "meeting-2",
        pollAfterMs: 2500,
        status: "queued",
      },
    })
  );

  assert.ok(parsed);
  assert.equal(
    shouldRestoreMeetingDraft({
      draft: parsed,
      meetingNotesUpdatedAt: "2026-03-19T10:45:00.000Z",
    }),
    true
  );
  assert.equal(
    shouldRestoreMeetingDraft({
      draft: parsed,
      meetingNotesUpdatedAt: "2026-03-19T12:00:00.000Z",
    }),
    false
  );
  assert.equal(
    shouldRestoreMeetingDraft({
      draft: {
        ...parsed,
        callSession: { ...parsed.callSession, active: true },
      },
      meetingNotesUpdatedAt: "2026-03-19T12:00:00.000Z",
    }),
    true
  );
  assert.equal(parsed.transcriptionJob.id, "job-2");
  assert.equal(parseMeetingDraftSnapshot("{bad json"), null);
});

test("collaboration helpers build editable task suggestions with due-time inference", () => {
  const suggestions = buildMeetingTaskSuggestions(
    {
      actionPlan: [
        {
          action: "go shopping",
          confidence: 0.94,
          due: "by 2pm",
          outcome: "Groceries purchased",
          owner: "Jude",
          urgency: "High",
        },
      ],
      todos: ["Jude: go shopping"],
    },
    {
      id: "meeting-3",
      scheduledFor: "2026-03-19T10:00:00.000Z",
      title: "Family Errands",
    }
  );

  assert.equal(suggestions.length, 1);
  assert.equal(suggestions[0].title, "Jude: go shopping");
  assert.match(suggestions[0].description, /Groceries purchased/);
  assert.match(suggestions[0].description, /Due cue: by 2pm/);
  assert.equal(
    resolveMeetingTaskDeadline({
      dueText: "by 2pm",
      meeting: { scheduledFor: "2026-03-19T10:00:00.000Z" },
    }),
    "2026-03-19T13:00:00.000Z"
  );
});

test("collaboration helpers build stable join urls for fresh and rejoin call sessions", () => {
  assert.equal(
    buildMeetingCallJoinUrl("https://meet.jit.si/studyflow-room"),
    "https://meet.jit.si/studyflow-room#config.prejoinPageEnabled=false"
  );
  assert.equal(
    buildMeetingCallJoinUrl(
      "https://meet.jit.si/studyflow-room#config.prejoinPageEnabled=false",
      { rejoinNonce: "1700" }
    ),
    "https://meet.jit.si/studyflow-room#config.prejoinPageEnabled=false&studyflowRejoin=1700"
  );
});

test("collaboration helpers summarize device inventory and preflight call readiness", () => {
  const deviceInventory = summarizeMeetingDeviceInventory([
    { deviceId: "mic-1", kind: "audioinput", label: "Microphone" },
    { deviceId: "cam-1", kind: "videoinput", label: "Camera" },
  ]);

  assert.deepEqual(deviceInventory, {
    audioInputCount: 1,
    hasAudioInput: true,
    hasVideoInput: true,
    supported: true,
    videoInputCount: 1,
  });

  const report = buildMeetingCallPreflightReport({
    cameraPermission: "prompt",
    deviceInventory,
    isOnline: true,
    joinUrl: "https://meet.jit.si/studyflow-room",
    microphonePermission: "granted",
    transcriptSupported: false,
  });

  assert.equal(report.status, "caution");
  assert.equal(report.canStart, true);
  assert.equal(report.microphone.label, "Ready");
  assert.equal(report.camera.label, "Will Ask");
  assert.equal(report.call.label, "Ready With Caution");
  assert.match(report.guidance, /Camera permission will be requested/);
});

test("collaboration helpers block call preflight when offline or the join link is missing", () => {
  const report = buildMeetingCallPreflightReport({
    cameraPermission: "denied",
    deviceInventory: summarizeMeetingDeviceInventory([]),
    isOnline: false,
    joinUrl: "",
    microphonePermission: "denied",
    transcriptSupported: true,
  });

  assert.equal(report.status, "blocked");
  assert.equal(report.canRejoin, false);
  assert.match(report.guidance, /Reconnect to the internet/);
  assert.match(report.guidance, /does not have a join link/);
});

test("collaboration helpers preserve saved review history for meeting task suggestions", () => {
  const suggestions = buildMeetingTaskSuggestions(
    {
      actionPlan: [
        {
          action: "go shopping",
          due: "by 2pm",
          owner: "Jude",
          urgency: "High",
        },
      ],
      reviewedTaskSuggestions: [
        {
          description: "Rephrased shopping task for the final checklist.",
          dueAt: "2026-03-19T13:00:00.000Z",
          dueLabel: "by 2pm",
          reviewStatus: "rejected",
          reviewedAt: "2026-03-19T11:00:00.000Z",
          syncedAt: "2026-03-19T11:15:00.000Z",
          syncedTarget: "action_list",
          title: "Jude: go shopping",
        },
      ],
      todos: ["Jude: go shopping"],
    },
    {
      scheduledFor: "2026-03-19T10:00:00.000Z",
      title: "Family Errands",
    }
  );

  assert.equal(suggestions[0].reviewStatus, "rejected");
  assert.equal(
    suggestions[0].description,
    "Rephrased shopping task for the final checklist."
  );
  assert.equal(suggestions[0].syncedTarget, "action_list");
  assert.equal(suggestions[0].reviewedAt, "2026-03-19T11:00:00.000Z");
});
