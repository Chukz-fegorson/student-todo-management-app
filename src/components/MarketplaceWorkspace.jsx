import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import { formatDateTime } from "../lib/helpers";

function asNaira(valueKobo, valueNaira) {
  if (Number.isFinite(Number(valueNaira))) return Number(valueNaira);
  return Number(valueKobo || 0) / 100;
}

function toQueryString(params) {
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

export default function MarketplaceWorkspace({ user }) {
  const [categories, setCategories] = useState([]);
  const [categoryRequests, setCategoryRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
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
    condition: "new",
    priceNaira: "",
    quantity: 1,
    mediaUrls: [],
    mediaUrlDraft: "",
  });
  const [categoryRequestName, setCategoryRequestName] = useState("");
  const [claimCodes, setClaimCodes] = useState({});

  const [selectedProductId, setSelectedProductId] = useState("");
  const [detailMediaIndex, setDetailMediaIndex] = useState(0);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [offerDraft, setOfferDraft] = useState({ amountNaira: "", note: "" });

  const canModerate =
    user.role === "school" || user.role === "state" || user.role === "federal";
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

  const loadMarketplace = useCallback(async () => {
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
      ];
      if (canModerate) requests.push(apiGet("/market/category-requests"));
      const [categoriesData, productsData, ordersData, requestData] =
        await Promise.all(requests);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
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

  function applyFilters() {
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
    setOfferDraft({ amountNaira: "", note: "" });
  }

  function closeProduct() {
    setSelectedProductId("");
    setDetailMediaIndex(0);
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
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    try {
      setBusy(true);
      const next = [];
      for (const file of files.slice(0, 6)) {
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
        mediaUrls: [...prev.mediaUrls, ...next].slice(0, 8),
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
    if (!listingForm.title.trim()) return setError("Product title is required.");
    if (!Number(listingForm.priceNaira)) return setError("Valid price is required.");
    try {
      setBusy(true);
      setError("");
      await apiPost("/market/products", {
        title: listingForm.title.trim(),
        description: listingForm.description.trim() || null,
        mediaUrls: listingForm.mediaUrls,
        categoryId: listingForm.categoryId || null,
        condition: listingForm.condition,
        priceNaira: Number(listingForm.priceNaira),
        quantity: Number(listingForm.quantity || 1),
      });
      setListingForm({
        title: "",
        description: "",
        categoryId: "",
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

  async function requestCategory() {
    if (!categoryRequestName.trim()) return setError("Enter category name.");
    try {
      setBusy(true);
      setError("");
      await apiPost("/market/categories/request", {
        name: categoryRequestName.trim(),
        listingType: "student",
      });
      setCategoryRequestName("");
      setNotice("Category request submitted for school approval.");
      await loadMarketplace();
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

  async function placeOrder(productId, quantity = 1) {
    try {
      setBusy(true);
      setError("");
      await apiPost("/market/orders", {
        productId,
        quantity: Math.max(1, Number(quantity) || 1),
      });
      setNotice("Order created. Pay cash and ask seller to confirm.");
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
    try {
      setBusy(true);
      setError("");
      const data = await apiPost(`/market/orders/${orderId}/seller-confirm-cash`, {});
      setNotice(
        data?.claimCode
          ? `Cash confirmed. Claim code ${data.claimCode} was sent to buyer inbox and stays visible on this order until buyer claims.`
          : "Cash confirmed."
      );
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to confirm cash.");
    } finally {
      setBusy(false);
    }
  }

  async function buyerClaim(orderId) {
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
    const ratingText = window.prompt("Rating (1-5):", "5");
    const rating = Number(ratingText);
    if (!Number.isFinite(rating) || rating < 1 || rating > 5) return;
    const reviewText = window.prompt("Feedback/review (optional):", "");
    try {
      setBusy(true);
      setError("");
      await apiPost(`/market/products/${productId}/reviews`, {
        rating,
        reviewText: reviewText ? String(reviewText).trim() : null,
      });
      setNotice("Review saved.");
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

  if (loading) return <div className="empty-col">Loading marketplace workspace...</div>;

  return (
    <section className="panel market-panel" style={{ marginTop: "1rem" }}>
      <div className="panel-title">Marketplace (School + Student-to-Student)</div>
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

      <div className="market-filter-bar">
        <input
          placeholder="Search products"
          value={filtersDraft.q}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, q: event.target.value }))
          }
        />
        <input
          placeholder="State"
          value={filtersDraft.state}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, state: event.target.value }))
          }
        />
        <input
          placeholder="LGA"
          value={filtersDraft.lga}
          onChange={(event) =>
            setFiltersDraft((prev) => ({ ...prev, lga: event.target.value }))
          }
        />
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

      {canSell && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-subtitle">Create Listing ({listingType})</div>
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
                onChange={(event) =>
                  setListingForm((prev) => ({ ...prev, categoryId: event.target.value }))
                }
              >
                <option value="">No category</option>
                {productCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
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

      {user.role === "student" && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-subtitle">Request New Student Category</div>
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

      {canModerate && (
        <div className="panel" style={{ marginBottom: "1rem" }}>
          <div className="panel-subtitle">Pending Category Requests ({categoryRequests.length})</div>
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

      <div className="panel-subtitle">Products ({products.length})</div>
      <div className="market-grid">
        {products.map((product) => {
          const mine = product.sellerUserId === user.id;
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
                  <span className="market-card-chip">
                    {product.listingType === "school" ? "School Store" : "Student Market"}
                  </span>
                </div>
                <div className="market-card-body">
                  <div className="market-card-title">{product.title}</div>
                  <div className="market-card-price">
                    N{asNaira(product.priceKobo, product.priceNaira).toLocaleString()}
                  </div>
                  <div className="market-card-meta">
                    <span>{product.sellerName || "Seller"}</span>
                    <span>|</span>
                    <span>{product.schoolName || product.stateName || "Nigeria"}</span>
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
                    onClick={() => placeOrder(product.id, 1)}
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

      <div style={{ marginTop: "1rem" }}>
        <div className="panel-subtitle">Active Orders ({activeOrders.length})</div>
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
                  {order.cashConfirmedAt && (
                    <div className="calendar-meta">
                      Cash confirmed: {formatDateTime(order.cashConfirmedAt)}
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
                      Confirm Cash
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
                </div>
              </div>
            );
          })}
          {!activeOrders.length && <div className="empty-col">No active marketplace orders.</div>}
        </div>
      </div>

      <div style={{ marginTop: "1rem" }}>
        <div className="panel-subtitle">Completed Transactions ({completedOrders.length})</div>
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
                {order.cashConfirmedAt
                  ? ` | Cash Confirmed: ${formatDateTime(order.cashConfirmedAt)}`
                  : ""}
                {order.claimedAt ? ` | Completed: ${formatDateTime(order.claimedAt)}` : ""}
              </div>
            </div>
          ))}
          {!completedOrders.length && <div className="empty-col">No completed transactions yet.</div>}
        </div>
      </div>

      {selectedProduct && (
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
                  <span>{selectedProduct.condition}</span>
                  <span>|</span>
                  <span>Qty: {selectedProduct.quantityAvailable}</span>
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
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => placeOrder(selectedProduct.id, purchaseQuantity)}
                      >
                        Purchase
                      </button>
                    </div>
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

                <div className="panel-actions" style={{ marginTop: "0.8rem" }}>
                  <button
                    className="btn btn-ghost btn-sm"
                    disabled={busy}
                    onClick={() => reviewProduct(selectedProduct.id)}
                  >
                    Review
                  </button>
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
