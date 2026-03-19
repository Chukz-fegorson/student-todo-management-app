import { formatDateTime } from "../lib/helpers";
import {
  amountNairaFromInvoice,
  amountNairaFromPlan,
  formatNaira,
  getInvoiceItems,
} from "../lib/fees";
import { useFeesWorkspace } from "../hooks/useFeesWorkspace";

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function sanitizeFileName(value, fallback = "studyflow-document") {
  const cleaned = String(value || fallback)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return cleaned || fallback;
}

function triggerDownload(blob, fileName) {
  const url = window.URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = fileName;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  window.setTimeout(() => window.URL.revokeObjectURL(url), 1200);
}

function buildDocumentShell({ title, subtitle, badge, bodyHtml }) {
  return `<!DOCTYPE html>
  <html lang="en">
    <head>
      <meta charset="utf-8" />
      <meta name="viewport" content="width=device-width, initial-scale=1" />
      <title>${escapeHtml(title)}</title>
      <style>
        :root {
          color-scheme: light;
          --ink: #162033;
          --muted: #5a667d;
          --line: #dbe3f2;
          --surface: #ffffff;
          --surface2: #f4f7fc;
          --accent: #2a6df4;
          --accent-soft: rgba(42, 109, 244, 0.08);
        }
        * { box-sizing: border-box; }
        body {
          margin: 0;
          padding: 24px;
          background: #eef3fb;
          color: var(--ink);
          font-family: "Segoe UI", Arial, sans-serif;
        }
        .sheet {
          max-width: 860px;
          margin: 0 auto;
          padding: 28px;
          border-radius: 24px;
          background: var(--surface);
          box-shadow: 0 18px 42px rgba(15, 23, 42, 0.08);
        }
        .eyebrow {
          color: var(--accent);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.08em;
          text-transform: uppercase;
          margin-bottom: 10px;
        }
        h1 {
          margin: 0;
          font-size: 28px;
          line-height: 1.1;
        }
        .subtitle {
          margin: 10px 0 0;
          color: var(--muted);
          font-size: 14px;
          line-height: 1.55;
        }
        .badge {
          display: inline-flex;
          margin-top: 16px;
          padding: 8px 12px;
          border-radius: 999px;
          background: var(--accent-soft);
          color: var(--accent);
          font-size: 12px;
          font-weight: 700;
          letter-spacing: 0.05em;
          text-transform: uppercase;
        }
        .section {
          margin-top: 22px;
          padding: 18px;
          border-radius: 18px;
          background: var(--surface2);
          border: 1px solid var(--line);
        }
        .section h2 {
          margin: 0 0 12px;
          font-size: 15px;
        }
        .details {
          display: grid;
          grid-template-columns: repeat(2, minmax(0, 1fr));
          gap: 12px;
        }
        .detail-row {
          border: 1px solid var(--line);
          border-radius: 14px;
          padding: 12px 14px;
          background: var(--surface);
        }
        .detail-row span {
          display: block;
          margin-bottom: 6px;
          color: var(--muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }
        .detail-row strong {
          display: block;
          font-size: 14px;
          line-height: 1.45;
        }
        table {
          width: 100%;
          border-collapse: collapse;
          background: var(--surface);
          border: 1px solid var(--line);
          border-radius: 14px;
          overflow: hidden;
        }
        th, td {
          padding: 12px 14px;
          border-bottom: 1px solid var(--line);
          text-align: left;
          font-size: 14px;
          vertical-align: top;
        }
        th {
          color: var(--muted);
          font-size: 12px;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          background: #edf3ff;
        }
        td:last-child, th:last-child {
          text-align: right;
          white-space: nowrap;
        }
        tr:last-child td {
          border-bottom: none;
        }
        ul {
          margin: 0;
          padding-left: 18px;
          color: var(--ink);
        }
        p {
          margin: 0;
          color: var(--ink);
          font-size: 14px;
          line-height: 1.6;
        }
        .footer {
          margin-top: 18px;
          color: var(--muted);
          font-size: 12px;
          line-height: 1.5;
        }
        @media print {
          body {
            padding: 0;
            background: #ffffff;
          }
          .sheet {
            box-shadow: none;
            border-radius: 0;
            max-width: none;
            padding: 0;
          }
        }
        @media (max-width: 720px) {
          body { padding: 14px; }
          .sheet { padding: 18px; }
          .details { grid-template-columns: 1fr; }
          th, td:last-child { text-align: left; }
        }
      </style>
    </head>
    <body>
      <main class="sheet">
        <div class="eyebrow">StudyFlow Fees</div>
        <h1>${escapeHtml(title)}</h1>
        ${subtitle ? `<p class="subtitle">${escapeHtml(subtitle)}</p>` : ""}
        ${badge ? `<div class="badge">${escapeHtml(badge)}</div>` : ""}
        ${bodyHtml}
      </main>
    </body>
  </html>`;
}

