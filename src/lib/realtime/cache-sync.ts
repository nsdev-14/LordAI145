/**
 * Realtime → React Query cache synchronizers.
 *
 * These are pure cache updaters invoked by the realtime listener. They follow
 * the spec's React Query integration rules:
 *   • Update cache via `queryClient.setQueryData(...)` — NEVER blanket
 *     `invalidateQueries`, which would refetch everything and cause flicker.
 *   • Touch ONLY the affected conversation list / message list.
 *   • Apply server-wins conflict resolution (prefer server timestamps,
 *     never let a stale local optimistic value overwrite a newer server row).
 *   • Debounce high-frequency UPDATE bursts (streaming tokens) so we don't
 *     thrash React.
 *   • Ignore self-originated echoes via `client_tag`.
 *
 * Everything here is framework-agnostic and side-effect free except for the
 * `setQueryData` calls. It is reused by both the conversation list and the
 * message list.
 */

import type { QueryClient } from "@tanstack/react-query";
import { isClientTagSelf } from "./client-tag";

export const conversationsQueryKey = (userId: string) => ["conversations", userId] as const;
export const messagesQueryKey = (conversationId: string | null) =>
  ["messages", conversationId] as const;

type AnyRow = Record<string, unknown>;

/** Stable ISO timestamp comparison; returns true if `incoming` is newer. */
function isNewer(incoming: AnyRow, existing: AnyRow): boolean {
  const a = incoming.updated_at ?? incoming.last_message_at ?? incoming.created_at;
  const b = existing.updated_at ?? existing.last_message_at ?? existing.created_at;
  if (!a) return true;
  if (!b) return true;
  return new Date(a as string).getTime() > new Date(b as string).getTime();
}

// ---------------------------------------------------------------------------
// Conversations list sync
// ---------------------------------------------------------------------------

export function applyConversationEvent(
  qc: QueryClient,
  userId: string,
  event: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: AnyRow | null; old: AnyRow | null },
): void {
  const key = conversationsQueryKey(userId);
  const tag = (event.new ?? event.old)?.["client_tag"];
  // Drop our own echoes.
  if (isClientTagSelf(tag as string | null | undefined)) return;

  qc.setQueryData<AnyRow[]>(key, (prev) => {
    const list = prev ? prev.slice() : [];

    if (event.eventType === "DELETE") {
      const id = event.old?.["id"] as string | undefined;
      if (!id) return list;
      return list.filter((c) => c.id !== id);
    }

    const row = event.new;
    if (!row) return list;
    const id = row.id as string;

    const idx = list.findIndex((c) => c.id === id);
    if (event.eventType === "INSERT") {
      if (idx >= 0) return list; // already present (idempotent)
      return [row, ...list];
    }

    // UPDATE: server-wins — only replace if the incoming row is newer, so a
    // delayed/stale echo cannot clobber a more recent local value.
    if (idx >= 0) {
      const existing = list[idx];
      if (isNewer(row, existing)) {
        list[idx] = { ...existing, ...row };
      }
      return list;
    }
    // UPDATE for a row we don't have yet (e.g. created elsewhere) → insert.
    return [row, ...list];
  });
}

// ---------------------------------------------------------------------------
// Messages list sync
// ---------------------------------------------------------------------------

// Debounce timers keyed by `${conversationId}:${messageId}` so streaming UPDATE
// bursts collapse into a single cache write per animation frame-ish window.
const debounceTimers = new Map<string, ReturnType<typeof setTimeout>>();
const DEBOUNCE_MS = 120;

export function applyMessageEvent(
  qc: QueryClient,
  conversationId: string,
  event: { eventType: "INSERT" | "UPDATE" | "DELETE"; new: AnyRow | null; old: AnyRow | null },
  opts?: { debounce?: boolean },
): void {
  const key = messagesQueryKey(conversationId);
  const tag = (event.new ?? event.old)?.["client_tag"];
  if (isClientTagSelf(tag as string | null | undefined)) return;

  const run = () => {
    qc.setQueryData<AnyRow[]>(key, (prev) => {
      const list = prev ? prev.slice() : [];

      if (event.eventType === "DELETE") {
        const id = event.old?.["id"] as string | undefined;
        if (!id) return list;
        return list.filter((m) => m.id !== id);
      }

      const row = event.new;
      if (!row) return list;
      const id = row.id as string;
      const idx = list.findIndex((m) => m.id === id);

      if (event.eventType === "INSERT") {
        if (idx >= 0) return list; // idempotent — never duplicate
        return [...list, row];
      }

      // UPDATE: streaming tokens arrive as UPDATEs on the same assistant row.
      // Server-wins: replace only when newer, so we never resurrect a stale
      // partial message over the live one.
      if (idx >= 0) {
        const existing = list[idx];
        if (isNewer(row, existing)) {
          list[idx] = { ...existing, ...row };
        }
        return list;
      }
      return [...list, row];
    });
  };

  if (opts?.debounce) {
    const dkey = `${conversationId}:${event.new?.["id"] ?? event.old?.["id"]}`;
    const existingTimer = debounceTimers.get(dkey);
    if (existingTimer) clearTimeout(existingTimer);
    debounceTimers.set(
      dkey,
      setTimeout(() => {
        debounceTimers.delete(dkey);
        run();
      }, DEBOUNCE_MS),
    );
  } else {
    run();
  }
}

/** Flush any pending debounced message writes for a conversation (e.g. on blur). */
export function flushMessageDebounce(conversationId: string): void {
  for (const [key, timer] of debounceTimers) {
    if (key.startsWith(`${conversationId}:`)) {
      clearTimeout(timer);
      debounceTimers.delete(key);
    }
  }
}
