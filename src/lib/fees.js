export function formatNaira(value) {
  return `N${Number(value || 0).toLocaleString()}`;
}

export function amountNairaFromInvoice(invoice) {
  if (Number.isFinite(Number(invoice?.amountNaira))) {
    return Number(invoice.amountNaira);
  }
  return Number(invoice?.amountKobo || 0) / 100;
}

export function amountNairaFromPlan(plan) {
  if (Number.isFinite(Number(plan?.amountNaira))) {
    return Number(plan.amountNaira);
  }
  return Number(plan?.amountKobo || 0) / 100;
}

export function getInvoiceItems(invoice) {
  if (Array.isArray(invoice?.items) && invoice.items.length) {
    return invoice.items;
  }
  return [
    {
      id: `${invoice?.id || "invoice"}-fallback`,
      title: invoice?.title || "School Fees",
      description: invoice?.description || "",
      amountNaira: amountNairaFromInvoice(invoice || {}),
    },
  ];
}

export function getInvoicePurposeLabel(invoice) {
  const items = getInvoiceItems(invoice);
  if (!items.length) return invoice?.title || "School fees";
  if (items.length === 1) return items[0].title || invoice?.title || "School fees";
  return `${items.length} fee items`;
}

export function createPlanForm() {
  return {
    title: "",
    amountNaira: "",
    termLabel: "",
    academicSession: "",
    description: "",
  };
}

export function createInvoiceForm() {
  return {
    studentIds: [],
    planId: "",
    title: "",
    amountNaira: "",
    dueAt: "",
    description: "",
  };
}

export function createPaymentDraft(invoice = {}) {
  return {
    open: false,
    paidForLabel: getInvoicePurposeLabel(invoice),
    paymentMethod: "transfer",
    paymentProvider: "",
    providerStatus: "",
    checkoutStatus: "idle",
    checkoutPaymentId: "",
    checkoutUrl: "",
    checkoutAccessCode: "",
    checkoutMessage: "",
    transactionReference: "",
    receiptMedia: [],
    receiptUrlDraft: "",
    notes: "",
  };
}

export function createCheckoutDraftPatch(payment = {}) {
  const status = String(payment.status || "").trim();
  const checkoutStatus =
    status === "Confirmed"
      ? "confirmed"
      : status === "Rejected"
      ? "failed"
      : status === "CheckoutPending"
      ? "pending"
      : "idle";

  return {
    checkoutAccessCode: payment.checkoutAccessCode || "",
    checkoutMessage: "",
    checkoutPaymentId: payment.id || "",
    checkoutStatus,
    checkoutUrl: payment.checkoutUrl || "",
    paymentMethod: "on_platform",
    paymentProvider: payment.paymentProvider || "",
    providerStatus: payment.providerStatus || "",
    transactionReference:
      payment.providerReference || payment.transactionReference || "",
  };
}