function buildDetailRows(rows) {
  return rows
    .filter((row) => row && row.value !== undefined && row.value !== null && row.value !== "")
    .map(
      (row) => `
        <div class="detail-row">
          <span>${escapeHtml(row.label)}</span>
          <strong>${escapeHtml(row.value)}</strong>
        </div>
      `
    )
    .join("");
}

function downloadPaymentReceipt(payment) {
  const evidenceList = Array.isArray(payment.receiptMedia)
    ? payment.receiptMedia
        .map(
          (entry, index) =>
            `<li>${escapeHtml(
              entry?.name ||
                `${String(entry?.kind || "receipt").toUpperCase()} evidence ${index + 1}`
            )}</li>`
        )
        .join("")
    : "";
  const html = buildDocumentShell({
    title: "Fee Payment Receipt",
    subtitle: `${payment.invoiceTitle || payment.paidForLabel || "School fees"} - ${formatNaira(
      payment.amountNaira || 0
    )}`,
    badge: payment.status || "Paid",
    bodyHtml: `
      <section class="section">
        <h2>Receipt details</h2>
        <div class="details">
          ${buildDetailRows([
            { label: "Invoice", value: payment.invoiceTitle || payment.paidForLabel || "School fees" },
            { label: "Student", value: payment.studentName || "Student" },
            { label: "School", value: payment.schoolName || "School" },
            { label: "Amount", value: formatNaira(payment.amountNaira || 0) },
            { label: "Payment method", value: payment.paymentMethod || "transfer" },
            { label: "Transaction ref", value: payment.transactionReference || "N/A" },
            { label: "School receipt no", value: payment.schoolReceiptNo || "Pending" },
            {
              label: "Receipt issued",
              value: payment.schoolReceiptIssuedAt
                ? formatDateTime(payment.schoolReceiptIssuedAt)
                : "Pending",
            },
            {
              label: "Submitted at",
              value: payment.studentMarkedAt
                ? formatDateTime(payment.studentMarkedAt)
                : "N/A",
            },
          ])}
        </div>
      </section>
      ${
        payment.notes
          ? `<section class="section"><h2>Student note</h2><p>${escapeHtml(payment.notes)}</p></section>`
          : ""
      }
      ${
        payment.schoolReceiptNote
          ? `<section class="section"><h2>School receipt note</h2><p>${escapeHtml(
              payment.schoolReceiptNote
            )}</p></section>`
          : ""
      }
      ${
        evidenceList
          ? `<section class="section"><h2>Uploaded evidence</h2><ul>${evidenceList}</ul></section>`
          : ""
      }
      <div class="footer">
        Generated by StudyFlow. Open this file in a browser and print to PDF if you need a shareable copy.
      </div>
    `,
  });

  triggerDownload(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    `${sanitizeFileName(
      payment.schoolReceiptNo || `studyflow-fee-receipt-${String(payment.id || "payment").slice(0, 8)}`,
      "studyflow-fee-receipt"
    )}.html`
  );
}

