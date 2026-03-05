import PriBadge from "./PriBadge";
import GradeChip from "./GradeChip";
import {
  deadlineStatus,
  effectiveProgress,
  formatDateTime,
  gradeToScore,
  timeLeft,
} from "../lib/helpers";

export default function TodoCard({ todo, onEdit, onDelete }) {
  const ds = deadlineStatus(todo.deadline);
  const ep = effectiveProgress(todo);
  const isGraded = gradeToScore(todo.grade) !== null;

  return (
    <div
      className={`todo-card ${
        ds === "overdue" ? "overdue" : ds === "urgent" ? "urgent" : ""
      } ${todo.status === "Graded" ? "done" : ""} ${
        todo.status === "Submitted" ? "submitted" : ""
      }`}
    >
      <div className="card-top">
        <span className={`card-title ${todo.status === "Graded" ? "done-text" : ""}`}>
          {todo.title}
        </span>
        <div className="card-actions">
          <button
            type="button"
            className="btn-icon"
            onClick={() => onEdit(todo)}
            title="Edit task"
          >
            Edit
          </button>
          <button
            type="button"
            className="btn-icon"
            onClick={() => onDelete(todo)}
            title="Delete task"
          >
            Delete
          </button>
        </div>
      </div>

      {todo.description && (
        <div className="card-desc">
          {todo.description.slice(0, 120)}
          {todo.description.length > 120 ? "..." : ""}
        </div>
      )}

      <div className="card-meta">
        <span className="badge badge-cat">{todo.category}</span>
        <PriBadge p={todo.priority} />
        {todo.status === "Submitted" && (
          <span className="badge badge-submitted">Submitted</span>
        )}
        {todo.status === "Graded" && <span className="badge badge-submitted">Graded</span>}
        {todo.deadline && (
          <span className={`badge badge-deadline ${ds}`}>
            {formatDateTime(todo.deadline)} | {timeLeft(todo.deadline)}
          </span>
        )}
        {todo.grade && <GradeChip grade={todo.grade} />}
      </div>

      {todo.learningSummary && (
        <div className="card-summary">
          <div className="card-summary-label">Learning Summary</div>
          {todo.learningSummary.slice(0, 130)}
          {todo.learningSummary.length > 130 ? "..." : ""}
          {todo.gradeFeedback && (
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