import { useEffect, useMemo, useState } from "react";
import { apiGet, apiPost, setToken } from "../lib/api";
import { PARENT_RELATIONSHIP_OPTIONS, ROLE_LABELS } from "../lib/constants";
import {
  NIGERIA_STATES,
  buildStateLgaIndex,
  getLgaOptionsForState,
} from "../lib/locationData";
import { setSession } from "../lib/storage";

const roleOptions = [
  { id: "student", label: ROLE_LABELS.student },
  { id: "parent", label: ROLE_LABELS.parent },
  { id: "school", label: ROLE_LABELS.school },
  { id: "state", label: ROLE_LABELS.state },
  { id: "federal", label: ROLE_LABELS.federal },
];

const AUTH_MODE_META = {
  login: {
    eyebrow: "Resume your workspace",
    description:
      "Return to the same role-aware workspace with the right priorities, alerts, and next actions already in context.",
    spotlight: [
      "The next task, risk, or payment item stays visible",
      "Role permissions and context come back exactly where you left them",
      "Alerts, receipts, reviews, and collaboration stay connected",
    ],
  },
  register: {
    eyebrow: "Choose the right role path",
    description:
      "Start with the role that matches your job in the education system so StudyFlow can optimize the product around outcomes, not menus.",
    spotlight: [
      "Students see what to do next and how they are tracking",
      "Parents get early visibility and a clearer support path",
      "Schools and ministries get intervention and operations visibility",
    ],
  },
  forgot: {
    eyebrow: "Recover access safely",
    description:
      "Generate a reset token, set a new password, and return without losing the role-specific context that drives your workspace.",
    spotlight: [
      "Recover the account tied to your workflow",
      "Keep the same scope, permissions, and linked context",
      "Return without rebuilding your setup or visibility",
    ],
  },
};

const ROLE_GUIDES = {
  student: {
    title: "Student command center",
    summary:
      "Start with a workspace that makes the next task, deadline risk, progress signal, and fee item obvious at a glance.",
    valuePoints: ["Next actions", "Deadline risk", "Progress clarity"],
    requirements: ["Select your school", "Use your real student email", "Add grade or class if available"],
  },
  parent: {
    title: "Parent oversight workspace",
    summary:
      "Get early visibility when your child is slipping and a direct way to leave support that stays close to the student workflow.",
    valuePoints: ["Early warnings", "Child progress", "Support actions"],
    requirements: ["Choose relationship type", "Enter your state and LGA", "Child link can be added now or later"],
  },
  school: {
    title: "School operations surface",
    summary:
      "Improve outcomes and collect revenue with less chaos by keeping assignments, fees, courses, and communication in one operational surface.",
    valuePoints: ["Outcomes", "Revenue flow", "Operational clarity"],
    requirements: ["Provide school name", "Choose state and LGA", "Enter the school signup key"],
  },
  state: {
    title: "State governance view",
    summary:
      "Spot weak schools, LGA pressure points, and intervention needs across your state before performance deterioration spreads.",
    valuePoints: ["Risk visibility", "LGA hotspots", "Intervention queue"],
    requirements: ["Choose your state", "Use the ministry signup key", "Continue into review and scorecards"],
  },
  federal: {
    title: "Federal coordination workspace",
    summary:
      "See where intervention is needed across states before failure compounds, while keeping the national picture tied to local execution.",
    valuePoints: ["National signals", "State comparison", "Intervention priorities"],
    requirements: ["Use the federal signup key", "Land in national dashboards", "Coordinate with school-level signal intact"],
  },
};

