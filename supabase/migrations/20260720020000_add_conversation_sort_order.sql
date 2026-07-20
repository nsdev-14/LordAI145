-- Add manual ordering to conversations so users can drag-to-reorder their chat
-- list (Notion-style). `sort_order` is a per-user, per-folder sort key: conversations
-- with the same `folder_id` (NULL = root / "No Folder") are ordered by this value.
-- Legacy rows default to NULL and are treated as "newest first" (see app logic).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS sort_order INTEGER;

CREATE INDEX IF NOT EXISTS conversations_user_folder_sort_idx
  ON public.conversations (user_id, folder_id, sort_order);
