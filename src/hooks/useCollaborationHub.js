import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../lib/api";
import { exportMeetingToCalendar, exportTasksToCalendar } from "../lib/calendar";
import {
  formatDateTime,
  parseDate,
  toDateTimeLocalValue,
  toIsoFromDateTimeLocal,
} from "../lib/helpers";
import { generateMeetingSummary } from "../lib/meetingAi";
import {
  buildActionClientKey,
  buildMeetingCallJoinUrl,
  buildMeetingCallPreflightReport,
  buildMeetingTaskSuggestions,
  buildMeetingDraftStorageKey,
  createMeetingDraftSnapshot,
  defaultFollowUpDueFromMeeting,
  defaultMeetingForm,
  isTranscriptLikeFile,
  mediaKindFromMime,
  normalizeTodoSignature,
  parseMeetingDraftSnapshot,
  resolveMeetingTaskDeadline,
  safeSlug,
  summarizeMeetingDeviceInventory,
  shouldRestoreMeetingDraft,
  summaryTodosToCalendarEvents,
  uniqueAcceptedTodos,
  userMatchesSearch,
} from "../lib/collaboration";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read media file"));
    reader.readAsDataURL(file);
  });
}

function readTextFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read transcript file"));
    reader.readAsText(file);
  });
}

function createCallSession() {
  return {
    active: false,
    meetingId: "",
    startedAt: null,
    joinUrl: "",
  };
}

function createCallPreflightState() {
  return {
    blockers: [],
    browser: {
      label: "Unchecked",
      tone: "fallback",
    },
    call: {
      label: "Unchecked",
      tone: "fallback",
    },
    camera: {
      label: "Unchecked",
      tone: "fallback",
    },
    cautions: [],
    checkedAt: null,
    guidance: "Run preflight to check your connection and devices before starting a meeting.",
    meetingId: "",
    microphone: {
      label: "Unchecked",
      tone: "fallback",
    },
    status: "idle",
  };
}

function createCallFrameState() {
  return {
    key: 0,
    lastLoadedAt: null,
    lastReloadedAt: null,
    reloadCount: 0,
    status: "idle",
  };
}

function createMeetingTranscriptJobState() {
  return {
    applied: false,
    attachmentName: "",
    createdAt: null,
    error: "",
    finishedAt: null,
    id: "",
    meetingId: "",
    meetingTitle: "",
    pollAfterMs: 2500,
    result: null,
    startedAt: null,
    status: "idle",
    updatedAt: null,
  };
}

function normalizeMeetingTranscriptJobState(payload = {}, options = {}) {
  const base = createMeetingTranscriptJobState();
  if (!payload || typeof payload !== "object") return base;

  const status = String(payload.status || "").trim().toLowerCase();
  return {
    ...base,
    applied: Boolean(options.applied),
    attachmentName: String(payload.attachmentName || "").trim(),
    createdAt: typeof payload.createdAt === "string" ? payload.createdAt : null,
    error: typeof payload.error === "string" ? payload.error : "",
    finishedAt: typeof payload.finishedAt === "string" ? payload.finishedAt : null,
    id: typeof payload.id === "string" ? payload.id : "",
    meetingId: typeof payload.meetingId === "string" ? payload.meetingId : "",
    meetingTitle:
      typeof payload.meetingTitle === "string" ? payload.meetingTitle : "",
    pollAfterMs: Number.isFinite(Number(payload.pollAfterMs))
      ? Math.max(1000, Math.min(30000, Number(payload.pollAfterMs)))
      : base.pollAfterMs,
    result:
      payload.result && typeof payload.result === "object" ? payload.result : null,
    startedAt: typeof payload.startedAt === "string" ? payload.startedAt : null,
    status:
      status === "queued" ||
      status === "processing" ||
      status === "completed" ||
      status === "failed"
        ? status
        : base.status,
    updatedAt: typeof payload.updatedAt === "string" ? payload.updatedAt : null,
  };
}

function createDefaultAiSummaryStatus() {
  return {
    capabilities: {
      summary: false,
      transcription: false,
    },
    checkedAt: null,
    effectiveProvider: {
      source: "local",
      mode: "deterministic_nlp",
      model: null,
    },
    externalProvider: {
      available: false,
      readiness: "disabled",
      mode: "disabled",
      model: null,
      timeoutMs: null,
    },
    transcriptionProvider: {
      available: false,
      model: null,
      path: null,
    },
    fallbackProvider: {
      available: true,
      source: "local",
      mode: "deterministic_nlp",
    },
    error: "",
  };
}

function normalizeAiSummaryStatus(payload = {}) {
  const base = createDefaultAiSummaryStatus();
  const effectiveProvider =
    payload?.effectiveProvider && typeof payload.effectiveProvider === "object"
      ? payload.effectiveProvider
      : {};
  const externalProvider =
    payload?.externalProvider && typeof payload.externalProvider === "object"
      ? payload.externalProvider
      : {};
  const fallbackProvider =
    payload?.fallbackProvider && typeof payload.fallbackProvider === "object"
      ? payload.fallbackProvider
      : {};
  const capabilities =
    payload?.capabilities && typeof payload.capabilities === "object"
      ? payload.capabilities
      : {};
  const transcriptionProvider =
    payload?.transcriptionProvider && typeof payload.transcriptionProvider === "object"
      ? payload.transcriptionProvider
      : {};
  const timeoutCandidate = Number(externalProvider.timeoutMs);

  return {
    ...base,
    capabilities: {
      summary: Boolean(capabilities.summary ?? base.capabilities.summary),
      transcription: Boolean(
        capabilities.transcription ?? base.capabilities.transcription
      ),
    },
    checkedAt:
      typeof payload.checkedAt === "string" ? payload.checkedAt : base.checkedAt,
    effectiveProvider: {
      ...base.effectiveProvider,
      source:
        effectiveProvider.source === "external"
          ? "external"
          : base.effectiveProvider.source,
      mode: String(effectiveProvider.mode || base.effectiveProvider.mode),
      model: effectiveProvider.model ? String(effectiveProvider.model) : null,
    },
    externalProvider: {
      ...base.externalProvider,
      available: Boolean(externalProvider.available),
      readiness: String(
        externalProvider.readiness || base.externalProvider.readiness
      ),
      mode: String(externalProvider.mode || base.externalProvider.mode),
      model: externalProvider.model ? String(externalProvider.model) : null,
      timeoutMs: Number.isFinite(timeoutCandidate) ? timeoutCandidate : null,
    },
    transcriptionProvider: {
      ...base.transcriptionProvider,
      available: Boolean(transcriptionProvider.available),
      model: transcriptionProvider.model
        ? String(transcriptionProvider.model)
        : null,
      path: transcriptionProvider.path ? String(transcriptionProvider.path) : null,
    },
    fallbackProvider: {
      ...base.fallbackProvider,
      available: fallbackProvider.available !== false,
      source:
        fallbackProvider.source === "external"
          ? "external"
          : base.fallbackProvider.source,
      mode: String(fallbackProvider.mode || base.fallbackProvider.mode),
    },
    error: typeof payload.error === "string" ? payload.error : "",
  };
}

function summarizeAttachmentKinds(attachments = []) {
  return [
    ...new Set(
      attachments
        .map((entry) => String(entry?.kind || "").trim())
        .filter(Boolean)
    ),
  ].slice(0, 8);
}

function deriveTranscriptSource({ attachments = [], transcriptLive }) {
  const hasTranscriptFiles = attachments.some((entry) => entry?.kind === "transcript");
  if (transcriptLive && hasTranscriptFiles) return "live_plus_uploaded_transcript";
  if (transcriptLive) return "live_transcript";
  if (hasTranscriptFiles) return "uploaded_transcript";
  return "manual_notes";
}

function buildMeetingSummaryContext({ meeting, user, attachments, transcriptLive }) {
  const participantNames = Array.isArray(meeting?.participants)
    ? meeting.participants
        .map((entry) => String(entry?.name || "").trim())
        .filter(Boolean)
        .slice(0, 12)
    : [];
  const participantCount = Array.isArray(meeting?.participants)
    ? meeting.participants.length
    : participantNames.length;

  return {
    attachmentKinds: summarizeAttachmentKinds(attachments),
    durationMinutes: meeting?.durationMinutes || null,
    hostName: meeting?.hostName || "",
    meetingDescription: meeting?.description || "",
    meetingTitle: meeting?.title || "",
    participantCount,
    participantNames,
    requesterName: user?.name || "",
    requesterRole: user?.role || "",
    scheduledFor: meeting?.scheduledFor || "",
    transcriptSource: deriveTranscriptSource({ attachments, transcriptLive }),
  };
}

function buildMeetingSummaryPayload({
  summary,
  attachments = [],
  acceptedTodos = [],
  acceptedTaskDrafts = [],
  reviewedTaskSuggestions = [],
}) {
  if (summary) {
    return {
      ...summary,
      acceptedTodos,
      acceptedTaskDrafts,
      attachments,
      reviewedTaskSuggestions,
    };
  }

  if (attachments.length) {
    return {
      summaryText: "",
      keyPoints: [],
      todos: [],
      actionPlan: [],
      acceptedTodos,
      acceptedTaskDrafts,
      attachments,
      generatedAt: new Date().toISOString(),
      reviewedTaskSuggestions,
    };
  }

  return null;
}

function getSavedMeetingAttachments(meeting) {
  return Array.isArray(meeting?.notes?.summary?.attachments)
    ? meeting.notes.summary.attachments
    : [];
}

function getSavedAcceptedSummaryTodos(meeting) {
  if (Array.isArray(meeting?.notes?.summary?.acceptedTodos)) {
    return meeting.notes.summary.acceptedTodos;
  }

  return Array.isArray(meeting?.notes?.summary?.reviewedTaskSuggestions)
    ? meeting.notes.summary.reviewedTaskSuggestions
        .filter((entry) => entry?.reviewStatus === "accepted")
        .map((entry) => String(entry?.title || "").trim())
        .filter(Boolean)
    : [];
}

function normalizeTaskReviewStatus(value) {
  return value === "accepted" || value === "rejected" ? value : "pending";
}

function getTranscribableMediaAttachment(attachments = []) {
  return attachments.find(
    (entry) =>
      entry &&
      (entry.kind === "audio" || entry.kind === "video") &&
      typeof entry.url === "string" &&
      entry.url.startsWith("data:")
  );
}

