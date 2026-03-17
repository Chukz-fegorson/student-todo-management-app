import assert from "node:assert/strict";
import test from "node:test";

import { buildNotificationSummary } from "../src/lib/notificationSummary.js";

test("buildNotificationSummary groups unread notifications by module", () => {
  const summary = buildNotificationSummary([
    { entityType: "task", isRead: false },
    { entityType: "student_parent_review", isRead: false },
    { entityType: "course", isRead: false },
    { entityType: "meeting", isRead: false },
    { entityType: "fee_payment", isRead: false },
    { entityType: "market_product", isRead: false },
    { entityType: "market_order", isRead: false },
    { entityType: "market_dispute", isRead: false },
    { entityType: "system", isRead: false },
    { entityType: "task", isRead: true },
  ]);

  assert.equal(summary.unreadCount, 9);
  assert.deepEqual(summary.byModule, {
    tasks: 2,
    courses: 1,
    collab: 1,
    fees: 1,
    market: 3,
    other: 1,
  });
});
