import assert from "node:assert/strict";
import test from "node:test";

import {
  deadlineStatus,
  effectiveProgress,
  gradeToScore,
  normalizeReminderOffsets,
  timeLeft,
} from "../src/lib/helpers.js";

const realDateNow = Date.now;

test("grade helpers convert grades and blend effective progress", () => {
  assert.equal(gradeToScore("A"), 95);
  assert.equal(gradeToScore("Z"), null);
  assert.equal(effectiveProgress({ progress: 40, grade: "A" }), 73);
  assert.equal(effectiveProgress({ progress: 61, grade: null }), 61);
});

test("normalizeReminderOffsets deduplicates, sorts, and falls back safely", () => {
  assert.deepEqual(normalizeReminderOffsets([10, "30", 10, 5, 2000, -3]), [30, 10, 5]);
  assert.deepEqual(normalizeReminderOffsets("bad"), [30, 10, 5]);
});

test("deadline helpers flag urgency and overdue states", () => {
  Date.now = () => new Date("2026-03-10T10:00:00.000Z").getTime();

  assert.equal(deadlineStatus("2026-03-10T16:00:00.000Z"), "urgent");
  assert.equal(timeLeft("2026-03-10T16:00:00.000Z"), "6h left");
  assert.equal(deadlineStatus("2026-03-12T10:00:00.000Z"), "soon");
  assert.equal(deadlineStatus("2026-03-14T10:00:00.000Z"), "ok");
  assert.equal(deadlineStatus("2026-03-10T08:00:00.000Z"), "overdue");
  assert.equal(timeLeft("2026-03-10T08:00:00.000Z"), "2h overdue");

  Date.now = realDateNow;
});
