import PriBadge from "./PriBadge";
import GradeChip from "./GradeChip";
import {
  deadlineStatus,
  effectiveProgress,
  formatDateTime,
  gradeToScore,
  timeLeft,
} from "../lib/helpers";

export default function TodoCard({ todo, onEdit, onDelete, highlighted = false }) {
  const ds = deadlineStatus(todo.deadline);
  const ep = effectiveProgress(todo);
  const isGraded = gradeToScore(todo.grade) !== null;
  const contextLabel =
    todo.status === "Submitted"
      ? "Awaiting Review"
      : todo.status === "Graded"
        ? "Reviewed"
        : ds === "overdue"
          ? "Overdue"
          : ds === "urgent"
            ? "Due Soon"
            : ds === "soon"
              ? "Upcoming"
              : "On Track";
  const contextTone =
    todo.status === "Submitted"
      ? "submitted"
      : todo.status === "Graded"
        ? "graded"
        : ds === "overdue"
          ? "overdue"
          : ds === "urgent"
            ? "urgent"
            : ds === "soon"
              ? "soon"
              : "ok";
  const summaryTitle = todo.learningSummary ? "Learning Summary" : "Review Note";
  const summaryText = todo.learningSummary || todo.gradeFeedback || "";

  return (
    <div
      className={`todo-card ${
        ds === "overdue" ? "overdue" : ds === "urgent" ? "urgent" : ""
      } ${todo.status === "Graded" ? "done" : ""} ${
        todo.status === "Submitted" ? "submitted" : ""
      } ${highlighted ? "todo-card-highlighted" : ""}`}
    >
      <div className="card-top">
        <div className="card-context-row">
          <span className={`card-context-pill card-context-${contextTone}`}>
            {contextLabel}
          </span>
          {todo.grade && <GradeChip grade={todo.grade} />}
        </div>
        <div className="card-actions">
          <button
            type="button"
            className="card-action-btn"
            onClick={() => onEdit(todo)}
            title="Edit task"
          >
            Edit
          </button>
          <button
            type="button"
            className="card-action-btn card-action-btn-danger"
            onClick={() => onDelete(todo)}
            title="Delete task"
          >
            Delete
          </button>
        </div>
      </div>

      <div className={`card-title ${todo.status === "Graded" ? "done-text" : ""}`}>
        {todo.title}
      </div>

      {todo.description && (
        <div className="card-desc">
          {todo.description.slice(0, 110)}
          {todo.description.length > 110 ? "..." : ""}
        </div>
      )}

      {todo.deadline && (
        <div className={`card-deadline-block card-deadline-${contextTone}`}>
          <span className="card-deadline-label">Deadline</span>
          <strong>{formatDateTime(todo.deadline)}</strong>
          <span>{timeLeft(todo.deadline)}</span>
        </div>
      )}

      <div className="card-meta">
        <span className="badge badge-cat">{todo.category}</span>
        <PriBadge p={todo.priority} />
        {!todo.deadline && <span className="badge badge-soft">No deadline</span>}
      </div>

      {summaryText && (
        <div className="card-summary">
          <div className="card-summary-label">{summaryTitle}</div>
          {summaryText.slice(0, 130)}
          {summaryText.length > 130 ? "..." : ""}
          {todo.learningSummary && todo.gradeFeedback && (
            <div className="grade-feedback-italic">
              Feedback: {todo.gradeFeedback.slice(0, 120)}
              {todo.gradeFeedback.length > 120 ? "..." : ""}
            </div>
          )}
        </div>
      )}

      {ep > 0 && (
        <div className="progress-wrap">
          <div className="progress-label">
            <span>Progress</span>
            <span>
              {ep}%{isGraded ? " (graded)" : ""}
            </span>
          </div>
          <div className="progress-bar">
            <div
              className={`progress-fill ${isGraded ? "graded" : ""}`}
              style={{ width: `${ep}%` }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
