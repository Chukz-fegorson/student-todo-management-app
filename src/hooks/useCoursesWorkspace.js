import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";

const AUTHOR_ROLES = new Set(["school", "state", "federal"]);

const COURSE_DEFAULTS = {
  title: "",
  description: "",
  category: "General",
  level: "",
  creditUnits: 3,
  pricingType: "free",
  priceNaira: 0,
  isPublished: true,
};

const MODULE_DEFAULTS = { title: "", content: "" };

const ASSESSMENT_DEFAULTS = {
  title: "",
  instructions: "",
  assessmentType: "assignment",
  weightPercent: 25,
  dueAt: "",
  durationMinutes: 30,
  passMark: 50,
  attemptsAllowed: 1,
  isPublished: true,
};

const QUESTION_DEFAULTS = {
  prompt: "",
  questionType: "mcq_single",
  options: "A\nB",
  correctAnswer: "",
  points: 1,
};

const BUNDLE_DEFAULTS = {
  title: "",
  description: "",
  discountPercent: 10,
  priceNaira: 0,
  isPublished: true,
};

function parseOptions(value) {
  return String(value || "")
    .split(/\r?\n/)
    .map((entry) => entry.trim())
    .filter(Boolean);
}

export function useCoursesWorkspace({ user, navRoute }) {
  const isAuthor = AUTHOR_ROLES.has(user.role);
  const isStudent = user.role === "student";

  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [courses, setCourses] = useState([]);
  const [bundles, setBundles] = useState([]);
  const [students, setStudents] = useState([]);
  const [cgpaSummary, setCgpaSummary] = useState(null);
  const [selectedCourseId, setSelectedCourseId] = useState("");
  const [details, setDetails] = useState(null);
  const [activeAssessmentId, setActiveAssessmentId] = useState("");
  const [activeAssessment, setActiveAssessment] = useState(null);
  const [answers, setAnswers] = useState({});
  const [courseForm, setCourseForm] = useState(COURSE_DEFAULTS);
  const [moduleForm, setModuleForm] = useState(MODULE_DEFAULTS);
  const [assessmentForm, setAssessmentForm] = useState(ASSESSMENT_DEFAULTS);
  const [questionForm, setQuestionForm] = useState(QUESTION_DEFAULTS);
  const [bundleForm, setBundleForm] = useState(BUNDLE_DEFAULTS);
  const [selectedStudentIds, setSelectedStudentIds] = useState([]);
  const [paymentDraft, setPaymentDraft] = useState({
    paymentMode: "transfer",
    paymentReference: "",
    paymentEvidenceUrl: "",
  });

  const selectedCourseSummaryById = useMemo(() => {
    const map = new Map();
    for (const row of cgpaSummary?.courses || []) map.set(row.courseId, row);
    return map;
  }, [cgpaSummary]);

  const loadWorkspace = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const requests = [apiGet("/courses"), apiGet("/course-bundles")];
      if (isAuthor) requests.push(apiGet("/students"));
      if (isStudent) requests.push(apiGet("/courses/cgpa/me"));
      const [coursesData, bundlesData, third, fourth] = await Promise.all(requests);

      setCourses(Array.isArray(coursesData) ? coursesData : []);
      setBundles(Array.isArray(bundlesData) ? bundlesData : []);
      setStudents(isAuthor ? (Array.isArray(third) ? third : []) : []);
      setCgpaSummary(isStudent ? fourth || third || null : null);
    } catch (err) {
      setError(err.message || "Failed to load courses workspace");
    } finally {
      setLoading(false);
    }
  }, [isAuthor, isStudent]);

  const loadCourseDetails = useCallback(async (courseId) => {
    if (!courseId) {
      setDetails(null);
      return;
    }

    try {
      setError("");
      const payload = await apiGet(`/courses/${courseId}`);
      setDetails(payload || null);
      setActiveAssessmentId("");
      setActiveAssessment(null);
      setAnswers({});
    } catch (err) {
      setError(err.message || "Failed to load course details");
      setDetails(null);
    }
  }, []);

  const openAssessment = useCallback(async (assessmentId) => {
    try {
      setError("");
      const payload = await apiGet(`/assessments/${assessmentId}`);
      setActiveAssessmentId(assessmentId);
      setActiveAssessment(payload || null);
      setAnswers({});
    } catch (err) {
      setError(err.message || "Failed to load assessment");
    }
  }, []);

  useEffect(() => {
    loadWorkspace();
  }, [loadWorkspace]);

  useEffect(() => {
    if (!courses.length) {
      setSelectedCourseId("");
      return;
    }

    if (!selectedCourseId || !courses.some((course) => course.id === selectedCourseId)) {
      setSelectedCourseId(courses[0].id);
    }
  }, [courses, selectedCourseId]);

  useEffect(() => {
    if (selectedCourseId) loadCourseDetails(selectedCourseId);
  }, [loadCourseDetails, selectedCourseId]);

  const createCourse = useCallback(
    async (event) => {
      event.preventDefault();
      if (!courseForm.title.trim()) {
        setError("Course title is required.");
        return;
      }
      try {
        setBusy(true);
        setError("");
        const created = await apiPost("/courses", {
          ...courseForm,
          title: courseForm.title.trim(),
          description: courseForm.description.trim(),
          creditUnits: Number(courseForm.creditUnits || 3),
          priceNaira: Number(courseForm.priceNaira || 0),
          studentIds: selectedStudentIds,
        });
        setNotice("Course created.");
        setCourseForm(COURSE_DEFAULTS);
        setSelectedStudentIds([]);
        await loadWorkspace();
        if (created?.id) setSelectedCourseId(created.id);
      } catch (err) {
        setError(err.message || "Failed to create course");
      } finally {
        setBusy(false);
      }
    },
    [courseForm, loadWorkspace, selectedStudentIds]
  );

  const createModule = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedCourseId || !moduleForm.title.trim()) {
        setError("Module title is required.");
        return;
      }
      try {
        setBusy(true);
        setError("");
        await apiPost(`/courses/${selectedCourseId}/modules`, {
          title: moduleForm.title.trim(),
          content: moduleForm.content.trim(),
        });
        setModuleForm(MODULE_DEFAULTS);
        setNotice("Module added.");
        await loadCourseDetails(selectedCourseId);
      } catch (err) {
        setError(err.message || "Failed to add module");
      } finally {
        setBusy(false);
      }
    },
    [loadCourseDetails, moduleForm, selectedCourseId]
  );

  const createAssessment = useCallback(
    async (event) => {
      event.preventDefault();
      if (!selectedCourseId || !assessmentForm.title.trim()) {
        setError("Assessment title is required.");
        return;
      }
      try {
        setBusy(true);
        setError("");
        await apiPost(`/courses/${selectedCourseId}/assessments`, {
          ...assessmentForm,
          title: assessmentForm.title.trim(),
          instructions: assessmentForm.instructions.trim(),
          weightPercent: Number(assessmentForm.weightPercent || 0),
          durationMinutes: Number(assessmentForm.durationMinutes || 30),
          passMark: Number(assessmentForm.passMark || 50),
          attemptsAllowed: Number(assessmentForm.attemptsAllowed || 1),
          dueAt: assessmentForm.dueAt
            ? new Date(assessmentForm.dueAt).toISOString()
            : null,
        });
        setAssessmentForm(ASSESSMENT_DEFAULTS);
        setNotice("Assessment created.");
        await loadCourseDetails(selectedCourseId);
      } catch (err) {
        setError(err.message || "Failed to create assessment");
      } finally {
        setBusy(false);
      }
    },
    [assessmentForm, loadCourseDetails, selectedCourseId]
  );

  const createQuestion = useCallback(async () => {
    if (!activeAssessmentId || !questionForm.prompt.trim()) {
      setError("Question prompt is required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await apiPost(`/assessments/${activeAssessmentId}/questions`, {
        ...questionForm,
        prompt: questionForm.prompt.trim(),
        options:
          questionForm.questionType === "mcq_single"
            ? parseOptions(questionForm.options)
            : [],
      });
      setQuestionForm(QUESTION_DEFAULTS);
      setNotice("Question added.");
      await openAssessment(activeAssessmentId);
    } catch (err) {
      setError(err.message || "Failed to add question");
    } finally {
      setBusy(false);
    }
  }, [activeAssessmentId, openAssessment, questionForm]);

  const submitAttempt = useCallback(async () => {
    if (!activeAssessmentId) return;
    try {
      setBusy(true);
      setError("");
      const result = await apiPost(`/assessments/${activeAssessmentId}/attempts`, {
        answers,
      });
      setNotice(
        `Attempt submitted: ${result.score}/${result.maxScore} (${result.percent}%).`
      );
      await Promise.all([
        openAssessment(activeAssessmentId),
        loadWorkspace(),
        loadCourseDetails(selectedCourseId),
      ]);
    } catch (err) {
      setError(err.message || "Failed to submit attempt");
    } finally {
      setBusy(false);
    }
  }, [activeAssessmentId, answers, loadCourseDetails, loadWorkspace, openAssessment, selectedCourseId]);

  const selectCourse = useCallback(async () => {
    if (!selectedCourseId || !details?.course) return;
    try {
      setBusy(true);
      setError("");
      await apiPost(`/courses/${selectedCourseId}/select`, {
        paymentMode:
          details.course.pricingType === "free" ? null : paymentDraft.paymentMode,
        paymentReference: paymentDraft.paymentReference || null,
        paymentEvidenceUrl: paymentDraft.paymentEvidenceUrl || null,
      });
      setNotice("Course selection submitted.");
      await Promise.all([loadWorkspace(), loadCourseDetails(selectedCourseId)]);
    } catch (err) {
      setError(err.message || "Failed to select this course");
    } finally {
      setBusy(false);
    }
  }, [details, loadCourseDetails, loadWorkspace, paymentDraft, selectedCourseId]);

  const confirmEnrollment = useCallback(
    async (studentId, status = "active") => {
      if (!selectedCourseId || !studentId) return;
      try {
        setBusy(true);
        setError("");
        await apiPost(`/courses/${selectedCourseId}/enrollments/${studentId}/confirm`, {
          status,
        });
        setNotice("Enrollment payment status updated.");
        await loadCourseDetails(selectedCourseId);
      } catch (err) {
        setError(err.message || "Failed to confirm enrollment");
      } finally {
        setBusy(false);
      }
    },
    [loadCourseDetails, selectedCourseId]
  );

  const createBundle = useCallback(
    async (event) => {
      event.preventDefault();
      if (!bundleForm.title.trim()) {
        setError("Bundle title is required.");
        return;
      }
      try {
        setBusy(true);
        setError("");
        await apiPost("/course-bundles", {
          ...bundleForm,
          title: bundleForm.title.trim(),
          description: bundleForm.description.trim(),
          discountPercent: Number(bundleForm.discountPercent || 0),
          priceNaira: Number(bundleForm.priceNaira || 0),
        });
        setBundleForm(BUNDLE_DEFAULTS);
        setNotice("Bundle created.");
        await loadWorkspace();
      } catch (err) {
        setError(err.message || "Failed to create bundle");
      } finally {
        setBusy(false);
      }
    },
    [bundleForm, loadWorkspace]
  );

  const attachCourseToBundle = useCallback(
    async (bundleId) => {
      if (!bundleId || !selectedCourseId) return;
      try {
        setBusy(true);
        setError("");
        await apiPost(`/course-bundles/${bundleId}/items`, {
          courseIds: [selectedCourseId],
          replace: false,
        });
        setNotice("Course attached to bundle.");
        await loadWorkspace();
      } catch (err) {
        setError(err.message || "Failed to attach course to bundle");
      } finally {
        setBusy(false);
      }
    },
    [loadWorkspace, selectedCourseId]
  );

  const selectBundle = useCallback(
    async (bundleId) => {
      if (!bundleId) return;
      try {
        setBusy(true);
        setError("");
        await apiPost(`/course-bundles/${bundleId}/select`, {
          paymentMode: paymentDraft.paymentMode,
          paymentReference: paymentDraft.paymentReference || null,
          paymentEvidenceUrl: paymentDraft.paymentEvidenceUrl || null,
        });
        setNotice("Bundle selection submitted.");
        await loadWorkspace();
      } catch (err) {
        setError(err.message || "Failed to select bundle");
      } finally {
        setBusy(false);
      }
    },
    [loadWorkspace, paymentDraft]
  );

  useEffect(() => {
    if (!navRoute?.ts) return;
    if (navRoute.module !== "courses") return;
    if (navRoute.entityType === "course" && navRoute.entityId) {
      setSelectedCourseId(navRoute.entityId);
    }
  }, [navRoute]);

  const onboardingItems = [
    {
      id: "course-selection",
      title: isStudent ? "Select a course" : "Create the first course",
      description: isStudent
        ? "Choose a course so CGPA and assessment tracking can begin."
        : "Create a course so academic work can move beyond isolated tasks.",
      done: isStudent
        ? Number(cgpaSummary?.selectedCoursesCount || 0) > 0
        : courses.length > 0,
      actionLabel: isStudent ? "Review Courses" : "Create Course",
      onAction: () => {
        document.getElementById("courses-list-card")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
    },
    {
      id: "assessment",
      title: isStudent ? "Open an assessment" : "Create an assessment",
      description: isStudent
        ? "Open a course assessment and start attempting practical work."
        : "Attach assessments so the course has measurable academic outcomes.",
      done: Boolean(details?.assessments?.length || activeAssessment),
      actionLabel: "Open Workspace",
      onAction: () => {
        document.getElementById("courses-detail-card")?.scrollIntoView({
          behavior: "smooth",
          block: "start",
        });
      },
    },
  ];

  const courseNeedsPayment =
    details?.course &&
    (details.course.pricingType === "paid" || details.course.pricingType === "bundle");
  const activeCoursesCount = Number(cgpaSummary?.activeCoursesCount || 0);
  const courseProgress = Number(cgpaSummary?.overallCourseProgress || 0);

  return {
    activeAssessment,
    activeAssessmentId,
    activeCoursesCount,
    answers,
    assessmentForm,
    attachCourseToBundle,
    bundleForm,
    bundles,
    busy,
    cgpaSummary,
    confirmEnrollment,
    courseForm,
    courseNeedsPayment,
    courseProgress,
    courses,
    createAssessment,
    createBundle,
    createCourse,
    createModule,
    createQuestion,
    details,
    error,
    isAuthor,
    isStudent,
    loadWorkspace,
    loading,
    moduleForm,
    notice,
    onboardingItems,
    openAssessment,
    paymentDraft,
    questionForm,
    selectBundle,
    selectCourse,
    selectedCourseId,
    selectedCourseSummaryById,
    selectedStudentIds,
    setAnswers,
    setAssessmentForm,
    setBundleForm,
    setCourseForm,
    setModuleForm,
    setNotice,
    setPaymentDraft,
    setQuestionForm,
    setSelectedCourseId,
    setSelectedStudentIds,
    students,
    submitAttempt,
  };
}
