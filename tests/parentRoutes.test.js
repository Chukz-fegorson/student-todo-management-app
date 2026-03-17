import assert from "node:assert/strict";
import test from "node:test";

import parentRoutesModule from "../server/parentRoutes.js";

const { buildParentChildSummaries, mapParentReviewRows } = parentRoutesModule;

test("buildParentChildSummaries calculates parent-facing task metrics", () => {
  const payload = buildParentChildSummaries({
    linkedRows: [
      {
        id: "student-1",
        name: "Ada",
        email: "ada@example.com",
        role: "student",
        date_of_birth: "2011-04-05",
        relationship_label: "Mother",
        linked_at: "2026-03-10T10:00:00.000Z",
      },
    ],
    tasks: [
      { student_id: "student-1", status: "Submitted", progress: 100, grade: null },
      { student_id: "student-1", status: "Graded", progress: 80, grade: "A" },
    ],
    mapUser: (row) => ({ id: row.id, name: row.name, email: row.email, role: row.role }),
    computeAgeFromDob: () => 14,
    isUnder18Dob: () => true,
    canonicalStatus: (status) => status,
    computeEffectiveProgress: (progress, grade) => (grade ? 89 : Number(progress)),
    STATUS: { SUBMITTED: "Submitted" },
  });

  assert.equal(payload.length, 1);
  assert.deepEqual(payload[0], {
    id: "student-1",
    name: "Ada",
    email: "ada@example.com",
    role: "student",
    relationshipLabel: "Mother",
    linkedAt: "2026-03-10T10:00:00.000Z",
    age: 14,
    under18: true,
    totalTasks: 2,
    submittedTasks: 1,
    gradedTasks: 1,
    avgEffectiveProgress: 95,
  });
});

test("mapParentReviewRows normalizes review payloads for the API", () => {
  const mapped = mapParentReviewRows([
    {
      id: "review-1",
      parent_user_id: "parent-1",
      parent_name: "Mrs. Okafor",
      student_user_id: "student-1",
      rating: "5",
      review_text: "Strong improvement this week.",
      created_at: "2026-03-10T09:00:00.000Z",
      updated_at: "2026-03-10T10:00:00.000Z",
    },
  ]);

  assert.deepEqual(mapped, [
    {
      id: "review-1",
      parentUserId: "parent-1",
      parentName: "Mrs. Okafor",
      studentUserId: "student-1",
      rating: 5,
      reviewText: "Strong improvement this week.",
      createdAt: "2026-03-10T09:00:00.000Z",
      updatedAt: "2026-03-10T10:00:00.000Z",
    },
  ]);
});
