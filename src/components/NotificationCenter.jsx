import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { formatDateTime } from "../lib/helpers";

export default function NotificationCenter() {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [rows, setRows] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [error, setError] = useState("");

  async function loadNotifications() {
    try {
      setLoading(true);
      setError("");
      const data = await apiGet("/notifications?limit=80");
      const notifications = Array.isArray(data?.notifications)
        ? data.notifications
        : [];
      setRows(notifications);
      setUnreadCount(Number(data?.unreadCount || 0));
    } catch (err) {
      setError(err.message || "Failed to load notifications");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadNotifications();
    const timer = window.setInterval(loadNotifications, 20000);
    return () => window.clearInterval(timer);
  }, []);

  const unreadRows = useMemo(
    () => rows.filter((entry) => !entry.isRead),
    [rows]
  );

  async function markOneRead(id) {
    if (!id) return;
    try {
      await apiPost(`/notifications/${id}/read`, {});
      setRows((prev) =>
        prev.map((entry) =>
          entry.id === id
            ? { ...entry, isRead: true, readAt: entry.readAt || new Date().toISOString() }
            : entry
        )
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (err) {
      setError(err.message || "Failed to mark notification as read");
    }
  }

  async function markAllRead() {
    try {
      setBusy(true);
      await apiPost("/notifications/read-all", {});
      setRows((prev) =>
        prev.map((entry) =>
          entry.isRead
            ? entry
            : { ...entry, isRead: true, readAt: new Date().toISOString() }
        )
      );
      setUnreadCount(0);
    } catch (err) {
      setError(err.message || "Failed to mark all notifications as read");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="notif-center">
      <button
        type="button"
        className="btn btn-ghost btn-sm notif-bell"
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) loadNotifications();
        }}
      >
        Notifications
        {unreadCount > 0 && <span className="notif-badge">{unreadCount}</span>}
      </button>

      {open && (
        <div className="notif-popover">
          <div className="notif-popover-head">
            <strong>Notifications</strong>
            <div className="panel-actions">
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={loadNotifications}
                disabled={loading || busy}
              >
                Refresh
              </button>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={markAllRead}
                disabled={!unreadRows.length || busy}
              >
                Mark all read
              </button>
            </div>
          </div>

          {error && <div className="error-msg">{error}</div>}
          {loading && <div className="empty-col">Loading notifications...</div>}
          {!loading && !rows.length && (
            <div className="empty-col">No notifications yet.</div>
          )}

          {!loading && rows.length > 0 && (
            <div className="notif-list">
              {rows.map((entry) => (
                <button
                  type="button"
                  key={entry.id}
                  className={`notif-item ${entry.isRead ? "read" : "unread"}`}
                  onClick={() => markOneRead(entry.id)}
                >
                  <div className="notif-item-head">
                    <strong>{entry.title || "Activity update"}</strong>
                    <small>{formatDateTime(entry.createdAt)}</small>
                  </div>
                  <div className="notif-item-body">
                    {entry.body || "New activity was recorded."}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
