import assert from "node:assert/strict";
import test from "node:test";

import commerceDomainModule from "../server/domains/commerce/index.js";
import communityDomainModule from "../server/domains/community/index.js";
import {
  ROLE,
  createStaticAuth,
  createTestApp,
  requireRole,
  withServer,
} from "./serverRouteHarness.js";

const { registerFeesRoutes, registerMarketplaceRoutes } = commerceDomainModule;
const { registerCommunityRoutes } = communityDomainModule;

function createFeesPool() {
  const school = {
    id: "school-1",
    name: "Alpha Academy",
    state_name: "Lagos",
  };
  const plans = [];

  return {
    async query(sql, params = []) {
      const text = String(sql);

      if (text.includes("FROM sf_schools") && text.includes("WHERE id = $1")) {
        return {
          rows: params[0] === school.id ? [school] : [],
        };
      }

      if (text.includes("INSERT INTO sf_fee_plans")) {
        plans.unshift({
          academic_session: params[7],
          amount_kobo: params[5],
          created_at: params[8],
          created_by_user_id: params[2],
          currency: "NGN",
          description: params[4],
          id: params[0],
          is_active: true,
          school_id: params[1],
          school_name: school.name,
          term_label: params[6],
          title: params[3],
          updated_at: params[9],
        });
        return { rows: [] };
      }

      if (text.includes("WHERE fp.id = $1")) {
        return {
          rows: plans.filter((plan) => plan.id === params[0]),
        };
      }

      if (text.includes("FROM sf_fee_plans fp") && text.includes("ORDER BY fp.created_at DESC")) {
        return { rows: plans };
      }

      throw new Error(`Unhandled fees query: ${text}`);
    },
  };
}

function createFeesCheckoutPool() {
  const school = {
    id: "school-1",
    lga_name: "Ikeja",
    name: "Alpha Academy",
    state_name: "Lagos",
  };
  const student = {
    email: "ada@example.com",
    id: "student-1",
    name: "Ada Student",
    role: ROLE.STUDENT,
    school_id: school.id,
    state_name: "Lagos",
  };
  const schoolUser = {
    id: "school-user-1",
    role: ROLE.SCHOOL,
    school_id: school.id,
  };
  const invoice = {
    amount_kobo: 1550000,
    created_at: "2026-03-19T10:00:00.000Z",
    currency: "NGN",
    description: "Second term fees",
    due_at: null,
    id: "invoice-1",
    issued_by_user_id: schoolUser.id,
    paid_at: null,
    plan_id: null,
    school_id: school.id,
    school_lga_name: school.lga_name,
    school_name: school.name,
    school_state_name: school.state_name,
    status: "Unpaid",
    student_id: student.id,
    student_name: student.name,
    student_school_id: school.id,
    student_state_name: school.state_name,
    title: "Second Term Fees",
    updated_at: "2026-03-19T10:00:00.000Z",
  };
  const invoiceItems = [
    {
      amount_kobo: invoice.amount_kobo,
      created_at: invoice.created_at,
      description: invoice.description,
      id: "item-1",
      invoice_id: invoice.id,
      plan_id: null,
      title: invoice.title,
      updated_at: invoice.updated_at,
    },
  ];
  const payments = [];

  function mergePayment(payment) {
    return {
      ...payment,
      invoice_currency: invoice.currency,
      invoice_title: invoice.title,
      school_id: school.id,
      school_name: school.name,
      school_state_name: school.state_name,
      student_id: student.id,
      student_name: student.name,
    };
  }

  async function query(sql, params = []) {
    const text = String(sql);

    if (text.includes("FROM sf_fee_invoices i") && text.includes("WHERE i.id = $1")) {
      return {
        rows: params[0] === invoice.id ? [invoice] : [],
      };
    }

    if (text.includes("FROM sf_fee_invoice_items") && text.includes("invoice_id = ANY")) {
      const ids = Array.isArray(params[0]) ? params[0] : [];
      return {
        rows: invoiceItems.filter((item) => ids.includes(item.invoice_id)),
      };
    }

    if (
      text.includes("FROM sf_fee_payments p") &&
      text.includes("WHERE p.invoice_id = $1") &&
      text.includes("CheckoutPending")
    ) {
      const match = payments
        .filter(
          (payment) =>
            payment.invoice_id === params[0] &&
            payment.status === "CheckoutPending" &&
            payment.payment_method === "on_platform"
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
      return {
        rows: match.length ? [mergePayment(match[0])] : [],
      };
    }

    if (text.includes("INSERT INTO sf_fee_payments")) {
      payments.push({
        amount_kobo: params[3],
        confirmation_code: params[4],
        confirmed_at: null,
        created_at: params[15],
        id: params[0],
        invoice_id: params[1],
        notes: params[13],
        paid_for_label: params[12],
        payer_user_id: params[2],
        payment_method: "on_platform",
        payment_provider: params[5],
        provider_access_code: params[8],
        provider_authorization_url: params[9],
        provider_payload: params[10],
        provider_reference: params[6],
        provider_status: params[7],
        provider_verified_at: null,
        receipt_media: "[]",
        receiver_user_id: null,
        rejected_at: null,
        school_receipt_issued_at: null,
        school_receipt_no: null,
        school_receipt_note: null,
        status: "CheckoutPending",
        student_marked_at: params[14],
        transaction_reference: params[11],
        updated_at: params[16],
      });
      return { rows: [] };
    }

    if (text.includes("FROM sf_fee_payments p") && text.includes("WHERE p.id = $1")) {
      const payment = payments.find((entry) => entry.id === params[0]);
      return {
        rows: payment ? [mergePayment(payment)] : [],
      };
    }

    if (
      text.includes("FROM sf_fee_payments p") &&
      text.includes("p.provider_reference = $1")
    ) {
      const payment = payments.find(
        (entry) =>
          entry.provider_reference === params[0] ||
          entry.transaction_reference === params[0]
      );
      return {
        rows: payment ? [mergePayment(payment)] : [],
      };
    }

    if (text.includes("FROM sf_fee_payments p") && text.includes("ORDER BY p.created_at DESC")) {
      return {
        rows: [...payments]
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(mergePayment),
      };
    }

    if (text.includes("UPDATE sf_fee_payments") && text.includes("status = 'Confirmed'")) {
      const payment = payments.find((entry) => entry.id === params[12]);
      if (payment) {
        payment.status = "Confirmed";
        payment.receiver_user_id = params[0];
        payment.payment_provider = params[1];
        payment.provider_reference = params[2];
        payment.provider_status = params[3];
        payment.provider_payload = params[4];
        payment.provider_verified_at = params[5];
        payment.transaction_reference = params[6];
        payment.confirmed_at = params[7];
        payment.school_receipt_no = params[8];
        payment.school_receipt_note = params[9];
        payment.school_receipt_issued_at = params[10];
        payment.updated_at = params[11];
      }
      return { rows: [] };
    }

    if (text.includes("UPDATE sf_fee_invoices") && text.includes("status = 'Paid'")) {
      invoice.status = "Paid";
      invoice.paid_at = params[0];
      invoice.updated_at = params[1];
      return { rows: [] };
    }

    if (text.includes("SELECT id") && text.includes("FROM sf_users") && text.includes("role = 'school'")) {
      return {
        rows: [{ id: schoolUser.id }],
      };
    }

    throw new Error(`Unhandled fees checkout query: ${text}`);
  }

  return {
    connect: async () => ({
      async query(sql, params = []) {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] };
        }
        return query(sql, params);
      },
      release() {},
    }),
    query,
  };
}

