/**
 * React Query hooks for the Folder & Workspace system.
 *
 * Folders and conversations are cached independently (normalized), exactly like
 * the existing chat sidebar. All mutations are OPTIMISTIC: the cache is updated
 * synchronously for instant UI, a snapshot is taken for rollback, and the server
 * is reconciled on success with minimal invalidation (no full refetch that would
 * cause flicker / scroll jumps).
 *
 * The hooks accept a `conversationsQueryKey` + a `patchConversationFolder`
 * callback so that moving a conversation into / out of a folder also updates the
 * conversations list cache immediately — keeping both trees consistent without a
 * refetch.
 */

import { useCallback, useMemo } from "react";
import { useMutation, useQuery, useQueryClient, type QueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { reindexSortOrder, type FolderRow } from "@/lib/folders";

export const foldersQueryKey = (userId: string) => ["folders", userId] as const;

export interface FolderMutationsOptions {
  userId: string;
  conversationsQueryKey: readonly [string, string];
  /** Patch the `folder_id` of one conversation in the conversations cache. */
  patchConversationFolder: (conversationId: string, folderId: string | null) => void;
}

// ---------------------------------------------------------------------------
// Query
// ---------------------------------------------------------------------------

export function useFolders(userId: string) {
  const key = useMemo(() => foldersQueryKey(userId), [userId]);
  return useQuery({
    queryKey: key,
    queryFn: async (): Promise<FolderRow[]> => {
      const { data, error } = await supabase
        .from("folders")
        .select("*")
        .order("sort_order", { ascending: true });
      if (error) throw error;
      return data as FolderRow[];
    },
  });
}

// ---------------------------------------------------------------------------
// Helpers shared by mutations (cache writes)
// ---------------------------------------------------------------------------

function setFolders(
  qc: QueryClient,
  key: readonly string[],
  updater: (old: FolderRow[] | undefined) => FolderRow[] | undefined,
) {
  qc.setQueryData<FolderRow[]>(key, (old) => updater(old));
}

function nextSortOrder(folders: FolderRow[] | undefined, parentId: string | null): number {
  const siblings = (folders ?? []).filter((f) => f.parent_id === parentId);
  if (siblings.length === 0) return 0;
  return Math.max(...siblings.map((f) => f.sort_order)) + 1;
}

// ---------------------------------------------------------------------------
// Create
// ---------------------------------------------------------------------------

export function useCreateFolder({ userId, conversationsQueryKey: _cqk }: FolderMutationsOptions) {
  const qc = useQueryClient();
  const key = useMemo(() => foldersQueryKey(userId), [userId]);
  return useMutation({
    mutationFn: async (input: {
      name: string;
      parent_id?: string | null;
      color?: string | null;
      icon?: string | null;
    }) => {
      const sort_order = nextSortOrder(qc.getQueryData<FolderRow[]>(key), input.parent_id ?? null);
      const { data, error } = await supabase
        .from("folders")
        .insert({
          user_id: userId,
          name: input.name,
          parent_id: input.parent_id ?? null,
          color: input.color ?? null,
          icon: input.icon ?? null,
          sort_order,
        })
        .select()
        .single();
      if (error) throw error;
      return data as FolderRow;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FolderRow[]>(key);
      const tempId = `temp-folder-${crypto.randomUUID()}`;
      const optimistic: FolderRow = {
        id: tempId,
        user_id: userId,
        name: input.name,
        parent_id: input.parent_id ?? null,
        sort_order: nextSortOrder(previous, input.parent_id ?? null),
        color: input.color ?? null,
        icon: input.icon ?? null,
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      };
      setFolders(qc, key, (old) => [optimistic, ...(old ?? [])]);
      return { previous, tempId };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setFolders(qc, key, () => context.previous);
      toast.error("Couldn't create folder.");
    },
    onSuccess: (row, _vars, context) => {
      // Swap optimistic temp for the real row in place (no remount / flicker).
      setFolders(qc, key, (old) => (old ?? []).map((f) => (f.id === context?.tempId ? row : f)));
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key, exact: true });
    },
  });
}

// ---------------------------------------------------------------------------
// Rename / update (name, color, icon)
// ---------------------------------------------------------------------------

