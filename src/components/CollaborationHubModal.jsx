import { exportMeetingToCalendar } from "../lib/calendar";
import { formatDateTime } from "../lib/helpers";
import { ROLE_LABELS } from "../lib/constants";
import { safeSlug } from "../lib/collaboration";
import { useCollaborationHub } from "../hooks/useCollaborationHub";
import CommunityFeedPanel from "./CommunityFeedPanel";

function describeConfiguredSummaryEngine(status, loading) {
  if (loading) {
    return "StudyFlow is checking whether the backend AI summary provider is ready.";
  }

  if (status.externalProvider.available) {
    const model = status.externalProvider.model || status.externalProvider.mode;
    return `External AI is ready through ${model}. ${
      status.capabilities?.transcription
        ? `Audio transcription is also available through ${
            status.transcriptionProvider?.model || "the configured model"
          }. `
        : ""
    }StudyFlow will still fall back to the local summarizer if that provider fails.`;
  }

  if (status.externalProvider.readiness === "missing_credentials") {
    return "External AI is not fully configured on the backend, so StudyFlow is currently using the local transcript summarizer.";
  }

  if (status.externalProvider.readiness === "unsupported_mode") {
    return `AI mode "${status.externalProvider.mode}" is not supported yet, so StudyFlow is using the local transcript summarizer.`;
  }

  return "External AI is disabled right now, so StudyFlow is using the local transcript summarizer.";
}

function describeLatestSummarySource(summary) {
  const provider = summary?.provider;
  if (!provider) return "";

  if (provider.source === "external") {
    return provider.model
      ? `Latest summary came from ${provider.model}.`
      : "Latest summary came from the external provider.";
  }

  return provider.fallbackReason
    ? `Latest summary used the local fallback because ${provider.fallbackReason}.`
    : "Latest summary used the local deterministic summarizer.";
}

