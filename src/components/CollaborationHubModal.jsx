import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../lib/api";
import { exportMeetingToCalendar, exportTasksToCalendar } from "../lib/calendar";
import { formatDateTime, parseDate, toDateTimeLocalValue } from "../lib/helpers";
import { generateMeetingSummary } from "../lib/meetingAi";
import { ROLE_LABELS } from "../lib/constants";
import CommunityFeedPanel from "./CommunityFeedPanel";

function defaultMeetingForm() {
  const oneHourAhead = new Date(Date.now() + 60 * 60 * 1000).toISOString();
  return {
    title: "",
    description: "",
    scheduledFor: toDateTimeLocalValue(oneHourAhead),
    durationMinutes: 45,
    participantIds: [],
  };
}

function safeSlug(value) {
  return (
    String(value || "studyflow-meeting")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-+|-+$/g, "") || "studyflow-meeting"
  );
}

function defaultFollowUpDueFromMeeting(meeting) {
  const start = parseDate(meeting?.scheduledFor) || new Date();
  const next = new Date(start.getTime());
  next.setDate(next.getDate() + 1);
  if (Number.isNaN(next.getTime())) return null;
  return next.toISOString();
}

function summaryTodosToCalendarEvents(todoItems, meeting) {
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

function userMatchesSearch(user, query) {
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

function mediaKindFromMime(file) {
  if (String(file?.type || "").startsWith("video/")) return "video";
  if (String(file?.type || "").startsWith("audio/")) return "audio";
  return "image";
}

function isTranscriptLikeFile(file) {
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

export default function CollaborationHubModal({ user, onClose }) {
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

  const [notesTranscript, setNotesTranscript] = useState("");
  const [notesSummary, setNotesSummary] = useState(null);
  const [notesAttachments, setNotesAttachments] = useState([]);
  const [savingNotes, setSavingNotes] = useState(false);
  const [transcriptLive, setTranscriptLive] = useState(false);
  const [meetingListFilter, setMeetingListFilter] = useState("all");
  const [actionItems, setActionItems] = useState([]);
  const [loadingActionItems, setLoadingActionItems] = useState(false);
  const [savingActionItems, setSavingActionItems] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [acceptedSummaryTodos, setAcceptedSummaryTodos] = useState([]);
  const [callSession, setCallSession] = useState({
    active: false,
    meetingId: "",
    startedAt: null,
    joinUrl: "",
  });

  const recognitionRef = useRef(null);

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

  const meetingParticipantDirectory = useMemo(
    () =>
      directory.filter((entry) =>
        userMatchesSearch(entry, meetingParticipantSearch)
      ),
    [directory, meetingParticipantSearch]
  );

  const activeMeeting = useMemo(() => {
    if (meetingDetail && meetingDetail.id === activeMeetingId) return meetingDetail;
    return meetings.find((entry) => entry.id === activeMeetingId) || null;
  }, [meetings, meetingDetail, activeMeetingId]);

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

  function stopLiveTranscript() {
    const recognition = recognitionRef.current;
    if (!recognition) return;

    recognition.onresult = null;
    recognition.onerror = null;
    recognition.onend = null;
    recognition.stop();
    recognitionRef.current = null;
    setTranscriptLive(false);
  }

  function startLiveTranscript(options = {}) {
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
  }

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

  async function openMeeting(meetingId) {
    if (!meetingId) return;
    if (callSession.active && callSession.meetingId !== meetingId) {
      setNotice("End the active call before switching to another meeting.");
      return;
    }
    try {
      setLoadingMeetingDetail(true);
      const data = await apiGet(`/meetings/${meetingId}`);
      setMeetingDetail(data);
      setActiveMeetingId(meetingId);
      setNotesTranscript(data?.notes?.transcript || "");
      setNotesSummary(data?.notes?.summary || null);
      setNotesAttachments(
        Array.isArray(data?.notes?.summary?.attachments)
          ? data.notes.summary.attachments
          : []
      );
      setAcceptedSummaryTodos(
        Array.isArray(data?.notes?.summary?.acceptedTodos)
          ? data.notes.summary.acceptedTodos
          : []
      );
    } catch (err) {
      setError(err.message || "Failed to open meeting details.");
    } finally {
      setLoadingMeetingDetail(false);
    }
  }

  async function sendDirectMessage(event) {
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
  }

  async function sendBroadcastMessage() {
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
  }

  async function createMeeting(event) {
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
      setActiveMeetingId(created.id);
      setMeetingDetail(created);
      setNotesTranscript(created?.notes?.transcript || "");
      setNotesSummary(created?.notes?.summary || null);
      setNotesAttachments([]);
      setAcceptedSummaryTodos([]);

      exportMeetingToCalendar(created, `${safeSlug(created.title)}.ics`);
      setNotice("Meeting created. Calendar invite was downloaded.");
    } catch (err) {
      setError(err.message || "Failed to create meeting.");
    } finally {
      setCreatingMeeting(false);
    }
  }

  async function persistMeetingNotesReport(meetingId, transcript, summary, successMessage) {
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
  }

  async function startMeetingCall(meeting) {
    if (!meeting) return;
    if (callSession.active && callSession.meetingId !== meeting.id) {
      setNotice("End the active call before starting another one.");
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
      joinUrl: `${meeting.joinUrl}#config.prejoinPageEnabled=false`,
    });

    setNotesTranscript((prev) => {
      const marker = `[Call started ${formatDateTime(startedAt)}]`;
      return prev ? `${prev}\n\n${marker}\n` : `${marker}\n`;
    });

    const started = startLiveTranscript();
    if (started) {
      setNotice("Call started. Transcript is now tied to this meeting session.");
    } else {
      setNotice(
        "Call started. Live transcript could not auto-start, but you can type notes and still generate report."
      );
    }
  }

  async function endMeetingCall(options = {}) {
    if (!callSession.active || !callSession.meetingId) return;

    const {
      save = true,
      successMessage = "Call ended. Transcript and AI report were saved to this meeting.",
    } = options;

    setEndingCall(true);
    const endedAt = new Date().toISOString();
    stopLiveTranscript();

    const transcript = String(notesTranscript || "").trim();
    const generated = transcript ? generateMeetingSummary(transcript) : null;
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

    const summary = summaryBase
      ? {
          ...summaryBase,
          acceptedTodos: nextAccepted,
          attachments: notesAttachments,
        }
      : notesAttachments.length
      ? {
          summaryText: "",
          keyPoints: [],
          todos: [],
          actionPlan: [],
          acceptedTodos: [],
          attachments: notesAttachments,
          generatedAt: new Date().toISOString(),
        }
      : null;

    if (generated) {
      setNotesSummary(summary);
      setAcceptedSummaryTodos([]);
    }

    try {
      if (save) {
        await persistMeetingNotesReport(
          callSession.meetingId,
          transcript,
          summary,
          successMessage
        );
      }
    } catch (err) {
      setError(err.message || "Failed to save post-call report.");
    } finally {
      setCallSession({
        active: false,
        meetingId: "",
        startedAt: null,
        joinUrl: "",
      });
      setEndingCall(false);
    }
  }

  async function saveMeetingNotes() {
    if (!activeMeetingId) return;
    if (callSession.active && callSession.meetingId === activeMeetingId) {
      setError("End the call first to publish the final meeting report.");
      return;
    }

    try {
      setSavingNotes(true);
      setError("");
      const summaryPayload = notesSummary
        ? {
            ...notesSummary,
            acceptedTodos: acceptedSummaryTodos,
            attachments: notesAttachments,
          }
        : notesAttachments.length
        ? {
            summaryText: "",
            keyPoints: [],
            todos: [],
            actionPlan: [],
            acceptedTodos: [],
            attachments: notesAttachments,
            generatedAt: new Date().toISOString(),
          }
        : null;
      await persistMeetingNotesReport(
        activeMeetingId,
        notesTranscript,
        summaryPayload,
        "Meeting notes saved."
      );
    } catch (err) {
      setError(err.message || "Failed to save meeting notes.");
    } finally {
      setSavingNotes(false);
    }
  }

  async function handleNotesMediaUpload(event) {
    const files = Array.from(event.target.files || []);
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
            id: crypto.randomUUID(),
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
            id: crypto.randomUUID(),
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
      }
      if (nextAttachments.length) {
        setNotesAttachments((prev) => [...prev, ...nextAttachments].slice(0, 16));
      }
      setNotice(
        `Attached ${nextAttachments.length} file(s). Transcript files are ready for AI summary.`
      );
    } catch (err) {
      setError(err.message || "Failed to process uploaded media.");
    } finally {
      event.target.value = "";
    }
  }

  function removeNotesAttachment(attachmentId) {
    setNotesAttachments((prev) =>
      prev.filter((entry) => entry.id !== attachmentId)
    );
  }

  function handleGenerateSummary() {
    if (!String(notesTranscript || "").trim()) {
      setError("No transcript text yet. Start/stop call or type notes first.");
      return;
    }
    const summary = generateMeetingSummary(notesTranscript);
    setNotesSummary({
      ...summary,
      acceptedTodos: [],
      attachments: notesAttachments,
    });
    setAcceptedSummaryTodos([]);
    setNotice("AI summary generated from transcript.");
  }

  async function addSummaryTodosToActionList() {
    if (!activeMeetingId) return;

    const todos = acceptedSummaryTodos.filter(Boolean);
    if (!todos.length) {
      setError("Accept one or more AI todo suggestions before syncing.");
      return;
    }

    const base = parseDate(defaultFollowUpDueFromMeeting(activeMeeting)) || new Date();
    const items = todos.map((todo, index) => ({
      title: todo,
      details: activeMeeting?.title
        ? `Captured from meeting: ${activeMeeting.title}`
        : "Captured from meeting summary",
      meetingId: activeMeetingId,
      dueAt: new Date(base.getTime() + index * 30 * 60 * 1000).toISOString(),
      status: "Todo",
    }));

    try {
      setSavingActionItems(true);
      setError("");
      const created = await apiPost("/action-items/bulk", { items });
      let createdTasksCount = 0;
      if (user.role === "student") {
        const taskPayloads = todos.map((todo, index) => ({
          title: todo,
          description: activeMeeting?.title
            ? `Captured from meeting: ${activeMeeting.title}`
            : "Captured from meeting summary",
          category: "Other",
          priority: "Medium",
          status: "Todo",
          deadline: new Date(base.getTime() + index * 30 * 60 * 1000).toISOString(),
          progress: 0,
          learningSummary: "",
        }));
        const taskResults = await Promise.all(
          taskPayloads.map((payload) => apiPost("/tasks", payload))
        );
        createdTasksCount = taskResults.length;
      }
      if (notesSummary) {
        await persistMeetingNotesReport(
          activeMeetingId,
          notesTranscript,
          {
            ...notesSummary,
            acceptedTodos: todos,
            attachments: notesAttachments,
          },
          ""
        );
      }
      await loadActionItems();
      const actionItemsCount = Array.isArray(created) ? created.length : items.length;
      setNotice(
        user.role === "student"
          ? `${actionItemsCount} item(s) added to Collaboration todos and ${createdTasksCount} synced to your main task board.`
          : `${actionItemsCount} summary todo(s) added to your personal list.`
      );
    } catch (err) {
      setError(err.message || "Failed to add summary todos to your list.");
    } finally {
      setSavingActionItems(false);
    }
  }

  function addSummaryTodosToCalendar() {
    const todos = acceptedSummaryTodos.filter(Boolean);
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
  }

  function planFollowUpMeetingFromSummary() {
    if (!activeMeeting) return;
    const todos = acceptedSummaryTodos.filter(Boolean);
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
    setNotice("Follow-up meeting draft prepared in the Create Meeting form.");
  }

  function toggleAcceptedSummaryTodo(todo) {
    if (!todo) return;
    setAcceptedSummaryTodos((prev) =>
      prev.includes(todo) ? prev.filter((entry) => entry !== todo) : [...prev, todo]
    );
  }

  function acceptAllSummaryTodos() {
    const todos = Array.isArray(notesSummary?.todos) ? notesSummary.todos : [];
    setAcceptedSummaryTodos(todos);
  }

  function clearAcceptedSummaryTodos() {
    setAcceptedSummaryTodos([]);
  }

  async function toggleActionItem(item) {
    if (!item) return;
    const nextStatus = item.status === "Done" ? "Todo" : "Done";
    try {
      await apiPut(`/action-items/${item.id}`, { status: nextStatus });
      await loadActionItems();
    } catch (err) {
      setError(err.message || "Failed to update action item.");
    }
  }

  function exportActionItemsToCalendarFile() {
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
  }

  function toggleParticipant(id) {
    setMeetingForm((prev) => {
      const exists = prev.participantIds.includes(id);
      return {
        ...prev,
        participantIds: exists
          ? prev.participantIds.filter((entry) => entry !== id)
          : [...prev.participantIds, id],
      };
    });
  }

  function toggleBroadcastRecipient(id) {
    setBroadcastRecipients((prev) =>
      prev.includes(id)
        ? prev.filter((entry) => entry !== id)
        : [...prev, id]
    );
  }

  useEffect(() => {
    loadDirectory();
    loadMeetings();
    loadActionItems();
    return () => stopLiveTranscript();
  }, [loadDirectory, loadMeetings, loadActionItems]);

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
    const available = Array.isArray(notesSummary?.todos) ? notesSummary.todos : [];
    setAcceptedSummaryTodos((prev) =>
      prev.filter((entry) => available.includes(entry))
    );
  }, [notesSummary]);

  useEffect(() => {
    if (tab !== "meetings") return undefined;
    const timer = window.setInterval(() => {
      loadActionItems();
    }, 25000);
    return () => window.clearInterval(timer);
  }, [tab, loadActionItems]);

  async function handleCloseHub() {
    if (callSession.active) {
      await endMeetingCall({
        save: true,
        successMessage:
          "Call ended while closing hub. Transcript and report were saved.",
      });
    }
    onClose();
  }

  return (
    <div
      className="modal-overlay"
      onClick={async (event) => {
        if (event.target !== event.currentTarget) return;
        await handleCloseHub();
      }}
    >
      <div className="modal modal-collab">
        <div className="collab-header">
          <div>
            <div className="modal-title">Collaboration Hub</div>
            <div className="collab-header-sub">
              {ROLE_LABELS[user.role] || "User"} | zero-cost calls, chat, transcript,
              AI summary, and calendar-ready meetings.
            </div>
          </div>

          <button
            type="button"
            className="btn btn-ghost btn-sm"
            onClick={handleCloseHub}
          >
            Close
          </button>
        </div>

        <div className="collab-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "chat" ? "active" : ""}`}
            onClick={() => setTab("chat")}
          >
            Chat & Broadcast
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "meetings" ? "active" : ""}`}
            onClick={() => setTab("meetings")}
          >
            Meetings & Notes
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "feed" ? "active" : ""}`}
            onClick={() => setTab("feed")}
          >
            Community Feed
          </button>
        </div>

        {notice && (
          <div className="notif-bar">
            <div className="notif notif-graded" onClick={() => setNotice("")}>
              {notice}
            </div>
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}

        {tab === "chat" && (
          <div className="collab-grid">
            <aside className="collab-sidebar">
              <div className="panel-subtitle">People in your scope</div>
              <div className="field">
                <label>Search People</label>
                <input
                  value={peopleSearch}
                  onChange={(event) => setPeopleSearch(event.target.value)}
                  placeholder="Search by name, role, school..."
                />
              </div>
              <div className="collab-user-list">
                {directoryLoading && <div className="empty-col">Loading users...</div>}
                {!directoryLoading && !chatDirectory.length && (
                  <div className="empty-col">No users match your search.</div>
                )}
                {!directoryLoading &&
                  chatDirectory.map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      className={`collab-user-btn ${
                        selectedChatUserId === entry.id ? "active" : ""
                      }`}
                      onClick={() => setSelectedChatUserId(entry.id)}
                    >
                      <span>{entry.name}</span>
                      <small>
                        {(ROLE_LABELS[entry.role] || entry.role) +
                          (entry.schoolName ? ` | ${entry.schoolName}` : "")}
                      </small>
                    </button>
                  ))}
              </div>

              <div className="panel-subtitle">Broadcast Message</div>
              <div className="field">
                <label>Search Broadcast Recipients</label>
                <input
                  value={broadcastSearch}
                  onChange={(event) => setBroadcastSearch(event.target.value)}
                  placeholder="Filter recipients..."
                />
              </div>
              <div className="collab-checklist">
                {!broadcastDirectory.length && (
                  <div className="empty-col">No recipients match your search.</div>
                )}
                {broadcastDirectory.map((entry) => (
                  <label key={entry.id} className="check-item">
                    <input
                      type="checkbox"
                      checked={broadcastRecipients.includes(entry.id)}
                      onChange={() => toggleBroadcastRecipient(entry.id)}
                    />
                    {entry.name}
                  </label>
                ))}
              </div>
              <textarea
                value={broadcastText}
                onChange={(event) => setBroadcastText(event.target.value)}
                placeholder="Type broadcast update..."
              />
              <button
                type="button"
                className="btn btn-purple btn-full"
                disabled={sendingBroadcast || !broadcastRecipients.length}
                onClick={sendBroadcastMessage}
              >
                {sendingBroadcast
                  ? "Sending..."
                  : `Broadcast to ${broadcastRecipients.length || 0}`}
              </button>
            </aside>

            <section className="collab-main">
              <div className="collab-main-head">
                <div className="panel-subtitle">
                  {selectedChatUser
                    ? `Direct chat with ${selectedChatUser.name}`
                    : "Select a user to start chatting"}
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => loadChatThread(selectedChatUserId)}
                >
                  Refresh
                </button>
              </div>

              <div className="collab-thread">
                {chatLoading && <div className="empty-col">Loading messages...</div>}
                {!chatLoading && !chatMessages.length && (
                  <div className="empty-col">No messages yet.</div>
                )}
                {!chatLoading &&
                  chatMessages.map((message) => {
                    const mine = message.senderId === user.id;
                    const senderLabel = mine ? "You" : message.senderName || "User";
                    return (
                      <div
                        key={message.id}
                        className={`chat-bubble ${mine ? "mine" : "theirs"}`}
                      >
                        <div className="chat-bubble-head">
                          <strong>{senderLabel}</strong>
                          <small>{formatDateTime(message.createdAt)}</small>
                          {message.isBroadcast && (
                            <span className="chat-bubble-tag">Broadcast</span>
                          )}
                        </div>
                        <div className="chat-bubble-body">{message.body}</div>
                      </div>
                    );
                  })}
              </div>

              <form className="collab-compose" onSubmit={sendDirectMessage}>
                <input
                  value={chatText}
                  onChange={(event) => setChatText(event.target.value)}
                  placeholder="Type a message..."
                  disabled={!selectedChatUserId}
                />
                <button
                  type="submit"
                  className="btn btn-primary"
                  disabled={sendingChat || !selectedChatUserId}
                >
                  {sendingChat ? "Sending..." : "Send"}
                </button>
              </form>
            </section>
          </div>
        )}

        {tab === "feed" && <CommunityFeedPanel user={user} />}

        {tab === "meetings" && (
          <div className="collab-grid">
            <aside className="collab-sidebar">
              <form onSubmit={createMeeting}>
                <div className="panel-subtitle">Create Meeting</div>
                <div className="field">
                  <label>Title *</label>
                  <input
                    value={meetingForm.title}
                    onChange={(event) =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        title: event.target.value,
                      }))
                    }
                    placeholder="e.g. SS2 Chemistry Review"
                  />
                </div>
                <div className="field">
                  <label>Description</label>
                  <textarea
                    value={meetingForm.description}
                    onChange={(event) =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        description: event.target.value,
                      }))
                    }
                    placeholder="Agenda and expected outcomes..."
                  />
                </div>
                <div className="field">
                  <label>Scheduled Time *</label>
                  <input
                    type="datetime-local"
                    value={meetingForm.scheduledFor}
                    onChange={(event) =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        scheduledFor: event.target.value,
                      }))
                    }
                  />
                </div>
                <div className="field">
                  <label>Duration (minutes)</label>
                  <input
                    type="number"
                    min="15"
                    max="480"
                    value={meetingForm.durationMinutes}
                    onChange={(event) =>
                      setMeetingForm((prev) => ({
                        ...prev,
                        durationMinutes: Number(event.target.value) || 45,
                      }))
                    }
                  />
                </div>

                <div className="panel-subtitle">
                  Participants ({meetingForm.participantIds.length})
                </div>
                <div className="field">
                  <label>Search Participants</label>
                  <input
                    value={meetingParticipantSearch}
                    onChange={(event) =>
                      setMeetingParticipantSearch(event.target.value)
                    }
                    placeholder="Filter participants..."
                  />
                </div>
                <div className="collab-checklist">
                  {!meetingParticipantDirectory.length && (
                    <div className="empty-col">No participants match your search.</div>
                  )}
                  {meetingParticipantDirectory.map((entry) => (
                    <label key={entry.id} className="check-item">
                      <input
                        type="checkbox"
                        checked={meetingForm.participantIds.includes(entry.id)}
                        onChange={() => toggleParticipant(entry.id)}
                      />
                      {entry.name}
                    </label>
                  ))}
                </div>

                <button
                  type="submit"
                  className="btn btn-primary btn-full"
                  disabled={creatingMeeting}
                >
                  {creatingMeeting ? "Creating..." : "Create Meeting"}
                </button>
              </form>

              <div className="panel-subtitle">Meeting Calendar (Past + Upcoming)</div>
              <div className="view-tabs">
                <button
                  type="button"
                  className={`view-tab ${meetingListFilter === "all" ? "active" : ""}`}
                  onClick={() => setMeetingListFilter("all")}
                >
                  All
                </button>
                <button
                  type="button"
                  className={`view-tab ${meetingListFilter === "upcoming" ? "active" : ""}`}
                  onClick={() => setMeetingListFilter("upcoming")}
                >
                  Upcoming
                </button>
                <button
                  type="button"
                  className={`view-tab ${meetingListFilter === "past" ? "active" : ""}`}
                  onClick={() => setMeetingListFilter("past")}
                >
                  Past
                </button>
              </div>
              <div className="collab-user-list">
                {!visibleMeetings.length && <div className="empty-col">No meetings yet.</div>}
                {visibleMeetings.map((meeting) => (
                  <button
                    key={meeting.id}
                    type="button"
                    className={`collab-user-btn ${
                      activeMeetingId === meeting.id ? "active" : ""
                    }`}
                    onClick={() => openMeeting(meeting.id)}
                  >
                    <span>{meeting.title}</span>
                    <small>
                      {formatDateTime(meeting.scheduledFor)} |{" "}
                      {(meeting.participants || []).length} participant(s) |{" "}
                      {meeting?.notes?.summary || meeting?.notes?.transcript
                        ? "Report ready"
                        : "No report yet"}
                    </small>
                  </button>
                ))}
              </div>
            </aside>

            <section className="collab-main">
              {loadingMeetingDetail && <div className="empty-col">Loading meeting...</div>}

              {!loadingMeetingDetail && !activeMeeting && (
                <div className="empty-col">
                  Select a meeting to start call, transcript, and AI summary flow.
                </div>
              )}

              {!loadingMeetingDetail && activeMeeting && (
                <>
                  <div className="collab-main-head">
                    <div>
                      <div className="panel-title">{activeMeeting.title}</div>
                      <div className="calendar-meta">
                        {formatDateTime(activeMeeting.scheduledFor)} |{" "}
                        {activeMeeting.durationMinutes} min | Host:{" "}
                        {activeMeeting.hostName || "Unknown"}
                      </div>
                    </div>
                    <div className="panel-actions">
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        onClick={() =>
                          isCallOnActiveMeeting
                            ? endMeetingCall()
                            : startMeetingCall(activeMeeting)
                        }
                        disabled={endingCall}
                      >
                        {isCallOnActiveMeeting
                          ? endingCall
                            ? "Ending..."
                            : "End Call & Publish Report"
                          : "Start In-App Call"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() =>
                          exportMeetingToCalendar(
                            activeMeeting,
                            `${safeSlug(activeMeeting.title)}.ics`
                          )
                        }
                      >
                        Calendar (.ics)
                      </button>
                      {isCallOnActiveMeeting && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => {
                            const opened = window.open(
                              activeMeeting.joinUrl,
                              "_blank",
                              "noopener,noreferrer"
                            );
                            if (!opened) {
                              setNotice("Popup blocked. Allow popups to open full call window.");
                            }
                          }}
                        >
                          Open Full Call
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="review-card-meta">
                    <span>
                      Report: {hasMeetingReport ? "Available in this meeting" : "Not generated yet"}
                    </span>
                    {callSession.active && callSession.meetingId === activeMeeting.id && (
                      <span>
                        | Call started at {formatDateTime(callSession.startedAt)}
                      </span>
                    )}
                  </div>

                  <div className="panel-subtitle">
                    Participants ({(activeMeeting.participants || []).length})
                  </div>
                  <div className="review-card-meta">
                    {(activeMeeting.participants || []).map((entry) => (
                      <span key={entry.id}>
                        {entry.name} ({ROLE_LABELS[entry.role] || entry.role})
                      </span>
                    ))}
                  </div>

                  {isCallOnActiveMeeting && (
                    <div className="collab-call-wrap">
                      <div className="panel-subtitle">Live Call Session</div>
                      <iframe
                        title={`StudyFlow Call ${activeMeeting.title}`}
                        src={callSession.joinUrl}
                        className="collab-call-frame"
                        allow="camera; microphone; fullscreen; display-capture; autoplay"
                      />
                    </div>
                  )}

                  <div className="modal-section">
                    <div className="panel-actions">
                      <button
                        type="button"
                        className="btn btn-purple btn-sm"
                        onClick={transcriptLive ? stopLiveTranscript : startLiveTranscript}
                        disabled={
                          isCallOnActiveMeeting &&
                          callSession.meetingId === activeMeeting.id &&
                          endingCall
                        }
                      >
                        {transcriptLive ? "Stop Live Transcript" : "Start Live Transcript"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={handleGenerateSummary}
                      >
                        Generate AI Summary
                      </button>
                      <button
                        type="button"
                        className="btn btn-primary btn-sm"
                        disabled={savingNotes || isCallOnActiveMeeting}
                        onClick={saveMeetingNotes}
                      >
                        {savingNotes ? "Saving..." : "Save Notes"}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={savingActionItems || !acceptedSummaryTodos.length}
                        onClick={addSummaryTodosToActionList}
                      >
                        {savingActionItems
                          ? "Syncing..."
                          : `Sync Accepted to My Todo (${acceptedSummaryTodos.length})`}
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!acceptedSummaryTodos.length}
                        onClick={addSummaryTodosToCalendar}
                      >
                        Add Accepted to Calendar
                      </button>
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        disabled={!acceptedSummaryTodos.length}
                        onClick={planFollowUpMeetingFromSummary}
                      >
                        Draft Follow-up from Accepted
                      </button>
                    </div>

                    <div className="panel-hint">
                      {isCallOnActiveMeeting
                        ? "Transcript and report are bound to this active call. End call to publish final report."
                        : "Open any past meeting from the calendar list to view saved transcript, AI summary, and todos."}
                      {` Accepted AI todos: ${acceptedSummaryTodos.length}.`}
                    </div>

                    <div className="field">
                      <label>Upload Transcript / Media Files</label>
                      <input
                        type="file"
                        accept=".txt,.md,.srt,.vtt,.json,image/*,audio/*,video/*"
                        multiple
                        onChange={handleNotesMediaUpload}
                      />
                      <div className="panel-hint">
                        Upload transcript files as an alternative to live transcription.
                        You can also attach meeting media for reference.
                      </div>
                      {!!notesAttachments.length && (
                        <div className="collab-media-grid">
                          {notesAttachments.map((entry) => (
                            <div key={entry.id} className="collab-media-item">
                              {entry.kind === "image" && entry.url && (
                                <img src={entry.url} alt={entry.name || "attachment"} />
                              )}
                              {entry.kind === "video" && entry.url && (
                                <video src={entry.url} controls preload="metadata" />
                              )}
                              {entry.kind === "audio" && entry.url && (
                                <audio src={entry.url} controls />
                              )}
                              {entry.kind === "transcript" && (
                                <div className="collab-media-text">
                                  <strong>{entry.name}</strong>
                                  <p>{String(entry.content || "").slice(0, 240) || "Transcript file attached."}</p>
                                </div>
                              )}
                              <button
                                type="button"
                                className="btn btn-danger btn-sm"
                                onClick={() => removeNotesAttachment(entry.id)}
                              >
                                Remove
                              </button>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="field">
                      <label>Live Transcript</label>
                      <textarea
                        value={notesTranscript}
                        onChange={(event) => setNotesTranscript(event.target.value)}
                        placeholder="Transcript appears here. You can also paste notes manually."
                        style={{ minHeight: "160px" }}
                      />
                    </div>

                    <div className="field">
                      <label>AI Summary</label>
                      <div className="collab-summary-box">
                        {!notesSummary && (
                          <div className="empty-col">
                            Generate summary to extract key points, todos, and action plan.
                          </div>
                        )}

                        {notesSummary && (
                          <>
                            <div className="summary-section">
                              <strong>Summary</strong>
                              <p>{notesSummary.summaryText || "No summary text yet."}</p>
                            </div>
                            <div className="summary-section">
                              <strong>Key Points</strong>
                              <ul>
                                {(notesSummary.keyPoints || []).map((entry) => (
                                  <li key={entry}>{entry}</li>
                                ))}
                              </ul>
                            </div>
                            <div className="summary-section">
                              <div className="summary-todo-head">
                                <strong>
                                  AI Todo Suggestions ({(notesSummary.todos || []).length})
                                </strong>
                                <div className="panel-actions">
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={acceptAllSummaryTodos}
                                  >
                                    Accept All
                                  </button>
                                  <button
                                    type="button"
                                    className="btn btn-ghost btn-sm"
                                    onClick={clearAcceptedSummaryTodos}
                                  >
                                    Clear
                                  </button>
                                </div>
                              </div>
                              <div className="collab-suggest-list">
                                {(notesSummary.todos || []).map((entry) => (
                                  <label key={entry} className="collab-suggest-item">
                                    <input
                                      type="checkbox"
                                      checked={acceptedSummaryTodos.includes(entry)}
                                      onChange={() => toggleAcceptedSummaryTodo(entry)}
                                    />
                                    <span>{entry}</span>
                                  </label>
                                ))}
                              </div>
                              <div className="panel-hint">
                                {acceptedSummaryTodos.length} accepted suggestion(s).
                              </div>
                            </div>
                            <div className="summary-section">
                              <strong>Action Plan</strong>
                              <ul>
                                {(notesSummary.actionPlan || []).map((entry, idx) => (
                                  <li key={`${entry.owner}-${idx}`}>
                                    {entry.owner}: {entry.action} (Due: {entry.due})
                                  </li>
                                ))}
                              </ul>
                            </div>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="modal-section">
                      <div className="collab-main-head">
                        <div className="panel-subtitle">
                          My Todo List ({actionItems.length})
                        </div>
                        <div className="panel-actions">
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={loadActionItems}
                          >
                            Refresh
                          </button>
                          <button
                            type="button"
                            className="btn btn-ghost btn-sm"
                            onClick={exportActionItemsToCalendarFile}
                          >
                            Export Todos to Calendar
                          </button>
                        </div>
                      </div>

                      <div className="collab-action-list">
                        {loadingActionItems && (
                          <div className="empty-col">Loading action items...</div>
                        )}
                        {!loadingActionItems && !actionItems.length && (
                          <div className="empty-col">
                            No todo items yet. Accept AI suggestions and click "Sync Accepted to
                            My Todo".
                          </div>
                        )}
                        {!loadingActionItems &&
                          actionItems.map((item) => (
                            <label
                              key={item.id}
                              className={`collab-action-item ${
                                item.status === "Done" ? "done" : ""
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={item.status === "Done"}
                                onChange={() => toggleActionItem(item)}
                              />
                              <div className="collab-action-item-body">
                                <div className="collab-action-item-title">{item.title}</div>
                                <div className="calendar-meta">
                                  {item.meetingTitle
                                    ? `Meeting: ${item.meetingTitle}`
                                    : "Personal item"}{" "}
                                  | Due:{" "}
                                  {item.dueAt ? formatDateTime(item.dueAt) : "Not set"}
                                </div>
                              </div>
                            </label>
                          ))}
                      </div>
                    </div>
                  </div>
                </>
              )}
            </section>
          </div>
        )}
      </div>
    </div>
  );
}
