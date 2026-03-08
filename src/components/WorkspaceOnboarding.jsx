import { useMemo, useState } from "react";
import { storageGet, storageSet } from "../lib/storage";

function dismissalKey(userId, workspaceKey) {
  return `onboarding_dismissed_${workspaceKey}_${userId}`;
}

export default function WorkspaceOnboarding({
  user,
  workspaceKey,
  title,
  description,
  items = [],
}) {
  const [dismissed, setDismissed] = useState(() =>
    Boolean(storageGet(dismissalKey(user?.id, workspaceKey), false))
  );

  const pendingItems = useMemo(
    () => items.filter((entry) => !entry.done),
    [items]
  );

  if (!user?.id || dismissed || !pendingItems.length) return null;

  return (
    <section className="onboarding-card">
      <div className="onboarding-head">
        <div>
          <div className="panel-kicker">Getting Started</div>
          <div className="panel-title">{title}</div>
          <div className="panel-copy">{description}</div>
        </div>
        <button
          type="button"
          className="btn btn-ghost btn-sm"
          onClick={() => {
            storageSet(dismissalKey(user.id, workspaceKey), true);
            setDismissed(true);
          }}
        >
          Dismiss
        </button>
      </div>

      <div className="onboarding-list">
        {items.map((entry) => (
          <article
            key={entry.id}
            className={`onboarding-item ${entry.done ? "done" : ""}`}
          >
            <div className="onboarding-status">
              {entry.done ? "Done" : "Next"}
            </div>
            <div className="onboarding-copy">
              <strong>{entry.title}</strong>
              <p>{entry.description}</p>
            </div>
            {!entry.done && entry.onAction && (
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={entry.onAction}
              >
                {entry.actionLabel || "Open"}
              </button>
            )}
          </article>
        ))}
      </div>
    </section>
  );
}

