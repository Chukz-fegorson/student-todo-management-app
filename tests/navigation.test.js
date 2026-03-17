import assert from "node:assert/strict";
import test from "node:test";

import { routeFromNotification } from "../src/lib/navigation.js";

test("routeFromNotification maps fees and parent review notifications", () => {
  const feeRoute = routeFromNotification({
    entityType: "fee_payment",
    entityId: "payment-1",
  });
  const reviewRoute = routeFromNotification({
    entityType: "student_parent_review",
    entityId: "review-1",
  });

  assert.equal(feeRoute.module, "fees");
  assert.equal(feeRoute.entityId, "payment-1");
  assert.equal(reviewRoute.module, "tasks");
  assert.equal(reviewRoute.action, "open_parent_reviews");
});

test("routeFromNotification maps marketplace listing and order notifications", () => {
  const listingRoute = routeFromNotification({
    entityType: "market_product",
    entityId: "product-1",
  });
  const orderRoute = routeFromNotification({
    entityType: "market_order",
    entityId: "order-1",
  });
  const disputeRoute = routeFromNotification({
    entityType: "market_dispute",
    entityId: "dispute-1",
  });

  assert.equal(listingRoute.module, "market");
  assert.equal(listingRoute.entityId, "product-1");
  assert.equal(orderRoute.module, "market");
  assert.equal(orderRoute.action, "orders");
  assert.equal(orderRoute.meta.view, "orders");
  assert.equal(disputeRoute.module, "market");
  assert.equal(disputeRoute.action, "orders");
});

test("routeFromNotification returns null for unsupported notifications", () => {
  assert.equal(routeFromNotification({ entityType: "unknown", entityId: "x" }), null);
});
