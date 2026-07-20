/**
 * Singleton accessor for the app-wide RealtimeManager.
 *
 * A single instance is shared across the whole app so that all components
 * (chat, sidebar, dashboard) reuse the SAME websocket connection. The manager
 * is lazy-bound to the authenticated user — call `getRealtimeManager().setUser(...)`
 * once auth resolves (see `useRealtimeSync`).
 */

import { supabase } from "@/integrations/supabase/client";
import { RealtimeManager } from "./RealtimeManager";

let manager: RealtimeManager | null = null;

export function getRealtimeManager(): RealtimeManager {
  if (!manager) {
    manager = new RealtimeManager(supabase);
  }
  return manager;
}

export { RealtimeManager };
export type { RealtimeRowEvent, RealtimeTable, RealtimeEvent } from "./RealtimeManager";
