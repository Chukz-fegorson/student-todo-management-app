import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDel, apiGet, apiPost, apiPut } from "../lib/api";
import { exportTasksToCalendar } from "../lib/calendar";
import {
  effectiveProgress,
  formatDateTime,
  normalizeReminderOffsets,
  parseDate,
} from "../lib/helpers";
import { storageGet, storageSet } from "../lib/storage";

import TodoCard from "../components/TodoCard";
import TodoModal from "../components/TodoModal";
import DeleteModal from "../components/DeleteModal";
import FeesWorkspace from "../components/FeesWorkspace";
import MarketplaceWorkspace from "../components/MarketplaceWorkspace";
import CollaborationHubModal from "../components/CollaborationHubModal";

// We store reminder history in browser storage so we do not repeat the same alert forever.
const REMINDER_SEEN_KEY = "reminders_seen";

function isUnder18(dateValue) {
  if (!dateValue) return false;
  const dob = new Date(dateValue);
  if (Number.isNaN(dob.getTime())) return false;
  const now = new Date();
  let age = now.getUTCFullYear() - dob.getUTCFullYear();
  const monthDiff = now.getUTCMonth() - dob.getUTCMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getUTCDate() < dob.getUTCDate())) {
    age -= 1;
  }
  return age < 18;
}

