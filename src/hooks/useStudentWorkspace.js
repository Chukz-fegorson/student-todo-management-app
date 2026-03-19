import { useCallback, useEffect, useMemo, useState } from "react";
import { apiDel, apiGet, apiPost, apiPut } from "../lib/api";
import { exportTasksToCalendar } from "../lib/calendar";
import { normalizeReminderOffsets, parseDate } from "../lib/helpers";
import { storageGet, storageSet } from "../lib/storage";

const REMINDER_SEEN_KEY = "reminders_seen";

export const STUDENT_MODULE_META = {
  tasks: {
    kicker: "My Tasks",
    title: "Task Command Center",
    description:
      "See what needs attention now, keep deadlines visible, and move work from planning to grading without leaving this workspace.",
  },
  courses: {
    kicker: "Courses",
    title: "Course Progress",
    description:
      "Follow enrolled courses, practical work, assessments, and CGPA-linked progress from one place.",
  },
  collab: {
    kicker: "Collab Hub",
    title: "Meetings, Chat, and Community",
    description:
      "Move between direct chat, group collaboration, meetings, transcripts, and the shared community feed without losing context.",
  },
  fees: {
    kicker: "My Fees",
    title: "Payments and Receipts",
    description:
      "Track school fees, upload proof of payment, and keep confirmation history and receipts in one module.",
  },
  market: {
    kicker: "Marketplace",
    title: "Campus Commerce",
    description:
      "Buy, sell, and complete trusted transactions with listings, receipts, reviews, and delivery confirmation in one flow.",
  },
};

export const STUDENT_MODULE_TABS = [
  { id: "tasks", label: "My Tasks" },
  { id: "courses", label: "Courses" },
  { id: "fees", label: "My Fees" },
  { id: "collab", label: "Collab Hub" },
  { id: "market", label: "Marketplace" },
];

function countDueSoon(upcomingDeadlines) {
  return upcomingDeadlines.filter((todo) => {
    const deadline = parseDate(todo.deadline);
    if (!deadline) return false;
    const remainingMs = deadline.getTime() - Date.now();
    return remainingMs >= 0 && remainingMs <= 1000 * 60 * 60 * 48;
  }).length;
}