function createFeesManualPool() {
  const school = {
    id: "school-1",
    lga_name: "Ikeja",
    name: "Alpha Academy",
    state_name: "Lagos",
  };
  const student = {
    id: "student-1",
    name: "Ada Student",
    role: ROLE.STUDENT,
    school_id: school.id,
    state_name: "Lagos",
  };
  const schoolUser = {
    id: "school-user-1",
    role: ROLE.SCHOOL,
    school_id: school.id,
    state_name: school.state_name,
  };
  const invoice = {
    amount_kobo: 1550000,
    created_at: "2026-03-19T10:00:00.000Z",
    currency: "NGN",
    description: "Second term fees",
    due_at: null,
    id: "invoice-1",
    issued_by_user_id: schoolUser.id,
    paid_at: null,
    plan_id: null,
    school_id: school.id,
    school_lga_name: school.lga_name,
    school_name: school.name,
    school_state_name: school.state_name,
    status: "Unpaid",
    student_id: student.id,
    student_name: student.name,
    student_school_id: school.id,
    student_state_name: school.state_name,
    title: "Second Term Fees",
    updated_at: "2026-03-19T10:00:00.000Z",
  };
  const invoiceItems = [
    {
      amount_kobo: invoice.amount_kobo,
      created_at: invoice.created_at,
      description: invoice.description,
      id: "item-1",
      invoice_id: invoice.id,
      plan_id: null,
      title: invoice.title,
      updated_at: invoice.updated_at,
    },
  ];
  const payments = [];

  function mergePayment(payment) {
    return {
      ...payment,
      invoice_currency: invoice.currency,
      invoice_title: invoice.title,
      school_id: school.id,
      school_name: school.name,
      school_state_name: school.state_name,
      student_id: student.id,
      student_name: student.name,
    };
  }

  async function query(sql, params = []) {
    const text = String(sql);

    if (text.includes("FROM sf_fee_invoices i") && text.includes("WHERE i.id = $1")) {
      return {
        rows: params[0] === invoice.id ? [invoice] : [],
      };
    }

    if (text.includes("FROM sf_fee_invoice_items") && text.includes("invoice_id = ANY")) {
      const ids = Array.isArray(params[0]) ? params[0] : [];
      return {
        rows: invoiceItems.filter((item) => ids.includes(item.invoice_id)),
      };
    }

    if (
      text.includes("SELECT id, confirmation_code, status") &&
      text.includes("FROM sf_fee_payments")
    ) {
      const payment = [...payments]
        .filter(
          (entry) =>
            entry.invoice_id === params[0] &&
            (entry.status === "CheckoutPending" ||
              entry.status === "PendingConfirmation")
        )
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];
      return {
        rows: payment
          ? [
              {
                confirmation_code: payment.confirmation_code,
                id: payment.id,
                status: payment.status,
              },
            ]
          : [],
      };
    }

    if (
      text.includes("INSERT INTO sf_fee_payments") &&
      text.includes("status, confirmation_code, payment_method, transaction_reference")
    ) {
      payments.push({
        amount_kobo: params[3],
        confirmation_code: params[4],
        confirmed_at: null,
        created_at: params[11],
        id: params[0],
        invoice_id: params[1],
        notes: params[9],
        paid_for_label: params[7],
        payer_user_id: params[2],
        payment_method: params[5],
        payment_provider: null,
        provider_access_code: null,
        provider_authorization_url: null,
        provider_payload: null,
        provider_reference: null,
        provider_status: null,
        provider_verified_at: null,
        receipt_media: params[8],
        receiver_user_id: null,
        rejected_at: null,
        school_receipt_issued_at: null,
        school_receipt_no: null,
        school_receipt_note: null,
        status: "PendingConfirmation",
        student_marked_at: params[10],
        transaction_reference: params[6],
        updated_at: params[12],
      });
      return { rows: [] };
    }

    if (
      text.includes("UPDATE sf_fee_invoices") &&
      text.includes("status = 'PendingConfirmation'")
    ) {
      invoice.status = "PendingConfirmation";
      invoice.updated_at = params[0];
      return { rows: [] };
    }

    if (text.includes("FROM sf_fee_payments p") && text.includes("WHERE p.id = $1")) {
      const payment = payments.find((entry) => entry.id === params[0]);
      return {
        rows: payment ? [mergePayment(payment)] : [],
      };
    }

    if (
      text.includes("UPDATE sf_fee_payments") &&
      text.includes("status = 'Confirmed'") &&
      text.includes("school_receipt_note = $4")
    ) {
      const payment = payments.find((entry) => entry.id === params[6]);
      if (payment) {
        payment.status = "Confirmed";
        payment.receiver_user_id = params[0];
        payment.confirmed_at = params[1];
        payment.school_receipt_no = params[2];
        payment.school_receipt_note = params[3];
        payment.school_receipt_issued_at = params[4];
        payment.updated_at = params[5];
      }
      return { rows: [] };
    }

    if (text.includes("UPDATE sf_fee_invoices") && text.includes("status = 'Paid'")) {
      invoice.status = "Paid";
      invoice.paid_at = params[0];
      invoice.updated_at = params[1];
      return { rows: [] };
    }

    if (text.includes("SELECT id") && text.includes("FROM sf_users") && text.includes("role = 'school'")) {
      return {
        rows: [{ id: schoolUser.id }],
      };
    }

    if (text.includes("FROM sf_fee_payments p") && text.includes("ORDER BY p.created_at DESC")) {
      const payerFilter = text.includes("p.payer_user_id = $1") ? params[0] : null;
      return {
        rows: [...payments]
          .filter((payment) =>
            payerFilter ? payment.payer_user_id === payerFilter : true
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(mergePayment),
      };
    }

    throw new Error(`Unhandled fees manual query: ${text}`);
  }

  return {
    connect: async () => ({
      async query(sql, params = []) {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] };
        }
        return query(sql, params);
      },
      release() {},
    }),
    query,
  };
}

