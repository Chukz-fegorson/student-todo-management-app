import { useEffect, useState } from "react";
import { apiGet, apiPut } from "./lib/api";
import { clearAllAuth, getSession, setSession } from "./lib/storage";
import { ROLE_LABELS } from "./lib/constants";
import AuthPage from "./pages/AuthPage";
import StudentApp from "./pages/StudentApp";
import SchoolDashboard from "./pages/SchoolDashboard";
import AccountModal from "./components/AccountModal";
import NotificationCenter from "./components/NotificationCenter";

export default function App() {
  const [user, setUser] = useState(() => getSession());
  const [checkingSession, setCheckingSession] = useState(true);
  const [showAccountModal, setShowAccountModal] = useState(false);
  const [accountBusy, setAccountBusy] = useState(false);
  const [accountError, setAccountError] = useState("");
  const [showProfilePrompt, setShowProfilePrompt] = useState(false);

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
    // Guard against rare "stuck overlay/inert" states after auth transitions.
    const root = document.getElementById("root");
    const html = document.documentElement;
    document.body.style.pointerEvents = "auto";
    document.body.removeAttribute("inert");
    html.style.pointerEvents = "auto";
    html.removeAttribute("inert");
    document.body.setAttribute("data-app-ready", "true");

    if (root) {
      root.style.pointerEvents = "auto";
      root.removeAttribute("inert");
    }

    document.querySelectorAll(".modal-overlay").forEach((overlay) => {
      if (!overlay.querySelector(".modal")) overlay.remove();
    });

    return () => {
      document.body.removeAttribute("data-app-ready");
    };
  }, [user, checkingSession]);

  useEffect(() => {
    let active = true;

    async function verify() {
      if (!getSession()) {
        if (active) setCheckingSession(false);
        return;
      }

      try {
        const data = await apiGet("/me");
        if (!active) return;
        setUser(data.user);
      } catch {
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
    if (!user) {
      setShowProfilePrompt(false);
      return;
    }
    setShowProfilePrompt(isStudentProfileIncomplete(user));
  }, [user]);

  function handleLogout() {
    clearAllAuth();
    setShowAccountModal(false);
    setAccountError("");
    setUser(null);
  }

  async function handleAccountSave(payload) {
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
    return (
      <div className="loading-screen">
        <div className="loading-spinner" />
      </div>
    );
  }

  if (!user) return <AuthPage onLogin={setUser} />;

  const isStudent = user.role === "student";
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
