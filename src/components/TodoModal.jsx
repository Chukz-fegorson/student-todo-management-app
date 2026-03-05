import { useMemo, useState } from "react";
import {
  CATEGORIES,
  DEFAULT_REMINDER_OFFSETS,
  EDITABLE_STATUSES,
  PRIORITIES,
} from "../lib/constants";
import {
  normalizeReminderOffsets,
  toDateTimeLocalValue,
  toIsoFromDateTimeLocal,
} from "../lib/helpers";
import GradeChip from "./GradeChip";

export default function TodoModal({ todo, onSave, onClose }) {
  const initial = useMemo(
    () => ({
      title: todo?.title || "",
      description: todo?.description || "",
      category: todo?.category || "Assignment",
      priority: todo?.priority || "Medium",
      status: EDITABLE_STATUSES.includes(todo?.status) ? todo.status : "Todo",
      deadline: toDateTimeLocalValue(todo?.deadline),
      progress: Number.isFinite(Number(todo?.progress)) ? Number(todo.progress) : 0,
      learningSummary: todo?.learningSummary || "",
      reminderOffsets: normalizeReminderOffsets(
        todo?.reminderOffsets || DEFAULT_REMINDER_OFFSETS
      ),
    }),
    [todo]
  );

  const [form, setForm] = useState(initial);
  const [error, setError] = useState("");

  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function save() {
    if (todo?.status === "Graded") {
      setError("Graded tasks are locked and cannot be edited.");
      return;
    }

    const title = form.title.trim();
    if (!title) {
      setError("Title is required.");
      return;
    }

    const status = form.status;
    const learningSummary = form.learningSummary.trim();
    if (status === "Submitted" && !learningSummary) {
      setError("Learning Summary is required before submitting.");
      return;
    }

    const payload = {
      title,
      description: form.description.trim(),
      category: form.category,
      priority: form.priority,
      status,
      deadline: toIsoFromDateTimeLocal(form.deadline),
      progress: status === "Submitted" ? 100 : Number(form.progress),
      learningSummary,
      reminderOffsets: normalizeReminderOffsets(form.reminderOffsets),
    };

    onSave(payload);
  }

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal">
        <div className="modal-title">{todo ? "Edit Task" : "New Task"}</div>
        {error && <div className="error-msg">{error}</div>}

        <div className="field">
          <label>Task Title *</label>
          <input
            value={form.title}
            onChange={(event) => set("title", event.target.value)}
            autoFocus
          />
        </div>

        <div className="field">
          <label>Description</label>
          <textarea
            value={form.description}
            onChange={(event) => set("description", event.target.value)}
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="field">
            <label>Category</label>
            <select
              value={form.category}
              onChange={(event) => set("category", event.target.value)}
            >
              {CATEGORIES.map((category) => (
                <option key={category}>{category}</option>
              ))}
            </select>
          </div>

          <div className="field">
            <label>Priority</label>
            <select
              value={form.priority}
              onChange={(event) => set("priority", event.target.value)}
            >
              {PRIORITIES.map((priority) => (
                <option key={priority}>{priority}</option>
              ))}
            </select>
          </div>
        </div>

        <div className="field">
          <label>Deadline</label>
          <input
            type="datetime-local"
            value={form.deadline}
            onChange={(event) => set("deadline", event.target.value)}
          />
        </div>

        <div className="field">
          <label>Status</label>
          <div className="status-selector">
            {EDITABLE_STATUSES.map((status) => (
              <button
                key={status}
                type="button"
                className={`status-btn ${
                  form.status === status
                    ? status === "Todo"
                      ? "active-todo"
                      : status === "In Progress"
                      ? "active-inprogress"
                      : "active-submitted"
                    : ""
                }`}
                onClick={() => {
                  setError("");
                  set("status", status);
                  if (status === "Submitted") set("progress", 100);
                }}
              >
                {status}
              </button>
            ))}
          </div>
        </div>

        <div className="field">
          <label>Progress - {form.progress}%</label>
          <input
            type="range"
            min="0"
            max="100"
            value={form.progress}
            onChange={(event) => set("progress", Number(event.target.value))}
            disabled={form.status === "Submitted"}
          />
        </div>

        <div className="field">
          <label>Reminder Offsets</label>
          <div className="check-row">
            {[30, 10, 5].map((minutes) => (
              <label key={minutes} className="check-item">
                <input
                  type="checkbox"
                  checked={form.reminderOffsets.includes(minutes)}
                  onChange={() =>
                    set(
                      "reminderOffsets",
                      normalizeReminderOffsets(
                        form.reminderOffsets.includes(minutes)
                          ? form.reminderOffsets.filter((entry) => entry !== minutes)
                          : [...form.reminderOffsets, minutes]
                      )
                    )
                  }
                />
                {minutes}m
              </label>
            ))}
          </div>
        </div>

        <div className="modal-section">
          <div className="modal-section-title">Learning Summary</div>
          <div className="field">
            <label>What did you learn?</label>
            <textarea
              value={form.learningSummary}
              onChange={(event) => set("learningSummary", event.target.value)}
              style={{ minHeight: "110px" }}
            />
          </div>

          {todo?.grade && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                gap: "0.75rem",
                padding: "0.75rem",
                background: "var(--surface2)",
                borderRadius: "10px",
              }}
            >
              <GradeChip grade={todo.grade} />
              <div>
                <div style={{ fontSize: "0.8rem", color: "var(--muted)" }}>
                  Grade from school
                </div>
                {todo.gradeFeedback && (
                  <div
                    style={{
                      color: "var(--text)",
                      fontSize: "0.85rem",
                      marginTop: "0.2rem",
                    }}
                  >
                    {todo.gradeFeedback}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="modal-actions">
          <button className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button className="btn btn-primary" onClick={save}>
            Save Task
          </button>
        </div>
      </div>
    </div>
  );
}