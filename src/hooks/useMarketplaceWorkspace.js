import { useCallback, useEffect, useMemo, useState } from "react";
import { apiGet, apiPost } from "../lib/api";
import {
  NIGERIA_STATES,
  buildStateLgaIndex,
  getLgaOptionsForState,
} from "../lib/locationData";
import {
  OTHER_CATEGORY_VALUE,
  createEmptyFilters,
  createListingForm,
  createOfferDraft,
  createReviewDraft,
  createWalletSummary,
  mediaKindFromFile,
  toQueryString,
} from "../lib/marketplace";

function fileToDataUrl(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ""));
    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsDataURL(file);
  });
}

export function useMarketplaceWorkspace({ user, navRoute }) {
  const [categories, setCategories] = useState([]);
  const [categoryRequests, setCategoryRequests] = useState([]);
  const [products, setProducts] = useState([]);
  const [orders, setOrders] = useState([]);
  const [disputes, setDisputes] = useState([]);
  const [walletSummary, setWalletSummary] = useState(() => createWalletSummary());
  const [walletTransactions, setWalletTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [filtersDraft, setFiltersDraft] = useState(() => createEmptyFilters());
  const [filtersApplied, setFiltersApplied] = useState(() => createEmptyFilters());
  const [listingForm, setListingForm] = useState(() => createListingForm());
  const [categoryRequestName, setCategoryRequestName] = useState("");
  const [sellCategoryName, setSellCategoryName] = useState("");
  const [claimCodes, setClaimCodes] = useState({});
  const [marketView, setMarketView] = useState("browse");
  const [selectedProductId, setSelectedProductId] = useState("");
  const [detailMediaIndex, setDetailMediaIndex] = useState(0);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [purchasePaymentMode, setPurchasePaymentMode] = useState("card");
  const [purchasePaymentReference, setPurchasePaymentReference] = useState("");
  const [offerDraft, setOfferDraft] = useState(() => createOfferDraft());
  const [reviewDraft, setReviewDraft] = useState(() => createReviewDraft());

  const canModerate =
    user.role === "school" || user.role === "state" || user.role === "federal";
  const canResolveDisputes =
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
  const productStateIndex = useMemo(() => buildStateLgaIndex(products), [products]);
  const filterLgaOptions = useMemo(
    () => getLgaOptionsForState(productStateIndex, filtersDraft.state, [filtersDraft.lga]),
    [filtersDraft.lga, filtersDraft.state, productStateIndex]
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
  }, [filtersDraft.state, products]);
  const myListingCount = useMemo(
    () => products.filter((entry) => entry.sellerUserId === user.id).length,
    [products, user.id]
  );
  const openDisputeCount = useMemo(
    () => disputes.filter((entry) => entry.status === "Open").length,
    [disputes]
  );
  const marketHighlights = useMemo(
    () => ({
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
        `Wallet available: N${Number(walletSummary.availableBalanceNaira || 0).toLocaleString()}`,
        `Wallet pending: N${Number(walletSummary.pendingBalanceNaira || 0).toLocaleString()}`,
      ],
      moderation: [
        `${categoryRequests.length} category request${categoryRequests.length === 1 ? "" : "s"}`,
        `${openDisputeCount} open dispute${openDisputeCount === 1 ? "" : "s"}`,
        "Review reports and keep marketplace trust intact",
      ],
    }),
    [
      activeOrders.length,
      canSell,
      categories.length,
      categoryRequests.length,
      completedOrders.length,
      myListingCount,
      openDisputeCount,
      products.length,
      walletSummary.availableBalanceNaira,
      walletSummary.pendingBalanceNaira,
    ]
  );

  const closeProduct = useCallback(() => {
    setSelectedProductId("");
    setDetailMediaIndex(0);
  }, []);

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
        apiGet("/market/disputes"),
        apiGet("/market/wallet").catch(() => createWalletSummary()),
        apiGet("/market/wallet/transactions").catch(() => []),
      ];
      if (canModerate) requests.push(apiGet("/market/category-requests"));
      const [
        categoriesData,
        productsData,
        ordersData,
        disputesData,
        walletSummaryData,
        walletTransactionsData,
        requestData,
      ] =
        await Promise.all(requests);
      setCategories(Array.isArray(categoriesData) ? categoriesData : []);
      setProducts(Array.isArray(productsData) ? productsData : []);
      setOrders(Array.isArray(ordersData) ? ordersData : []);
      setDisputes(Array.isArray(disputesData) ? disputesData : []);
      setWalletSummary(
        walletSummaryData && typeof walletSummaryData === "object"
          ? { ...createWalletSummary(), ...walletSummaryData }
          : createWalletSummary()
      );
      setWalletTransactions(
        Array.isArray(walletTransactionsData) ? walletTransactionsData : []
      );
      setCategoryRequests(Array.isArray(requestData) ? requestData : []);
    } catch (err) {
      setError(err.message || "Failed to load marketplace workspace.");
    } finally {
      setLoading(false);
    }
  }, [canModerate, filtersApplied]);

  useEffect(() => {
    loadMarketplace();
  }, [loadMarketplace, user.id]);

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
  }, [detailMediaIndex, selectedMediaList]);

  useEffect(() => {
    setReviewDraft(createReviewDraft());
  }, [selectedProductId]);

  const openProduct = useCallback((product) => {
    setSelectedProductId(product.id);
    setDetailMediaIndex(0);
    setPurchaseQuantity(1);
    setPurchasePaymentMode("card");
    setPurchasePaymentReference("");
    setOfferDraft(createOfferDraft());
  }, []);

  const switchMarketView = useCallback(
    (nextView) => {
      setMarketView(nextView);
      if (nextView !== "browse") closeProduct();
    },
    [closeProduct]
  );

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
  }, [closeProduct, navRoute, openProduct, products]);

  const applyFilters = useCallback(() => {
    setFiltersApplied({ ...filtersDraft });
  }, [filtersDraft]);

  const resetFilters = useCallback(() => {
    setFiltersDraft(createEmptyFilters());
    setFiltersApplied(createEmptyFilters());
  }, []);

  const addMediaUrlDraft = useCallback(() => {
    const nextUrl = String(listingForm.mediaUrlDraft || "").trim();
    if (!nextUrl) return;
    setListingForm((prev) => ({
      ...prev,
      mediaUrls: [
        ...prev.mediaUrls,
        { id: window.crypto.randomUUID(), kind: "image", url: nextUrl },
      ],
      mediaUrlDraft: "",
    }));
  }, [listingForm.mediaUrlDraft]);

  const handleMediaFiles = useCallback(async (event) => {
    const input = event.target;
    const files = Array.from(input.files || []);
    if (!files.length) return;
    try {
      setBusy(true);
      const next = [];
      for (const file of files.slice(0, 12)) {
        if (!file.type.startsWith("image/") && !file.type.startsWith("video/")) continue;
        if (file.size > 8 * 1024 * 1024) continue;
        const dataUrl = await fileToDataUrl(file);
        next.push({
          id: window.crypto.randomUUID(),
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
      input.value = "";
    }
  }, []);

  const removeMedia = useCallback((itemId) => {
    setListingForm((prev) => ({
      ...prev,
      mediaUrls: prev.mediaUrls.filter((entry) => entry.id !== itemId),
    }));
  }, []);

  const createListing = useCallback(async () => {
    if (!listingForm.title.trim()) {
      setError("Product title is required.");
      return;
    }
    if (!Number(listingForm.priceNaira)) {
      setError("Valid price is required.");
      return;
    }
    const isCustomCategory = listingForm.categoryId === OTHER_CATEGORY_VALUE;
    const customCategoryName = String(listingForm.customCategoryName || "").trim();
    if (isCustomCategory && !customCategoryName) {
      setError("Enter custom category name when 'Others' is selected.");
      return;
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
      setListingForm(createListingForm());
      setNotice("Listing published.");
      await loadMarketplace();
    } catch (err) {
      setError(err.message || "Failed to create listing.");
    } finally {
      setBusy(false);
    }
  }, [listingForm, loadMarketplace]);

  const requestCategory = useCallback(
    async (options = {}) => {
      const name = String(options.name ?? categoryRequestName).trim();
      if (!name) {
        setError("Enter category name.");
        return;
      }
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
    },
    [categoryRequestName, loadMarketplace]
  );

  const approveCategory = useCallback(
    async (categoryId, action) => {
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
    },
    [loadMarketplace]
  );

  const placeOrder = useCallback(
    async (productId, quantity = 1, paymentMode = "cash") => {
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
          paymentMode === "card"
            ? "Order created. Card payment is now held in StudyFlow escrow until the buyer claim step completes."
            : paymentMode === "transfer"
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
    },
    [loadMarketplace, purchasePaymentReference]
  );

  const releaseClaimCode = useCallback(
    async (orderId) => {
      try {
        setBusy(true);
        setError("");
        await apiPost(`/market/orders/${orderId}/release-claim-code`, {});
        setNotice("Claim code released to buyer inbox.");
        await loadMarketplace();
      } catch (err) {
        setError(err.message || "Failed to release claim code.");
      } finally {
        setBusy(false);
      }
    },
    [loadMarketplace]
  );

  const sendOffer = useCallback(async () => {
    if (!selectedProduct) return;
    const amount = Number(offerDraft.amountNaira);
    if (!Number.isFinite(amount) || amount <= 0) {
      setError("Offer amount must be greater than 0.");
      return;
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
      setOfferDraft(createOfferDraft());
      setNotice("Offer sent to seller inbox.");
    } catch (err) {
      setError(err.message || "Failed to send offer.");
    } finally {
      setBusy(false);
    }
  }, [offerDraft, selectedProduct]);

  const sellerConfirmCash = useCallback(
    async (orderId) => {
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
    },
    [loadMarketplace]
  );

  const updateClaimCode = useCallback((orderId, value) => {
    setClaimCodes((prev) => ({ ...prev, [orderId]: value }));
  }, []);

  const buyerClaim = useCallback(
    async (orderId) => {
      const claimCode = String(claimCodes[orderId] || "").trim();
      if (!claimCode) {
        setError("Enter claim code first.");
        return;
      }
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
    },
    [claimCodes, loadMarketplace]
  );

  const raiseDispute = useCallback(
    async (orderId) => {
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
    },
    [loadMarketplace]
  );

  const resolveDispute = useCallback(
    async (disputeId, status = "Resolved") => {
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
    },
    [loadMarketplace]
  );

  const setSellerVerification = useCallback(
    async (userIdToVerify, verify) => {
      try {
        setBusy(true);
        setError("");
        await apiPost(`/market/users/${userIdToVerify}/verify`, { verify });
        setNotice(verify ? "Seller verified." : "Seller verification removed.");
        await loadMarketplace();
      } catch (err) {
        setError(err.message || "Failed to update seller verification.");
      } finally {
        setBusy(false);
      }
    },
    [loadMarketplace]
  );

  const reportProduct = useCallback(
    async (productId) => {
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
    },
    [loadMarketplace]
  );

  const reviewProduct = useCallback(
    async (productId) => {
      const rating = Math.max(1, Math.min(5, Number(reviewDraft.rating) || 0));
      if (!Number.isFinite(rating) || rating < 1 || rating > 5) {
        setError("Choose a star rating between 1 and 5.");
        return;
      }
      try {
        setBusy(true);
        setError("");
        await apiPost(`/market/products/${productId}/reviews`, {
          rating,
          reviewText: reviewDraft.reviewText.trim() || null,
        });
        setNotice("Review saved.");
        setReviewDraft(createReviewDraft());
        await loadMarketplace();
      } catch (err) {
        setError(err.message || "Failed to submit review.");
      } finally {
        setBusy(false);
      }
    },
    [loadMarketplace, reviewDraft]
  );

  const moderateProduct = useCallback(
    async (productId, action) => {
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
    },
    [loadMarketplace]
  );

  return {
    activeOrders,
    addMediaUrlDraft,
    applyFilters,
    approveCategory,
    busy,
    buyerClaim,
    canModerate,
    canResolveDisputes,
    canSell,
    categories,
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
    notice,
    openProduct,
    openDisputeCount,
    orders,
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
    setMarketView,
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
    userId: user.id,
    walletSummary,
    walletTransactions,
    offerDraft,
    moderateProduct,
  };
}
