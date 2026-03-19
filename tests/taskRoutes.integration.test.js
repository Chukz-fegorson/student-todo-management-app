import assert from "node:assert/strict";
import test from "node:test";

import taskRoutesModule from "../server/domains/learning/tasks/routes.js";
import {
  ROLE,
  createStaticAuth,
  createTestApp,
  requireRole,
  requestIp,
  withServer,
} from "./serverRouteHarness.js";

const { registerTaskRoutes } = taskRoutesModule;

function createTaskFixture() {
  const service = {
    async createTasks(actor, input) {
      return {
        status: 201,
        body: { createdBy: actor.id, title: input.title },
      };
    },
    async deleteTask() {
      return { status: 204, body: null };
    },
    async gradeTask(actor, taskId, input) {
      return {
        status: 200,
        body: { grade: input.grade, gradedBy: actor.id, taskId },
      };
    },
    async listTasks() {
      return { status: 200, body: [] };
    },
    async updateTask() {
      return { status: 200, body: { ok: true } };
    },
  };
  const validators = {
    parseCreateTaskBody: (body) => body,
    parseGradeTaskBody: (body) => body,
    parseTaskIdParam: ({ id }) => ({ taskId: id }),
    parseTaskListQuery: (query) => query,
    parseUpdateTaskBody: (body) => body,
  };

  return { service, validators };
}

test("task routes create tasks and allow grading for privileged roles", async () => {
  const app = createTestApp();
  const { service, validators } = createTaskFixture();

  registerTaskRoutes({
    app,
    auth: createStaticAuth({ id: "school-1", role: ROLE.SCHOOL }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
    requestIp,
    service,
    validators,
  });

  await withServer(app, async ({ request }) => {
    const createResponse = await request("/tasks", {
      body: { title: "Read chapter 4" },
      method: "POST",
    });
    assert.equal(createResponse.status, 201);
    assert.deepEqual(createResponse.body, {
      createdBy: "school-1",
      title: "Read chapter 4",
    });

    const gradeResponse = await request("/tasks/task-99/grade", {
      body: { grade: "A" },
      method: "POST",
    });
    assert.equal(gradeResponse.status, 200);
    assert.deepEqual(gradeResponse.body, {
      grade: "A",
      gradedBy: "school-1",
      taskId: "task-99",
    });
  });
});

test("task routes block grading for student actors", async () => {
  const app = createTestApp();
  const { service, validators } = createTaskFixture();

  registerTaskRoutes({
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
    const response = await request("/tasks/task-1/grade", {
      body: { grade: "B" },
      method: "POST",
    });
    assert.equal(response.status, 403);
    assert.deepEqual(response.body, { error: "Forbidden for this role" });
  });
});
