import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/use-current-user";
import {
  aggregateStats,
  computeAllConversationStats,
  type AggregateStats,
  type ConversationStat,
  type DayActivityPoint,
  type RawConversation,
  type RawMessage,
} from "@/lib/conversation-stats";

// Stable empty references so `useMemo` dependencies don't churn identity every
// render (mirrors the chat page's EMPTY_* pattern that prevents render loops).
const EMPTY_CONVERSATIONS: RawConversation[] = [];
const EMPTY_MESSAGES: RawMessage[] = [];

const POLL_MS = 60_000;

/**
 * Efficient conversation-statistics loader.
 *
 * Performance characteristics:
 *   - Exactly TWO queries total (conversations + messages, both scoped to the
 *     user via RLS). No N+1 per-conversation fetches.
 *   - The expensive aggregations (token/cost/response-time math, day bucketing)
 *     are computed once per data change inside `useMemo`, never per render.
 *   - Memoization keys on the *query data identity*, so React Query's stable
 *     references keep recomputation bounded.
 */
export function useConversationStats() {
  const { user } = useCurrentUser();
  const userId = user?.id ?? null;

  const conversationsQuery = useQuery({
    queryKey: ["stats", "conversations", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("conversations")
        .select("id, title, created_at, updated_at, last_message_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RawConversation[];
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: POLL_MS,
  });

  const messagesQuery = useQuery({
    queryKey: ["stats", "messages", userId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("messages")
        .select("id, conversation_id, role, content, model, created_at")
        .order("created_at", { ascending: true });
      if (error) throw error;
      return (data ?? []) as RawMessage[];
    },
    enabled: !!userId,
    staleTime: 30_000,
    refetchInterval: POLL_MS,
  });

  const conversations = conversationsQuery.data ?? EMPTY_CONVERSATIONS;
  const messages = messagesQuery.data ?? EMPTY_MESSAGES;

  const perConversation = useMemo<ConversationStat[]>(
    () => computeAllConversationStats(conversations, messages),
    [conversations, messages],
  );

  const { aggregate, dayActivity } = useMemo<{
    aggregate: AggregateStats;
    dayActivity: DayActivityPoint[];
  }>(() => aggregateStats(conversations, messages), [conversations, messages]);

  return {
    userId,
    isLoading: conversationsQuery.isLoading || messagesQuery.isLoading,
    isError: conversationsQuery.isError || messagesQuery.isError,
    refetch: () => {
      void conversationsQuery.refetch();
      void messagesQuery.refetch();
    },
    conversations,
    messages,
    perConversation,
    aggregate,
    dayActivity,
  };
}
