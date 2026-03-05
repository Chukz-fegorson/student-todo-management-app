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

function splitSentences(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((entry) => entry.trim())
    .filter((entry) => entry.length >= 10);
}

function tokenize(text) {
  return String(text || "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((word) => word && !STOP_WORDS.has(word) && word.length > 2);
}

function sentenceScores(sentences) {
  const frequency = new Map();

  for (const sentence of sentences) {
    for (const word of tokenize(sentence)) {
      frequency.set(word, (frequency.get(word) || 0) + 1);
    }
  }

  return sentences.map((sentence) => {
    const words = tokenize(sentence);
    const score = words.reduce((sum, word) => sum + (frequency.get(word) || 0), 0);
    return {
      sentence,
      score: words.length ? score / words.length : 0,
    };
  });
}

function normalizeBullet(value) {
  return String(value || "")
    .replace(/\s+/g, " ")
    .replace(/^[-*\d.)\s]+/, "")
    .trim();
}

function extractTodos(sentences) {
  const todoPattern =
    /\b(todo|action|follow up|next step|owner|assign|deadline|due|review|prepare|submit|deliver|implement)\b/i;

  return sentences
    .filter((sentence) => todoPattern.test(sentence))
    .map((sentence) => normalizeBullet(sentence))
    .filter(Boolean)
    .slice(0, 8);
}

function extractActionPlan(todoItems) {
  return todoItems.slice(0, 8).map((entry) => {
    const ownerMatch = entry.match(
      /^([A-Z][a-z]+(?:\s[A-Z][a-z]+){0,2})\s+(will|to)\s+/i
    );
    const dueMatch = entry.match(/\bby\s+([A-Za-z0-9,\-\s]{2,40})$/i);

    return {
      owner: ownerMatch ? ownerMatch[1] : "Unassigned",
      action: entry,
      due: dueMatch ? dueMatch[1].trim() : "Not specified",
    };
  });
}

export function generateMeetingSummary(transcript) {
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
  const scored = sentenceScores(sentences)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5)
    .map((entry) => entry.sentence);

  const todos = extractTodos(sentences);
  const actionPlan = extractActionPlan(todos);

  const summaryText = scored.length
    ? scored.slice(0, 2).join(" ")
    : sentences.slice(0, 2).join(" ");

  return {
    summaryText,
    keyPoints: scored,
    todos,
    actionPlan,
    generatedAt: new Date().toISOString(),
  };
}