// StudentApp is the student's "home room":
// tasks, collaboration, fees, and marketplace all live here as module tabs.
export default function StudentApp({ user }) {
  // Main task data + basic UX states.
  const [todos, setTodos] = useState([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [error, setError] = useState("");
  const [notif, setNotif] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [parentReviews, setParentReviews] = useState([]);
  const [parentLinkCode, setParentLinkCode] = useState("");
  // Which module tab is currently open.
  const [view, setView] = useState("tasks");

  async function loadTodos() {
    // Ask backend for this student's current tasks.
    try {
      setError("");
      setLoadingTodos(true);
      const data = await apiGet("/tasks");
      setTodos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoadingTodos(false);
    }
  }

  const loadParentData = useCallback(async () => {
    try {
      const [reviews, linkData] = await Promise.all([
        apiGet(`/students/${user.id}/parent-reviews`),
        apiGet("/parent/link-code").catch(() => null),
      ]);
      setParentReviews(Array.isArray(reviews) ? reviews : []);
      setParentLinkCode(linkData?.linkCode || "");
    } catch {
      setParentReviews([]);
      setParentLinkCode("");
    }
  }, [user.id]);

  useEffect(() => {
    // Load tasks whenever user identity changes.
    loadTodos();
    loadParentData();
  }, [user.id, loadParentData]);

  useEffect(() => {
    // Every 30s, check deadlines and fire reminders when needed.
    const timer = window.setInterval(() => {
      const seen = storageGet(REMINDER_SEEN_KEY, {});
      let changed = false;
      let latestMessage = "";
      const nowMs = Date.now();

      for (const todo of todos) {
        if (!todo.deadline || todo.status === "Graded") continue;
        const due = parseDate(todo.deadline);
        if (!due) continue;
        const dueMs = due.getTime();
        const offsets = normalizeReminderOffsets(todo.reminderOffsets);

        for (const offset of offsets) {
          const reminderKey = `${todo.id}:${offset}`;
          if (seen[reminderKey]) continue;
          const trigger = dueMs - offset * 60 * 1000;

          if (nowMs >= trigger && nowMs < dueMs) {
            // Mark reminder as seen so we don't re-announce same offset.
            seen[reminderKey] = nowMs;
            changed = true;
            latestMessage = `${todo.title} is due in ${offset} minute(s).`;

            if (window.Notification && Notification.permission === "granted") {
              new Notification("StudyFlow Reminder", {
                body: latestMessage,
              });
            }
          }
        }
      }

      if (changed) {
        storageSet(REMINDER_SEEN_KEY, seen);
        if (latestMessage) setNotif(latestMessage);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [todos]);

  async function enableNotifications() {
    // Browser permission gate for local reminder popups.
    if (!window.Notification) {
      setNotif("This browser does not support notifications.");
      return;
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === "granted") {
        setNotif("Deadline notifications enabled.");
      } else {
        setNotif("Notification permission was not granted.");
      }
    } catch {
      setNotif("Unable to request notification permission.");
    }
  }

  async function saveTodo(form) {
    // One function handles both create and edit.
    try {
      setError("");

      if (editing) {
        const updated = await apiPut(`/tasks/${editing.id}`, form);
        setTodos((prev) => prev.map((todo) => (todo.id === updated.id ? updated : todo)));
        setNotif("Task updated.");
      } else {
        const created = await apiPost("/tasks", form);
        if (Array.isArray(created)) {
          setTodos((prev) => [...created, ...prev]);
        } else {
          setTodos((prev) => [created, ...prev]);
        }
        setNotif("Task created.");
      }

      setEditing(null);
      setShowModal(false);
    } catch (err) {
      setError(err.message || "Failed to save task");
    }
  }

  async function deleteTodo() {
    // Remove task in backend, then remove it from local list.
    if (!deleting) return;
    try {
      setError("");
      await apiDel(`/tasks/${deleting.id}`);
      setTodos((prev) => prev.filter((todo) => todo.id !== deleting.id));
      setDeleting(null);
      setNotif("Task deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete task");
    }
  }

  // Lightweight dashboard numbers.
  const total = todos.length;
  const submitted = todos.filter((todo) => todo.status === "Submitted").length;
  const graded = todos.filter((todo) => todo.status === "Graded").length;
  const avgProgress = total
    ? Math.round(
        todos.reduce((sum, todo) => sum + effectiveProgress(todo), 0) / total
      )
    : 0;

  // Build kanban columns from same task list.
  const columns = useMemo(
    () => ({
      Todo: todos.filter((todo) => todo.status === "Todo"),
      "In Progress": todos.filter((todo) => todo.status === "In Progress"),
      Submitted: todos.filter((todo) => todo.status === "Submitted"),
      Graded: todos.filter((todo) => todo.status === "Graded"),
    }),
    [todos]
  );

  // Show nearest deadlines first.
  const upcomingDeadlines = useMemo(() => {
    return todos
      .filter((todo) => parseDate(todo.deadline))
      .sort(
        (a, b) =>
          parseDate(a.deadline).getTime() - parseDate(b.deadline).getTime()
      )
      .slice(0, 8);
  }, [todos]);

  return (
    <div className="main">
      <div className="view-tabs module-tabs">
        <button
          className={`view-tab module-tab ${view === "tasks" ? "active" : ""}`}
          onClick={() => setView("tasks")}
        >
          My Tasks
        </button>
        <button
          className={`view-tab module-tab ${view === "collab" ? "active" : ""}`}
          onClick={() => setView("collab")}
        >
          Collab Hub
        </button>
        <button
          className={`view-tab module-tab ${view === "fees" ? "active" : ""}`}
          onClick={() => setView("fees")}
        >
          My Fees
        </button>
        <button
          className={`view-tab module-tab ${view === "market" ? "active" : ""}`}
          onClick={() => setView("market")}
        >
          Marketplace
        </button>
      </div>

      {notif && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={() => setNotif("")}>
            {notif}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {view === "tasks" && (
        <>
          <div className="stats-bar stats-bar-student">
            <div className="stat-card">
              <div className="stat-label">Total Tasks</div>
              <div className="stat-value">{total}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Graded</div>
              <div className="stat-value stat-green">{graded}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Submitted</div>
              <div className="stat-value stat-purple">{submitted}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Average Progress</div>
              <div className="stat-value stat-blue">{avgProgress}%</div>
            </div>
          </div>

          <div className="toolbar">
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
            >
              New Task
            </button>
            <button className="btn btn-ghost" onClick={loadTodos}>
              Refresh
            </button>
            <button className="btn btn-ghost" onClick={enableNotifications}>
              Enable Reminders
            </button>
            <button
              className="btn btn-ghost"
              onClick={() =>
                exportTasksToCalendar(
                  todos.filter((todo) => todo.deadline),
                  `${user.name || "student"}-tasks.ics`
                )
              }
            >
              Export Calendar (.ics)
            </button>
          </div>
        </>
      )}

      {view === "fees" ? (
        <FeesWorkspace user={user} />
      ) : view === "market" ? (
        <MarketplaceWorkspace user={user} />
      ) : view === "collab" ? (
        // Collab works as an in-page module (not popup) for smoother navigation.
        <CollaborationHubModal user={user} embedded />
      ) : loadingTodos ? (
        <div className="empty">
          <div className="empty-icon">...</div>
          <h3>Loading tasks</h3>
          <p>Please wait.</p>
        </div>
      ) : (
        <div className="dashboard-grid student-grid">
          <section className="panel">
            <div className="panel-title">Kanban Board</div>
            <div className="kanban">
              {Object.entries(columns).map(([columnName, items]) => (
                <div
                  key={columnName}
                  className={`kanban-col ${
                    columnName === "Submitted" ? "col-review" : ""
                  }`}
                >
                  <div className="kanban-head">
                    <div className="kanban-title">{columnName}</div>
                    <div className="kanban-count">{items.length}</div>
                  </div>

                  <div className="kanban-cards">
                    {items.map((todo) => (
                      <TodoCard
                        key={todo.id}
                        todo={todo}
                        onEdit={(entry) => {
                          setEditing(entry);
                          setShowModal(true);
                        }}
                        onDelete={(entry) => setDeleting(entry)}
                      />
                    ))}
                  </div>

                  {!items.length && <div className="empty-col">No tasks in this column.</div>}
                </div>
              ))}
            </div>
          </section>

          <section className="panel">
            <div className="panel-title">Upcoming Deadlines</div>
            {upcomingDeadlines.length ? (
              <div className="calendar-list">
                {upcomingDeadlines.map((todo) => (
                  <div key={todo.id} className="calendar-item">
                    <div>
                      <div className="calendar-title">{todo.title}</div>
                      <div className="calendar-meta">
                        {todo.category} | {todo.status}
                      </div>
                    </div>
                    <div className="calendar-date">{formatDateTime(todo.deadline)}</div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="empty-col">No upcoming deadlines yet.</div>
            )}
          </section>

          <section className="panel">
            <div className="panel-title">Parent Review</div>
            {isUnder18(user.dateOfBirth) && parentLinkCode && (
              <div className="review-summary-box" style={{ marginBottom: "0.6rem" }}>
                Parent Link Code: <strong>{parentLinkCode}</strong>
                <div className="calendar-meta" style={{ marginTop: "0.35rem" }}>
                  Share this code with your parent/guardian so they can link to your account.
                </div>
              </div>
            )}
            <div className="calendar-list">
              {parentReviews.map((review) => (
                <div key={review.id} className="review-card">
                  <div className="review-card-header">
                    <div className="review-card-title">{review.parentName || "Parent"}</div>
                    <div className="calendar-meta">
                      {review.rating} star{review.rating > 1 ? "s" : ""}
                    </div>
                  </div>
                  <div className="review-summary-box">{review.reviewText}</div>
                  <div className="calendar-meta">
                    Updated: {formatDateTime(review.updatedAt)}
                  </div>
                </div>
              ))}
              {!parentReviews.length && (
                <div className="empty-col">No parent reviews yet.</div>
              )}
            </div>
          </section>
        </div>
      )}

      {showModal && (
        <TodoModal
          todo={editing}
          onSave={saveTodo}
          onClose={() => {
            setEditing(null);
            setShowModal(false);
          }}
        />
      )}

      {deleting && (
        <DeleteModal
          todo={deleting}
          onConfirm={deleteTodo}
          onClose={() => setDeleting(null)}
        />
      )}
    </div>
  );
}
