import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { exportTasksToCalendar } from "../lib/calendar";
import {
  CATEGORIES,
  DEFAULT_REMINDER_OFFSETS,
  EDITABLE_STATUSES,
  PRIORITIES,
  ROLE_LABELS,
  STATUSES,
} from "../lib/constants";
import {
  effectiveProgress,
  formatDateTime,
  groupBy,
  normalizeReminderOffsets,
} from "../lib/helpers";

import PriBadge from "../components/PriBadge";
import GradeChip from "../components/GradeChip";
import GradeModal from "../components/GradeModal";
import FeesWorkspace from "../components/FeesWorkspace";
import MarketplaceWorkspace from "../components/MarketplaceWorkspace";
import CollaborationHubModal from "../components/CollaborationHubModal";
import CoursesWorkspace from "../components/CoursesWorkspace";
import WorkspaceOnboarding from "../components/WorkspaceOnboarding";

// Default shape for "assign task" form.
const assignmentDefaults = {
  title: "",
  description: "",
  category: "Assignment",
  priority: "Medium",
  status: "Todo",
  deadline: "",
  progress: 0,
  learningSummary: "",
  reminderOffsets: DEFAULT_REMINDER_OFFSETS,
};

const SCHOOL_MODULE_META = {
  tasks: {
    kicker: "Tasks",
    title: "Assignment and Review Workspace",
    description:
      "Assign work, filter your scope, review submissions, and monitor education activity from one control surface.",
  },
  courses: {
    kicker: "Courses",
    title: "Course Delivery",
    description:
      "Create and manage courses, assessments, bundles, and CGPA-linked academic structure in one module.",
  },
  collab: {
    kicker: "Collab Hub",
    title: "Communication and Meetings",
    description:
      "Run meetings, direct chat, community communication, broadcasts, and transcript-driven follow-up from one place.",
  },
  fees: {
    kicker: "Fees",
    title: "Fees and Confirmation",
    description:
      "Track payment evidence, confirm incoming fees, and issue receipts with a cleaner operational flow.",
  },
  market: {
    kicker: "Marketplace",
    title: "School and Student Commerce",
    description:
      "Operate school listings, oversee student commerce, and monitor trust and transaction completion in one space.",
  },
};

function toggleId(arr, id) {
  // Tiny helper: select/unselect student IDs.
  return arr.includes(id) ? arr.filter((entry) => entry !== id) : [...arr, id];
}

function matchesFilters(item, lgaFilter, schoolFilter) {
  // Scope filter used for students/tasks in state/federal views.
  const lgaMatch = lgaFilter === "all" || (item.lgaName || "").toLowerCase() === lgaFilter;
  const schoolMatch = schoolFilter === "all" || item.schoolId === schoolFilter;
  return lgaMatch && schoolMatch;
}

