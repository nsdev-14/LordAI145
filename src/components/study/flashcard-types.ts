/**
 * Flashcard types for the premium Flashcard Study experience.
 * No routing changes, no business logic changes — pure UI redesign.
 */

export interface FlashcardCard {
  id: string;
  question: string;
  answer: string;
  explanation?: string;
  realWorldExample?: string;
  memoryTip?: string;
  relatedConcepts?: string[];
  masteryLevel: number; // 0–100 based on spaced repetition
}

export interface FlashcardDeck {
  id: string;
  title: string;
  subject: string;
  difficulty: string;
  estimatedMinutes: number;
  cards: FlashcardCard[];
  createdAt: number;
}

export interface CardMastery {
  deckId: string;
  cardId: string;
  level: number; // 0 | 40 | 80 | 100
  lastReviewed: number;
  reviewCount: number;
}

export const MASTERY_LEVELS = {
  again: 0,
  hard: 40,
  good: 80,
  easy: 100,
} as const;

export type Rating = keyof typeof MASTERY_LEVELS;

const STORAGE_KEY_DECKS = "lord:flashcard:decks";
const STORAGE_KEY_MASTERY = "lord:flashcard:mastery";

/* ─── LocalStorage helpers ────────────────────────────────── */

export function saveDeck(deck: FlashcardDeck) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DECKS);
    const decks: FlashcardDeck[] = raw ? JSON.parse(raw) : [];
    const idx = decks.findIndex((d) => d.id === deck.id);
    if (idx >= 0) decks[idx] = deck;
    else decks.unshift(deck);
    localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(decks));
  } catch { /* ignore */ }
}

export function loadDecks(): FlashcardDeck[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_DECKS);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function loadDeck(id: string): FlashcardDeck | null {
  return loadDecks().find((d) => d.id === id) ?? null;
}

export function deleteDeck(id: string) {
  try {
    const decks = loadDecks().filter((d) => d.id !== id);
    localStorage.setItem(STORAGE_KEY_DECKS, JSON.stringify(decks));
    const mastery = loadMastery().filter((m) => m.deckId !== id);
    localStorage.setItem(STORAGE_KEY_MASTERY, JSON.stringify(mastery));
  } catch { /* ignore */ }
}

export function saveMastery(record: CardMastery) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MASTERY);
    const mastery: CardMastery[] = raw ? JSON.parse(raw) : [];
    const idx = mastery.findIndex(
      (m) => m.deckId === record.deckId && m.cardId === record.cardId
    );
    if (idx >= 0) mastery[idx] = record;
    else mastery.push(record);
    localStorage.setItem(STORAGE_KEY_MASTERY, JSON.stringify(mastery));
  } catch { /* ignore */ }
}

export function loadMastery(): CardMastery[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_MASTERY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export function getMasteryForDeck(deckId: string): CardMastery[] {
  return loadMastery().filter((m) => m.deckId === deckId);
}

/* ─── AI output parser ────────────────────────────────────── */

export function parseFlashcardsFromAI(raw: string): FlashcardCard[] {
  const cards: FlashcardCard[] = [];
  const lines = raw.split("\n").map((l) => l.trim()).filter(Boolean);

  let currentQ = "";
  let currentA = "";
  let currentExplanation = "";
  let currentExample = "";
  let currentMemoryTip = "";
  let currentRelated: string[] = [];
  let expectAnswer = false;
  let expectQuestion = true;

  for (const line of lines) {
    // Q: …
    const qMatch = line.match(/^(?:\*\*)?Q\d*[.)]?\s*:?\s*\*?\*?(.+)/i);
    if (qMatch && line.length > 3) {
      // Save previous Q/A pair
      if (currentQ && currentA) {
        cards.push(makeCard(currentQ, currentA, currentExplanation, currentExample, currentMemoryTip, currentRelated));
        currentExplanation = "";
        currentExample = "";
        currentMemoryTip = "";
        currentRelated = [];
      }
      currentQ = qMatch[1].replace(/\*\*/g, "").trim();
      currentA = "";
      expectAnswer = true;
      expectQuestion = false;
      continue;
    }

    // A: …
    const aMatch = line.match(/^(?:\*\*)?A\d*[.)]?\s*:?\s*\*?\*?(.+)/i);
    if (aMatch && expectAnswer && line.length > 3) {
      currentA = aMatch[1].replace(/\*\*/g, "").trim();
      expectAnswer = false;
      expectQuestion = false;
      continue;
    }

    // Explanation / Why
    if (currentA && /Explanation|explain|why\s(you|i|missed|got)/i.test(line.slice(0, 20))) {
      const val = line.replace(/^(?:\*\*)?(?:Explanation|Why you missed|Why)\s*:?\s*\*?\*?/i, "").trim();
      if (val) currentExplanation = val;
      continue;
    }

    // Real-world example
    if (currentA && /real.?world|example|application/i.test(line.slice(0, 20))) {
      const val = line.replace(/^(?:\*\*)?(?:Real.?world|Example|Application)\s*:?\s*\*?\*?/i, "").trim();
      if (val) currentExample = val;
      continue;
    }

    // Memory tip / mnemonic
    if (currentA && /memory|mnemonic|tip/i.test(line.slice(0, 20))) {
      const val = line.replace(/^(?:\*\*)?(?:Memory|Mnemonic|Tip)\s*:?\s*\*?\*?/i, "").trim();
      if (val) currentMemoryTip = val;
      continue;
    }

    // Related concepts
    if (currentA && /related|concept|also|see/i.test(line.slice(0, 15))) {
      const val = line.replace(/^(?:\*\*)?(?:Related|Concepts|See also|Also)\s*:?\s*\*?\*?/i, "").trim();
      if (val) currentRelated = val.split(",").map((s) => s.trim()).filter(Boolean);
      continue;
    }
  }

  // Push last pair
  if (currentQ && currentA) {
    cards.push(makeCard(currentQ, currentA, currentExplanation, currentExample, currentMemoryTip, currentRelated));
  }

  return cards;
}

function makeCard(
  q: string,
  a: string,
  explanation: string,
  example: string,
  memoryTip: string,
  related: string[],
): FlashcardCard {
  return {
    id: crypto.randomUUID(),
    question: q.replace(/^[""]|[""]$/g, "").trim(),
    answer: a.replace(/^[""]|[""]$/g, "").trim(),
    explanation: explanation || undefined,
    realWorldExample: example || undefined,
    memoryTip: memoryTip || undefined,
    relatedConcepts: related.length > 0 ? related : undefined,
    masteryLevel: 0,
  };
}