function createMarketplacePool() {
  const seller = {
    bank_account_name: "Seller Sam",
    bank_account_number: "0123456789",
    bank_name: "Study Bank",
    email: "seller@example.com",
    id: "seller-1",
    name: "Seller Sam",
  };
  const buyer = {
    id: "buyer-1",
    name: "Ada Buyer",
  };
  const product = {
    average_rating: 0,
    category_id: null,
    category_name: null,
    condition: "new",
    created_at: "2026-03-19T10:00:00.000Z",
    custom_category_name: null,
    description: "Scientific calculator",
    id: "product-1",
    is_active: true,
    lga_name: "Ikeja",
    listing_type: "student",
    media_urls: "[]",
    moderation_reason: null,
    moderation_status: "active",
    price_kobo: 350000,
    quantity_available: 3,
    rating_count: 0,
    report_count: 0,
    school_id: null,
    school_name: null,
    school_report_weight: 0,
    seller_email: seller.email,
    seller_name: seller.name,
    seller_role: "student",
    seller_school_report_weight: 0,
    seller_student_report_weight: 0,
    seller_user_id: seller.id,
    seller_verified: true,
    state_name: "Lagos",
    student_report_weight: 0,
    title: "Calculator",
    updated_at: "2026-03-19T10:00:00.000Z",
  };
  const orders = [];
  const wallets = [];
  const walletTransactions = [];

  function mapOrderForQuery(order) {
    return {
      ...order,
      buyer_name: buyer.name,
      product_title: product.title,
      seller_account_name: seller.bank_account_name,
      seller_bank_name: seller.bank_name,
      seller_account_number: seller.bank_account_number,
      seller_name: seller.name,
      state_name: product.state_name,
    };
  }

  async function query(sql, params = []) {
    const text = String(sql);

    if (text.includes("FROM sf_market_products p") && text.includes("WHERE p.id = $1")) {
      return {
        rows: params[0] === product.id ? [product] : [],
      };
    }

    if (text.includes("INSERT INTO sf_market_orders") && !text.includes("escrow_status")) {
      orders.push({
        buyer_name: buyer.name,
        buyer_payment_reference: params[9],
        buyer_user_id: params[2],
        cash_confirmed_by_seller_at: params[16],
        claim_code: params[14],
        claim_code_generated_at: params[15],
        claim_code_released_to_buyer_at: params[18],
        claimed_by_buyer_at: null,
        created_at: params[20],
        escrow_funded_at: null,
        escrow_hold_kobo: 0,
        escrow_released_at: null,
        escrow_status: "not_applicable",
        id: params[0],
        notes: params[19],
        payment_confirmed_at: params[17],
        payment_mode: params[7],
        payment_provider: params[8],
        platform_fee_kobo: params[11],
        platform_fee_rate_bps: params[10],
        product_id: params[1],
        product_title: product.title,
        quantity: params[4],
        seller_account_name: seller.bank_account_name,
        seller_bank_name: seller.bank_name,
        seller_account_number: seller.bank_account_number,
        seller_name: seller.name,
        seller_net_kobo: params[12],
        seller_payout_reference: null,
        seller_payout_status: "not_applicable",
        seller_user_id: params[3],
        status: params[13],
        total_amount_kobo: params[6],
        unit_price_kobo: params[5],
        updated_at: params[21],
      });
      return { rows: [] };
    }

    if (text.includes("INSERT INTO sf_market_orders") && text.includes("escrow_status")) {
      const createdAt = params[25];
      orders.push({
        buyer_name: buyer.name,
        buyer_payment_reference: params[9],
        buyer_user_id: params[2],
        cash_confirmed_by_seller_at: params[16],
        claim_code: params[14],
        claim_code_generated_at: params[15],
        claim_code_released_to_buyer_at: params[18],
        claimed_by_buyer_at: null,
        created_at: createdAt,
        escrow_funded_at: params[21],
        escrow_hold_kobo: params[20],
        escrow_released_at: null,
        escrow_status: params[19],
        id: params[0],
        notes: params[24],
        payment_confirmed_at: params[17],
        payment_mode: params[7],
        payment_provider: params[8],
        platform_fee_kobo: params[11],
        platform_fee_rate_bps: params[10],
        product_id: params[1],
        product_title: product.title,
        quantity: params[4],
        seller_account_name: seller.bank_account_name,
        seller_bank_name: seller.bank_name,
        seller_account_number: seller.bank_account_number,
        seller_name: seller.name,
        seller_net_kobo: params[12],
        seller_payout_reference: params[23],
        seller_payout_status: params[22],
        seller_user_id: params[3],
        status: params[13],
        total_amount_kobo: params[6],
        unit_price_kobo: params[5],
        updated_at: params[26],
      });
      return { rows: [] };
    }

    if (text.includes("UPDATE sf_market_products") && text.includes("quantity_available = quantity_available -")) {
      product.quantity_available -= params[0];
      product.updated_at = params[1];
      return { rows: [] };
    }

    if (text.includes("FROM sf_market_wallets") && text.includes("WHERE user_id = $1")) {
      return {
        rows: wallets.filter((wallet) => wallet.user_id === params[0]).slice(0, 1),
      };
    }

    if (text.includes("FROM sf_market_wallets") && text.includes("WHERE id = $1")) {
      return {
        rows: wallets.filter((wallet) => wallet.id === params[0]).slice(0, 1),
      };
    }

    if (text.includes("INSERT INTO sf_market_wallets")) {
      wallets.push({
        available_balance_kobo: 0,
        created_at: params[2],
        id: params[0],
        last_transaction_at: null,
        lifetime_earned_kobo: 0,
        pending_balance_kobo: 0,
        updated_at: params[3],
        user_id: params[1],
      });
      return { rows: [] };
    }

    if (text.includes("INSERT INTO sf_messages")) {
      return { rows: [] };
    }

    if (text.includes("UPDATE sf_market_wallets") && text.includes("pending_balance_kobo = $1")) {
      const wallet = wallets.find((entry) => entry.id === params[3]);
      if (wallet) {
        wallet.pending_balance_kobo = params[0];
        wallet.last_transaction_at = params[1];
        wallet.updated_at = params[2];
      }
      return { rows: [] };
    }

    if (text.includes("UPDATE sf_market_wallets") && text.includes("available_balance_kobo = $1")) {
      const wallet = wallets.find((entry) => entry.id === params[5]);
      if (wallet) {
        wallet.available_balance_kobo = params[0];
        wallet.pending_balance_kobo = params[1];
        wallet.lifetime_earned_kobo = params[2];
        wallet.last_transaction_at = params[3];
        wallet.updated_at = params[4];
      }
      return { rows: [] };
    }

    if (text.includes("INSERT INTO sf_market_wallet_transactions")) {
      walletTransactions.push({
        amount_kobo: params[4],
        balance_after_available_kobo: params[5],
        balance_after_pending_kobo: params[6],
        created_at: params[8],
        direction: text.includes("'credit'") ? "credit" : "debit",
        id: params[0],
        note: params[7],
        order_id: params[3],
        transaction_type: text.includes("'escrow_release'")
          ? "escrow_release"
          : text.includes("'escrow_hold'")
          ? "escrow_hold"
          : "adjustment",
        user_id: params[2],
        wallet_id: params[1],
      });
      return { rows: [] };
    }

    if (
      text.includes("FROM sf_market_wallet_transactions") &&
      text.includes("WHERE user_id = $1")
    ) {
      return {
        rows: walletTransactions
          .filter((entry) => entry.user_id === params[0])
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()),
      };
    }

    if (text.includes("FROM sf_market_orders o") && text.includes("WHERE o.id = $1")) {
      return {
        rows: orders.filter((order) => order.id === params[0]).map(mapOrderForQuery),
      };
    }

    if (text.includes("FROM sf_market_orders o") && text.includes("ORDER BY o.created_at DESC")) {
      const actorId = params[0] || null;
      return {
        rows: [...orders]
          .filter((order) =>
            actorId
              ? order.buyer_user_id === actorId || order.seller_user_id === actorId
              : true
          )
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
          .map(mapOrderForQuery),
      };
    }

    if (text.includes("FROM sf_market_orders") && text.includes("WHERE id = $1")) {
      return {
        rows: orders.filter((order) => order.id === params[0]),
      };
    }

    if (
      text.includes("UPDATE sf_market_orders") &&
      text.includes("claim_code_released_to_buyer_at = $1")
    ) {
      const order = orders.find((entry) => entry.id === params[2]);
      if (order) {
        order.claim_code_released_to_buyer_at = params[0];
        order.updated_at = params[1];
      }
      return { rows: [] };
    }

    if (
      text.includes("UPDATE sf_market_orders") &&
      text.includes("status = 'Completed'") &&
      text.includes("escrow_status = CASE")
    ) {
      const order = orders.find((entry) => entry.id === params[3]);
      if (order) {
        order.status = "Completed";
        order.claimed_by_buyer_at = params[0];
        if (order.payment_mode === "card" && order.escrow_status === "held") {
          order.escrow_status = "released";
          order.escrow_released_at = params[1];
          order.seller_payout_status = "available";
        }
        order.updated_at = params[2];
      }
      return { rows: [] };
    }

    throw new Error(`Unhandled marketplace query: ${text}`);
  }

  return {
    connect: async () => ({
      async query(sql, params = []) {
        if (sql === "BEGIN" || sql === "COMMIT" || sql === "ROLLBACK") {
          return { rows: [] };
        }
        return query(sql, params);
      },
      release() {},
    }),
    query,
  };
}

