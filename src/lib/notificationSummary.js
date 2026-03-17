export function buildNotificationSummary(notifications = []) {
  const rows = Array.isArray(notifications) ? notifications : [];
  const unreadRows = rows.filter((entry) => !entry.isRead);

  const byModule = {
    tasks: 0,
    courses: 0,
    collab: 0,
    fees: 0,
    market: 0,
    other: 0,
  };

  unreadRows.forEach((entry) => {
    const entityType = String(entry?.entityType || "").toLowerCase();

    if (entityType === "task" || entityType === "student_parent_review") {
      byModule.tasks += 1;
      return;
    }
    if (entityType === "course" || entityType === "assessment") {
      byModule.courses += 1;
      return;
    }
    if (entityType === "meeting" || entityType === "chat" || entityType === "action_items") {
      byModule.collab += 1;
      return;
    }
    if (
      entityType === "fee" ||
      entityType === "invoice" ||
      entityType === "payment" ||
      entityType === "fee_invoice" ||
      entityType === "fee_payment"
    ) {
      byModule.fees += 1;
      return;
    }
    if (
      entityType === "market" ||
      entityType === "market_product" ||
      entityType === "market_order" ||
      entityType === "market_dispute" ||
      entityType === "order"
    ) {
      byModule.market += 1;
      return;
    }
    byModule.other += 1;
  });

  return {
    unreadCount: unreadRows.length,
    byModule,
  };
}
