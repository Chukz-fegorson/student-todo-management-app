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

  async function query(sql, params = []) {
    const text = String(sql);

    if (text.includes("FROM sf_market_products p") && text.includes("WHERE p.id = $1")) {
      return {
        rows: params[0] === product.id ? [product] : [],
      };
    }

    if (text.includes("INSERT INTO sf_market_orders")) {
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
        seller_user_id: params[3],
        status: params[13],
        total_amount_kobo: params[6],
        unit_price_kobo: params[5],
        updated_at: params[21],
      });
      return { rows: [] };
    }

    if (text.includes("UPDATE sf_market_products") && text.includes("quantity_available = quantity_available -")) {
      product.quantity_available -= params[0];
      product.updated_at = params[1];
      return { rows: [] };
    }

    if (text.includes("FROM sf_market_orders o") && text.includes("WHERE o.id = $1")) {
      return {
        rows: orders.filter((order) => order.id === params[0]),
      };
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
