import assert from "node:assert/strict";
import test from "node:test";

import parentRoutesModule from "../server/domains/parents/routes.js";
import {
  ROLE,
  createStaticAuth,
  createTestApp,
  requireRole,
  requestIp,
  withServer,
} from "./serverRouteHarness.js";

const { registerParentRoutes } = parentRoutesModule;

function createParentFixture() {
  const service = {
    async getParentLinkCode() {
      return { status: 200, body: { code: "PARENT42" } };
    },
    async linkChild(actor, input) {
      return {
        status: 201,
        body: { linkedBy: actor.id, studentCode: input.linkCode },
      };
    },
    async listChildren() {
      return { status: 200, body: [] };
    },
    async listStudentReviews(_actor, studentId) {
      return { status: 200, body: [{ studentId }] };
    },
    async regenerateParentLinkCode() {
      return { status: 200, body: { code: "NEWCODE" } };
    },
    async upsertStudentReview(_actor, studentId, input) {
      return {
        status: 201,
        body: { reviewText: input.reviewText, studentId },
      };
    },
  };
  const validators = {
    parseLinkChildBody: (body) => body,
    parseParentReviewBody: (body) => body,
    parseStudentIdParam: ({ id }) => ({ studentId: id }),
  };

  return { service, validators };
}

test("parent routes link children and upsert parent reviews over HTTP", async () => {
  const app = createTestApp();
  const { service, validators } = createParentFixture();

  registerParentRoutes({
    app,
    auth: createStaticAuth({ id: "parent-1", role: ROLE.PARENT }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
    requestIp,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const linkResponse = await request("/parent/children/link", {
      body: { linkCode: "STUDENT42" },
      method: "POST",
    });
    assert.equal(linkResponse.status, 201);
    assert.deepEqual(linkResponse.body, {
      linkedBy: "parent-1",
      studentCode: "STUDENT42",
    });

    const reviewResponse = await request("/students/student-9/parent-reviews", {
      body: { rating: 5, reviewText: "Excellent effort" },
      method: "POST",
    });
    assert.equal(reviewResponse.status, 201);
    assert.deepEqual(reviewResponse.body, {
      reviewText: "Excellent effort",
      studentId: "student-9",
    });
  });
});

test("parent routes reject child linking for non-parent actors", async () => {
  const app = createTestApp();
  const { service, validators } = createParentFixture();

  registerParentRoutes({
    app,
    auth: createStaticAuth({ id: "student-1", role: ROLE.STUDENT }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
    requestIp,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const response = await request("/parent/children/link", {
      body: { linkCode: "STUDENT42" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Forbidden for this role" });
  });
});
