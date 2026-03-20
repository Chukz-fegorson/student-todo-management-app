import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { exportTasksToCalendar } from "../lib/calendar";
import { DEFAULT_REMINDER_OFFSETS, ROLE_LABELS } from "../lib/constants";
import { groupBy, normalizeReminderOffsets } from "../lib/helpers";

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

const SCHOOL_MODULE_TABS = [
  { id: "tasks", label: "Tasks" },
  { id: "fees", label: "Fees" },
  { id: "courses", label: "Courses" },
  { id: "collab", label: "Collab Hub" },
  { id: "market", label: "Marketplace" },
];

const GOVERNANCE_MODULE_TABS = [
  { id: "tasks", label: "Tasks" },
  { id: "courses", label: "Courses" },
  { id: "fees", label: "Fees" },
  { id: "collab", label: "Collab Hub" },
  { id: "market", label: "Marketplace" },
];

function toggleId(arr, id) {
  return arr.includes(id) ? arr.filter((entry) => entry !== id) : [...arr, id];
}

function matchesFilters(item, lgaFilter, schoolFilter) {
  const lgaMatch =
    lgaFilter === "all" || (item.lgaName || "").toLowerCase() === lgaFilter;
  const schoolMatch = schoolFilter === "all" || item.schoolId === schoolFilter;
  return lgaMatch && schoolMatch;
}

function countDueSoon(visibleTasks) {
  return visibleTasks.filter((task) => {
    if (!task.deadline || task.status === "Graded") return false;
    const deadline = new Date(task.deadline);
    if (Number.isNaN(deadline.getTime())) return false;
    const remainingMs = deadline.getTime() - Date.now();
    return remainingMs >= 0 && remainingMs <= 1000 * 60 * 60 * 24 * 7;
  }).length;
}

