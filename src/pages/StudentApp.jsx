import { useEffect, useMemo, useState } from "react";
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

const REMINDER_SEEN_KEY = "reminders_seen";

export default function StudentApp({ user, onOpenCollab }) {
  const [todos, setTodos] = useState([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [error, setError] = useState("");
  const [notif, setNotif] = useState("");

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [view, setView] = useState("tasks");

  async function loadTodos() {
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

  useEffect(() => {
    loadTodos();
  }, [user.id]);

  useEffect(() => {
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

  const total = todos.length;
  const submitted = todos.filter((todo) => todo.status === "Submitted").length;
  const graded = todos.filter((todo) => todo.status === "Graded").length;
  const avgProgress = total
    ? Math.round(
        todos.reduce((sum, todo) => sum + effectiveProgress(todo), 0) / total
      )
    : 0;

  const columns = useMemo(
    () => ({
      Todo: todos.filter((todo) => todo.status === "Todo"),
      "In Progress": todos.filter((todo) => todo.status === "In Progress"),
      Submitted: todos.filter((todo) => todo.status === "Submitted"),
      Graded: todos.filter((todo) => todo.status === "Graded"),
    }),
    [todos]
  );

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
      {notif && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={() => setNotif("")}>
            {notif}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

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

      <div className="view-tabs" style={{ marginBottom: "0.8rem" }}>
        <button
          className={`view-tab ${view === "tasks" ? "active" : ""}`}
          onClick={() => setView("tasks")}
        >
          My Tasks
        </button>
        <button className="view-tab" onClick={onOpenCollab}>
          Collab Hub
        </button>
        <button
          className={`view-tab ${view === "fees" ? "active" : ""}`}
          onClick={() => setView("fees")}
        >
          My Fees
        </button>
        <button
          className={`view-tab ${view === "market" ? "active" : ""}`}
          onClick={() => setView("market")}
        >
          Marketplace
        </button>
      </div>

      {view === "fees" ? (
        <FeesWorkspace user={user} />
      ) : view === "market" ? (
        <MarketplaceWorkspace user={user} />
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
