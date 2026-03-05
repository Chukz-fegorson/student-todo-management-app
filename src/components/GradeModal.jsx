import { useState } from "react";
import { GRADES } from "../lib/constants";
import { gradeColor } from "../lib/helpers";

export default function GradeModal({ todo, studentName, onSave, onClose }) {
  const [grade, setGrade] = useState(todo.grade || "");
  const [feedback, setFeedback] = useState(todo.gradeFeedback || "");

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 500 }}>
        <div className="modal-title">
          Grade Submission{studentName ? `: ${studentName}` : ""}
        </div>

        <div className="field">
          <label>Student Learning Summary</label>
          {todo.learningSummary ? (
            <div className="review-summary-box">{todo.learningSummary}</div>
          ) : (
            <div className="review-summary-box review-summary-empty">
              No learning summary submitted yet.
            </div>
          )}
        </div>

        <div className="field">
          <label>Assign Grade</label>
          <div className="grade-selector">
            {GRADES.map((entry) => {
              const color = gradeColor(entry);
              return (
                <button
                  key={entry}
                  type="button"
                  className={`grade-btn ${grade === entry ? "selected" : ""}`}
                  style={grade === entry ? { background: color, borderColor: color } : {}}
                  onClick={() => setGrade((prev) => (prev === entry ? "" : entry))}
                >
                  {entry}
                </button>
              );
            })}
          </div>
        </div>

        <div className="field">
          <label>Feedback to Student</label>
          <textarea
            value={feedback}
            onChange={(event) => setFeedback(event.target.value)}
            style={{ minHeight: "95px" }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-purple"
            onClick={() =>
              onSave({ grade, gradeFeedback: feedback.trim() })
            }
            disabled={!grade}
          >
            Save Grade
          </button>
        </div>
      </div>
    </div>
  );
}
