/**
 * Local persistence layer for LORD AI OS.
 * Single-user app — everything lives in localStorage with typed helpers.
 * (Can be swapped for Firestore later without changing call sites.)
 */

const PREFIX = "lord:";

function read<T>(key: string, fallback: T): T {
  if (typeof window === "undefined") return fallback;
  try {
    const raw = localStorage.getItem(PREFIX + key);
    return raw ? (JSON.parse(raw) as T) : fallback;
  } catch {
    return fallback;
  }
}

function write<T>(key: string, value: T) {
  if (typeof window === "undefined") return;
  localStorage.setItem(PREFIX + key, JSON.stringify(value));
}

export const store = {
  get: read,
  set: write,
  remove(key: string) {
    if (typeof window === "undefined") return;
    localStorage.removeItem(PREFIX + key);
  },
};

// ---------- Domain types ----------

export interface Memory {
  id: string;
  content: string;
  category: "goal" | "preference" | "fact" | "project" | "note";
  createdAt: number;
  pinned?: boolean;
}

export interface Task {
  id: string;
  title: string;
  done: boolean;
  priority: "low" | "med" | "high";
  due?: string;
  createdAt: number;
}

export interface Goal {
  id: string;
  title: string;
  description?: string;
  progress: number; // 0-100
  createdAt: number;
}

export interface KnowledgeNote {
  id: string;
  title: string;
  body: string;
  tags: string[];
  updatedAt: number;
}

export interface Conversation {
  id: string;
  title: string;
  updatedAt: number;
  messages: Array<{ id: string; role: "user" | "assistant"; content: string }>;
}

export const uid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : Math.random().toString(36).slice(2) + Date.now().toString(36);