export function useStudentWorkspace({
  user,
  navRoute,
  onNavigate,
  notificationSummary,
}) {
  const [todos, setTodos] = useState([]);
  const [loadingTodos, setLoadingTodos] = useState(true);
  const [error, setError] = useState("");
  const [notif, setNotif] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState(null);
  const [deleting, setDeleting] = useState(null);
  const [parentReviews, setParentReviews] = useState([]);
  const [parentLinkCode, setParentLinkCode] = useState("");
  const [courseOverview, setCourseOverview] = useState(null);
  const [view, setView] = useState("tasks");
  const [highlightTaskId, setHighlightTaskId] = useState("");
  const [openTaskUtility, setOpenTaskUtility] = useState("");
  const [dueSoonCount, setDueSoonCount] = useState(0);

  const loadTodos = useCallback(async () => {
    try {
      setError("");
      setLoadingTodos(true);
      const data = await apiGet("/tasks");
      setTodos(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message || "Failed to load tasks");
    } finally {
      setLoadingTodos(false);
    }
  }, []);

  const loadParentData = useCallback(async () => {
    try {
      const [reviews, linkData] = await Promise.all([
        apiGet(`/students/${user.id}/parent-reviews`),
        apiGet("/parent/link-code").catch(() => null),
      ]);
      setParentReviews(Array.isArray(reviews) ? reviews : []);
      setParentLinkCode(linkData?.linkCode || "");
    } catch {
      setParentReviews([]);
      setParentLinkCode("");
    }
  }, [user.id]);

  const loadCourseOverview = useCallback(async () => {
    try {
      const data = await apiGet("/courses/cgpa/me");
      setCourseOverview(data || null);
    } catch {
      setCourseOverview(null);
    }
  }, []);

  useEffect(() => {
    loadTodos();
    loadParentData();
    loadCourseOverview();
  }, [loadCourseOverview, loadParentData, loadTodos, user.id]);

  useEffect(() => {
    const timer = window.setInterval(() => {
      const seen = storageGet(REMINDER_SEEN_KEY, {});
      let changed = false;
      let latestMessage = "";
      const nowMs = Date.now();

      const courseReminderItems = (courseOverview?.upcomingDeadlines || []).map(
        (entry) => ({
          id: `course-${entry.id}`,
          title: `${entry.courseTitle}: ${entry.assessmentTitle}`,
          deadline: entry.dueAt,
          status: "Course",
        })
      );

      for (const todo of [...todos, ...courseReminderItems]) {
        if (!todo.deadline || todo.status === "Graded") continue;
        const due = parseDate(todo.deadline);
        if (!due) continue;
        const dueMs = due.getTime();
        const offsets = normalizeReminderOffsets(todo.reminderOffsets);

        for (const offset of offsets) {
          const reminderKey = `${todo.id}:${offset}`;
          if (seen[reminderKey]) continue;
          const trigger = dueMs - offset * 60 * 1000;

          if (nowMs >= trigger && nowMs < dueMs) {
            seen[reminderKey] = nowMs;
            changed = true;
            latestMessage = `${todo.title} is due in ${offset} minute(s).`;

            if (window.Notification && window.Notification.permission === "granted") {
              new window.Notification("StudyFlow Reminder", {
                body: latestMessage,
              });
            }
          }
        }
      }

      if (changed) {
        storageSet(REMINDER_SEEN_KEY, seen);
        if (latestMessage) setNotif(latestMessage);
      }
    }, 30000);

    return () => window.clearInterval(timer);
  }, [courseOverview, todos]);

  const enableNotifications = useCallback(async () => {
    if (!window.Notification) {
      setNotif("This browser does not support notifications.");
      return;
    }

    try {
      const permission = await window.Notification.requestPermission();
      if (permission === "granted") {
        setNotif("Deadline notifications enabled.");
      } else {
        setNotif("Notification permission was not granted.");
      }
    } catch {
      setNotif("Unable to request notification permission.");
    }
  }, []);

  const saveTodo = useCallback(
    async (form) => {
      try {
        setError("");

        if (editing) {
          const updated = await apiPut(`/tasks/${editing.id}`, form);
          setTodos((prev) =>
            prev.map((todo) => (todo.id === updated.id ? updated : todo))
          );
          setNotif("Task updated.");
        } else {
          const created = await apiPost("/tasks", form);
          if (Array.isArray(created)) {
            setTodos((prev) => [...created, ...prev]);
          } else {
            setTodos((prev) => [created, ...prev]);
          }
          setNotif("Task created.");
        }

        setEditing(null);
        setShowModal(false);
      } catch (err) {
        setError(err.message || "Failed to save task");
      }
    },
    [editing]
  );

  const deleteTodo = useCallback(async () => {
    if (!deleting) return;

    try {
      setError("");
      await apiDel(`/tasks/${deleting.id}`);
      setTodos((prev) => prev.filter((todo) => todo.id !== deleting.id));
      setDeleting(null);
      setNotif("Task deleted.");
    } catch (err) {
      setError(err.message || "Failed to delete task");
    }
  }, [deleting]);

  const isProfileComplete =
    Boolean(String(user?.bio || "").trim()) &&
    Boolean(String(user?.phone || "").trim()) &&
    Boolean(String(user?.dateOfBirth || "").trim());
  const notificationsEnabled =
    typeof window !== "undefined" && window.Notification?.permission === "granted";
  const courseProgress = Number(courseOverview?.overallCourseProgress || 0);
  const cgpa = Number(courseOverview?.cgpa || 0);
  const selectedCoursesCount = Number(courseOverview?.selectedCoursesCount || 0);

  const upcomingDeadlines = useMemo(() => {
    const taskItems = todos.filter((todo) => parseDate(todo.deadline));
    const courseItems = (courseOverview?.upcomingDeadlines || []).map((entry) => ({
      id: `course-${entry.id}`,
      title: `${entry.courseTitle}: ${entry.assessmentTitle}`,
      category: entry.assessmentType,
      status: "Course",
      deadline: entry.dueAt,
      sourceType: "course",
    }));

    return [...taskItems, ...courseItems]
      .filter((todo) => parseDate(todo.deadline))
      .sort((a, b) => parseDate(a.deadline).getTime() - parseDate(b.deadline).getTime())
      .slice(0, 8);
  }, [courseOverview, todos]);

  const activeModule = STUDENT_MODULE_META[view] || STUDENT_MODULE_META.tasks;
  const activeModulePill =
    view === "tasks"
      ? `${todos.length} total task${todos.length === 1 ? "" : "s"}`
      : view === "courses"
        ? `${selectedCoursesCount} selected`
        : view === "collab"
          ? "Live workspace"
          : view === "fees"
            ? "Payments workflow"
            : "Listings and orders";

  const moduleHighlights = {
    courses: [
      `${selectedCoursesCount} selected course${selectedCoursesCount === 1 ? "" : "s"}`,
      `${courseProgress}% course progress`,
      `CGPA ${cgpa.toFixed(2)}`,
    ],
    collab: [
      "Meetings, chat, and community feed",
      "Transcript and AI action pipeline",
      "Broadcast and direct collaboration",
    ],
    fees: [
      "Track school fees and receipts",
      "Upload evidence for manual payment",
      "Keep confirmation history visible",
    ],
    market: [
      "Browse listings and complete purchases",
      "Use claim-code confirmation flow",
      "Review sellers and products after delivery",
    ],
  };

  const moduleTabCounts = {
    tasks: (notificationSummary?.byModule?.tasks || 0) + dueSoonCount,
    courses: (notificationSummary?.byModule?.courses || 0) + selectedCoursesCount,
    collab: notificationSummary?.byModule?.collab || 0,
    fees: notificationSummary?.byModule?.fees || 0,
    market: notificationSummary?.byModule?.market || 0,
  };

  const openModule = useCallback((nextModule) => {
    setView(nextModule);
  }, []);

  const handleCreateTask = useCallback(() => {
    setView("tasks");
    setEditing(null);
    setShowModal(true);
  }, []);

  const handleEditTask = useCallback((todo) => {
    setView("tasks");
    setEditing(todo);
    setShowModal(true);
  }, []);

  const handleRefreshTaskWorkspace = useCallback(() => {
    loadTodos();
    loadCourseOverview();
  }, [loadCourseOverview, loadTodos]);

  const handleExportTaskCalendar = useCallback(() => {
    exportTasksToCalendar(
      [
        ...todos.filter((todo) => todo.deadline),
        ...(courseOverview?.upcomingDeadlines || []).map((entry) => ({
          id: `course-${entry.id}`,
          title: `${entry.courseTitle}: ${entry.assessmentTitle}`,
          description: `Course ${entry.assessmentType}`,
          category: "Course",
          status: "Course",
          deadline: entry.dueAt,
          reminderOffsets: [30, 10, 5],
        })),
      ],
      `${user.name || "student"}-tasks.ics`
    );
  }, [courseOverview, todos, user.name]);

  const toggleTaskUtility = useCallback((nextUtility) => {
    setOpenTaskUtility((prev) => (prev === nextUtility ? "" : nextUtility));
  }, []);

  const dismissNotif = useCallback(() => {
    setNotif("");
  }, []);

  const closeTodoModal = useCallback(() => {
    setEditing(null);
    setShowModal(false);
  }, []);

  const closeDeleteModal = useCallback(() => {
    setDeleting(null);
  }, []);

  const onboardingItems = [
    {
      id: "profile",
      title: "Complete biodata",
      description:
        "Add your bio, phone number, and date of birth so your profile is complete.",
      done: isProfileComplete,
      actionLabel: "Update Biodata",
      onAction: () => onNavigate?.({ action: "open_account_profile" }),
    },
    {
      id: "first-task",
      title: "Create your first task",
      description:
        "Start using the command center by adding a real assignment, revision, or project.",
      done: todos.length > 0,
      actionLabel: "Create Task",
      onAction: handleCreateTask,
    },
    {
      id: "courses",
      title: "Select a course",
      description:
        "Choose at least one course so StudyFlow can track CGPA and assessment progress.",
      done: selectedCoursesCount > 0,
      actionLabel: "Open Courses",
      onAction: () => openModule("courses"),
    },
    {
      id: "reminders",
      title: "Enable reminders",
      description:
        "Turn on browser reminders so upcoming deadlines can surface before they become urgent.",
      done: notificationsEnabled,
      actionLabel: "Enable",
      onAction: enableNotifications,
    },
  ];

  useEffect(() => {
    if (!navRoute?.ts) return;

    const nextModule = navRoute.module;
    if (["tasks", "courses", "collab", "fees", "market"].includes(nextModule)) {
      setView(nextModule);
    }

    if (nextModule === "tasks") {
      if (navRoute.action === "new_task") {
        setEditing(null);
        setShowModal(true);
      }

      if (navRoute.entityType === "task" && navRoute.entityId) {
        const targetTask = todos.find((entry) => entry.id === navRoute.entityId);
        if (targetTask) {
          setEditing(targetTask);
          setShowModal(true);
          setHighlightTaskId(targetTask.id);
        }
      }
    }
  }, [navRoute, todos]);

  useEffect(() => {
    if (!highlightTaskId) return undefined;
    const timer = window.setTimeout(() => setHighlightTaskId(""), 2600);
    return () => window.clearTimeout(timer);
  }, [highlightTaskId]);

  useEffect(() => {
    function syncDueSoonCount() {
      setDueSoonCount(countDueSoon(upcomingDeadlines));
    }

    syncDueSoonCount();
    const timer = window.setInterval(syncDueSoonCount, 30000);
    return () => window.clearInterval(timer);
  }, [upcomingDeadlines]);

  useEffect(() => {
    if (view !== "tasks") {
      setOpenTaskUtility("");
    }
  }, [view]);

  const taskWorkspaceProps = {
    courseOverview,
    dueSoonCount,
    error,
    highlightTaskId,
    loadingTodos,
    moduleMeta: STUDENT_MODULE_META.tasks,
    notificationsEnabled,
    notif,
    openTaskUtility,
    parentLinkCode,
    parentReviews,
    todos,
    upcomingDeadlines,
    user,
    onCreateTask: handleCreateTask,
    onDeleteTask: setDeleting,
    onDismissNotif: dismissNotif,
    onEditTask: handleEditTask,
    onEnableNotifications: enableNotifications,
    onExportCalendar: handleExportTaskCalendar,
    onOpenCourses: () => openModule("courses"),
    onRefresh: handleRefreshTaskWorkspace,
    onToggleTaskUtility: toggleTaskUtility,
  };

  return {
    activeModule,
    activeModulePill,
    closeDeleteModal,
    closeTodoModal,
    deleteTodo,
    deleting,
    editing,
    error,
    moduleHighlights,
    moduleTabCounts,
    notif,
    onboardingItems,
    openModule,
    saveTodo,
    selectedCoursesCount,
    showModal,
    taskWorkspaceProps,
    view,
  };
}
