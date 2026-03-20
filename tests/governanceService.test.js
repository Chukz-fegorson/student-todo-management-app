import assert from "node:assert/strict";
import test from "node:test";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { createGovernanceService } = require("../server/domains/governance/service.js");

const MS_PER_DAY = 24 * 60 * 60 * 1000;
const FIXED_NOW = new Date("2026-03-20T12:00:00.000Z").getTime();
const NOW_ISO = new Date(FIXED_NOW).toISOString();
const CURRENT_WINDOW_START = new Date(FIXED_NOW - 30 * MS_PER_DAY).toISOString();

function createService(options = {}) {
  return createGovernanceService({
    computeEffectiveProgress: options.computeEffectiveProgress || ((progress, grade) => {
      const base = Number(progress) || 0;
      return grade ? Math.min(100, base + 20) : base;
    }),
    fetchTasksByStudentIds: options.fetchTasksByStudentIds || (async () => []),
    listScopedStudents: options.listScopedStudents || (async () => []),
    now: () => FIXED_NOW,
    repo: {
      fetchDisputeMetrics: async () => ({}),
      fetchFeeMetrics: async () => ({}),
      fetchMarketMetrics: async () => ({}),
      listAuditEvents: async () => [],
      listScopedSchools: async () => [],
      ...(options.repo || {}),
    },
  });
}

test("governance service builds school-level intelligence alerts and trends", async () => {
  const students = [
    {
      id: "student-1",
      lga_name: "Ikeja",
      name: "Ada Student",
      school_id: "school-1",
      school_name: "Alpha Academy",
      state_name: "Lagos",
    },
    {
      id: "student-2",
      lga_name: "Ikeja",
      name: "Bola Student",
      school_id: "school-1",
      school_name: "Alpha Academy",
      state_name: "Lagos",
    },
  ];
  const tasks = [
    {
      created_at: "2026-03-18T09:00:00.000Z",
      deadline: "2026-03-18T10:00:00.000Z",
      grade: null,
      graded_at: null,
      progress: 25,
      status: "Submitted",
      student_id: "student-1",
      student_school_id: "school-1",
      updated_at: "2026-03-19T11:00:00.000Z",
    },
  ];

  const service = createService({
    fetchTasksByStudentIds: async () => tasks,
    listScopedStudents: async () => students,
    repo: {
      fetchDisputeMetrics: async ({ windowStart }) =>
        windowStart === CURRENT_WINDOW_START
          ? { open_disputes: 2, total_disputes: 2 }
          : { open_disputes: 0, total_disputes: 0 },
      fetchFeeMetrics: async ({ windowStart }) =>
        windowStart === CURRENT_WINDOW_START
          ? { invoices_issued: 6, invoices_paid: 2 }
          : { invoices_issued: 5, invoices_paid: 4 },
      fetchMarketMetrics: async ({ windowStart }) =>
        windowStart === CURRENT_WINDOW_START
          ? { orders_completed: 1, orders_total: 4 }
          : { orders_completed: 3, orders_total: 4 },
      listScopedSchools: async () => [
        {
          id: "school-1",
          lga_name: "Ikeja",
          name: "Alpha Academy",
          state_name: "Lagos",
        },
      ],
    },
  });

  const result = await service.getIntelligence(
    { id: "school-user-1", role: "school", school_id: "school-1" },
    { days: 30 }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.generatedAt, NOW_ISO);
  assert.equal(result.body.summary.overdueTasks, 1);
  assert.equal(result.body.summary.studentsWithoutTasks, 1);
  assert.equal(result.body.trends.length, 5);
  assert.deepEqual(
    result.body.trends.map((entry) => entry.id),
    [
      "tasks-assigned",
      "tasks-reviewed",
      "fee-paid-rate",
      "market-completion-rate",
      "new-disputes",
    ]
  );
  assert.equal(
    result.body.alerts.some((entry) => entry.id === "overdue-tasks"),
    true
  );
  assert.equal(
    result.body.alerts.some((entry) => entry.id === "fee-collection-risk"),
    true
  );
  assert.equal(result.body.interventionQueue[0].scopeType, "student");
  assert.equal(result.body.interventionQueue[0].studentName, "Ada Student");
  assert.equal(result.body.interventionQueue[0].riskLevel, "elevated");
});

test("governance service builds school drill-down queues for state actors", async () => {
  const students = [
    {
      id: "student-1",
      lga_name: "Ikeja",
      name: "Ada Student",
      school_id: "school-1",
      school_name: "Alpha Academy",
      state_name: "Lagos",
    },
    {
      id: "student-2",
      lga_name: "Ikeja",
      name: "Bola Student",
      school_id: "school-1",
      school_name: "Alpha Academy",
      state_name: "Lagos",
    },
    {
      id: "student-3",
      lga_name: "Epe",
      name: "Caro Student",
      school_id: "school-2",
      school_name: "Beta College",
      state_name: "Lagos",
    },
  ];
  const tasks = [
    {
      created_at: "2026-03-12T09:00:00.000Z",
      deadline: "2026-03-13T09:00:00.000Z",
      grade: null,
      graded_at: null,
      progress: 20,
      status: "Submitted",
      student_id: "student-1",
      student_school_id: "school-1",
      updated_at: "2026-03-14T09:00:00.000Z",
    },
  ];

  const service = createService({
    fetchTasksByStudentIds: async () => tasks,
    listScopedStudents: async () => students,
    repo: {
      fetchDisputeMetrics: async () => ({ open_disputes: 0, total_disputes: 0 }),
      fetchFeeMetrics: async () => ({ invoices_issued: 0, invoices_paid: 0 }),
      fetchMarketMetrics: async () => ({ orders_completed: 0, orders_total: 0 }),
      listScopedSchools: async () => [
        {
          id: "school-1",
          lga_name: "Ikeja",
          name: "Alpha Academy",
          state_name: "Lagos",
        },
        {
          id: "school-2",
          lga_name: "Epe",
          name: "Beta College",
          state_name: "Lagos",
        },
      ],
    },
  });

  const result = await service.getIntelligence(
    { id: "state-user-1", role: "state", state_name: "Lagos" },
    { days: 30 }
  );

  assert.equal(result.status, 200);
  assert.equal(result.body.interventionQueue[0].scopeType, "school");
  assert.equal(result.body.interventionQueue[0].schoolName, "Alpha Academy");
  assert.equal(result.body.interventionQueue[0].riskLevel, "elevated");
  assert.equal(result.body.interventionQueue[1].schoolName, "Beta College");
});
