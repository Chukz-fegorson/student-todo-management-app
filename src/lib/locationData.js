import nigeriaStateLgas from "./nigeriaStateLgas.json";

// Shared location/gender options used by auth and profile forms.
export const NIGERIA_STATES = [
  "Abia",
  "Adamawa",
  "Akwa Ibom",
  "Anambra",
  "Bauchi",
  "Bayelsa",
  "Benue",
  "Borno",
  "Cross River",
  "Delta",
  "Ebonyi",
  "Edo",
  "Ekiti",
  "Enugu",
  "Federal Capital Territory",
  "Gombe",
  "Imo",
  "Jigawa",
  "Kaduna",
  "Kano",
  "Katsina",
  "Kebbi",
  "Kogi",
  "Kwara",
  "Lagos",
  "Nasarawa",
  "Niger",
  "Ogun",
  "Ondo",
  "Osun",
  "Oyo",
  "Plateau",
  "Rivers",
  "Sokoto",
  "Taraba",
  "Yobe",
  "Zamfara",
];

export const GENDER_OPTIONS = [
  "Female",
  "Male",
  "Non-binary",
  "Prefer not to say",
];

const NIGERIA_STATE_LGA_ROWS = Array.isArray(nigeriaStateLgas?.states)
  ? nigeriaStateLgas.states
  : [];

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

function createBaseStateLgaIndex() {
  const byState = new Map();
  for (const state of NIGERIA_STATE_LGA_ROWS) {
    const stateName = String(state?.name || "").trim();
    if (!stateName) continue;

    const key = normalizeKey(stateName);
    if (!byState.has(key)) byState.set(key, new Set());

    const lgas = Array.isArray(state?.lgas) ? state.lgas : [];
    for (const lgaNameRaw of lgas) {
      const lgaName = String(lgaNameRaw || "").trim();
      if (!lgaName) continue;
      byState.get(key).add(lgaName);
    }
  }
  return byState;
}

function cloneStateLgaIndex(index) {
  const next = new Map();
  for (const [key, values] of index.entries()) {
    next.set(key, new Set(values));
  }
  return next;
}

const BASE_STATE_LGA_INDEX = createBaseStateLgaIndex();

export function buildStateLgaIndex(rows = []) {
  // Turn flat rows into fast state -> LGAs lookup map.
  // Starts with standard Nigeria state/LGA map, then merges runtime school rows.
  const byState = cloneStateLgaIndex(BASE_STATE_LGA_INDEX);
  for (const row of rows) {
    const stateName = String(row?.stateName || "").trim();
    const lgaName = String(row?.lgaName || "").trim();
    if (!stateName || !lgaName) continue;
    const key = normalizeKey(stateName);
    if (!byState.has(key)) byState.set(key, new Set());
    byState.get(key).add(lgaName);
  }
  return byState;
}

export function getLgaOptionsForState(index, stateName, extraValues = []) {
  // Return sorted LGA options for currently selected state.
  const key = normalizeKey(stateName);
  const options = index?.get(key)
    ? Array.from(index.get(key))
    : BASE_STATE_LGA_INDEX.get(key)
    ? Array.from(BASE_STATE_LGA_INDEX.get(key))
    : [];
  for (const extra of extraValues) {
    const value = String(extra || "").trim();
    if (!value) continue;
    if (!options.includes(value)) options.push(value);
  }
  if (!options.length && key) options.push("Other");
  return options.sort((a, b) => a.localeCompare(b));
}
