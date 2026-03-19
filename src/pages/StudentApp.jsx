import CollaborationHubModal from "../components/CollaborationHubModal";
import CoursesWorkspace from "../components/CoursesWorkspace";
import DeleteModal from "../components/DeleteModal";
import FeesWorkspace from "../components/FeesWorkspace";
import MarketplaceWorkspace from "../components/MarketplaceWorkspace";
import StudentTasksWorkspace from "../components/StudentTasksWorkspace";
import TodoModal from "../components/TodoModal";
import WorkspaceOnboarding from "../components/WorkspaceOnboarding";
import {
  STUDENT_MODULE_TABS,
  useStudentWorkspace,
} from "../hooks/useStudentWorkspace";

// StudentApp is the student's "home room":
// tasks, collaboration, fees, and marketplace all live here as module tabs.
export default function StudentApp({
  user,
  navRoute,
  onNavigate,
  notificationSummary,
}) {
  const {
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
    showModal,
    taskWorkspaceProps,
    view,
  } = useStudentWorkspace({
    user,
    navRoute,
    onNavigate,
    notificationSummary,
  });

  return (
    <div className="main">
      <WorkspaceOnboarding
        user={user}
        workspaceKey="student_home"
        title="Set up your student workspace"
        description="Finish these first actions so StudyFlow can show what to do next, track progress clearly, and warn you before deadlines slip."
        items={onboardingItems}
      />

      <div className="view-tabs module-tabs">
        {STUDENT_MODULE_TABS.map((tab) => (
          <button
            key={tab.id}
            className={`view-tab module-tab ${view === tab.id ? "active" : ""}`}
            onClick={() => openModule(tab.id)}
          >
            {tab.label}
            {moduleTabCounts[tab.id] > 0 && (
              <span className="module-tab-badge">{moduleTabCounts[tab.id]}</span>
            )}
          </button>
        ))}
      </div>

      {view === "tasks" ? (
        <StudentTasksWorkspace {...taskWorkspaceProps} />
      ) : (
        <>
          <section className="module-hero">
            <div className="module-hero-copy">
              <div className="module-kicker">{activeModule.kicker}</div>
              <div className="module-title-row">
                <h2>{activeModule.title}</h2>
                <span className="module-pill">{activeModulePill}</span>
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
          </section>

          {notif && (
            <div className="notif-bar">
              <div
                className="notif notif-graded"
                onClick={taskWorkspaceProps.onDismissNotif}
              >
                {notif}
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          {view === "courses" ? (
            <CoursesWorkspace user={user} navRoute={navRoute} />
          ) : view === "fees" ? (
            <FeesWorkspace user={user} navRoute={navRoute} />
          ) : view === "market" ? (
            <MarketplaceWorkspace user={user} navRoute={navRoute} />
          ) : (
            <CollaborationHubModal user={user} embedded navRoute={navRoute} />
          )}
        </>
      )}

      {showModal && (
        <TodoModal todo={editing} onSave={saveTodo} onClose={closeTodoModal} />
      )}

      {deleting && (
        <DeleteModal
          todo={deleting}
          onConfirm={deleteTodo}
          onClose={closeDeleteModal}
        />
      )}
    </div>
  );
}
