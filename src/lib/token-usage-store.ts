import { useEffect, useState } from "react";

export interface TokenUsageEvent {
  requestId: string;
  model: string;
  mode: string;
  finishReason: string;
  inputTokens: number;
  outputTokens: number;
  reasoningTokens: number;
  cachedInputTokens: number;
  totalTokens: number;
  cost: number;
  timestamp: number;
}

export interface TokenUsageAverages {
  avgInput: number;
  avgOutput: number;
  avgTotal: number;
  totalCost: number;
  mostUsedModel: string | null;
  count: number;
}

const STORAGE_KEY = "lord:token-usage";
const MAX_HISTORY = 20;

function read(): TokenUsageEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as TokenUsageEvent[]) : [];
  } catch {
    return [];
  }
}

function write(events: TokenUsageEvent[]) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(events.slice(0, MAX_HISTORY)));
  } catch {
    /* ignore quota errors */
  }
}

type Listener = () => void;
const listeners = new Set<Listener>();
let cache: TokenUsageEvent[] = read();

function emit() {
  listeners.forEach((l) => l());
}

export const tokenUsageStore = {
  getHistory(): TokenUsageEvent[] {
    return cache;
  },
  getLatest(): TokenUsageEvent | null {
    return cache[0] ?? null;
  },
  record(event: TokenUsageEvent) {
    cache = [event, ...cache].slice(0, MAX_HISTORY);
    write(cache);
    emit();
  },
  clear() {
    cache = [];
    write(cache);
    emit();
  },
  subscribe(listener: Listener): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

export function computeAverages(history: TokenUsageEvent[]): TokenUsageAverages {
  if (history.length === 0) {
    return {
      avgInput: 0,
      avgOutput: 0,
      avgTotal: 0,
      totalCost: 0,
      mostUsedModel: null,
      count: 0,
    };
  }
  const sumInput = history.reduce((a, e) => a + e.inputTokens, 0);
  const sumOutput = history.reduce((a, e) => a + e.outputTokens, 0);
  const sumTotal = history.reduce((a, e) => a + e.totalTokens, 0);
  const totalCost = history.reduce((a, e) => a + e.cost, 0);
  const counts = new Map<string, number>();
  for (const e of history) counts.set(e.model, (counts.get(e.model) ?? 0) + 1);
  let mostUsedModel: string | null = null;
  let max = 0;
  for (const [model, c] of counts) {
    if (c > max) {
      max = c;
      mostUsedModel = model;
    }
  }
  return {
    avgInput: Math.round(sumInput / history.length),
    avgOutput: Math.round(sumOutput / history.length),
    avgTotal: Math.round(sumTotal / history.length),
    totalCost: Math.round(totalCost * 10000) / 10000,
    mostUsedModel,
    count: history.length,
  };
}

export function useTokenUsage() {
  const [history, setHistory] = useState<TokenUsageEvent[]>(() => tokenUsageStore.getHistory());

  useEffect(() => tokenUsageStore.subscribe(() => setHistory(tokenUsageStore.getHistory())), []);

  return {
    history,
    latest: history[0] ?? null,
    averages: computeAverages(history),
  };
}
