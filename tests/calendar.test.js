import assert from "node:assert/strict";
import test from "node:test";

import { buildMeetingCalendar, buildTaskCalendar } from "../src/lib/calendar.js";

test("buildTaskCalendar produces a valid task calendar with alarms", () => {
  const calendar = buildTaskCalendar([
    {
      id: "task-1",
      title: "Essay Review",
      description: "Bring notes, pen;\nFinal copy",
      category: "Assignment",
      priority: "High",
      status: "Submitted",
      deadline: "2026-03-10T10:00:00.000Z",
      reminderOffsets: [5, 30, 10],
    },
  ]);

  assert.match(calendar, /BEGIN:VCALENDAR/);
  assert.match(calendar, /UID:task-1@studyflow/);
  assert.match(calendar, /DTSTART:20260310T100000Z/);
  assert.match(calendar, /SUMMARY:Essay Review/);
  assert.match(calendar, /Description: Bring notes\\, pen\\;\\nFinal copy/);
  assert.equal((calendar.match(/BEGIN:VALARM/g) || []).length, 3);
  assert.match(calendar, /TRIGGER:-PT30M/);
  assert.match(calendar, /TRIGGER:-PT10M/);
  assert.match(calendar, /TRIGGER:-PT5M/);
});

test("buildMeetingCalendar includes join details and default alarms", () => {
  const calendar = buildMeetingCalendar({
    id: "meeting-1",
    title: "Weekly Sync",
    description: "Keep the action items tight.",
    scheduledFor: "2026-03-10T12:00:00.000Z",
    durationMinutes: 30,
    joinUrl: "https://meet.example/abc",
  });

  assert.match(calendar, /BEGIN:VEVENT/);
  assert.match(calendar, /SUMMARY:Weekly Sync/);
  assert.match(calendar, /DTSTART:20260310T120000Z/);
  assert.match(calendar, /DTEND:20260310T123000Z/);
  assert.match(calendar, /Join URL: https:\/\/meet\.example\/abc/);
  assert.equal((calendar.match(/BEGIN:VALARM/g) || []).length, 3);
});