export default function CollaborationHubModal({
  user,
  onClose,
  embedded = false,
  navRoute,
}) {
  const {
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
    summaryTaskSuggestions,
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
  } = useCollaborationHub({ user, onClose, navRoute });

  const configuredSummaryEngine = describeConfiguredSummaryEngine(
    aiSummaryStatus,
    loadingAiSummaryStatus
  );
  const latestSummarySource = describeLatestSummarySource(notesSummary);
  const aiStatusLabel = loadingAiSummaryStatus
    ? "Checking AI"
    : aiSummaryStatus.effectiveProvider.source === "external"
      ? "External Ready"
      : "Local Fallback";
  const latestSummaryLabel = notesSummary?.provider
    ? notesSummary.provider.source === "external"
      ? "Latest: External"
      : "Latest: Local"
    : "";

  return (
    <div
      className={embedded ? "collab-embed-shell" : "modal-overlay"}
      onClick={
        embedded
          ? undefined
          : async (event) => {
              if (event.target !== event.currentTarget) return;
              await handleCloseHub();
            }
      }
    >
      <div className={embedded ? "panel panel-elevated collab-panel" : "modal modal-collab"}>
        <div className="collab-header">
          <div>
            <div className="modal-title">Collaboration Hub</div>
            <div className="collab-header-sub">
              {ROLE_LABELS[user.role] || "User"} | zero-cost calls, chat, transcript,
              AI summary, and calendar-ready meetings.
            </div>
          </div>

          {!embedded && (
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={handleCloseHub}
            >
              Close
            </button>
          )}
        </div>

        <section className="module-hero module-hero-compact collab-module-hero">
          <div className="module-hero-copy">
            <div className="module-kicker">Collaboration</div>
            <div className="module-title-row">
              <h2>
                {tab === "chat"
                  ? "Chat and Broadcast"
                  : tab === "meetings"
                    ? "Meetings, Transcript, and AI Notes"
                    : "Community Feed"}
              </h2>
              <span className="module-pill">
                {tab === "chat"
                  ? `${chatDirectory.length} people`
                  : tab === "meetings"
                    ? `${visibleMeetings.length} meetings`
                    : "Live timeline"}
              </span>
            </div>
            <p>
              {tab === "chat"
                ? "Hold direct conversations, send broadcasts, and keep message context visible like a real communication workspace."
                : tab === "meetings"
                  ? "Create meetings, run calls, capture transcripts, generate AI summaries, and sync accepted actions back into work."
                  : "See community conversation in one stream and participate without leaving the collaboration module."}
            </p>
            <div className="module-highlight-row">
              {(collabHighlights[tab] || []).map((entry) => (
                <span key={entry} className="module-highlight-pill">
                  {entry}
                </span>
              ))}
            </div>
          </div>
        </section>

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
              <div className="collab-broadcast-card">
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
                {!!selectedBroadcastUsers.length && (
                  <div className="collab-chip-row">
                    {selectedBroadcastUsers.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="collab-chip"
                        onClick={() => toggleBroadcastRecipient(entry.id)}
                        title="Remove recipient"
                      >
                        {entry.name}
                      </button>
                    ))}
                  </div>
                )}
                <textarea
                  value={broadcastText}
                  onChange={(event) => setBroadcastText(event.target.value)}
                  placeholder="Type broadcast update..."
                />
              </div>
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
                <div>
                  <div className="panel-subtitle">
                    {selectedChatUser
                      ? `Direct chat with ${selectedChatUser.name}`
                      : "Select a user to start chatting"}
                  </div>
                  <div className="collab-chat-hint">
                    Sender, date, and time are shown above each message.
                  </div>
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
                    const recipientLabel = message.recipientName || "User";
                    return (
                      <div
                        key={message.id}
                        className={`chat-bubble ${mine ? "mine" : "theirs"}`}
                      >
                        <div className="chat-bubble-head">
                          <strong>{senderLabel}</strong>
                          {message.isBroadcast && (
                            <span className="chat-bubble-tag">Broadcast</span>
                          )}
                        </div>
                        <div className="chat-bubble-meta">
                          <small>{formatDateTime(message.createdAt)}</small>
                          {message.isBroadcast && (
                            <small>
                              {mine ? `To: ${recipientLabel}` : `Sent by: ${senderLabel}`}
                            </small>
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
              <div className="panel-actions">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setShowCreateMeetingForm((prev) => !prev)}
                >
                  {showCreateMeetingForm ? "Hide Create Meeting" : "Create Meeting"}
                </button>
              </div>

              {showCreateMeetingForm && (
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
              )}

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
                        onClick={() => runCallPreflight(activeMeeting, { announce: true })}
                      >
                        Run Preflight
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
                          onClick={() => rejoinMeetingCall({ mode: "embed" })}
                        >
                          Rejoin Embedded Call
                        </button>
                      )}
                      {isCallOnActiveMeeting && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => rejoinMeetingCall({ mode: "window" })}
                        >
                          Open Rejoin Window
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

                  <div className="collab-health-strip">
                    <span className={`summary-provider-pill ${callReliability.preflightTone}`}>
                      Call Ready: {callReliability.preflightLabel}
                    </span>
                    <span className={`summary-provider-pill ${callReliability.networkTone}`}>
                      Network: {callReliability.networkLabel}
                    </span>
                    <span className={`summary-provider-pill ${callPreflight.microphone.tone}`}>
                      Mic: {callPreflight.microphone.label}
                    </span>
                    <span className={`summary-provider-pill ${callPreflight.camera.tone}`}>
                      Camera: {callPreflight.camera.label}
                    </span>
                    <span className={`summary-provider-pill ${callReliability.transcriptTone}`}>
                      Transcript: {callReliability.transcriptLabel}
                    </span>
                    <span className={`summary-provider-pill ${callReliability.syncTone}`}>
                      Server Sync: {callReliability.syncLabel}
                    </span>
                    <span className={`summary-provider-pill ${callReliability.protectionTone}`}>
                      Draft Guard: {callReliability.protectionLabel}
                    </span>
                    <span className={`summary-provider-pill ${callReliability.frameTone}`}>
                      Call Frame: {callReliability.frameLabel}
                    </span>
                  </div>
                  <div className="collab-health-note">
                    {callReliability.guidance}
                    {!!callReliability.preflightNote && ` ${callReliability.preflightNote}`}
                    {!!callReliability.lastCaptureLabel && ` ${callReliability.lastCaptureLabel}`}
                    {!!callReliability.syncNote && ` ${callReliability.syncNote}`}
                    {!!callReliability.frameNote && ` ${callReliability.frameNote}`}
                    {!!callReliability.mediaWarning && ` ${callReliability.mediaWarning}`}
                  </div>
                  {!!callPreflight.blockers.length && (
                    <div className="collab-health-note collab-health-note-alert">
                      {callPreflight.blockers.join(" ")}
                    </div>
                  )}
                  {!!callSession.active && !transcriptSupported && (
                    <div className="collab-health-note collab-health-note-alert">
                      This browser cannot run live transcript, so typed notes and uploaded transcript files are the safer path for this call.
                    </div>
                  )}
                  {!!callReliability.protectionLabel.startsWith("Recovered") &&
                    !callSession.active && (
                      <div className="panel-actions">
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={discardRecoveredDraft}
                        >
                          Discard Recovered Draft
                        </button>
                      </div>
                    )}

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
                        key={callFrameState.key}
                        title={`StudyFlow Call ${activeMeeting.title}`}
                        src={callSession.joinUrl}
                        className="collab-call-frame"
                        allow="camera; microphone; fullscreen; display-capture; autoplay"
                        onLoad={handleCallFrameLoad}
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
                        className="btn btn-ghost btn-sm"
                        onClick={handleTranscribeMeetingMedia}
                        disabled={transcribingMeetingMedia}
                      >
                        {transcribingMeetingMedia ? "Transcribing..." : "Transcribe Audio / Video"}
                      </button>
                      {!!activeMeetingTranscriptJob?.id && (
                        <button
                          type="button"
                          className="btn btn-ghost btn-sm"
                          onClick={() => refreshMeetingTranscriptJob(activeMeetingTranscriptJob.id)}
                        >
                          Refresh Transcript Job
                        </button>
                      )}
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
                    {!!activeMeetingTranscriptJob?.id && (
                      <div className="collab-transcript-job">
                        <span
                          className={`summary-provider-pill ${
                            activeMeetingTranscriptJob.status === "completed"
                              ? "ready"
                              : activeMeetingTranscriptJob.status === "failed"
                                ? "danger"
                                : "fallback"
                          }`}
                        >
                          Transcript Job:{" "}
                          {activeMeetingTranscriptJob.status === "queued"
                            ? "Queued"
                            : activeMeetingTranscriptJob.status === "processing"
                              ? "Processing"
                              : activeMeetingTranscriptJob.status === "completed"
                                ? activeMeetingTranscriptJob.applied
                                  ? "Applied"
                                  : "Ready"
                                : "Failed"}
                        </span>
                        {!!activeMeetingTranscriptJob.attachmentName && (
                          <span className="summary-provider-pill fallback">
                            File: {activeMeetingTranscriptJob.attachmentName}
                          </span>
                        )}
                        <p className="collab-health-note">
                          {activeMeetingTranscriptJob.status === "completed"
                            ? activeMeetingTranscriptJob.applied
                              ? "AI transcript was added to the meeting notes and the summary suggestions were refreshed."
                              : "AI transcript is ready and will be applied to this meeting."
                            : activeMeetingTranscriptJob.status === "failed"
                              ? activeMeetingTranscriptJob.error ||
                                "AI transcription failed. You can retry from this meeting."
                              : "StudyFlow is polling the backend transcript job and will refresh the summary suggestions automatically when it finishes."}
                        </p>
                      </div>
                    )}

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
                        onChange={(event) => updateNotesTranscript(event.target.value)}
                        placeholder="Transcript appears here. You can also paste notes manually."
                        style={{ minHeight: "160px" }}
                      />
                    </div>

                    <div className="field">
                      <label>AI Summary</label>
                      <div className="collab-summary-box">
                        <div className="collab-summary-status">
                          <div className="collab-summary-status-copy">
                            <strong>Summary Engine</strong>
                            <p>{configuredSummaryEngine}</p>
                            {!!latestSummarySource && (
                              <p className="collab-summary-meta">{latestSummarySource}</p>
                            )}
                            {!!notesSummary?.generatedAt && (
                              <p className="collab-summary-meta">
                                Generated {formatDateTime(notesSummary.generatedAt)}
                              </p>
                            )}
                            {!!aiSummaryStatus.error && !loadingAiSummaryStatus && (
                              <p className="collab-summary-warning">
                                Status check note: {aiSummaryStatus.error}
                              </p>
                            )}
                          </div>
                          <div className="collab-summary-status-actions">
                            <span
                              className={`summary-provider-pill ${
                                aiSummaryStatus.effectiveProvider.source === "external"
                                  ? "ready"
                                  : "fallback"
                              }`}
                            >
                              {aiStatusLabel}
                            </span>
                            {!!latestSummaryLabel && (
                              <span
                                className={`summary-provider-pill ${
                                  notesSummary?.provider?.source === "external"
                                    ? "ready"
                                    : "fallback"
                                }`}
                              >
                                {latestSummaryLabel}
                              </span>
                            )}
                            <button
                              type="button"
                              className="btn btn-ghost btn-sm"
                              onClick={refreshAiSummaryStatus}
                              disabled={loadingAiSummaryStatus}
                            >
                              {loadingAiSummaryStatus ? "Checking..." : "Refresh AI Status"}
                            </button>
                          </div>
                        </div>

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
                                  AI Task Suggestions ({summaryTaskSuggestions.length})
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
                                {summaryTaskSuggestions.map((entry) => (
                                  <div key={entry.title} className="collab-suggest-card">
                                    <label className="collab-suggest-item">
                                      <input
                                        type="checkbox"
                                        checked={acceptedSummaryTodos.includes(entry.title)}
                                        onChange={() => toggleAcceptedSummaryTodo(entry.title)}
                                      />
                                      <span>{entry.title}</span>
                                    </label>
                                    <div className="collab-suggest-meta">
                                      <span>
                                        Review:{" "}
                                        {entry.reviewStatus === "accepted"
                                          ? "Accepted"
                                          : entry.reviewStatus === "rejected"
                                            ? "Rejected"
                                            : "Pending"}
                                      </span>
                                      <span>Owner: {entry.owner}</span>
                                      <span>Due cue: {entry.dueLabel}</span>
                                      <span>Urgency: {entry.urgency}</span>
                                      {entry.confidence !== null && (
                                        <span>Confidence: {entry.confidence}</span>
                                      )}
                                      {!!entry.syncedAt && (
                                        <span>
                                          Synced: {entry.syncedTarget || "task flow"}
                                        </span>
                                      )}
                                    </div>
                                    <div className="panel-actions">
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => toggleAcceptedSummaryTodo(entry.title)}
                                      >
                                        {acceptedSummaryTodos.includes(entry.title)
                                          ? "Mark Pending"
                                          : "Accept"}
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => rejectSummaryTodo(entry.title)}
                                      >
                                        Reject
                                      </button>
                                      <button
                                        type="button"
                                        className="btn btn-ghost btn-sm"
                                        onClick={() => resetSummaryTodoReview(entry.title)}
                                      >
                                        Reset
                                      </button>
                                    </div>
                                    <div className="field">
                                      <label>Task Description</label>
                                      <textarea
                                        value={
                                          summaryTaskEdits[entry.title]?.description || ""
                                        }
                                        onChange={(event) =>
                                          updateSummaryTaskDescription(
                                            entry.title,
                                            event.target.value
                                          )
                                        }
                                        placeholder="Refine the suggested task description before syncing."
                                      />
                                    </div>
                                    <div className="field">
                                      <label>Task Deadline</label>
                                      <input
                                        type="datetime-local"
                                        value={
                                          summaryTaskEdits[entry.title]?.deadlineLocalValue || ""
                                        }
                                        onChange={(event) =>
                                          updateSummaryTaskDeadline(
                                            entry.title,
                                            event.target.value
                                          )
                                        }
                                      />
                                    </div>
                                  </div>
                                ))}
                              </div>
                              <div className="panel-hint">
                                {acceptedSummaryTodos.length} accepted suggestion(s). Accepted, rejected, and edited task reviews now stay with this meeting when you reopen it later.
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
