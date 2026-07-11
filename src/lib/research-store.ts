import { useSyncExternalStore } from "react";
import { store, uid } from "@/lib/lord-store";
import { emitDashboardEvent } from "@/lib/dashboard-service";
import type { DashboardResearchSession } from "@/lib/dashboard-service";

const KEY = "research-sessions";

let cache: DashboardResearchSession[] =
  typeof window !== "undefined" ? store.get<DashboardResearchSession[]>(KEY, []) : [];
const listeners = new Set<() => void>();

function persist(next: DashboardResearchSession[]) {
  cache = next;
  if (typeof window !== "undefined") store.set(KEY, next);
  listeners.forEach((l) => l());
  emitDashboardEvent("research");
}

export function getResearchSessions(): DashboardResearchSession[] {
  return cache;
}

export function startResearchSession(title: string): DashboardResearchSession {
  const session: DashboardResearchSession = {
    id: uid(),
    title: title.trim() || "Untitled research",
    status: "running",
    documents: 0,
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  persist([session, ...cache]);
  return session;
}

export function completeResearchSession(id: string) {
  persist(
    cache.map((s) => (s.id === id ? { ...s, status: "completed", updatedAt: Date.now() } : s)),
  );
}

export function addDocumentToSession(id: string) {
  persist(
    cache.map((s) =>
      s.id === id ? { ...s, documents: s.documents + 1, updatedAt: Date.now() } : s,
    ),
  );
}

export function removeResearchSession(id: string) {
  persist(cache.filter((s) => s.id !== id));
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  if (typeof window !== "undefined") {
    window.addEventListener("storage", (e) => {
      if (e.key === `lord:${KEY}`) cb();
    });
  }
  return () => listeners.delete(cb);
}

export function useResearchSessions(): DashboardResearchSession[] {
  return useSyncExternalStore(subscribe, getResearchSessions, getResearchSessions);
}
