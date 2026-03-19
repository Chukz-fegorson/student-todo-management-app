import GradeChip from "./GradeChip";
import GradeModal from "./GradeModal";
import PriBadge from "./PriBadge";
import {
  CATEGORIES,
  EDITABLE_STATUSES,
  PRIORITIES,
  STATUSES,
} from "../lib/constants";
import { effectiveProgress, formatDateTime } from "../lib/helpers";

export default function SchoolTasksWorkspace({
  analytics,
  assignment,
  error,
  filteredTasks,
  gradeModal,
  hasActiveFilters,
  isSchoolRole,
  isStateOrFederal,
  lgaFilter,
  lgaOptions,
  moduleHighlights,
  moduleMeta,
  modulePill,
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
  onAssignTask,
  onAssignmentFieldChange,
  onClearSelectedStudents,
  onCloseGradeModal,
  onDismissNotice,
  onExportCalendar,
  onGradeTask,
  onLoadDashboard,
  onOpenGradeModal,
  onResetFilters,
  onSelectAllVisibleStudents,
  onSetLgaFilter,
  onSetSchoolFilter,
  onSetStatusFilter,
  onToggleReminderOffset,
  onToggleStudentSelection,
}) {
  return (
    <>
      <section className="module-hero">
        <div className="module-hero-copy">
          <div className="module-kicker">{moduleMeta.kicker}</div>
          <div className="module-title-row">
            <h2>{moduleMeta.title}</h2>
            <span className="module-pill">{modulePill}</span>
          </div>
          <p>{moduleMeta.description}</p>
          <div className="module-highlight-row">
            {moduleHighlights.map((entry) => (
              <span key={entry} className="module-highlight-pill">
                {entry}
              </span>
            ))}
          </div>
        </div>

        <div className="module-actions">
          <button className="btn btn-primary" onClick={onAssignTask}>
            Assign Selected
          </button>
          <button className="btn btn-ghost" onClick={onLoadDashboard}>
            Refresh
          </button>
          <button className="btn btn-ghost" onClick={onExportCalendar}>
            Export Calendar (.ics)
          </button>
        </div>
      </section>

      {notice && (
        <div className="notif-bar">
          <div className="notif notif-graded" onClick={onDismissNotice}>
            {notice}
          </div>
        </div>
      )}

      {error && <div className="error-msg">{error}</div>}

      <section className="command-center-card">
        <div className="command-center-head">
          <div className="command-center-copy">
            <div className="panel-kicker">{roleLabel} control</div>
            <h3>{taskControlHeadline}</h3>
            <p>{taskControlCopy}</p>
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
            N{Number(scorecard?.feeMetrics?.paidAmountNaira || 0).toLocaleString()} paid
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
          <div className="stat-sub">Window: {scorecard?.windowDays || 30} days</div>
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
          <select
            value={statusFilter}
            onChange={(event) => onSetStatusFilter(event.target.value)}
          >
            <option value="All">All Statuses</option>
            {STATUSES.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>

          {isStateOrFederal && (
            <select
              value={lgaFilter}
              onChange={(event) => onSetLgaFilter(event.target.value)}
            >
              <option value="all">All LGAs</option>
              {lgaOptions.map((lga) => (
                <option key={lga} value={lga}>
                  {lga}
                </option>
              ))}
            </select>
          )}

          {!isSchoolRole && (
            <select
              value={schoolFilter}
              onChange={(event) => onSetSchoolFilter(event.target.value)}
            >
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
          Filtering {filteredTasks.length} task{filteredTasks.length === 1 ? "" : "s"} in
          scope
        </div>
      </div>

      <div className="workspace-grid workspace-grid-school">
        <section className="panel panel-elevated">
          <div className="panel-kicker">Create work</div>
          <div className="panel-title">Assign Task</div>
          <div className="panel-copy">
            Build the assignment once, then push it to selected students inside the
            current scope.
          </div>

          <div className="field">
            <label>Title *</label>
            <input
              value={assignment.title}
              onChange={(event) =>
                onAssignmentFieldChange("title", event.target.value)
              }
              placeholder="e.g. Literature Essay Draft"
            />
          </div>

          <div className="field">
            <label>Description</label>
            <textarea
              value={assignment.description}
              onChange={(event) =>
                onAssignmentFieldChange("description", event.target.value)
              }
            />
          </div>

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field">
              <label>Category</label>
              <select
                value={assignment.category}
                onChange={(event) =>
                  onAssignmentFieldChange("category", event.target.value)
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
                  onAssignmentFieldChange("priority", event.target.value)
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
                  onAssignmentFieldChange("status", event.target.value)
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
                  onAssignmentFieldChange("deadline", event.target.value)
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
                onAssignmentFieldChange("progress", Number(event.target.value))
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
                    onChange={() => onToggleReminderOffset(minutes)}
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
                  onAssignmentFieldChange("learningSummary", event.target.value)
                }
                placeholder="Provide expected summary content for submitted status."
              />
            </div>
          )}

          <div className="panel-subtitle">Select Students ({selectedStudentIds.length})</div>
          <div className="panel-actions">
            <button
              className="btn btn-ghost btn-sm"
              onClick={onSelectAllVisibleStudents}
            >
              Select All Visible
            </button>
            <button className="btn btn-ghost btn-sm" onClick={onClearSelectedStudents}>
              Clear
            </button>
          </div>

          <div className="student-picker">
            {visibleStudents.map((student) => (
              <label key={student.id} className="student-pick-row">
                <input
                  type="checkbox"
                  checked={selectedStudentIds.includes(student.id)}
                  onChange={() => onToggleStudentSelection(student.id)}
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
          </div>
          {!visibleStudents.length && (
            <div className="role-empty-state role-empty-state-compact">
              <strong>No students are visible in the current working scope.</strong>
              <p>
                {hasActiveFilters
                  ? "Current filters are hiding the assignment target. Clear filters or refresh scope before pushing the next task."
                  : "Refresh scope and confirm that approved students exist in this school or governance view before assigning work."}
              </p>
              <div className="role-empty-actions">
                {hasActiveFilters && (
                  <button className="btn btn-ghost btn-sm" onClick={onResetFilters}>
                    Clear Filters
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={onLoadDashboard}>
                  Refresh Scope
                </button>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary btn-full"
            onClick={onAssignTask}
            disabled={!selectedStudentIds.length || !assignment.title.trim()}
          >
            Assign Task to {selectedStudentIds.length || 0} Student(s)
          </button>
          {selectedVisibleCount > 0 && (
            <div className="panel-hint">
              {selectedVisibleCount} selected student(s) are in the current filter
              view.
            </div>
          )}
        </section>

        <section className="panel panel-elevated">
          <div className="panel-kicker">Review stream</div>
          <div className="panel-title">Review / Monitor Tasks ({filteredTasks.length})</div>
          <div className="panel-copy">
            Follow submissions, grading status, deadlines, and effective progress
            without leaving the review list.
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
                      onClick={() => onOpenGradeModal(task)}
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
            <div className="role-empty-state role-empty-state-compact">
              <strong>No tasks match the current review view.</strong>
              <p>
                {hasActiveFilters
                  ? "Expand the scope or show more statuses to bring back the right review queue."
                  : "Assign the next task or wait for submissions and grades to start building a stronger review stream."}
              </p>
              <div className="role-empty-actions">
                {statusFilter !== "All" && (
                  <button
                    className="btn btn-ghost btn-sm"
                    onClick={() => onSetStatusFilter("All")}
                  >
                    Show All Statuses
                  </button>
                )}
                {hasActiveFilters && (
                  <button className="btn btn-ghost btn-sm" onClick={onResetFilters}>
                    Clear Filters
                  </button>
                )}
                <button className="btn btn-primary btn-sm" onClick={onLoadDashboard}>
                  Refresh
                </button>
              </div>
            </div>
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
          onSave={onGradeTask}
          onClose={onCloseGradeModal}
        />
      )}
    </>
  );
}
