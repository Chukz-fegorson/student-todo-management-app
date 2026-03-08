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
import CoursesWorkspace from "../components/CoursesWorkspace";
import WorkspaceOnboarding from "../components/WorkspaceOnboarding";

// We store reminder history in browser storage so we do not repeat the same alert forever.
const REMINDER_SEEN_KEY = "reminders_seen";
const STUDENT_MODULE_META = {
  tasks: {
    kicker: "My Tasks",
    title: "Task Command Center",
    description:
      "See what needs attention now, keep deadlines visible, and move work from planning to grading without leaving this workspace.",
  },
  courses: {
    kicker: "Courses",
    title: "Course Progress",
    description:
      "Follow enrolled courses, practical work, assessments, and CGPA-linked progress from one place.",
  },
  collab: {
    kicker: "Collab Hub",
    title: "Meetings, Chat, and Community",
    description:
      "Move between direct chat, group collaboration, meetings, transcripts, and the shared community feed without losing context.",
  },
  fees: {
    kicker: "My Fees",
    title: "Payments and Receipts",
    description:
      "Track school fees, upload proof of payment, and keep confirmation history and receipts in one module.",
  },
  market: {
    kicker: "Marketplace",
    title: "Campus Commerce",
    description:
      "Buy, sell, and complete trusted transactions with listings, receipts, reviews, and delivery confirmation in one flow.",
  },
};

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
export default function StudentApp({
  user,
  navRoute,
  onNavigate,
  notificationSummary,
}) {
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
  const [courseOverview, setCourseOverview] = useState(null);
  // Which module tab is currently open.
  const [view, setView] = useState("tasks");
  const [highlightTaskId, setHighlightTaskId] = useState("");

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

  const loadCourseOverview = useCallback(async () => {
    try {
      const data = await apiGet("/courses/cgpa/me");
      setCourseOverview(data || null);
    } catch {
      setCourseOverview(null);
    }
  }, []);

  useEffect(() => {
    // Load tasks whenever user identity changes.
    loadTodos();
    loadParentData();
    loadCourseOverview();
  }, [user.id, loadParentData, loadCourseOverview]);

  useEffect(() => {
    // Every 30s, check deadlines and fire reminders when needed.
    const timer = window.setInterval(() => {
      const seen = storageGet(REMINDER_SEEN_KEY, {});
      let changed = false;
      let latestMessage = "";
      const nowMs = Date.now();

      const courseReminderItems = (courseOverview?.upcomingDeadlines || []).map((entry) => ({
        id: `course-${entry.id}`,
        title: `${entry.courseTitle}: ${entry.assessmentTitle}`,
        deadline: entry.dueAt,
        status: "Course",
      }));

      for (const todo of [...todos, ...courseReminderItems]) {
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
  }, [todos, courseOverview]);

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
  const isProfileComplete =
    Boolean(String(user?.bio || "").trim()) &&
    Boolean(String(user?.phone || "").trim()) &&
    Boolean(String(user?.dateOfBirth || "").trim());
  const courseProgress = Number(courseOverview?.overallCourseProgress || 0);
  const cgpa = Number(courseOverview?.cgpa || 0);
  const selectedCoursesCount = Number(courseOverview?.selectedCoursesCount || 0);

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
    const taskItems = todos.filter((todo) => parseDate(todo.deadline));
    const courseItems = (courseOverview?.upcomingDeadlines || []).map((entry) => ({
      id: `course-${entry.id}`,
      title: `${entry.courseTitle}: ${entry.assessmentTitle}`,
      category: entry.assessmentType,
      status: "Course",
      deadline: entry.dueAt,
      sourceType: "course",
    }));
    return [...taskItems, ...courseItems]
      .filter((todo) => parseDate(todo.deadline))
      .sort(
        (a, b) =>
          parseDate(a.deadline).getTime() - parseDate(b.deadline).getTime()
      )
      .slice(0, 8);
  }, [todos, courseOverview]);

  const activeModule = STUDENT_MODULE_META[view] || STUDENT_MODULE_META.tasks;
  const activeTasksCount = todos.filter(
    (todo) => todo.status === "Todo" || todo.status === "In Progress"
  ).length;
  const focusTask = upcomingDeadlines[0] || null;
  const dueSoonCount = upcomingDeadlines.filter((todo) => {
    const deadline = parseDate(todo.deadline);
    if (!deadline) return false;
    const remainingMs = deadline.getTime() - Date.now();
    return remainingMs >= 0 && remainingMs <= 1000 * 60 * 60 * 48;
  }).length;
  const reviewReadyCount = todos.filter((todo) => todo.status === "Submitted").length;
  const parentReviewPreview = parentReviews[0] || null;
  const focusQueue = [...upcomingDeadlines]
    .sort(
      (a, b) =>
        parseDate(a.deadline).getTime() - parseDate(b.deadline).getTime()
    )
    .slice(0, 4);
  const completionRate = total
    ? Math.round(((graded + submitted) / total) * 100)
    : 0;
  const moduleHighlights = {
    tasks: [
      `${activeTasksCount} active task${activeTasksCount === 1 ? "" : "s"}`,
      `${dueSoonCount} due within 48 hours`,
      `${reviewReadyCount} awaiting grading`,
    ],
    courses: [
      `${selectedCoursesCount} selected course${selectedCoursesCount === 1 ? "" : "s"}`,
      `${courseProgress}% course progress`,
      `CGPA ${cgpa.toFixed(2)}`,
    ],
    collab: [
      "Meetings, chat, and community feed",
      "Transcript and AI action pipeline",
      "Broadcast and direct collaboration",
    ],
    fees: [
      "Track school fees and receipts",
      "Upload evidence for manual payment",
      "Keep confirmation history visible",
    ],
    market: [
      "Browse listings and complete purchases",
      "Use claim-code confirmation flow",
      "Review sellers and products after delivery",
    ],
  };
  const moduleTabCounts = {
    tasks: (notificationSummary?.byModule?.tasks || 0) + dueSoonCount,
    courses: (notificationSummary?.byModule?.courses || 0) + selectedCoursesCount,
    collab: notificationSummary?.byModule?.collab || 0,
    fees: notificationSummary?.byModule?.fees || 0,
    market: notificationSummary?.byModule?.market || 0,
  };
  const onboardingItems = [
    {
      id: "profile",
      title: "Complete biodata",
      description: "Add your bio, phone number, and date of birth so your profile is complete.",
      done: isProfileComplete,
      actionLabel: "Update Biodata",
      onAction: () => onNavigate?.({ action: "open_account_profile" }),
    },
    {
      id: "first-task",
      title: "Create your first task",
      description: "Start using the command center by adding a real assignment, revision, or project.",
      done: total > 0,
      actionLabel: "Create Task",
      onAction: () => {
        setView("tasks");
        setEditing(null);
        setShowModal(true);
      },
    },
    {
      id: "courses",
      title: "Select a course",
      description: "Choose at least one course so StudyFlow can track CGPA and assessment progress.",
      done: selectedCoursesCount > 0,
      actionLabel: "Open Courses",
      onAction: () => setView("courses"),
    },
    {
      id: "reminders",
      title: "Enable reminders",
      description: "Turn on browser reminders so upcoming deadlines can surface before they become urgent.",
      done: typeof window !== "undefined" && window.Notification?.permission === "granted",
      actionLabel: "Enable",
      onAction: enableNotifications,
    },
  ];

  useEffect(() => {
    if (!navRoute?.ts) return;

    const nextModule = navRoute.module;
    if (["tasks", "courses", "collab", "fees", "market"].includes(nextModule)) {
      setView(nextModule);
    }

    if (nextModule === "tasks") {
      if (navRoute.action === "new_task") {
        setEditing(null);
        setShowModal(true);
      }
      if (navRoute.entityType === "task" && navRoute.entityId) {
        const targetTask = todos.find((entry) => entry.id === navRoute.entityId);
        if (targetTask) {
          setEditing(targetTask);
          setShowModal(true);
          setHighlightTaskId(targetTask.id);
        }
      }
    }
  }, [navRoute, todos]);

  useEffect(() => {
    if (!highlightTaskId) return undefined;
    const timer = window.setTimeout(() => setHighlightTaskId(""), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightTaskId]);

  return (
    <div className="main">
      <WorkspaceOnboarding
        user={user}
        workspaceKey="student_home"
        title="Set up your student workspace"
        description="Finish these first actions to make tasks, courses, reminders, and support tools useful immediately."
        items={onboardingItems}
      />

      <div className="view-tabs module-tabs">
        <button
          className={`view-tab module-tab ${view === "tasks" ? "active" : ""}`}
          onClick={() => setView("tasks")}
        >
          My Tasks
          {moduleTabCounts.tasks > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.tasks}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "courses" ? "active" : ""}`}
          onClick={() => setView("courses")}
        >
          Courses
          {moduleTabCounts.courses > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.courses}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "collab" ? "active" : ""}`}
          onClick={() => setView("collab")}
        >
          Collab Hub
          {moduleTabCounts.collab > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.collab}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "fees" ? "active" : ""}`}
          onClick={() => setView("fees")}
        >
          My Fees
          {moduleTabCounts.fees > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.fees}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "market" ? "active" : ""}`}
          onClick={() => setView("market")}
        >
          Marketplace
          {moduleTabCounts.market > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.market}</span>
          )}
        </button>
      </div>

      <section className="module-hero">
        <div className="module-hero-copy">
          <div className="module-kicker">{activeModule.kicker}</div>
          <div className="module-title-row">
            <h2>{activeModule.title}</h2>
            <span className="module-pill">
              {view === "tasks"
                ? `${total} total task${total === 1 ? "" : "s"}`
                : view === "courses"
                  ? `${selectedCoursesCount} selected`
                  : view === "collab"
                    ? "Live workspace"
                    : view === "fees"
                      ? "Payments workflow"
                      : "Listings and orders"}
            </span>
          </div>
          <p>{activeModule.description}</p>
          <div className="module-highlight-row">
            {moduleHighlights[view].map((entry) => (
              <span key={entry} className="module-highlight-pill">
                {entry}
              </span>
            ))}
          </div>
        </div>

        {view === "tasks" && (
          <div className="module-actions">
            <button
              className="btn btn-primary"
              onClick={() => {
                setEditing(null);
                setShowModal(true);
              }}
            >
              New Task
            </button>
            <button
              className="btn btn-ghost"
              onClick={() => {
                loadTodos();
                loadCourseOverview();
              }}
            >
              Refresh
            </button>
            <button className="btn btn-ghost" onClick={enableNotifications}>
              Enable Reminders
            </button>
            <button
              className="btn btn-ghost"
              onClick={() =>
                exportTasksToCalendar(
                  [
                    ...todos.filter((todo) => todo.deadline),
                    ...(courseOverview?.upcomingDeadlines || []).map((entry) => ({
                      id: `course-${entry.id}`,
                      title: `${entry.courseTitle}: ${entry.assessmentTitle}`,
                      description: `Course ${entry.assessmentType}`,
                      category: "Course",
                      status: "Course",
                      deadline: entry.dueAt,
                      reminderOffsets: [30, 10, 5],
                    })),
                  ],
                  `${user.name || "student"}-tasks.ics`
                )
              }
            >
              Export Calendar (.ics)
            </button>
          </div>
        )}
      </section>

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
          <section className="command-center-card">
            <div className="command-center-head">
              <div className="command-center-copy">
                <div className="panel-kicker">Today&apos;s focus</div>
                <h3>
                  {focusTask ? focusTask.title : "You are clear for now. Create work before the next deadline sneaks up."}
                </h3>
                <p>
                  {focusTask
                    ? `Next deadline: ${formatDateTime(focusTask.deadline)}. Keep this item moving before it becomes urgent.`
                    : "Tasks, course assessments, and reminders will surface here when they need attention."}
                </p>
              </div>
              <div className="command-center-actions">
                <div className="command-metric">
                  <span>Completion momentum</span>
                  <strong>{completionRate}%</strong>
                </div>
                <div className="command-metric">
                  <span>Waiting for grade</span>
                  <strong>{reviewReadyCount}</strong>
                </div>
              </div>
            </div>

            <div className="command-strip">
              <article className="command-tile">
                <span className="command-tile-label">At risk</span>
                <strong>{dueSoonCount}</strong>
                <p>Deadlines landing in the next 48 hours.</p>
              </article>
              <article className="command-tile">
                <span className="command-tile-label">Active work</span>
                <strong>{activeTasksCount}</strong>
                <p>Tasks still in planning or execution.</p>
              </article>
              <article className="command-tile">
                <span className="command-tile-label">Course track</span>
                <strong>{courseProgress}%</strong>
                <p>{selectedCoursesCount} selected course(s) feeding CGPA.</p>
              </article>
            </div>
          </section>

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
            <div className="stat-card">
              <div className="stat-label">Course Progress</div>
              <div className="stat-value stat-amber">{courseProgress}%</div>
              <div className="stat-sub">{selectedCoursesCount} selected</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Current CGPA</div>
              <div className="stat-value stat-purple">{cgpa.toFixed(2)}</div>
              <div className="stat-sub">
                Scale: {(courseOverview?.gradingScale || "ng_5").toUpperCase()}
              </div>
            </div>
          </div>
        </>
      )}

      {view === "courses" ? (
        <CoursesWorkspace user={user} navRoute={navRoute} />
      ) : view === "fees" ? (
        <FeesWorkspace user={user} navRoute={navRoute} />
      ) : view === "market" ? (
        <MarketplaceWorkspace user={user} navRoute={navRoute} />
      ) : view === "collab" ? (
        // Collab works as an in-page module (not popup) for smoother navigation.
        <CollaborationHubModal user={user} embedded navRoute={navRoute} />
      ) : loadingTodos ? (
        <div className="empty">
          <div className="empty-icon">...</div>
          <h3>Loading your task workspace</h3>
          <p>Tasks, deadlines, and course reminders are being prepared.</p>
        </div>
      ) : (
        <div className="workspace-grid workspace-grid-student">
          <div className="workspace-main">
            <section className="panel panel-elevated">
              <div className="panel-headline">
                <div>
                  <div className="panel-kicker">Board view</div>
                  <div className="panel-title">Kanban Board</div>
                  <div className="panel-copy">
                    Move work from planning to progress, submission, and grading without losing visibility.
                  </div>
                </div>
              </div>
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
                          highlighted={todo.id === highlightTaskId}
                          onEdit={(entry) => {
                            setEditing(entry);
                            setShowModal(true);
                          }}
                          onDelete={(entry) => setDeleting(entry)}
                        />
                      ))}
                    </div>

                    {!items.length && (
                      <div className="empty-col">
                        {columnName === "Todo"
                          ? "No tasks waiting to be started."
                          : columnName === "In Progress"
                            ? "Nothing is currently in motion."
                            : columnName === "Submitted"
                              ? "No work is waiting for review."
                              : "Nothing has been graded yet."}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          </div>

          <aside className="workspace-side">
            <section className="panel panel-elevated">
              <div className="panel-kicker">Focus queue</div>
              <div className="panel-title">Next Moves</div>
              <div className="calendar-list">
                {focusQueue.length ? (
                  focusQueue.map((todo) => (
                    <div key={todo.id} className="calendar-item">
                      <div>
                        <div className="calendar-title">{todo.title}</div>
                        <div className="calendar-meta">
                          {todo.category} | {todo.status}
                        </div>
                      </div>
                      <div className="calendar-date">{formatDateTime(todo.deadline)}</div>
                    </div>
                  ))
                ) : (
                  <div className="empty-col">
                    No urgent focus items yet. Create a task or enroll in a course to start building momentum.
                  </div>
                )}
              </div>
            </section>

            <section className="panel panel-elevated">
              <div className="panel-kicker">Deadlines</div>
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

            <section className="panel panel-elevated">
              <div className="panel-kicker">Support</div>
              <div className="panel-title">Parent Review</div>
              {isUnder18(user.dateOfBirth) && parentLinkCode && (
                <div className="review-summary-box" style={{ marginBottom: "0.6rem" }}>
                  Parent Link Code: <strong>{parentLinkCode}</strong>
                  <div className="calendar-meta" style={{ marginTop: "0.35rem" }}>
                    Share this code with your parent/guardian so they can link to your account.
                  </div>
                </div>
              )}

              {parentReviewPreview && (
                <div className="insight-card" style={{ marginBottom: "0.75rem" }}>
                  <span className="insight-label">Latest review</span>
                  <strong>{parentReviewPreview.parentName || "Parent"}</strong>
                  <p>{parentReviewPreview.reviewText}</p>
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
          </aside>
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
