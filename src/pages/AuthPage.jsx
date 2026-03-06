import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, setToken } from "../lib/api";
import { ROLE_LABELS } from "../lib/constants";
import { setSession } from "../lib/storage";

const roleOptions = [
  { id: "student", label: ROLE_LABELS.student },
  { id: "school", label: ROLE_LABELS.school },
  { id: "state", label: ROLE_LABELS.state },
  { id: "federal", label: ROLE_LABELS.federal },
];

export default function AuthPage({ onLogin }) {
  const [tab, setTab] = useState("login");
  const [role, setRole] = useState("student");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    schoolId: "",
    schoolName: "",
    grade: "",
    stateName: "",
    lgaName: "",
    schoolSignupKey: "",
    stateSignupKey: "",
    federalSignupKey: "",
    resetToken: "",
    newPassword: "",
  });

  const email = useMemo(() => form.email.trim().toLowerCase(), [form.email]);
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    let active = true;

    async function loadSchools() {
      try {
        setLoadingSchools(true);
        const data = await apiGet("/directory/schools");
        if (!active) return;
        setSchools(Array.isArray(data) ? data : []);
      } catch {
        if (active) setSchools([]);
      } finally {
        if (active) setLoadingSchools(false);
      }
    }

    if (tab === "register") loadSchools();
    return () => {
      active = false;
    };
  }, [tab]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const resetToken = (params.get("resetToken") || "").trim();
    if (!resetToken) return;
    setTab("forgot");
    setField("resetToken", resetToken);
  }, []);

  async function login() {
    if (busy) return;
    setError("");
    setInfo("");

    try {
      setBusy(true);
      const data = await apiPost("/auth/login", {
        email,
        password: form.password,
      });

      setToken(data.token);
      setSession(data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  async function register() {
    if (busy) return;
    setError("");
    setInfo("");

    const payload = {
      role,
      name: form.name.trim(),
      email,
      password: form.password,
      schoolId: form.schoolId || null,
      schoolName: form.schoolName.trim() || null,
      grade: form.grade.trim() || null,
      stateName: form.stateName.trim() || null,
      lgaName: form.lgaName.trim() || null,
      schoolSignupKey: form.schoolSignupKey.trim() || null,
      stateSignupKey: form.stateSignupKey.trim() || null,
      federalSignupKey: form.federalSignupKey.trim() || null,
      signupKey:
        role === "school"
          ? form.schoolSignupKey.trim()
          : role === "state"
          ? form.stateSignupKey.trim()
          : role === "federal"
          ? form.federalSignupKey.trim()
          : "",
    };

    if (!payload.name || !payload.email || !payload.password) {
      setError("Name, email, and password are required.");
      return;
    }

    if (role === "school" && (!payload.schoolName || !payload.stateName || !payload.lgaName)) {
      setError("School, state, and LGA are required for school registration.");
      return;
    }

    if (role === "state" && !payload.stateName) {
      setError("State is required for state ministry registration.");
      return;
    }

    if (role !== "student" && !payload.signupKey) {
      setError("Signup key is required for this account type.");
      return;
    }

    try {
      setBusy(true);
      const data = await apiPost("/auth/register", payload);
      setToken(data.token);
      setSession(data.user);
      onLogin(data.user);
    } catch (err) {
      setError(err.message || "Registration failed");
    } finally {
      setBusy(false);
    }
  }

  async function requestPasswordReset() {
    if (busy) return;
    setError("");
    setInfo("");

    if (!email) {
      setError("Email is required.");
      return;
    }

    try {
      setBusy(true);
      const data = await apiPost("/auth/forgot-password", { email });
      setInfo(
        data?.message ||
          "If an account exists for that email, a reset token has been generated."
      );
      if (data?.debugResetToken) {
        setField("resetToken", data.debugResetToken);
      }
    } catch (err) {
      setError(err.message || "Failed to request password reset.");
    } finally {
      setBusy(false);
    }
  }

  async function resetPassword() {
    if (busy) return;
    setError("");
    setInfo("");

    const resetToken = form.resetToken.trim();
    const nextPassword = form.newPassword.trim();

    if (!resetToken || !nextPassword) {
      setError("Reset token and new password are required.");
      return;
    }

    try {
      setBusy(true);
      const data = await apiPost("/auth/reset-password", {
        token: resetToken,
        newPassword: nextPassword,
      });
      setInfo(data?.message || "Password reset successful. You can now sign in.");
      setField("password", "");
      setField("newPassword", "");
      setField("resetToken", "");
      setTab("login");
    } catch (err) {
      setError(err.message || "Failed to reset password.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">StudyFlow</div>
        <div className="auth-tagline">
          Role-based student task, submission, grading, and progress tracking
        </div>

        <div className="auth-tabs">
          <button
            type="button"
            className={`auth-tab ${tab === "login" ? "active" : ""}`}
            onClick={() => {
              setError("");
              setInfo("");
              setTab("login");
            }}
          >
            Sign In
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "register" ? "active" : ""}`}
            onClick={() => {
              setError("");
              setInfo("");
              setTab("register");
            }}
          >
            Register
          </button>
          <button
            type="button"
            className={`auth-tab ${tab === "forgot" ? "active" : ""}`}
            onClick={() => {
              setError("");
              setInfo("");
              setTab("forgot");
            }}
          >
            Reset
          </button>
        </div>

        {tab === "register" && (
          <>
            <div className="field">
              <label>Account Type</label>
              <div className="role-selector role-selector-4">
                {roleOptions.map((opt) => (
                  <button
                    key={opt.id}
                    type="button"
                    className={`role-btn ${role === opt.id ? "active" : ""}`}
                    onClick={() => setRole(opt.id)}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="field">
              <label>Display Name *</label>
              <input
                placeholder="e.g. Ada Okonkwo"
                value={form.name}
                onChange={(event) => setField("name", event.target.value)}
              />
            </div>

            {role === "student" && (
              <>
                <div className="field">
                  <label>School (optional)</label>
                  <select
                    value={form.schoolId}
                    onChange={(event) => {
                      const selected = schools.find((s) => s.id === event.target.value);
                      setField("schoolId", event.target.value);
                      setField("schoolName", selected?.name || "");
                      setField("stateName", selected?.stateName || "");
                      setField("lgaName", selected?.lgaName || "");
                    }}
                    disabled={loadingSchools}
                  >
                    <option value="">No linked school</option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name} - {school.lgaName}, {school.stateName}
                      </option>
                    ))}
                  </select>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="field">
                    <label>Grade / Class</label>
                    <input
                      placeholder="e.g. SS2"
                      value={form.grade}
                      onChange={(event) => setField("grade", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>State (optional)</label>
                    <input
                      placeholder="e.g. Lagos"
                      value={form.stateName}
                      onChange={(event) => setField("stateName", event.target.value)}
                    />
                  </div>
                </div>

                <div className="field">
                  <label>LGA (optional)</label>
                  <input
                    placeholder="e.g. Ikeja"
                    value={form.lgaName}
                    onChange={(event) => setField("lgaName", event.target.value)}
                  />
                </div>
              </>
            )}

            {role === "school" && (
              <>
                <div className="field">
                  <label>School / Institution Name *</label>
                  <input
                    placeholder="e.g. Lagos Model College"
                    value={form.schoolName}
                    onChange={(event) => setField("schoolName", event.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="field">
                    <label>State *</label>
                    <input
                      placeholder="e.g. Lagos"
                      value={form.stateName}
                      onChange={(event) => setField("stateName", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>LGA *</label>
                    <input
                      placeholder="e.g. Ikeja"
                      value={form.lgaName}
                      onChange={(event) => setField("lgaName", event.target.value)}
                    />
                  </div>
                </div>
              </>
            )}

            {role === "state" && (
              <div className="field">
                <label>State *</label>
                <input
                  placeholder="e.g. Kaduna"
                  value={form.stateName}
                  onChange={(event) => setField("stateName", event.target.value)}
                />
              </div>
            )}

            {role === "federal" && (
              <div className="field">
                <label>Federal Signup Key *</label>
                <input
                  placeholder="Secure invite key from administrator"
                  value={form.federalSignupKey}
                  onChange={(event) => setField("federalSignupKey", event.target.value)}
                />
              </div>
            )}

            {role === "school" && (
              <div className="field">
                <label>School Signup Key *</label>
                <input
                  placeholder="Secure invite key from administrator"
                  value={form.schoolSignupKey}
                  onChange={(event) => setField("schoolSignupKey", event.target.value)}
                />
              </div>
            )}

            {role === "state" && (
              <div className="field">
                <label>State Signup Key *</label>
                <input
                  placeholder="Secure invite key from administrator"
                  value={form.stateSignupKey}
                  onChange={(event) => setField("stateSignupKey", event.target.value)}
                />
              </div>
            )}
          </>
        )}

        {error && <div className="error-msg">{error}</div>}
        {info && <div className="info-msg">{info}</div>}

        {tab === "forgot" ? (
          <>
            <div className="field">
              <label>Email Address *</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                autoComplete="email"
              />
            </div>

            <button
              type="button"
              className="btn btn-ghost btn-full"
              disabled={busy}
              onClick={requestPasswordReset}
            >
              {busy ? "Please wait..." : "Generate Reset Token"}
            </button>

            <div className="field">
              <label>Reset Token *</label>
              <input
                placeholder="Paste reset token"
                value={form.resetToken}
                onChange={(event) => setField("resetToken", event.target.value)}
              />
            </div>

            <div className="field">
              <label>New Password *</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  style={{ flex: 1 }}
                  type={showPassword ? "text" : "password"}
                  placeholder="Set new password"
                  value={form.newPassword}
                  onChange={(event) => setField("newPassword", event.target.value)}
                  autoComplete="new-password"
                />
                <button
                  type="button"
                  className="btn-icon"
                  title={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            <button
              type="button"
              className="btn btn-primary btn-full"
              disabled={busy}
              onClick={resetPassword}
            >
              {busy ? "Please wait..." : "Reset Password"}
            </button>
          </>
        ) : (
          <>
            <div className="field">
              <label>Email Address *</label>
              <input
                type="email"
                placeholder="you@example.com"
                value={form.email}
                onChange={(event) => setField("email", event.target.value)}
                autoComplete="email"
              />
            </div>

            <div className="field">
              <label>Password *</label>
              <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                <input
                  style={{ flex: 1 }}
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={form.password}
                  onChange={(event) => setField("password", event.target.value)}
                  autoComplete={tab === "login" ? "current-password" : "new-password"}
                  onKeyDown={(event) => {
                    if (event.key === "Enter") {
                      if (tab === "login") login();
                      else register();
                    }
                  }}
                />
                <button
                  type="button"
                  className="btn-icon"
                  title={showPassword ? "Hide password" : "Show password"}
                  onClick={() => setShowPassword((prev) => !prev)}
                >
                  {showPassword ? "Hide" : "Show"}
                </button>
              </div>
            </div>

            {tab === "login" && (
              <button
                type="button"
                className="btn btn-ghost btn-full"
                disabled={busy}
                onClick={() => {
                  setError("");
                  setInfo("");
                  setTab("forgot");
                }}
              >
                Forgot Password?
              </button>
            )}

            <button
              type="button"
              className="btn btn-primary btn-full"
              disabled={busy}
              onClick={tab === "login" ? login : register}
            >
              {busy ? "Please wait..." : tab === "login" ? "Sign In" : "Create Account"}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
