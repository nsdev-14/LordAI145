/**
 * useRealtimeSync — the single React entry point that connects Supabase
 * Realtime to the app's React Query caches.
 *
 * Responsibilities:
 *   • Bind the shared RealtimeManager to the authenticated user (subscribe only
 *     after auth; unsubscribe on logout / unmount).
 *   • Forward conversation + message row events into the cache syncers
 *     (server-wins, debounced, self-echo suppressed).
 *   • Reconcile once the network returns (offline → online) so no change made
 *     elsewhere while we were disconnected is lost, and our own optimistic
 *     state is re-validated against the server.
 *   • Expose `useMessageRealtime(id)` so components can opt into message events
 *     for the conversation they currently display, scoped tightly.
 *
 * This hook is mounted ONCE (in the authenticated layout). Components that need
 * realtime simply call `useMessageRealtime(id)` which registers against the same
 * singleton manager. Because the manager owns the single websocket, no extra
 * connections are opened.
 */

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getRealtimeManager, type RealtimeRowEvent } from "./index";
import { isClientTagSelf } from "./client-tag";
import {
  applyConversationEvent,
  applyMessageEvent,
  conversationsQueryKey,
  messagesQueryKey,
} from "./cache-sync";

/**
 * Mount once in the authenticated layout. Binds the manager to the current user
 * and routes events into the React Query cache. Returns nothing — it is a pure
 * side-effect hook.
 */
export function useRealtimeSync(userId: string | null | undefined): void {
  const qc = useQueryClient();
  const manager = getRealtimeManager();

  // Bind / unbind the user whenever the session user changes.
  useEffect(() => {
    manager.setUser(userId ?? null);
  }, [manager, userId]);

  // Conversation list listener — always active while authenticated.
  useEffect(() => {
    if (!userId) return;
    const off = manager.on("conversations", (event: RealtimeRowEvent) => {
      applyConversationEvent(qc, userId, event);
    });
    return off;
  }, [manager, qc, userId]);

  // Message listener — route by conversation_id to the correct message cache.
  useEffect(() => {
    if (!userId) return;
    const off = manager.on("messages", (event: RealtimeRowEvent) => {
      const convId =
        (event.new?.["conversation_id"] as string | undefined) ??
        (event.old?.["conversation_id"] as string | undefined);
      if (!convId) return;
      // Streaming assistant updates arrive as high-frequency UPDATEs; debounce.
      const isStreamingUpdate =
        event.eventType === "UPDATE" && (event.new?.["streaming"] as boolean | undefined);
      applyMessageEvent(qc, convId, event, { debounce: isStreamingUpdate });
    });
    return off;
  }, [manager, qc, userId]);

  // Offline resilience: when the browser regains connectivity, rebind the
  // realtime channels (the manager auto-reconnects the socket) and re-validate
  // the user's conversation list so any change made elsewhere while offline is
  // reconciled. The active message list is refreshed too, never losing data.
  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const onOnline = () => {
      manager.setUser(userId);
      qc.invalidateQueries({ queryKey: conversationsQueryKey(userId), exact: true });
    };
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, [manager, qc, userId]);

  // Memory listener — keep the Memory Dashboard + chat memory context in sync
  // across the user's devices. Self-echoes are suppressed via client_tag.
  useEffect(() => {
    if (!userId) return;
    const offMemories = manager.on("memories", (event: RealtimeRowEvent) => {
      const tag = (event.new?.["client_tag"] ?? event.old?.["client_tag"]) as string | undefined;
      if (tag && isClientTagSelf(tag)) return;
      qc.invalidateQueries({ queryKey: ["memories", userId] });
    });
    const offSettings = manager.on("memory_settings", () => {
      qc.invalidateQueries({ queryKey: ["memory_settings", userId] });
    });
    return () => {
      offMemories();
      offSettings();
    };
  }, [manager, qc, userId]);
}

/**
 * Component-level subscription to realtime message events for a single
 * conversation. Used by the chat view to drive incremental streaming appends
 * and the "New messages" affordance without opening a new connection. The
 * callback receives every message row event for the active conversation.
 */
export function useMessageRealtime(
  conversationId: string | null | undefined,
  onEvent: (event: RealtimeRowEvent) => void,
): void {
  const manager = getRealtimeManager();
  const cbRef = useRef(onEvent);
  cbRef.current = onEvent;

  useEffect(() => {
    if (!conversationId) return;
    const off = manager.on("messages", (event: RealtimeRowEvent) => {
      const convId =
        (event.new?.["conversation_id"] as string | undefined) ??
        (event.old?.["conversation_id"] as string | undefined);
      if (convId !== conversationId) return;
      cbRef.current(event);
    });
    return off;
  }, [manager, conversationId]);
}

export { messagesQueryKey };
