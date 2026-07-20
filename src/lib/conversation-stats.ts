/**
 * Conversation statistics — pure, framework-agnostic computation.
 *
 * The `conversations` / `messages` tables don't store derived metrics (tokens,
 * cost, response time, word counts), so everything here is *computed* from the
 * raw rows. All functions are kept side-effect free and allocation-light so
 * they can be safely wrapped in `useMemo` and re-run only when the underlying
 * data changes (no per-render recomputation).
 *
 * Token / cost estimation:
 *   - Tokens are estimated from words using a conservative ~1.33 tokens/word
 *     heuristic (English). This avoids a hard dependency on a tokenizer and is
 *     stable across the whole dataset.
 *   - Cost is estimated per-message with `estimateCost(model, inTokens, outTokens)`
 *     from `@/lib/model-cost`, where user prompts contribute input tokens and
 *     assistant replies contribute output tokens.
 */

import { estimateCost } from "@/lib/model-cost";

const WORDS_PER_TOKEN = 0.75; // 1 word ≈ 1.33 tokens

export interface RawConversation {
  id: string;
  title: string | null;
  created_at: string;
  updated_at: string;
  last_message_at: string | null;
}

export interface RawMessage {
  id: string;
  conversation_id: string;
  role: "user" | "assistant" | "system";
  content: string;
  model: string | null;
  created_at: string;
}

/** Per-conversation statistics (one row per conversation). */
export interface ConversationStat {
  id: string;
  title: string;
  totalMessages: number;
  totalPrompts: number;
  aiReplies: number;
  avgResponseTimeMs: number;
  totalWords: number;
  totalTokens: number;
  estimatedCost: number;
  createdAt: number;
  lastActive: number;
  /** Milliseconds between the conversation's first and last message. */
  durationMs: number;
}

/** Aggregate statistics across every conversation. */
export interface AggregateStats {
  totalConversations: number;
  totalMessages: number;
  totalPrompts: number;
  totalAiReplies: number;
  avgResponseTimeMs: number;
  totalWords: number;
  totalTokens: number;
  totalCost: number;
  firstActivity: number | null;
  lastActivity: number | null;
  /** Total span (ms) from first activity to last activity across all chats. */
  totalDurationMs: number;
  mostActiveDay: { date: string; label: string; count: number } | null;
}

export interface DayActivityPoint {
  /** ISO date (YYYY-MM-DD) in the user's local timezone. */
  date: string;
  /** Short label, e.g. "Mon 7/14". */
  label: string;
  messages: number;
  prompts: number;
  replies: number;
}

function countWords(text: string): number {
  if (!text) return 0;
  // Collapse whitespace and split; this is intentionally cheap (no regex replace).
  let count = 0;
  let inWord = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    const ws = ch === 32 || ch === 9 || ch === 10 || ch === 13;
    if (ws) {
      inWord = false;
    } else if (!inWord) {
      inWord = true;
      count++;
    }
  }
  return count;
}

function wordsToTokens(words: number): number {
  return Math.round(words / WORDS_PER_TOKEN);
}

/**
 * Compute full statistics for a single conversation from its (ordered) messages.
 *
 * @param conversation  the conversation row
 * @param messages      messages belonging to this conversation, ordered oldest→newest
 */
export function computeConversationStats(
  conversation: RawConversation,
  messages: RawMessage[],
): ConversationStat {
  let totalPrompts = 0;
  let aiReplies = 0;
  let totalWords = 0;

  // Response-time measurement: time between a user prompt and the assistant
  // reply that immediately follows it. We track the timestamp of the last user
  // message and accumulate deltas once we see the next assistant message.
  let pendingUserAt: number | null = null;
  let responseTimeSum = 0;
  let responseTimeCount = 0;

  let firstMessageAt: number | null = null;
  let lastMessageAt: number | null = null;

  for (const m of messages) {
    const ts = new Date(m.created_at).getTime();
    if (firstMessageAt === null) firstMessageAt = ts;
    lastMessageAt = ts;

    const words = countWords(m.content);
    totalWords += words;

    if (m.role === "user") {
      totalPrompts++;
      pendingUserAt = ts;
    } else if (m.role === "assistant") {
      aiReplies++;
      if (pendingUserAt !== null) {
        const delta = ts - pendingUserAt;
        if (delta >= 0) {
          responseTimeSum += delta;
          responseTimeCount++;
        }
        pendingUserAt = null;
      }
    }
  }

  const createdAt = new Date(conversation.created_at).getTime();
  const lastActive = conversation.last_message_at
    ? new Date(conversation.last_message_at).getTime()
    : (lastMessageAt ?? createdAt);
  const durationMs =
    firstMessageAt !== null && lastMessageAt !== null
      ? Math.max(0, lastMessageAt - firstMessageAt)
      : 0;

  // Recompute cost with the full per-message model breakdown (accumulated).
  let estimatedCost = 0;
  let totalTokens = 0;
  for (const m of messages) {
    if (m.role === "user" || m.role === "assistant") {
      const tokens = wordsToTokens(countWords(m.content));
      const inputTokens = m.role === "user" ? tokens : 0;
      const outputTokens = m.role === "user" ? 0 : tokens;
      estimatedCost += estimateCost(m.model ?? "local", inputTokens, outputTokens);
      totalTokens += tokens;
    }
  }

  return {
    id: conversation.id,
    title: conversation.title ?? "Untitled conversation",
    totalMessages: messages.length,
    totalPrompts,
    aiReplies,
    avgResponseTimeMs: responseTimeCount > 0 ? Math.round(responseTimeSum / responseTimeCount) : 0,
    totalWords,
    totalTokens,
    estimatedCost: Math.round(estimatedCost * 10000) / 10000,
    createdAt,
    lastActive,
    durationMs,
  };
}

