import { useEffect, useMemo, useState } from "react";
import { apiGet } from "../lib/api";
import {
  GENDER_OPTIONS,
  NIGERIA_STATES,
  buildStateLgaIndex,
  getLgaOptionsForState,
} from "../lib/locationData";

// Convert uploaded profile image into preview-friendly data URL.
function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

function initialForm(user) {
  // Start form with user values so editing feels immediate.
  return {
    name: user?.name || "",
    email: user?.email || "",
    schoolId: user?.schoolId || "",
    grade: user?.grade || "",
    stateName: user?.stateName || "",
    lgaName: user?.lgaName || "",
    bio: user?.bio || "",
    avatarUrl: user?.avatarUrl || "",
    phone: user?.phone || "",
    dateOfBirth: user?.dateOfBirth || "",
    gender: user?.gender || "",
    addressLine: user?.addressLine || "",
    guardianName: user?.guardianName || "",
    bankName: user?.bankName || "",
    bankAccountName: user?.bankAccountName || "",
    bankAccountNumber: user?.bankAccountNumber || "",
    currentPassword: "",
    newPassword: "",
  };
}

export default function AccountModal({ user, busy, error, onClose, onSave }) {
  // Local form + helper states for account editing.
  const [form, setForm] = useState(() => initialForm(user));
  const [localError, setLocalError] = useState("");
  const [schools, setSchools] = useState([]);
  const [loadingSchools, setLoadingSchools] = useState(false);

  useEffect(() => {
    // When user object changes, reset form to latest profile.
    setForm(initialForm(user));
    setLocalError("");
  }, [user]);

  useEffect(() => {
    // Students can link school, so load school options for student role.
    let active = true;

    async function loadSchools() {
      if (user.role !== "student") return;
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

    loadSchools();
    return () => {
      active = false;
    };
  }, [user.role]);

  const selectedSchool = useMemo(
    () => schools.find((school) => school.id === form.schoolId) || null,
    [schools, form.schoolId]
  );
  const stateLgaIndex = useMemo(() => buildStateLgaIndex(schools), [schools]);

  const resolvedState = selectedSchool?.stateName || form.stateName;
  const resolvedLga = selectedSchool?.lgaName || form.lgaName;
  const lgaOptions = useMemo(
    () => getLgaOptionsForState(stateLgaIndex, resolvedState, [resolvedLga]),
    [stateLgaIndex, resolvedState, resolvedLga]
  );

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  function submit() {
    // Build safe payload and enforce role-specific constraints.
    const payload = {
      name: form.name.trim(),
      email: form.email.trim().toLowerCase(),
      bio: form.bio.trim() || null,
      avatarUrl: form.avatarUrl.trim() || null,
      phone: form.phone.trim() || null,
      dateOfBirth: form.dateOfBirth || null,
      gender: form.gender.trim() || null,
      addressLine: form.addressLine.trim() || null,
      guardianName: form.guardianName.trim() || null,
      bankName: form.bankName.trim() || null,
      bankAccountName: form.bankAccountName.trim() || null,
      bankAccountNumber: form.bankAccountNumber.trim() || null,
      currentPassword: form.currentPassword,
      newPassword: form.newPassword,
    };

    if (!payload.name || !payload.email) {
      setLocalError("Name and email are required.");
      return;
    }

    if (user.role === "student") {
      payload.schoolId = form.schoolId || null;
      payload.grade = form.grade.trim() || null;
      payload.stateName = resolvedState || null;
      payload.lgaName = resolvedLga || null;
    }

    if (user.role === "school") {
      payload.stateName = form.stateName.trim() || null;
      payload.lgaName = form.lgaName.trim() || null;
    }

    if (user.role === "state") {
      payload.stateName = form.stateName.trim();
      if (!payload.stateName) {
        setLocalError("State is required for state ministry accounts.");
        return;
      }
    }

    setLocalError("");
    onSave(payload);
  }

  async function handleAvatarFile(event) {
    // Basic guardrails for image type and size before preview/save.
    const file = event.target.files?.[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setLocalError("Please upload an image file for profile photo.");
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      setLocalError("Profile image must be 3MB or less.");
      return;
    }
    try {
      const dataUrl = await fileToDataUrl(file);
      setField("avatarUrl", dataUrl);
      setLocalError("");
    } catch {
      setLocalError("Unable to read selected image file.");
    }
  }

  return (
    <div
      className="modal-overlay"
      onClick={(event) => event.target === event.currentTarget && onClose()}
    >
      <div className="modal" style={{ maxWidth: 560 }}>
        <div className="modal-title">Account Settings</div>
        {(localError || error) && <div className="error-msg">{localError || error}</div>}

        <div className="field">
          <label>Display Name *</label>
          <input
            value={form.name}
            onChange={(event) => setField("name", event.target.value)}
          />
        </div>

        <div className="field">
          <label>Email Address *</label>
          <input
            type="email"
            value={form.email}
            onChange={(event) => setField("email", event.target.value)}
            autoComplete="email"
          />
        </div>

        <div className="field">
          <label>Profile Photo</label>
          <div className="profile-image-row">
            <input
              value={form.avatarUrl}
              onChange={(event) => setField("avatarUrl", event.target.value)}
              placeholder="Paste image URL or upload below"
            />
            <input type="file" accept="image/*" onChange={handleAvatarFile} />
          </div>
          {form.avatarUrl && (
            <div className="profile-image-preview-wrap">
              <img
                src={form.avatarUrl}
                alt="Profile preview"
                className="profile-image-preview"
              />
            </div>
          )}
        </div>

        <div className="field">
          <label>Short Bio</label>
          <textarea
            value={form.bio}
            onChange={(event) => setField("bio", event.target.value)}
            placeholder="Tell us about yourself..."
          />
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="field">
            <label>Phone</label>
            <input
              value={form.phone}
              onChange={(event) => setField("phone", event.target.value)}
              placeholder="+234..."
            />
          </div>
          <div className="field">
            <label>Date of Birth</label>
            <input
              type="date"
              value={form.dateOfBirth || ""}
              onChange={(event) => setField("dateOfBirth", event.target.value)}
            />
          </div>
        </div>

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="field">
            <label>Gender</label>
            <select
              value={form.gender}
              onChange={(event) => setField("gender", event.target.value)}
            >
              <option value="">Select gender</option>
              {GENDER_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </div>
          <div className="field">
            <label>Guardian Name</label>
            <input
              value={form.guardianName}
              onChange={(event) => setField("guardianName", event.target.value)}
              placeholder="Optional"
            />
          </div>
        </div>

        <div className="field">
          <label>Address</label>
          <input
            value={form.addressLine}
            onChange={(event) => setField("addressLine", event.target.value)}
            placeholder="Home address"
          />
        </div>

        <div className="panel-subtitle">Bank Details (for transfer/p2p payments)</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
          <div className="field">
            <label>Bank Name</label>
            <input
              value={form.bankName}
              onChange={(event) => setField("bankName", event.target.value)}
              placeholder="e.g. GTBank"
            />
          </div>
          <div className="field">
            <label>Account Name</label>
            <input
              value={form.bankAccountName}
              onChange={(event) => setField("bankAccountName", event.target.value)}
              placeholder="Account holder name"
            />
          </div>
        </div>
        <div className="field">
          <label>Account Number</label>
          <input
            value={form.bankAccountNumber}
            onChange={(event) => setField("bankAccountNumber", event.target.value)}
            placeholder="0123456789"
          />
        </div>

        {user.role === "student" && (
          <>
            <div className="field">
              <label>School (optional)</label>
              <select
                value={form.schoolId}
                disabled={loadingSchools}
                onChange={(event) => {
                  const schoolId = event.target.value;
                  const school = schools.find((entry) => entry.id === schoolId);
                  setField("schoolId", schoolId);
                  if (school) {
                    setField("stateName", school.stateName || "");
                    setField("lgaName", school.lgaName || "");
                  }
                }}
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
                  value={form.grade}
                  onChange={(event) => setField("grade", event.target.value)}
                />
              </div>
              <div className="field">
                <label>State</label>
                <select
                  value={resolvedState || ""}
                  onChange={(event) => {
                    setField("stateName", event.target.value);
                    setField("lgaName", "");
                  }}
                  disabled={Boolean(form.schoolId)}
                >
                  <option value="">Select state</option>
                  {NIGERIA_STATES.map((stateName) => (
                    <option key={stateName} value={stateName}>
                      {stateName}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="field">
              <label>LGA</label>
              <select
                value={resolvedLga || ""}
                onChange={(event) => setField("lgaName", event.target.value)}
                disabled={Boolean(form.schoolId)}
              >
                <option value="">
                  {resolvedState ? "Select LGA" : "Select state first"}
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

        {user.role === "school" && (
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
            <div className="field">
              <label>State</label>
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
              <label>LGA</label>
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
        )}

        {user.role === "state" && (
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

        <div className="modal-section">
          <div className="modal-section-title">Change Password</div>
          <div className="field">
            <label>Current Password</label>
            <input
              type="password"
              value={form.currentPassword}
              onChange={(event) => setField("currentPassword", event.target.value)}
              autoComplete="current-password"
            />
          </div>
          <div className="field">
            <label>New Password</label>
            <input
              type="password"
              value={form.newPassword}
              onChange={(event) => setField("newPassword", event.target.value)}
              autoComplete="new-password"
            />
          </div>
          <div className="panel-hint">Leave both password fields empty to keep current password.</div>
        </div>

        <div className="modal-actions">
          <button type="button" className="btn btn-ghost" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="btn btn-primary" onClick={submit} disabled={busy}>
            {busy ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}