export function useCollaborationHub({ user, onClose, navRoute }) {
  const [tab, setTab] = useState("chat");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [directory, setDirectory] = useState([]);
  const [directoryLoading, setDirectoryLoading] = useState(true);

  const [selectedChatUserId, setSelectedChatUserId] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const [chatText, setChatText] = useState("");
  const [sendingChat, setSendingChat] = useState(false);
  const [peopleSearch, setPeopleSearch] = useState("");

  const [broadcastText, setBroadcastText] = useState("");
  const [broadcastRecipients, setBroadcastRecipients] = useState([]);
  const [sendingBroadcast, setSendingBroadcast] = useState(false);
  const [broadcastSearch, setBroadcastSearch] = useState("");

  const [meetings, setMeetings] = useState([]);
  const [meetingForm, setMeetingForm] = useState(defaultMeetingForm);
  const [creatingMeeting, setCreatingMeeting] = useState(false);
  const [activeMeetingId, setActiveMeetingId] = useState("");
  const [meetingDetail, setMeetingDetail] = useState(null);
  const [loadingMeetingDetail, setLoadingMeetingDetail] = useState(false);
  const [meetingParticipantSearch, setMeetingParticipantSearch] = useState("");
  const [showCreateMeetingForm, setShowCreateMeetingForm] = useState(false);

  const [notesTranscript, setNotesTranscript] = useState("");
  const [notesSummary, setNotesSummary] = useState(null);
  const [notesAttachments, setNotesAttachments] = useState([]);
  const [summaryTaskEdits, setSummaryTaskEdits] = useState({});
  const [summaryTaskReviewStates, setSummaryTaskReviewStates] = useState({});
  const [savingNotes, setSavingNotes] = useState(false);
  const [transcribingMeetingMedia, setTranscribingMeetingMedia] = useState(false);
  const [meetingTranscriptJob, setMeetingTranscriptJob] = useState(null);
  const [transcriptLive, setTranscriptLive] = useState(false);
  const [meetingListFilter, setMeetingListFilter] = useState("all");
  const [actionItems, setActionItems] = useState([]);
  const [loadingActionItems, setLoadingActionItems] = useState(false);
  const [savingActionItems, setSavingActionItems] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [acceptedSummaryTodos, setAcceptedSummaryTodos] = useState([]);
  const [callSession, setCallSession] = useState(createCallSession);
  const [callPreflight, setCallPreflight] = useState(createCallPreflightState);
  const [callFrameState, setCallFrameState] = useState(createCallFrameState);
  const [aiSummaryStatus, setAiSummaryStatus] = useState(createDefaultAiSummaryStatus);
  const [loadingAiSummaryStatus, setLoadingAiSummaryStatus] = useState(false);
  const [meetingDraftDirty, setMeetingDraftDirty] = useState(false);
  const [draftSavedAt, setDraftSavedAt] = useState(null);
  const [draftRestoredAt, setDraftRestoredAt] = useState(null);
  const [draftMediaAttachmentCount, setDraftMediaAttachmentCount] = useState(0);
  const [isOnline, setIsOnline] = useState(() =>
    typeof navigator === "undefined" ? true : navigator.onLine !== false
  );
  const [lastTranscriptCapturedAt, setLastTranscriptCapturedAt] = useState(null);
  const [callServerSync, setCallServerSync] = useState({
    error: "",
    lastSyncedAt: null,
    status: "idle",
  });

  const recognitionRef = useRef(null);
  const lastCallAutosaveSignatureRef = useRef("");
  const transcriptJobApplyingRef = useRef("");
  const transcriptSupported = useMemo(
    () =>
      typeof window !== "undefined" &&
      Boolean(window.SpeechRecognition || window.webkitSpeechRecognition),
    []
  );

  const selectedChatUser = useMemo(
    () => directory.find((entry) => entry.id === selectedChatUserId) || null,
    [directory, selectedChatUserId]
  );

  const chatDirectory = useMemo(
    () => directory.filter((entry) => userMatchesSearch(entry, peopleSearch)),
    [directory, peopleSearch]
  );

  const broadcastDirectory = useMemo(
    () => directory.filter((entry) => userMatchesSearch(entry, broadcastSearch)),
    [directory, broadcastSearch]
  );

  const selectedBroadcastUsers = useMemo(
    () => directory.filter((entry) => broadcastRecipients.includes(entry.id)),
    [directory, broadcastRecipients]
  );

  const meetingParticipantDirectory = useMemo(
    () => directory.filter((entry) => userMatchesSearch(entry, meetingParticipantSearch)),
    [directory, meetingParticipantSearch]
  );

  const activeMeeting = useMemo(() => {
    if (meetingDetail && meetingDetail.id === activeMeetingId) return meetingDetail;
    return meetings.find((entry) => entry.id === activeMeetingId) || null;
  }, [meetings, meetingDetail, activeMeetingId]);

  const activeMeetingTranscriptJob = useMemo(() => {
    if (!meetingTranscriptJob?.id) return null;
    if (!meetingTranscriptJob.meetingId || !activeMeetingId) return meetingTranscriptJob;
    return meetingTranscriptJob.meetingId === activeMeetingId ? meetingTranscriptJob : null;
  }, [activeMeetingId, meetingTranscriptJob]);

  const visibleMeetings = useMemo(() => {
    const nowMs = Date.now();
    const sorted = [...meetings].sort((a, b) => {
      const aMs = parseDate(a?.scheduledFor || a?.createdAt)?.getTime() || 0;
      const bMs = parseDate(b?.scheduledFor || b?.createdAt)?.getTime() || 0;
      return bMs - aMs;
    });

    if (meetingListFilter === "past") {
      return sorted.filter((meeting) => {
        const when = parseDate(meeting?.scheduledFor || meeting?.createdAt);
        return when ? when.getTime() < nowMs : false;
      });
    }

    if (meetingListFilter === "upcoming") {
      return sorted.filter((meeting) => {
        const when = parseDate(meeting?.scheduledFor || meeting?.createdAt);
        return when ? when.getTime() >= nowMs : true;
      });
    }

    return sorted;
  }, [meetings, meetingListFilter]);

  const hasMeetingReport = Boolean(
    activeMeeting?.notes?.transcript || activeMeeting?.notes?.summary
  );
  const isCallOnActiveMeeting =
    Boolean(activeMeeting) &&
    callSession.active &&
    callSession.meetingId === activeMeeting.id;
  const activeDraftMeetingId = activeMeetingId || callSession.meetingId;
  const summaryTaskSuggestions = useMemo(
    () => buildMeetingTaskSuggestions(notesSummary, activeMeeting),
    [notesSummary, activeMeeting]
  );
  const reviewedTaskSuggestions = useMemo(
    () =>
      summaryTaskSuggestions.map((suggestion) => {
        const edit = summaryTaskEdits[suggestion.title] || {};
        const reviewState = summaryTaskReviewStates[suggestion.title] || {};
        const accepted = acceptedSummaryTodos.includes(suggestion.title);
        return {
          ...suggestion,
          description: String(edit.description || suggestion.description || "").trim(),
          dueAt:
            toIsoFromDateTimeLocal(edit.deadlineLocalValue) ||
            suggestion.dueAt ||
            resolveMeetingTaskDeadline({
              dueText: suggestion.dueLabel,
              meeting: activeMeeting,
            }),
          reviewStatus: accepted
            ? "accepted"
            : normalizeTaskReviewStatus(reviewState.status || suggestion.reviewStatus),
          reviewedAt:
            reviewState.reviewedAt ||
            suggestion.reviewedAt ||
            (accepted ? new Date().toISOString() : null),
        };
      }),
    [
      acceptedSummaryTodos,
      activeMeeting,
      summaryTaskEdits,
      summaryTaskReviewStates,
      summaryTaskSuggestions,
    ]
  );
  const acceptedTaskDrafts = useMemo(
    () =>
      reviewedTaskSuggestions
        .filter((entry) => entry.reviewStatus === "accepted")
        .map((entry) => ({
          description: entry.description,
          dueAt: entry.dueAt,
          dueLabel: entry.dueLabel,
          title: entry.title,
        }))
        .filter(Boolean),
    [reviewedTaskSuggestions]
  );
  const currentSummaryPayload = useMemo(
    () =>
      buildMeetingSummaryPayload({
        acceptedTodos: acceptedSummaryTodos,
        acceptedTaskDrafts,
        attachments: notesAttachments,
        reviewedTaskSuggestions,
        summary: notesSummary,
      }),
    [
      acceptedSummaryTodos,
      acceptedTaskDrafts,
      notesAttachments,
      notesSummary,
      reviewedTaskSuggestions,
    ]
  );
  const callAutosavePayload = useMemo(() => {
    const snapshot = createMeetingDraftSnapshot({
      acceptedSummaryTodos,
      attachments: notesAttachments,
      callSession,
      meetingId: callSession.meetingId || activeMeetingId,
      summary: notesSummary,
      transcriptionJob:
        meetingTranscriptJob && !meetingTranscriptJob.applied ? meetingTranscriptJob : null,
      transcript: notesTranscript,
    });
    const summary = snapshot.summary
      ? {
          ...snapshot.summary,
          acceptedTodos: snapshot.acceptedSummaryTodos,
        }
      : null;

    return {
      meetingId: snapshot.meetingId,
      signature: JSON.stringify({
        summary,
        transcript: snapshot.transcript,
      }),
      summary,
      transcript: snapshot.transcript,
    };
  }, [
    acceptedSummaryTodos,
    activeMeetingId,
    callSession,
    meetingTranscriptJob,
    notesAttachments,
    notesSummary,
    notesTranscript,
  ]);
  const hasProtectedDraft = Boolean(activeDraftMeetingId && (callSession.active || meetingDraftDirty));
  const callReliability = useMemo(() => {
    const networkLabel = isOnline ? "Online" : "Offline";
    const networkTone = isOnline ? "ready" : "danger";
    const transcriptLabel = !transcriptSupported
      ? "Unsupported"
      : transcriptLive
        ? "Listening"
        : String(notesTranscript || "").trim()
          ? "Captured"
          : "Ready";
    const transcriptTone = !transcriptSupported
      ? "danger"
      : transcriptLive
        ? "ready"
        : "fallback";
    const protectionLabel = draftRestoredAt
      ? `Recovered ${formatDateTime(draftRestoredAt)}`
      : draftSavedAt && hasProtectedDraft
        ? `Protected ${formatDateTime(draftSavedAt)}`
        : hasProtectedDraft
          ? "Protecting"
          : "Idle";
    const protectionTone = draftRestoredAt
      ? "fallback"
      : draftSavedAt && hasProtectedDraft
        ? "ready"
        : "fallback";
    const guidance = !isOnline
      ? "You are offline. Keep taking notes; StudyFlow is preserving the current meeting draft in this browser."
      : transcriptLive
        ? "Live transcript is listening now, and the current meeting draft is being protected locally."
        : callSession.active
          ? transcriptSupported
            ? "Call is active. You can restart live transcript anytime or continue with manual notes."
            : "Call is active. This browser cannot run live transcript, so use manual notes or upload a transcript file."
          : draftRestoredAt
            ? "A local meeting draft was restored after a refresh or interruption."
            : "Meeting notes can recover from refreshes whenever local draft protection is active.";
    const lastCaptureLabel = lastTranscriptCapturedAt
      ? `Last note update ${formatDateTime(lastTranscriptCapturedAt)}.`
      : "";
    const mediaWarning = draftMediaAttachmentCount
      ? `${draftMediaAttachmentCount} media attachment(s) are not stored in local recovery and may need re-upload after refresh.`
      : "";
    const syncLabel = callServerSync.status === "syncing"
      ? "Syncing"
      : callServerSync.status === "synced" && callServerSync.lastSyncedAt
        ? `Synced ${formatDateTime(callServerSync.lastSyncedAt)}`
        : callServerSync.status === "error"
          ? "Sync error"
          : !isOnline
            ? "Offline"
            : callSession.active && meetingDraftDirty
              ? "Pending"
              : "Idle";
    const syncTone = callServerSync.status === "synced"
      ? "ready"
      : callServerSync.status === "error"
        ? "danger"
        : callServerSync.status === "syncing"
          ? "fallback"
          : !isOnline
            ? "danger"
            : "fallback";
    const syncNote = callServerSync.error
      ? `Last sync issue: ${callServerSync.error}`
      : callServerSync.lastSyncedAt
        ? `Server checkpoint updated ${formatDateTime(callServerSync.lastSyncedAt)}.`
        : "";
    const preflightLabel =
      callPreflight.status === "idle" ? "Unchecked" : callPreflight.call.label;
    const preflightTone =
      callPreflight.status === "ready"
        ? "ready"
        : callPreflight.status === "blocked"
          ? "danger"
          : "fallback";
    const preflightNote = callPreflight.checkedAt
      ? `Preflight checked ${formatDateTime(callPreflight.checkedAt)}. ${callPreflight.guidance}`
      : "";
    const frameLabel =
      callFrameState.status === "ready"
        ? "Embedded Ready"
        : callFrameState.status === "rejoining"
          ? "Rejoining"
          : callFrameState.status === "recovering"
            ? "Recovering"
            : callFrameState.status === "starting"
              ? "Starting"
              : "Idle";
    const frameTone =
      callFrameState.status === "ready"
        ? "ready"
        : callFrameState.status === "rejoining" ||
            callFrameState.status === "recovering" ||
            callFrameState.status === "starting"
          ? "fallback"
          : "fallback";
    const frameNote = callFrameState.lastLoadedAt
      ? `Embedded call loaded ${formatDateTime(callFrameState.lastLoadedAt)}.`
      : callFrameState.lastReloadedAt
        ? `Last call refresh ${formatDateTime(callFrameState.lastReloadedAt)}.`
        : "";

    return {
      frameLabel,
      frameNote,
      frameTone,
      guidance,
      lastCaptureLabel,
      mediaWarning,
      networkLabel,
      networkTone,
      preflightLabel,
      preflightNote,
      preflightTone,
      protectionLabel,
      protectionTone,
      syncLabel,
      syncNote,
      syncTone,
      transcriptLabel,
      transcriptTone,
    };
  }, [
    callFrameState,
    callPreflight,
    callServerSync,
    callSession.active,
    draftMediaAttachmentCount,
    draftRestoredAt,
    draftSavedAt,
    hasProtectedDraft,
    isOnline,
    lastTranscriptCapturedAt,
    meetingDraftDirty,
    notesTranscript,
    transcriptLive,
    transcriptSupported,
  ]);

  const collabHighlights = useMemo(
    () => ({
      chat: [
        `${chatDirectory.length} people in current scope view`,
        `${selectedBroadcastUsers.length} broadcast recipient${
          selectedBroadcastUsers.length === 1 ? "" : "s"
        } selected`,
        `${chatMessages.length} message${chatMessages.length === 1 ? "" : "s"} in current thread`,
      ],
      meetings: [
        `${visibleMeetings.length} meeting${visibleMeetings.length === 1 ? "" : "s"} in calendar view`,
        `${acceptedSummaryTodos.length} accepted AI todo${
          acceptedSummaryTodos.length === 1 ? "" : "s"
        }`,
        `${actionItems.length} personal action item${actionItems.length === 1 ? "" : "s"}`,
      ],
      feed: [
        "Global community timeline with per-post privacy",
        "Posts, reactions, comments, and scoped visibility",
        "Use community to amplify ministry, state, school, and student voices",
      ],
    }),
    [
      acceptedSummaryTodos.length,
      actionItems.length,
      chatDirectory.length,
      chatMessages.length,
      selectedBroadcastUsers.length,
      visibleMeetings.length,
    ]
  );

  const queryPermissionState = useCallback(async (name) => {
    if (typeof navigator === "undefined" || !navigator.permissions?.query) {
      return "unknown";
    }

    try {
      const result = await navigator.permissions.query({ name });
      return String(result?.state || "").trim().toLowerCase() || "unknown";
    } catch {
      return "unknown";
    }
  }, []);

  const runCallPreflight = useCallback(
    async (meeting = activeMeeting, options = {}) => {
      const { announce = false } = options;
      if (!meeting) {
        const idleState = createCallPreflightState();
        setCallPreflight(idleState);
        if (announce) setNotice(idleState.guidance);
        return idleState;
      }

      let deviceInventory = summarizeMeetingDeviceInventory();
      if (typeof navigator !== "undefined" && navigator.mediaDevices?.enumerateDevices) {
        try {
          deviceInventory = summarizeMeetingDeviceInventory(
            await navigator.mediaDevices.enumerateDevices()
          );
        } catch {
          deviceInventory = summarizeMeetingDeviceInventory();
        }
      }

      const [microphonePermission, cameraPermission] = await Promise.all([
        queryPermissionState("microphone"),
        queryPermissionState("camera"),
      ]);

      const nextState = {
        ...buildMeetingCallPreflightReport({
          cameraPermission,
          deviceInventory,
          isOnline,
          joinUrl: meeting?.joinUrl,
          microphonePermission,
          transcriptSupported,
        }),
        checkedAt: new Date().toISOString(),
        meetingId: meeting?.id || "",
      };

      setCallPreflight(nextState);
      if (announce) setNotice(nextState.guidance);
      return nextState;
    },
    [activeMeeting, isOnline, queryPermissionState, transcriptSupported]
  );

  const stopLiveTranscript = useCallback(() => {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.stop();
    recognitionRef.current = null;
    setTranscriptLive(false);
  }, []);

  const startLiveTranscript = useCallback(
    (options = {}) => {
      const reset = Boolean(options.reset);
      const SpeechRecognition =
        window.SpeechRecognition || window.webkitSpeechRecognition;
      if (!SpeechRecognition) {
        setError(
          "Live transcript is only supported on browsers with SpeechRecognition (Chrome/Edge)."
        );
        return false;
      }
      if (recognitionRef.current) return true;

      setError("");
      if (reset) setNotesTranscript("");
      const recognition = new SpeechRecognition();
      recognition.lang = "en-US";
      recognition.continuous = true;
      recognition.interimResults = true;

      recognition.onresult = (event) => {
        const chunks = [];
        for (let index = event.resultIndex; index < event.results.length; index += 1) {
          const phrase = event.results[index]?.[0]?.transcript?.trim();
          if (phrase && event.results[index].isFinal) chunks.push(phrase);
        }

        if (chunks.length) {
          setNotesTranscript((prev) =>
            `${prev}${prev ? "\n" : ""}${chunks.join(" ")}`
          );
          setMeetingDraftDirty(true);
          setLastTranscriptCapturedAt(new Date().toISOString());
        }
      };

      recognition.onerror = (event) => {
        setNotice(`Live transcript stopped: ${event.error || "unknown error"}.`);
      };

      recognition.onend = () => {
        recognitionRef.current = null;
        setTranscriptLive(false);
      };

      try {
        recognition.start();
        recognitionRef.current = recognition;
        setTranscriptLive(true);
        return true;
      } catch (error) {
        setNotice(
          `Unable to start live transcript automatically: ${
            error?.message || "unknown error"
          }`
        );
        recognitionRef.current = null;
        setTranscriptLive(false);
        return false;
      }
    },
    []
  );

  const loadDirectory = useCallback(async () => {
    try {
      setDirectoryLoading(true);
      const data = await apiGet("/directory/users");
      const users = (Array.isArray(data) ? data : []).filter(
        (entry) => entry.id !== user.id
      );
      setDirectory(users);

      setMeetingForm((prev) => ({
        ...prev,
        participantIds: prev.participantIds.filter((id) =>
          users.some((entry) => entry.id === id)
        ),
      }));

      setSelectedChatUserId((prev) => {
        if (!prev && users.length) return users[0].id;
        if (prev && !users.some((entry) => entry.id === prev)) {
          return users[0]?.id || "";
        }
        return prev;
      });
    } catch (err) {
      setError(err.message || "Failed to load user directory.");
    } finally {
      setDirectoryLoading(false);
    }
  }, [user.id]);

  const loadChatThread = useCallback(async (userId) => {
    if (!userId) {
      setChatMessages([]);
      return;
    }

    try {
      setChatLoading(true);
      const data = await apiGet(
        `/chat/messages?withUserId=${encodeURIComponent(userId)}&limit=250`
      );
      setChatMessages(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load messages.");
    } finally {
      setChatLoading(false);
    }
  }, []);

  const loadMeetings = useCallback(async () => {
    try {
      const data = await apiGet("/meetings");
      setMeetings(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load meetings.");
    }
  }, []);

  const loadActionItems = useCallback(async () => {
    try {
      setLoadingActionItems(true);
      const data = await apiGet("/action-items");
      setActionItems(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load action items.");
    } finally {
      setLoadingActionItems(false);
    }
  }, []);

  const refreshAiSummaryStatus = useCallback(async () => {
    try {
      setLoadingAiSummaryStatus(true);
      const data = await apiGet("/ai/meeting-summary/status");
      setAiSummaryStatus(normalizeAiSummaryStatus(data));
    } catch (err) {
      setAiSummaryStatus((prev) =>
        normalizeAiSummaryStatus({
          ...prev,
          checkedAt: prev.checkedAt || new Date().toISOString(),
          error: err.message || "AI summary status unavailable",
        })
      );
    } finally {
      setLoadingAiSummaryStatus(false);
    }
  }, []);

  const clearLocalMeetingDraft = useCallback(
    (meetingId = activeDraftMeetingId) => {
      const storageKey = buildMeetingDraftStorageKey({
        meetingId,
        userId: user.id,
      });
      if (storageKey && typeof window !== "undefined") {
        try {
          window.sessionStorage.removeItem(storageKey);
        } catch {
          // Ignore storage cleanup failures and keep the live state intact.
        }
      }
      setDraftSavedAt(null);
      setDraftRestoredAt(null);
      setDraftMediaAttachmentCount(0);
    },
    [activeDraftMeetingId, user.id]
  );

  const saveLocalMeetingDraft = useCallback(
    (meetingId = activeDraftMeetingId) => {
      const storageKey = buildMeetingDraftStorageKey({
        meetingId,
        userId: user.id,
      });
      if (!storageKey || typeof window === "undefined") return false;
      if (!callSession.active && !meetingDraftDirty) {
        clearLocalMeetingDraft(meetingId);
        return false;
      }

      const snapshot = createMeetingDraftSnapshot({
        acceptedSummaryTodos,
        attachments: notesAttachments,
        callSession,
        meetingId,
        summary: currentSummaryPayload,
        transcriptionJob:
          meetingTranscriptJob && !meetingTranscriptJob.applied ? meetingTranscriptJob : null,
        transcript: notesTranscript,
      });

      try {
        window.sessionStorage.setItem(storageKey, JSON.stringify(snapshot));
        setDraftSavedAt(snapshot.savedAt);
        setDraftMediaAttachmentCount(snapshot.mediaAttachmentCount || 0);
        return true;
      } catch {
        return false;
      }
    },
    [
      acceptedSummaryTodos,
      activeDraftMeetingId,
      callSession,
      clearLocalMeetingDraft,
      currentSummaryPayload,
      meetingTranscriptJob,
      meetingDraftDirty,
      notesAttachments,
      notesTranscript,
      user.id,
    ]
  );

  const autosaveCallToServer = useCallback(
    async (options = {}) => {
      const force = Boolean(options.force);
      if (!callSession.active || !callAutosavePayload.meetingId) return false;
      if (!isOnline) {
        setCallServerSync((prev) => ({
          ...prev,
          error: "",
          status: "offline",
        }));
        return false;
      }
      if (
        !force &&
        (!meetingDraftDirty ||
          callAutosavePayload.signature === lastCallAutosaveSignatureRef.current)
      ) {
        return false;
      }

      try {
        setCallServerSync((prev) => ({
          ...prev,
          error: "",
          status: "syncing",
        }));
        await persistMeetingNotesReport(
          callAutosavePayload.meetingId,
          callAutosavePayload.transcript,
          callAutosavePayload.summary,
          ""
        );
        lastCallAutosaveSignatureRef.current = callAutosavePayload.signature;
        setMeetingDraftDirty(false);
        setCallServerSync({
          error: "",
          lastSyncedAt: new Date().toISOString(),
          status: "synced",
        });
        return true;
      } catch (err) {
        setCallServerSync((prev) => ({
          ...prev,
          error: err.message || "Call autosave failed",
          status: "error",
        }));
        return false;
      }
    },
    [
      callAutosavePayload,
      callSession.active,
      isOnline,
      meetingDraftDirty,
      persistMeetingNotesReport,
    ]
  );

  const updateNotesTranscript = useCallback((value) => {
    setNotesTranscript(value);
    setMeetingDraftDirty(true);
    setLastTranscriptCapturedAt(new Date().toISOString());
  }, []);

  const discardRecoveredDraft = useCallback(() => {
    if (!activeMeeting) return;
    if (callSession.active) {
      setNotice("End the active call before discarding the recovered draft.");
      return;
    }

    clearLocalMeetingDraft(activeMeeting.id);
    setNotesTranscript(activeMeeting?.notes?.transcript || "");
    setNotesSummary(activeMeeting?.notes?.summary || null);
    setNotesAttachments(getSavedMeetingAttachments(activeMeeting));
    setAcceptedSummaryTodos(getSavedAcceptedSummaryTodos(activeMeeting));
    setSummaryTaskEdits({});
    setSummaryTaskReviewStates({});
    setMeetingTranscriptJob(null);
    setTranscribingMeetingMedia(false);
    setMeetingDraftDirty(false);
    setLastTranscriptCapturedAt(activeMeeting?.notes?.updatedAt || null);
    setNotice("Recovered local draft discarded. Meeting notes returned to the last saved version.");
  }, [activeMeeting, callSession.active, clearLocalMeetingDraft]);

  const openMeeting = useCallback(
    async (meetingId) => {
      if (!meetingId) return;
      if (callSession.active && callSession.meetingId === meetingId && activeMeetingId === meetingId) {
        return;
      }
      if (callSession.active && callSession.meetingId !== meetingId) {
        setNotice("End the active call before switching to another meeting.");
        return;
      }
      try {
        setLoadingMeetingDetail(true);
        const data = await apiGet(`/meetings/${meetingId}`);
        const draft = parseMeetingDraftSnapshot(
          buildMeetingDraftStorageKey({ meetingId, userId: user.id }) &&
            typeof window !== "undefined"
            ? window.sessionStorage.getItem(
                buildMeetingDraftStorageKey({ meetingId, userId: user.id })
              )
            : null
        );
        const shouldRecoverDraft = shouldRestoreMeetingDraft({
          draft,
          meetingNotesUpdatedAt: data?.notes?.updatedAt,
        });
        lastCallAutosaveSignatureRef.current = JSON.stringify({
          summary: data?.notes?.summary || null,
          transcript: data?.notes?.transcript || "",
        });
        setCallServerSync({
          error: "",
          lastSyncedAt: data?.notes?.updatedAt || null,
          status: data?.notes?.updatedAt ? "synced" : "idle",
        });

        setMeetingDetail(data);
        setActiveMeetingId(meetingId);

        if (shouldRecoverDraft && draft) {
          setNotesTranscript(draft.transcript || data?.notes?.transcript || "");
          setNotesSummary(draft.summary || data?.notes?.summary || null);
          setNotesAttachments(
            draft.transcriptAttachments?.length
              ? draft.transcriptAttachments
              : getSavedMeetingAttachments(data)
          );
          setAcceptedSummaryTodos(
            draft.acceptedSummaryTodos?.length
              ? draft.acceptedSummaryTodos
              : getSavedAcceptedSummaryTodos(data)
          );
          setSummaryTaskEdits({});
          setSummaryTaskReviewStates({});
          setMeetingTranscriptJob(
            draft.transcriptionJob
              ? normalizeMeetingTranscriptJobState(draft.transcriptionJob)
              : null
          );
          setTranscribingMeetingMedia(
            draft.transcriptionJob?.status === "queued" ||
              draft.transcriptionJob?.status === "processing"
          );
          setMeetingDraftDirty(true);
          setDraftRestoredAt(draft.savedAt || new Date().toISOString());
          setDraftSavedAt(draft.savedAt || new Date().toISOString());
          setDraftMediaAttachmentCount(draft.mediaAttachmentCount || 0);
          setLastTranscriptCapturedAt(draft.savedAt || data?.notes?.updatedAt || null);
          if (draft.callSession?.active) {
            setCallSession({
              active: true,
              joinUrl: buildMeetingCallJoinUrl(draft.callSession.joinUrl || data.joinUrl, {
                rejoinNonce: Date.now(),
              }),
              meetingId,
              startedAt: draft.callSession.startedAt || data?.notes?.updatedAt || null,
            });
            setCallFrameState({
              key: Date.now(),
              lastLoadedAt: null,
              lastReloadedAt: draft.savedAt || new Date().toISOString(),
              reloadCount: 0,
              status: "recovering",
            });
          }
          setNotice(
            draft.mediaAttachmentCount
              ? `Recovered your local meeting draft. Re-upload ${draft.mediaAttachmentCount} media attachment(s) if you still need them.`
              : "Recovered your local meeting draft."
          );
          return;
        }

        setNotesTranscript(data?.notes?.transcript || "");
        setNotesSummary(data?.notes?.summary || null);
        setNotesAttachments(getSavedMeetingAttachments(data));
        setAcceptedSummaryTodos(getSavedAcceptedSummaryTodos(data));
        setSummaryTaskEdits({});
        setSummaryTaskReviewStates({});
        setMeetingTranscriptJob(null);
        setTranscribingMeetingMedia(false);
        setMeetingDraftDirty(false);
        setDraftRestoredAt(null);
        setDraftSavedAt(null);
        setDraftMediaAttachmentCount(0);
        setLastTranscriptCapturedAt(data?.notes?.updatedAt || null);
        setCallFrameState(createCallFrameState());
      } catch (err) {
        setError(err.message || "Failed to open meeting details.");
      } finally {
        setLoadingMeetingDetail(false);
      }
    },
    [activeMeetingId, callSession.active, callSession.meetingId, user.id]
  );

  useEffect(() => {
    if (!navRoute?.ts || navRoute.module !== "collab") return;

    if (navRoute.tab) setTab(navRoute.tab);
    if (navRoute.action === "create_meeting") {
      setTab("meetings");
      setShowCreateMeetingForm(true);
    }
    if (navRoute.entityType === "meeting" && navRoute.entityId) {
      setTab("meetings");
      openMeeting(navRoute.entityId);
    }
  }, [navRoute, openMeeting]);

  const sendDirectMessage = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedChatUserId || !chatText.trim()) return;

      try {
        setSendingChat(true);
        setError("");
        await apiPost("/chat/messages", {
          recipientId: selectedChatUserId,
          body: chatText.trim(),
        });
        setChatText("");
        await loadChatThread(selectedChatUserId);
      } catch (err) {
        setError(err.message || "Failed to send message.");
      } finally {
        setSendingChat(false);
      }
    },
    [chatText, loadChatThread, selectedChatUserId]
  );

  const sendBroadcastMessage = useCallback(async () => {
    if (!broadcastRecipients.length || !broadcastText.trim()) return;

    try {
      setSendingBroadcast(true);
      setError("");
      await apiPost("/chat/messages", {
        recipientIds: broadcastRecipients,
        body: broadcastText.trim(),
      });
      setBroadcastText("");
      setNotice(`Broadcast sent to ${broadcastRecipients.length} user(s).`);
    } catch (err) {
      setError(err.message || "Failed to send broadcast.");
    } finally {
      setSendingBroadcast(false);
    }
  }, [broadcastRecipients, broadcastText]);

  const createMeeting = useCallback(
    async (event) => {
      event.preventDefault();
      if (!meetingForm.title.trim()) {
        setError("Meeting title is required.");
        return;
      }
      if (!meetingForm.scheduledFor) {
        setError("Meeting date/time is required.");
        return;
      }

      try {
        setCreatingMeeting(true);
        setError("");
        const created = await apiPost("/meetings", {
          title: meetingForm.title.trim(),
          description: meetingForm.description.trim(),
          scheduledFor: meetingForm.scheduledFor,
          durationMinutes: Number(meetingForm.durationMinutes) || 45,
          participantIds: meetingForm.participantIds,
        });

        setMeetings((prev) => [created, ...prev.filter((m) => m.id !== created.id)]);
        setMeetingForm(defaultMeetingForm());
        setShowCreateMeetingForm(false);
        setActiveMeetingId(created.id);
        setMeetingDetail(created);
        setNotesTranscript(created?.notes?.transcript || "");
        setNotesSummary(created?.notes?.summary || null);
        setNotesAttachments([]);
        setAcceptedSummaryTodos([]);
        setSummaryTaskEdits({});
        setSummaryTaskReviewStates({});
        setMeetingTranscriptJob(null);
        setTranscribingMeetingMedia(false);
        setMeetingDraftDirty(false);
        setDraftSavedAt(null);
        setDraftRestoredAt(null);
        setDraftMediaAttachmentCount(0);
        setLastTranscriptCapturedAt(created?.notes?.updatedAt || null);
        setCallServerSync({
          error: "",
          lastSyncedAt: created?.notes?.updatedAt || null,
          status: created?.notes?.updatedAt ? "synced" : "idle",
        });
        lastCallAutosaveSignatureRef.current = JSON.stringify({
          summary: created?.notes?.summary || null,
          transcript: created?.notes?.transcript || "",
        });

        exportMeetingToCalendar(created, `${safeSlug(created.title)}.ics`);
        setNotice("Meeting created. Calendar invite was downloaded.");
      } catch (err) {
        setError(err.message || "Failed to create meeting.");
      } finally {
        setCreatingMeeting(false);
      }
    },
    [meetingForm]
  );

  const persistMeetingNotesReport = useCallback(
    async (meetingId, transcript, summary, successMessage) => {
      const updated = await apiPut(`/meetings/${meetingId}/notes`, {
        transcript,
        summary,
      });
      setMeetingDetail(updated);
      setMeetings((prev) =>
        prev.map((entry) => (entry.id === updated.id ? updated : entry))
      );
      if (successMessage) setNotice(successMessage);
      return updated;
    },
    []
  );

  const requestAiMeetingSummary = useCallback(async (transcript, meetingContext = {}) => {
    const cleanedTranscript = String(transcript || "").trim();
    if (!cleanedTranscript) return null;

    try {
      const external = await apiPost("/ai/meeting-summary", {
        attachmentKinds: meetingContext.attachmentKinds || [],
        durationMinutes: meetingContext.durationMinutes || null,
        hostName: meetingContext.hostName || "",
        transcript: cleanedTranscript,
        meetingDescription: meetingContext.meetingDescription || "",
        meetingTitle: meetingContext.meetingTitle || "",
        participantCount: meetingContext.participantCount || 0,
        participantNames: meetingContext.participantNames || [],
        requesterName: meetingContext.requesterName || "",
        requesterRole: meetingContext.requesterRole || "",
        scheduledFor: meetingContext.scheduledFor || "",
        transcriptSource: meetingContext.transcriptSource || "",
      });

      if (external && typeof external === "object") {
        return {
          source: external?.provider?.source === "external" ? "external" : "local",
          summary: external,
        };
      }
    } catch (err) {
      const fallback = generateMeetingSummary(cleanedTranscript);
      return {
        source: "local",
        summary: {
          ...fallback,
          provider: {
            source: "local",
            mode: "deterministic_nlp",
            fallbackReason: err.message || "external_provider_unavailable",
          },
        },
        warning: err.message || "External AI summary unavailable",
      };
    }

    return {
      source: "local",
      summary: {
        ...generateMeetingSummary(cleanedTranscript),
        provider: {
          source: "local",
          mode: "deterministic_nlp",
        },
      },
    };
  }, []);

  const requestAiMeetingTranscriptJob = useCallback(
    async (attachment, meetingContext = {}, meetingId = "") => {
      if (!attachment?.url) return null;

      const response = await apiPost("/ai/meeting-transcript/jobs", {
        audio: {
          dataUrl: attachment.url,
          mimeType: attachment.mimeType || "",
          name: attachment.name || "meeting-audio",
        },
        language: "en",
        meetingDescription: meetingContext.meetingDescription || "",
        meetingId,
        meetingTitle: meetingContext.meetingTitle || "",
      });

      return response && typeof response === "object"
        ? normalizeMeetingTranscriptJobState(response)
        : createMeetingTranscriptJobState();
    },
    []
  );

  const refreshMeetingTranscriptJob = useCallback(
    async (jobId, options = {}) => {
      const targetJobId = String(jobId || meetingTranscriptJob?.id || "").trim();
      if (!targetJobId) return null;

      const response = await apiGet(`/ai/meeting-transcript/jobs/${targetJobId}`);
      const nextJob = normalizeMeetingTranscriptJobState(response, {
        applied:
          meetingTranscriptJob?.id === targetJobId ? meetingTranscriptJob.applied : false,
      });

      setMeetingTranscriptJob((prev) =>
        prev?.id === targetJobId
          ? {
              ...nextJob,
              applied: prev.applied,
            }
          : nextJob
      );

      if (nextJob.status === "queued" || nextJob.status === "processing") {
        setTranscribingMeetingMedia(true);
      } else if (!options.keepSpinner) {
        setTranscribingMeetingMedia(false);
      }

      return nextJob;
    },
    [meetingTranscriptJob]
  );

  const applyCompletedTranscriptJob = useCallback(
    async (job) => {
      const transcriptText = String(job?.result?.text || "").trim();
      if (!transcriptText) {
        setMeetingTranscriptJob((prev) =>
          prev?.id === job?.id ? { ...prev, applied: true } : prev
        );
        setTranscribingMeetingMedia(false);
        throw new Error("AI transcription finished without transcript text.");
      }

      const nextTranscript = notesTranscript
        ? `${notesTranscript}\n\n[AI transcript from ${job.attachmentName || "media"}]\n${transcriptText}`
        : transcriptText;

      updateNotesTranscript(nextTranscript);

      const generated = await requestAiMeetingSummary(
        nextTranscript,
        buildMeetingSummaryContext({
          attachments: notesAttachments,
          meeting: activeMeeting,
          transcriptLive,
          user,
        })
      );
      const summary = generated?.summary || generateMeetingSummary(nextTranscript);

      setNotesSummary({
        ...summary,
        acceptedTaskDrafts: [],
        acceptedTodos: [],
        attachments: notesAttachments,
        reviewedTaskSuggestions: [],
      });
      setAcceptedSummaryTodos([]);
      setSummaryTaskReviewStates({});
      setMeetingTranscriptJob((prev) =>
        prev?.id === job.id ? { ...prev, applied: true } : prev
      );
      setTranscribingMeetingMedia(false);
      setNotice(
        generated?.source === "external"
          ? "AI transcript finished and summary suggestions were refreshed."
          : generated?.warning
            ? "AI transcript finished. External summary was unavailable, so local suggestions were refreshed."
            : "AI transcript finished and summary suggestions were refreshed."
      );
    },
    [
      activeMeeting,
      notesAttachments,
      notesTranscript,
      requestAiMeetingSummary,
      transcriptLive,
      updateNotesTranscript,
      user,
    ]
  );

  const handleCallFrameLoad = useCallback(() => {
    setCallFrameState((prev) => ({
      ...prev,
      lastLoadedAt: new Date().toISOString(),
      status: "ready",
    }));
  }, []);

  const rejoinMeetingCall = useCallback(
    async (options = {}) => {
      const { mode = "embed" } = options;
      if (!callSession.active || !activeMeeting) return false;

      const report = await runCallPreflight(activeMeeting);
      if (!report.canRejoin) {
        setNotice(report.guidance);
        return false;
      }

      const refreshedAt = new Date().toISOString();
      const nextJoinUrl = buildMeetingCallJoinUrl(activeMeeting.joinUrl, {
        rejoinNonce: refreshedAt,
      });

      setCallSession((prev) =>
        prev.active
          ? {
              ...prev,
              joinUrl: nextJoinUrl,
            }
          : prev
      );
      setCallFrameState((prev) => ({
        key: prev.key + 1,
        lastLoadedAt: null,
        lastReloadedAt: refreshedAt,
        reloadCount: prev.reloadCount + 1,
        status: "rejoining",
      }));

      if (mode === "window") {
        const opened = window.open(nextJoinUrl, "_blank", "noopener,noreferrer");
        if (!opened) {
          setNotice("Popup blocked. Allow popups to open a fresh call window.");
          return false;
        }
        setNotice(
          report.status === "ready"
            ? "Opened a fresh call window for this meeting."
            : `Opened a fresh call window. ${report.guidance}`
        );
        return true;
      }

      setNotice(
        report.status === "ready"
          ? "Embedded call is reconnecting with the latest meeting link."
          : `Embedded call is reconnecting. ${report.guidance}`
      );
      return true;
    },
    [activeMeeting, callSession.active, runCallPreflight]
  );

  const startMeetingCall = useCallback(
    async (meeting) => {
      if (!meeting) return;
      if (callSession.active && callSession.meetingId !== meeting.id) {
        setNotice("End the active call before starting another one.");
        return;
      }

      const report = await runCallPreflight(meeting);
      if (!report.canStart) {
        setNotice(report.guidance);
        return;
      }

      try {
        setError("");
        await apiPost(`/meetings/${meeting.id}/join`, {});
      } catch {
        // Continue opening call UI even if join tracking fails.
      }

      const startedAt = new Date().toISOString();
      setCallSession({
        active: true,
        meetingId: meeting.id,
        startedAt,
        joinUrl: buildMeetingCallJoinUrl(meeting.joinUrl, { rejoinNonce: startedAt }),
      });
      setCallFrameState({
        key: Date.now(),
        lastLoadedAt: null,
        lastReloadedAt: startedAt,
        reloadCount: 0,
        status: "starting",
      });
      setMeetingDraftDirty(true);

      setNotesTranscript((prev) => {
        const marker = `[Call started ${formatDateTime(startedAt)}]`;
        return prev ? `${prev}\n\n${marker}\n` : `${marker}\n`;
      });
      setLastTranscriptCapturedAt(startedAt);

      const started = startLiveTranscript();
      if (started) {
        setNotice(
          report.status === "ready"
            ? "Call started. Transcript is now tied to this meeting session."
            : `Call started with caution. ${report.guidance}`
        );
      } else {
        setNotice(
          "Call started. Live transcript could not auto-start, but you can type notes and still generate report."
        );
      }
    },
    [callSession.active, callSession.meetingId, runCallPreflight, startLiveTranscript]
  );

  const endMeetingCall = useCallback(
    async (options = {}) => {
      if (!callSession.active || !callSession.meetingId) return;

      const {
        save = true,
        successMessage = "Call ended. Transcript and AI report were saved to this meeting.",
      } = options;

      setEndingCall(true);
      const endedAt = new Date().toISOString();
      stopLiveTranscript();

      const transcript = String(notesTranscript || "").trim();
      const meetingContext = buildMeetingSummaryContext({
        attachments: notesAttachments,
        meeting: activeMeeting,
        transcriptLive,
        user,
      });
      const generatedResult = transcript
        ? await requestAiMeetingSummary(transcript, meetingContext)
        : null;
      const generated = generatedResult?.summary || null;
      const summaryBase = generated
        ? {
            ...generated,
            session: {
              startedAt: callSession.startedAt,
              endedAt,
            },
          }
        : notesSummary;

      const nextAccepted = generated
        ? []
        : acceptedSummaryTodos.filter((todo) =>
            Array.isArray(summaryBase?.todos) ? summaryBase.todos.includes(todo) : false
          );

      const summary = buildMeetingSummaryPayload({
        acceptedTodos: nextAccepted,
        acceptedTaskDrafts: generated
          ? []
          : acceptedTaskDrafts.filter((entry) => nextAccepted.includes(entry.title)),
        attachments: notesAttachments,
        reviewedTaskSuggestions: generated ? [] : reviewedTaskSuggestions,
        summary: summaryBase,
      });

      if (generated) {
        setNotesSummary(summary);
        setAcceptedSummaryTodos([]);
        setSummaryTaskReviewStates({});
        setMeetingDraftDirty(true);
      }

      try {
        if (save) {
          await persistMeetingNotesReport(
            callSession.meetingId,
            transcript,
            summary,
            successMessage
          );
          lastCallAutosaveSignatureRef.current = JSON.stringify({
            summary,
            transcript,
          });
          setMeetingDraftDirty(false);
          clearLocalMeetingDraft(callSession.meetingId);
          setCallServerSync({
            error: "",
            lastSyncedAt: new Date().toISOString(),
            status: "synced",
          });
        }
      } catch (err) {
        setError(err.message || "Failed to save post-call report.");
      } finally {
        setCallSession(createCallSession());
        setCallFrameState(createCallFrameState());
        setEndingCall(false);
      }
    },
    [
      acceptedSummaryTodos,
      acceptedTaskDrafts,
      activeMeeting,
      callSession,
      notesAttachments,
      notesSummary,
      notesTranscript,
      clearLocalMeetingDraft,
      persistMeetingNotesReport,
      requestAiMeetingSummary,
      reviewedTaskSuggestions,
      stopLiveTranscript,
      transcriptLive,
      user,
    ]
  );

  const saveMeetingNotes = useCallback(async () => {
    if (!activeMeetingId) return;
    if (callSession.active && callSession.meetingId === activeMeetingId) {
      setError("End the call first to publish the final meeting report.");
      return;
    }

    try {
      setSavingNotes(true);
      setError("");
      const summaryPayload = buildMeetingSummaryPayload({
        acceptedTodos: acceptedSummaryTodos,
        acceptedTaskDrafts,
        attachments: notesAttachments,
        reviewedTaskSuggestions,
        summary: notesSummary,
      });
      await persistMeetingNotesReport(
        activeMeetingId,
        notesTranscript,
        summaryPayload,
        "Meeting notes saved."
      );
      lastCallAutosaveSignatureRef.current = JSON.stringify({
        summary: summaryPayload,
        transcript: notesTranscript,
      });
      setMeetingDraftDirty(false);
      clearLocalMeetingDraft(activeMeetingId);
      setCallServerSync({
        error: "",
        lastSyncedAt: new Date().toISOString(),
        status: "synced",
      });
    } catch (err) {
      setError(err.message || "Failed to save meeting notes.");
    } finally {
      setSavingNotes(false);
    }
  }, [
    acceptedSummaryTodos,
    acceptedTaskDrafts,
    activeMeetingId,
    callSession.active,
    callSession.meetingId,
    clearLocalMeetingDraft,
    notesAttachments,
    notesSummary,
    notesTranscript,
    persistMeetingNotesReport,
    reviewedTaskSuggestions,
  ]);

  const handleNotesMediaUpload = useCallback(async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;

    try {
      setError("");
      const nextAttachments = [];
      const transcriptChunks = [];

      for (const file of files.slice(0, 8)) {
        if (file.size > 10 * 1024 * 1024) continue;

        if (isTranscriptLikeFile(file)) {
          const text = (await readTextFile(file)).trim();
          if (text) transcriptChunks.push(text);
          nextAttachments.push({
            id: window.crypto.randomUUID(),
            name: file.name,
            kind: "transcript",
            mimeType: file.type || "text/plain",
            size: file.size,
            content: text,
          });
          continue;
        }

        if (
          file.type.startsWith("image/") ||
          file.type.startsWith("video/") ||
          file.type.startsWith("audio/")
        ) {
          const dataUrl = await fileToDataUrl(file);
          nextAttachments.push({
            id: window.crypto.randomUUID(),
            name: file.name,
            kind: mediaKindFromMime(file),
            mimeType: file.type,
            size: file.size,
            url: dataUrl,
          });
        }
      }

      if (transcriptChunks.length) {
        setNotesTranscript((prev) =>
          `${prev}${prev ? "\n\n" : ""}${transcriptChunks.join("\n\n")}`
        );
        setLastTranscriptCapturedAt(new Date().toISOString());
      }
      if (nextAttachments.length) {
        setNotesAttachments((prev) => [...prev, ...nextAttachments].slice(0, 16));
      }
      if (transcriptChunks.length || nextAttachments.length) {
        setMeetingDraftDirty(true);
      }
      setNotice(
        `Attached ${nextAttachments.length} file(s). Transcript files are ready for AI summary.`
      );
    } catch (err) {
      setError(err.message || "Failed to process uploaded media.");
    } finally {
      input.value = "";
    }
  }, []);

  const removeNotesAttachment = useCallback((attachmentId) => {
    setNotesAttachments((prev) => prev.filter((entry) => entry.id !== attachmentId));
    setMeetingDraftDirty(true);
  }, []);

  const handleTranscribeMeetingMedia = useCallback(async () => {
    const mediaAttachment = getTranscribableMediaAttachment(notesAttachments);
    if (!mediaAttachment) {
      setError("Attach an audio or video file first before running AI transcription.");
      return;
    }

    try {
      setTranscribingMeetingMedia(true);
      setError("");
      const transcriptJob = await requestAiMeetingTranscriptJob(
        mediaAttachment,
        buildMeetingSummaryContext({
          attachments: notesAttachments,
          meeting: activeMeeting,
          transcriptLive,
          user,
        }),
        activeMeeting?.id || ""
      );
      setMeetingTranscriptJob(transcriptJob);
      setNotice(
        "AI transcription started. StudyFlow will refresh the transcript and task suggestions when it finishes."
      );
    } catch (err) {
      setMeetingTranscriptJob(null);
      setTranscribingMeetingMedia(false);
      setError(
        err.message ||
          "Failed to transcribe meeting media. You can still use live transcript or uploaded text transcripts."
      );
    }
  }, [
    activeMeeting,
    notesAttachments,
    requestAiMeetingTranscriptJob,
    transcriptLive,
    user,
  ]);

  useEffect(() => {
    if (!meetingTranscriptJob?.id) return undefined;
    if (
      meetingTranscriptJob.status !== "queued" &&
      meetingTranscriptJob.status !== "processing"
    ) {
      return undefined;
    }

    const timer = window.setTimeout(() => {
      refreshMeetingTranscriptJob(meetingTranscriptJob.id).catch((error) => {
        setTranscribingMeetingMedia(false);
        setError(
          error?.message ||
            "Failed to refresh AI transcription job. You can try again from this meeting."
        );
      });
    }, meetingTranscriptJob.pollAfterMs || 2500);

    return () => window.clearTimeout(timer);
  }, [meetingTranscriptJob, refreshMeetingTranscriptJob]);

  useEffect(() => {
    if (!meetingTranscriptJob?.id) return undefined;
    if (meetingTranscriptJob.status !== "completed" || meetingTranscriptJob.applied) {
      return undefined;
    }
    if (
      meetingTranscriptJob.meetingId &&
      activeMeetingId &&
      meetingTranscriptJob.meetingId !== activeMeetingId
    ) {
      return undefined;
    }
    if (transcriptJobApplyingRef.current === meetingTranscriptJob.id) {
      return undefined;
    }

    let cancelled = false;
    transcriptJobApplyingRef.current = meetingTranscriptJob.id;

    void applyCompletedTranscriptJob(meetingTranscriptJob)
      .catch((error) => {
        if (cancelled) return;
        setMeetingTranscriptJob((prev) =>
          prev?.id === meetingTranscriptJob.id
            ? {
                ...prev,
                applied: true,
                error: prev.error || error?.message || "Failed to apply transcript job.",
              }
            : prev
        );
        setTranscribingMeetingMedia(false);
        setError(
          error?.message ||
            "AI transcription finished, but StudyFlow could not apply the transcript automatically."
        );
      })
      .finally(() => {
        if (transcriptJobApplyingRef.current === meetingTranscriptJob.id) {
          transcriptJobApplyingRef.current = "";
        }
      });

    return () => {
      cancelled = true;
    };
  }, [activeMeetingId, applyCompletedTranscriptJob, meetingTranscriptJob]);

  const updateSummaryTaskDescription = useCallback((title, value) => {
    if (!title) return;
    setSummaryTaskEdits((prev) => ({
      ...prev,
      [title]: {
        ...(prev[title] || {}),
        description: value,
      },
    }));
    setMeetingDraftDirty(true);
  }, []);

  const updateSummaryTaskDeadline = useCallback((title, value) => {
    if (!title) return;
    setSummaryTaskEdits((prev) => ({
      ...prev,
      [title]: {
        ...(prev[title] || {}),
        deadlineLocalValue: value,
      },
    }));
    setMeetingDraftDirty(true);
  }, []);

  const handleGenerateSummary = useCallback(async () => {
    if (!String(notesTranscript || "").trim()) {
      setError("No transcript text yet. Start/stop call or type notes first.");
      return;
    }

    try {
      setError("");
      const generated = await requestAiMeetingSummary(
        notesTranscript,
        buildMeetingSummaryContext({
          attachments: notesAttachments,
          meeting: activeMeeting,
          transcriptLive,
          user,
        })
      );
      const summary = generated?.summary || generateMeetingSummary(notesTranscript);

      setNotesSummary({
        ...summary,
        acceptedTodos: [],
        attachments: notesAttachments,
        reviewedTaskSuggestions: [],
      });
      setAcceptedSummaryTodos([]);
      setSummaryTaskReviewStates({});
      setMeetingDraftDirty(true);
      setNotice(
        generated?.source === "external"
          ? "AI summary generated by external provider."
          : generated?.warning
          ? "External AI unavailable, local summary generated from transcript."
          : "AI summary generated from transcript."
      );
    } catch (err) {
      setError(err.message || "Failed to generate AI summary.");
    }
  }, [
    activeMeeting,
    notesAttachments,
    notesTranscript,
    requestAiMeetingSummary,
    transcriptLive,
    user,
  ]);

  const addSummaryTodosToActionList = useCallback(async () => {
    if (!activeMeetingId) return;

    const selectedDrafts = acceptedTaskDrafts.filter((entry) => entry?.title);
    if (!selectedDrafts.length) {
      setError("Accept one or more AI todo suggestions before syncing.");
      return;
    }

    const existingSignatures = new Set(
      actionItems
        .filter((item) => item.meetingId === activeMeetingId)
        .map((item) => normalizeTodoSignature(item.title))
        .filter(Boolean)
    );

    const items = selectedDrafts
      .map((draft, index) => {
        const dueAt =
          draft.dueAt ||
          resolveMeetingTaskDeadline({
            dueText: draft.dueLabel,
            meeting: activeMeeting,
            offsetIndex: index,
          });
        return {
          title: draft.title,
          details:
            draft.description ||
            (activeMeeting?.title
              ? `Captured from meeting: ${activeMeeting.title}`
              : "Captured from meeting summary"),
          meetingId: activeMeetingId,
          dueAt,
          status: "Todo",
          clientKey: buildActionClientKey({
            meetingId: activeMeetingId,
            todoTitle: draft.title,
            dueAt,
          }),
        };
      })
      .filter((item) => !existingSignatures.has(normalizeTodoSignature(item.title)));

    if (!items.length) {
      setNotice("All accepted todos are already in your meeting action list.");
      return;
    }

    try {
      setSavingActionItems(true);
      setError("");
      const created = await apiPost("/action-items/bulk", { items });
      let createdTasksCount = 0;
      if (user.role === "student") {
        const taskPayloads = items.map((item) => ({
          title: item.title,
          description: item.details,
          category: "Other",
          priority: "Medium",
          status: "Todo",
          deadline: item.dueAt,
          progress: 0,
          learningSummary: "",
        }));
        const taskResults = await Promise.all(
          taskPayloads.map((payload) => apiPost("/tasks", payload))
        );
        createdTasksCount = taskResults.length;
      }
      if (notesSummary) {
        const syncedAt = new Date().toISOString();
        const syncedReviewedTaskSuggestions = reviewedTaskSuggestions.map((entry) =>
          selectedDrafts.some((draft) => draft.title === entry.title)
            ? {
                ...entry,
                reviewStatus: "accepted",
                reviewedAt: entry.reviewedAt || syncedAt,
                syncedAt,
                syncedTarget:
                  user.role === "student"
                    ? "action_list_and_task_board"
                    : "action_list",
              }
            : entry
        );
        const syncedSummaryPayload = buildMeetingSummaryPayload({
          acceptedTodos: selectedDrafts.map((entry) => entry.title),
          acceptedTaskDrafts: selectedDrafts,
          attachments: notesAttachments,
          reviewedTaskSuggestions: syncedReviewedTaskSuggestions,
          summary: notesSummary,
        });
        await persistMeetingNotesReport(
          activeMeetingId,
          notesTranscript,
          syncedSummaryPayload,
          ""
        );
        setNotesSummary(syncedSummaryPayload);
        lastCallAutosaveSignatureRef.current = JSON.stringify({
          summary: syncedSummaryPayload,
          transcript: notesTranscript,
        });
        setMeetingDraftDirty(false);
        clearLocalMeetingDraft(activeMeetingId);
        setCallServerSync({
          error: "",
          lastSyncedAt: new Date().toISOString(),
          status: "synced",
        });
      }
      await loadActionItems();
      const actionItemsCount = Array.isArray(created) ? created.length : items.length;
      const skippedCount = Math.max(0, selectedDrafts.length - items.length);
      setNotice(
        user.role === "student"
          ? `${actionItemsCount} item(s) synced, ${skippedCount} duplicate(s) skipped, and ${createdTasksCount} added to your main task board.`
          : `${actionItemsCount} summary todo(s) synced and ${skippedCount} duplicate(s) skipped.`
      );
    } catch (err) {
      setError(err.message || "Failed to add summary todos to your list.");
    } finally {
      setSavingActionItems(false);
    }
  }, [
    acceptedTaskDrafts,
    actionItems,
    activeMeeting,
    activeMeetingId,
    clearLocalMeetingDraft,
    loadActionItems,
    notesAttachments,
    notesSummary,
    notesTranscript,
    persistMeetingNotesReport,
    reviewedTaskSuggestions,
    user.role,
  ]);

  const addSummaryTodosToCalendar = useCallback(() => {
    const todos = uniqueAcceptedTodos(acceptedSummaryTodos);
    if (!todos.length) {
      setError("Accept one or more AI todo suggestions first.");
      return;
    }

    const events = summaryTodosToCalendarEvents(todos, activeMeeting);
    exportTasksToCalendar(
      events,
      `${safeSlug(activeMeeting?.title || "meeting")}-summary-todos.ics`
    );
    setNotice("Summary todos exported to calendar (.ics).");
  }, [acceptedSummaryTodos, activeMeeting]);

  const planFollowUpMeetingFromSummary = useCallback(() => {
    if (!activeMeeting) return;
    const todos = uniqueAcceptedTodos(acceptedSummaryTodos);
    if (!todos.length) {
      setError("Accept one or more AI todo suggestions before drafting follow-up.");
      return;
    }
    const participantIds = (activeMeeting.participants || [])
      .map((entry) => entry.id)
      .filter((id) => id && id !== user.id);

    const defaultDate = toDateTimeLocalValue(defaultFollowUpDueFromMeeting(activeMeeting));
    setMeetingForm({
      title: `Follow-up: ${activeMeeting.title}`,
      description: todos.length
        ? `Follow-up on action items:\n${todos.map((todo) => `- ${todo}`).join("\n")}`
        : `Follow-up on ${activeMeeting.title}`,
      scheduledFor: defaultDate || defaultMeetingForm().scheduledFor,
      durationMinutes: 30,
      participantIds,
    });
    setShowCreateMeetingForm(true);
    setNotice("Follow-up meeting draft prepared in the Create Meeting form.");
  }, [acceptedSummaryTodos, activeMeeting, user.id]);

  const toggleAcceptedSummaryTodo = useCallback((todo) => {
    if (!todo) return;
    const reviewedAt = new Date().toISOString();
    setAcceptedSummaryTodos((prev) =>
      prev.includes(todo) ? prev.filter((entry) => entry !== todo) : [...prev, todo]
    );
    setSummaryTaskReviewStates((prev) => ({
      ...prev,
      [todo]: {
        reviewedAt,
        status:
          prev[todo]?.status === "accepted" || acceptedSummaryTodos.includes(todo)
            ? "pending"
            : "accepted",
      },
    }));
    setMeetingDraftDirty(true);
  }, [acceptedSummaryTodos]);

  const rejectSummaryTodo = useCallback((todo) => {
    if (!todo) return;
    setAcceptedSummaryTodos((prev) => prev.filter((entry) => entry !== todo));
    setSummaryTaskReviewStates((prev) => ({
      ...prev,
      [todo]: {
        reviewedAt: new Date().toISOString(),
        status: "rejected",
      },
    }));
    setMeetingDraftDirty(true);
  }, []);

  const resetSummaryTodoReview = useCallback((todo) => {
    if (!todo) return;
    setAcceptedSummaryTodos((prev) => prev.filter((entry) => entry !== todo));
    setSummaryTaskReviewStates((prev) => ({
      ...prev,
      [todo]: {
        reviewedAt: new Date().toISOString(),
        status: "pending",
      },
    }));
    setMeetingDraftDirty(true);
  }, []);

  const acceptAllSummaryTodos = useCallback(() => {
    const todos = Array.isArray(notesSummary?.todos) ? notesSummary.todos : [];
    setAcceptedSummaryTodos(todos);
    const reviewedAt = new Date().toISOString();
    setSummaryTaskReviewStates((prev) => {
      const next = { ...prev };
      for (const todo of todos) {
        next[todo] = {
          reviewedAt,
          status: "accepted",
        };
      }
      return next;
    });
    setMeetingDraftDirty(true);
  }, [notesSummary]);

  const clearAcceptedSummaryTodos = useCallback(() => {
    setAcceptedSummaryTodos((prev) => {
      setSummaryTaskReviewStates((existing) => {
        const next = { ...existing };
        const reviewedAt = new Date().toISOString();
        for (const todo of prev) {
          next[todo] = {
            reviewedAt,
            status: "pending",
          };
        }
        return next;
      });
      return [];
    });
    setMeetingDraftDirty(true);
  }, []);

  const toggleActionItem = useCallback(
    async (item) => {
      if (!item) return;
      const nextStatus = item.status === "Done" ? "Todo" : "Done";
      try {
        await apiPut(`/action-items/${item.id}`, { status: nextStatus });
        await loadActionItems();
      } catch (err) {
        setError(err.message || "Failed to update action item.");
      }
    },
    [loadActionItems]
  );

  const exportActionItemsToCalendarFile = useCallback(() => {
    const todoItems = actionItems.filter((item) => item.status === "Todo");
    if (!todoItems.length) {
      setError("No pending action items to export.");
      return;
    }

    const base = new Date();
    base.setDate(base.getDate() + 1);
    base.setHours(9, 0, 0, 0);

    const mapped = todoItems.map((item, index) => ({
      id: item.id,
      title: item.title,
      description: item.details || "",
      category: "Action Item",
      priority: "Medium",
      status: "Todo",
      deadline:
        item.dueAt || new Date(base.getTime() + index * 45 * 60 * 1000).toISOString(),
      reminderOffsets: [30, 10, 5],
    }));

    exportTasksToCalendar(mapped, "my-action-items.ics");
    setNotice("Personal action items exported to calendar.");
  }, [actionItems]);

  const toggleParticipant = useCallback((id) => {
    setMeetingForm((prev) => {
      const exists = prev.participantIds.includes(id);
      return {
        ...prev,
        participantIds: exists
          ? prev.participantIds.filter((entry) => entry !== id)
          : [...prev.participantIds, id],
      };
    });
  }, []);

  const toggleBroadcastRecipient = useCallback((id) => {
    setBroadcastRecipients((prev) =>
      prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
    );
  }, []);

  useEffect(() => {
    loadDirectory();
    loadMeetings();
    loadActionItems();
    return () => stopLiveTranscript();
  }, [loadDirectory, loadMeetings, loadActionItems, stopLiveTranscript]);

  useEffect(() => {
    if (tab !== "meetings") return undefined;
    if (!activeMeeting) {
      setCallPreflight(createCallPreflightState());
      return undefined;
    }

    runCallPreflight(activeMeeting);
    return undefined;
  }, [activeMeeting, runCallPreflight, tab]);

  useEffect(() => {
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.addEventListener) {
      return undefined;
    }

    const handleDeviceChange = () => {
      if (tab === "meetings" && activeMeeting) {
        runCallPreflight(activeMeeting);
      }
    };

    navigator.mediaDevices.addEventListener("devicechange", handleDeviceChange);
    return () => {
      navigator.mediaDevices.removeEventListener("devicechange", handleDeviceChange);
    };
  }, [activeMeeting, runCallPreflight, tab]);

  useEffect(() => {
    if (typeof window === "undefined") return undefined;

    const handleOnline = () => {
      setIsOnline(true);
      if (callSession.active) {
        autosaveCallToServer({ force: true });
      }
      if (callSession.active || meetingDraftDirty) {
        setNotice("Connection restored. Your in-progress meeting draft is still available.");
      }
    };
    const handleOffline = () => {
      setIsOnline(false);
      saveLocalMeetingDraft();
      if (callSession.active || meetingDraftDirty) {
        setNotice(
          "You are offline. Keep taking notes and StudyFlow will protect the meeting draft in this browser."
        );
      }
    };

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
    };
  }, [
    autosaveCallToServer,
    callSession.active,
    meetingDraftDirty,
    saveLocalMeetingDraft,
  ]);

  useEffect(() => {
    if (!activeDraftMeetingId) return undefined;
    if (!callSession.active && !meetingDraftDirty) {
      clearLocalMeetingDraft(activeDraftMeetingId);
      return undefined;
    }

    saveLocalMeetingDraft(activeDraftMeetingId);
    return undefined;
  }, [
    activeDraftMeetingId,
    callSession.active,
    clearLocalMeetingDraft,
    meetingDraftDirty,
    saveLocalMeetingDraft,
  ]);

  useEffect(() => {
    if (!(callSession.active || meetingDraftDirty)) return undefined;
    if (typeof window === "undefined" || typeof document === "undefined") {
      return undefined;
    }

    const handleBeforeUnload = (event) => {
      saveLocalMeetingDraft();
      event.preventDefault();
      event.returnValue = "";
    };
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") {
        saveLocalMeetingDraft();
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
      document.removeEventListener("visibilitychange", handleVisibilityChange);
    };
  }, [callSession.active, meetingDraftDirty, saveLocalMeetingDraft]);

  useEffect(() => {
    if (!callSession.active || !callSession.meetingId) return undefined;
    const timer = window.setInterval(() => {
      autosaveCallToServer();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [autosaveCallToServer, callSession.active, callSession.meetingId]);

  useEffect(() => {
    if (tab !== "meetings") return undefined;
    refreshAiSummaryStatus();
    const timer = window.setInterval(() => {
      refreshAiSummaryStatus();
    }, 45000);
    return () => window.clearInterval(timer);
  }, [tab, refreshAiSummaryStatus]);

  useEffect(() => {
    if (!selectedChatUserId) return;
    loadChatThread(selectedChatUserId);
  }, [selectedChatUserId, loadChatThread]);

  useEffect(() => {
    if (!selectedChatUserId) return undefined;
    const timer = window.setInterval(() => {
      loadChatThread(selectedChatUserId);
    }, 5000);
    return () => window.clearInterval(timer);
  }, [selectedChatUserId, loadChatThread]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadMeetings();
    }, 20000);
    return () => window.clearInterval(timer);
  }, [loadMeetings]);

  useEffect(() => {
    setSummaryTaskEdits((prev) => {
      const next = {};
      for (const suggestion of summaryTaskSuggestions) {
        const savedReview = Array.isArray(notesSummary?.reviewedTaskSuggestions)
          ? notesSummary.reviewedTaskSuggestions.find(
              (entry) => entry?.title === suggestion.title
            )
          : null;
        const savedDraft = Array.isArray(notesSummary?.acceptedTaskDrafts)
          ? notesSummary.acceptedTaskDrafts.find((entry) => entry?.title === suggestion.title)
          : null;
        const previous = prev[suggestion.title] || {};
        next[suggestion.title] = {
          deadlineLocalValue:
            previous.deadlineLocalValue ||
            toDateTimeLocalValue(savedReview?.dueAt || savedDraft?.dueAt || suggestion.dueAt),
          description:
            previous.description ||
            String(
              savedReview?.description || savedDraft?.description || suggestion.description || ""
            ).trim(),
        };
      }
      return next;
    });
  }, [notesSummary, summaryTaskSuggestions]);

  useEffect(() => {
    setSummaryTaskReviewStates((prev) => {
      const next = {};
      for (const suggestion of summaryTaskSuggestions) {
        const savedReview = Array.isArray(notesSummary?.reviewedTaskSuggestions)
          ? notesSummary.reviewedTaskSuggestions.find(
              (entry) => entry?.title === suggestion.title
            )
          : null;
        const previous = prev[suggestion.title] || {};
        next[suggestion.title] = {
          reviewedAt:
            previous.reviewedAt || savedReview?.reviewedAt || suggestion.reviewedAt || null,
          status: normalizeTaskReviewStatus(
            previous.status || savedReview?.reviewStatus || suggestion.reviewStatus
          ),
        };
      }
      return next;
    });
  }, [notesSummary, summaryTaskSuggestions]);

  useEffect(() => {
    const available = Array.isArray(notesSummary?.todos) ? notesSummary.todos : [];
    const savedAccepted = Array.isArray(notesSummary?.acceptedTodos)
      ? notesSummary.acceptedTodos
      : [];
    const savedReviewedAccepted = Array.isArray(notesSummary?.reviewedTaskSuggestions)
      ? notesSummary.reviewedTaskSuggestions
          .filter((entry) => entry?.reviewStatus === "accepted")
          .map((entry) => entry?.title)
      : [];

    setAcceptedSummaryTodos((prev) => {
      const baseline = prev.length ? prev : [...savedAccepted, ...savedReviewedAccepted];
      return uniqueAcceptedTodos(baseline).filter((entry) => available.includes(entry));
    });
  }, [notesSummary]);

  useEffect(() => {
    if (tab !== "meetings") return undefined;
    const timer = window.setInterval(() => {
      loadActionItems();
    }, 25000);
    return () => window.clearInterval(timer);
  }, [tab, loadActionItems]);

  const handleCloseHub = useCallback(async () => {
    if (callSession.active) {
      await endMeetingCall({
        save: true,
        successMessage:
          "Call ended while closing hub. Transcript and report were saved.",
      });
    }
    if (typeof onClose === "function") onClose();
  }, [callSession.active, endMeetingCall, onClose]);

  return {
    activeMeetingTranscriptJob,
    acceptedSummaryTodos,
    acceptAllSummaryTodos,
    actionItems,
    activeMeeting,
    activeMeetingId,
    addSummaryTodosToActionList,
    addSummaryTodosToCalendar,
    aiSummaryStatus,
    broadcastDirectory,
    broadcastRecipients,
    broadcastSearch,
    broadcastText,
    callFrameState,
    callPreflight,
    callSession,
    callReliability,
    chatDirectory,
    chatLoading,
    chatMessages,
    chatText,
    clearAcceptedSummaryTodos,
    collabHighlights,
    createMeeting,
    creatingMeeting,
    discardRecoveredDraft,
    directoryLoading,
    endingCall,
    endMeetingCall,
    error,
    exportActionItemsToCalendarFile,
    handleCloseHub,
    handleCallFrameLoad,
    handleGenerateSummary,
    handleNotesMediaUpload,
    handleTranscribeMeetingMedia,
    hasMeetingReport,
    isCallOnActiveMeeting,
    loadActionItems,
    loadChatThread,
    loadingAiSummaryStatus,
    loadingActionItems,
    loadingMeetingDetail,
    meetingForm,
    meetingListFilter,
    meetingParticipantDirectory,
    meetingParticipantSearch,
    notice,
    notesAttachments,
    notesSummary,
    notesTranscript,
    openMeeting,
    peopleSearch,
    planFollowUpMeetingFromSummary,
    refreshMeetingTranscriptJob,
    refreshAiSummaryStatus,
    rejectSummaryTodo,
    rejoinMeetingCall,
    resetSummaryTodoReview,
    removeNotesAttachment,
    runCallPreflight,
    saveMeetingNotes,
    savingActionItems,
    savingNotes,
    selectedBroadcastUsers,
    selectedChatUser,
    selectedChatUserId,
    sendBroadcastMessage,
    sendDirectMessage,
    sendingBroadcast,
    sendingChat,
    setBroadcastSearch,
    setBroadcastText,
    setChatText,
    setMeetingForm,
    setMeetingListFilter,
    setMeetingParticipantSearch,
    setNotice,
    setPeopleSearch,
    setSelectedChatUserId,
    setShowCreateMeetingForm,
    setTab,
    showCreateMeetingForm,
    startLiveTranscript,
    startMeetingCall,
    stopLiveTranscript,
    summaryTaskEdits,
    summaryTaskSuggestions: reviewedTaskSuggestions,
    tab,
    transcribingMeetingMedia,
    toggleAcceptedSummaryTodo,
    toggleActionItem,
    toggleBroadcastRecipient,
    toggleParticipant,
    transcriptLive,
    transcriptSupported,
    updateSummaryTaskDeadline,
    updateSummaryTaskDescription,
    updateNotesTranscript,
    visibleMeetings,
  };
}
