/**
 * useReorderConversations — drag-to-reorder persistence for the root (No Folder)
 * conversation list.
 *
 * Optimistic contract (matches the rest of the sidebar's mutations):
 *   • onMutate   — cancel in-flight refetches, snapshot the prior cache, then
 *                  rewrite `sort_order` for every root conversation in place so
 *                  the list re-renders instantly in the dropped arrangement.
 *   • mutationFn — persist the new `sort_order` for each moved conversation.
 *                  We UPSERT only the affected ids (not the whole list) to keep
 *                  the network payload small and idempotent. Self-echoes are
 *                  tagged with `client_tag` so other devices ignore them.
 *   • onError    — restore the exact previous snapshot (automatic rollback) and
 *                  surface a non-blocking toast with a retry action.
 *   • onSettled  — re-validate the conversations list so any concurrent change
 *                  (e.g. another device reordering) is reconciled, and emit the
 *                  dashboard event so other widgets stay consistent.
 *
 * Cross-device sync is handled by the existing realtime layer
 * (applyConversationEvent, server-wins on `updated_at`): when a sibling device
 * reorders, its UPDATE broadcasts arrive here and re-sort the list.
 */

import { useCallback } from "react";
import { useMutation, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { createClientTag, markClientTagSent } from "@/lib/realtime/client-tag";
import { emitDashboardEvent } from "@/lib/dashboard-service";
import type { ConversationRow } from "@/lib/conversation-grouping";

export interface ReorderConversationsOptions {
  userId: string;
  conversationsQueryKey: readonly [string, string];
}

function setConversations(
  qc: QueryClient,
  key: readonly string[],
  updater: (old: ConversationRow[] | undefined) => ConversationRow[] | undefined,
) {
  qc.setQueryData<ConversationRow[]>(key, (old) => updater(old));
}

export function useReorderConversations({
  userId,
  conversationsQueryKey,
}: ReorderConversationsOptions) {
  const qc = useQueryClient();

  const mutation = useMutation({
    mutationFn: async (input: { orderedIds: string[] }) => {
      // Persist contiguous sort_order values for the moved items only. Each row
      // is updated independently (fire-and-forget, awaited together) so the
      // payload stays small and idempotent. Self-echoes are tagged with
      // `client_tag` so sibling devices ignore them.
      const writes = input.orderedIds.map((id, index) => {
        const t = createClientTag();
        markClientTagSent(t);
        return supabase
          .from("conversations")
          .update({ sort_order: index, client_tag: t })
          .eq("id", id);
      });
      const results = await Promise.all(writes);
      const error = results.find((r) => r.error)?.error;
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: conversationsQueryKey });
      const previous = qc.getQueryData<ConversationRow[]>(conversationsQueryKey);

      // Apply the new order to root conversations in place. We only rewrite
      // sort_order for the ids that changed; non-root conversations (folder_id
      // != null) are left untouched so the folder trees keep their ordering.
      const newOrder = new Map(input.orderedIds.map((id, i) => [id, i]));
      setConversations(qc, conversationsQueryKey, (old) => {
        if (!old) return old;
        return old.map((c) => {
          const id = c.id as string;
          if (newOrder.has(id)) {
            return { ...c, sort_order: newOrder.get(id) };
          }
          return c;
        });
      });

      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) {
        qc.setQueryData(conversationsQueryKey, context.previous);
      }
      toast.error("Couldn't save the new order.", {
        description: "Tap to retry.",
        action: {
          label: "Retry",
          onClick: () => mutation.mutate(_vars),
        },
      });
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: conversationsQueryKey, exact: true });
      emitDashboardEvent("conversations");
    },
  });

  const reorder = useCallback(
    (vars: { orderedIds: string[] }) => mutation.mutate(vars),
    [mutation],
  );

  return { reorder, isPending: mutation.isPending };
}
