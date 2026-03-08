import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { formatDateTime } from "../lib/helpers";
import {
  NIGERIA_STATES,
  buildStateLgaIndex,
  getLgaOptionsForState,
} from "../lib/locationData";

// Convert backend kobo values into naira display safely.
function asNaira(valueKobo, valueNaira) {
  if (Number.isFinite(Number(valueNaira))) return Number(valueNaira);
  return Number(valueKobo || 0) / 100;
}

function toQueryString(params) {
  // Build API query params and skip empty filters.
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

function mediaKindFromFile(file) {
  if (!file) return "image";
  return String(file.type || "").startsWith("video/") ? "video" : "image";
}

function fileToDataUrl(file) {
  // Read local image/video file so we can preview and upload it.
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

const EMPTY_FILTERS = Object.freeze({
  q: "",
  state: "",
  lga: "",
  schoolId: "",
  listingType: "",
  sellerNearMe: false,
});

const OTHER_CATEGORY_VALUE = "__other__";

function marketChipMeta(product) {
  // Badge color/label mapping based on seller governance level.
  const role = String(product?.sellerRole || "").toLowerCase();
  if (role === "federal") {
    return { label: "Federal Market", className: "market-card-chip-federal" };
  }
  if (role === "state") {
    return { label: "State Market", className: "market-card-chip-state" };
  }
  if (role === "school" || product?.listingType === "school") {
    return { label: "School Store", className: "market-card-chip-school" };
  }
  return { label: "Student Market", className: "market-card-chip-student" };
}

export default function MarketplaceWorkspace({ user, navRoute }) {
  // Marketplace state buckets: catalog data, ui states, and form drafts.
  const [categories, setCategories] = useState([]);
  const [categoryRequests, setCategoryRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [filtersDraft, setFiltersDraft] = useState({ ...EMPTY_FILTERS });
  const [filtersApplied, setFiltersApplied] = useState({ ...EMPTY_FILTERS });

  const [listingForm, setListingForm] = useState({
    title: "",
    description: "",
    categoryId: "",
    customCategoryName: "",
    condition: "new",
    priceNaira: "",
    quantity: 1,
    mediaUrls: [],
    mediaUrlDraft: "",
  });
  const [categoryRequestName, setCategoryRequestName] = useState("");
  const [sellCategoryName, setSellCategoryName] = useState("");
  const [claimCodes, setClaimCodes] = useState({});
  const [marketView, setMarketView] = useState("browse");

  const [selectedProductId, setSelectedProductId] = useState("");
  const [detailMediaIndex, setDetailMediaIndex] = useState(0);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchasePaymentMode, setPurchasePaymentMode] = useState("cash");
  const [purchasePaymentReference, setPurchasePaymentReference] = useState("");
  const [offerDraft, setOfferDraft] = useState({ amountNaira: "", note: "" });
  const [reviewDraft, setReviewDraft] = useState({ rating: 5, reviewText: "" });

  const canModerate =
    user.role === "school" || user.role === "state" || user.role === "federal";
  const canResolveDisputes =
    user.role === "school" || user.role === "state" || user.role === "federal";
  // Only student/school can publish listings.
  const canSell = user.role === "student" || user.role === "school";
  const listingType = user.role === "school" ? "school" : "student";

  const selectedProduct = useMemo(
    () => products.find((entry) => entry.id === selectedProductId) || null,
    [products, selectedProductId]
  );
  const selectedMediaList = useMemo(
    () => (Array.isArray(selectedProduct?.mediaUrls) ? selectedProduct.mediaUrls : []),
    [selectedProduct]
  );
  const selectedMedia =
    selectedMediaList[detailMediaIndex] || selectedMediaList[0] || null;

  const productCategories = useMemo(
    () =>
      categories.filter(
        (entry) => entry?.status === "approved" && entry.listingType === listingType
      ),
    [categories, listingType]
  );
  const activeOrders = useMemo(
    () => orders.filter((entry) => entry.status !== "Completed"),
    [orders]
  );
  const completedOrders = useMemo(
    () => orders.filter((entry) => entry.status === "Completed"),
    [orders]
  );
  const productStateIndex = useMemo(() => buildStateLgaIndex(products), [products]);
  const filterLgaOptions = useMemo(
    () => getLgaOptionsForState(productStateIndex, filtersDraft.state, [filtersDraft.lga]),
    [productStateIndex, filtersDraft.state, filtersDraft.lga]
  );
  const filterStateOptions = useMemo(() => {
    const discovered = new Set(
      products
        .map((product) => String(product.stateName || "").trim())
        .filter(Boolean)
    );
    for (const stateName of NIGERIA_STATES) discovered.add(stateName);
    if (filtersDraft.state) discovered.add(filtersDraft.state);
    return Array.from(discovered).sort((a, b) => a.localeCompare(b));
  }, [products, filtersDraft.state]);
  const myListingCount = useMemo(
    () => products.filter((entry) => entry.sellerUserId === user.id).length,
    [products, user.id]
  );
  const openDisputeCount = useMemo(
    () => disputes.filter((entry) => entry.status === "Open").length,
    [disputes]
  );
  const marketHighlights = {
    browse: [
      `${products.length} product${products.length === 1 ? "" : "s"} visible`,
      `${activeOrders.length} active order${activeOrders.length === 1 ? "" : "s"}`,
      `${openDisputeCount} open dispute${openDisputeCount === 1 ? "" : "s"}`,
    ],
    sell: [
      `${myListingCount} of your listing${myListingCount === 1 ? "" : "s"} visible`,
      `${categories.length} approved categor${categories.length === 1 ? "y" : "ies"}`,
      canSell ? "Create, upload media, and publish in one flow" : "Browse only",
    ],
    orders: [
      `${activeOrders.length} active order${activeOrders.length === 1 ? "" : "s"}`,
      `${completedOrders.length} completed transaction${completedOrders.length === 1 ? "" : "s"}`,
      `${disputes.length} dispute record${disputes.length === 1 ? "" : "s"}`,
    ],
    moderation: [
      `${categoryRequests.length} category request${categoryRequests.length === 1 ? "" : "s"}`,
      `${openDisputeCount} open dispute${openDisputeCount === 1 ? "" : "s"}`,
      "Review reports and keep marketplace trust intact",
    ],
  };

  const loadMarketplace = useCallback(async () => {
    // Load categories/products/orders (and moderation queue when allowed).
    try {
      setError("");
      setLoading(true);
      const query = toQueryString({
        q: filtersApplied.q.trim(),
        state: filtersApplied.state.trim(),
        lga: filtersApplied.lga.trim(),
        schoolId: filtersApplied.schoolId.trim(),
        listingType: filtersApplied.listingType || null,
        sellerNearMe: filtersApplied.sellerNearMe ? "true" : null,
      });
      const requests = [
        apiGet("/market/categories"),
        apiGet(`/market/products${query}`),
        apiGet("/market/orders"),
        apiGet("/market/disputes"),
      ];
      if (canModerate) requests.push(apiGet("/market/category-requests"));
      const [categoriesData, productsData, ordersData, disputesData, requestData] =
        await Promise.all(requests);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setDisputes(Array.isArray(disputesData) ? disputesData : []);
      setCategoryRequests(Array.isArray(requestData) ? requestData : []);
    } catch (err) {
      setError(err.message || "Failed to load marketplace workspace.");
    } finally {
      setLoading(false);
    }
  }, [canModerate, filtersApplied]);

  useEffect(() => {
    loadMarketplace();
  }, [user.id, loadMarketplace]);

  useEffect(() => {
    if (!selectedProductId) return;
    if (!products.some((entry) => entry.id === selectedProductId)) {
      setSelectedProductId("");
      setDetailMediaIndex(0);
    }
  }, [products, selectedProductId]);

  useEffect(() => {
    if (!selectedMediaList.length) {
      setDetailMediaIndex(0);
      return;
    }
    if (detailMediaIndex > selectedMediaList.length - 1) setDetailMediaIndex(0);
  }, [selectedMediaList, detailMediaIndex]);

  useEffect(() => {
    setReviewDraft({ rating: 5, reviewText: "" });
  }, [selectedProductId]);

  useEffect(() => {
    if (!navRoute?.ts || navRoute.module !== "market") return;

    if (navRoute.meta?.view) {
      setMarketView(navRoute.meta.view);
      if (navRoute.meta.view !== "browse") closeProduct();
    }
    if (navRoute.action === "sell") {
      setMarketView("sell");
      closeProduct();
    }
    if (navRoute.action === "orders") {
      setMarketView("orders");
      closeProduct();
    }
    if (navRoute.entityType === "market_product" && navRoute.entityId) {
      const target = products.find((entry) => entry.id === navRoute.entityId);
      if (target) {
        setMarketView("browse");
        openProduct(target);
      }
    }
  }, [navRoute, products]);

  function applyFilters() {
    // Apply current filter draft to trigger fresh product query.
    setFiltersApplied({ ...filtersDraft });
  }

  function resetFilters() {
    setFiltersDraft({ ...EMPTY_FILTERS });
    setFiltersApplied({ ...EMPTY_FILTERS });
  }

  function openProduct(product) {
    setSelectedProductId(product.id);
    setDetailMediaIndex(0);
    setPurchaseQuantity(1);
    setPurchasePaymentMode("cash");
    setPurchasePaymentReference("");
    setOfferDraft({ amountNaira: "", note: "" });
  }

  function closeProduct() {
    setSelectedProductId("");
    setDetailMediaIndex(0);
  }

  function switchMarketView(nextView) {
    setMarketView(nextView);
    if (nextView !== "browse") closeProduct();
  }

  function addMediaUrlDraft() {
    const nextUrl = String(listingForm.mediaUrlDraft || "").trim();
    if (!nextUrl) return;
    setListingForm((prev) => ({
      ...prev,
      mediaUrls: [...prev.mediaUrls, { id: crypto.randomUUID(), kind: "image", url: nextUrl }],
      mediaUrlDraft: "",
    }));
  }

  async function handleMediaFiles(event) {
    // Accept multiple images/videos, size-check, then convert to data URLs.
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      setBusy(true);
      const next = [];
      for (const file of files.slice(0, 12)) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;
        if (file.size > 8 * 1024 * 1024) continue;
        const dataUrl = await fileToDataUrl(file);
        next.push({
          id: crypto.randomUUID(),
          kind: mediaKindFromFile(file),
          url: dataUrl,
          name: file.name,
          mimeType: file.type,
          size: file.size,
        });
      }
      setListingForm((prev) => ({
        ...prev,
        mediaUrls: [...prev.mediaUrls, ...next].slice(0, 12),
      }));
    } catch (err) {
      setError(err.message || "Failed to process media files.");
    } finally {
      setBusy(false);
      event.target.value = "";
    }
  }

  function removeMedia(itemId) {
    setListingForm((prev) => ({
      ...prev,
      mediaUrls: prev.mediaUrls.filter((entry) => entry.id !== itemId),
    }));
  }

  async function createListing() {
    // Validate listing form, then publish listing to backend.
    if (!listingForm.title.trim()) return setError("Product title is required.");
    if (!Number(listingForm.priceNaira)) return setError("Valid price is required.");
    const isCustomCategory = listingForm.categoryId === OTHER_CATEGORY_VALUE;
    const customCategoryName = String(listingForm.customCategoryName || "").trim();
    if (isCustomCategory && !customCategoryName) {
      return setError("Enter custom category name when 'Others' is selected.");
    }
    try {
      setBusy(true);
      setError("");
      await apiPost("/market/products", {
        title: listingForm.title.trim(),
        description: listingForm.description.trim() || null,
        mediaUrls: listingForm.mediaUrls,
        categoryId:
          listingForm.categoryId && !isCustomCategory ? listingForm.categoryId : null,
        customCategoryName: isCustomCategory ? customCategoryName : null,
        condition: listingForm.condition,
        priceNaira: Number(listingForm.priceNaira),
        quantity: Number(listingForm.quantity || 1),
      });
      setListingForm({
        title: "",
        description: "",
        categoryId: "",
        customCategoryName: "",
        condition: "new",
        priceNaira: "",
        quantity: 1,
        mediaUrls: [],
        mediaUrlDraft: "",
      });
      setNotice("Listing published.");
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to create listing.");
    } finally {
      setBusy(false);
    }
  }

  async function requestCategory(options = {}) {
    // Create category request; school flow can auto-approve immediately.
    const name = String(options.name ?? categoryRequestName).trim();
    if (!name) return setError("Enter category name.");
    const listingTypeForRequest = options.listingType || "student";
    const autoApprove = Boolean(options.autoApprove);
    try {
      setBusy(true);
      setError("");
      const created = await apiPost("/market/categories/request", {
        name,
        listingType: listingTypeForRequest,
      });
      if (autoApprove && created?.id) {
        await apiPost(`/market/categories/${created.id}/approve`, { action: "approve" });
      }
      if (options.name !== undefined) {
        setSellCategoryName("");
      } else {
        setCategoryRequestName("");
      }
      setNotice(
        autoApprove
          ? "Category created and approved."
          : "Category request submitted for school approval."
      );
      await loadMarketplace();
      if (created?.id) {
        setListingForm((prev) => ({ ...prev, categoryId: created.id }));
      }
    } catch (err) {
      setError(err.message || "Failed to request category.");
    } finally {
      setBusy(false);
    }
  }

  async function approveCategory(categoryId, action) {
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/categories/${categoryId}/approve`, { action });
      setNotice(`Category request ${action}d.`);
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to resolve category request.");
    } finally {
      setBusy(false);
    }
  }

  async function placeOrder(productId, quantity = 1, paymentMode = "cash") {
    // Create purchase order (payment confirmation happens later in order flow).
    try {
      setBusy(true);
      setError("");
      await apiPost("/market/orders", {
        productId,
        quantity: Math.max(1, Number(quantity) || 1),
        paymentMode,
        buyerPaymentReference:
          paymentMode === "transfer" || paymentMode === "p2p"
            ? String(purchasePaymentReference || "").trim() || null
            : null,
      });
      setNotice(
        paymentMode === "transfer"
          ? "Order created. Complete transfer to seller account and wait for seller confirmation."
          : paymentMode === "p2p"
          ? "Order created. Complete P2P payment and wait for seller confirmation."
          : "Order created. Pay cash and ask seller to confirm."
      );
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to place order.");
    } finally {
      setBusy(false);
    }
  }

  async function sendOffer() {
    if (!selectedProduct) return;
    const amount = Number(offerDraft.amountNaira);
    if (!Number.isFinite(amount) || amount <= 0) {
      return setError("Offer amount must be greater than 0.");
    }
    const body = [
      `[Marketplace Offer] ${selectedProduct.title}`,
      `Offer Amount: N${Math.round(amount).toLocaleString()}`,
      `Product ID: ${selectedProduct.id}`,
      offerDraft.note ? `Note: ${offerDraft.note.trim()}` : "",
    ]
      .filter(Boolean)
      .join("\n");
    try {
      setBusy(true);
      setError("");
      await apiPost("/chat/messages", {
        recipientId: selectedProduct.sellerUserId,
        body,
      });
      setOfferDraft({ amountNaira: "", note: "" });
      setNotice("Offer sent to seller inbox.");
    } catch (err) {
      setError(err.message || "Failed to send offer.");
    } finally {
      setBusy(false);
    }
  }

  async function sellerConfirmCash(orderId) {
    // Seller confirms payment received and system generates buyer claim code.
    try {
      setBusy(true);
      setError("");
      const data = await apiPost(`/market/orders/${orderId}/seller-confirm-cash`, {});
      setNotice(
        data?.claimCode
          ? `Payment confirmed. Claim code ${data.claimCode} was sent to buyer inbox and stays visible on this order until buyer claims.`
          : "Payment confirmed."
      );
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to confirm payment.");
    } finally {
      setBusy(false);
    }
  }

  async function buyerClaim(orderId) {
    // Buyer enters claim code to finalize the order as completed.
    const claimCode = String(claimCodes[orderId] || "").trim();
    if (!claimCode) return setError("Enter claim code first.");
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/orders/${orderId}/buyer-claim`, { claimCode });
      setClaimCodes((prev) => ({ ...prev, [orderId]: "" }));
      setNotice("Order completed.");
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to claim order.");
    } finally {
      setBusy(false);
    }
  }

  async function raiseDispute(orderId) {
    const reason = window.prompt("Dispute reason (required):", "Item not delivered as agreed");
    if (!reason || !String(reason).trim()) return;
    const details = window.prompt("Additional details (optional):", "");
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/orders/${orderId}/disputes`, {
        reason: String(reason).trim(),
        details: details ? String(details).trim() : null,
      });
      setNotice("Dispute opened.");
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to open dispute.");
    } finally {
      setBusy(false);
    }
  }

  async function resolveDispute(disputeId, status = "Resolved") {
    const resolutionNote = window.prompt("Resolution note (optional):", "");
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/disputes/${disputeId}/resolve`, {
        status,
        resolutionNote: resolutionNote ? String(resolutionNote).trim() : null,
      });
      setNotice(`Dispute ${status.toLowerCase()}.`);
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to resolve dispute.");
    } finally {
      setBusy(false);
    }
  }

  async function setSellerVerification(userId, verify) {
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/users/${userId}/verify`, { verify });
      setNotice(verify ? "Seller verified." : "Seller verification removed.");
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to update seller verification.");
    } finally {
      setBusy(false);
    }
  }

  async function reportProduct(productId) {
    const reason = window.prompt("Report reason (required):", "Inappropriate listing");
    if (!reason || !String(reason).trim()) return;
    const details = window.prompt("Additional details (optional):", "");
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/products/${productId}/report`, {
        reason: String(reason).trim(),
        details: details ? String(details).trim() : null,
      });
      setNotice("Report submitted.");
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to report listing.");
    } finally {
      setBusy(false);
    }
  }

  async function reviewProduct(productId) {
    // Save star rating + optional review text.
    const rating = Math.max(1, Math.min(5, Number(reviewDraft.rating) || 0));
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
      return setError("Choose a star rating between 1 and 5.");
    }
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/products/${productId}/reviews`, {
        rating,
        reviewText: reviewDraft.reviewText.trim() || null,
      });
      setNotice("Review saved.");
      setReviewDraft({ rating: 5, reviewText: "" });
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to submit review.");
    } finally {
      setBusy(false);
    }
  }

  async function moderateProduct(productId, action) {
    const reason = window.prompt("Moderation reason (optional):", "");
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/products/${productId}/moderate`, {
        action,
        reason: reason ? String(reason).trim() : null,
      });
      setNotice(`Listing ${action} action completed.`);
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to moderate listing.");
    } finally {
      setBusy(false);
    }
  }

  if (loading) {
    return (
      <div className="empty">
        <div className="empty-icon">...</div>
        <h3>Loading marketplace workspace</h3>
        <p>Products, orders, disputes, and category data are being prepared.</p>
      </div>
    );
  }

  return (
    <section className="panel panel-elevated market-panel module-surface-panel" style={{ marginTop: "1rem" }}>
      <section className="module-hero module-hero-compact">
        <div className="module-hero-copy">
          <div className="module-kicker">Marketplace</div>
          <div className="module-title-row">
            <h2>School and Student Commerce</h2>
            <span className="module-pill">
              {marketView === "browse"
                ? `${products.length} visible`
                : marketView === "sell"
                  ? "Seller workspace"
                  : marketView === "orders"
                    ? `${activeOrders.length} active`
                    : `${categoryRequests.length} pending`}
            </span>
          </div>
          <p>
            Browse trusted listings, manage sales, complete claim-code transactions, and review disputes from one commerce workspace.
          </p>
          <div className="module-highlight-row">
            {(marketHighlights[marketView] || marketHighlights.browse).map((entry) => (
              <span key={entry} className="module-highlight-pill">
                {entry}
              </span>
            ))}
          </div>
        </div>
      </section>

      {notice && (
        <div
          className="notif notif-graded"
          style={{ marginBottom: "0.8rem" }}
          onClick={() => setNotice("")}
        >
          {notice}
        </div>
      )}
      {error && <div className="error-msg">{error}</div>}

      <div className="view-tabs" style={{ marginBottom: "0.8rem" }}>
        <button
          className={`view-tab ${marketView === "browse" ? "active" : ""}`}
          onClick={() => switchMarketView("browse")}
        >
          Browse
        </button>
        {canSell && (
          <button
            className={`view-tab ${marketView === "sell" ? "active" : ""}`}
            onClick={() => switchMarketView("sell")}
          >
            Sell Item
          </button>
        )}
        <button
          className={`view-tab ${marketView === "orders" ? "active" : ""}`}
          onClick={() => switchMarketView("orders")}
        >
          Orders
        </button>
        {canModerate && (
          <button
            className={`view-tab ${marketView === "moderation" ? "active" : ""}`}
            onClick={() => switchMarketView("moderation")}
          >
            Moderation
          </button>
        )}
      </div>

      {marketView === "browse" && (
        <div className="panel panel-elevated market-filter-shell" style={{ marginBottom: "1rem" }}>
          <div className="panel-kicker">Browse</div>
          <div className="panel-title">Find Products</div>
          <div className="panel-copy">
            Filter by location, listing type, and proximity to narrow the marketplace quickly.
          </div>
          <div className="market-filter-bar">
        <input
          placeholder="Search products"
          value={filtersDraft.q}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, q: event.target.value }))
          }
        />
        <select
          value={filtersDraft.state}
          onChange={(event) =>
            setFiltersDraft((prev) => ({
              ...prev,
              state: event.target.value,
              lga: "",
            }))
          }
        >
          <option value="">All states</option>
          {filterStateOptions.map((stateName) => (
            <option key={stateName} value={stateName}>
              {stateName}
            </option>
          ))}
        </select>
        <select
          value={filtersDraft.lga}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, lga: event.target.value }))
          }
          disabled={!filtersDraft.state}
        >
          <option value="">{filtersDraft.state ? "All LGAs" : "Select state first"}</option>
          {filterLgaOptions.map((lgaName) => (
            <option key={lgaName} value={lgaName}>
              {lgaName}
            </option>
          ))}
        </select>
        <input
          placeholder="School ID"
          value={filtersDraft.schoolId}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, schoolId: event.target.value }))
          }
        />
        <select
          value={filtersDraft.listingType}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, listingType: event.target.value }))
          }
        >
          <option value="">All listing types</option>
          <option value="school">School store</option>
          <option value="student">Student marketplace</option>
        </select>
        <label className="check-item">
          <input
            type="checkbox"
            checked={filtersDraft.sellerNearMe}
            onChange={(event) =>
              setFiltersDraft((prev) => ({
                ...prev,
                sellerNearMe: event.target.checked,
              }))
            }
          />
          Seller near me
        </label>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={applyFilters}>
          Apply
        </button>
        <button className="btn btn-ghost btn-sm" disabled={busy} onClick={resetFilters}>
          Reset
        </button>
          </div>
        </div>
      )}

      {marketView === "sell" && canSell && (
        <div className="panel panel-elevated" style={{ marginBottom: "1rem" }}>
          <div className="panel-kicker">Sell</div>
          <div className="panel-title">Create Listing ({listingType})</div>
          <div className="panel-copy">
            Publish a product with rich media, standardized categories, and enough detail to make it easy to buy.
          </div>
          <div className="field">
            <label>Title</label>
            <input
              value={listingForm.title}
              onChange={(event) =>
                setListingForm((prev) => ({ ...prev, title: event.target.value }))
              }
            />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea
              value={listingForm.description}
              onChange={(event) =>
                setListingForm((prev) => ({
                  ...prev,
                  description: event.target.value,
                }))
              }
            />
          </div>
          <div
            style={{
              display: "grid",
              gap: "0.75rem",
              gridTemplateColumns: "1fr 1fr 1fr 1fr",
            }}
          >
            <div className="field">
              <label>Category</label>
              <select
                value={listingForm.categoryId}
                onChange={(event) => {
                  const nextValue = event.target.value;
                  setListingForm((prev) => ({
                    ...prev,
                    categoryId: nextValue,
                    customCategoryName:
                      nextValue === OTHER_CATEGORY_VALUE ? prev.customCategoryName : "",
                  }));
                }}
              >
                <option value="">No category</option>
                {productCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value={OTHER_CATEGORY_VALUE}>Others (custom)</option>
              </select>
            </div>
            <div className="field">
              <label>Condition</label>
              <select
                value={listingForm.condition}
                onChange={(event) =>
                  setListingForm((prev) => ({ ...prev, condition: event.target.value }))
                }
              >
                <option value="new">New</option>
                <option value="used">Used</option>
              </select>
            </div>
            <div className="field">
              <label>Price (Naira)</label>
              <input
                type="number"
                value={listingForm.priceNaira}
                onChange={(event) =>
                  setListingForm((prev) => ({ ...prev, priceNaira: event.target.value }))
                }
              />
            </div>
            <div className="field">
              <label>Quantity</label>
              <input
                type="number"
                min="1"
                value={listingForm.quantity}
                onChange={(event) =>
                  setListingForm((prev) => ({ ...prev, quantity: event.target.value }))
                }
              />
            </div>
          </div>
          {listingForm.categoryId === OTHER_CATEGORY_VALUE && (
            <div className="field">
              <label>Custom Category Label</label>
              <input
                placeholder="e.g. Robotics Components"
                value={listingForm.customCategoryName}
                onChange={(event) =>
                  setListingForm((prev) => ({
                    ...prev,
                    customCategoryName: event.target.value,
                  }))
                }
              />
              <div className="panel-hint">
                This custom label is only attached to this listing and does not change the
                standardized category list.
              </div>
            </div>
          )}

          {user.role === "school" && (
            <div className="field">
              <label>Add School Category</label>
              <div style={{ display: "flex", gap: "0.5rem" }}>
                <input
                  style={{ flex: 1 }}
                  placeholder="e.g. School Branded Materials"
                  value={sellCategoryName}
                  onChange={(event) => setSellCategoryName(event.target.value)}
                />
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  disabled={busy}
                  onClick={() =>
                    requestCategory({
                      name: sellCategoryName,
                      listingType: "school",
                      autoApprove: true,
                    })
                  }
                >
                  Add
                </button>
              </div>
            </div>
          )}

          <div className="field">
            <label>Media (Images/Videos)</label>
            <div className="profile-image-row">
              <input
                value={listingForm.mediaUrlDraft}
                placeholder="Paste image/video URL"
                onChange={(event) =>
                  setListingForm((prev) => ({ ...prev, mediaUrlDraft: event.target.value }))
                }
              />
              <button type="button" className="btn btn-ghost btn-sm" onClick={addMediaUrlDraft}>
                Add URL
              </button>
              <input type="file" accept="image/*,video/*" multiple onChange={handleMediaFiles} />
            </div>
            <div className="market-media-grid">
              {(listingForm.mediaUrls || []).map((item) => (
                <div key={item.id} className="market-media-item">
                  {item.kind === "video" ? (
                    <video src={item.url} controls preload="metadata" />
                  ) : (
                    <img src={item.url} alt={item.name || "listing media"} />
                  )}
                  <button
                    type="button"
                    className="btn btn-danger btn-sm"
                    onClick={() => removeMedia(item.id)}
                  >
                    Remove
                  </button>
                </div>
              ))}
            </div>
          </div>
          <button className="btn btn-primary btn-sm" disabled={busy} onClick={createListing}>
            Publish Listing
          </button>
        </div>
      )}

      {marketView === "sell" && user.role === "student" && (
        <div className="panel panel-elevated" style={{ marginBottom: "1rem" }}>
          <div className="panel-kicker">Categories</div>
          <div className="panel-title">Request New Student Category</div>
          <div style={{ display: "flex", gap: "0.6rem" }}>
            <input
              style={{ flex: 1 }}
              placeholder="e.g. Robotics Components"
              value={categoryRequestName}
              onChange={(event) => setCategoryRequestName(event.target.value)}
            />
            <button className="btn btn-ghost btn-sm" disabled={busy} onClick={requestCategory}>
              Request
            </button>
          </div>
        </div>
      )}

      {marketView === "moderation" && canModerate && (
        <div className="panel panel-elevated" style={{ marginBottom: "1rem" }}>
          <div className="panel-kicker">Moderation</div>
          <div className="panel-title">Pending Category Requests ({categoryRequests.length})</div>
          <div className="panel-copy">
            Review category expansion requests and keep the marketplace structure disciplined.
          </div>
          <div className="calendar-list">
            {categoryRequests.map((entry) => (
              <div key={entry.id} className="calendar-item">
                <div>
                  <div className="calendar-title">{entry.name}</div>
                  <div className="calendar-meta">
                    {entry.listingType} | {entry.schoolName || "No school"} | requested by{" "}
                    {entry.requestedByName || "Unknown"}
                  </div>
                </div>
                <div style={{ display: "flex", gap: "0.4rem" }}>
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => approveCategory(entry.id, "approve")}
                  >
                    Approve
                  </button>
                  <button
                    className="btn btn-danger btn-sm"
                    disabled={busy}
                    onClick={() => approveCategory(entry.id, "reject")}
                  >
                    Reject
                  </button>
                </div>
              </div>
            ))}
            {!categoryRequests.length && <div className="empty-col">No pending requests.</div>}
          </div>
        </div>
      )}

      {marketView === "browse" && (
        <>
          <div className="panel-kicker">Catalog</div>
          <div className="panel-title">Products ({products.length})</div>
          <div className="market-grid">
        {products.map((product) => {
          const mine = product.sellerUserId === user.id;
          const chip = marketChipMeta(product);
          const primary =
            Array.isArray(product.mediaUrls) && product.mediaUrls.length
              ? product.mediaUrls[0]
              : null;
          return (
            <article key={product.id} className="market-card">
              <div
                className="market-card-click"
                role="button"
                tabIndex={0}
                onClick={() => openProduct(product)}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault();
                    openProduct(product);
                  }
                }}
              >
                <div className="market-card-media-wrap">
                  {primary ? (
                    primary.kind === "video" ? (
                      <video src={primary.url} preload="metadata" muted />
                    ) : (
                      <img src={primary.url} alt={product.title} />
                    )
                  ) : (
                    <div className="market-card-media-empty">No media</div>
                  )}
                  <span className={`market-card-chip ${chip.className}`}>
                    {chip.label}
                  </span>
                </div>
                <div className="market-card-body">
                  <div className="market-card-title">{product.title}</div>
                  <div className="market-card-price">
                    N{asNaira(product.priceKobo, product.priceNaira).toLocaleString()}
                  </div>
                  <div className="market-card-meta">
                    <span>
                      {product.categoryName || product.customCategoryName || "Uncategorized"}
                    </span>
                  </div>
                  <div className="market-card-meta">
                    <span>{product.sellerName || "Seller"}</span>
                    <span>|</span>
                    <span>{product.schoolName || product.stateName || "Nigeria"}</span>
                    <span>|</span>
                    <span>{product.sellerVerified ? "Verified seller" : "Unverified seller"}</span>
                  </div>
                  <div className="market-card-meta">
                    <span>Qty: {product.quantityAvailable}</span>
                    <span>|</span>
                    <span>
                      Rating: {Number(product.averageRating || 0).toFixed(2)} (
                      {product.ratingCount || 0})
                    </span>
                  </div>
                </div>
              </div>
              <div className="market-card-actions">
                <button className="btn btn-ghost btn-sm" disabled={busy} onClick={() => openProduct(product)}>
                  View
                </button>
                {!mine && (
                  <button
                    className="btn btn-primary btn-sm"
                    disabled={busy}
                    onClick={() => placeOrder(product.id, 1, "cash")}
                  >
                    Buy
                  </button>
                )}
              </div>
            </article>
          );
        })}
          </div>
          {!products.length && <div className="empty-col">No products match your filter.</div>}
        </>
      )}

      {marketView === "orders" && (
        <>
          <div className="panel panel-elevated" style={{ marginTop: "1rem" }}>
        <div className="panel-kicker">Orders</div>
        <div className="panel-title">Active Orders ({activeOrders.length})</div>
        <div className="panel-copy">
          Track payment confirmation, claim codes, disputes, and delivery flow without leaving the order stream.
        </div>
        <div className="calendar-list">
          {activeOrders.map((order) => {
            const isSeller = order.sellerUserId === user.id;
            const isBuyer = order.buyerUserId === user.id;
            return (
              <div
                key={order.id}
                className="calendar-item"
                style={{ alignItems: "stretch", flexDirection: "column" }}
              >
                <div style={{ flex: 1 }}>
                  <div className="calendar-title">{order.productTitle || "Product"}</div>
                  <div className="calendar-meta">
                    Buyer: {order.buyerName || "Buyer"} | Seller: {order.sellerName || "Seller"} |
                    Status: {order.status} | Total: N
                    {Number(order.totalAmountNaira || 0).toLocaleString()} | Created:{" "}
                    {formatDateTime(order.createdAt)}
                  </div>
                  <div className="calendar-meta">
                    Mode: {order.paymentMode || "cash"} | Platform Fee: N
                    {Number(order.platformFeeNaira || 0).toLocaleString()} | Seller Net: N
                    {Number(order.sellerNetNaira || 0).toLocaleString()}
                    {order.buyerPaymentReference
                      ? ` | Buyer Ref: ${order.buyerPaymentReference}`
                      : ""}
                  </div>
                  {order.cashConfirmedAt && (
                    <div className="calendar-meta">
                      Seller confirmed payment: {formatDateTime(order.cashConfirmedAt)}
                    </div>
                  )}
                  {isBuyer &&
                    order.status === "PendingCash" &&
                    (order.paymentMode === "transfer" || order.paymentMode === "p2p") && (
                      <div className="review-summary-box" style={{ marginTop: "0.4rem" }}>
                        Seller Account:{" "}
                        {order.sellerPaymentDetails?.bankName
                          ? `${order.sellerPaymentDetails.bankName} | `
                          : ""}
                        {order.sellerPaymentDetails?.accountName || "N/A"}{" "}
                        {order.sellerPaymentDetails?.accountNumber
                          ? `(${order.sellerPaymentDetails.accountNumber})`
                          : ""}
                      </div>
                    )}
                  {isSeller && order.status === "CashConfirmed" && order.claimCode && (
                    <div className="review-summary-box" style={{ marginTop: "0.4rem" }}>
                      Claim Code: <strong>{order.claimCode}</strong>
                    </div>
                  )}
                  {isBuyer && order.status === "CashConfirmed" && (
                    <div className="calendar-meta">
                      Claim code was sent to your inbox. Enter it below to complete purchase.
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                  {isSeller && order.status === "PendingCash" && (
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => sellerConfirmCash(order.id)}
                    >
                      Confirm Payment
                    </button>
                  )}
                  {isBuyer && order.status === "CashConfirmed" && (
                    <>
                      <input
                        style={{ width: "120px" }}
                        placeholder="Claim code"
                        value={claimCodes[order.id] || ""}
                        onChange={(event) =>
                          setClaimCodes((prev) => ({ ...prev, [order.id]: event.target.value }))
                        }
                      />
                      <button
                        className="btn btn-purple btn-sm"
                        disabled={busy}
                        onClick={() => buyerClaim(order.id)}
                      >
                        Claim
                      </button>
                    </>
                  )}
                  {(isBuyer || isSeller) && (
                    <button
                      className="btn btn-ghost btn-sm"
                      disabled={busy}
                      onClick={() => raiseDispute(order.id)}
                    >
                      Raise Dispute
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {!activeOrders.length && <div className="empty-col">No active marketplace orders.</div>}
        </div>
          </div>

          <div className="panel panel-elevated" style={{ marginTop: "1rem" }}>
            <div className="panel-kicker">History</div>
            <div className="panel-title">Completed Transactions ({completedOrders.length})</div>
            <div className="calendar-list">
              {completedOrders.map((order) => (
                <div key={order.id} className="review-card">
                  <div className="review-card-header">
                    <div>
                      <div className="review-card-title">{order.productTitle || "Product"}</div>
                      <div className="review-card-meta">
                        Buyer: {order.buyerName || "Buyer"} | Seller: {order.sellerName || "Seller"} |
                        Completed
                      </div>
                    </div>
                    <div style={{ fontWeight: 700 }}>
                      N{Number(order.totalAmountNaira || 0).toLocaleString()}
                    </div>
                  </div>
                  <div className="calendar-meta">
                    Created: {formatDateTime(order.createdAt)}
                    {order.paymentMode ? ` | Mode: ${order.paymentMode}` : ""}
                    {order.cashConfirmedAt
                      ? ` | Payment Confirmed: ${formatDateTime(order.cashConfirmedAt)}`
                      : ""}
                    {order.claimedAt ? ` | Completed: ${formatDateTime(order.claimedAt)}` : ""}
                  </div>
                </div>
              ))}
              {!completedOrders.length && (
                <div className="empty-col">No completed transactions yet.</div>
              )}
            </div>
          </div>

          <div className="panel panel-elevated" style={{ marginTop: "1rem" }}>
            <div className="panel-kicker">Trust</div>
            <div className="panel-title">Disputes ({disputes.length})</div>
            <div className="calendar-list">
              {disputes.map((dispute) => (
                <div key={dispute.id} className="review-card">
                  <div className="review-card-header">
                    <div>
                      <div className="review-card-title">
                        {dispute.productTitle || "Marketplace dispute"}
                      </div>
                      <div className="review-card-meta">
                        Status: {dispute.status} | Raised by:{" "}
                        {dispute.raisedByName || "User"} | Against:{" "}
                        {dispute.againstName || "User"}
                      </div>
                    </div>
                    <div className="calendar-meta">{formatDateTime(dispute.createdAt)}</div>
                  </div>
                  <div className="review-summary-box">
                    <strong>{dispute.reason}</strong>
                    {dispute.details ? ` | ${dispute.details}` : ""}
                  </div>
                  {!!dispute.resolutionNote && (
                    <div className="calendar-meta">
                      Resolution: {dispute.resolutionNote}
                    </div>
                  )}
                  {canResolveDisputes && dispute.status === "Open" && (
                    <div style={{ marginTop: "0.5rem", display: "flex", gap: "0.45rem" }}>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => resolveDispute(dispute.id, "Resolved")}
                      >
                        Resolve
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => resolveDispute(dispute.id, "Rejected")}
                      >
                        Reject
                      </button>
                    </div>
                  )}
                </div>
              ))}
              {!disputes.length && <div className="empty-col">No disputes found.</div>}
            </div>
          </div>
        </>
      )}

      {marketView === "browse" && selectedProduct && (
        <div
          className="modal-overlay"
          onClick={(event) => {
            if (event.target === event.currentTarget) closeProduct();
          }}
        >
          <div className="modal modal-market-detail">
            <div className="market-detail-head">
              <div>
                <div className="modal-title" style={{ marginBottom: "0.3rem" }}>
                  {selectedProduct.title}
                </div>
                <div className="calendar-meta">
                  Seller: {selectedProduct.sellerName || "Seller"} |{" "}
                  {selectedProduct.schoolName || selectedProduct.stateName || "Nigeria"}
                </div>
              </div>
              <button className="btn btn-ghost btn-sm" onClick={closeProduct}>
                Close
              </button>
            </div>

            <div className="market-detail-grid">
              <div>
                <div className="market-detail-main-media">
                  {selectedMedia ? (
                    selectedMedia.kind === "video" ? (
                      <video src={selectedMedia.url} controls preload="metadata" />
                    ) : (
                      <img src={selectedMedia.url} alt={selectedProduct.title} />
                    )
                  ) : (
                    <div className="market-card-media-empty">No media uploaded</div>
                  )}
                </div>
                {!!selectedMediaList.length && (
                  <div className="market-detail-thumb-row">
                    {selectedMediaList.map((entry, index) => (
                      <button
                        key={entry.id || `${entry.url}-${index}`}
                        className={`market-detail-thumb ${
                          detailMediaIndex === index ? "active" : ""
                        }`}
                        onClick={() => setDetailMediaIndex(index)}
                      >
                        {entry.kind === "video" ? (
                          <video src={entry.url} preload="metadata" muted />
                        ) : (
                          <img src={entry.url} alt={`${selectedProduct.title} ${index + 1}`} />
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div>
                <div className="market-detail-price">
                  N{asNaira(selectedProduct.priceKobo, selectedProduct.priceNaira).toLocaleString()}
                </div>
                <div className="review-card-meta" style={{ marginBottom: "0.6rem" }}>
                  <span>{marketChipMeta(selectedProduct).label}</span>
                  <span>|</span>
                  <span>
                    {selectedProduct.categoryName ||
                      selectedProduct.customCategoryName ||
                      "Uncategorized"}
                  </span>
                  <span>|</span>
                  <span>{selectedProduct.condition}</span>
                  <span>|</span>
                  <span>Qty: {selectedProduct.quantityAvailable}</span>
                  <span>|</span>
                  <span>{selectedProduct.sellerVerified ? "Verified seller" : "Unverified seller"}</span>
                  <span>|</span>
                  <span>
                    Rating: {Number(selectedProduct.averageRating || 0).toFixed(2)} (
                    {selectedProduct.ratingCount || 0})
                  </span>
                </div>
                <div className="review-summary-box">
                  {selectedProduct.description || "No description provided."}
                </div>
                {selectedProduct.sellerRole === "student" && (
                  <div className="calendar-meta" style={{ marginBottom: "0.6rem" }}>
                    Seller credibility: {selectedProduct.sellerCredibility || 0}%
                  </div>
                )}

                {selectedProduct.sellerUserId !== user.id && (
                  <div className="market-detail-action-box">
                    <div className="panel-subtitle">Buy Now</div>
                    <div className="market-detail-order-row">
                      <input
                        type="number"
                        min="1"
                        max={Math.max(1, Number(selectedProduct.quantityAvailable) || 1)}
                        value={purchaseQuantity}
                        onChange={(event) =>
                          setPurchaseQuantity(
                            Math.max(
                              1,
                              Math.min(
                                Number(selectedProduct.quantityAvailable) || 1,
                                Number(event.target.value) || 1
                              )
                            )
                          )
                        }
                      />
                      <select
                        value={purchasePaymentMode}
                        onChange={(event) => setPurchasePaymentMode(event.target.value)}
                      >
                        <option value="cash">Cash</option>
                        <option value="p2p">P2P Transfer</option>
                        <option value="transfer">Bank Transfer</option>
                      </select>
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() =>
                          placeOrder(
                            selectedProduct.id,
                            purchaseQuantity,
                            purchasePaymentMode
                          )
                        }
                      >
                        Purchase
                      </button>
                    </div>
                    {(purchasePaymentMode === "transfer" ||
                      purchasePaymentMode === "p2p") && (
                      <div className="field" style={{ marginTop: "0.5rem" }}>
                        <label>Your Payment Reference (optional)</label>
                        <input
                          placeholder="Bank transfer/P2P reference"
                          value={purchasePaymentReference}
                          onChange={(event) =>
                            setPurchasePaymentReference(event.target.value)
                          }
                        />
                      </div>
                    )}
                  </div>
                )}

                {selectedProduct.sellerUserId !== user.id && (
                  <div className="market-detail-action-box">
                    <div className="panel-subtitle">Negotiate (Send Offer)</div>
                    <div className="field">
                      <label>Offer Amount (Naira)</label>
                      <input
                        type="number"
                        min="1"
                        value={offerDraft.amountNaira}
                        onChange={(event) =>
                          setOfferDraft((prev) => ({
                            ...prev,
                            amountNaira: event.target.value,
                          }))
                        }
                      />
                    </div>
                    <div className="field">
                      <label>Offer Note (Optional)</label>
                      <textarea
                        value={offerDraft.note}
                        onChange={(event) =>
                          setOfferDraft((prev) => ({ ...prev, note: event.target.value }))
                        }
                        placeholder="Condition, pickup plan, or delivery note..."
                      />
                    </div>
                    <button className="btn btn-purple btn-sm" disabled={busy} onClick={sendOffer}>
                      Send Offer To Seller Inbox
                    </button>
                  </div>
                )}

                {selectedProduct.sellerUserId !== user.id && (
                  <div className="market-detail-action-box">
                    <div className="panel-subtitle">Rate & Review</div>
                    <div className="market-rating-input">
                      {[1, 2, 3, 4, 5].map((star) => (
                        <button
                          key={star}
                          type="button"
                          className={`market-star-btn ${
                            Number(reviewDraft.rating) >= star ? "active" : ""
                          }`}
                          onClick={() =>
                            setReviewDraft((prev) => ({ ...prev, rating: star }))
                          }
                        >
                          ★
                        </button>
                      ))}
                    </div>
                    <div className="field">
                      <label>Review (Optional)</label>
                      <textarea
                        value={reviewDraft.reviewText}
                        onChange={(event) =>
                          setReviewDraft((prev) => ({
                            ...prev,
                            reviewText: event.target.value,
                          }))
                        }
                        placeholder="Share your feedback on this product..."
                      />
                    </div>
                    <button
                      className="btn btn-primary btn-sm"
                      disabled={busy}
                      onClick={() => reviewProduct(selectedProduct.id)}
                    >
                      Submit 5-Star Review
                    </button>
                  </div>
                )}

                <div className="panel-actions" style={{ marginTop: "0.8rem" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => reportProduct(selectedProduct.id)}
                  >
                    Report
                  </button>
                  {canModerate && (
                    <>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() =>
                          setSellerVerification(
                            selectedProduct.sellerUserId,
                            !selectedProduct.sellerVerified
                          )
                        }
                      >
                        {selectedProduct.sellerVerified ? "Unverify Seller" : "Verify Seller"}
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => moderateProduct(selectedProduct.id, "hide")}
                      >
                        Hide
                      </button>
                      <button
                        className="btn btn-danger btn-sm"
                        disabled={busy}
                        onClick={() => moderateProduct(selectedProduct.id, "remove")}
                      >
                        Remove
                      </button>
                      <button
                        className="btn btn-ghost btn-sm"
                        disabled={busy}
                        onClick={() => moderateProduct(selectedProduct.id, "restore")}
                      >
                        Restore
                      </button>
                    </>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
