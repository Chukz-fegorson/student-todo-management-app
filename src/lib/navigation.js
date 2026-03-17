export const NAVIGATION_EVENT = "studyflow:navigate";

function stampRoute(route) {
  return {
    module: route?.module || "",
    tab: route?.tab || "",
    action: route?.action || "",
    entityType: route?.entityType || "",
    entityId: route?.entityId || "",
    meta: route?.meta || {},
    ts: Date.now(),
  };
}

export function createNavigationIntent(route = {}) {
  return stampRoute(route);
}

export function navigateToRoute(route = {}) {
  const next = stampRoute(route);
  window.dispatchEvent(
    new CustomEvent(NAVIGATION_EVENT, {
      detail: next,
    })
  );
  return next;
}

export function routeFromNotification(notification) {
  const entityType = String(notification?.entityType || "").toLowerCase();
  const entityId = String(notification?.entityId || "");

  switch (entityType) {
    case "task":
      return createNavigationIntent({
        module: "tasks",
        entityType,
        entityId,
      });
    case "course":
    case "assessment":
      return createNavigationIntent({
        module: "courses",
        entityType,
        entityId,
      });
    case "meeting":
      return createNavigationIntent({
        module: "collab",
        tab: "meetings",
        entityType,
        entityId,
      });
    case "action_items":
      return createNavigationIntent({
        module: "collab",
        tab: "meetings",
        entityType,
        entityId,
      });
    case "chat":
      return createNavigationIntent({
        module: "collab",
        tab: "chat",
        entityType,
        entityId,
      });
    case "fee_invoice":
    case "fee_payment":
    case "invoice":
    case "payment":
      return createNavigationIntent({
        module: "fees",
        entityType,
        entityId,
      });
    case "student_parent_review":
      return createNavigationIntent({
        module: "tasks",
        action: "open_parent_reviews",
        entityType,
        entityId,
      });
    case "market_product":
      return createNavigationIntent({
        module: "market",
        entityType,
        entityId,
      });
    case "market_order":
    case "market_dispute":
    case "order":
      return createNavigationIntent({
        module: "market",
        action: "orders",
        entityType,
        entityId,
        meta: { view: "orders" },
      });
    default:
      return null;
  }
}