function downloadInvoiceDocument(invoice) {
  const items = getInvoiceItems(invoice);
  const itemRows = items
    .map(
      (item) => `
        <tr>
          <td>
            <strong>${escapeHtml(item.title || "Fee item")}</strong>
            ${
              item.description
                ? `<div style="margin-top:4px;color:#5a667d;">${escapeHtml(item.description)}</div>`
                : ""
            }
          </td>
          <td>${escapeHtml(formatNaira(Number(item.amountNaira || 0)))}</td>
        </tr>
      `
    )
    .join("");
  const html = buildDocumentShell({
    title: "Fee Invoice",
    subtitle: `${invoice.title || "School Fees Invoice"} - ${formatNaira(
      amountNairaFromInvoice(invoice)
    )}`,
    badge: invoice.status || "Unpaid",
    bodyHtml: `
      <section class="section">
        <h2>Invoice details</h2>
        <div class="details">
          ${buildDetailRows([
            {
              label: "Invoice no",
              value:
                invoice.invoiceNo ||
                `SF-INV-${String(invoice.id || "").slice(0, 8).toUpperCase()}`,
            },
            { label: "Student", value: invoice.studentName || "Student" },
            { label: "School", value: invoice.schoolName || "School" },
            { label: "Due date", value: invoice.dueAt ? formatDateTime(invoice.dueAt) : "No deadline" },
            {
              label: "Generated",
              value: invoice.createdAt ? formatDateTime(invoice.createdAt) : formatDateTime(new Date()),
            },
            { label: "Total", value: formatNaira(amountNairaFromInvoice(invoice)) },
          ])}
        </div>
      </section>
      <section class="section">
        <h2>Fee items</h2>
        <table>
          <thead>
            <tr>
              <th>Item</th>
              <th>Amount</th>
            </tr>
          </thead>
          <tbody>
            ${itemRows}
          </tbody>
        </table>
      </section>
      <div class="footer">
        Generated by StudyFlow. Open this file in a browser and print to PDF if you need a shareable copy.
      </div>
    `,
  });

  triggerDownload(
    new Blob([html], { type: "text/html;charset=utf-8" }),
    `${sanitizeFileName(invoice.invoiceNo || invoice.id || "studyflow-invoice", "studyflow-invoice")}.html`
  );
}

