const STOP_WORDS = new Set([
  "a",
  "about",
  "after",
  "all",
  "also",
  "an",
  "and",
  "any",
  "are",
  "as",
  "at",
  "be",
  "been",
  "but",
  "by",
  "can",
  "could",
  "did",
  "do",
  "for",
  "from",
  "had",
  "has",
  "have",
  "if",
  "in",
  "into",
  "is",
  "it",
  "its",
  "may",
  "might",
  "more",
  "most",
  "of",
  "on",
  "or",
  "our",
  "should",
  "that",
  "the",
  "their",
  "them",
  "there",
  "they",
  "this",
  "to",
  "up",
  "was",
  "we",
  "were",
  "what",
  "when",
  "which",
  "who",
  "will",
  "with",
  "would",
  "you",
  "your",
]);

const ACTION_KEYWORD_PATTERN =
  /\b(todo|action|follow up|next step|owner|assign|deadline|due|review|prepare|submit|deliver|implement|schedule|update|complete|finalize)\b/i;
const DECISION_PATTERN =
  /\b(decide|decision|agreed|approved|resolved|concluded|align(?:ed)? on)\b/i;
const DUE_PATTERN =
  /\b(by|before|due|deadline|today|tomorrow|tonight|this week|next week|eod|end of day)\b/i;
const URGENT_PATTERN =
  /\b(asap|urgent|immediately|today|tonight|now|eod|end of day)\b/i;
const MEDIUM_URGENCY_PATTERN = /\b(tomorrow|this week|next week|before)\b/i;

const ACTION_VERBS = [
  "review",
  "prepare",
  "submit",
  "deliver",
  "implement",
  "assign",
  "schedule",
  "update",
  "finalize",
  "complete",
  "upload",
  "publish",
  "share",
  "send",
  "draft",
  "plan",
  "confirm",
  "fix",
  "test",
  "investigate",
  "sync",
  "document",
  "create",
  "compile",
  "refactor",
  "validate",
  "approve",
  "check",
];

function splitSentences(text) {
  // Split transcript into sentence-like chunks while preserving bullet/newline actions.
  return String(text || "")
    .replace(/\r/g, "\n")
    .split(/\n+/)
    .flatMap((chunk) =>
      String(chunk || "")
        .replace(/\s+/g, " ")
        .split(/(?<=[.!?])\s+/)
    )
    .map((entry) => normalizeBullet(entry))
    .filter((entry) => entry.length >= 10);
}

function normalizeBullet(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[-*#>\d.)\s]+/, "")
    .trim();
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word) && word.length > 2);
}

function tokenSet(text) {
  return new Set(tokenize(text));
}

