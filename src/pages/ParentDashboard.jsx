import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { effectiveProgress, formatDateTime } from "../lib/helpers";
import { PARENT_RELATIONSHIP_OPTIONS } from "../lib/constants";

export default function ParentDashboard({ user }) {
  const [children, setChildren] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [reviews, setReviews] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [selectedChildId, setSelectedChildId] = useState("");
  const [linkForm, setLinkForm] = useState({
    studentEmail: "",
    linkCode: "",
    relationshipLabel: "",
  });
  const [reviewDraft, setReviewDraft] = useState({
    rating: 5,
    reviewText: "",
  });

  const selectedChild = useMemo(
    () => children.find((child) => child.id === selectedChildId) || null,
    [children, selectedChildId]
  );

  async function loadChildren() {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/parent/children");
      const list = Array.isArray(data) ? data : [];
      setChildren(list);
      setSelectedChildId((prev) => prev || list[0]?.id || "");
    } catch (err) {
      setError(err.message || "Failed to load linked children.");
    } finally {
      setLoading(false);
    }
  }

  async function loadChildDetails(childId) {
    if (!childId) {
      setTasks([]);
      setReviews([]);
      return;
    }
    try {
      setError("");
      const [taskData, reviewData] = await Promise.all([
        apiGet(`/tasks?studentId=${childId}`),
        apiGet(`/students/${childId}/parent-reviews`),
      ]);
      setTasks(Array.isArray(taskData) ? taskData : []);
      setReviews(Array.isArray(reviewData) ? reviewData : []);
    } catch (err) {
      setError(err.message || "Failed to load child details.");
    }
  }

  useEffect(() => {
    loadChildren();
  }, [user.id]);

  useEffect(() => {
    loadChildDetails(selectedChildId);
  }, [selectedChildId]);

  const stats = useMemo(() => {
    const total = tasks.length;
    const submitted = tasks.filter((task) => task.status === "Submitted").length;
    const graded = tasks.filter((task) => task.status === "Graded").length;
    const avgEffective = total
      ? Math.round(tasks.reduce((sum, task) => sum + effectiveProgress(task), 0) / total)
      : 0;
    return { total, submitted, graded, avgEffective };
  }, [tasks]);

  async function linkChild() {
    if (!linkForm.studentEmail.trim() || !linkForm.linkCode.trim()) {
      setError("Student email and link code are required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await apiPost("/parent/children/link", {
        studentEmail: linkForm.studentEmail.trim().toLowerCase(),
        linkCode: linkForm.linkCode.trim().toUpperCase(),
        relationshipLabel: linkForm.relationshipLabel.trim() || null,
      });
      setNotice("Child linked successfully.");
      setLinkForm({ studentEmail: "", linkCode: "", relationshipLabel: "" });
      await loadChildren();
    } catch (err) {
      setError(err.message || "Failed to link child.");
    } finally {
      setBusy(false);
    }
  }

  async function submitParentReview() {
    if (!selectedChildId) return;
    if (!reviewDraft.reviewText.trim()) {
      setError("Parent review text is required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await apiPost(`/students/${selectedChildId}/parent-reviews`, {
        rating: Number(reviewDraft.rating) || 5,
        reviewText: reviewDraft.reviewText.trim(),
      });
      setNotice("Parent review saved.");
      setReviewDraft({ rating: 5, reviewText: "" });
      await loadChildDetails(selectedChildId);
    } catch (err) {
      setError(err.message || "Failed to submit parent review.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="main">
        <div className="empty">
          <div className="empty-icon">...</div>
          <h3>Loading parent workspace</h3>
          <p>Please wait.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      {notice && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={() => setNotice("")}>
            {notice}
          </div>
        </div>
      )}
      {error && <div className="error-msg">{error}</div>}

      <div className="review-banner">
        <strong>Parent Dashboard</strong> | Link under-18 student accounts, follow progress,
        and add parent review notes.
      </div>

      <div className="dashboard-grid">
        <section className="panel">
          <div className="panel-title">Link Child Account</div>
          <div className="field">
            <label>Student Email</label>
            <input
              value={linkForm.studentEmail}
              onChange={(event) =>
                setLinkForm((prev) => ({ ...prev, studentEmail: event.target.value }))
              }
              placeholder="student@email.com"
            />
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field">
              <label>Student Link Code</label>
              <input
                value={linkForm.linkCode}
                onChange={(event) =>
                  setLinkForm((prev) => ({ ...prev, linkCode: event.target.value }))
                }
                placeholder="8-character code"
              />
            </div>
            <div className="field">
              <label>Relationship</label>
              <select
                value={linkForm.relationshipLabel}
                onChange={(event) =>
                  setLinkForm((prev) => ({
                    ...prev,
                    relationshipLabel: event.target.value,
                  }))
                }
              >
                <option value="">Select relationship</option>
                {PARENT_RELATIONSHIP_OPTIONS.map((entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={linkChild}>
            Link Child
          </button>

          <div className="panel-subtitle" style={{ marginTop: "1rem" }}>
            Linked Children ({children.length})
          </div>
          <div className="student-picker">
            {children.map((child) => (
              <button
                key={child.id}
                type="button"
                className={`student-pick-row ${
                  selectedChildId === child.id ? "student-pick-row-active" : ""
                }`}
                onClick={() => setSelectedChildId(child.id)}
              >
                <span>
                  <strong>{child.name}</strong>
                  <span className="student-row-meta">
                    {" "}
                    | {child.schoolName || "No school"} | {child.grade || "No grade"} |{" "}
                    {child.relationshipLabel || "Linked"}
                  </span>
                </span>
              </button>
            ))}
            {!children.length && <div className="empty-col">No children linked yet.</div>}
          </div>
        </section>

        <section className="panel">
          <div className="panel-title">
            {selectedChild ? `${selectedChild.name} Overview` : "Child Overview"}
          </div>
          {!selectedChild ? (
            <div className="empty-col">Select a linked child to view details.</div>
          ) : (
            <>
              <div className="stats-bar stats-bar-student">
                <div className="stat-card">
                  <div className="stat-label">Tasks</div>
                  <div className="stat-value">{stats.total}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Submitted</div>
                  <div className="stat-value stat-purple">{stats.submitted}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Graded</div>
                  <div className="stat-value stat-green">{stats.graded}</div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">Effective Progress</div>
                  <div className="stat-value stat-blue">{stats.avgEffective}%</div>
                </div>
              </div>

              <div className="calendar-list" style={{ marginTop: "0.8rem" }}>
                {tasks.slice(0, 12).map((task) => (
                  <div key={task.id} className="calendar-item">
                    <div>
                      <div className="calendar-title">{task.title}</div>
                      <div className="calendar-meta">
                        {task.status} | {task.category}
                      </div>
                    </div>
                    <div className="calendar-date">
                      {task.deadline ? formatDateTime(task.deadline) : "No deadline"}
                    </div>
                  </div>
                ))}
                {!tasks.length && <div className="empty-col">No tasks found for this child.</div>}
              </div>

              <div className="panel-subtitle" style={{ marginTop: "1rem" }}>
                Parent Review
              </div>
              <div className="field">
                <label>Rating</label>
                <select
                  value={reviewDraft.rating}
                  onChange={(event) =>
                    setReviewDraft((prev) => ({
                      ...prev,
                      rating: Number(event.target.value) || 5,
                    }))
                  }
                >
                  {[5, 4, 3, 2, 1].map((rating) => (
                    <option key={rating} value={rating}>
                      {rating} star{rating > 1 ? "s" : ""}
                    </option>
                  ))}
                </select>
              </div>
              <div className="field">
                <label>Review Note</label>
                <textarea
                  value={reviewDraft.reviewText}
                  onChange={(event) =>
                    setReviewDraft((prev) => ({ ...prev, reviewText: event.target.value }))
                  }
                  placeholder="Share your feedback about learning progress and support needs."
                />
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy}
                onClick={submitParentReview}
              >
                Save Parent Review
              </button>

              <div className="panel-subtitle" style={{ marginTop: "1rem" }}>
                Review History ({reviews.length})
              </div>
              <div className="calendar-list">
                {reviews.map((review) => (
                  <div key={review.id} className="review-card">
                    <div className="review-card-header">
                      <div className="review-card-title">{review.parentName || "Parent"}</div>
                      <div className="calendar-meta">
                        {review.rating} star{review.rating > 1 ? "s" : ""}
                      </div>
                    </div>
                    <div className="review-summary-box">{review.reviewText}</div>
                    <div className="calendar-meta">Updated: {formatDateTime(review.updatedAt)}</div>
                  </div>
                ))}
                {!reviews.length && <div className="empty-col">No parent reviews yet.</div>}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