export function useSchoolWorkspace({ user, navRoute, notificationSummary }) {
  const [students, setStudents] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [schools, setSchools] = useState([]);
  const [analytics, setAnalytics] = useState(null);
  const [scorecard, setScorecard] = useState(null);
  const [intelligence, setIntelligence] = useState(null);
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
  const [dueSoonCount, setDueSoonCount] = useState(0);

  const roleLabel = ROLE_LABELS[user.role] || "Dashboard";
  const isSchoolRole = user.role === "school";
  const isStateOrFederal = user.role === "state" || user.role === "federal";
  const moduleTabs = isSchoolRole ? SCHOOL_MODULE_TABS : GOVERNANCE_MODULE_TABS;

  const loadDashboard = useCallback(async () => {
    try {
      setError("");
      setLoading(true);

      const [
        studentsData,
        tasksData,
        schoolsData,
        analyticsData,
        scorecardData,
        intelligenceData,
      ] =
        await Promise.all([
          apiGet("/students"),
          apiGet("/tasks"),
          apiGet("/schools"),
          apiGet("/analytics/overview"),
          apiGet("/analytics/scorecard"),
          apiGet("/analytics/intelligence"),
        ]);

      setStudents(Array.isArray(studentsData) ? studentsData : []);
      setTasks(Array.isArray(tasksData) ? tasksData : []);
      setSchools(Array.isArray(schoolsData) ? schoolsData : []);
      setAnalytics(analyticsData || null);
      setScorecard(scorecardData || null);
      setIntelligence(intelligenceData || null);
    } catch (err) {
      setError(err.message || "Failed to load dashboard data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard, user.id]);

  const lgaOptions = useMemo(() => {
    const set = new Set();
    for (const school of schools) {
      if (school.lgaName) set.add(school.lgaName.toLowerCase());
    }
    return Array.from(set).sort();
  }, [schools]);

  const visibleStudents = useMemo(() => {
    return students.filter((student) =>
      matchesFilters(student, lgaFilter, schoolFilter)
    );
  }, [lgaFilter, schoolFilter, students]);

  const visibleTasks = useMemo(() => {
    return tasks.filter((task) => matchesFilters(task, lgaFilter, schoolFilter));
  }, [lgaFilter, schoolFilter, tasks]);

  const filteredTasks = useMemo(() => {
    return visibleTasks
      .filter((task) => statusFilter === "All" || task.status === statusFilter)
      .sort((a, b) => {
        const aTime = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTime = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTime - aTime;
      });
  }, [statusFilter, visibleTasks]);

  const schoolsByLga = useMemo(() => {
    return groupBy(schools, (school) => school.lgaName || "Unspecified");
  }, [schools]);

  const selectedVisibleCount = selectedStudentIds.filter((id) =>
    visibleStudents.some((student) => student.id === id)
  ).length;
  const visibleSubmittedCount = visibleTasks.filter(
    (task) => task.status === "Submitted"
  ).length;
  const hasActiveFilters =
    statusFilter !== "All" || lgaFilter !== "all" || schoolFilter !== "all";

  useEffect(() => {
    function syncDueSoonCount() {
      setDueSoonCount(countDueSoon(visibleTasks));
    }

    syncDueSoonCount();
    const timer = window.setInterval(syncDueSoonCount, 30000);
    return () => window.clearInterval(timer);
  }, [visibleTasks]);

  const activeModule = SCHOOL_MODULE_META[view] || SCHOOL_MODULE_META.tasks;
  const activeModulePill =
    view === "tasks"
      ? `${filteredTasks.length} filtered task${filteredTasks.length === 1 ? "" : "s"}`
      : view === "courses"
        ? "Academic delivery"
        : view === "collab"
          ? "Live workspace"
          : view === "fees"
            ? "Payment operations"
            : "Trust and commerce";
  const activeAlertCount = intelligence?.alerts?.length || 0;
  const activeInterventionCount = intelligence?.interventionQueue?.length || 0;

  const moduleHighlights = {
    tasks: [
      `${visibleStudents.length} visible student${visibleStudents.length === 1 ? "" : "s"}`,
      `${visibleSubmittedCount} submissions ready for review`,
      activeAlertCount
        ? `${activeAlertCount} intervention alert${activeAlertCount === 1 ? "" : "s"} active`
        : `${dueSoonCount} active deadline${dueSoonCount === 1 ? "" : "s"} this week`,
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
    tasks:
      (notificationSummary?.byModule?.tasks || 0) +
      visibleSubmittedCount +
      activeAlertCount,
    courses: notificationSummary?.byModule?.courses || 0,
    collab: notificationSummary?.byModule?.collab || 0,
    fees: notificationSummary?.byModule?.fees || 0,
    market:
      (notificationSummary?.byModule?.market || 0) +
      Number(scorecard?.disputeMetrics?.openDisputes || 0),
  };

  const taskControlHeadline = !visibleStudents.length
    ? "Confirm scope before operational work begins."
    : activeAlertCount > 0
      ? isSchoolRole
        ? "Intervention signals are active inside your school scope."
        : "Intervention signals are active across the current governance scope."
    : visibleSubmittedCount > 0
      ? isSchoolRole
        ? "Review submitted work before backlog affects outcomes."
        : "Review the strongest intervention signals before slippage spreads."
      : selectedStudentIds.length > 0
        ? "Selected students are ready for the next assignment."
        : isSchoolRole
          ? "Push the next high-value task and keep follow-through visible."
          : "Keep oversight moving with the next task or review action.";

  const taskControlCopy = !visibleStudents.length
    ? hasActiveFilters
      ? "Current filters may be hiding your working scope. Clear them or refresh data so approved students and schools are visible again."
      : "Refresh scope and confirm that approved students and schools are available before assigning work or reviewing performance."
    : activeAlertCount > 0
      ? activeInterventionCount > 0
        ? `${activeAlertCount} active alert${activeAlertCount === 1 ? "" : "s"} and ${activeInterventionCount} intervention candidate${activeInterventionCount === 1 ? "" : "s"} need attention before the next reporting cycle.`
        : `${activeAlertCount} active alert${activeAlertCount === 1 ? "" : "s"} need attention before the next reporting cycle.`
    : visibleSubmittedCount > 0
      ? "Keep submitted work visible until grading is complete so students, schools, and intervention teams are not operating on stale signals."
      : selectedStudentIds.length > 0
        ? "Use the assignment form to push the next piece of work while your intended student set is still selected."
        : "Narrow scope only when needed, select students in context, and keep assignments, reviews, and revenue operations connected.";

  const openModule = useCallback((nextModule) => {
    setView(nextModule);
  }, []);

  const dismissNotice = useCallback(() => {
    setNotice("");
  }, []);

  const resetFilters = useCallback(() => {
    setStatusFilter("All");
    setLgaFilter("all");
    setSchoolFilter("all");
  }, []);

  const setAssignmentField = useCallback((field, value) => {
    setAssignment((prev) => ({ ...prev, [field]: value }));
  }, []);

  const toggleReminderOffset = useCallback((minutes) => {
    setAssignment((prev) => {
      const next = prev.reminderOffsets.includes(minutes)
        ? prev.reminderOffsets.filter((entry) => entry !== minutes)
        : [...prev.reminderOffsets, minutes];
      return { ...prev, reminderOffsets: normalizeReminderOffsets(next) };
    });
  }, []);

  const selectAllVisibleStudents = useCallback(() => {
    setSelectedStudentIds(visibleStudents.map((student) => student.id));
  }, [visibleStudents]);

  const clearSelectedStudents = useCallback(() => {
    setSelectedStudentIds([]);
  }, []);

  const toggleStudentSelection = useCallback((studentId) => {
    setSelectedStudentIds((prev) => toggleId(prev, studentId));
  }, []);

  const openGradeModal = useCallback((task) => {
    setGradeModal({
      id: task.id,
      studentName: task.studentName,
      task,
    });
  }, []);

  const closeGradeModal = useCallback(() => {
    setGradeModal(null);
  }, []);

  const assignTask = useCallback(async () => {
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
  }, [assignment, loadDashboard, selectedStudentIds]);

  const handleGrade = useCallback(
    async ({ grade, gradeFeedback }) => {
      if (!gradeModal) return;

      try {
        setError("");
        await apiPost(`/tasks/${gradeModal.id}/grade`, {
          grade,
          gradeFeedback,
        });

        setNotice("Grade saved.");
        setGradeModal(null);
        await loadDashboard();
      } catch (err) {
        setError(err.message || "Failed to save grade.");
      }
    },
    [gradeModal, loadDashboard]
  );

  const exportVisibleTasks = useCallback(() => {
    exportTasksToCalendar(
      visibleTasks.filter((task) => task.deadline),
      `${user.role}-tasks.ics`
    );
  }, [user.role, visibleTasks]);

  const onboardingItems = [
    {
      id: "students",
      title: "Verify student scope",
      description:
        "Confirm that the students in your current scope are visible before you start assigning work.",
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
      onAction: () => openModule("tasks"),
    },
    {
      id: "review-submissions",
      title: "Review submitted work",
      description:
        "Open the review stream and grade submitted tasks so students see feedback quickly.",
      done:
        (analytics?.tasksReviewedCount || 0) > 0 ||
        visibleTasks.some((task) => Boolean(task.grade)),
      actionLabel: "Open Review",
      onAction: () => openModule("tasks"),
    },
    {
      id: "fees",
      title: "Check payment operations",
      description:
        "Open fees to create plans, issue invoices, and confirm submitted payments.",
      done: Number(scorecard?.feeMetrics?.paidAmountNaira || 0) > 0,
      actionLabel: "Open Fees",
      onAction: () => openModule("fees"),
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
          openGradeModal(targetTask);
        }
      }
    }
  }, [navRoute, openGradeModal, tasks]);

  const taskWorkspaceProps = {
    analytics,
    assignment,
    error,
    filteredTasks,
    gradeModal,
    hasActiveFilters,
    intelligence,
    isSchoolRole,
    isStateOrFederal,
    lgaFilter,
    lgaOptions,
    moduleHighlights: moduleHighlights.tasks,
    moduleMeta: SCHOOL_MODULE_META.tasks,
    modulePill: `${filteredTasks.length} filtered task${filteredTasks.length === 1 ? "" : "s"}`,
    notice,
    roleLabel,
    schoolFilter,
    schools,
    schoolsByLga,
    scorecard,
    selectedStudentIds,
    selectedVisibleCount,
    statusFilter,
    taskControlCopy,
    taskControlHeadline,
    visibleStudents,
    visibleSubmittedCount,
    visibleTasks,
    onAssignTask: assignTask,
    onAssignmentFieldChange: setAssignmentField,
    onClearSelectedStudents: clearSelectedStudents,
    onCloseGradeModal: closeGradeModal,
    onDismissNotice: dismissNotice,
    onExportCalendar: exportVisibleTasks,
    onGradeTask: handleGrade,
    onLoadDashboard: loadDashboard,
    onOpenGradeModal: openGradeModal,
    onResetFilters: resetFilters,
    onSelectAllVisibleStudents: selectAllVisibleStudents,
    onSetLgaFilter: setLgaFilter,
    onSetSchoolFilter: setSchoolFilter,
    onSetStatusFilter: setStatusFilter,
    onToggleReminderOffset: toggleReminderOffset,
    onToggleStudentSelection: toggleStudentSelection,
  };

  return {
    activeModule,
    activeModulePill,
    dismissNotice,
    error,
    loading,
    moduleHighlights,
    moduleTabs,
    moduleTabCounts,
    notice,
    onboardingItems,
    openModule,
    taskWorkspaceProps,
    view,
  };
}
