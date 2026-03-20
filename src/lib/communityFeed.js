export const FEED_POST_MEDIA_MAX_ITEMS = 4;
export const FEED_COMMENT_MEDIA_MAX_ITEMS = 3;
export const FEED_MEDIA_MAX_BYTES = 3 * 1024 * 1024;
export const FEED_MEDIA_MAX_PAYLOAD_CHARS = 12 * 1024 * 1024;

export function createFeedPostForm() {
  return {
    title: "",
    body: "",
    visibilityMode: "everyone",
    visibilitySelectedUserIds: [],
    mediaUrls: [],
    mediaUrlDraft: "",
  };
}

export function createFeedCommentDraft() {
  return {
    body: "",
    mediaUrls: [],
    mediaUrlDraft: "",
  };
}

export function deriveFeedTitle(title, body, mediaCount = 0) {
  const explicit = String(title || "").trim();
  if (explicit) return explicit.slice(0, 240);

  const summary = String(body || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 80);
  if (summary) return summary;
  if (mediaCount) return "Media update";
  return "Community update";
}

export function feedMediaKindFromFile(file) {
  if (!file) return "image";
  return String(file.type || "").startsWith("video/") ? "video" : "image";
}

export function feedMediaKindFromUrl(url) {
  const normalized = String(url || "").trim().toLowerCase();
  if (
    normalized.startsWith("data:video/") ||
    /\.(mp4|webm|ogg|mov|m4v)(\?|#|$)/.test(normalized)
  ) {
    return "video";
  }
  return "image";
}

export function estimateFeedMediaPayloadChars(mediaItems = []) {
  return mediaItems.reduce(
    (sum, entry) => sum + String(entry?.url || "").length,
    0
  );
}
