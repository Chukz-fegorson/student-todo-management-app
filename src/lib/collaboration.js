import { parseDate, toDateTimeLocalValue } from "./helpers.js";

const COLLAB_MEETING_DRAFT_VERSION = 1;

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

export function buildMeetingCallJoinUrl(joinUrl, { rejoinNonce = "" } = {}) {
  const raw = String(joinUrl || "").trim();
  if (!raw) return "";

  const [base, hash = ""] = raw.split("#");
  const parts = hash
    .split("&")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .filter((entry) => !entry.startsWith("studyflowRejoin="));

  if (!parts.includes("config.prejoinPageEnabled=false")) {
    parts.push("config.prejoinPageEnabled=false");
  }
  if (rejoinNonce) {
    parts.push(`studyflowRejoin=${encodeURIComponent(String(rejoinNonce))}`);
  }

  return parts.length ? `${base}#${parts.join("&")}` : base;
}

export function defaultFollowUpDueFromMeeting(meeting) {
  const start = parseDate(meeting?.scheduledFor) || new Date();
  const next = new Date(start.getTime());
  next.setDate(next.getDate() + 1);
  if (Number.isNaN(next.getTime())) return null;
  return next.toISOString();
}

function clampMeetingHour(hour) {
  return Math.max(0, Math.min(23, hour));
}

function setDeadlineTime(baseDate, hour, minute = 0) {
  const next = new Date(baseDate.getTime());
  next.setHours(clampMeetingHour(hour), Math.max(0, Math.min(59, minute)), 0, 0);
  return Number.isNaN(next.getTime()) ? null : next;
}

