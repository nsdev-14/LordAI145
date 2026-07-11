import { useSyncExternalStore } from "react";
import { store, uid, type Task } from "@/lib/lord-store";
import { emitDashboardEvent } from "@/lib/dashboard-service";

const KEY = "tasks";

let cache: Task[] = typeof window !== "undefined" ? store.get<Task[]>(KEY, []) : [];
const listeners = new Set<() => void>();

function persist(next: Task[]) {
  cache = next;
  if (typeof window !== "undefined") store.set(KEY, next);
  listeners.forEach((l) => l());
  emitDashboardEvent("tasks");
}

export function getTasks(): Task[] {
  return cache;
}

export function addTask(input: { title: string; priority?: Task["priority"]; due?: string }): Task {
  const task: Task = {
    id: uid(),
    title: input.title.trim(),
    done: false,
    priority: input.priority ?? "med",
    due: input.due,
    createdAt: Date.now(),
  };
  persist([task, ...cache]);
  return task;
}

export function toggleTask(id: string) {
  persist(cache.map((t) => (t.id === id ? { ...t, done: !t.done } : t)));
}

export function updateTask(id: string, patch: Partial<Task>) {
  persist(cache.map((t) => (t.id === id ? { ...t, ...patch } : t)));
}

export function removeTask(id: string) {
  persist(cache.filter((t) => t.id !== id));
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

export function useTasks(): Task[] {
  return useSyncExternalStore(subscribe, getTasks, getTasks);
}
