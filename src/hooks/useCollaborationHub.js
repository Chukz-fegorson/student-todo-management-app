import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { apiGet, apiPost, apiPut } from "../lib/api";
import { exportMeetingToCalendar, exportTasksToCalendar } from "../lib/calendar";
import { formatDateTime, parseDate, toDateTimeLocalValue } from "../lib/helpers";
import { generateMeetingSummary } from "../lib/meetingAi";
import {
  buildActionClientKey,
  defaultFollowUpDueFromMeeting,
  defaultMeetingForm,
  isTranscriptLikeFile,
  mediaKindFromMime,
  normalizeTodoSignature,
  safeSlug,
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
  const [savingNotes, setSavingNotes] = useState(false);
  const [transcriptLive, setTranscriptLive] = useState(false);
  const [meetingListFilter, setMeetingListFilter] = useState("all");
  const [actionItems, setActionItems] = useState([]);
  const [loadingActionItems, setLoadingActionItems] = useState(false);
  const [savingActionItems, setSavingActionItems] = useState(false);
  const [endingCall, setEndingCall] = useState(false);
  const [acceptedSummaryTodos, setAcceptedSummaryTodos] = useState([]);
  const [callSession, setCallSession] = useState(createCallSession);

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

  const openMeeting = useCallback(
    async (meetingId) => {
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
    },
    [callSession.active, callSession.meetingId]
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

  const startMeetingCall = useCallback(
    async (meeting) => {
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
    },
    [callSession.active, callSession.meetingId, startLiveTranscript]
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
        setCallSession(createCallSession());
        setEndingCall(false);
      }
    },
    [
      acceptedSummaryTodos,
      callSession,
      notesAttachments,
      notesSummary,
      notesTranscript,
      persistMeetingNotesReport,
      stopLiveTranscript,
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
  }, [
    acceptedSummaryTodos,
    activeMeetingId,
    callSession.active,
    callSession.meetingId,
    notesAttachments,
    notesSummary,
    notesTranscript,
    persistMeetingNotesReport,
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
      input.value = "";
    }
  }, []);

  const removeNotesAttachment = useCallback((attachmentId) => {
    setNotesAttachments((prev) => prev.filter((entry) => entry.id !== attachmentId));
  }, []);

  const handleGenerateSummary = useCallback(() => {
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
  }, [notesAttachments, notesTranscript]);

  const addSummaryTodosToActionList = useCallback(async () => {
    if (!activeMeetingId) return;

    const todos = uniqueAcceptedTodos(acceptedSummaryTodos);
    if (!todos.length) {
      setError("Accept one or more AI todo suggestions before syncing.");
      return;
    }

    const base = parseDate(defaultFollowUpDueFromMeeting(activeMeeting)) || new Date();
    const existingSignatures = new Set(
      actionItems
        .filter((item) => item.meetingId === activeMeetingId)
        .map((item) => normalizeTodoSignature(item.title))
        .filter(Boolean)
    );

    const items = todos
      .map((todo, index) => {
        const dueAt = new Date(base.getTime() + index * 30 * 60 * 1000).toISOString();
        return {
          title: todo,
          details: activeMeeting?.title
            ? `Captured from meeting: ${activeMeeting.title}`
            : "Captured from meeting summary",
          meetingId: activeMeetingId,
          dueAt,
          status: "Todo",
          clientKey: buildActionClientKey({
            meetingId: activeMeetingId,
            todoTitle: todo,
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
          description: activeMeeting?.title
            ? `Captured from meeting: ${activeMeeting.title}`
            : "Captured from meeting summary",
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
      const skippedCount = Math.max(0, todos.length - items.length);
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
    acceptedSummaryTodos,
    actionItems,
    activeMeeting,
    activeMeetingId,
    loadActionItems,
    notesAttachments,
    notesSummary,
    notesTranscript,
    persistMeetingNotesReport,
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
    setAcceptedSummaryTodos((prev) =>
      prev.includes(todo) ? prev.filter((entry) => entry !== todo) : [...prev, todo]
    );
  }, []);

  const acceptAllSummaryTodos = useCallback(() => {
    const todos = Array.isArray(notesSummary?.todos) ? notesSummary.todos : [];
    setAcceptedSummaryTodos(todos);
  }, [notesSummary]);

  const clearAcceptedSummaryTodos = useCallback(() => {
    setAcceptedSummaryTodos([]);
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
    setAcceptedSummaryTodos((prev) => prev.filter((entry) => available.includes(entry)));
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
    acceptedSummaryTodos,
    acceptAllSummaryTodos,
    actionItems,
    activeMeeting,
    activeMeetingId,
    addSummaryTodosToActionList,
    addSummaryTodosToCalendar,
    broadcastDirectory,
    broadcastRecipients,
    broadcastSearch,
    broadcastText,
    callSession,
    chatDirectory,
    chatLoading,
    chatMessages,
    chatText,
    clearAcceptedSummaryTodos,
    collabHighlights,
    createMeeting,
    creatingMeeting,
    directoryLoading,
    endingCall,
    endMeetingCall,
    error,
    exportActionItemsToCalendarFile,
    handleCloseHub,
    handleGenerateSummary,
    handleNotesMediaUpload,
    hasMeetingReport,
    isCallOnActiveMeeting,
    loadActionItems,
    loadChatThread,
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
    removeNotesAttachment,
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
    setNotesTranscript,
    setPeopleSearch,
    setSelectedChatUserId,
    setShowCreateMeetingForm,
    setTab,
    showCreateMeetingForm,
    startLiveTranscript,
    startMeetingCall,
    stopLiveTranscript,
    tab,
    toggleAcceptedSummaryTodo,
    toggleActionItem,
    toggleBroadcastRecipient,
    toggleParticipant,
    transcriptLive,
    visibleMeetings,
  };
}
