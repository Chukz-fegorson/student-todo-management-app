import { formatDateTime } from "../lib/helpers";
import { useCoursesWorkspace } from "../hooks/useCoursesWorkspace";
import WorkspaceOnboarding from "./WorkspaceOnboarding";

function toNaira(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

function toggleId(list, id) {
  return list.includes(id) ? list.filter((entry) => entry !== id) : [...list, id];
}

export default function CoursesWorkspace({ user, navRoute }) {
  const {
    activeAssessment,
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
    setPaymentDraft,
    setQuestionForm,
    setSelectedCourseId,
    setSelectedStudentIds,
    students,
    submitAttempt,
  } = useCoursesWorkspace({ user, navRoute });

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">...</div>
        <h3>Loading courses workspace</h3>
        <p>Courses, bundles, assessments, and CGPA summaries are being prepared.</p>
      </div>
    );
  }

  const activeCoursesCount = Number(cgpaSummary?.activeCoursesCount || 0);

  return (
    <>
      <WorkspaceOnboarding
        user={user}
        workspaceKey={`courses_${isStudent ? "student" : "author"}`}
        title="Set up course delivery"
        description="Use this workspace to structure learning, practical tests, grading weight, and enrollment flow."
        items={onboardingItems}
      />

      <section className="module-hero module-hero-compact">
        <div className="module-hero-copy">
          <div className="module-kicker">Courses</div>
          <div className="module-title-row">
            <h2>{isStudent ? "Learning and Assessment" : "Course Delivery and Structure"}</h2>
            <span className="module-pill">
              {courses.length} course{courses.length === 1 ? "" : "s"}
            </span>
          </div>
          <p>
            {isStudent
              ? "Select courses, unlock paid content where needed, attempt assessments, and keep CGPA-linked progress visible."
              : "Create courses, modules, assessments, questions, and bundles from one academic delivery workspace."}
          </p>
          <div className="module-highlight-row">
            <span className="module-highlight-pill">
              {bundles.length} bundle{bundles.length === 1 ? "" : "s"}
            </span>
            {isStudent ? (
              <>
                <span className="module-highlight-pill">
                  {activeCoursesCount} active course{activeCoursesCount === 1 ? "" : "s"}
                </span>
                <span className="module-highlight-pill">
                  CGPA {Number(cgpaSummary?.cgpa || 0).toFixed(2)} | Progress {courseProgress}%
                </span>
              </>
            ) : (
              <span className="module-highlight-pill">
                {students.length} student{students.length === 1 ? "" : "s"} in author scope
              </span>
            )}
          </div>
        </div>
      </section>

      <div className="dashboard-grid courses-grid">
      <section className="panel panel-elevated" id="courses-list-card">
        <div className="panel-title">Courses ({courses.length})</div>
        {notice && <div className="info-msg">{notice}</div>}
        {error && <div className="error-msg">{error}</div>}
        <div className="panel-actions">
          <button className="btn btn-ghost btn-sm" onClick={loadWorkspace} disabled={busy}>Refresh</button>
        </div>

        {isStudent && cgpaSummary && (
          <div className="review-card">
            <div className="review-card-title">CGPA: {Number(cgpaSummary.cgpa || 0).toFixed(2)}</div>
            <div className="calendar-meta">
              Scale: {String(cgpaSummary.gradingScale || "ng_5").toUpperCase()} | Active: {cgpaSummary.activeCoursesCount} | Progress: {cgpaSummary.overallCourseProgress}%
            </div>
          </div>
        )}

        {isAuthor && (
          <form onSubmit={createCourse} className="review-card">
            <div className="panel-subtitle">Create Course</div>
            <div className="field"><label>Title</label><input value={courseForm.title} onChange={(event) => setCourseForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
            <div className="field"><label>Description</label><textarea value={courseForm.description} onChange={(event) => setCourseForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" }}>
              <div className="field"><label>Credit Units</label><input type="number" min="1" max="10" value={courseForm.creditUnits} onChange={(event) => setCourseForm((prev) => ({ ...prev, creditUnits: Number(event.target.value) }))} /></div>
              <div className="field"><label>Pricing Type</label><select value={courseForm.pricingType} onChange={(event) => setCourseForm((prev) => ({ ...prev, pricingType: event.target.value }))}><option value="free">Free</option><option value="paid">Paid</option><option value="bundle">Bundle-priced</option></select></div>
            </div>
            {courseForm.pricingType !== "free" && (
              <div className="field"><label>Price (Naira)</label><input type="number" min="0" value={courseForm.priceNaira} onChange={(event) => setCourseForm((prev) => ({ ...prev, priceNaira: Number(event.target.value) }))} /></div>
            )}
            {!!students.length && <div className="student-picker">{students.map((student) => (<label key={student.id} className="student-pick-row"><input type="checkbox" checked={selectedStudentIds.includes(student.id)} onChange={() => setSelectedStudentIds((prev) => toggleId(prev, student.id))} /><span>{student.name}</span></label>))}</div>}
            <button className="btn btn-primary btn-full" type="submit" disabled={busy}>Create Course</button>
          </form>
        )}

        <div className="calendar-list">
          {courses.map((course) => {
            const selected = selectedCourseSummaryById.get(course.id);
            return (
              <button key={course.id} className={`review-card course-list-card ${selectedCourseId === course.id ? "course-list-card-active" : ""}`} onClick={() => setSelectedCourseId(course.id)}>
                <div className="review-card-title">{course.title}</div>
                <div className="calendar-meta">
                  {course.ownerRole} | {course.creditUnits} units | {course.pricingType === "free" ? "Free" : toNaira(course.priceNaira)}
                </div>
                {selected && <div className="calendar-meta">Status: {selected.paymentStatus} | Score: {selected.courseScore}%</div>}
              </button>
            );
          })}
          {!courses.length && <div className="empty-col">No courses available.</div>}
        </div>
      </section>

      <section className="panel panel-elevated" id="courses-detail-card">
        {!details ? (
          <div className="empty-col">Select a course to continue.</div>
        ) : (
          <>
            <div className="panel-title">{details.course?.title}</div>
            <div className="review-summary-box">{details.course?.description || "No description."}</div>
            <div className="review-card-meta">
              <span>{details.course?.creditUnits} units</span>
              <span>|</span>
              <span>{details.course?.pricingType === "free" ? "Free" : toNaira(details.course?.priceNaira)}</span>
              <span>|</span>
              <span>Selected: {details.myEnrollment ? details.myEnrollment.paymentStatus : "No"}</span>
            </div>

            {isStudent && !details.canAttemptAssessments && (
              <div className="review-card" style={{ marginTop: "0.8rem" }}>
                <div className="panel-subtitle">Select / Unlock Course</div>
                {courseNeedsPayment && (
                  <>
                    <div className="field"><label>Payment mode</label><select value={paymentDraft.paymentMode} onChange={(event) => setPaymentDraft((prev) => ({ ...prev, paymentMode: event.target.value }))}><option value="transfer">Transfer</option><option value="cash">Cash</option><option value="wallet">Wallet</option></select></div>
                    <div className="field"><label>Payment reference</label><input value={paymentDraft.paymentReference} onChange={(event) => setPaymentDraft((prev) => ({ ...prev, paymentReference: event.target.value }))} /></div>
                    <div className="field"><label>Payment evidence URL (optional)</label><input value={paymentDraft.paymentEvidenceUrl} onChange={(event) => setPaymentDraft((prev) => ({ ...prev, paymentEvidenceUrl: event.target.value }))} /></div>
                  </>
                )}
                <button className="btn btn-primary" onClick={selectCourse} disabled={busy}>
                  {courseNeedsPayment ? "Submit Selection & Payment Info" : "Select Course"}
                </button>
              </div>
            )}

            {isAuthor && (
              <div className="dashboard-grid" style={{ marginTop: "0.8rem" }}>
                <form onSubmit={createModule} className="panel">
                  <div className="panel-subtitle">Add Module</div>
                  <div className="field"><label>Title</label><input value={moduleForm.title} onChange={(event) => setModuleForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
                  <div className="field"><label>Content</label><textarea value={moduleForm.content} onChange={(event) => setModuleForm((prev) => ({ ...prev, content: event.target.value }))} /></div>
                  <button className="btn btn-primary btn-full" type="submit" disabled={busy}>Add Module</button>
                </form>
                <form onSubmit={createAssessment} className="panel">
                  <div className="panel-subtitle">Create Assessment</div>
                  <div className="field"><label>Title</label><input value={assessmentForm.title} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
                  <div className="field"><label>Type</label><select value={assessmentForm.assessmentType} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, assessmentType: event.target.value }))}><option value="assignment">Assignment</option><option value="test">Test</option><option value="project">Project</option><option value="exam">Exam</option><option value="practice">Practice</option></select></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div className="field"><label>Weight %</label><input type="number" min="0" max="100" value={assessmentForm.weightPercent} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, weightPercent: Number(event.target.value) }))} /></div>
                    <div className="field"><label>Due date</label><input type="datetime-local" value={assessmentForm.dueAt} onChange={(event) => setAssessmentForm((prev) => ({ ...prev, dueAt: event.target.value }))} /></div>
                  </div>
                  <button className="btn btn-primary btn-full" type="submit" disabled={busy}>Create Assessment</button>
                </form>
              </div>
            )}

            <div className="panel-subtitle" style={{ marginTop: "0.8rem" }}>Assessments</div>
            <div className="calendar-list">
              {(details.assessments || []).map((assessment) => (
                <div key={assessment.id} className="review-card">
                  <div className="review-card-header">
                    <div>
                      <div className="review-card-title">{assessment.title}</div>
                      <div className="calendar-meta">{assessment.assessmentType} | Weight {assessment.weightPercent}% | Due {assessment.dueAt ? formatDateTime(assessment.dueAt) : "Not set"}</div>
                    </div>
                    <button className="btn btn-purple btn-sm" onClick={() => openAssessment(assessment.id)}>Open</button>
                  </div>
                </div>
              ))}
              {!details.assessments?.length && <div className="empty-col">No assessments yet.</div>}
            </div>

            {activeAssessment && (
              <section className="panel" style={{ marginTop: "0.8rem" }}>
                <div className="panel-title">{activeAssessment.assessment?.title}</div>
                {(activeAssessment.questions || []).map((question, index) => (
                  <div key={question.id} className="review-card">
                    <div className="review-card-title">Q{index + 1}. {question.prompt}</div>
                    {question.questionType === "mcq_single" ? (
                      <div className="check-row">
                        {(question.options || []).map((option) => (
                          <label key={option} className="check-item">
                            <input type="radio" name={question.id} checked={answers[question.id] === option} onChange={() => setAnswers((prev) => ({ ...prev, [question.id]: option }))} />
                            {option}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <div className="field"><input value={answers[question.id] || ""} onChange={(event) => setAnswers((prev) => ({ ...prev, [question.id]: event.target.value }))} /></div>
                    )}
                    {!isStudent && question.correctAnswer && <div className="calendar-meta">Answer: {question.correctAnswer}</div>}
                  </div>
                ))}

                {isStudent && details.canAttemptAssessments && (
                  <button className="btn btn-primary" onClick={submitAttempt} disabled={busy}>Submit Attempt</button>
                )}

                {isAuthor && (
                  <div className="review-card">
                    <div className="panel-subtitle">Add Question</div>
                    <div className="field"><label>Prompt</label><textarea value={questionForm.prompt} onChange={(event) => setQuestionForm((prev) => ({ ...prev, prompt: event.target.value }))} /></div>
                    <div className="field"><label>Type</label><select value={questionForm.questionType} onChange={(event) => setQuestionForm((prev) => ({ ...prev, questionType: event.target.value }))}><option value="mcq_single">MCQ</option><option value="short_text">Short Text</option></select></div>
                    {questionForm.questionType === "mcq_single" && <div className="field"><label>Options</label><textarea value={questionForm.options} onChange={(event) => setQuestionForm((prev) => ({ ...prev, options: event.target.value }))} /></div>}
                    <div className="field"><label>Correct answer</label><input value={questionForm.correctAnswer} onChange={(event) => setQuestionForm((prev) => ({ ...prev, correctAnswer: event.target.value }))} /></div>
                    <button className="btn btn-purple" onClick={createQuestion} disabled={busy}>Add Question</button>
                  </div>
                )}

                <div className="panel-subtitle">Attempts</div>
                <div className="calendar-list">
                  {(activeAssessment.attempts || []).map((attempt) => (
                    <div key={attempt.id} className="review-card">
                      <div className="review-card-title">{attempt.studentName || "Student"}</div>
                      <div className="calendar-meta">{attempt.score}/{attempt.maxScore} ({attempt.percent}%) | {attempt.passed ? "Passed" : "Not passed"} | {formatDateTime(attempt.createdAt)}</div>
                    </div>
                  ))}
                  {!activeAssessment.attempts?.length && <div className="empty-col">No attempts yet.</div>}
                </div>
              </section>
            )}

            {isAuthor && (
              <section className="panel" style={{ marginTop: "0.8rem" }}>
                <div className="panel-subtitle">Enrollment Requests</div>
                <div className="calendar-list">
                  {(details.enrollments || []).map((entry) => (
                    <div key={entry.studentId} className="review-card">
                      <div className="review-card-header">
                        <div>
                          <div className="review-card-title">{entry.studentName}</div>
                          <div className="calendar-meta">{entry.paymentStatus} | {entry.enrollmentType}</div>
                        </div>
                        {entry.paymentStatus !== "active" && (
                          <button className="btn btn-primary btn-sm" onClick={() => confirmEnrollment(entry.studentId, "active")} disabled={busy}>Confirm</button>
                        )}
                      </div>
                    </div>
                  ))}
                  {!details.enrollments?.length && <div className="empty-col">No enrollment requests yet.</div>}
                </div>
              </section>
            )}

            <section className="panel" style={{ marginTop: "0.8rem" }}>
              <div className="panel-subtitle">Bundles ({bundles.length})</div>
              {isAuthor && (
                <form onSubmit={createBundle} className="review-card">
                  <div className="field"><label>Bundle title</label><input value={bundleForm.title} onChange={(event) => setBundleForm((prev) => ({ ...prev, title: event.target.value }))} /></div>
                  <div className="field"><label>Description</label><textarea value={bundleForm.description} onChange={(event) => setBundleForm((prev) => ({ ...prev, description: event.target.value }))} /></div>
                  <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
                    <div className="field"><label>Discount %</label><input type="number" min="0" max="90" value={bundleForm.discountPercent} onChange={(event) => setBundleForm((prev) => ({ ...prev, discountPercent: Number(event.target.value) }))} /></div>
                    <div className="field"><label>Bundle price (Naira)</label><input type="number" min="0" value={bundleForm.priceNaira} onChange={(event) => setBundleForm((prev) => ({ ...prev, priceNaira: Number(event.target.value) }))} /></div>
                  </div>
                  <button className="btn btn-primary" type="submit" disabled={busy}>Create Bundle</button>
                </form>
              )}

              <div className="calendar-list">
                {bundles.map((bundle) => (
                  <div key={bundle.id} className="review-card">
                    <div className="review-card-header">
                      <div>
                        <div className="review-card-title">{bundle.title}</div>
                        <div className="calendar-meta">
                          {bundle.courses?.length || bundle.coursesCount || 0} courses | Discount {bundle.discountPercent}% | {bundle.priceNaira > 0 ? toNaira(bundle.priceNaira) : "Price auto by discount"}
                        </div>
                      </div>
                      {isAuthor ? (
                        <button className="btn btn-ghost btn-sm" onClick={() => attachCourseToBundle(bundle.id)} disabled={busy || !selectedCourseId}>
                          Add Current Course
                        </button>
                      ) : (
                        <button className="btn btn-purple btn-sm" onClick={() => selectBundle(bundle.id)} disabled={busy}>
                          Select Bundle
                        </button>
                      )}
                    </div>
                  </div>
                ))}
                {!bundles.length && <div className="empty-col">No bundles yet.</div>}
              </div>
            </section>
          </>
        )}
      </section>
      </div>
    </>
  );
}
