import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { formatDateTime } from "../lib/helpers";

function amountNairaFromInvoice(invoice) {
  if (Number.isFinite(Number(invoice.amountNaira))) return Number(invoice.amountNaira);
  return Number(invoice.amountKobo || 0) / 100;
}

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read receipt file"));
    reader.readAsDataURL(file);
  });
}

export default function FeesWorkspace({ user }) {
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [planForm, setPlanForm] = useState({
    title: "",
    amountNaira: "",
    termLabel: "",
    academicSession: "",
    description: "",
  });
  const [invoiceForm, setInvoiceForm] = useState({
    studentIds: [],
    planId: "",
    title: "",
    amountNaira: "",
    dueAt: "",
    description: "",
  });
  const [paymentDrafts, setPaymentDrafts] = useState({});
  const [schoolReceiptNotes, setSchoolReceiptNotes] = useState({});

  const isStudent = user.role === "student";
  const canManageFees =
    user.role === "school" || user.role === "state" || user.role === "federal";

  const recentPayments = useMemo(() => {
    return [...payments]
      .sort((a, b) => {
        const aTs = new Date(a.updatedAt || a.createdAt || 0).getTime();
        const bTs = new Date(b.updatedAt || b.createdAt || 0).getTime();
        return bTs - aTs;
      })
      .slice(0, 80);
  }, [payments]);

  const loadData = useCallback(async () => {
    try {
      setError("");
      setLoading(true);
      const requests = [apiGet("/fees/plans"), apiGet("/fees/invoices"), apiGet("/fees/payments")];
      if (!isStudent) requests.push(apiGet("/students"));
      const [plansData, invoicesData, paymentsData, studentsData] = await Promise.all(requests);
      setPlans(Array.isArray(plansData) ? plansData : []);
      setInvoices(Array.isArray(invoicesData) ? invoicesData : []);
      setPayments(Array.isArray(paymentsData) ? paymentsData : []);
      setStudents(Array.isArray(studentsData) ? studentsData : []);
    } catch (err) {
      setError(err.message || "Failed to load fee workspace");
    } finally {
      setLoading(false);
    }
  }, [isStudent]);

  useEffect(() => {
    loadData();
  }, [user.id, loadData]);

  const pendingPayments = useMemo(
    () => payments.filter((entry) => entry.status === "PendingConfirmation"),
    [payments]
  );

  function getPaymentDraft(invoice) {
    const existing = paymentDrafts[invoice.id];
    if (existing) return existing;
    return {
      paidForLabel: invoice.title || "School fees",
      receiptMedia: [],
      receiptUrlDraft: "",
      notes: "",
    };
  }

  function updatePaymentDraft(invoiceId, patch) {
    setPaymentDrafts((prev) => {
      const current = prev[invoiceId] || {
        paidForLabel: "",
        receiptMedia: [],
        receiptUrlDraft: "",
        notes: "",
      };
      return {
        ...prev,
        [invoiceId]: {
          ...current,
          ...patch,
        },
      };
    });
  }

  function updateSchoolReceiptNote(paymentId, value) {
    setSchoolReceiptNotes((prev) => ({
      ...prev,
      [paymentId]: value,
    }));
  }

  async function addReceiptFiles(invoiceId, event) {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      setBusy(true);
      const mediaItems = [];
      for (const file of files.slice(0, 4)) {
        if (file.size > 8 * 1024 * 1024) continue;
        const dataUrl = await fileToDataUrl(file);
        mediaItems.push({
          id: window.crypto.randomUUID(),
          kind: String(file.type || "").startsWith("video/") ? "video" : "image",
          url: dataUrl,
          name: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }
      const draft = getPaymentDraft({ id: invoiceId, title: "" });
      updatePaymentDraft(invoiceId, {
        receiptMedia: [...draft.receiptMedia, ...mediaItems].slice(0, 8),
      });
      if (!mediaItems.length) {
        setError(
          "No valid files were added. Use images/videos up to 8MB each."
        );
      }
    } catch (err) {
      setError(err.message || "Failed to read receipt file.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function addReceiptUrl(invoiceId) {
    const draft = getPaymentDraft({ id: invoiceId, title: "" });
    const url = String(draft.receiptUrlDraft || "").trim();
    if (!url) return;
    updatePaymentDraft(invoiceId, {
      receiptMedia: [
        ...draft.receiptMedia,
        { id: window.crypto.randomUUID(), kind: "image", url },
      ].slice(0, 8),
      receiptUrlDraft: "",
    });
  }

  function removeReceiptMedia(invoiceId, mediaId) {
    const draft = getPaymentDraft({ id: invoiceId, title: "" });
    updatePaymentDraft(invoiceId, {
      receiptMedia: draft.receiptMedia.filter((entry) => entry.id !== mediaId),
    });
  }

  async function createPlan() {
    if (!planForm.title.trim()) {
      setError("Plan title is required.");
      return;
    }
    if (!Number(planForm.amountNaira)) {
      setError("Plan amount is required.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await apiPost("/fees/plans", {
        title: planForm.title.trim(),
        amountNaira: Number(planForm.amountNaira),
        termLabel: planForm.termLabel.trim() || null,
        academicSession: planForm.academicSession.trim() || null,
        description: planForm.description.trim() || null,
      });
      setNotice("Fee plan created.");
      setPlanForm({
        title: "",
        amountNaira: "",
        termLabel: "",
        academicSession: "",
        description: "",
      });
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create fee plan.");
    } finally {
      setBusy(false);
    }
  }

  async function createInvoices() {
    if (!invoiceForm.studentIds.length) {
      setError("Select at least one student.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      const payload = {
        studentIds: invoiceForm.studentIds,
        planId: invoiceForm.planId || null,
        title: invoiceForm.title.trim() || null,
        amountNaira: invoiceForm.planId ? null : Number(invoiceForm.amountNaira || 0),
        dueAt: invoiceForm.dueAt ? new Date(invoiceForm.dueAt).toISOString() : null,
        description: invoiceForm.description.trim() || null,
      };
      await apiPost("/fees/invoices", payload);
      setNotice("Invoices issued.");
      setInvoiceForm({
        studentIds: [],
        planId: "",
        title: "",
        amountNaira: "",
        dueAt: "",
        description: "",
      });
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to issue invoices.");
    } finally {
      setBusy(false);
    }
  }

  async function markInvoicePaid(invoiceId) {
    const invoice = invoices.find((entry) => entry.id === invoiceId);
    const draft = getPaymentDraft(invoice || { id: invoiceId, title: "" });
    const paidForLabel = String(draft.paidForLabel || "").trim();
    const notes = String(draft.notes || "").trim();

    if (!paidForLabel) {
      setError("Tell the school what this payment is for.");
      return;
    }
    if (!draft.receiptMedia.length) {
      setError(
        "Upload receipt image/video (or add URL) before sending for confirmation."
      );
      return;
    }

    try {
      setBusy(true);
      setError("");
      const payment = await apiPost(`/fees/invoices/${invoiceId}/mark-paid`, {
        paidForLabel,
        receiptMedia: draft.receiptMedia,
        notes: notes || null,
      });
      setNotice(
        payment?.confirmationCode
          ? `Payment proof submitted. Ref code: ${payment.confirmationCode}.`
          : "Payment proof submitted for school confirmation."
      );
      setPaymentDrafts((prev) => {
        const next = { ...prev };
        delete next[invoiceId];
        return next;
      });
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to submit payment proof.");
    } finally {
      setBusy(false);
    }
  }

  async function confirmPayment(paymentId) {
    const note = String(schoolReceiptNotes[paymentId] || "").trim();
    try {
      setBusy(true);
      setError("");
      await apiPost(`/fees/payments/${paymentId}/confirm`, {
        schoolReceiptNote: note || null,
      });
      setNotice("Payment confirmed and school receipt issued.");
      setSchoolReceiptNotes((prev) => ({ ...prev, [paymentId]: "" }));
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to confirm payment.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return <div className="empty-col">Loading fees workspace...</div>;
  }

  return (
    <section className="panel" style={{ marginTop: "1rem" }}>
      <div className="panel-title">School Fees & P2P Confirmation</div>
      {notice && (
        <div className="notif notif-graded" style={{ marginBottom: "0.8rem" }} onClick={() => setNotice("")}>
          {notice}
        </div>
      )}
      {error && <div className="error-msg">{error}</div>}

      {canManageFees && (
        <div style={{ display: "grid", gap: "1rem", gridTemplateColumns: "1fr 1fr" }}>
          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-subtitle">Create Fee Plan</div>
            <div className="field">
              <label>Plan Title</label>
              <input
                value={planForm.title}
                onChange={(event) =>
                  setPlanForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Amount (Naira)</label>
              <input
                type="number"
                min="0"
                value={planForm.amountNaira}
                onChange={(event) =>
                  setPlanForm((prev) => ({ ...prev, amountNaira: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Term</label>
              <input
                value={planForm.termLabel}
                onChange={(event) =>
                  setPlanForm((prev) => ({ ...prev, termLabel: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Academic Session</label>
              <input
                value={planForm.academicSession}
                onChange={(event) =>
                  setPlanForm((prev) => ({ ...prev, academicSession: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Description</label>
              <textarea
                value={planForm.description}
                onChange={(event) =>
                  setPlanForm((prev) => ({ ...prev, description: event.target.value }))
                }
              />
            </div>
            <button className="btn btn-primary btn-sm" disabled={busy} onClick={createPlan}>
              Create Plan
            </button>
          </div>

          <div className="panel" style={{ margin: 0 }}>
            <div className="panel-subtitle">Issue Invoices</div>
            <div className="field">
              <label>Fee Plan (Optional)</label>
              <select
                value={invoiceForm.planId}
                onChange={(event) =>
                  setInvoiceForm((prev) => ({ ...prev, planId: event.target.value }))
                }
              >
                <option value="">Custom / None</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.title} - N{Number(plan.amountNaira || 0).toLocaleString()}
                  </option>
                ))}
              </select>
            </div>
            {!invoiceForm.planId && (
              <div className="field">
                <label>Amount (Naira)</label>
                <input
                  type="number"
                  min="0"
                  value={invoiceForm.amountNaira}
                  onChange={(event) =>
                    setInvoiceForm((prev) => ({ ...prev, amountNaira: event.target.value }))
                  }
                />
              </div>
            )}
            <div className="field">
              <label>Title (Optional)</label>
              <input
                value={invoiceForm.title}
                onChange={(event) =>
                  setInvoiceForm((prev) => ({ ...prev, title: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Due Date</label>
              <input
                type="datetime-local"
                value={invoiceForm.dueAt}
                onChange={(event) =>
                  setInvoiceForm((prev) => ({ ...prev, dueAt: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Select Students</label>
              <div className="student-picker" style={{ maxHeight: "180px" }}>
                {students.map((student) => (
                  <label key={student.id} className="student-pick-row">
                    <input
                      type="checkbox"
                      checked={invoiceForm.studentIds.includes(student.id)}
                      onChange={() =>
                        setInvoiceForm((prev) => ({
                          ...prev,
                          studentIds: prev.studentIds.includes(student.id)
                            ? prev.studentIds.filter((entry) => entry !== student.id)
                            : [...prev.studentIds, student.id],
                        }))
                      }
                    />
                    <span>
                      <strong>{student.name}</strong> | {student.schoolName || "No school"}
                    </span>
                  </label>
                ))}
              </div>
            </div>
            <button className="btn btn-purple btn-sm" disabled={busy} onClick={createInvoices}>
              Issue Invoice(s)
            </button>
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <div className="panel-subtitle">Invoices ({invoices.length})</div>
        <div className="calendar-list">
          {invoices.map((invoice) => (
            <div key={invoice.id} className="review-card">
              <div className="review-card-header">
                <div>
                  <div className="review-card-title">{invoice.title}</div>
                  <div className="review-card-meta">
                    <span>{invoice.studentName || "Student"}</span>
                    <span>|</span>
                    <span>{invoice.schoolName || "School"}</span>
                    <span>|</span>
                    <span>{invoice.status}</span>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>
                  N{amountNairaFromInvoice(invoice).toLocaleString()}
                </div>
              </div>
              <div className="calendar-meta">
                Due: {invoice.dueAt ? formatDateTime(invoice.dueAt) : "No deadline"}
              </div>
              {isStudent && invoice.status === "Unpaid" && (
                <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
                  <input
                    placeholder="Paid for (e.g. Tuition, Bus fee, Hostel)"
                    value={getPaymentDraft(invoice).paidForLabel}
                    onChange={(event) =>
                      updatePaymentDraft(invoice.id, {
                        paidForLabel: event.target.value,
                      })
                    }
                  />
                  <textarea
                    placeholder="Optional notes for school cashier..."
                    value={getPaymentDraft(invoice).notes}
                    onChange={(event) =>
                      updatePaymentDraft(invoice.id, { notes: event.target.value })
                    }
                  />
                  <div style={{ display: "flex", gap: "0.5rem", flexWrap: "wrap" }}>
                    <label className="btn btn-ghost btn-sm" style={{ cursor: "pointer" }}>
                      Upload Receipt
                      <input
                        type="file"
                        accept="image/*,video/*"
                        multiple
                        style={{ display: "none" }}
                        onChange={(event) => addReceiptFiles(invoice.id, event)}
                      />
                    </label>
                    <input
                      style={{ flex: 1, minWidth: "220px" }}
                      placeholder="Or paste receipt URL"
                      value={getPaymentDraft(invoice).receiptUrlDraft}
                      onChange={(event) =>
                        updatePaymentDraft(invoice.id, {
                          receiptUrlDraft: event.target.value,
                        })
                      }
                    />
                    <button
                      className="btn btn-ghost btn-sm"
                      type="button"
                      onClick={() => addReceiptUrl(invoice.id)}
                    >
                      Add URL
                    </button>
                  </div>
                  {!!getPaymentDraft(invoice).receiptMedia.length && (
                    <div className="market-media-grid">
                      {getPaymentDraft(invoice).receiptMedia.map((entry) => (
                        <div key={entry.id} className="market-media-item">
                          {String(entry.kind || "").toLowerCase() === "video" ? (
                            <video src={entry.url} controls preload="metadata" />
                          ) : (
                            <img src={entry.url} alt={entry.name || "Receipt"} />
                          )}
                          <button
                            className="btn btn-ghost btn-sm"
                            type="button"
                            onClick={() => removeReceiptMedia(invoice.id, entry.id)}
                          >
                            Remove
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => markInvoicePaid(invoice.id)}
                  >
                    Submit Receipt To School
                  </button>
                </div>
              )}
            </div>
          ))}
          {!invoices.length && <div className="empty-col">No invoices yet.</div>}
        </div>
      </div>

      {canManageFees && (
        <div style={{ marginTop: "1rem" }}>
          <div className="panel-subtitle">
            Pending Payment Confirmations ({pendingPayments.length})
          </div>
          <div className="calendar-list">
            {pendingPayments.map((payment) => (
              <div
                key={payment.id}
                className="calendar-item"
                style={{ alignItems: "stretch", flexDirection: "column" }}
              >
                <div style={{ flex: 1 }}>
                  <div className="calendar-title">
                    {payment.studentName || "Student"} | {payment.invoiceTitle}
                  </div>
                  <div className="calendar-meta">
                    N{Number(payment.amountNaira || 0).toLocaleString()} | Marked:{" "}
                    {formatDateTime(payment.studentMarkedAt)}
                  </div>
                  <div className="calendar-meta">
                    Paid for: {payment.paidForLabel || payment.invoiceTitle || "School fees"}
                  </div>
                  {payment.notes && <div className="calendar-meta">Student note: {payment.notes}</div>}
                </div>

                {!!payment.receiptMedia?.length && (
                  <div className="market-media-grid">
                    {payment.receiptMedia.map((entry) => (
                      <div key={entry.id} className="market-media-item">
                        {String(entry.kind || "").toLowerCase() === "video" ? (
                          <video src={entry.url} controls preload="metadata" />
                        ) : (
                          <img src={entry.url} alt={entry.name || "Receipt evidence"} />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", width: "100%" }}>
                  <input
                    style={{ flex: 1 }}
                    placeholder="Optional school receipt note"
                    value={schoolReceiptNotes[payment.id] || ""}
                    onChange={(event) => updateSchoolReceiptNote(payment.id, event.target.value)}
                  />
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => confirmPayment(payment.id)}
                  >
                    Confirm
                  </button>
                </div>
              </div>
            ))}
            {!pendingPayments.length && (
              <div className="empty-col">No pending confirmations.</div>
            )}
          </div>
        </div>
      )}

      <div style={{ marginTop: "1rem" }}>
        <div className="panel-subtitle">Payment Records ({recentPayments.length})</div>
        <div className="calendar-list">
          {recentPayments.map((payment) => (
            <div key={payment.id} className="review-card">
              <div className="review-card-header">
                <div>
                  <div className="review-card-title">
                    {payment.invoiceTitle || payment.paidForLabel || "School fees payment"}
                  </div>
                  <div className="review-card-meta">
                    <span>{payment.studentName || "Student"}</span>
                    <span>|</span>
                    <span>{payment.schoolName || "School"}</span>
                    <span>|</span>
                    <span>{payment.status}</span>
                  </div>
                </div>
                <div style={{ fontWeight: 700 }}>
                  N{Number(payment.amountNaira || 0).toLocaleString()}
                </div>
              </div>
              <div className="calendar-meta">
                Submitted: {payment.studentMarkedAt ? formatDateTime(payment.studentMarkedAt) : "N/A"}
              </div>
              {!!payment.schoolReceiptNo && (
                <div className="calendar-meta">
                  School Receipt: {payment.schoolReceiptNo}
                  {payment.schoolReceiptIssuedAt
                    ? ` (${formatDateTime(payment.schoolReceiptIssuedAt)})`
                    : ""}
                </div>
              )}
              {!!payment.schoolReceiptNote && (
                <div className="review-summary-box">{payment.schoolReceiptNote}</div>
              )}
            </div>
          ))}
          {!recentPayments.length && (
            <div className="empty-col">No fee payment records yet.</div>
          )}
        </div>
      </div>
    </section>
  );
}
