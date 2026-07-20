// Lightweight, dependency-free conversation title generator.
//
// Produces a short (<= 5 word) ChatGPT-style title from the first meaningful
// user prompt. Used only to upgrade a freshly-created conversation whose title
// is still a default placeholder ("Untitled", "New Chat", or empty).

const DEFAULT_TITLES: ReadonlySet<string> = new Set(["", "untitled", "new chat", "new conversation"]);

const GREETING_WORDS: ReadonlySet<string> = new Set([
  "hi",
  "hello",
  "hey",
  "hiya",
  "yo",
  "sup",
  "thanks",
  "thank",
  "thx",
  "ok",
  "okay",
  "k",
  "cool",
  "nice",
  "sure",
  "please",
]);

const MAX_TITLE_WORDS = 5;

function normalize(text: string): string {
  return text
    .replace(/```[\s\S]*?```/g, " ")
    .replace(/`[^`]*`/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\[([^\]]*)\]\([^)]*\)/g, "$1")
    .replace(/[#>*_~`-]/g, " ")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function isDefaultTitle(title: string): boolean {
  return DEFAULT_TITLES.has(title.trim().toLowerCase());
}

function capitalizeTitle(title: string): string {
  const upper = title.charAt(0).toUpperCase() + title.slice(1);
  return upper.replace(/\b(A|An|The|To|Of|For|And|Or|In|On|With)\b/g, (m) => m.toLowerCase());
}

/**
 * Generate a concise title from the first meaningful user prompt.
 * Returns `null` when the prompt is only a greeting/punctuation (so the caller
 * can keep the default title and retry on the next real prompt).
 */
export function generateChatTitle(prompt: string): string | null {
  const normalized = normalize(prompt);
  if (!normalized) return null;

  const words = normalized.split(" ");
  const meaningful = words.filter((word) => !GREETING_WORDS.has(word.toLowerCase()));
  const source = meaningful.length > 0 ? meaningful : words;
  if (source.length === 0) return null;

  const finalWords = source.slice(0, MAX_TITLE_WORDS);
  const title = capitalizeTitle(finalWords.join(" "));
  return title.length > 0 ? title : null;
}

/**
 * Whether a stored conversation title is still a default placeholder and thus
 * eligible for automatic generation. A previously renamed conversation is
 * never overwritten.
 */
export function shouldGenerateTitle(storedTitle: string | null | undefined): boolean {
  if (storedTitle === null || storedTitle === undefined) return true;
  return isDefaultTitle(storedTitle);
}
