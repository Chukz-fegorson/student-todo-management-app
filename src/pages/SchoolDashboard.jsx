import { Suspense, lazy } from "react";
import SchoolTasksWorkspace from "../components/SchoolTasksWorkspace";
import WorkspaceOnboarding from "../components/WorkspaceOnboarding";
import { useSchoolWorkspace } from "../hooks/useSchoolWorkspace";

const CollaborationHubModal = lazy(
  () => import("../components/CollaborationHubModal")
);
const CoursesWorkspace = lazy(() => import("../components/CoursesWorkspace"));
const FeesWorkspace = lazy(() => import("../components/FeesWorkspace"));
const MarketplaceWorkspace = lazy(
  () => import("../components/MarketplaceWorkspace")
);

function ModuleFallback({ title }) {
  return (
    <div className="empty">
      <div className="empty-icon">...</div>
      <h3>{title}</h3>
      <p>StudyFlow is preparing this module.</p>
    </div>
  );
}

// This dashboard is used by school, state, and federal roles.
// It adapts behavior based on scope and permissions.
export default function SchoolDashboard({ user, navRoute, notificationSummary }) {
  const {
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
  } = useSchoolWorkspace({
    user,
    navRoute,
    notificationSummary,
  });

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
        description={
          user.role === "school"
            ? "Complete these setup actions so outcomes, communication, and revenue collection start from a clean operational base."
            : "Complete these setup actions so intervention, oversight, and academic monitoring start from a clean operational base."
        }
        items={onboardingItems}
      />

      <div className="view-tabs module-tabs">
        {moduleTabs.map((tab) => (
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
        <SchoolTasksWorkspace {...taskWorkspaceProps} />
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

          {notice && (
            <div className="notif-bar">
              <div className="notif notif-graded" onClick={dismissNotice}>
                {notice}
              </div>
            </div>
          )}

          {error && <div className="error-msg">{error}</div>}

          <Suspense
            fallback={<ModuleFallback title={`Loading ${activeModule.title}`} />}
          >
            {view === "courses" ? (
              <CoursesWorkspace user={user} navRoute={navRoute} />
            ) : view === "fees" ? (
              <FeesWorkspace user={user} navRoute={navRoute} />
            ) : view === "market" ? (
              <MarketplaceWorkspace user={user} navRoute={navRoute} />
            ) : (
              <CollaborationHubModal user={user} embedded navRoute={navRoute} />
            )}
          </Suspense>
        </>
      )}
    </div>
  );
}
