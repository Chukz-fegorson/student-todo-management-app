import { formatDateTime } from "../lib/helpers";
import {
  OTHER_CATEGORY_VALUE,
  asNaira,
  marketChipMeta,
  paymentModeLabel,
} from "../lib/marketplace";
import { useMarketplaceWorkspace } from "../hooks/useMarketplaceWorkspace";

export default function MarketplaceWorkspace({ user, navRoute }) {
  const {
    activeOrders,
    addMediaUrlDraft,
    applyFilters,
    approveCategory,
    busy,
    buyerClaim,
    canModerate,
    canResolveDisputes,
    canSell,
    categoryRequestName,
    categoryRequests,
    claimCodes,
    closeProduct,
    completedOrders,
    createListing,
    detailMediaIndex,
    disputes,
    error,
    filterLgaOptions,
    filterStateOptions,
    filtersDraft,
    handleMediaFiles,
    listingForm,
    listingType,
    loading,
    marketHighlights,
    marketView,
    moderateProduct,
    notice,
    offerDraft,
    openProduct,
    placeOrder,
    productCategories,
    products,
    purchasePaymentMode,
    purchasePaymentReference,
    purchaseQuantity,
    raiseDispute,
    releaseClaimCode,
    removeMedia,
    reportProduct,
    requestCategory,
    resetFilters,
    resolveDispute,
    reviewDraft,
    reviewProduct,
    selectedMedia,
    selectedMediaList,
    selectedProduct,
    sellCategoryName,
    sellerConfirmCash,
    sendOffer,
    setCategoryRequestName,
    setDetailMediaIndex,
    setFiltersDraft,
    setListingForm,
    setNotice,
    setOfferDraft,
    setPurchasePaymentMode,
    setPurchasePaymentReference,
    setPurchaseQuantity,
    setReviewDraft,
    setSellCategoryName,
    setSellerVerification,
    switchMarketView,
    updateClaimCode,
  } = useMarketplaceWorkspace({ user, navRoute });

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
                    onClick={() => placeOrder(product.id, 1, "card")}
                  >
                    Checkout
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
                    Status: {order.statusLabel || order.status} | Total: N
                    {Number(order.totalAmountNaira || 0).toLocaleString()} | Created:{" "}
                    {formatDateTime(order.createdAt)}
                  </div>
                  <div className="calendar-meta">
                    Mode: {paymentModeLabel(order.paymentMode)} | Platform Fee: N
                    {Number(order.platformFeeNaira || 0).toLocaleString()} | Seller Net: N
                    {Number(order.sellerNetNaira || 0).toLocaleString()}
                    {order.buyerPaymentReference
                      ? ` | Buyer Ref: ${order.buyerPaymentReference}`
                      : ""}
                  </div>
                  {order.paymentConfirmedAt && (
                    <div className="calendar-meta">
                      {order.paymentMode === "card"
                        ? `Checkout cleared: ${formatDateTime(order.paymentConfirmedAt)}`
                        : `Seller confirmed payment: ${formatDateTime(order.paymentConfirmedAt)}`}
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
                      {order.paymentMode === "card" && !order.claimCodeReleasedAt
                        ? " | Waiting for seller release"
                        : ""}
                    </div>
                  )}
                  {isSeller &&
                    order.paymentMode === "card" &&
                    order.status === "CashConfirmed" &&
                    order.claimCodeReleasedAt && (
                      <div className="calendar-meta">
                        Claim code released: {formatDateTime(order.claimCodeReleasedAt)}
                      </div>
                    )}
                  {isBuyer &&
                    order.paymentMode === "card" &&
                    order.status === "CashConfirmed" &&
                    !order.claimCodeReleasedAt && (
                      <div className="calendar-meta">
                        Payment is cleared. Waiting for seller to release your claim code after handoff.
                      </div>
                    )}
                  {isBuyer &&
                    order.status === "CashConfirmed" &&
                    (order.paymentMode !== "card" || order.claimCodeReleasedAt) && (
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
                  {isSeller &&
                    order.paymentMode === "card" &&
                    order.status === "CashConfirmed" &&
                    !order.claimCodeReleasedAt && (
                      <button
                        className="btn btn-primary btn-sm"
                        disabled={busy}
                        onClick={() => releaseClaimCode(order.id)}
                      >
                        Release Claim Code
                      </button>
                    )}
                  {isBuyer &&
                    order.status === "CashConfirmed" &&
                    (order.paymentMode !== "card" || order.claimCodeReleasedAt) && (
                    <>
                      <input
                        style={{ width: "120px" }}
                        placeholder="Claim code"
                        value={claimCodes[order.id] || ""}
                        onChange={(event) => updateClaimCode(order.id, event.target.value)}
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
                    {order.paymentMode
                      ? ` | Mode: ${paymentModeLabel(order.paymentMode)}`
                      : ""}
                    {order.paymentConfirmedAt
                      ? ` | Payment Confirmed: ${formatDateTime(order.paymentConfirmedAt)}`
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
                        <option value="card">Card / Checkout</option>
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
                    {purchasePaymentMode === "card" && (
                      <div className="review-summary-box" style={{ marginTop: "0.5rem" }}>
                        StudyFlow Checkout clears payment instantly. The seller keeps the existing
                        handoff flow by releasing your claim code after the item is ready.
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
