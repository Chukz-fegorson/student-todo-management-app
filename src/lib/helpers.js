import { DEFAULT_REMINDER_OFFSETS } from "./constants";

export const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
export const now = () => Date.now();

const gradeMap = {
  "A+": 100,
  A: 95,
  "A-": 90,
  "B+": 85,
  B: 80,
  "B-": 75,
  "C+": 70,
  C: 65,
  "C-": 60,
  D: 50,
  F: 30,
};

export function gradeToScore(grade) {
  if (!grade) return null;
  return gradeMap[grade] ?? null;
}

export function gradeColor(grade) {
  if (!grade) return "var(--muted)";
  if (["A+", "A", "A-"].includes(grade)) return "var(--green)";
  if (["B+", "B", "B-"].includes(grade)) return "var(--accent)";
  if (["C+", "C", "C-"].includes(grade)) return "var(--amber)";
  return "var(--red)";
}

export function effectiveProgress(todo) {
  const baseProgress = Number.isFinite(Number(todo?.progress))
    ? Number(todo.progress)
    : 0;
  const score = gradeToScore(todo?.grade);
  if (score === null) return Math.round(baseProgress);
  return Math.round(baseProgress * 0.4 + score * 0.6);
}

export function parseDate(value) {
  if (!value) return null;
  const dt = new Date(value);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function formatDate(iso) {
  const dt = parseDate(iso);
  if (!dt) return "";
  return dt.toLocaleDateString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso) {
  const dt = parseDate(iso);
  if (!dt) return "";
  return dt.toLocaleString("en-GB", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function deadlineStatus(deadline) {
  const dt = parseDate(deadline);
  if (!dt) return null;
  const diff = dt.getTime() - now();
  if (diff < 0) return "overdue";
  if (diff < 24 * 60 * 60 * 1000) return "urgent";
  if (diff < 3 * 24 * 60 * 60 * 1000) return "soon";
  return "ok";
}

export function timeLeft(deadline) {
  const dt = parseDate(deadline);
  if (!dt) return "";
  const diff = dt.getTime() - now();
  const hours = Math.abs(Math.floor(diff / 3600000));
  if (diff < 0) {
    return hours < 24 ? `${hours}h overdue` : `${Math.floor(hours / 24)}d overdue`;
  }
  return hours < 24 ? `${hours}h left` : `${Math.floor(hours / 24)}d left`;
}

export function toDateTimeLocalValue(iso) {
  const dt = parseDate(iso);
  if (!dt) return "";
  const copy = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000);
  return copy.toISOString().slice(0, 16);
}

export function toIsoFromDateTimeLocal(value) {
  if (!value) return null;
  const dt = new Date(value);
  if (Number.isNaN(dt.getTime())) return null;
  return dt.toISOString();
}

export function normalizeReminderOffsets(offsets) {
  if (!Array.isArray(offsets)) return [...DEFAULT_REMINDER_OFFSETS];
  const valid = offsets
    .map((entry) => Number(entry))
    .filter((entry) => Number.isFinite(entry) && entry > 0 && entry <= 24 * 60)
    .map((entry) => Math.round(entry));
  if (!valid.length) return [...DEFAULT_REMINDER_OFFSETS];
  return Array.from(new Set(valid)).sort((a, b) => b - a);
}

export function groupBy(items, keyFn) {
  return items.reduce((acc, item) => {
    const key = keyFn(item);
    if (!acc[key]) acc[key] = [];
    acc[key].push(item);
    return acc;
  }, {});
}
