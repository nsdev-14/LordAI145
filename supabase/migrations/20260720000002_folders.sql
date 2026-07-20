-- Folder & Workspace system for LORD AI.
--
-- Adds a self-referencing `folders` table (up to 3 levels deep) and a
-- `folder_id` pointer on `conversations` so chats can live inside (or outside)
-- folders. Everything respects the existing per-user RLS model:
--   * folders   -> auth.uid() = user_id
--   * conversations.folder_id is already covered by the existing
--     "Users manage their own conversations" policy (it filters on user_id).
--
-- Ordering is normalized: `sort_order` (real) on both tables drives display
-- order. The application keeps values contiguous but the column is just a
-- stable sort key, so misaligned values never break correctness.

-- 1. Folders table ---------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.folders (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL,
  name        TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 60),
  parent_id   UUID REFERENCES public.folders(id) ON DELETE CASCADE,
  sort_order  DOUBLE PRECISION NOT NULL DEFAULT 0,
  color       TEXT,
  icon        TEXT,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.folders TO authenticated;
GRANT ALL ON public.folders TO service_role;

ALTER TABLE public.folders ENABLE ROW LEVEL SECURITY;

-- Users can only see / modify their own folders. The WITH CHECK clause blocks
-- inserting a folder whose user_id is not the caller's.
CREATE POLICY "Users manage their own folders"
  ON public.folders
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Prevent cross-user reparenting: a folder's parent (if any) must also belong
-- to the same user. This is enforced at write time and complements the app's
-- client-side 3-level nesting limit.
CREATE POLICY "Folder parent belongs to same user"
  ON public.folders
  FOR INSERT
  TO authenticated
  WITH CHECK (
    parent_id IS NULL
    OR EXISTS (
      SELECT 1 FROM public.folders p
      WHERE p.id = parent_id AND p.user_id = auth.uid()
    )
  );

CREATE INDEX IF NOT EXISTS folders_user_parent_idx
  ON public.folders (user_id, parent_id, sort_order);

-- 2. conversations.folder_id ----------------------------------------------
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS folder_id UUID REFERENCES public.folders(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS conversations_user_folder_idx
  ON public.conversations (user_id, folder_id, last_message_at DESC);

-- 3. updated_at trigger (folders) ------------------------------------------
CREATE OR REPLACE FUNCTION public.set_folders_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS set_folders_updated_at ON public.folders;
CREATE TRIGGER set_folders_updated_at
  BEFORE UPDATE ON public.folders
  FOR EACH ROW
  EXECUTE FUNCTION public.set_folders_updated_at();
