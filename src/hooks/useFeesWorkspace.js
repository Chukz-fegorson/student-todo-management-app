import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import {
  amountNairaFromInvoice,
  amountNairaFromPlan,
  createInvoiceForm,
  createPaymentDraft,
  createPlanForm,
  getInvoiceItems,
  getInvoicePurposeLabel,
} from "../lib/fees";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read receipt file"));
    reader.readAsDataURL(file);
  });
}

export function useFeesWorkspace({ user, navRoute }) {
  const [plans, setPlans] = useState([]);
  const [invoices, setInvoices] = useState([]);
  const [payments, setPayments] = useState([]);
  const [students, setStudents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [planForm, setPlanForm] = useState(() => createPlanForm());
  const [invoiceForm, setInvoiceForm] = useState(() => createInvoiceForm());
  const [selectedPlanIds, setSelectedPlanIds] = useState([]);
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
      const requests = [
        apiGet("/fees/plans"),
        apiGet("/fees/invoices"),
        apiGet("/fees/payments"),
      ];
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
  }, [loadData, user.id]);

  const getPaymentDraft = useCallback(
    (invoice) => {
      const existing = paymentDrafts[invoice.id];
      if (existing) return existing;
      return createPaymentDraft(invoice);
    },
    [paymentDrafts]
  );

  const updatePaymentDraft = useCallback((invoiceId, patch) => {
    setPaymentDrafts((prev) => {
      const current = prev[invoiceId] || createPaymentDraft({ id: invoiceId, title: "" });
      return {
        ...prev,
        [invoiceId]: {
          ...current,
          ...patch,
        },
      };
    });
  }, []);

  const updateSchoolReceiptNote = useCallback((paymentId, value) => {
    setSchoolReceiptNotes((prev) => ({
      ...prev,
      [paymentId]: value,
    }));
  }, []);

  const jumpToInvoice = useCallback((invoiceId) => {
    if (!invoiceId) return;
    const element = document.getElementById(`fee-invoice-${invoiceId}`);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
    }
  }, []);

  useEffect(() => {
    if (navRoute?.module !== "fees" || !navRoute?.entityId) return;
    const matchedInvoice = invoices.find((invoice) => invoice.id === navRoute.entityId);
    if (!matchedInvoice) return;
    jumpToInvoice(matchedInvoice.id);
    if (isStudent && matchedInvoice.status === "Unpaid") {
      updatePaymentDraft(matchedInvoice.id, {
        open: true,
        paidForLabel: getInvoicePurposeLabel(matchedInvoice),
      });
    }
  }, [invoices, isStudent, jumpToInvoice, navRoute, updatePaymentDraft]);

  const pendingPayments = useMemo(
    () => payments.filter((entry) => entry.status === "PendingConfirmation"),
    [payments]
  );
  const unpaidInvoices = useMemo(
    () => invoices.filter((entry) => entry.status === "Unpaid"),
    [invoices]
  );
  const activeInvoices = useMemo(
    () => invoices.filter((entry) => ["Unpaid", "PendingConfirmation"].includes(entry.status)),
    [invoices]
  );
  const totalOutstandingNaira = useMemo(
    () => unpaidInvoices.reduce((sum, invoice) => sum + amountNairaFromInvoice(invoice), 0),
    [unpaidInvoices]
  );
  const confirmedPayments = useMemo(
    () => recentPayments.filter((entry) => entry.status !== "PendingConfirmation"),
    [recentPayments]
  );
  const activeInvoiceByPlanId = useMemo(() => {
    const map = new Map();
    activeInvoices.forEach((invoice) => {
      getInvoiceItems(invoice).forEach((item) => {
        if (item.planId && !map.has(item.planId)) {
          map.set(item.planId, invoice);
        }
      });
    });
    return map;
  }, [activeInvoices]);
  const paidInvoiceByPlanId = useMemo(() => {
    const map = new Map();
    invoices
      .filter((invoice) => invoice.status === "Paid")
      .forEach((invoice) => {
        getInvoiceItems(invoice).forEach((item) => {
          if (item.planId && !map.has(item.planId)) {
            map.set(item.planId, invoice);
          }
        });
      });
    return map;
  }, [invoices]);
  const selectedPlans = useMemo(
    () => plans.filter((plan) => selectedPlanIds.includes(plan.id)),
    [plans, selectedPlanIds]
  );
  const selectedPlanTotalNaira = useMemo(
    () => selectedPlans.reduce((sum, plan) => sum + amountNairaFromPlan(plan), 0),
    [selectedPlans]
  );

  const togglePlanSelection = useCallback((planId) => {
    setSelectedPlanIds((prev) =>
      prev.includes(planId)
        ? prev.filter((entry) => entry !== planId)
        : [...prev, planId]
    );
  }, []);

  const addReceiptFiles = useCallback(
    async (invoiceId, event) => {
      const input = event.target;
      const files = Array.from(input.files || []);
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
          setError("No valid files were added. Use images/videos up to 8MB each.");
        }
      } catch (err) {
        setError(err.message || "Failed to read receipt file.");
      } finally {
        setBusy(false);
        input.value = "";
      }
    },
    [getPaymentDraft, updatePaymentDraft]
  );

  const addReceiptUrl = useCallback(
    (invoiceId) => {
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
    },
    [getPaymentDraft, updatePaymentDraft]
  );

  const removeReceiptMedia = useCallback(
    (invoiceId, mediaId) => {
      const draft = getPaymentDraft({ id: invoiceId, title: "" });
      updatePaymentDraft(invoiceId, {
        receiptMedia: draft.receiptMedia.filter((entry) => entry.id !== mediaId),
      });
    },
    [getPaymentDraft, updatePaymentDraft]
  );

  const createPlan = useCallback(async () => {
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
      setPlanForm(createPlanForm());
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to create fee plan.");
    } finally {
      setBusy(false);
    }
  }, [loadData, planForm]);

  const createInvoices = useCallback(async () => {
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
      setInvoiceForm(createInvoiceForm());
      await loadData();
    } catch (err) {
      setError(err.message || "Failed to issue invoices.");
    } finally {
      setBusy(false);
    }
  }, [invoiceForm, loadData]);

  const createStudentInvoiceFromPlans = useCallback(async () => {
    if (!selectedPlanIds.length) {
      setError("Select at least one school fee plan.");
      return;
    }

    try {
      setBusy(true);
      setError("");
      const createdInvoice = await apiPost("/fees/invoices/from-plans", {
        planIds: selectedPlanIds,
      });
      setNotice(
        selectedPlanIds.length === 1
          ? "Invoice generated from the selected fee plan. Complete payment below."
          : "Combined invoice generated from selected fee plans. Complete payment below."
      );
      setSelectedPlanIds([]);
      updatePaymentDraft(createdInvoice.id, {
        open: true,
        paidForLabel: getInvoicePurposeLabel(createdInvoice),
      });
      await loadData();
      window.setTimeout(() => {
        jumpToInvoice(createdInvoice.id);
      }, 120);
    } catch (err) {
      setError(err.message || "Failed to generate invoice from selected plans.");
    } finally {
      setBusy(false);
    }
  }, [jumpToInvoice, loadData, selectedPlanIds, updatePaymentDraft]);

  const markInvoicePaid = useCallback(
    async (invoiceId) => {
      const invoice = invoices.find((entry) => entry.id === invoiceId);
      const draft = getPaymentDraft(invoice || { id: invoiceId, title: "" });
      const paidForLabel = String(draft.paidForLabel || "").trim();
      const paymentMethod = String(draft.paymentMethod || "transfer").trim();
      const transactionReference = String(draft.transactionReference || "").trim();
      const notes = String(draft.notes || "").trim();

      if (!paidForLabel) {
        setError("Tell the school what this payment is for.");
        return;
      }
      if (paymentMethod !== "on_platform" && !draft.receiptMedia.length) {
        setError("Upload receipt image/video (or add URL) before sending for confirmation.");
        return;
      }

      try {
        setBusy(true);
        setError("");
        const payment = await apiPost(`/fees/invoices/${invoiceId}/mark-paid`, {
          paidForLabel,
          paymentMethod,
          transactionReference: transactionReference || null,
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
    },
    [getPaymentDraft, invoices, loadData]
  );

  const confirmPayment = useCallback(
    async (paymentId) => {
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
    },
    [loadData, schoolReceiptNotes]
  );

  return {
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
  };
}
