import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useState,
} from "react";
import { apiGet, apiPost, apiPut } from "../lib/api";
import { formatDateTime } from "../lib/helpers";
import { ROLE_LABELS } from "../lib/constants";

const REACTIONS = ["like", "love", "insightful", "support"];
const PRIVACY_OPTIONS = [
  {
    id: "everyone",
    label: "Everyone",
    hint: "Visible to everyone on StudyFlow.",
  },
  {
    id: "everyone_except",
    label: "Everyone except...",
    hint: "Hide this post from selected people.",
  },
  {
    id: "only_share_with",
    label: "Only share with...",
    hint: "Only selected people can see this post.",
  },
];

function getInitials(name) {
  return String(name || "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((entry) => entry[0]?.toUpperCase() || "")
    .join("") || "SF";
}

function audienceMeta(entry) {
  const role = ROLE_LABELS[entry.role] || entry.role || "User";
  const location = entry.schoolName || entry.stateName || entry.email || "";
  return `${role}${location ? ` | ${location}` : ""}`;
}

function matchesPost(post, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    post.title,
    post.body,
    post.authorName,
    post.authorRole,
    post.authorSchoolName,
    post.authorStateName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(text);
}

function matchesAudience(entry, query) {
  const text = String(query || "").trim().toLowerCase();
  if (!text) return true;

  const haystack = [
    entry.name,
    entry.email,
    entry.role,
    entry.schoolName,
    entry.stateName,
    entry.lgaName,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return haystack.includes(text);
}

function privacyLabel(mode, count = 0) {
  if (mode === "everyone_except") {
    return count ? `Everyone except ${count}` : "Everyone except";
  }
  if (mode === "only_share_with") {
    return count ? `Only ${count} selected` : "Only selected";
  }
  return "Everyone";
}

function deriveTitle(title, body) {
  const explicit = String(title || "").trim();
  if (explicit) return explicit.slice(0, 240);

  const summary = String(body || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  return summary || "Community update";
}

function sortNewest(items = []) {
  return [...items].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );
}

export default function CommunityFeedPanel({ user }) {
  const [posts, setPosts] = useState([]);
  const [audienceUsers, setAudienceUsers] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [activePostId, setActivePostId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [audienceLoading, setAudienceLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [lastSyncedAt, setLastSyncedAt] = useState("");

  const [feedView, setFeedView] = useState("all");
  const [timelineSearch, setTimelineSearch] = useState("");
  const [composerAudienceSearch, setComposerAudienceSearch] = useState("");
  const [editorAudienceSearch, setEditorAudienceSearch] = useState("");

  const [postForm, setPostForm] = useState({
    title: "",
    body: "",
    visibilityMode: "everyone",
    visibilitySelectedUserIds: [],
  });
  const [privacyDrafts, setPrivacyDrafts] = useState({});
  const [commentDrafts, setCommentDrafts] = useState({});

  const deferredTimelineSearch = useDeferredValue(timelineSearch);
  const deferredComposerAudienceSearch = useDeferredValue(composerAudienceSearch);
  const deferredEditorAudienceSearch = useDeferredValue(editorAudienceSearch);

  const activePost = useMemo(
    () => posts.find((entry) => entry.id === activePostId) || null,
    [posts, activePostId]
  );

  const activePrivacyDraft = useMemo(() => {
    if (!activePost || activePost.authorUserId !== user.id) return null;
    return privacyDrafts[activePost.id] || null;
  }, [activePost, privacyDrafts, user.id]);

  const filteredPosts = useMemo(() => {
    const visible = posts.filter((post) => {
      if (feedView === "mine" && post.authorUserId !== user.id) return false;
      return matchesPost(post, deferredTimelineSearch);
    });
    return sortNewest(visible);
  }, [posts, feedView, deferredTimelineSearch, user.id]);

  const composerSelectedAudience = useMemo(
    () =>
      audienceUsers.filter((entry) =>
        postForm.visibilitySelectedUserIds.includes(entry.id)
      ),
    [audienceUsers, postForm.visibilitySelectedUserIds]
  );

  const composerAudienceOptions = useMemo(
    () =>
      audienceUsers
        .filter((entry) => matchesAudience(entry, deferredComposerAudienceSearch))
        .slice(0, 80),
    [audienceUsers, deferredComposerAudienceSearch]
  );

  const editorSelectedAudience = useMemo(() => {
    if (!activePrivacyDraft) return [];
    return audienceUsers.filter((entry) =>
      activePrivacyDraft.visibilitySelectedUserIds.includes(entry.id)
    );
  }, [activePrivacyDraft, audienceUsers]);

  const editorAudienceOptions = useMemo(() => {
    if (!activePrivacyDraft) return [];
    return audienceUsers
      .filter((entry) => matchesAudience(entry, deferredEditorAudienceSearch))
      .slice(0, 80);
  }, [activePrivacyDraft, audienceUsers, deferredEditorAudienceSearch]);

  const canCreatePost = true;

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/feed/posts");
      const rows = Array.isArray(data) ? data : [];
      setPosts(sortNewest(rows));
      setLastSyncedAt(new Date().toISOString());
      setActivePostId((prev) => {
        if (!rows.length) return "";
        if (prev && rows.some((entry) => entry.id === prev)) return prev;
        return rows[0].id;
      });
    } catch (err) {
      setError(err.message || "Failed to load community feed.");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadAudienceUsers = useCallback(async () => {
    try {
      setAudienceLoading(true);
      const data = await apiGet("/feed/audience/users");
      setAudienceUsers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load audience directory.");
    } finally {
      setAudienceLoading(false);
    }
  }, []);

  const loadComments = useCallback(async (postId) => {
    if (!postId) return;
    try {
      const data = await apiGet(`/feed/posts/${postId}/comments`);
      setCommentsByPost((prev) => ({
        ...prev,
        [postId]: Array.isArray(data) ? data : [],
      }));
    } catch (err) {
      setError(err.message || "Failed to load comments.");
    }
  }, []);

  useEffect(() => {
    loadPosts();
    loadAudienceUsers();
  }, [loadPosts, loadAudienceUsers, user.id]);

  useEffect(() => {
    if (activePostId) loadComments(activePostId);
  }, [activePostId, loadComments]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      loadPosts();
      if (activePostId) loadComments(activePostId);
    }, 10000);
    return () => window.clearInterval(timer);
  }, [activePostId, loadComments, loadPosts]);

  useEffect(() => {
    if (!filteredPosts.length) {
      setActivePostId("");
      return;
    }
    if (!activePostId || !filteredPosts.some((entry) => entry.id === activePostId)) {
      setActivePostId(filteredPosts[0].id);
    }
  }, [activePostId, filteredPosts]);

  function toggleComposerAudience(userId) {
    setPostForm((prev) => ({
      ...prev,
      visibilitySelectedUserIds: prev.visibilitySelectedUserIds.includes(userId)
        ? prev.visibilitySelectedUserIds.filter((entry) => entry !== userId)
        : [...prev.visibilitySelectedUserIds, userId],
    }));
  }

  function startPrivacyEdit(post) {
    setPrivacyDrafts((prev) => ({
      ...prev,
      [post.id]: {
        visibilityMode: post.visibilityMode || "everyone",
        visibilitySelectedUserIds: post.visibilitySelectedUserIds || [],
      },
    }));
  }

  function cancelPrivacyEdit(postId) {
    setPrivacyDrafts((prev) => {
      const next = { ...prev };
      delete next[postId];
      return next;
    });
    setEditorAudienceSearch("");
  }

  function updatePrivacyDraft(postId, patch) {
    setPrivacyDrafts((prev) => ({
      ...prev,
      [postId]: {
        visibilityMode: prev[postId]?.visibilityMode || "everyone",
        visibilitySelectedUserIds: prev[postId]?.visibilitySelectedUserIds || [],
        ...patch,
      },
    }));
  }

  function togglePrivacyDraftAudience(postId, userId) {
    const current = privacyDrafts[postId] || {
      visibilityMode: "everyone",
      visibilitySelectedUserIds: [],
    };
    updatePrivacyDraft(postId, {
      visibilitySelectedUserIds: current.visibilitySelectedUserIds.includes(userId)
        ? current.visibilitySelectedUserIds.filter((entry) => entry !== userId)
        : [...current.visibilitySelectedUserIds, userId],
    });
  }

  async function createPost() {
    const title = deriveTitle(postForm.title, postForm.body);
    const body = String(postForm.body || "").trim();
    if (!body) {
      setError("Post message is required.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      await apiPost("/feed/posts", {
        title,
        body,
        visibilityMode: postForm.visibilityMode,
        visibilitySelectedUserIds: postForm.visibilitySelectedUserIds,
      });
      setPostForm({
        title: "",
        body: "",
        visibilityMode: "everyone",
        visibilitySelectedUserIds: [],
      });
      setComposerAudienceSearch("");
      setNotice("Post published to the live timeline.");
      await loadPosts();
    } catch (err) {
      setError(err.message || "Failed to publish post.");
    } finally {
      setBusy(false);
    }
  }

  async function savePostPrivacy(postId) {
    const draft = privacyDrafts[postId];
    if (!draft) return;

    try {
      setBusy(true);
      setError("");
      const updated = await apiPut(`/feed/posts/${postId}/privacy`, {
        visibilityMode: draft.visibilityMode,
        visibilitySelectedUserIds: draft.visibilitySelectedUserIds,
      });
      setPosts((prev) =>
        sortNewest(prev.map((entry) => (entry.id === postId ? updated : entry)))
      );
      cancelPrivacyEdit(postId);
      setNotice("Post privacy updated.");
    } catch (err) {
      setError(err.message || "Failed to update post privacy.");
    } finally {
      setBusy(false);
    }
  }

  async function reactToPost(postId, reaction) {
    try {
      setBusy(true);
      setError("");
      await apiPost(`/feed/posts/${postId}/reactions`, { reaction });
      await loadPosts();
    } catch (err) {
      setError(err.message || "Failed to react to post.");
    } finally {
      setBusy(false);
    }
  }

  async function sendComment(postId) {
    const body = String(commentDrafts[postId] || "").trim();
    if (!body) return;

    try {
      setBusy(true);
      setError("");
      await apiPost(`/feed/posts/${postId}/comments`, { body });
      setCommentDrafts((prev) => ({ ...prev, [postId]: "" }));
      await loadPosts();
      await loadComments(postId);
    } catch (err) {
      setError(err.message || "Failed to send comment.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) return <div className="empty-col">Loading community timeline...</div>;

  return (
    <div className="feed-shell">
      <section className="feed-main">
        <div className="feed-hero">
          <div>
            <div className="panel-title">Community Timeline</div>
            <div className="feed-hero-copy">
              Live campus-wide conversation feed. By default, everyone can see posts unless the
              author changes privacy.
            </div>
          </div>
          <div className="feed-live-badge">
            <span className="feed-live-dot" />
            Live
            {lastSyncedAt ? ` | synced ${formatDateTime(lastSyncedAt)}` : ""}
          </div>
        </div>

        {notice && (
          <div className="notif notif-graded" onClick={() => setNotice("")}>
            {notice}
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}

        <div className="feed-toolbar">
          <div className="search-wrap feed-search">
            <input
              value={timelineSearch}
              onChange={(event) => setTimelineSearch(event.target.value)}
              placeholder="Search timeline by author, title, message..."
            />
          </div>
          <div className="view-tabs">
            <button
              type="button"
              className={`view-tab ${feedView === "all" ? "active" : ""}`}
              onClick={() => setFeedView("all")}
            >
              All Posts
            </button>
            <button
              type="button"
              className={`view-tab ${feedView === "mine" ? "active" : ""}`}
              onClick={() => setFeedView("mine")}
            >
              My Posts
            </button>
          </div>
          <button type="button" className="btn btn-ghost btn-sm" onClick={loadPosts}>
            Refresh
          </button>
        </div>

        <div className="feed-post-list">
          {!filteredPosts.length && <div className="empty-col">No posts match this view.</div>}
          {filteredPosts.map((post) => {
            const isActive = activePostId === post.id;
            const isAuthor = post.authorUserId === user.id;

            return (
              <article
                key={post.id}
                className={`feed-post-card ${isActive ? "active" : ""}`}
                onClick={() => setActivePostId(post.id)}
              >
                <div className="feed-post-head">
                  <div className="feed-author">
                    <div className="feed-avatar">
                      {post.authorAvatarUrl ? (
                        <img src={post.authorAvatarUrl} alt={post.authorName || "User"} />
                      ) : (
                        <span>{getInitials(post.authorName)}</span>
                      )}
                    </div>
                    <div className="feed-author-copy">
                      <div className="feed-author-topline">
                        <strong>{post.authorName || "StudyFlow User"}</strong>
                        <span className="feed-role-pill">
                          {ROLE_LABELS[post.authorRole] || post.authorRole || "User"}
                        </span>
                        <span className="feed-privacy-pill">
                          {privacyLabel(
                            post.visibilityMode,
                            post.visibilitySelectedUserIds?.length || 0
                          )}
                        </span>
                      </div>
                      <div className="calendar-meta">
                        {post.authorSchoolName || post.authorStateName || "StudyFlow"} |{" "}
                        {formatDateTime(post.createdAt)}
                      </div>
                    </div>
                  </div>
                  {isAuthor && (
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={(event) => {
                        event.stopPropagation();
                        startPrivacyEdit(post);
                        setActivePostId(post.id);
                      }}
                    >
                      Edit Privacy
                    </button>
                  )}
                </div>

                <div className="feed-post-title">{post.title}</div>
                <div className="feed-post-body">{post.body}</div>

                <div className="feed-post-stats">
                  <span>{post.reactionsCount || 0} reactions</span>
                  <span>{post.commentsCount || 0} comments</span>
                  <span>{isActive ? "Discussion open" : "Open discussion"}</span>
                </div>

                <div className="feed-reaction-row">
                  {REACTIONS.map((entry) => (
                    <button
                      key={entry}
                      type="button"
                      className={`feed-reaction-btn ${
                        post.myReaction === entry ? "active" : ""
                      }`}
                      disabled={busy}
                      onClick={(event) => {
                        event.stopPropagation();
                        reactToPost(post.id, entry);
                      }}
                    >
                      {entry}
                      {post.reactionSummary?.[entry]
                        ? ` (${post.reactionSummary[entry]})`
                        : ""}
                    </button>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <aside className="feed-side">
        {canCreatePost && (
          <section className="feed-compose-card">
            <div className="panel-subtitle">Create Post</div>
            <div className="field">
              <label>Headline (optional)</label>
              <input
                value={postForm.title}
                onChange={(event) =>
                  setPostForm((prev) => ({ ...prev, title: event.target.value }))
                }
                placeholder="If blank, StudyFlow derives one from your message"
              />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea
                value={postForm.body}
                onChange={(event) =>
                  setPostForm((prev) => ({ ...prev, body: event.target.value }))
                }
                placeholder="Share an update, ask a question, or start a discussion..."
              />
            </div>

            <div className="field">
              <label>Status Privacy</label>
              <select
                value={postForm.visibilityMode}
                onChange={(event) =>
                  setPostForm((prev) => ({
                    ...prev,
                    visibilityMode: event.target.value,
                  }))
                }
              >
                {PRIVACY_OPTIONS.map((entry) => (
                  <option key={entry.id} value={entry.id}>
                    {entry.label}
                  </option>
                ))}
              </select>
              <div className="panel-hint">
                {
                  PRIVACY_OPTIONS.find(
                    (entry) => entry.id === postForm.visibilityMode
                  )?.hint
                }
              </div>
            </div>

            {postForm.visibilityMode !== "everyone" && (
              <div className="feed-privacy-editor">
                <div className="field">
                  <label>Select People</label>
                  <input
                    value={composerAudienceSearch}
                    onChange={(event) => setComposerAudienceSearch(event.target.value)}
                    placeholder="Search by name, role, school, state..."
                  />
                </div>
                <div className="feed-audience-list">
                  {audienceLoading && <div className="empty-col">Loading people...</div>}
                  {!audienceLoading &&
                    composerAudienceOptions.map((entry) => (
                      <label key={entry.id} className="feed-audience-item">
                        <input
                          type="checkbox"
                          checked={postForm.visibilitySelectedUserIds.includes(entry.id)}
                          onChange={() => toggleComposerAudience(entry.id)}
                        />
                        <span>
                          <strong>{entry.name}</strong>
                          <small>{audienceMeta(entry)}</small>
                        </span>
                      </label>
                    ))}
                </div>
                {!!composerSelectedAudience.length && (
                  <div className="collab-chip-row">
                    {composerSelectedAudience.map((entry) => (
                      <button
                        key={entry.id}
                        type="button"
                        className="collab-chip"
                        onClick={() => toggleComposerAudience(entry.id)}
                      >
                        {entry.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}

            <button className="btn btn-primary btn-full" disabled={busy} onClick={createPost}>
              Publish to Timeline
            </button>
          </section>
        )}

        <section className="feed-thread-card">
          {!activePost && <div className="empty-col">Select a post to open the thread.</div>}

          {activePost && (
            <>
              <div className="feed-thread-head">
                <div>
                  <div className="panel-title">{activePost.title}</div>
                  <div className="calendar-meta">
                    {activePost.authorName || "User"} |{" "}
                    {ROLE_LABELS[activePost.authorRole] || activePost.authorRole || "User"} |{" "}
                    {formatDateTime(activePost.createdAt)}
                  </div>
                </div>
                <div className="feed-privacy-pill">
                  {privacyLabel(
                    activePost.visibilityMode,
                    activePost.visibilitySelectedUserIds?.length || 0
                  )}
                </div>
              </div>

              <div className="review-summary-box">{activePost.body}</div>

              {activePrivacyDraft && (
                <div className="feed-privacy-editor">
                  <div className="panel-subtitle">Edit Privacy</div>
                  <div className="field">
                    <label>Status Privacy</label>
                    <select
                      value={activePrivacyDraft.visibilityMode}
                      onChange={(event) =>
                        updatePrivacyDraft(activePost.id, {
                          visibilityMode: event.target.value,
                        })
                      }
                    >
                      {PRIVACY_OPTIONS.map((entry) => (
                        <option key={entry.id} value={entry.id}>
                          {entry.label}
                        </option>
                      ))}
                    </select>
                  </div>

                  {activePrivacyDraft.visibilityMode !== "everyone" && (
                    <>
                      <div className="field">
                        <label>Select People</label>
                        <input
                          value={editorAudienceSearch}
                          onChange={(event) => setEditorAudienceSearch(event.target.value)}
                          placeholder="Search people..."
                        />
                      </div>
                      <div className="feed-audience-list">
                        {editorAudienceOptions.map((entry) => (
                          <label key={entry.id} className="feed-audience-item">
                            <input
                              type="checkbox"
                              checked={activePrivacyDraft.visibilitySelectedUserIds.includes(
                                entry.id
                              )}
                              onChange={() =>
                                togglePrivacyDraftAudience(activePost.id, entry.id)
                              }
                            />
                            <span>
                              <strong>{entry.name}</strong>
                              <small>{audienceMeta(entry)}</small>
                            </span>
                          </label>
                        ))}
                      </div>
                      {!!editorSelectedAudience.length && (
                        <div className="collab-chip-row">
                          {editorSelectedAudience.map((entry) => (
                            <button
                              key={entry.id}
                              type="button"
                              className="collab-chip"
                              onClick={() =>
                                togglePrivacyDraftAudience(activePost.id, entry.id)
                              }
                            >
                              {entry.name}
                            </button>
                          ))}
                        </div>
                      )}
                    </>
                  )}

                  <div className="panel-actions">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => savePostPrivacy(activePost.id)}
                    >
                      Save Privacy
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-sm"
                      onClick={() => cancelPrivacyEdit(activePost.id)}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}

              <div className="panel-subtitle">Comments ({activePost.commentsCount || 0})</div>
              <div className="feed-comment-list">
                {(commentsByPost[activePost.id] || []).map((comment) => (
                  <div key={comment.id} className="feed-comment-card">
                    <div className="feed-comment-meta">
                      <strong>{comment.authorName || "User"}</strong>
                      <span>{ROLE_LABELS[comment.authorRole] || comment.authorRole || "User"}</span>
                      <span>{formatDateTime(comment.createdAt)}</span>
                    </div>
                    <div className="feed-comment-body">{comment.body}</div>
                  </div>
                ))}
                {!commentsByPost[activePost.id]?.length && (
                  <div className="empty-col">No comments yet. Start the discussion.</div>
                )}
              </div>

              <div className="feed-comment-compose">
                <input
                  placeholder="Write a comment..."
                  value={commentDrafts[activePost.id] || ""}
                  onChange={(event) =>
                    setCommentDrafts((prev) => ({
                      ...prev,
                      [activePost.id]: event.target.value,
                    }))
                  }
                />
                <button
                  className="btn btn-primary btn-sm"
                  disabled={busy}
                  onClick={() => sendComment(activePost.id)}
                >
                  Send
                </button>
              </div>
            </>
          )}
        </section>
      </aside>
    </div>
  );
}