// AuthPage is the front door:
// sign in, register, and password reset live in one place.
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
    childEmail: "",
    childLinkCode: "",
    relationshipLabel: "",
    addressLine: "",
    resetToken: "",
    newPassword: "",
  });

  const email = useMemo(() => form.email.trim().toLowerCase(), [form.email]);
  const activeMode = AUTH_MODE_META[tab] || AUTH_MODE_META.login;
  const activeRoleGuide = ROLE_GUIDES[role] || ROLE_GUIDES.student;
  // Build state->LGA options from known schools so dropdowns stay contextual.
  const stateLgaIndex = useMemo(() => buildStateLgaIndex(schools), [schools]);
  const lgaOptions = useMemo(
    () => getLgaOptionsForState(stateLgaIndex, form.stateName, [form.lgaName]),
    [stateLgaIndex, form.stateName, form.lgaName]
  );
  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  useEffect(() => {
    // Load school list only when register tab is open.
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

  useEffect(() => {
    const root = document.getElementById("root");
    const html = document.documentElement;
    const body = document.body;

    [body, html, root].forEach((node) => {
      if (!node) return;
      node.style.pointerEvents = "auto";
      node.removeAttribute("inert");
    });

    if (body.style.overflow === "hidden") {
      body.style.overflow = "";
    }

    document
      .querySelectorAll(".modal-overlay")
      .forEach((overlay) => overlay.remove());

    document
      .querySelectorAll("[data-click-guard-disabled='true']")
      .forEach((node) => {
        node.style.pointerEvents = "";
        node.removeAttribute("data-click-guard-disabled");
      });
  }, [tab]);

  async function login() {
    // Authenticate and store token+session on success.
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
    // Create user account with role-aware required fields.
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
      childEmail: form.childEmail.trim().toLowerCase() || null,
      childLinkCode: form.childLinkCode.trim() || null,
      relationshipLabel: form.relationshipLabel.trim() || null,
      addressLine: form.addressLine.trim() || null,
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

    if (role === "student" && !payload.schoolId) {
      setError("School is required for student registration.");
      return;
    }

    if (role === "student" && (!payload.stateName || !payload.lgaName)) {
      setError("State and LGA are required for student registration.");
      return;
    }

    if (role === "school" && (!payload.schoolName || !payload.stateName || !payload.lgaName)) {
      setError("School, state, and LGA are required for school registration.");
      return;
    }

    if (role === "parent") {
      if (!payload.relationshipLabel) {
        setError("Relationship is required for parent/guardian registration.");
        return;
      }
      if (!payload.stateName || !payload.lgaName) {
        setError("State and LGA are required for parent/guardian registration.");
        return;
      }
      if (!payload.addressLine) {
        setError("Location / address is required for parent/guardian registration.");
        return;
      }
    }

    if (role === "state" && !payload.stateName) {
      setError("State is required for state ministry registration.");
      return;
    }

    if (["school", "state", "federal"].includes(role) && !payload.signupKey) {
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
    // Ask backend for a reset token workflow.
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
        <div className="auth-kicker">{activeMode.eyebrow}</div>
        <div className="auth-tagline">{activeMode.description}</div>

        <div className="auth-spotlight-grid">
          {activeMode.spotlight.map((entry) => (
            <article key={entry} className="auth-spotlight-item">
              <span className="auth-spotlight-dot" />
              <p>{entry}</p>
            </article>
          ))}
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
              <div className="role-selector role-selector-5">
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
              <div className="auth-role-guide">
                <div className="auth-role-guide-head">
                  <div>
                    <div className="auth-role-guide-kicker">{ROLE_LABELS[role]} path</div>
                    <strong>{activeRoleGuide.title}</strong>
                  </div>
                  <span className="auth-role-guide-badge">Guided setup</span>
                </div>
                <p>{activeRoleGuide.summary}</p>
                <div className="auth-role-guide-pills">
                  {activeRoleGuide.valuePoints.map((entry) => (
                    <span key={entry} className="auth-role-guide-pill">
                      {entry}
                    </span>
                  ))}
                </div>
                <div className="auth-role-guide-list">
                  {activeRoleGuide.requirements.map((entry) => (
                    <div key={entry} className="auth-role-guide-item">
                      <span className="auth-role-guide-mark">+</span>
                      <span>{entry}</span>
                    </div>
                  ))}
                </div>
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
                  <label>School *</label>
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
                    <option value="">
                      {loadingSchools ? "Loading schools..." : "Select school"}
                    </option>
                    {schools.map((school) => (
                      <option key={school.id} value={school.id}>
                        {school.name} - {school.lgaName}, {school.stateName}
                      </option>
                    ))}
                  </select>
                  {!loadingSchools && !schools.length && (
                    <div className="panel-hint">
                      No schools available yet. Register a school/teacher account first.
                    </div>
                  )}
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
                    <label>State *</label>
                    <select
                      value={form.stateName}
                      disabled
                    >
                      <option value="">
                        {form.schoolId ? "Auto from selected school" : "Select school first"}
                      </option>
                      {NIGERIA_STATES.map((stateName) => (
                        <option key={stateName} value={stateName}>
                          {stateName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>LGA *</label>
                  <select value={form.lgaName} disabled>
                    <option value="">
                      {form.schoolId ? "Auto from selected school" : "Select school first"}
                    </option>
                    {lgaOptions.map((lgaName) => (
                      <option key={lgaName} value={lgaName}>
                        {lgaName}
                      </option>
                    ))}
                  </select>
                </div>
              </>
            )}

            {role === "school" && (
              <>
                <div className="field">
                  <label>School / Teacher Name *</label>
                  <input
                    placeholder="e.g. Lagos Model College"
                    value={form.schoolName}
                    onChange={(event) => setField("schoolName", event.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="field">
                    <label>State *</label>
                    <select
                      value={form.stateName}
                      onChange={(event) => {
                        setField("stateName", event.target.value);
                        setField("lgaName", "");
                      }}
                    >
                      <option value="">Select state</option>
                      {NIGERIA_STATES.map((stateName) => (
                        <option key={stateName} value={stateName}>
                          {stateName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>LGA *</label>
                    <select
                      value={form.lgaName}
                      onChange={(event) => setField("lgaName", event.target.value)}
                      disabled={!form.stateName}
                    >
                      <option value="">{form.stateName ? "Select LGA" : "Select state first"}</option>
                      {lgaOptions.map((lgaName) => (
                        <option key={lgaName} value={lgaName}>
                          {lgaName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </>
            )}

            {role === "parent" && (
              <>
                <div className="field">
                  <label>Child Student Email (optional)</label>
                  <input
                    placeholder="e.g. student@email.com"
                    value={form.childEmail}
                    onChange={(event) => setField("childEmail", event.target.value)}
                  />
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="field">
                    <label>Student Link Code (optional)</label>
                    <input
                      placeholder="e.g. 8J4K2M7Q"
                      value={form.childLinkCode}
                      onChange={(event) => setField("childLinkCode", event.target.value)}
                    />
                  </div>
                  <div className="field">
                    <label>Relationship *</label>
                    <select
                      value={form.relationshipLabel}
                      onChange={(event) => setField("relationshipLabel", event.target.value)}
                    >
                      <option value="">Select relationship</option>
                      {PARENT_RELATIONSHIP_OPTIONS.map((entry) => (
                        <option key={entry} value={entry}>
                          {entry}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
                  <div className="field">
                    <label>State *</label>
                    <select
                      value={form.stateName}
                      onChange={(event) => {
                        setField("stateName", event.target.value);
                        setField("lgaName", "");
                      }}
                    >
                      <option value="">Select state</option>
                      {NIGERIA_STATES.map((stateName) => (
                        <option key={stateName} value={stateName}>
                          {stateName}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="field">
                    <label>LGA *</label>
                    <select
                      value={form.lgaName}
                      onChange={(event) => setField("lgaName", event.target.value)}
                      disabled={!form.stateName}
                    >
                      <option value="">{form.stateName ? "Select LGA" : "Select state first"}</option>
                      {lgaOptions.map((lgaName) => (
                        <option key={lgaName} value={lgaName}>
                          {lgaName}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="field">
                  <label>Location / Address *</label>
                  <input
                    placeholder="House address or nearest landmark"
                    value={form.addressLine}
                    onChange={(event) => setField("addressLine", event.target.value)}
                  />
                  </div>
                <div className="panel-hint">
                  You can still link your child later from the parent dashboard if you skip this now.
                </div>
              </>
            )}

            {role === "state" && (
              <div className="field">
                <label>State *</label>
                <select
                  value={form.stateName}
                  onChange={(event) => setField("stateName", event.target.value)}
                >
                  <option value="">Select state</option>
                  {NIGERIA_STATES.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </select>
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
              {busy
                ? "Please wait..."
                : tab === "login"
                  ? "Sign In"
                  : `Create ${ROLE_LABELS[role]} Account`}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
