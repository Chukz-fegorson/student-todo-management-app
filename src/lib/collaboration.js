import { parseDate, toDateTimeLocalValue } from "./helpers";

export function defaultMeetingForm() {
  const oneHourAhead = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    title: "",
    description: "",
    scheduledFor: toDateTimeLocalValue(oneHourAhead),
    durationMinutes: 45,
    participantIds: [],
  };
}

export function safeSlug(value) {
  return (
    String(value || "studyflow-meeting")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "studyflow-meeting"
  );
}

export function defaultFollowUpDueFromMeeting(meeting) {
  const start = parseDate(meeting?.scheduledFor) || new Date();
  const next = new Date(start.getTime());
  next.setDate(next.getDate() + 1);
  if (Number.isNaN(next.getTime())) return null;
  return next.toISOString();
}

export function summaryTodosToCalendarEvents(todoItems, meeting) {
  const todos = Array.isArray(todoItems) ? todoItems : [];
  const baseIso = defaultFollowUpDueFromMeeting(meeting);
  const base = parseDate(baseIso) || new Date();

  return todos.map((todo, index) => {
    const scheduled = new Date(base.getTime() + index * 30 * 60 * 1000);
    return {
      id: `summary-${index}-${Date.now()}`,
      title: todo,
      description: meeting?.title
        ? `Follow-up from meeting: ${meeting.title}`
        : "Follow-up action item",
      category: "Follow-up",
      priority: "Medium",
      status: "Todo",
      deadline: scheduled.toISOString(),
      reminderOffsets: [30, 10, 5],
    };
  });
}

export function userMatchesSearch(user, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    user?.name,
    user?.email,
    user?.role,
    user?.schoolName,
    user?.stateName,
    user?.lgaName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(text);
}

export function mediaKindFromMime(file) {
  if (String(file?.type || "").startsWith("video/")) return "video";
  if (String(file?.type || "").startsWith("audio/")) return "audio";
  return "image";
}

export function isTranscriptLikeFile(file) {
  const type = String(file?.type || "").toLowerCase();
  const name = String(file?.name || "").toLowerCase();
  return (
    type.startsWith("text/") ||
    name.endsWith(".txt") ||
    name.endsWith(".md") ||
    name.endsWith(".srt") ||
    name.endsWith(".vtt") ||
    name.endsWith(".json")
  );
}

export function normalizeTodoSignature(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function hashText(value) {
  let hash = 5381;
  const text = String(value || "");
  for (let index = 0; index < text.length; index += 1) {
    hash = ((hash << 5) + hash + text.charCodeAt(index)) >>> 0;
  }
  return hash.toString(16);
}

export function buildActionClientKey({ meetingId, todoTitle, dueAt }) {
  const base = `${meetingId || "no-meeting"}|${normalizeTodoSignature(
    todoTitle
  )}|${dueAt || "no-due"}`;
  return `ai-${hashText(base)}`;
}

export function uniqueAcceptedTodos(todoItems) {
  const source = Array.isArray(todoItems) ? todoItems : [];
  const seen = new Set();
  const deduped = [];
  for (const entry of source) {
    const text = String(entry || "").trim();
    if (text.length < 8) continue;
    const signature = normalizeTodoSignature(text);
    if (!signature || seen.has(signature)) continue;
    seen.add(signature);
    deduped.push(text);
  }
  return deduped;
}