function parseTimeLabel(dueText, baseDate) {
  const text = String(dueText || "").trim().toLowerCase();
  const match = text.match(/\b(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  if (match) {
    let hour = Number(match[1]) % 12;
    const minute = Number(match[2] || 0);
    if (match[3] === "pm") hour += 12;
    return setDeadlineTime(baseDate, hour, minute);
  }

  const military = text.match(/\b(\d{1,2}):(\d{2})\b/);
  if (military) {
    return setDeadlineTime(baseDate, Number(military[1]), Number(military[2]));
  }

  return null;
}

function normalizePermissionState(value) {
  const normalized = String(value || "").trim().toLowerCase();
  if (normalized === "granted" || normalized === "denied" || normalized === "prompt") {
    return normalized;
  }
  return "unknown";
}

export function summarizeMeetingDeviceInventory(devices) {
  const entries = Array.isArray(devices) ? devices : [];
  const audioInputCount = entries.filter((entry) => entry?.kind === "audioinput").length;
  const videoInputCount = entries.filter((entry) => entry?.kind === "videoinput").length;

  return {
    audioInputCount,
    hasAudioInput: audioInputCount > 0,
    hasVideoInput: videoInputCount > 0,
    supported: Array.isArray(devices),
    videoInputCount,
  };
}

export function buildMeetingCallPreflightReport({
  cameraPermission,
  deviceInventory,
  isOnline = true,
  joinUrl,
  microphonePermission,
  transcriptSupported = true,
} = {}) {
  const inventory =
    deviceInventory && typeof deviceInventory === "object"
      ? deviceInventory
      : summarizeMeetingDeviceInventory();
  const normalizedCameraPermission = normalizePermissionState(cameraPermission);
  const normalizedMicrophonePermission = normalizePermissionState(microphonePermission);
  const blockers = [];
  const cautions = [];

  const browser = inventory.supported
    ? {
        label: "Check Ready",
        tone: "ready",
      }
    : {
        label: "Limited Check",
        tone: "fallback",
      };

  let microphone = {
    label: "Unknown",
    tone: inventory.supported ? "fallback" : "danger",
  };
  if (!inventory.supported) {
    cautions.push("This browser cannot fully inspect microphone devices before join.");
  } else if (!inventory.hasAudioInput) {
    microphone = { label: "No Mic Found", tone: "danger" };
    cautions.push("No microphone device is currently detected for this browser.");
  } else if (normalizedMicrophonePermission === "denied") {
    microphone = { label: "Blocked", tone: "danger" };
    cautions.push("Microphone access is blocked. Call audio may be one-way until you re-enable it.");
  } else if (normalizedMicrophonePermission === "granted") {
    microphone = { label: "Ready", tone: "ready" };
  } else if (normalizedMicrophonePermission === "prompt") {
    microphone = { label: "Will Ask", tone: "fallback" };
    cautions.push("Microphone permission will be requested when the call opens.");
  } else {
    microphone = { label: "Detected", tone: "ready" };
  }

  let camera = {
    label: "Unknown",
    tone: inventory.supported ? "fallback" : "danger",
  };
  if (!inventory.supported) {
    cautions.push("This browser cannot fully inspect camera devices before join.");
  } else if (!inventory.hasVideoInput) {
    camera = { label: "No Camera", tone: "fallback" };
    cautions.push("No camera device is currently detected. You can still join with audio or notes.");
  } else if (normalizedCameraPermission === "denied") {
    camera = { label: "Blocked", tone: "danger" };
    cautions.push("Camera access is blocked. Video will stay off until you re-enable it.");
  } else if (normalizedCameraPermission === "granted") {
    camera = { label: "Ready", tone: "ready" };
  } else if (normalizedCameraPermission === "prompt") {
    camera = { label: "Will Ask", tone: "fallback" };
    cautions.push("Camera permission will be requested when the call opens.");
  } else {
    camera = { label: "Detected", tone: "ready" };
  }

  if (!isOnline) {
    blockers.push("Reconnect to the internet before starting or rejoining this call.");
  }
  if (!String(joinUrl || "").trim()) {
    blockers.push("This meeting does not have a join link yet.");
  }
  if (!transcriptSupported) {
    cautions.push("Live transcript is unavailable in this browser, so rely on typed notes or uploaded transcript files.");
  }

  const call = blockers.length
    ? {
        label: "Blocked",
        tone: "danger",
      }
    : cautions.length
      ? {
          label: "Ready With Caution",
          tone: "fallback",
        }
      : {
          label: "Ready",
          tone: "ready",
        };

  const guidance = blockers.length
    ? blockers.join(" ")
    : cautions.length
      ? cautions.slice(0, 2).join(" ")
      : "Call checks look good. You can start or rejoin this meeting now.";

  return {
    blockers,
    browser,
    call,
    camera,
    canRejoin: blockers.length === 0,
    canStart: blockers.length === 0,
    cautions,
    guidance,
    microphone,
    status: blockers.length ? "blocked" : cautions.length ? "caution" : "ready",
  };
}

export function resolveMeetingTaskDeadline({
  dueText,
  meeting,
  offsetIndex = 0,
} = {}) {
  const direct = parseDate(dueText);
  if (direct) return direct.toISOString();

  const base = parseDate(meeting?.scheduledFor) || new Date();
  const normalized = String(dueText || "").trim().toLowerCase();
  let target = new Date(base.getTime());

  if (/tomorrow/.test(normalized)) {
    target.setDate(target.getDate() + 1);
  } else if (/next week/.test(normalized)) {
    target.setDate(target.getDate() + 7);
  } else if (/this week/.test(normalized)) {
    target.setDate(target.getDate() + 3);
  } else if (/today|tonight|eod|end of day/.test(normalized)) {
    // keep same day
  } else if (!normalized || normalized === "not specified") {
    const fallback = parseDate(defaultFollowUpDueFromMeeting(meeting)) || new Date(base);
    target = new Date(fallback.getTime() + offsetIndex * 30 * 60 * 1000);
    return target.toISOString();
  }

  const timeTarget =
    parseTimeLabel(normalized, target) ||
    (/eod|end of day|tonight/.test(normalized)
      ? setDeadlineTime(target, 17, 0)
      : /this week|next week/.test(normalized)
        ? setDeadlineTime(target, 17, 0)
        : setDeadlineTime(target, 14 + (offsetIndex % 4), 0));

  return (timeTarget || target).toISOString();
}

export function buildMeetingTaskSuggestions(summary, meeting) {
  const todos = Array.isArray(summary?.todos) ? summary.todos : [];
  const actionPlan = Array.isArray(summary?.actionPlan) ? summary.actionPlan : [];
  const acceptedTaskDrafts = Array.isArray(summary?.acceptedTaskDrafts)
    ? summary.acceptedTaskDrafts
    : [];
  const reviewedTaskSuggestions = Array.isArray(summary?.reviewedTaskSuggestions)
    ? summary.reviewedTaskSuggestions
    : [];
  const acceptedByTitle = new Map(
    acceptedTaskDrafts
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => [String(entry.title || "").trim(), entry])
      .filter(([title]) => title)
  );
  const reviewedByTitle = new Map(
    reviewedTaskSuggestions
      .filter((entry) => entry && typeof entry === "object")
      .map((entry) => [String(entry.title || "").trim(), entry])
      .filter(([title]) => title)
  );

  return todos
    .map((todo, index) => {
      const title = String(todo || "").trim();
      if (!title) return null;
      const plan =
        actionPlan[index] && typeof actionPlan[index] === "object" ? actionPlan[index] : null;
      const savedDraft = acceptedByTitle.get(title) || null;
      const reviewed = reviewedByTitle.get(title) || null;
      const dueLabel = String(
        reviewed?.dueLabel || savedDraft?.dueLabel || plan?.due || "Not specified"
      ).trim();
      const dueAt =
        String(reviewed?.dueAt || savedDraft?.dueAt || "").trim() ||
        resolveMeetingTaskDeadline({
          dueText: dueLabel,
          meeting,
          offsetIndex: index,
        });
      const description =
        String(reviewed?.description || savedDraft?.description || "").trim() ||
        [
          meeting?.title ? `Captured from meeting: ${meeting.title}.` : "Captured from meeting summary.",
          plan?.owner && plan.owner !== "Unassigned" ? `Owner: ${plan.owner}.` : "",
          plan?.outcome ? `Expected outcome: ${plan.outcome}.` : "",
          dueLabel && dueLabel !== "Not specified" ? `Due cue: ${dueLabel}.` : "",
          plan?.urgency ? `Urgency: ${plan.urgency}.` : "",
        ]
          .filter(Boolean)
          .join(" ")
          .trim();

      return {
        confidence:
          Number.isFinite(Number(reviewed?.confidence))
            ? Number(reviewed.confidence)
            : Number.isFinite(Number(plan?.confidence))
              ? Number(plan.confidence)
              : null,
        description,
        dueAt,
        dueLabel,
        owner:
          String(reviewed?.owner || plan?.owner || "Unassigned").trim() || "Unassigned",
        reviewStatus:
          reviewed?.reviewStatus === "accepted" || reviewed?.reviewStatus === "rejected"
            ? reviewed.reviewStatus
            : "pending",
        reviewedAt: String(reviewed?.reviewedAt || "").trim() || null,
        syncedAt: String(reviewed?.syncedAt || "").trim() || null,
        syncedTarget: String(reviewed?.syncedTarget || "").trim() || null,
        title,
        urgency:
          String(reviewed?.urgency || plan?.urgency || "Medium").trim() || "Medium",
      };
    })
    .filter(Boolean);
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

export function buildMeetingDraftStorageKey({ userId, meetingId }) {
  const safeUserId = String(userId || "").trim();
  const safeMeetingId = String(meetingId || "").trim();
  if (!safeUserId || !safeMeetingId) return "";
  return `studyflow:collab:draft:${safeUserId}:${safeMeetingId}`;
}

function normalizeTranscriptAttachment(entry) {
  if (!entry || entry.kind !== "transcript") return null;
  const id = String(entry.id || "").trim();
  const name = String(entry.name || "transcript.txt").trim() || "transcript.txt";
  const content = String(entry.content || "").trim();
  if (!content) return null;

  return {
    id: id || `${name}-${hashText(content)}`,
    name,
    kind: "transcript",
    mimeType: String(entry.mimeType || "text/plain").trim() || "text/plain",
    size: Number.isFinite(Number(entry.size)) ? Number(entry.size) : content.length,
    content,
  };
}

function normalizeMeetingCallSession(callSession = {}) {
  const meetingId = String(callSession.meetingId || "").trim();
  return {
    active: Boolean(callSession.active && meetingId),
    meetingId,
    startedAt: String(callSession.startedAt || "").trim() || null,
    joinUrl: String(callSession.joinUrl || "").trim(),
  };
}

function normalizeMeetingTranscriptJob(job = {}) {
  const id = String(job.id || "").trim();
  if (!id) return null;

  const status = String(job.status || "").trim().toLowerCase();
  return {
    attachmentName: String(job.attachmentName || "").trim() || null,
    createdAt: String(job.createdAt || "").trim() || null,
    error: String(job.error || "").trim(),
    finishedAt: String(job.finishedAt || "").trim() || null,
    id,
    meetingId: String(job.meetingId || "").trim() || null,
    meetingTitle: String(job.meetingTitle || "").trim() || null,
    pollAfterMs: Number.isFinite(Number(job.pollAfterMs))
      ? Math.max(1000, Math.min(30000, Number(job.pollAfterMs)))
      : 2500,
    result:
      job.result && typeof job.result === "object" && !Array.isArray(job.result)
        ? job.result
        : null,
    startedAt: String(job.startedAt || "").trim() || null,
    status:
      status === "queued" ||
      status === "processing" ||
      status === "completed" ||
      status === "failed"
        ? status
        : "queued",
    updatedAt: String(job.updatedAt || "").trim() || null,
  };
}

export function createMeetingDraftSnapshot({
  meetingId,
  callSession,
  transcriptionJob,
  transcript,
  summary,
  attachments,
  acceptedSummaryTodos,
  savedAt = new Date().toISOString(),
} = {}) {
  const transcriptAttachments = Array.isArray(attachments)
    ? attachments.map(normalizeTranscriptAttachment).filter(Boolean).slice(0, 8)
    : [];
  const mediaAttachmentCount = Array.isArray(attachments)
    ? attachments.filter((entry) => entry && entry.kind !== "transcript").length
    : 0;
  const normalizedSummary =
    summary && typeof summary === "object" && !Array.isArray(summary) ? summary : null;

  return {
    version: COLLAB_MEETING_DRAFT_VERSION,
    meetingId: String(meetingId || "").trim(),
    savedAt: String(savedAt || "").trim() || new Date().toISOString(),
    callSession: normalizeMeetingCallSession(callSession),
    transcriptionJob: normalizeMeetingTranscriptJob(transcriptionJob),
    transcript: String(transcript || ""),
    summary: normalizedSummary
      ? {
          ...normalizedSummary,
          attachments: transcriptAttachments,
        }
      : null,
    transcriptAttachments,
    acceptedSummaryTodos: uniqueAcceptedTodos(acceptedSummaryTodos),
    mediaAttachmentCount,
  };
}

export function parseMeetingDraftSnapshot(value) {
  if (!value) return null;

  let parsed = value;
  if (typeof value === "string") {
    try {
      parsed = JSON.parse(value);
    } catch {
      return null;
    }
  }

  if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) {
    return null;
  }

  return createMeetingDraftSnapshot({
    acceptedSummaryTodos: parsed.acceptedSummaryTodos,
    attachments: parsed.transcriptAttachments,
    callSession: parsed.callSession,
    meetingId: parsed.meetingId,
    savedAt: parsed.savedAt,
    summary: parsed.summary,
    transcriptionJob: parsed.transcriptionJob,
    transcript: parsed.transcript,
  });
}

export function shouldRestoreMeetingDraft({ draft, meetingNotesUpdatedAt } = {}) {
  if (!draft) return false;

  const hasRecoverableContent = Boolean(
    String(draft.transcript || "").trim() ||
      draft.summary ||
      (Array.isArray(draft.acceptedSummaryTodos) && draft.acceptedSummaryTodos.length) ||
      (Array.isArray(draft.transcriptAttachments) && draft.transcriptAttachments.length) ||
      Boolean(draft.transcriptionJob?.id)
  );
  if (!hasRecoverableContent) return false;
  if (draft.callSession?.active) return true;

  const draftMs = parseDate(draft.savedAt)?.getTime() || 0;
  const serverMs = parseDate(meetingNotesUpdatedAt)?.getTime() || 0;
  return draftMs >= serverMs;
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
