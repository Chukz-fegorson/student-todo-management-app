export default function DeleteModal({ todo, onConfirm, onClose }) {
  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 380 }}>
        <div className="modal-title">Delete Task?</div>
        <p style={{ color: "var(--muted)", fontSize: "0.9rem", lineHeight: 1.5 }}>
          Delete <strong style={{ color: "var(--text)" }}>"{todo.title}"</strong>?
        </p>
        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-danger" onClick={onConfirm}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}