function jaccardSimilarity(aSet, bSet) {
  const union = new Set([...aSet, ...bSet]);
  if (!union.size) return 0;
  let intersection = 0;
  for (const token of aSet) {
    if (bSet.has(token)) intersection += 1;
  }
  return intersection / union.size;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function sentenceScores(sentences) {
  // Frequency + intent boosts keeps summary focused on outcomes and decisions.
  const frequency = new Map();
  for (const sentence of sentences) {
    for (const word of tokenize(sentence)) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return sentences.map((sentence) => {
    const words = tokenize(sentence);
    const lexical = words.reduce((sum, word) => sum + (frequency.get(word) || 0), 0);
    const normalizedLexical = words.length ? lexical / Math.sqrt(words.length) : 0;
    const actionBoost = ACTION_KEYWORD_PATTERN.test(sentence) ? 1.25 : 0;
    const decisionBoost = DECISION_PATTERN.test(sentence) ? 0.95 : 0;
    const dueBoost = DUE_PATTERN.test(sentence) ? 0.8 : 0;
    return {
      sentence,
      score: normalizedLexical + actionBoost + decisionBoost + dueBoost,
    };
  });
}

function pickDiverseSentences(scoredSentences, limit = 5) {
  const selected = [];
  const selectedSets = [];

  for (const entry of scoredSentences) {
    const current = tokenSet(entry.sentence);
    if (!current.size) continue;
    const isDuplicate = selectedSets.some(
      (existing) => jaccardSimilarity(existing, current) >= 0.68
    );
    if (isDuplicate) continue;
    selected.push(entry.sentence);
    selectedSets.push(current);
    if (selected.length >= limit) break;
  }

  return selected;
}

function extractOwner(sentence) {
  const namedOwnerPattern =
    /(?:owner|assignee|assigned to)\s*[:\-]\s*([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})/i;
  const leadingOwnerPattern =
    /^([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\s+(will|should|must|to|needs to)\b/i;
  const inlineOwnerPattern =
    /\b([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\s+(will|should|must|to|needs to)\b/i;

  const named = sentence.match(namedOwnerPattern);
  if (named?.[1]) return named[1].trim();

  const leading = sentence.match(leadingOwnerPattern);
  if (leading?.[1]) return leading[1].trim();

  const inline = sentence.match(inlineOwnerPattern);
  if (inline?.[1]) return inline[1].trim();

  if (/\bwe\b/i.test(sentence)) return "Team";
  return "Unassigned";
}

function extractDue(sentence) {
  const dueMatch = sentence.match(
    /\b(?:by|before|on|due)\s+([A-Za-z0-9,\-/: ]{2,40})(?=$|[.;])/i
  );
  if (dueMatch?.[1]) return dueMatch[1].trim();
  if (/\btoday\b/i.test(sentence)) return "Today";
  if (/\btomorrow\b/i.test(sentence)) return "Tomorrow";
  if (/\bthis week\b/i.test(sentence)) return "This week";
  if (/\bnext week\b/i.test(sentence)) return "Next week";
  if (/\beod\b|\bend of day\b/i.test(sentence)) return "End of day";
  return "Not specified";
}

function extractAction(sentence) {
  // Keep only concrete action phrase and cut off trailing due clause.
  const lowered = sentence.toLowerCase();
  let bestIndex = -1;
  let matchedVerb = "";
  for (const verb of ACTION_VERBS) {
    const idx = lowered.indexOf(`${verb} `);
    if (idx !== -1 && (bestIndex === -1 || idx < bestIndex)) {
      bestIndex = idx;
      matchedVerb = verb;
    }
    if (lowered.endsWith(verb) && (bestIndex === -1 || lowered.length - verb.length < bestIndex)) {
      bestIndex = lowered.length - verb.length;
      matchedVerb = verb;
    }
  }

  if (bestIndex === -1) return "";
  const phrase = sentence.slice(bestIndex).replace(
    /\s+\b(by|before|on|due)\b[\s\S]*$/i,
    ""
  );
  const cleaned = normalizeBullet(phrase);
  if (!cleaned) return "";

  const tokens = cleaned.split(/\s+/).filter(Boolean);
  if (tokens.length < 2) return "";
  if (
    (matchedVerb === "check" || matchedVerb === "review") &&
    tokens.length < 4 &&
    !/\b(report|task|document|assignment|submission|plan|draft)\b/i.test(cleaned)
  ) {
    return "";
  }
  return cleaned;
}

function inferOutcome(sentence, action) {
  const explicitOutcome = sentence.match(/\b(?:so that|to)\s+(.{5,90})$/i);
  if (explicitOutcome?.[1]) return normalizeBullet(explicitOutcome[1]).slice(0, 110);

  const verb = action.split(/\s+/)[0]?.toLowerCase() || "";
  const outcomes = {
    submit: "Submission completed",
    review: "Review completed",
    prepare: "Preparation completed",
    deliver: "Delivery completed",
    implement: "Implementation completed",
    schedule: "Schedule confirmed",
    update: "Update completed",
    finalize: "Finalized deliverable",
    complete: "Completed deliverable",
    upload: "File uploaded",
    publish: "Item published",
    share: "Update shared",
    send: "Message sent",
    draft: "Draft completed",
    plan: "Plan prepared",
    confirm: "Confirmation recorded",
    fix: "Issue resolved",
    test: "Validation completed",
    investigate: "Findings documented",
    sync: "Items synchronized",
    document: "Documentation updated",
    create: "Artifact created",
    compile: "Report compiled",
    refactor: "Refactor completed",
    validate: "Validation completed",
    approve: "Approval completed",
    assign: "Ownership assigned",
    check: "Verification completed",
  };
  return outcomes[verb] || "Action completed";
}

function urgencyScore(sentence, due) {
  if (URGENT_PATTERN.test(sentence) || /today|tonight|end of day/i.test(due)) return 3;
  if (MEDIUM_URGENCY_PATTERN.test(sentence) || /tomorrow|this week|next week/i.test(due))
    return 2;
  if (DUE_PATTERN.test(sentence) || due !== "Not specified") return 1;
  return 0;
}

function urgencyLabel(score) {
  if (score >= 3) return "High";
  if (score >= 2) return "Medium";
  return "Low";
}

function confidenceScore(owner, due, action, sentence) {
  let score = 0.2;
  if (owner !== "Unassigned") score += 0.24;
  if (due !== "Not specified") score += 0.24;
  if (action.split(/\s+/).length >= 3) score += 0.2;
  if (ACTION_KEYWORD_PATTERN.test(sentence)) score += 0.16;
  if (!/\b(maybe|later|sometime|thing|stuff)\b/i.test(sentence)) score += 0.1;
  return Number(clamp(score, 0.15, 0.99).toFixed(2));
}

function normalizeTodoTitle(owner, action) {
  const prefix = owner && owner !== "Unassigned" ? `${owner}: ` : "";
  return `${prefix}${action}`.replace(/\s+/g, " ").trim().slice(0, 220);
}

function buildActionCandidates(sentences) {
  const candidates = [];
  for (const sentence of sentences) {
    const clean = normalizeBullet(sentence);
    if (!clean) continue;
    if (
      !ACTION_KEYWORD_PATTERN.test(clean) &&
      !/\b(will|should|must|needs to|need to)\b/i.test(clean)
    ) {
      continue;
    }

    const owner = extractOwner(clean);
    const due = extractDue(clean);
    const action = extractAction(clean);
    if (!action) continue;

    const outcome = inferOutcome(clean, action);
    const urgency = urgencyScore(clean, due);
    const confidence = confidenceScore(owner, due, action, clean);
    const title = normalizeTodoTitle(owner, action);
    if (title.length < 8) continue;

    candidates.push({
      rawSentence: clean,
      owner,
      action,
      due,
      outcome,
      urgency,
      urgencyLabel: urgencyLabel(urgency),
      confidence,
      title,
      keySet: tokenSet(`${owner} ${action}`),
    });
  }

  // Deduplicate near-duplicate actions and keep highest-signal candidates.
  const ranked = candidates.sort((a, b) => {
    if (b.urgency !== a.urgency) return b.urgency - a.urgency;
    if (b.confidence !== a.confidence) return b.confidence - a.confidence;
    return b.action.length - a.action.length;
  });

  const deduped = [];
  const selectedSets = [];
  for (const candidate of ranked) {
    if (!candidate.keySet.size) continue;
    const duplicate = selectedSets.some(
      (existing) => jaccardSimilarity(existing, candidate.keySet) >= 0.74
    );
    if (duplicate) continue;
    deduped.push(candidate);
    selectedSets.push(candidate.keySet);
    if (deduped.length >= 8) break;
  }

  return deduped;
}

export function generateMeetingSummary(transcript) {
  // Local, zero-cost summary pipeline with structured action extraction.
  const text = String(transcript || "").trim();
  if (!text) {
    return {
      summaryText: "No transcript content available yet.",
      keyPoints: [],
      todos: [],
      actionPlan: [],
      generatedAt: new Date().toISOString(),
    };
  }

  const sentences = splitSentences(text);
  const scoredSentences = sentenceScores(sentences).sort((a, b) => b.score - a.score);
  const keyPoints = pickDiverseSentences(scoredSentences, 5);
  const actionCandidates = buildActionCandidates(sentences);

  const summaryText = keyPoints.length
    ? keyPoints.slice(0, 2).join(" ")
    : sentences.slice(0, 2).join(" ");

  return {
    summaryText,
    keyPoints,
    todos: actionCandidates.map((entry) => entry.title),
    actionPlan: actionCandidates.map((entry) => ({
      owner: entry.owner,
      action: entry.action,
      due: entry.due,
      outcome: entry.outcome,
      urgency: entry.urgencyLabel,
      confidence: entry.confidence,
    })),
    generatedAt: new Date().toISOString(),
  };
}
