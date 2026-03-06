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

function normalizeKey(value) {
  return String(value || "").trim().toLowerCase();
}

export function buildStateLgaIndex(rows = []) {
  const byState = new Map();
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
  const key = normalizeKey(stateName);
  const options = index?.get(key) ? Array.from(index.get(key)) : [];
  for (const extra of extraValues) {
    const value = String(extra || "").trim();
    if (!value) continue;
    if (!options.includes(value)) options.push(value);
  }
  if (!options.length && key) options.push("Other");
  return options.sort((a, b) => a.localeCompare(b));
}