// This dashboard is used by school, state, and federal roles.
// It adapts behavior based on scope and permissions.
function SchoolDashboard({ user, navRoute, notificationSummary }) {
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schools, setSchools] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [scorecard, setScorecard] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [statusFilter, setStatusFilter] = useState("Submitted");
  const [lgaFilter, setLgaFilter] = useState("all");
  const [schoolFilter, setSchoolFilter] = useState("all");
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);

  const [assignment, setAssignment] = useState(assignmentDefaults);
  const [gradeModal, setGradeModal] = useState(null);
  const [view, setView] = useState("tasks");

  const roleLabel = ROLE_LABELS[user.role] || "Dashboard";
  const isSchoolRole = user.role === "school";
  const isStateOrFederal = user.role === "state" || user.role === "federal";

  async function loadDashboard() {
    // Pull all datasets needed for assignment/review in one round trip.
    try {
      setError("");
      setLoading(true);

      const [studentsData, tasksData, schoolsData, analyticsData, scorecardData] =
        await Promise.all([
        apiGet("/students"),
        apiGet("/tasks"),
        apiGet("/schools"),
        apiGet("/analytics/overview"),
        apiGet("/analytics/scorecard"),
      ]);

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setSchools(Array.isArray(schoolsData) ? schoolsData : []);
      setAnalytics(analyticsData || null);
      setScorecard(scorecardData || null);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    // Reload when actor changes.
    loadDashboard();
  }, [user.id]);

  const lgaOptions = useMemo(() => {
    const set = new Set();
    for (const school of schools) {
      if (school.lgaName) set.add(school.lgaName.toLowerCase());
    }
    return Array.from(set).sort();
  }, [schools]);

  const visibleStudents = useMemo(() => {
    // Students currently visible under active filters.
    return students.filter((student) => matchesFilters(student, lgaFilter, schoolFilter));
  }, [students, lgaFilter, schoolFilter]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => matchesFilters(task, lgaFilter, schoolFilter));
  }, [tasks, lgaFilter, schoolFilter]);

  const filteredTasks = useMemo(() => {
    return visibleTasks
      .filter((task) => statusFilter === "All" || task.status === statusFilter)
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }, [visibleTasks, statusFilter]);

  const schoolsByLga = useMemo(() => {
    return groupBy(schools, (school) => school.lgaName || "Unspecified");
  }, [schools]);

  const selectedVisibleCount = selectedStudentIds.filter((id) =>
    visibleStudents.some((student) => student.id === id)
  ).length;
  const activeModule = SCHOOL_MODULE_META[view] || SCHOOL_MODULE_META.tasks;
  const visibleSubmittedCount = visibleTasks.filter((task) => task.status === "Submitted").length;
  const dueSoonCount = visibleTasks.filter((task) => {
    if (!task.deadline || task.status === "Graded") return false;
    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) return false;
    const remainingMs = deadline.getTime() - Date.now();
    return remainingMs >= 0 && remainingMs <= 1000 * 60 * 60 * 24 * 7;
  }).length;
  const moduleHighlights = {
    tasks: [
      `${visibleStudents.length} visible student${visibleStudents.length === 1 ? "" : "s"}`,
      `${visibleSubmittedCount} submissions ready for review`,
      `${dueSoonCount} active deadline${dueSoonCount === 1 ? "" : "s"} this week`,
    ],
    courses: [
      "Manage course structure and assessments",
      "Support bundles, paid and free delivery",
      "Keep CGPA-linked grading intact",
    ],
    collab: [
      "Meetings, chat, and community posts",
      "Broadcast to your approved scope",
      "Keep transcripts and action points together",
    ],
    fees: [
      "Review fee evidence and issue receipts",
      "Track payment status by student scope",
      "Keep school finance actions visible",
    ],
    market: [
      "Run school storefront listings",
      "Moderate student marketplace activity",
      "Track ratings, orders, and disputes",
    ],
  };
  const moduleTabCounts = {
    tasks: (notificationSummary?.byModule?.tasks || 0) + visibleSubmittedCount,
    courses: notificationSummary?.byModule?.courses || 0,
    collab: notificationSummary?.byModule?.collab || 0,
    fees: notificationSummary?.byModule?.fees || 0,
    market:
      (notificationSummary?.byModule?.market || 0) +
      Number(scorecard?.disputeMetrics?.openDisputes || 0),
  };
  const onboardingItems = [
    {
      id: "students",
      title: "Verify student scope",
      description: "Confirm that the students in your current scope are visible before you start assigning work.",
      done: students.length > 0,
      actionLabel: "Refresh Scope",
      onAction: loadDashboard,
    },
    {
      id: "assign-task",
      title: "Assign the first task",
      description: "Use the assignment panel to push real work to one or more students.",
      done: (analytics?.tasksCount || 0) > 0,
      actionLabel: "Open Tasks",
      onAction: () => setView("tasks"),
    },
    {
      id: "review-submissions",
      title: "Review submitted work",
      description: "Open the review stream and grade submitted tasks so students see feedback quickly.",
      done: (analytics?.submittedCount || 0) > 0,
      actionLabel: "Open Review",
      onAction: () => setView("tasks"),
    },
    {
      id: "fees",
      title: "Check payment operations",
      description: "Open fees to create plans, issue invoices, and confirm submitted payments.",
      done: Number(scorecard?.feeMetrics?.paidAmountNaira || 0) > 0,
      actionLabel: "Open Fees",
      onAction: () => setView("fees"),
    },
  ];

  useEffect(() => {
    if (!navRoute?.ts) return;

    const nextModule = navRoute.module;
    if (["tasks", "courses", "collab", "fees", "market"].includes(nextModule)) {
      setView(nextModule);
    }

    if (nextModule === "tasks") {
      if (navRoute.action === "assign_task") {
        setView("tasks");
      }
      if (navRoute.entityType === "task" && navRoute.entityId) {
        const targetTask = tasks.find((entry) => entry.id === navRoute.entityId);
        if (targetTask && (targetTask.status === "Submitted" || targetTask.grade)) {
          setStatusFilter("All");
          setGradeModal({
            id: targetTask.id,
            studentName: targetTask.studentName,
            task: targetTask,
          });
        }
      }
    }
  }, [navRoute, tasks]);

  async function assignTask() {
    // Guardrails first, then submit assignment payload.
    if (!assignment.title.trim()) {
      setError("Task title is required.");
      return;
    }

    if (!selectedStudentIds.length) {
      setError("Select at least one student to assign this task.");
      return;
    }

    if (assignment.status === "Submitted" && !assignment.learningSummary.trim()) {
      setError("Learning Summary is required if task is assigned as Submitted.");
      return;
    }

    try {
      setError("");

      const payload = {
        ...assignment,
        title: assignment.title.trim(),
        description: assignment.description.trim(),
        learningSummary: assignment.learningSummary.trim(),
        studentIds: selectedStudentIds,
        reminderOffsets: normalizeReminderOffsets(assignment.reminderOffsets),
      };

      const created = await apiPost("/tasks", payload);
      const createdCount = Array.isArray(created) ? created.length : 1;

      setNotice(`Assigned task to ${createdCount} student(s).`);
      setAssignment(assignmentDefaults);
      setSelectedStudentIds([]);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to assign task.");
    }
  }

  async function handleGrade({ grade, gradeFeedback }) {
    // Save grade + feedback for submitted work.
    if (!gradeModal) return;

    try {
      setError("");
      const updated = await apiPost(`/tasks/${gradeModal.id}/grade`, {
        grade,
        gradeFeedback,
      });

      setTasks((prev) => prev.map((task) => (task.id === updated.id ? updated : task)));
      setNotice("Grade saved.");
      setGradeModal(null);
      await loadDashboard();
    } catch (err) {
      setError(err.message || "Failed to save grade.");
    }
  }

  if (loading) {
    return (
      <div className="main">
        <div className="empty">
          <div className="empty-icon">...</div>
          <h3>Loading your operational workspace</h3>
          <p>Students, tasks, schools, and analytics are being prepared.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="main">
      <WorkspaceOnboarding
        user={user}
        workspaceKey="school_home"
        title="Prepare your operations workspace"
        description="Complete these setup actions so assignment delivery, courses, collaboration, and payments all have a clean starting point."
        items={onboardingItems}
      />

      <div className="view-tabs module-tabs">
        <button
          className={`view-tab module-tab ${view === "tasks" ? "active" : ""}`}
          onClick={() => setView("tasks")}
        >
          Tasks
          {moduleTabCounts.tasks > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.tasks}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "courses" ? "active" : ""}`}
          onClick={() => setView("courses")}
        >
          Courses
          {moduleTabCounts.courses > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.courses}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "collab" ? "active" : ""}`}
          onClick={() => setView("collab")}
        >
          Collab Hub
          {moduleTabCounts.collab > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.collab}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "fees" ? "active" : ""}`}
          onClick={() => setView("fees")}
        >
          Fees
          {moduleTabCounts.fees > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.fees}</span>
          )}
        </button>
        <button
          className={`view-tab module-tab ${view === "market" ? "active" : ""}`}
          onClick={() => setView("market")}
        >
          Marketplace
          {moduleTabCounts.market > 0 && (
            <span className="module-tab-badge">{moduleTabCounts.market}</span>
          )}
        </button>
      </div>

      <section className="module-hero">
        <div className="module-hero-copy">
          <div className="module-kicker">{activeModule.kicker}</div>
          <div className="module-title-row">
            <h2>{activeModule.title}</h2>
            <span className="module-pill">
              {view === "tasks"
                ? `${filteredTasks.length} filtered task${filteredTasks.length === 1 ? "" : "s"}`
                : view === "courses"
                  ? "Academic delivery"
                  : view === "collab"
                    ? "Live workspace"
                    : view === "fees"
                      ? "Payment operations"
                      : "Trust and commerce"}
            </span>
          </div>
          <p>{activeModule.description}</p>
          <div className="module-highlight-row">
            {moduleHighlights[view].map((entry) => (
              <span key={entry} className="module-highlight-pill">
                {entry}
              </span>
            ))}
          </div>
        </div>

        {view === "tasks" && (
          <div className="module-actions">
            <button className="btn btn-primary" onClick={assignTask}>
              Assign Selected
            </button>
            <button className="btn btn-ghost" onClick={loadDashboard}>
              Refresh
            </button>
            <button
              className="btn btn-ghost"
              onClick={() =>
                exportTasksToCalendar(
                  visibleTasks.filter((task) => task.deadline),
                  `${user.role}-tasks.ics`
                )
              }
            >
              Export Calendar (.ics)
            </button>
          </div>
        )}
      </section>

      {notice && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={() => setNotice("")}>
            {notice}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      {view === "tasks" && (
        <>
          <section className="command-center-card">
            <div className="command-center-head">
              <div className="command-center-copy">
                <div className="panel-kicker">{roleLabel} control</div>
                <h3>Assign, review, and monitor from one task workspace.</h3>
                <p>
                  Narrow scope with filters, select students in context, and keep submitted work visible until grading is complete.
                </p>
              </div>
              <div className="command-center-actions">
                <div className="command-metric">
                  <span>Visible students</span>
                  <strong>{visibleStudents.length}</strong>
                </div>
                <div className="command-metric">
                  <span>Ready to review</span>
                  <strong>{visibleSubmittedCount}</strong>
                </div>
              </div>
            </div>

            <div className="command-strip">
              <article className="command-tile">
                <span className="command-tile-label">Selected</span>
                <strong>{selectedStudentIds.length}</strong>
                <p>Students queued for the current assignment.</p>
              </article>
              <article className="command-tile">
                <span className="command-tile-label">Scope</span>
                <strong>{visibleTasks.length}</strong>
                <p>Tasks visible under the current school and LGA filter.</p>
              </article>
              <article className="command-tile">
                <span className="command-tile-label">School reach</span>
                <strong>{schoolFilter === "all" ? schools.length : 1}</strong>
                <p>School group{schoolFilter === "all" ? "s" : ""} currently in view.</p>
              </article>
            </div>
          </section>

          <div className="stats-bar stats-bar-teacher">
            <div className="stat-card">
              <div className="stat-label">Students</div>
              <div className="stat-value stat-blue">{analytics?.studentsCount || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Schools</div>
              <div className="stat-value">{analytics?.schoolsCount || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Tasks</div>
              <div className="stat-value">{analytics?.tasksCount || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Submitted</div>
              <div className="stat-value stat-purple">{analytics?.submittedCount || 0}</div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Avg Effective Progress</div>
              <div className="stat-value stat-green">
                {analytics?.avgEffectiveProgress || 0}%
              </div>
            </div>
          </div>

          <div className="stats-bar stats-bar-student" style={{ marginBottom: "1.2rem" }}>
            <div className="stat-card">
              <div className="stat-label">Fee Paid Rate</div>
              <div className="stat-value stat-blue">
                {scorecard?.feeMetrics?.paidRate || 0}%
              </div>
              <div className="stat-sub">
                N
                {Number(
                  scorecard?.feeMetrics?.paidAmountNaira || 0
                ).toLocaleString()}{" "}
                paid
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Market Completion</div>
              <div className="stat-value stat-green">
                {scorecard?.marketMetrics?.completionRate || 0}%
              </div>
              <div className="stat-sub">
                {scorecard?.marketMetrics?.ordersCompleted || 0}/
                {scorecard?.marketMetrics?.ordersTotal || 0} orders
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Platform Revenue</div>
              <div className="stat-value stat-purple">
                N
                {Number(
                  scorecard?.marketMetrics?.platformRevenueNaira || 0
                ).toLocaleString()}
              </div>
              <div className="stat-sub">
                Window: {scorecard?.windowDays || 30} days
              </div>
            </div>
            <div className="stat-card">
              <div className="stat-label">Open Disputes</div>
              <div className="stat-value stat-amber">
                {scorecard?.disputeMetrics?.openDisputes || 0}
              </div>
              <div className="stat-sub">
                Total: {scorecard?.disputeMetrics?.totalDisputes || 0}
              </div>
            </div>
          </div>

          <div className="toolbar toolbar-panel">
            <div className="filter-wrap">
              <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                <option value="All">All Statuses</option>
                {STATUSES.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>

              {isStateOrFederal && (
                <select value={lgaFilter} onChange={(event) => setLgaFilter(event.target.value)}>
                  <option value="all">All LGAs</option>
                  {lgaOptions.map((lga) => (
                    <option key={lga} value={lga}>
                      {lga}
                    </option>
                  ))}
                </select>
              )}

              {!isSchoolRole && (
                <select value={schoolFilter} onChange={(event) => setSchoolFilter(event.target.value)}>
                  <option value="all">All Schools</option>
                  {schools.map((school) => (
                    <option key={school.id} value={school.id}>
                      {school.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="toolbar-spacer" />
            <div className="calendar-meta">
              Filtering {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} in scope
            </div>
          </div>
        </>
      )}

      {view === "courses" ? (
        <CoursesWorkspace user={user} navRoute={navRoute} />
      ) : view === "fees" ? (
        <FeesWorkspace user={user} navRoute={navRoute} />
      ) : view === "market" ? (
        <MarketplaceWorkspace user={user} navRoute={navRoute} />
      ) : view === "collab" ? (
        // Shared collab module for school/governance users.
        <CollaborationHubModal user={user} embedded navRoute={navRoute} />
      ) : (
        <>
      <div className="workspace-grid workspace-grid-school">
        <section className="panel panel-elevated">
          <div className="panel-kicker">Create work</div>
          <div className="panel-title">Assign Task</div>
          <div className="panel-copy">
            Build the assignment once, then push it to selected students inside the current scope.
          </div>

          <div className="field">
            <label>Title *</label>
            <input
              value={assignment.title}
              onChange={(event) =>
                setAssignment((prev) => ({ ...prev, title: event.target.value }))
              }
              placeholder="e.g. Literature Essay Draft"
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              value={assignment.description}
              onChange={(event) =>
                setAssignment((prev) => ({ ...prev, description: event.target.value }))
              }
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field">
              <label>Category</label>
              <select
                value={assignment.category}
                onChange={(event) =>
                  setAssignment((prev) => ({ ...prev, category: event.target.value }))
                }
              >
                {CATEGORIES.map((category) => (
                  <option key={category}>{category}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Priority</label>
              <select
                value={assignment.priority}
                onChange={(event) =>
                  setAssignment((prev) => ({ ...prev, priority: event.target.value }))
                }
              >
                {PRIORITIES.map((priority) => (
                  <option key={priority}>{priority}</option>
                ))}
              </select>
            </div>
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field">
              <label>Status</label>
              <select
                value={assignment.status}
                onChange={(event) =>
                  setAssignment((prev) => ({ ...prev, status: event.target.value }))
                }
              >
                {EDITABLE_STATUSES.map((status) => (
                  <option key={status}>{status}</option>
                ))}
              </select>
            </div>

            <div className="field">
              <label>Deadline</label>
              <input
                type="datetime-local"
                value={assignment.deadline}
                onChange={(event) =>
                  setAssignment((prev) => ({ ...prev, deadline: event.target.value }))
                }
              />
            </div>
          </div>

          <div className="field">
            <label>Progress ({assignment.progress}%)</label>
            <input
              type="range"
              min="0"
              max="100"
              value={assignment.progress}
              onChange={(event) =>
                setAssignment((prev) => ({ ...prev, progress: Number(event.target.value) }))
              }
            />
          </div>

          <div className="field">
            <label>Reminders (minutes before deadline)</label>
            <div className="check-row">
              {[30, 10, 5].map((minutes) => (
                <label key={minutes} className="check-item">
                  <input
                    type="checkbox"
                    checked={assignment.reminderOffsets.includes(minutes)}
                    onChange={() =>
                      setAssignment((prev) => {
                        const next = prev.reminderOffsets.includes(minutes)
                          ? prev.reminderOffsets.filter((entry) => entry !== minutes)
                          : [...prev.reminderOffsets, minutes];
                        return { ...prev, reminderOffsets: normalizeReminderOffsets(next) };
                      })
                    }
                  />
                  {minutes}m
                </label>
              ))}
            </div>
          </div>

          {assignment.status === "Submitted" && (
            <div className="field">
              <label>Learning Summary *</label>
              <textarea
                value={assignment.learningSummary}
                onChange={(event) =>
                  setAssignment((prev) => ({
                    ...prev,
                    learningSummary: event.target.value,
                  }))
                }
                placeholder="Provide expected summary content for submitted status."
              />
            </div>
          )}

          <div className="panel-subtitle">Select Students ({selectedStudentIds.length})</div>
          <div className="panel-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={() =>
                setSelectedStudentIds(visibleStudents.map((student) => student.id))
              }
            >
              Select All Visible
            </button>
            <button
              className="btn btn-ghost btn-sm"
              onClick={() => setSelectedStudentIds([])}
            >
              Clear
            </button>
          </div>

          <div className="student-picker">
            {visibleStudents.map((student) => (
              <label key={student.id} className="student-pick-row">
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() =>
                    setSelectedStudentIds((prev) => toggleId(prev, student.id))
                  }
                />
                <span>
                  <strong>{student.name}</strong>
                  <span className="student-row-meta">
                    {" "}
                    | {student.schoolName || "No school"} | {student.grade || "No grade"} |{" "}
                    {student.avgEffectiveProgress}% effective
                  </span>
                </span>
              </label>
            ))}

            {!visibleStudents.length && (
              <div className="empty-col">No students in this scope/filter.</div>
            )}
          </div>

          <button className="btn btn-primary btn-full" onClick={assignTask}>
            Assign Task to {selectedStudentIds.length || 0} Student(s)
          </button>
          {selectedVisibleCount > 0 && (
            <div className="panel-hint">
              {selectedVisibleCount} selected student(s) are in the current filter view.
            </div>
          )}
        </section>

        <section className="panel panel-elevated">
          <div className="panel-kicker">Review stream</div>
          <div className="panel-title">
            Review / Monitor Tasks ({filteredTasks.length})
          </div>
          <div className="panel-copy">
            Follow submissions, grading status, deadlines, and effective progress without leaving the review list.
          </div>

          <div className="calendar-list">
            {filteredTasks.map((task) => (
              <div key={task.id} className="review-card">
                <div className="review-card-header">
                  <div>
                    <div className="review-card-title">{task.title}</div>
                    <div className="review-card-meta">
                      <span>{task.studentName}</span>
                      <span>|</span>
                      <span>{task.schoolName || "No school"}</span>
                      <span>|</span>
                      <span>{task.status}</span>
                      <span>|</span>
                      <PriBadge p={task.priority} />
                      {task.grade && <GradeChip grade={task.grade} />}
                    </div>
                  </div>

                  {task.status === "Submitted" || task.grade ? (
                    <button
                      className="btn btn-purple btn-sm"
                      onClick={() =>
                        setGradeModal({
                          id: task.id,
                          studentName: task.studentName,
                          task,
                        })
                      }
                    >
                      {task.grade ? "Re-grade" : "Grade"}
                    </button>
                  ) : null}
                </div>

                <div className="review-summary-box">
                  {task.learningSummary
                    ? task.learningSummary
                    : "No learning summary submitted yet."}
                </div>

                <div className="review-card-meta">
                  <span>{task.category}</span>
                  <span>|</span>
                  <span>Progress: {effectiveProgress(task)}%</span>
                  {task.deadline ? (
                    <>
                      <span>|</span>
                      <span>Deadline: {formatDateTime(task.deadline)}</span>
                    </>
                  ) : null}
                </div>

                {task.gradeFeedback && (
                  <div className="grade-feedback-italic">Feedback: {task.gradeFeedback}</div>
                )}
              </div>
            ))}
          </div>

          {!filteredTasks.length && (
            <div className="empty-col">No tasks match this filter.</div>
          )}
        </section>
      </div>

      {isStateOrFederal && (
        <section className="panel panel-elevated" style={{ marginTop: "1rem" }}>
          <div className="panel-kicker">Coverage map</div>
          <div className="panel-title">Schools Grouped by LGA</div>
          {Object.keys(schoolsByLga).length ? (
            Object.entries(schoolsByLga).map(([lgaName, lgaSchools]) => (
              <div key={lgaName} className="lga-group">
                <div className="lga-title">
                  {lgaName} ({lgaSchools.length} school(s))
                </div>
                <div className="lga-schools">
                  {lgaSchools.map((school) => (
                    <div key={school.id} className="lga-school-chip">
                      {school.name} | {school.studentCount} students | {school.taskCount} tasks
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <div className="empty-col">No schools available in this scope.</div>
          )}
        </section>
      )}

      {gradeModal && (
        <GradeModal
          todo={gradeModal.task}
          studentName={gradeModal.studentName}
          onSave={handleGrade}
          onClose={() => setGradeModal(null)}
        />
      )}
        </>
      )}
    </div>
  );
}

export default SchoolDashboard;
