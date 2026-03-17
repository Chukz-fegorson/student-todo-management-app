import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { effectiveProgress, formatDateTime } from "../lib/helpers";
import { PARENT_RELATIONSHIP_OPTIONS } from "../lib/constants";
import WorkspaceOnboarding from "../components/WorkspaceOnboarding";

export default function ParentDashboard({ user, navRoute }) {
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
  const hasLinkedChildren = children.length > 0;

  function scrollToCard(id) {
    document.getElementById(id)?.scrollIntoView({
      behavior: "smooth",
      block: "start",
    });
  }

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
  const nextDeadlineTask = useMemo(() => {
    return [...tasks]
      .filter((task) => task.deadline)
      .sort(
        (a, b) =>
          new Date(a.deadline || 0).getTime() - new Date(b.deadline || 0).getTime()
      )[0] || null;
  }, [tasks]);
  const latestReview = reviews[0] || null;
  const onboardingItems = [
    {
      id: "link-child",
      title: "Link a child account",
      description: "Use the student email and link code to connect the child profile first.",
      done: children.length > 0,
      actionLabel: "Use Link Form",
      onAction: () => scrollToCard("parent-link-child-card"),
    },
    {
      id: "review-progress",
      title: "Review current progress",
      description: "Open a linked child and inspect tasks, deadlines, and current effective progress.",
      done: tasks.length > 0,
      actionLabel: "View Overview",
      onAction: () => scrollToCard("parent-child-overview-card"),
    },
    {
      id: "leave-review",
      title: "Leave a parent review",
      description: "Add guidance or support notes so the student can see parent feedback in their workspace.",
      done: reviews.length > 0,
      actionLabel: "Open Review Form",
      onAction: () => scrollToCard("parent-child-overview-card"),
    },
  ];

  useEffect(() => {
    if (navRoute?.action === "focus_link_child" && navRoute?.ts) {
      scrollToCard("parent-link-child-card");
    }
  }, [navRoute]);

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
          <p>Linked children, tasks, and review history are being prepared.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      <WorkspaceOnboarding
        user={user}
        workspaceKey="parent_home"
        title="Set up the parent workspace"
        description="Connect a child profile, watch for early slippage, and leave guidance that stays visible to the student."
        items={onboardingItems}
      />

      {notice && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={() => setNotice("")}>
            {notice}
          </div>
        </div>
      )}
      {error && <div className="error-msg">{error}</div>}

      <section className="module-hero">
        <div className="module-hero-copy">
          <div className="module-kicker">Parent Workspace</div>
          <div className="module-title-row">
            <h2>Child Progress and Review</h2>
            <span className="module-pill">
              {children.length} linked child{children.length === 1 ? "" : "ren"}
            </span>
          </div>
          <p>
            Link under-18 student accounts, follow deadlines and progress early, and leave guidance that stays close to the student workflow.
          </p>
          <div className="module-highlight-row">
            <span className="module-highlight-pill">
              {stats.total} task{stats.total === 1 ? "" : "s"} in current child view
            </span>
            <span className="module-highlight-pill">
              {stats.submitted} submitted for review
            </span>
            <span className="module-highlight-pill">
              {reviews.length} parent review{reviews.length === 1 ? "" : "s"} recorded
            </span>
          </div>
        </div>
      </section>

      <section className="command-center-card">
        <div className="command-center-head">
          <div className="command-center-copy">
            <div className="panel-kicker">Current focus</div>
            <h3>
              {selectedChild
                ? `${selectedChild.name} is ${stats.avgEffective}% through visible work.`
                : "Link a child account to start spotting risk early."}
            </h3>
            <p>
              {nextDeadlineTask
                ? `Next visible deadline: ${nextDeadlineTask.title} on ${formatDateTime(nextDeadlineTask.deadline)}.`
                : "Once a child is linked, deadlines, progress shifts, and support opportunities will surface here."}
            </p>
            {!hasLinkedChildren && (
              <div className="role-empty-actions">
                <button
                  className="btn btn-primary btn-sm"
                  onClick={() => scrollToCard("parent-link-child-card")}
                >
                  Link a Child
                </button>
              </div>
            )}
          </div>
          <div className="command-center-actions">
            <div className="command-metric">
              <span>Effective progress</span>
              <strong>{stats.avgEffective}%</strong>
            </div>
            <div className="command-metric">
              <span>Graded work</span>
              <strong>{stats.graded}</strong>
            </div>
          </div>
        </div>
      </section>

      <div className="workspace-grid workspace-grid-parent">
        <section className="panel panel-elevated" id="parent-link-child-card">
          <div className="panel-kicker">Connect</div>
          <div className="panel-title">Link Child Account</div>
          <div className="panel-copy">
            Use the student email and secure link code to connect a child profile to this parent account.
          </div>
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
            {!children.length && (
              <div className="role-empty-state role-empty-state-compact">
                <strong>No child account is linked yet.</strong>
                <p>
                  Ask the student for their email and secure link code from the student
                  workspace, then connect the account here.
                </p>
              </div>
            )}
          </div>
        </section>

        <section className="panel panel-elevated" id="parent-child-overview-card">
          <div className="panel-kicker">Overview</div>
          <div className="panel-title">
            {selectedChild ? `${selectedChild.name} Overview` : "Child Overview"}
          </div>
          {latestReview && (
            <div className="insight-card" style={{ marginBottom: "0.9rem" }}>
              <span className="insight-label">Latest review</span>
              <strong>{latestReview.parentName || "Parent"}</strong>
              <p>{latestReview.reviewText}</p>
            </div>
          )}
          {!selectedChild ? (
            <div className="role-empty-state role-empty-state-compact">
              <strong>Select a linked child to see progress in context.</strong>
              <p>
                Once a child is selected, this panel will show tasks, deadlines, effective
                progress, and parent review history in one place.
              </p>
            </div>
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
                {!tasks.length && (
                  <div className="empty-col">
                    No visible tasks yet. Once the student or school adds real work, it will
                    appear here with deadline and status context.
                  </div>
                )}
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
                {!reviews.length && (
                  <div className="empty-col">
                    No parent reviews yet. Use the form above to leave the first support note
                    for this child.
                  </div>
                )}
              </div>
            </>
          )}
        </section>
      </div>
    </div>
  );
}