function createCommunityFeedPool() {
  const school = {
    id: "school-1",
    lga_name: "Ikeja",
    name: "Alpha Academy",
    state_name: "Lagos",
  };
  const users = [
    {
      avatar_url: "",
      email: "ada@example.com",
      id: "user-1",
      lga_name: "Ikeja",
      name: "Ada Student",
      role: ROLE.STUDENT,
      school_id: school.id,
      state_name: "Lagos",
    },
    {
      avatar_url: "",
      email: "jude@example.com",
      id: "user-2",
      lga_name: "Ikeja",
      name: "Jude School",
      role: ROLE.SCHOOL,
      school_id: school.id,
      state_name: "Lagos",
    },
  ];
  const posts = [];
  const comments = [];

  function findUser(userId) {
    return users.find((entry) => entry.id === userId) || null;
  }

  function mapPostForQuery(post) {
    const author = findUser(post.author_user_id) || {};
    return {
      ...post,
      author_avatar_url: author.avatar_url || "",
      author_name: author.name || null,
      author_role: author.role || null,
      author_school_name: author.school_id === school.id ? school.name : null,
      author_state_name: author.state_name || null,
      comments_count: comments.filter((entry) => entry.post_id === post.id).length,
      my_reaction: null,
      reaction_summary: {},
      reactions_count: 0,
      scope_school_name: post.scope_school_id === school.id ? school.name : null,
      scope_school_state_name:
        post.scope_school_id === school.id ? school.state_name : null,
    };
  }

  function mapCommentForQuery(comment) {
    const author = findUser(comment.author_user_id) || {};
    return {
      ...comment,
      author_name: author.name || null,
      author_role: author.role || null,
    };
  }

  return {
    async query(sql, params = []) {
      const text = String(sql);

      if (
        text.includes("FROM sf_users u") &&
        text.includes("ORDER BY u.name ASC") &&
        text.includes("LIMIT 1200")
      ) {
        const actorId = params[0];
        const search = String(params[1] || "")
          .replace(/^%|%$/g, "")
          .toLowerCase();
        return {
          rows: users
            .filter((entry) => entry.id !== actorId)
            .filter((entry) => {
              if (!search) return true;
              return [
                entry.name,
                entry.email,
                entry.role,
                school.name,
                entry.state_name,
              ]
                .filter(Boolean)
                .join(" ")
                .toLowerCase()
                .includes(search);
            })
            .map((entry) => ({
              ...entry,
              school_lga_name: school.lga_name,
              school_name: entry.school_id === school.id ? school.name : null,
              school_state_name:
                entry.school_id === school.id ? school.state_name : null,
            })),
        };
      }

      if (
        text.includes("SELECT id") &&
        text.includes("FROM sf_users") &&
        text.includes("id = ANY")
      ) {
        const ids = Array.isArray(params[0]) ? params[0] : [];
        return {
          rows: users.filter((entry) => ids.includes(entry.id)).map((entry) => ({
            id: entry.id,
          })),
        };
      }

      if (text.includes("INSERT INTO sf_feed_posts")) {
        posts.push({
          author_user_id: params[1],
          body: params[8],
          created_at: params[10],
          id: params[0],
          media_urls: params[9],
          scope_school_id: params[4],
          scope_state_name: params[3],
          scope_type: params[2],
          title: params[7],
          updated_at: params[11],
          visibility_mode: params[5],
          visibility_selected_user_ids: params[6],
        });
        return { rows: [] };
      }

      if (
        text.includes("SELECT p.*, s.state_name AS scope_school_state_name") &&
        text.includes("FROM sf_feed_posts p")
      ) {
        const post = posts.find((entry) => entry.id === params[0]);
        return {
          rows: post
            ? [
                {
                  ...post,
                  scope_school_state_name:
                    post.scope_school_id === school.id ? school.state_name : null,
                },
              ]
            : [],
        };
      }

      if (
        text.includes("WITH reaction_counts AS") &&
        text.includes("FROM sf_feed_posts p")
      ) {
        return {
          rows: [...posts]
            .sort(
              (a, b) =>
                new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
            )
            .map(mapPostForQuery),
        };
      }

      if (
        text.includes("FROM sf_feed_posts p") &&
        text.includes("JOIN sf_users u ON u.id = p.author_user_id") &&
        text.includes("WHERE p.id = $1")
      ) {
        const post = posts.find((entry) => entry.id === params[0]);
        return {
          rows: post ? [mapPostForQuery(post)] : [],
        };
      }

      if (text.includes("INSERT INTO sf_feed_comments")) {
        comments.push({
          author_user_id: params[2],
          body: params[3],
          created_at: params[5],
          id: params[0],
          media_urls: params[4],
          post_id: params[1],
          updated_at: params[6],
        });
        return { rows: [] };
      }

      if (
        text.includes("FROM sf_feed_comments c") &&
        text.includes("WHERE c.post_id = $1")
      ) {
        return {
          rows: comments
            .filter((entry) => entry.post_id === params[0])
            .sort(
              (a, b) =>
                new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
            )
            .map(mapCommentForQuery),
        };
      }

      if (
        text.includes("FROM sf_feed_comments c") &&
        text.includes("WHERE c.id = $1")
      ) {
        const comment = comments.find((entry) => entry.id === params[0]);
        return {
          rows: comment ? [mapCommentForQuery(comment)] : [],
        };
      }

      throw new Error(`Unhandled community feed query: ${text}`);
    },
  };
}