/**
 * Group messages by conversation id (single O(n) pass). Returns a Map keyed by
 * conversation id → messages ordered oldest→newest.
 */
export function groupMessagesByConversation(messages: RawMessage[]): Map<string, RawMessage[]> {
  const map = new Map<string, RawMessage[]>();
  for (const m of messages) {
    const bucket = map.get(m.conversation_id);
    if (bucket) bucket.push(m);
    else map.set(m.conversation_id, [m]);
  }
  // Stabilize ordering by created_at then id so response-time deltas are correct.
  for (const bucket of map.values()) {
    bucket.sort((a, b) => {
      const ta = new Date(a.created_at).getTime();
      const tb = new Date(b.created_at).getTime();
      if (ta !== tb) return ta - tb;
      return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
    });
  }
  return map;
}

/**
 * Build per-conversation stats for every conversation.
 * Pure: given the same inputs it always returns the same output.
 */
export function computeAllConversationStats(
  conversations: RawConversation[],
  messages: RawMessage[],
): ConversationStat[] {
  const byConv = groupMessagesByConversation(messages);
  return conversations.map((c) => computeConversationStats(c, byConv.get(c.id) ?? []));
}

/**
 * Aggregate the per-conversation stats into a single summary, and derive the
 * activity series (per-day message counts) plus the most active day.
 * Pure function — memoize the result.
 */
export function aggregateStats(
  conversations: RawConversation[],
  messages: RawMessage[],
): { aggregate: AggregateStats; dayActivity: DayActivityPoint[] } {
  const perConv = computeAllConversationStats(conversations, messages);

  let totalMessages = 0;
  let totalPrompts = 0;
  let totalAiReplies = 0;
  let totalWords = 0;
  let totalTokens = 0;
  let totalCost = 0;
  let responseTimeSum = 0;
  let responseTimeCount = 0;
  let firstActivity: number | null = null;
  let lastActivity: number | null = null;

  for (const s of perConv) {
    totalMessages += s.totalMessages;
    totalPrompts += s.totalPrompts;
    totalAiReplies += s.aiReplies;
    totalWords += s.totalWords;
    totalTokens += s.totalTokens;
    totalCost += s.estimatedCost;
    responseTimeSum += s.avgResponseTimeMs;
    responseTimeCount += s.avgResponseTimeMs > 0 ? 1 : 0;
    if (s.createdAt && (firstActivity === null || s.createdAt < firstActivity))
      firstActivity = s.createdAt;
    if (s.lastActive && (lastActivity === null || s.lastActive > lastActivity))
      lastActivity = s.lastActive;
  }

  // Per-day activity (local timezone).
  const dayMap = new Map<
    string,
    { messages: number; prompts: number; replies: number; ts: number }
  >();
  for (const m of messages) {
    const d = new Date(m.created_at);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
      d.getDate(),
    ).padStart(2, "0")}`;
    const entry = dayMap.get(key) ?? { messages: 0, prompts: 0, replies: 0, ts: d.getTime() };
    entry.messages++;
    if (m.role === "user") entry.prompts++;
    else if (m.role === "assistant") entry.replies++;
    dayMap.set(key, entry);
  }

  const dayActivity: DayActivityPoint[] = Array.from(dayMap.entries())
    .sort((a, b) => a[1].ts - b[1].ts)
    .map(([date, e]) => ({
      date,
      label: new Date(e.ts).toLocaleDateString(undefined, {
        weekday: "short",
        month: "numeric",
        day: "numeric",
      }),
      messages: e.messages,
      prompts: e.prompts,
      replies: e.replies,
    }));

  let mostActiveDay: AggregateStats["mostActiveDay"] = null;
  for (const point of dayActivity) {
    if (!mostActiveDay || point.messages > mostActiveDay.count) {
      mostActiveDay = { date: point.date, label: point.label, count: point.messages };
    }
  }

  const aggregate: AggregateStats = {
    totalConversations: conversations.length,
    totalMessages,
    totalPrompts,
    totalAiReplies,
    avgResponseTimeMs: responseTimeCount > 0 ? Math.round(responseTimeSum / responseTimeCount) : 0,
    totalWords,
    totalTokens,
    totalCost: Math.round(totalCost * 10000) / 10000,
    firstActivity,
    lastActivity,
    totalDurationMs:
      firstActivity !== null && lastActivity !== null
        ? Math.max(0, lastActivity - firstActivity)
        : 0,
    mostActiveDay,
  };

  return { aggregate, dayActivity };
}
