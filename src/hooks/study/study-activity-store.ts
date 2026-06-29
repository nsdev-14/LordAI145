/**
 * Local-first storage for study activities.
 * Uses same localStorage prefix as lord-store.ts ("lord:").
 */
import type { StudyActivity } from "./study-activity-types";

const ACTIVITY_KEY = "lord:study:activities";

function readAll(): StudyActivity[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(ACTIVITY_KEY);
    return raw ? (JSON.parse(raw) as StudyActivity[]) : [];
  } catch {
    return [];
  }
}

function writeAll(activities: StudyActivity[]) {
  if (typeof window === "undefined") return;
  localStorage.setItem(ACTIVITY_KEY, JSON.stringify(activities));
}

export const studyActivityStore = {
  /** Get all activities for a user, newest first */
  getByUser(userId: string): StudyActivity[] {
    return readAll()
      .filter((a) => a.userId === userId)
      .sort((a, b) => b.createdAt - a.createdAt);
  },

  /** Add a single activity */
  add(activity: StudyActivity) {
    const all = readAll();
    all.push(activity);
    writeAll(all);
  },

  /** Add multiple activities at once */
  addMany(activities: StudyActivity[]) {
    const all = readAll();
    all.push(...activities);
    writeAll(all);
  },

  /** Update an activity by id */
  update(id: string, patch: Partial<StudyActivity>) {
    const all = readAll();
    const idx = all.findIndex((a) => a.id === id);
    if (idx !== -1) {
      all[idx] = { ...all[idx], ...patch };
      writeAll(all);
    }
  },

  /** Delete an activity */
  delete(id: string) {
    const all = readAll().filter((a) => a.id !== id);
    writeAll(all);
  },

  /** Clear all activities for a user */
  clearUser(userId: string) {
    const all = readAll().filter((a) => a.userId !== userId);
    writeAll(all);
  },

  /** Get count of activities by type for a user */
  countByType(userId: string, type: string): number {
    return readAll().filter((a) => a.userId === userId && a.type === type).length;
  },

  /** Subscribe to changes — notifies on every write */
  _subscribers: new Set<() => void>(),
  subscribe(cb: () => void): () => void {
    studyActivityStore._subscribers.add(cb);
    return () => { studyActivityStore._subscribers.delete(cb); };
  },
  _notify() {
    studyActivityStore._subscribers.forEach((cb) => cb());
  },
};

// Patch write methods to notify subscribers
const origAdd = studyActivityStore.add.bind(studyActivityStore);
studyActivityStore.add = (activity) => {
  origAdd(activity);
  studyActivityStore._notify();
};

const origAddMany = studyActivityStore.addMany.bind(studyActivityStore);
studyActivityStore.addMany = (activities) => {
  origAddMany(activities);
  studyActivityStore._notify();
};

const origUpdate = studyActivityStore.update.bind(studyActivityStore);
studyActivityStore.update = (id, patch) => {
  origUpdate(id, patch);
  studyActivityStore._notify();
};
