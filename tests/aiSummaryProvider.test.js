import assert from "node:assert/strict";
import test from "node:test";

import aiSummaryModule from "../server/shared/aiSummary.js";

const { createAiSummaryProvider } = aiSummaryModule;

test("AI summary provider normalizes an openai-compatible JSON response", async () => {
  const calls = [];
  const provider = createAiSummaryProvider({
    env: {
      AI_PROVIDER_MODE: "openai_compatible",
      AI_API_BASE_URL: "https://example.test/v1",
      AI_API_KEY: "test-key",
      AI_MODEL: "gpt-4.1-mini",
      AI_TIMEOUT_MS: 10000,
    },
    fetchImpl: async (url, options) => {
      calls.push({ options, url });
      return {
        ok: true,
        async json() {
          return {
            choices: [
              {
                message: {
                  content: JSON.stringify({
                    actionPlan: [
                      {
                        action: "review the budget draft",
                        confidence: 0.91,
                        due: "Tomorrow",
                        outcome: "Budget draft reviewed",
                        owner: "Ada",
                        urgency: "High",
                      },
                    ],
                    keyPoints: ["Budget risk identified", "Team agreed on next review"],
                    summaryText: "The team reviewed the budget and agreed on a follow-up.",
                    todos: ["Ada: review the budget draft"],
                  }),
                },
              },
            ],
          };
        },
      };
    },
  });

  assert.equal(provider.isConfigured(), true);

  const summary = await provider.generateMeetingSummary({
    attachmentKinds: ["transcript", "audio"],
    durationMinutes: 45,
    hostName: "Mrs. Musa",
    meetingDescription: "Finance planning sync",
    meetingTitle: "Budget Review",
    participantCount: 3,
    participantNames: ["Ada", "Tunde", "Musa"],
    requesterName: "Ada",
    requesterRole: "student",
    scheduledFor: "2026-03-19T15:00:00.000Z",
    transcript:
      "Ada will review the budget draft by tomorrow. The team agreed on a follow-up review.",
    transcriptSource: "live_transcript",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/v1/chat/completions");
  const requestBody = JSON.parse(calls[0].options.body);
  assert.match(requestBody.messages[1].content, /Meeting host: Mrs\. Musa/);
  assert.match(requestBody.messages[1].content, /Participants: Ada, Tunde, Musa/);
  assert.match(requestBody.messages[1].content, /Transcript source: live_transcript/);
  assert.equal(summary.provider.source, "external");
  assert.equal(summary.provider.mode, "openai_compatible");
  assert.equal(summary.provider.model, "gpt-4.1-mini");
  assert.equal(summary.summaryText, "The team reviewed the budget and agreed on a follow-up.");
  assert.deepEqual(summary.keyPoints, [
    "Budget risk identified",
    "Team agreed on next review",
  ]);
  assert.deepEqual(summary.todos, ["Ada: review the budget draft"]);
  assert.deepEqual(summary.actionPlan, [
    {
      action: "review the budget draft",
      confidence: 0.91,
      due: "Tomorrow",
      outcome: "Budget draft reviewed",
      owner: "Ada",
      urgency: "High",
    },
  ]);
});

test("AI summary provider reports as unconfigured without required env", () => {
  const provider = createAiSummaryProvider({
    env: {
      AI_PROVIDER_MODE: "disabled",
    },
  });

  assert.equal(provider.isConfigured(), false);
  assert.equal(provider.getStatus().effectiveProvider.source, "local");
  assert.equal(provider.getStatus().externalProvider.readiness, "disabled");
});

test("AI summary provider can transcribe audio attachments through the OpenAI audio endpoint", async () => {
  const calls = [];
  const provider = createAiSummaryProvider({
    env: {
      AI_PROVIDER_MODE: "openai_compatible",
      AI_API_BASE_URL: "https://example.test/v1",
      AI_API_KEY: "test-key",
      AI_MODEL: "gpt-4.1-mini",
      AI_TRANSCRIPTION_MODEL: "gpt-4o-mini-transcribe",
    },
    fetchImpl: async (url, options) => {
      calls.push({ options, url });
      return {
        ok: true,
        async json() {
          return {
            text: "Jude should go shopping by 2pm and send the receipt back to the group.",
          };
        },
      };
    },
  });

  const transcript = await provider.transcribeMeetingAudio({
    audio: {
      dataUrl: "data:audio/mpeg;base64,QUJDRA==",
      mimeType: "audio/mpeg",
      name: "meeting.mp3",
    },
    meetingDescription: "Parent coordination call",
    meetingTitle: "Errand Planning",
  });

  assert.equal(provider.canTranscribeAudio(), true);
  assert.equal(calls[0].url, "https://example.test/v1/audio/transcriptions");
  assert.equal(transcript.provider.type, "transcription");
  assert.equal(transcript.provider.model, "gpt-4o-mini-transcribe");
  assert.match(transcript.text, /Jude should go shopping by 2pm/);
  assert.equal(provider.getStatus().capabilities.transcription, true);
});
