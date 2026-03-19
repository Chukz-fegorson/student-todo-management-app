import { useMemo } from "react";
import TodoCard from "./TodoCard";
import { effectiveProgress, formatDateTime } from "../lib/helpers";

const KANBAN_COLUMN_META = {
  Todo: {
    label: "To-do",
    subtitle: "Planned work that still needs a start.",
    dotClassName: "kanban-dot-todo",
  },
  "In Progress": {
    label: "In-progress",
    subtitle: "Work already in motion.",
    dotClassName: "kanban-dot-progress",
  },
  Submitted: {
    label: "Submitted",
    subtitle: "Waiting for review or feedback.",
    dotClassName: "kanban-dot-submitted",
  },
  Graded: {
    label: "Graded",
    subtitle: "Reviewed work you can learn from.",
    dotClassName: "kanban-dot-graded",
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

function StudentTaskBoard({
  columns,
  highlightTaskId,
  needsTaskSetup,
  notificationsEnabled,
  onCreateTask,
  onDeleteTask,
  onEditTask,
  onEnableNotifications,
  onOpenCourses,
}) {
  return (
    <div>
      <section className="panel panel-elevated student-kanban-panel">
        <div className="panel-headline">
          <div>
            <div className="panel-kicker">Board view</div>
            <div className="panel-title">Kanban Board</div>
            <div className="panel-copy">
              Move work from planning to progress, submission, and grading without
              losing visibility.
            </div>
          </div>
        </div>
        {needsTaskSetup ? (
          <div className="role-empty-state">
            <strong>No task is driving this workspace yet.</strong>
            <p>
              Start with one real assignment, revision target, or project. Then add
              course context and reminders so StudyFlow can surface the next move
              instead of an empty board.
            </p>
            <div className="role-empty-actions">
              <button className="btn btn-primary btn-sm" onClick={onCreateTask}>
                Create First Task
              </button>
              <button className="btn btn-ghost btn-sm" onClick={onOpenCourses}>
                Open Courses
              </button>
              <button
                className="btn btn-ghost btn-sm"
                onClick={onEnableNotifications}
                disabled={notificationsEnabled}
              >
                {notificationsEnabled ? "Reminders Enabled" : "Enable Reminders"}
              </button>
            </div>
          </div>
        ) : (
          <div className="kanban-shell">
            <div className="kanban-shell-hint">
              Scroll across lanes and inside each lane to review longer task queues.
            </div>
            <div className="kanban">
              {Object.entries(columns).map(([columnName, items]) => {
                const columnMeta = KANBAN_COLUMN_META[columnName] || {
                  label: columnName,
                  subtitle: "",
                  dotClassName: "kanban-dot-todo",
                };

                return (
                  <div
                    key={columnName}
                    className={`kanban-col ${
                      columnName === "Submitted" ? "col-review" : ""
                    }`}
                  >
                    <div className="kanban-head">
                      <div className="kanban-title-group">
                        <div className="kanban-title-row">
                          <span className={`kanban-dot ${columnMeta.dotClassName}`} />
                          <div className="kanban-title">{columnMeta.label}</div>
                        </div>
                        {!!columnMeta.subtitle && (
                          <div className="kanban-subtitle">{columnMeta.subtitle}</div>
                        )}
                      </div>
                      <div className="kanban-count">{items.length}</div>
                    </div>

                    <div className="kanban-scroll">
                      <div className="kanban-cards">
                        {items.map((todo) => (
                          <TodoCard
                            key={todo.id}
                            todo={todo}
                            highlighted={todo.id === highlightTaskId}
                            onEdit={onEditTask}
                            onDelete={onDeleteTask}
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
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </section>
    </div>
  );
}

function StudentTaskUtilities({
  focusQueue,
  openTaskUtility,
  parentLinkCode,
  parentReviewPreview,
  parentReviews,
  taskUtilityItems,
  upcomingDeadlines,
  user,
  onToggleTaskUtility,
}) {
  return (
    <section className="panel panel-elevated">
      <div className="panel-headline">
        <div>
          <div className="panel-kicker">Quick views</div>
          <div className="panel-title">Focus, Deadlines, and Support</div>
          <div className="panel-copy">
            Open these supporting views only when you need them, so the kanban
            remains the primary working surface.
          </div>
        </div>
      </div>

      <div className="task-utility-buttons">
        {taskUtilityItems.map((item) => {
          const isActive = openTaskUtility === item.id;
          return (
            <button
              key={item.id}
              type="button"
              className={`task-utility-button ${isActive ? "active" : ""}`}
              onClick={() => onToggleTaskUtility(item.id)}
            >
              <span>{item.label}</span>
              <span className="task-utility-count">{item.count}</span>
            </button>
          );
        })}
      </div>

      {!openTaskUtility ? (
        <div className="empty-col">
          Open Focus Queue, Deadlines, or Parent Review when you want supporting
          context without shrinking the board.
        </div>
      ) : (
        <div className="task-utility-panel">
          {openTaskUtility === "focus" && (
            <>
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
                    No urgent focus items yet. Create a task or enroll in a course to
                    start building momentum.
                  </div>
                )}
              </div>
            </>
          )}

          {openTaskUtility === "deadlines" && (
            <>
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
                <div className="empty-col">
                  No upcoming deadlines yet. Add a task or course assessment so
                  StudyFlow can warn you before work becomes urgent.
                </div>
              )}
            </>
          )}

          {openTaskUtility === "support" && (
            <>
              <div className="panel-kicker">Support</div>
              <div className="panel-title">Parent Review</div>
              {isUnder18(user.dateOfBirth) && parentLinkCode && (
                <div className="review-summary-box" style={{ marginBottom: "0.6rem" }}>
                  Parent Link Code: <strong>{parentLinkCode}</strong>
                  <div className="calendar-meta" style={{ marginTop: "0.35rem" }}>
                    Share this code with your parent/guardian so they can link to your
                    account.
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
                      <div className="review-card-title">
                        {review.parentName || "Parent"}
                      </div>
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
                  <div className="empty-col">
                    No parent reviews yet. Support notes from a linked parent or
                    guardian will appear here once they start contributing.
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}

export default function StudentTasksWorkspace({
  courseOverview,
  dueSoonCount,
  error,
  highlightTaskId,
  loadingTodos,
  moduleMeta,
  notificationsEnabled,
  notif,
  openTaskUtility,
  parentLinkCode,
  parentReviews,
  todos,
  upcomingDeadlines,
  user,
  onCreateTask,
  onDeleteTask,
  onDismissNotif,
  onEditTask,
  onEnableNotifications,
  onExportCalendar,
  onOpenCourses,
  onRefresh,
  onToggleTaskUtility,
}) {
  const total = todos.length;
  const submitted = todos.filter((todo) => todo.status === "Submitted").length;
  const graded = todos.filter((todo) => todo.status === "Graded").length;
  const avgProgress = total
    ? Math.round(
        todos.reduce((sum, todo) => sum + effectiveProgress(todo), 0) / total
      )
    : 0;
  const courseProgress = Number(courseOverview?.overallCourseProgress || 0);
  const cgpa = Number(courseOverview?.cgpa || 0);
  const selectedCoursesCount = Number(courseOverview?.selectedCoursesCount || 0);

  const columns = useMemo(
    () => ({
      Todo: todos.filter((todo) => todo.status === "Todo"),
      "In Progress": todos.filter((todo) => todo.status === "In Progress"),
      Submitted: todos.filter((todo) => todo.status === "Submitted"),
      Graded: todos.filter((todo) => todo.status === "Graded"),
    }),
    [todos]
  );

  const activeTasksCount = todos.filter(
    (todo) => todo.status === "Todo" || todo.status === "In Progress"
  ).length;
  const reviewReadyCount = submitted;
  const focusTask = upcomingDeadlines[0] || null;
  const parentReviewPreview = parentReviews[0] || null;
  const focusQueue = upcomingDeadlines.slice(0, 4);
  const completionRate = total
    ? Math.round(((graded + submitted) / total) * 100)
    : 0;
  const needsTaskSetup = total === 0;
  const taskCommandHeadline = needsTaskSetup
    ? "Start with one real task so StudyFlow can tell you what matters next."
    : focusTask
      ? focusTask.title
      : "You are clear for now. Keep the next commitment visible.";
  const taskCommandCopy = needsTaskSetup
    ? "Create a real assignment, revision target, or project, then add courses and reminders so the dashboard can guide you before work slips."
    : focusTask
      ? `Next deadline: ${formatDateTime(focusTask.deadline)}. Keep this item moving before it becomes urgent.`
      : "Tasks, course assessments, and reminders will surface here when they need attention.";
  const moduleHighlights = [
    `${activeTasksCount} active task${activeTasksCount === 1 ? "" : "s"}`,
    `${dueSoonCount} due within 48 hours`,
    `${reviewReadyCount} awaiting grading`,
  ];
  const taskUtilityItems = [
    {
      id: "focus",
      label: "Focus Queue",
      count: focusQueue.length,
    },
    {
      id: "deadlines",
      label: "Deadlines",
      count: upcomingDeadlines.length,
    },
    {
      id: "support",
      label: "Parent Review",
      count: parentReviews.length,
    },
  ];

  return (
    <>
      <section className="module-hero">
        <div className="module-hero-copy">
          <div className="module-kicker">{moduleMeta.kicker}</div>
          <div className="module-title-row">
            <h2>{moduleMeta.title}</h2>
            <span className="module-pill">
              {total} total task{total === 1 ? "" : "s"}
            </span>
          </div>
          <p>{moduleMeta.description}</p>
          <div className="module-highlight-row">
            {moduleHighlights.map((entry) => (
              <span key={entry} className="module-highlight-pill">
                {entry}
              </span>
            ))}
          </div>
        </div>

        <div className="module-actions">
          <button className="btn btn-primary" onClick={onCreateTask}>
            New Task
          </button>
          <button className="btn btn-ghost" onClick={onRefresh}>
            Refresh
          </button>
          <button className="btn btn-ghost" onClick={onEnableNotifications}>
            Enable Reminders
          </button>
          <button className="btn btn-ghost" onClick={onExportCalendar}>
            Export Calendar (.ics)
          </button>
        </div>
      </section>

      {notif && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={onDismissNotif}>
            {notif}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <section className="command-center-card">
        <div className="command-center-head">
          <div className="command-center-copy">
            <div className="panel-kicker">Today&apos;s focus</div>
            <h3>{taskCommandHeadline}</h3>
            <p>{taskCommandCopy}</p>
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

      {loadingTodos ? (
        <div className="empty">
          <div className="empty-icon">...</div>
          <h3>Loading your task workspace</h3>
          <p>Tasks, deadlines, and course reminders are being prepared.</p>
        </div>
      ) : (
        <div className="student-task-layout">
          <StudentTaskBoard
            columns={columns}
            highlightTaskId={highlightTaskId}
            needsTaskSetup={needsTaskSetup}
            notificationsEnabled={notificationsEnabled}
            onCreateTask={onCreateTask}
            onDeleteTask={onDeleteTask}
            onEditTask={onEditTask}
            onEnableNotifications={onEnableNotifications}
            onOpenCourses={onOpenCourses}
          />
          <StudentTaskUtilities
            focusQueue={focusQueue}
            openTaskUtility={openTaskUtility}
            parentLinkCode={parentLinkCode}
            parentReviewPreview={parentReviewPreview}
            parentReviews={parentReviews}
            taskUtilityItems={taskUtilityItems}
            upcomingDeadlines={upcomingDeadlines}
            user={user}
            onToggleTaskUtility={onToggleTaskUtility}
          />
        </div>
      )}
    </>
  );
}
