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
    meetingDescription: "Finance planning sync",
    meetingTitle: "Budget Review",
    transcript:
      "Ada will review the budget draft by tomorrow. The team agreed on a follow-up review.",
  });

  assert.equal(calls.length, 1);
  assert.equal(calls[0].url, "https://example.test/v1/chat/completions");
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
});