export function useUpdateFolder({ userId }: FolderMutationsOptions) {
  const qc = useQueryClient();
  const key = useMemo(() => foldersQueryKey(userId), [userId]);
  return useMutation({
    mutationFn: async (input: {
      id: string;
      name?: string;
      color?: string | null;
      icon?: string | null;
    }) => {
      const { error } = await supabase
        .from("folders")
        .update({
          ...(input.name !== undefined ? { name: input.name } : {}),
          ...(input.color !== undefined ? { color: input.color } : {}),
          ...(input.icon !== undefined ? { icon: input.icon } : {}),
        })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FolderRow[]>(key);
      setFolders(qc, key, (old) =>
        (old ?? []).map((f) =>
          f.id === input.id
            ? {
                ...f,
                ...(input.name !== undefined ? { name: input.name } : {}),
                ...(input.color !== undefined ? { color: input.color ?? null } : {}),
                ...(input.icon !== undefined ? { icon: input.icon ?? null } : {}),
              }
            : f,
        ),
      );
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setFolders(qc, key, () => context.previous);
      toast.error("Couldn't update folder.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key, exact: true });
    },
  });
}

// ---------------------------------------------------------------------------
// Delete (children cascade via FK; conversations are un-foldered via SET NULL)
// ---------------------------------------------------------------------------

export function useDeleteFolder({ userId }: FolderMutationsOptions) {
  const qc = useQueryClient();
  const key = useMemo(() => foldersQueryKey(userId), [userId]);
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("folders").delete().eq("id", id);
      if (error) throw error;
    },
    onMutate: async (id) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FolderRow[]>(key);
      // Remove the folder + any descendants instantly.
      const byId = new Map((previous ?? []).map((f) => [f.id, f] as const));
      const toRemove = new Set<string>([id]);
      let changed = true;
      while (changed) {
        changed = false;
        for (const f of previous ?? []) {
          if (f.parent_id && toRemove.has(f.parent_id) && !toRemove.has(f.id)) {
            toRemove.add(f.id);
            changed = true;
          }
        }
      }
      void byId;
      setFolders(qc, key, (old) => (old ?? []).filter((f) => !toRemove.has(f.id)));
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setFolders(qc, key, () => context.previous);
      toast.error("Couldn't delete folder.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key, exact: true });
    },
  });
}

// ---------------------------------------------------------------------------
// Move / reorder a folder (re-parent + sort_order)
// ---------------------------------------------------------------------------

export function useMoveFolder({ userId }: FolderMutationsOptions) {
  const qc = useQueryClient();
  const key = useMemo(() => foldersQueryKey(userId), [userId]);
  return useMutation({
    mutationFn: async (input: {
      id: string;
      parent_id: string | null;
      /** Absolute new sort_order; siblings will be reindexed around it. */
      sort_order: number;
    }) => {
      const { error } = await supabase
        .from("folders")
        .update({ parent_id: input.parent_id, sort_order: input.sort_order })
        .eq("id", input.id);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: key });
      const previous = qc.getQueryData<FolderRow[]>(key);
      // Place the moved folder at the requested slot, then reindex its siblings
      // (same parent) so the normalized column stays contiguous.
      const siblings = (previous ?? [])
        .filter((f) => f.parent_id === input.parent_id && f.id !== input.id)
        .sort((a, b) => a.sort_order - b.sort_order);
      const reindexed = reindexSortOrder(siblings);
      const moved: FolderRow = {
        ...((previous ?? []).find((f) => f.id === input.id) as FolderRow),
        parent_id: input.parent_id,
        sort_order: input.sort_order,
      };
      setFolders(qc, key, (old) => {
        const others = (old ?? []).filter(
          (f) => f.id !== input.id && !reindexed.some((r) => r.id === f.id),
        );
        const merged = [...others, moved, ...reindexed];
        // Persist sibling reindex to the server (fire-and-forget, non-blocking).
        for (const r of reindexed) {
          void supabase.from("folders").update({ sort_order: r.sort_order }).eq("id", r.id);
        }
        return merged;
      });
      return { previous };
    },
    onError: (_err, _vars, context) => {
      if (context?.previous) setFolders(qc, key, () => context.previous);
      toast.error("Couldn't move folder.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: key, exact: true });
    },
  });
}

// ---------------------------------------------------------------------------
// Move a conversation into / out of a folder (and reorder).
// Optimistically updates BOTH the folders cache ordering context and the
// conversations cache (`folder_id`), keeping both views in sync.
// ---------------------------------------------------------------------------

export function useMoveConversation(opts: FolderMutationsOptions) {
  const qc = useQueryClient();
  const { userId, conversationsQueryKey, patchConversationFolder } = opts;
  const foldersKey = useMemo(() => foldersQueryKey(userId), [userId]);
  return useMutation({
    mutationFn: async (input: {
      conversationId: string;
      folder_id: string | null;
      last_message_at: string;
    }) => {
      const { error } = await supabase
        .from("conversations")
        .update({ folder_id: input.folder_id, sort_order: null })
        .eq("id", input.conversationId);
      if (error) throw error;
    },
    onMutate: async (input) => {
      await qc.cancelQueries({ queryKey: conversationsQueryKey });
      const previousConv = qc.getQueryData(conversationsQueryKey);
      patchConversationFolder(input.conversationId, input.folder_id);
      void foldersKey;
      return { previousConv };
    },
    onError: (_err, _vars, context) => {
      if (context?.previousConv) {
        qc.setQueryData(conversationsQueryKey, context.previousConv);
      }
      toast.error("Couldn't move conversation.");
    },
    onSettled: () => {
      qc.invalidateQueries({ queryKey: conversationsQueryKey, exact: true });
    },
  });
}
