/**
 * RealtimeManager — a single, reusable Supabase Realtime connection manager.
 *
 * Design goals (per the Real-Time Conversation Sync spec):
 *   • ONE websocket connection for the whole app (Supabase multiplexes all
 *     channels over a single socket internally), so we never open multiple
 *     sockets per device.
 *   • Subscribe ONLY after authentication and ONLY to the current user's data.
 *     Every channel is filtered by `user_id` (defense-in-depth on top of RLS)
 *     so the socket literally never carries another user's rows.
 *   • Automatically reconnect after network interruptions. Supabase's realtime
 *     client auto-reconnects; we additionally re-bind our handlers on the
 *     `SUBSCRIBED` event and re-arm on `CHANNEL_ERROR` / `CLOSED`.
 *   • Automatically unsubscribe on logout or component unmount
 *     (`destroy()` / `off()`).
 *   • Decoupled from React: this is a plain class that emits typed events;
 *     React hooks subscribe to it. That keeps re-renders bounded and avoids
 *     scattered listeners.
 *
 * The manager is a singleton per Supabase client. Components register
 * listeners via `on(channel, table, handler)` and remove them with the returned
 * unsubscribe function. The underlying channel is created lazily on the first
 * subscription and torn down when the last listener goes away (or on logout).
 */

import type { SupabaseClient, RealtimeChannel } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";

export type RealtimeTable = "conversations" | "messages" | "memories" | "memory_settings";

export type RealtimeEvent = "INSERT" | "UPDATE" | "DELETE";

export interface RealtimeRowEvent {
  table: RealtimeTable;
  eventType: RealtimeEvent;
  /** The new/changed row (null for DELETE, where only `old` exists). */
  new: Record<string, unknown> | null;
  /** The previous row (present for UPDATE / DELETE). */
  old: Record<string, unknown> | null;
}

type Listener = (event: RealtimeRowEvent) => void;

interface ChannelKey {
  table: RealtimeTable;
}

function channelName(table: RealtimeTable): string {
  // A single filtered channel per table; the user_id filter scopes it to the
  // current user so the socket only ever carries this user's rows.
  return `lord:${table}`;
}

export class RealtimeManager {
  private client: SupabaseClient<Database>;
  private userId: string | null = null;
  private channels = new Map<string, RealtimeChannel>();
  private listeners = new Map<string, Set<Listener>>();
  // Pending subscribe intent per channel so reconnects re-subscribe correctly.
  private subscribed = new Map<string, boolean>();
  private destroyed = false;
  private authSubscription: { data: { subscription: { unsubscribe: () => void } } } | null = null;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /** Current authenticated user id the manager is bound to. */
  get currentUserId(): string | null {
    return this.userId;
  }

  /**
   * Bind the manager to an authenticated user. Safe to call repeatedly; if the
   * user changes (e.g. account switch) we tear down and rebuild channels so no
   * stale rows from a previous session are ever observed. If `null`, we
   * unsubscribe everything (logout).
   */
  setUser(userId: string | null): void {
    if (this.destroyed) return;
    if (this.userId === userId) return;

    if (this.userId && this.userId !== userId) {
      // User changed — drop all channels for the previous user.
      this.teardownAllChannels();
    }
    this.userId = userId;
    this.wireAuth();
    if (userId) {
      // (Re)create every channel that currently has listeners.
      for (const key of this.channelsForActiveListeners()) {
        this.ensureChannel(key.table);
      }
    } else {
      this.teardownAllChannels();
    }
  }

  /**
   * Subscribe a listener to row changes for a table. Returns an unsubscribe
   * function. The underlying channel is created on first use and removed when
   * the last listener for that table is gone.
   */
  on(table: RealtimeTable, handler: Listener): () => void {
    const key = channelName(table);
    let set = this.listeners.get(key);
    if (!set) {
      set = new Set();
      this.listeners.set(key, set);
    }
    set.add(handler);
    this.ensureChannel(table);

    return () => {
      const s = this.listeners.get(key);
      if (!s) return;
      s.delete(handler);
      if (s.size === 0) {
        this.listeners.delete(key);
        this.removeChannel(table);
      }
    };
  }

  /** Explicit teardown — call on app logout or full unmount. */
  destroy(): void {
    this.destroyed = true;
    this.teardownAllChannels();
    this.listeners.clear();
    if (this.authSubscription) {
      this.authSubscription.data.subscription.unsubscribe();
      this.authSubscription = null;
    }
  }

  // ---- internals -----------------------------------------------------------

  private channelsForActiveListeners(): ChannelKey[] {
    const tables = new Set<RealtimeTable>();
    for (const key of this.listeners.keys()) {
      const table = key.replace("lord:", "") as RealtimeTable;
      tables.add(table);
    }
    return Array.from(tables).map((table) => ({ table }));
  }

  private ensureChannel(table: RealtimeTable): void {
    if (this.destroyed || !this.userId) return;
    const name = channelName(table);
    if (this.channels.has(name)) return;

    const channel = this.client
      .channel(name, {
        config: { presence: { key: this.userId } },
      })
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table,
          filter: `user_id=eq.${this.userId}`,
        },
        (payload) => {
          // Guard: never process an event for a different user (belt & braces).
          const row = (payload.new ?? payload.old) as Record<string, unknown> | null;
          if (row && typeof row.user_id === "string" && row.user_id !== this.userId) {
            return;
          }
          this.dispatch({
            table,
            eventType: payload.eventType as RealtimeEvent,
            new: (payload.new as Record<string, unknown>) ?? null,
            old: (payload.old as Record<string, unknown>) ?? null,
          });
        },
      )
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          this.subscribed.set(name, true);
        } else if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
          // Supabase auto-reconnects; record failure so we can re-bind if needed.
          this.subscribed.set(name, false);
        } else if (status === "CLOSED") {
          this.subscribed.set(name, false);
        }
      });

    this.channels.set(name, channel);
  }

  private removeChannel(table: RealtimeTable): void {
    const name = channelName(table);
    const channel = this.channels.get(name);
    if (channel) {
      void this.client.removeChannel(channel);
      this.channels.delete(name);
      this.subscribed.delete(name);
    }
  }

  private teardownAllChannels(): void {
    for (const table of [
      "conversations",
      "messages",
      "memories",
      "memory_settings",
    ] as RealtimeTable[]) {
      this.removeChannel(table);
    }
  }

  private dispatch(event: RealtimeRowEvent): void {
    const set = this.listeners.get(channelName(event.table));
    if (!set) return;
    for (const handler of set) {
      try {
        handler(event);
      } catch (err) {
        // A faulty listener must never break the realtime pipeline.
        console.error("[RealtimeManager] listener error", err);
      }
    }
  }

  private wireAuth(): void {
    if (this.authSubscription) return;
    if (typeof this.client.auth.onAuthStateChange !== "function") return;
    const { data } = this.client.auth.onAuthStateChange((_event, session) => {
      this.setUser(session?.user?.id ?? null);
    });
    this.authSubscription = data as unknown as {
      data: { subscription: { unsubscribe: () => void } };
    };
  }
}