test("fees routes create plans, list scoped plans, and reject student admin writes", async () => {
  const pool = createFeesPool();

  const schoolApp = createTestApp();
  registerFeesRoutes({
    app: schoolApp,
    pool,
    auth: createStaticAuth({
      id: "school-user-1",
      role: ROLE.SCHOOL,
      school_id: "school-1",
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: null,
    notifyUsers: null,
    requireRole,
    ROLE,
  });

  await withServer(schoolApp, async ({ request }) => {
    const createResponse = await request("/fees/plans", {
      body: {
        amountNaira: 15500,
        title: "Second Term Fees",
      },
      method: "POST",
    });
    assert.equal(createResponse.status, 201);
    assert.equal(createResponse.body.title, "Second Term Fees");
    assert.equal(createResponse.body.amountKobo, 1550000);
    assert.equal(createResponse.body.schoolId, "school-1");
  });

  const studentApp = createTestApp();
  registerFeesRoutes({
    app: studentApp,
    pool,
    auth: createStaticAuth({
      id: "student-1",
      role: ROLE.STUDENT,
      school_id: "school-1",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: null,
    notifyUsers: null,
    requireRole,
    ROLE,
  });

  await withServer(studentApp, async ({ request }) => {
    const listResponse = await request("/fees/plans");
    assert.equal(listResponse.status, 200);
    assert.equal(listResponse.body.length, 1);
    assert.equal(listResponse.body[0].title, "Second Term Fees");

    const forbiddenResponse = await request("/fees/plans", {
      body: { amountNaira: 5000, title: "Should fail" },
      method: "POST",
    });
    assert.equal(forbiddenResponse.status, 403);
    assert.deepEqual(forbiddenResponse.body, {
      error: "Forbidden for this role",
    });
  });
});

test("fees routes expose provider status and reconcile online checkout payments", async () => {
  const pool = createFeesCheckoutPool();
  const paymentRail = {
    getStatus() {
      return {
        available: true,
        callbackUrl: "http://localhost:5173/?module=fees",
        checkedAt: "2026-03-19T10:05:00.000Z",
        checkoutFlow: "redirect",
        mode: "paystack",
        provider: "paystack",
        readiness: "ready",
        supportedMethods: ["on_platform"],
        timeoutMs: 35000,
      };
    },
    initializeFeePayment({ reference }) {
      return Promise.resolve({
        accessCode: "ACCESS_checkout_1",
        authorizationUrl: "https://checkout.paystack.test/pay/checkout_1",
        provider: "paystack",
        providerStatus: "initialized",
        raw: {
          access_code: "ACCESS_checkout_1",
          authorization_url: "https://checkout.paystack.test/pay/checkout_1",
          reference,
          status: "initialized",
        },
        reference,
      });
    },
    isReady() {
      return true;
    },
    parseWebhookEvent(payload) {
      if (payload?.event !== "charge.success") return null;
      return {
        eventType: "charge.success",
        verification: {
          amountKobo: Number(payload?.data?.amount || 0),
          currency: payload?.data?.currency || "NGN",
          paidAt: payload?.data?.paid_at || null,
          provider: "paystack",
          raw: payload?.data || {},
          reference: payload?.data?.reference || "",
          transactionStatus: payload?.data?.status || "success",
        },
      };
    },
    verifyWebhookSignature({ signature }) {
      return signature === "valid-signature";
    },
    verifyFeePayment({ reference }) {
      return Promise.resolve({
        amountKobo: 1550000,
        currency: "NGN",
        paidAt: "2026-03-19T10:09:00.000Z",
        provider: "paystack",
        raw: {
          amount: 1550000,
          currency: "NGN",
          paid_at: "2026-03-19T10:09:00.000Z",
          reference,
          status: "success",
        },
        reference,
        transactionStatus: "success",
      });
    },
  };

  const app = createTestApp();
  registerFeesRoutes({
    app,
    pool,
    auth: createStaticAuth({
      email: "ada@example.com",
      id: "student-1",
      name: "Ada Student",
      role: ROLE.STUDENT,
      school_id: "school-1",
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: null,
    notifyUsers: null,
    paymentRail,
    requireRole,
    ROLE,
  });

  await withServer(app, async ({ request }) => {
    const statusResponse = await request("/fees/payment-provider/status");
    assert.equal(statusResponse.status, 200);
    assert.equal(statusResponse.body.available, true);
    assert.equal(statusResponse.body.provider, "paystack");

    const legacyResponse = await request("/fees/invoices/invoice-1/mark-paid", {
      body: {
        paidForLabel: "Second Term Fees",
        paymentMethod: "on_platform",
      },
      method: "POST",
    });
    assert.equal(legacyResponse.status, 400);
    assert.match(legacyResponse.body.error, /online checkout flow/i);

    const checkoutResponse = await request("/fees/invoices/invoice-1/checkout", {
      body: {
        notes: "Paid with card",
        paidForLabel: "Second Term Fees",
      },
      method: "POST",
    });
    assert.equal(checkoutResponse.status, 201);
    assert.equal(checkoutResponse.body.payment.status, "CheckoutPending");
    assert.equal(checkoutResponse.body.payment.paymentProvider, "paystack");
    assert.match(
      checkoutResponse.body.payment.checkoutUrl,
      /checkout\.paystack\.test/
    );

    const reconcileResponse = await request(
      `/fees/payments/${checkoutResponse.body.payment.id}/reconcile`,
      {
        method: "POST",
      }
    );
    assert.equal(reconcileResponse.status, 200);
    assert.equal(reconcileResponse.body.ok, true);
    assert.equal(reconcileResponse.body.payment.status, "Confirmed");
    assert.equal(reconcileResponse.body.invoice.status, "Paid");
    assert.match(reconcileResponse.body.receipt.receiptNo, /^SF-REC-/);
  });
});

test("fees routes accept signed payment-provider webhooks and auto-confirm matching checkouts", async () => {
  const pool = createFeesCheckoutPool();
  const paymentRail = {
    getStatus() {
      return {
        available: true,
        callbackUrl: "http://localhost:5173/?module=fees",
        checkedAt: "2026-03-19T10:05:00.000Z",
        checkoutFlow: "redirect",
        mode: "paystack",
        provider: "paystack",
        readiness: "ready",
        supportedMethods: ["on_platform"],
        timeoutMs: 35000,
        webhookEnabled: true,
      };
    },
    initializeFeePayment({ reference }) {
      return Promise.resolve({
        accessCode: "ACCESS_checkout_2",
        authorizationUrl: "https://checkout.paystack.test/pay/checkout_2",
        provider: "paystack",
        providerStatus: "initialized",
        raw: {
          access_code: "ACCESS_checkout_2",
          authorization_url: "https://checkout.paystack.test/pay/checkout_2",
          reference,
          status: "initialized",
        },
        reference,
      });
    },
    isReady() {
      return true;
    },
    parseWebhookEvent(payload) {
      if (payload?.event !== "charge.success") return null;
      return {
        eventType: "charge.success",
        verification: {
          amountKobo: Number(payload?.data?.amount || 0),
          currency: payload?.data?.currency || "NGN",
          paidAt: payload?.data?.paid_at || null,
          provider: "paystack",
          raw: payload?.data || {},
          reference: payload?.data?.reference || "",
          transactionStatus: payload?.data?.status || "success",
        },
      };
    },
    verifyWebhookSignature({ signature }) {
      return signature === "valid-signature";
    },
    verifyFeePayment() {
      throw new Error("Manual verify should not be used in webhook test");
    },
  };

  const app = createTestApp();
  registerFeesRoutes({
    app,
    pool,
    auth: createStaticAuth({
      email: "ada@example.com",
      id: "student-1",
      name: "Ada Student",
      role: ROLE.STUDENT,
      school_id: "school-1",
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: null,
    notifyUsers: null,
    paymentRail,
    requireRole,
    ROLE,
  });

  await withServer(app, async ({ request }) => {
    const checkoutResponse = await request("/fees/invoices/invoice-1/checkout", {
      body: {
        notes: "Webhook-backed checkout",
        paidForLabel: "Second Term Fees",
      },
      method: "POST",
    });
    assert.equal(checkoutResponse.status, 201);

    const webhookPayload = {
      event: "charge.success",
      data: {
        amount: 1550000,
        currency: "NGN",
        paid_at: "2026-03-19T10:11:00.000Z",
        reference: checkoutResponse.body.payment.providerReference,
        status: "success",
      },
    };

    const webhookResponse = await request("/fees/payment-provider/webhook", {
      body: JSON.stringify(webhookPayload),
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": "valid-signature",
      },
      method: "POST",
    });
    assert.equal(webhookResponse.status, 200);
    assert.equal(webhookResponse.body.outcome, "confirmed");

    const duplicateWebhookResponse = await request("/fees/payment-provider/webhook", {
      body: JSON.stringify(webhookPayload),
      headers: {
        "content-type": "application/json",
        "x-paystack-signature": "valid-signature",
      },
      method: "POST",
    });
    assert.equal(duplicateWebhookResponse.status, 200);
    assert.equal(duplicateWebhookResponse.body.alreadyProcessed, true);

    const paymentsResponse = await request("/fees/payments");
    assert.equal(paymentsResponse.status, 200);
    assert.equal(paymentsResponse.body[0].status, "Confirmed");
    assert.equal(paymentsResponse.body[0].schoolReceiptNo.startsWith("SF-REC-"), true);
  });
});

test("fees routes submit manual payment proof and let school confirm it end to end", async () => {
  const pool = createFeesManualPool();

  const studentApp = createTestApp();
  registerFeesRoutes({
    app: studentApp,
    pool,
    auth: createStaticAuth({
      id: "student-1",
      name: "Ada Student",
      role: ROLE.STUDENT,
      school_id: "school-1",
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: null,
    notifyUsers: null,
    requireRole,
    ROLE,
  });

  const schoolApp = createTestApp();
  registerFeesRoutes({
    app: schoolApp,
    pool,
    auth: createStaticAuth({
      id: "school-user-1",
      name: "School Admin",
      role: ROLE.SCHOOL,
      school_id: "school-1",
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: null,
    notifyUsers: null,
    requireRole,
    ROLE,
  });

  await withServer(studentApp, async ({ request: studentRequest }) => {
    await withServer(schoolApp, async ({ request: schoolRequest }) => {
      const submitResponse = await studentRequest("/fees/invoices/invoice-1/mark-paid", {
        body: {
          notes: "Bank transfer completed this morning.",
          paidForLabel: "Second Term Fees",
          paymentMethod: "transfer",
          receiptMedia: [
            {
              kind: "image",
              url: "data:image/png;base64,AAAA",
            },
          ],
          transactionReference: "TRF-2026-0001",
        },
        method: "POST",
      });
      assert.equal(submitResponse.status, 201);
      assert.equal(submitResponse.body.status, "PendingConfirmation");
      assert.equal(submitResponse.body.paymentMethod, "transfer");
      assert.equal(submitResponse.body.receiptMedia.length, 1);
      assert.equal(typeof submitResponse.body.confirmationCode, "string");
      assert.equal(submitResponse.body.confirmationCode.length, 6);

      const studentHistoryBeforeConfirm = await studentRequest("/fees/payments");
      assert.equal(studentHistoryBeforeConfirm.status, 200);
      assert.equal(studentHistoryBeforeConfirm.body.length, 1);
      assert.equal(studentHistoryBeforeConfirm.body[0].status, "PendingConfirmation");
      assert.equal(
        studentHistoryBeforeConfirm.body[0].confirmationCode,
        submitResponse.body.confirmationCode
      );

      const confirmResponse = await schoolRequest(
        `/fees/payments/${submitResponse.body.id}/confirm`,
        {
          body: {
            schoolReceiptNote: "Cashier confirmed the transfer evidence.",
          },
          method: "POST",
        }
      );
      assert.equal(confirmResponse.status, 200);
      assert.equal(confirmResponse.body.ok, true);
      assert.equal(confirmResponse.body.invoice.status, "Paid");
      assert.match(confirmResponse.body.receipt.receiptNo, /^SF-REC-/);

      const studentHistoryAfterConfirm = await studentRequest("/fees/payments");
      assert.equal(studentHistoryAfterConfirm.status, 200);
      assert.equal(studentHistoryAfterConfirm.body.length, 1);
      assert.equal(studentHistoryAfterConfirm.body[0].status, "Confirmed");
      assert.equal(studentHistoryAfterConfirm.body[0].schoolReceiptNo.startsWith("SF-REC-"), true);
      assert.equal(studentHistoryAfterConfirm.body[0].schoolReceiptNote, "Cashier confirmed the transfer evidence.");
      assert.equal(studentHistoryAfterConfirm.body[0].confirmationCode, null);
    });
  });
});

test("marketplace routes create buyer orders and reject listing writes for state actors", async () => {
  const pool = createMarketplacePool();

  const buyerApp = createTestApp();
  registerMarketplaceRoutes({
    app: buyerApp,
    pool,
    auth: createStaticAuth({
      id: "buyer-1",
      name: "Ada Buyer",
      role: ROLE.STUDENT,
    }),
    asyncRoute: (handler) => handler,
    auditEvent: async () => {},
    notifyUsers: async () => {},
    requireRole,
    ROLE,
  });

  await withServer(buyerApp, async ({ request }) => {
    const orderResponse = await request("/market/orders", {
      body: {
        paymentMode: "cash",
        productId: "product-1",
        quantity: 1,
      },
      method: "POST",
    });
    assert.equal(orderResponse.status, 201);
    assert.equal(orderResponse.body.productId, "product-1");
    assert.equal(orderResponse.body.paymentMode, "cash");
    assert.equal(orderResponse.body.status, "PendingCash");
    assert.equal(orderResponse.body.totalAmountKobo, 350000);
  });

  const stateApp = createTestApp();
  registerMarketplaceRoutes({
    app: stateApp,
    pool,
    auth: createStaticAuth({
      id: "state-1",
      role: ROLE.STATE,
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    auditEvent: async () => {},
    notifyUsers: async () => {},
    requireRole,
    ROLE,
  });

  await withServer(stateApp, async ({ request }) => {
    const forbiddenResponse = await request("/market/products", {
      body: {
        priceNaira: 5000,
        title: "Prohibited listing",
      },
      method: "POST",
    });
    assert.equal(forbiddenResponse.status, 403);
    assert.deepEqual(forbiddenResponse.body, {
      error: "Forbidden for this role",
    });
  });
});

test("marketplace routes hold card orders in escrow and release seller wallet funds after buyer claim", async () => {
  const pool = createMarketplacePool();

  const buyerApp = createTestApp();
  registerMarketplaceRoutes({
    app: buyerApp,
    pool,
    auth: createStaticAuth({
      id: "buyer-1",
      name: "Ada Buyer",
      role: ROLE.STUDENT,
    }),
    asyncRoute: (handler) => handler,
    auditEvent: async () => {},
    notifyUsers: async () => {},
    requireRole,
    ROLE,
  });

  const sellerApp = createTestApp();
  registerMarketplaceRoutes({
    app: sellerApp,
    pool,
    auth: createStaticAuth({
      id: "seller-1",
      name: "Seller Sam",
      role: ROLE.STUDENT,
    }),
    asyncRoute: (handler) => handler,
    auditEvent: async () => {},
    notifyUsers: async () => {},
    requireRole,
    ROLE,
  });

  await withServer(buyerApp, async ({ request: buyerRequest }) => {
    await withServer(sellerApp, async ({ request: sellerRequest }) => {
      const orderResponse = await buyerRequest("/market/orders", {
        body: {
          paymentMode: "card",
          productId: "product-1",
          quantity: 1,
        },
        method: "POST",
      });
      assert.equal(orderResponse.status, 201);
      assert.equal(orderResponse.body.paymentMode, "card");
      assert.equal(orderResponse.body.status, "CashConfirmed");
      assert.equal(orderResponse.body.escrowStatus, "held");
      assert.equal(orderResponse.body.sellerPayoutStatus, "pending");
      assert.equal(orderResponse.body.paymentProvider, "studyflow_escrow");
      assert.equal(orderResponse.body.claimCode, null);

      const sellerWalletHeld = await sellerRequest("/market/wallet");
      assert.equal(sellerWalletHeld.status, 200);
      assert.equal(sellerWalletHeld.body.availableBalanceKobo, 0);
      assert.equal(sellerWalletHeld.body.pendingBalanceKobo, 343000);

      const sellerWalletTransactionsHeld = await sellerRequest(
        "/market/wallet/transactions"
      );
      assert.equal(sellerWalletTransactionsHeld.status, 200);
      assert.equal(sellerWalletTransactionsHeld.body.length, 1);
      assert.equal(sellerWalletTransactionsHeld.body[0].transactionType, "escrow_hold");

      const sellerOrdersBeforeRelease = await sellerRequest("/market/orders");
      assert.equal(sellerOrdersBeforeRelease.status, 200);
      assert.equal(sellerOrdersBeforeRelease.body.length, 1);
      assert.equal(typeof sellerOrdersBeforeRelease.body[0].claimCode, "string");

      const releaseResponse = await sellerRequest(
        `/market/orders/${orderResponse.body.id}/release-claim-code`,
        {
          method: "POST",
        }
      );
      assert.equal(releaseResponse.status, 200);

      const buyerOrdersAfterRelease = await buyerRequest("/market/orders");
      assert.equal(buyerOrdersAfterRelease.status, 200);
      assert.equal(buyerOrdersAfterRelease.body.length, 1);
      assert.equal(buyerOrdersAfterRelease.body[0].claimCodeReleasedAt !== null, true);
      assert.equal(typeof buyerOrdersAfterRelease.body[0].claimCode, "string");

      const buyerClaimResponse = await buyerRequest(
        `/market/orders/${orderResponse.body.id}/buyer-claim`,
        {
          body: {
            claimCode: buyerOrdersAfterRelease.body[0].claimCode,
          },
          method: "POST",
        }
      );
      assert.equal(buyerClaimResponse.status, 200);
      assert.equal(buyerClaimResponse.body.status, "Completed");

      const sellerWalletReleased = await sellerRequest("/market/wallet");
      assert.equal(sellerWalletReleased.status, 200);
      assert.equal(sellerWalletReleased.body.availableBalanceKobo, 343000);
      assert.equal(sellerWalletReleased.body.pendingBalanceKobo, 0);
      assert.equal(sellerWalletReleased.body.lifetimeEarnedKobo, 343000);

      const sellerWalletTransactionsReleased = await sellerRequest(
        "/market/wallet/transactions"
      );
      assert.equal(sellerWalletTransactionsReleased.status, 200);
      assert.equal(sellerWalletTransactionsReleased.body.length, 2);
      assert.equal(
        sellerWalletTransactionsReleased.body[0].transactionType,
        "escrow_release"
      );
    });
  });
});

test("community routes return audience users and still require authentication", async () => {
  const pool = {
    async query(sql) {
      if (!String(sql).includes("FROM sf_users u")) {
        throw new Error(`Unhandled community query: ${sql}`);
      }

      return {
        rows: [
          {
            avatar_url: "",
            email: "ada@example.com",
            id: "user-2",
            lga_name: "Ikeja",
            name: "Ada",
            role: ROLE.STUDENT,
            school_id: "school-1",
            school_lga_name: "Ikeja",
            school_name: "Alpha Academy",
            school_state_name: "Lagos",
            state_name: "Lagos",
          },
        ],
      };
    },
  };

  const authedApp = createTestApp();
  registerCommunityRoutes({
    app: authedApp,
    pool,
    auth: createStaticAuth({
      id: "user-1",
      role: ROLE.STUDENT,
    }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
  });

  await withServer(authedApp, async ({ request }) => {
    const response = await request("/feed/audience/users?q=ada");
    assert.equal(response.status, 200);
    assert.deepEqual(response.body, [
      {
        avatarUrl: "",
        email: "ada@example.com",
        id: "user-2",
        lgaName: "Ikeja",
        name: "Ada",
        role: ROLE.STUDENT,
        schoolId: "school-1",
        schoolName: "Alpha Academy",
        stateName: "Lagos",
      },
    ]);
  });

  const anonApp = createTestApp();
  registerCommunityRoutes({
    app: anonApp,
    pool,
    auth: createStaticAuth(null),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
  });

  await withServer(anonApp, async ({ request }) => {
    const response = await request("/feed/audience/users");
    assert.equal(response.status, 401);
    assert.deepEqual(response.body, { error: "Unauthorized" });
  });
});

test("community routes create media posts and media comments end to end", async () => {
  const pool = createCommunityFeedPool();
  const app = createTestApp();

  registerCommunityRoutes({
    app,
    pool,
    auth: createStaticAuth({
      id: "user-1",
      name: "Ada Student",
      role: ROLE.STUDENT,
      school_id: "school-1",
      state_name: "Lagos",
    }),
    asyncRoute: (handler) => handler,
    requireRole,
    ROLE,
  });

  await withServer(app, async ({ request }) => {
    const createPostResponse = await request("/feed/posts", {
      body: {
        body: "",
        mediaUrls: [
          {
            kind: "image",
            name: "garden.png",
            url: "data:image/png;base64,AAAA",
          },
        ],
      },
      method: "POST",
    });
    assert.equal(createPostResponse.status, 201);
    assert.match(createPostResponse.body.title, /^Media update \d{4}-\d{2}-\d{2}$/);
    assert.equal(createPostResponse.body.mediaUrls.length, 1);
    assert.equal(createPostResponse.body.mediaUrls[0].kind, "image");

    const postsResponse = await request("/feed/posts");
    assert.equal(postsResponse.status, 200);
    assert.equal(postsResponse.body.length, 1);
    assert.equal(postsResponse.body[0].mediaUrls.length, 1);
    assert.equal(postsResponse.body[0].commentsCount, 0);

    const createCommentResponse = await request(
      `/feed/posts/${createPostResponse.body.id}/comments`,
      {
        body: {
          body: "",
          mediaUrls: [
            {
              kind: "video",
              name: "garden-walkthrough.mp4",
              url: "data:video/mp4;base64,BBBB",
            },
          ],
        },
        method: "POST",
      }
    );
    assert.equal(createCommentResponse.status, 201);
    assert.equal(createCommentResponse.body.mediaUrls.length, 1);
    assert.equal(createCommentResponse.body.mediaUrls[0].kind, "video");

    const commentsResponse = await request(
      `/feed/posts/${createPostResponse.body.id}/comments`
    );
    assert.equal(commentsResponse.status, 200);
    assert.equal(commentsResponse.body.length, 1);
    assert.equal(commentsResponse.body[0].mediaUrls.length, 1);
    assert.equal(commentsResponse.body[0].mediaUrls[0].kind, "video");

    const postsAfterCommentResponse = await request("/feed/posts");
    assert.equal(postsAfterCommentResponse.status, 200);
    assert.equal(postsAfterCommentResponse.body[0].commentsCount, 1);
  });
});
