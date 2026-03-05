import { normalizeReminderOffsets } from "./helpers";

function toIcsUtc(dateLike) {
  const dt = new Date(dateLike);
  if (Number.isNaN(dt.getTime())) return "";
  return dt.toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function escapeIcsText(value) {
  return String(value || "")
    .replace(/\\/g, "\\\\")
    .replace(/\n/g, "\\n")
    .replace(/,/g, "\\,")
    .replace(/;/g, "\\;");
}

export function buildTaskCalendar(tasks, options = {}) {
  const calendarName = options.calendarName || "StudyFlow Tasks";
  const timestamp = toIcsUtc(new Date());

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow//Task Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
  ];

  for (const task of tasks) {
    if (!task.deadline) continue;
    const start = toIcsUtc(task.deadline);
    if (!start) continue;

    const endDate = new Date(task.deadline);
    endDate.setMinutes(endDate.getMinutes() + 60);
    const end = toIcsUtc(endDate);
    const uid = `${task.id || Math.random().toString(36).slice(2)}@studyflow`;

    lines.push("BEGIN:VEVENT");
    lines.push(`UID:${uid}`);
    lines.push(`DTSTAMP:${timestamp}`);
    lines.push(`DTSTART:${start}`);
    lines.push(`DTEND:${end}`);
    lines.push(`SUMMARY:${escapeIcsText(task.title || "StudyFlow Task")}`);

    const description = [
      task.description ? `Description: ${task.description}` : "",
      task.category ? `Category: ${task.category}` : "",
      task.priority ? `Priority: ${task.priority}` : "",
      task.status ? `Status: ${task.status}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    lines.push(`DESCRIPTION:${escapeIcsText(description)}`);

    const reminders = normalizeReminderOffsets(task.reminderOffsets);
    for (const minutes of reminders) {
      lines.push("BEGIN:VALARM");
      lines.push(`TRIGGER:-PT${minutes}M`);
      lines.push("ACTION:DISPLAY");
      lines.push(
        `DESCRIPTION:${escapeIcsText(
          `${task.title || "Task"} due in ${minutes} minute(s)`
        )}`
      );
      lines.push("END:VALARM");
    }

    lines.push("END:VEVENT");
  }

  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function exportTasksToCalendar(tasks, filename = "studyflow-tasks.ics") {
  const calendar = buildTaskCalendar(tasks);
  const blob = new Blob([calendar], {
    type: "text/calendar;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
}

export function buildMeetingCalendar(meeting, options = {}) {
  const startsAt = meeting?.scheduledFor || meeting?.createdAt;
  const start = toIcsUtc(startsAt);
  if (!start) return "";

  const title = meeting?.title || "StudyFlow Meeting";
  const durationMinutes = Math.max(
    15,
    Math.min(480, Number(meeting?.durationMinutes) || 45)
  );
  const endDate = new Date(startsAt);
  endDate.setMinutes(endDate.getMinutes() + durationMinutes);
  const end = toIcsUtc(endDate);
  const stamp = toIcsUtc(new Date());
  const calendarName = options.calendarName || "StudyFlow Meetings";
  const uid = `${meeting?.id || Math.random().toString(36).slice(2)}@studyflow`;

  const description = [
    meeting?.description || "",
    meeting?.joinUrl ? `Join URL: ${meeting.joinUrl}` : "",
  ]
    .filter(Boolean)
    .join("\n");

  const lines = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//StudyFlow//Meeting Calendar//EN",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    `X-WR-CALNAME:${escapeIcsText(calendarName)}`,
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `DTSTAMP:${stamp}`,
    `DTSTART:${start}`,
    `DTEND:${end}`,
    `SUMMARY:${escapeIcsText(title)}`,
    `DESCRIPTION:${escapeIcsText(description)}`,
  ];

  for (const minutes of normalizeReminderOffsets([30, 10, 5])) {
    lines.push("BEGIN:VALARM");
    lines.push(`TRIGGER:-PT${minutes}M`);
    lines.push("ACTION:DISPLAY");
    lines.push(
      `DESCRIPTION:${escapeIcsText(`${title} starts in ${minutes} minute(s)`)}` 
    );
    lines.push("END:VALARM");
  }

  lines.push("END:VEVENT");
  lines.push("END:VCALENDAR");
  return `${lines.join("\r\n")}\r\n`;
}

export function exportMeetingToCalendar(
  meeting,
  filename = "studyflow-meeting.ics"
) {
  const calendar = buildMeetingCalendar(meeting);
  if (!calendar) return false;

  const blob = new Blob([calendar], {
    type: "text/calendar;charset=utf-8",
  });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
  return true;
}