export default function FeesWorkspace({ user, navRoute }) {
  const {
    activeInvoiceByPlanId,
    addReceiptFiles,
    addReceiptUrl,
    busy,
    canManageFees,
    confirmPayment,
    confirmedPayments,
    createInvoices,
    createPlan,
    createStudentInvoiceFromPlans,
    error,
    getPaymentDraft,
    invoices,
    invoiceForm,
    isStudent,
    jumpToInvoice,
    loading,
    markInvoicePaid,
    notice,
    paidInvoiceByPlanId,
    pendingPayments,
    planForm,
    plans,
    recentPayments,
    removeReceiptMedia,
    schoolReceiptNotes,
    selectedPlanIds,
    selectedPlanTotalNaira,
    selectedPlans,
    setInvoiceForm,
    setNotice,
    setPlanForm,
    students,
    togglePlanSelection,
    totalOutstandingNaira,
    unpaidInvoices,
    updatePaymentDraft,
    updateSchoolReceiptNote,
  } = useFeesWorkspace({ user, navRoute });

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">...</div>
        <h3>Loading fees workspace</h3>
        <p>Invoices, plans, and payment records are being prepared.</p>
      </div>
    );
  }

  return (
    <section className="panel panel-elevated module-surface-panel" style={{ marginTop: "1rem" }}>
      <section className="module-hero module-hero-compact">
        <div className="module-hero-copy">
          <div className="module-kicker">Fees</div>
          <div className="module-title-row">
            <h2>School Fees and Confirmation</h2>
            <span className="module-pill">
              {isStudent ? `${unpaidInvoices.length} unpaid invoice${unpaidInvoices.length === 1 ? "" : "s"}` : `${pendingPayments.length} pending confirmation${pendingPayments.length === 1 ? "" : "s"}`}
            </span>
          </div>
          <p>
            Keep invoices, payment evidence, receipt confirmation, and downloadable proof of payment inside one workspace.
          </p>
          <div className="module-highlight-row">
            <span className="module-highlight-pill">
              Outstanding: N{Number(totalOutstandingNaira || 0).toLocaleString()}
            </span>
            <span className="module-highlight-pill">
              {recentPayments.length} payment record{recentPayments.length === 1 ? "" : "s"}
            </span>
            <span className="module-highlight-pill">
              {canManageFees ? `${students.length} student${students.length === 1 ? "" : "s"} in fee scope` : `${confirmedPayments.length} confirmed payment${confirmedPayments.length === 1 ? "" : "s"}`}
            </span>
          </div>
        </div>
      </section>

      {notice && (
        <div className="notif notif-graded" style={{ marginBottom: "0.8rem" }} onClick={() => setNotice("")}>
          {notice}
        </div>
      )}
      {error && <div className="error-msg">{error}</div>}

      {isStudent && (
        <div className="panel panel-elevated" style={{ marginBottom: "1rem" }}>
          <div className="panel-kicker">Available Plans</div>
          <div className="panel-title">Select School Fee Items</div>
          <div className="panel-copy">
            Choose one or multiple school fee plans. StudyFlow will generate one invoice for the selected items, then you can continue directly to payment and receipt confirmation.
          </div>

          <div className="fees-plan-grid">
            {plans.map((plan) => {
              const activeInvoice = activeInvoiceByPlanId.get(plan.id) || null;
              const paidInvoice = paidInvoiceByPlanId.get(plan.id) || null;
              const existingInvoice = activeInvoice || paidInvoice || null;
              const disabled = Boolean(existingInvoice);
              return (
                <div
                  key={plan.id}
                  className={`fees-plan-card ${selectedPlanIds.includes(plan.id) ? "selected" : ""} ${disabled ? "locked" : ""}`}
                >
                  <div className="fees-plan-card-head">
                    <div>
                      <div className="review-card-title">{plan.title}</div>
                      <div className="review-card-meta">
                        <span>{plan.schoolName || "School"}</span>
                        {plan.termLabel ? <span>| {plan.termLabel}</span> : null}
                        {plan.academicSession ? <span>| {plan.academicSession}</span> : null}
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>{formatNaira(amountNairaFromPlan(plan))}</div>
                  </div>
                  {!!plan.description && (
                    <div className="review-summary-box">{plan.description}</div>
                  )}
                  <div className="fees-plan-status-row">
                    {activeInvoice ? (
                      <span className="module-highlight-pill">
                        Active invoice: {activeInvoice.status}
                      </span>
                    ) : paidInvoice ? (
                      <span className="module-highlight-pill">Already invoiced and paid</span>
                    ) : (
                      <span className="module-highlight-pill">Available to invoice</span>
                    )}
                  </div>
                  <div className="fees-plan-actions">
                    <label className="student-pick-row" style={{ margin: 0 }}>
                      <input
                        type="checkbox"
                        checked={selectedPlanIds.includes(plan.id)}
                        disabled={disabled || busy}
                        onChange={() => togglePlanSelection(plan.id)}
                      />
                      <span>Select for invoice</span>
                    </label>
                    {existingInvoice ? (
                      <button
                        type="button"
                        className="btn btn-ghost btn-sm"
                        onClick={() => jumpToInvoice(existingInvoice.id)}
                      >
                        Open Existing Invoice
                      </button>
                    ) : null}
                  </div>
                </div>
              );
            })}
          </div>

          {!!plans.length && (
            <div className="fees-selection-bar">
              <div>
                <strong>{selectedPlans.length}</strong> item
                {selectedPlans.length === 1 ? "" : "s"} selected
                <div className="panel-hint">
                  Invoice total: {formatNaira(selectedPlanTotalNaira)}
                </div>
              </div>
              <button
                className="btn btn-primary btn-sm"
                disabled={busy || !selectedPlanIds.length}
                onClick={createStudentInvoiceFromPlans}
              >
                Generate Invoice
              </button>
            </div>
          )}

          {!plans.length && (
            <div className="empty-col">
              No active fee plans have been published for your school yet.
            </div>
          )}
        </div>
      )}

      {canManageFees && (
        <div className="workspace-grid workspace-grid-fees-admin" style={{ marginBottom: "1rem" }}>
          <div className="panel panel-elevated" style={{ margin: 0 }}>
            <div className="panel-kicker">Configure</div>
            <div className="panel-title">Create Fee Plan</div>
            <div className="panel-copy">
              Define reusable fee plans so invoices can be issued consistently across students.
            </div>
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

          <div className="panel panel-elevated" style={{ margin: 0 }}>
            <div className="panel-kicker">Distribute</div>
            <div className="panel-title">Issue Invoices</div>
            <div className="panel-copy">
              Select a plan or create a custom invoice, then target the exact students who should receive it.
            </div>
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

      <div className="panel panel-elevated" style={{ marginTop: canManageFees ? 0 : "0.2rem" }}>
        <div className="panel-kicker">Invoices</div>
        <div className="panel-title">Invoices ({invoices.length})</div>
        <div className="panel-copy">
          {isStudent
            ? "Review generated invoices, download itemized copies, submit payment evidence, and track confirmation status."
            : "Monitor generated invoices across students, download the same invoice the student sees, and keep payment progress visible."}
        </div>
        <div className="calendar-list">
          {invoices.map((invoice) => (
            <div key={invoice.id} id={`fee-invoice-${invoice.id}`} className="review-card">
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
              {!!getInvoiceItems(invoice).length && (
                <div className="fees-invoice-items">
                  {getInvoiceItems(invoice).map((item) => (
                    <div key={item.id} className="fees-invoice-item">
                      <div>
                        <strong>{item.title || "Fee item"}</strong>
                        {item.description ? (
                          <div className="panel-hint">{item.description}</div>
                        ) : null}
                      </div>
                      <span>{formatNaira(item.amountNaira || 0)}</span>
                    </div>
                  ))}
                </div>
              )}
              <div className="calendar-meta">
                Invoice No: {invoice.invoiceNo || String(invoice.id || "").slice(0, 8).toUpperCase()}
              </div>
              <div className="calendar-meta">
                Due: {invoice.dueAt ? formatDateTime(invoice.dueAt) : "No deadline"}
              </div>
              <div style={{ marginTop: "0.45rem", display: "flex", gap: "0.45rem", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => downloadInvoiceDocument(invoice)}
                >
                  Download Invoice
                </button>
              </div>
              {isStudent && invoice.status === "Unpaid" && (
                <div style={{ marginTop: "0.6rem", display: "grid", gap: "0.45rem" }}>
                  {!getPaymentDraft(invoice).open ? (
                    <button
                      className="btn btn-primary btn-sm"
                      type="button"
                      onClick={() => updatePaymentDraft(invoice.id, { open: true })}
                    >
                      Pay Fees
                    </button>
                  ) : (
                    <>
                      <input
                        placeholder="Paid for (e.g. Tuition, Exam fee, Hostel)"
                        value={getPaymentDraft(invoice).paidForLabel}
                        onChange={(event) =>
                          updatePaymentDraft(invoice.id, {
                            paidForLabel: event.target.value,
                          })
                        }
                      />
                      <div
                        style={{
                          display: "grid",
                          gap: "0.45rem",
                          gridTemplateColumns: "1fr 1fr",
                        }}
                      >
                        <select
                          value={getPaymentDraft(invoice).paymentMethod}
                          onChange={(event) =>
                            updatePaymentDraft(invoice.id, {
                              paymentMethod: event.target.value,
                            })
                          }
                        >
                          <option value="transfer">Transfer</option>
                          <option value="cash">Cash</option>
                          <option value="on_platform">On-platform (simulated)</option>
                        </select>
                        <input
                          placeholder="Transaction Ref (optional)"
                          value={getPaymentDraft(invoice).transactionReference}
                          onChange={(event) =>
                            updatePaymentDraft(invoice.id, {
                              transactionReference: event.target.value,
                            })
                          }
                        />
                      </div>
                      <textarea
                        placeholder="Optional notes for school cashier..."
                        value={getPaymentDraft(invoice).notes}
                        onChange={(event) =>
                          updatePaymentDraft(invoice.id, { notes: event.target.value })
                        }
                      />
                      {getPaymentDraft(invoice).paymentMethod !== "on_platform" && (
                        <>
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
                        </>
                      )}
                      {getPaymentDraft(invoice).paymentMethod === "on_platform" && (
                        <div className="panel-hint">
                          On-platform simulation selected. Receipt media is optional.
                        </div>
                      )}
                      <div style={{ display: "flex", gap: "0.5rem" }}>
                        <button
                          className="btn btn-ghost btn-sm"
                          disabled={busy}
                          onClick={() => markInvoicePaid(invoice.id)}
                        >
                          Submit Payment
                        </button>
                        <button
                          className="btn btn-ghost btn-sm"
                          type="button"
                          onClick={() =>
                            updatePaymentDraft(invoice.id, {
                              open: false,
                            })
                          }
                        >
                          Cancel
                        </button>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          ))}
          {!invoices.length && <div className="empty-col">No invoices yet.</div>}
        </div>
      </div>

      {canManageFees && (
        <div className="panel panel-elevated" style={{ marginTop: "1rem" }}>
          <div className="panel-kicker">Verification</div>
          <div className="panel-title">
            Pending Payment Confirmations ({pendingPayments.length})
          </div>
          <div className="panel-copy">
            Review uploaded evidence, confirm payment, and issue official school receipts from one queue.
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
                  <div className="calendar-meta">
                    Method: {payment.paymentMethod || "transfer"}
                    {payment.transactionReference
                      ? ` | Ref: ${payment.transactionReference}`
                      : ""}
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

      <div className="panel panel-elevated" style={{ marginTop: "1rem" }}>
        <div className="panel-kicker">History</div>
        <div className="panel-title">Payment Records ({recentPayments.length})</div>
        <div className="panel-copy">
          Keep a complete trail of submitted, confirmed, and receipted payments with downloadable proof where available.
        </div>
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
              <div className="calendar-meta">
                Method: {payment.paymentMethod || "transfer"}
                {payment.transactionReference ? ` | Ref: ${payment.transactionReference}` : ""}
              </div>
              {!!payment.schoolReceiptNo && (
                <div className="calendar-meta">
                  School Receipt: {payment.schoolReceiptNo}
                  {payment.schoolReceiptIssuedAt
                    ? ` (${formatDateTime(payment.schoolReceiptIssuedAt)})`
                    : ""}
                </div>
              )}
              {!!payment.receiptMedia?.length && (
                <div className="market-media-grid">
                  {payment.receiptMedia.map((entry) => (
                    <div key={entry.id} className="market-media-item">
                      {String(entry.kind || "").toLowerCase() === "video" ? (
                        <video src={entry.url} controls preload="metadata" />
                      ) : (
                        <img src={entry.url} alt={entry.name || "Receipt evidence"} />
                      )}
                      <a className="btn btn-ghost btn-sm" href={entry.url} download>
                        Download
                      </a>
                    </div>
                  ))}
                </div>
              )}
              {!!payment.schoolReceiptNote && (
                <div className="review-summary-box">{payment.schoolReceiptNote}</div>
              )}
              <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.45rem" }}>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => downloadPaymentReceipt(payment)}
                >
                  Download Receipt
                </button>
              </div>
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
