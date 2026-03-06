import { useEffect, useState } from "react";
import { apiGet, apiPut } from "./lib/api";
import { clearAllAuth, getSession, setSession } from "./lib/storage";
import { ROLE_LABELS } from "./lib/constants";
import AuthPage from "./pages/AuthPage";
import StudentApp from "./pages/StudentApp";
import SchoolDashboard from "./pages/SchoolDashboard";
import ParentDashboard from "./pages/ParentDashboard";
import AccountModal from "./components/AccountModal";
import NotificationCenter from "./components/NotificationCenter";

// This is the "traffic controller" of the frontend.
// It decides:
// 1) who is logged in,
// 2) which dashboard to show,
// 3) when account/profile helpers should appear.
export default function App() {
  // "user" is the current person using the app.
  const [user, setUser] = useState(() => getSession());
  // While true, we show a loading screen until session check is done.
  const [checkingSession, setCheckingSession] = useState(true);
  // Opens/closes the account settings popup.
  const [showAccountModal, setShowAccountModal] = useState(false);
  // Tracks save state/error when account settings are updated.
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");
  // Student-only helper banner to finish profile details.
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

  function ensureUiInteractive() {
    // Defensive unlock: keep app clickable even if a stale overlay/body state leaks in.
    const root = document.getElementById("root");
    const html = document.documentElement;
    const body = document.body;
    const overlays = Array.from(document.querySelectorAll(".modal-overlay"));

    [body, html, root].forEach((node) => {
      if (!node) return;
      node.style.pointerEvents = "auto";
      node.removeAttribute("inert");
    });

    overlays.forEach((overlay) => {
      const modal = overlay.querySelector(".modal");
      if (!modal) {
        overlay.remove();
        return;
      }
      const modalStyle = window.getComputedStyle(modal);
      const rect = modal.getBoundingClientRect();
      const hidden =
        modalStyle.display === "none" ||
        modalStyle.visibility === "hidden" ||
        rect.width <= 0 ||
        rect.height <= 0;
      if (hidden) overlay.remove();
    });

    if (!document.querySelector(".modal-overlay") && body.style.overflow === "hidden") {
      body.style.overflow = "";
    }

    // Fallback: disable unknown full-screen blockers that are not part of app UI.
    if (document.querySelector(".modal-overlay")) return;
    const probePoints = [
      [8, 8],
      [Math.floor(window.innerWidth / 2), Math.floor(window.innerHeight / 2)],
      [Math.max(8, window.innerWidth - 8), Math.max(8, window.innerHeight - 8)],
    ];
    for (const [x, y] of probePoints) {
      const topEl = document.elementFromPoint(x, y);
      if (!topEl) continue;
      if (
        topEl === document.documentElement ||
        topEl === document.body ||
        topEl.id === "root" ||
        topEl.closest(
          ".app-shell, .topnav, .main, .auth-page, .auth-card, .profile-prompt, .notif-popover, .modal, .modal-overlay"
        )
      ) {
        continue;
      }
      const style = window.getComputedStyle(topEl);
      const rect = topEl.getBoundingClientRect();
      const coversLargeArea =
        rect.width >= window.innerWidth * 0.7 && rect.height >= window.innerHeight * 0.7;
      if (
        style.pointerEvents !== "none" &&
        coversLargeArea
      ) {
        topEl.style.pointerEvents = "none";
        topEl.setAttribute("data-click-guard-disabled", "true");
      }
    }
  }

  // We use this small checker to know if student biodata is complete.
  function isStudentProfileIncomplete(nextUser) {
    if (!nextUser || nextUser.role !== "student") return false;
    const hasBio = String(nextUser.bio || "").trim().length > 0;
    const hasPhone = String(nextUser.phone || "").trim().length > 0;
    const hasDob = String(nextUser.dateOfBirth || "").trim().length > 0;
    return !(
      hasBio &&
      hasPhone &&
      hasDob
    );
  }

  useEffect(() => {
    // Keep interactivity healthy after auth transitions and during long-lived sessions.
    ensureUiInteractive();
    document.body.setAttribute("data-app-ready", "true");

    const timer = window.setInterval(ensureUiInteractive, 500);
    window.addEventListener("focus", ensureUiInteractive);
    document.addEventListener("visibilitychange", ensureUiInteractive);

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("focus", ensureUiInteractive);
      document.removeEventListener("visibilitychange", ensureUiInteractive);
      document.body.removeAttribute("data-app-ready");
    };
  }, [user, checkingSession]);

  useEffect(() => {
    // On app start, ask backend "who am I?" if local session exists.
    let active = true;

    async function verify() {
      if (!getSession()) {
        if (active) setCheckingSession(false);
        return;
      }

      try {
        const data = await apiGet("/me");
        if (!active) return;
        // Backend is source of truth for freshest user profile.
        setUser(data.user);
      } catch {
        // If session is bad/expired, clear local auth and go to login screen.
        clearAllAuth();
        if (active) setUser(null);
      } finally {
        if (active) setCheckingSession(false);
      }
    }

    verify();
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    // Show biodata reminder only when needed.
    if (!user) {
      setShowProfilePrompt(false);
      return;
    }
    setShowProfilePrompt(isStudentProfileIncomplete(user));
  }, [user]);

  function handleLogout() {
    // Clear token/session and return to auth page.
    clearAllAuth();
    setShowAccountModal(false);
    setAccountError("");
    setUser(null);
  }

  async function handleAccountSave(payload) {
    // Save profile changes to backend, then refresh local session copy.
    try {
      setAccountError("");
      setAccountBusy(true);
      const data = await apiPut("/me", payload);
      setSession(data.user);
      setUser(data.user);
      setShowAccountModal(false);
      setShowProfilePrompt(isStudentProfileIncomplete(data.user));
    } catch (err) {
      setAccountError(err.message || "Failed to update account");
    } finally {
      setAccountBusy(false);
    }
  }

  if (checkingSession) {
    // Friendly loading shell while auth/session bootstraps.
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return <AuthPage onLogin={setUser} />;

  // One app, two role-led dashboard experiences.
  const isStudent = user.role === "student";
  const isParent = user.role === "parent";
  const roleLabel = ROLE_LABELS[user.role] || "User";

  return (
    <div className="app-shell">
      <nav className="topnav">
        <div className="nav-logo">StudyFlow</div>

        <div className="nav-user">
          <div>
            <div className="nav-name">{user.name}</div>
            <div style={{ fontSize: "0.72rem", color: "var(--muted)" }}>
              {user.schoolName || user.stateName || user.email}
            </div>
          </div>

          <div
            className={`avatar ${
              isStudent ? "avatar-student" : "avatar-school"
            }`}
          >
            {user.avatarUrl ? (
              <img src={user.avatarUrl} alt={user.name} className="avatar-img" />
            ) : (
              (user.name?.[0] || "?").toUpperCase()
            )}
          </div>

          <span
            className={`role-badge ${
              isStudent ? "role-badge-student" : "role-badge-school"
            }`}
          >
            {roleLabel}
          </span>

          <NotificationCenter />
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => {
              setAccountError("");
              setShowAccountModal(true);
            }}
          >
            Account
          </button>
          <button className="btn btn-ghost btn-sm" onClick={handleLogout}>
            Sign Out
          </button>
        </div>
      </nav>

      {showProfilePrompt && (
        <div className="profile-prompt">
          <strong>Complete your biodata.</strong> Add your bio, phone, and date of
          birth so StudyFlow can personalize your student experience.
          <button
            className="btn btn-primary btn-sm"
            onClick={() => {
              setAccountError("");
              setShowAccountModal(true);
            }}
          >
            Update Biodata
          </button>
          <button
            className="btn btn-ghost btn-sm"
            onClick={() => setShowProfilePrompt(false)}
          >
            Later
          </button>
        </div>
      )}

      {isStudent ? (
        <StudentApp user={user} />
      ) : isParent ? (
        <ParentDashboard user={user} />
      ) : (
        <SchoolDashboard user={user} />
      )}

      {showAccountModal && (
        <AccountModal
          user={user}
          busy={accountBusy}
          error={accountError}
          onSave={handleAccountSave}
          onClose={() => {
            setAccountError("");
            setShowAccountModal(false);
          }}
        />
      )}
    </div>
  );
}
