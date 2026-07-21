-- Add Pin / Favorite support to conversations so the optimistic sidebar can
-- persist these instantly (ChatGPT-style). Both default to false so existing
-- rows are unaffected. `pinned_at` preserves stable ordering within the Pinned
-- section (most-recently pinned first).
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS favorite BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS conversations_user_pinned_idx
  ON public.conversations (user_id, pinned DESC, pinned_at DESC);
