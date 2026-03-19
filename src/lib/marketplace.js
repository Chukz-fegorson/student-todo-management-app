export function asNaira(valueKobo, valueNaira) {
  if (Number.isFinite(Number(valueNaira))) return Number(valueNaira);
  return Number(valueKobo || 0) / 100;
}

export function toQueryString(params) {
  const query = new URLSearchParams();
  Object.entries(params).forEach(([key, value]) => {
    if (value === undefined || value === null || value === "") return;
    query.set(key, String(value));
  });
  const text = query.toString();
  return text ? `?${text}` : "";
}

export function mediaKindFromFile(file) {
  if (!file) return "image";
  return String(file.type || "").startsWith("video/") ? "video" : "image";
}

export function createEmptyFilters() {
  return {
    q: "",
    state: "",
    lga: "",
    schoolId: "",
    listingType: "",
    sellerNearMe: false,
  };
}

export function createListingForm() {
  return {
    title: "",
    description: "",
    categoryId: "",
    customCategoryName: "",
    condition: "new",
    priceNaira: "",
    quantity: 1,
    mediaUrls: [],
    mediaUrlDraft: "",
  };
}

export function createOfferDraft() {
  return { amountNaira: "", note: "" };
}

export function createReviewDraft() {
  return { rating: 5, reviewText: "" };
}

export const OTHER_CATEGORY_VALUE = "__other__";

export function marketChipMeta(product) {
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

export function paymentModeLabel(mode) {
  switch (String(mode || "").toLowerCase()) {
    case "card":
      return "Card / Checkout";
    case "p2p":
      return "P2P Transfer";
    case "transfer":
      return "Bank Transfer";
    default:
      return "Cash";
  }
}
