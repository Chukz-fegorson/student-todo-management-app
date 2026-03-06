import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { formatDateTime } from "../lib/helpers";

const REACTIONS = ["like", "love", "insightful", "support"];

export default function CommunityFeedPanel({ user }) {
  const [posts, setPosts] = useState([]);
  const [commentsByPost, setCommentsByPost] = useState({});
  const [activePostId, setActivePostId] = useState("");
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [postForm, setPostForm] = useState({
    title: "",
    body: "",
    scopeType: user.role === "federal" ? "federal" : user.role === "state" ? "state" : "school",
    scopeStateName: "",
    scopeSchoolId: "",
  });

  const [commentDrafts, setCommentDrafts] = useState({});

  const canCreatePost =
    user.role === "student" ||
    user.role === "school" ||
    user.role === "state" ||
    user.role === "federal";
  const activePost = useMemo(
    () => posts.find((entry) => entry.id === activePostId) || null,
    [posts, activePostId]
  );

  const loadPosts = useCallback(async () => {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/feed/posts");
      const rows = Array.isArray(data) ? data : [];
      setPosts(rows);
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

  const loadComments = useCallback(async (postId) => {
    if (!postId) return;
    try {
      const data = await apiGet(`/feed/posts/${postId}/comments`);
      setCommentsByPost((prev) => ({ ...prev, [postId]: Array.isArray(data) ? data : [] }));
    } catch (err) {
      setError(err.message || "Failed to load comments.");
    }
  }, []);

  useEffect(() => {
    loadPosts();
  }, [user.id, loadPosts]);

  useEffect(() => {
    if (activePostId) loadComments(activePostId);
  }, [activePostId, loadComments]);

  async function createPost() {
    if (!postForm.title.trim() || !postForm.body.trim()) {
      setError("Post title and body are required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await apiPost("/feed/posts", {
        title: postForm.title.trim(),
        body: postForm.body.trim(),
        scopeType: postForm.scopeType,
        scopeStateName: postForm.scopeStateName.trim() || null,
        scopeSchoolId: postForm.scopeSchoolId.trim() || null,
      });
      setPostForm((prev) => ({ ...prev, title: "", body: "" }));
      setNotice("Post published.");
      await loadPosts();
    } catch (err) {
      setError(err.message || "Failed to publish post.");
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

  if (loading) return <div className="empty-col">Loading community feed...</div>;

  return (
    <div className="collab-grid">
      <aside className="collab-sidebar">
        <div className="panel-subtitle">Conversation Channels</div>
        <div className="collab-user-list">
          {posts.map((post) => (
            <button
              key={post.id}
              type="button"
              className={`collab-user-btn ${activePostId === post.id ? "active" : ""}`}
              onClick={() => setActivePostId(post.id)}
            >
              <span>{post.title}</span>
              <small>
                {post.scopeType} | {post.authorName || "Author"} | {formatDateTime(post.createdAt)}
              </small>
            </button>
          ))}
          {!posts.length && <div className="empty-col">No conversations yet.</div>}
        </div>
      </aside>

      <section className="panel">
        {notice && (
          <div className="notif notif-graded" onClick={() => setNotice("")}>
            {notice}
          </div>
        )}
        {error && <div className="error-msg">{error}</div>}

        {canCreatePost && (
          <div className="panel" style={{ marginBottom: "0.8rem" }}>
            <div className="panel-subtitle">Start New Conversation</div>
            <div className="field">
              <label>Title</label>
              <input
                value={postForm.title}
                onChange={(event) => setPostForm((prev) => ({ ...prev, title: event.target.value }))}
              />
            </div>
            <div className="field">
              <label>Message</label>
              <textarea
                value={postForm.body}
                onChange={(event) => setPostForm((prev) => ({ ...prev, body: event.target.value }))}
              />
            </div>
            {user.role === "student" ? (
              <div className="panel-hint">
                Student posts are published to your school community channel.
              </div>
            ) : (
              <div style={{ display: "grid", gap: "0.6rem", gridTemplateColumns: "1fr 1fr 1fr" }}>
                <div className="field">
                  <label>Scope Type</label>
                  <select
                    value={postForm.scopeType}
                    onChange={(event) =>
                      setPostForm((prev) => ({ ...prev, scopeType: event.target.value }))
                    }
                  >
                    {user.role === "federal" && <option value="federal">Federal</option>}
                    {(user.role === "federal" || user.role === "state") && (
                      <option value="state">State</option>
                    )}
                    <option value="school">School</option>
                  </select>
                </div>
                <div className="field">
                  <label>Scope State (if needed)</label>
                  <input
                    value={postForm.scopeStateName}
                    onChange={(event) =>
                      setPostForm((prev) => ({ ...prev, scopeStateName: event.target.value }))
                    }
                  />
                </div>
                <div className="field">
                  <label>Scope School ID (if needed)</label>
                  <input
                    value={postForm.scopeSchoolId}
                    onChange={(event) =>
                      setPostForm((prev) => ({ ...prev, scopeSchoolId: event.target.value }))
                    }
                  />
                </div>
              </div>
            )}
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={createPost}>
              Publish
            </button>
          </div>
        )}

        {!activePost && <div className="empty-col">Select a conversation to view comments.</div>}

        {activePost && (
          <div>
            <div className="panel-subtitle">{activePost.title}</div>
            <div className="calendar-meta" style={{ marginBottom: "0.6rem" }}>
              {activePost.scopeType} | {activePost.authorName || "Author"} |{" "}
              {formatDateTime(activePost.createdAt)}
            </div>
            <div className="review-summary-box">{activePost.body}</div>

            <div className="panel-actions" style={{ marginTop: "0.6rem" }}>
              {REACTIONS.map((entry) => (
                <button
                  key={entry}
                  className={`btn btn-ghost btn-sm ${
                    activePost.myReaction === entry ? "btn-purple" : ""
                  }`}
                  disabled={busy}
                  onClick={() => reactToPost(activePost.id, entry)}
                >
                  {entry} {activePost.reactionSummary?.[entry] ? `(${activePost.reactionSummary[entry]})` : ""}
                </button>
              ))}
            </div>

            <div style={{ marginTop: "0.8rem" }} className="panel-subtitle">
              Comments ({activePost.commentsCount || 0})
            </div>
            <div className="collab-action-list">
              {(commentsByPost[activePost.id] || []).map((comment) => (
                <div key={comment.id} className="review-card" style={{ marginBottom: "0.5rem" }}>
                  <div className="review-card-meta">
                    <span>{comment.authorName || "User"}</span>
                    <span>|</span>
                    <span>{comment.authorRole || "user"}</span>
                    <span>|</span>
                    <span>{formatDateTime(comment.createdAt)}</span>
                  </div>
                  <div>{comment.body}</div>
                </div>
              ))}
              {!commentsByPost[activePost.id]?.length && (
                <div className="empty-col">No comments yet. Start the discussion.</div>
              )}
            </div>

            <div style={{ display: "flex", gap: "0.5rem", marginTop: "0.7rem" }}>
              <input
                style={{ flex: 1 }}
                placeholder="Write a comment..."
                value={commentDrafts[activePost.id] || ""}
                onChange={(event) =>
                  setCommentDrafts((prev) => ({
                    ...prev,
                    [activePost.id]: event.target.value,
                  }))
                }
              />
              <button className="btn btn-primary btn-sm" disabled={busy} onClick={() => sendComment(activePost.id)}>
                Send
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
