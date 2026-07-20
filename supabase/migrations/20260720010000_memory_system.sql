-- Long-Term Memory system for LORD AI.
--
-- Extends the existing `memories` table with the fields required for a
-- ChatGPT-Memory-style experience:
--   * confidence   — 0..1 confidence that the statement is a durable fact worth
--                    remembering. Memories below the user's threshold are surfaced
--                    for confirmation rather than auto-saved.
--   * embedding    — a 1536-dim vector used for fast semantic retrieval. Stored
--                    as `vector` when pgvector is available; otherwise as `jsonb`
--                    so the app still runs on a plain Supabase Postgres instance.
--   * source       — how the memory was created ("auto" | "manual" | "imported").
--   * client_tag   — realtime self-echo suppression (see realtime/client-tag.ts).
--
-- Adds a `memory_settings` table (one row per user) that controls memory
-- behaviour: on/off, ask-before-save, auto-save, and the confidence threshold.
--
-- Both tables respect the existing per-user RLS model (auth.uid() = user_id).
-- Realtime is enabled so memory changes sync instantly across the user's devices.

-- 1. Extend the memories table ----------------------------------------------
ALTER TABLE public.memories
  ADD COLUMN IF NOT EXISTS confidence DOUBLE PRECISION NOT NULL DEFAULT 1.0,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'manual',
  ADD COLUMN IF NOT EXISTS embedding JSONB,
  ADD COLUMN IF NOT EXISTS client_tag TEXT;

-- Try to add a real vector column for true ANN search. If pgvector is not
-- installed this block is skipped and the app falls back to JSONB + client-side
-- cosine similarity (see src/lib/memory/embeddings.ts). Do NOT fail the whole
-- migration if the extension is unavailable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    CREATE EXTENSION IF NOT EXISTS vector;
  END IF;

  IF EXISTS (
    SELECT 1 FROM pg_extension WHERE extname = 'vector'
  ) THEN
    -- Add a typed vector column (nullable; filled lazily as memories are embedded).
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'embedding_vec'
    ) THEN
      ALTER TABLE public.memories ADD COLUMN embedding_vec vector(1536);
    END IF;
  END IF;
EXCEPTION WHEN OTHERS THEN
  -- pgvector unavailable or blocked — keep JSONB path. Log and continue.
  RAISE NOTICE 'pgvector not available, using JSONB embeddings: %', SQLERRM;
END $$;

CREATE INDEX IF NOT EXISTS memories_user_created_idx
  ON public.memories (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS memories_user_pinned_idx
  ON public.memories (user_id, pinned DESC, created_at DESC);
CREATE INDEX IF NOT EXISTS memories_user_category_idx
  ON public.memories (user_id, category);

-- 2. memory_settings table ----------------------------------------------------
CREATE TABLE IF NOT EXISTS public.memory_settings (
  user_id              UUID PRIMARY KEY,
  memory_enabled       BOOLEAN NOT NULL DEFAULT true,
  auto_save            BOOLEAN NOT NULL DEFAULT true,
  ask_before_save      BOOLEAN NOT NULL DEFAULT true,
  confidence_threshold DOUBLE PRECISION NOT NULL DEFAULT 0.65,
  updated_at           TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.memory_settings TO authenticated;
GRANT ALL ON public.memory_settings TO service_role;

ALTER TABLE public.memory_settings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own memory settings"
  ON public.memory_settings
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- 3. Re-point memories RLS to be explicit and add the client-level safety net.
--    The existing memories table already has RLS; tighten it so every operation
--    is scoped to the owner. If a policy of the same name already exists, drop
--    and recreate to be idempotent.
DROP POLICY IF EXISTS "Users manage their own memories" ON public.memories;
CREATE POLICY "Users manage their own memories"
  ON public.memories
  FOR ALL
  TO authenticated
  USING (auth.uid()::text = user_id::text)
  WITH CHECK (auth.uid()::text = user_id::text);

-- 4. Embedding search helper (used by the API route for fast semantic retrieval).
--    Falls back gracefully: if embedding_vec is present we use cosine distance,
--    otherwise the caller falls back to client-side ranking. Marked SECURITY
--    DEFINER-free and RLS-safe (it filters by user_id internally).
CREATE OR REPLACE FUNCTION public.match_memories(
  p_user_id UUID,
  p_embedding JSONB,
  p_limit INT DEFAULT 8,
  p_categories TEXT[] DEFAULT NULL
)
RETURNS TABLE (
  id UUID,
  content TEXT,
  category TEXT,
  pinned BOOLEAN,
  confidence DOUBLE PRECISION,
  similarity FLOAT
)
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
BEGIN
  -- Only use the vector path when pgvector is installed and the column exists.
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'memories' AND column_name = 'embedding_vec'
  ) THEN
    RETURN QUERY
    SELECT
      m.id,
      m.content,
      m.category,
      m.pinned,
      m.confidence,
      1 - (m.embedding_vec <=> (p_embedding #>> '{}')::vector) AS similarity
    FROM public.memories m
    WHERE m.user_id = p_user_id
      AND m.embedding_vec IS NOT NULL
      AND (p_categories IS NULL OR m.category = ANY(p_categories))
    ORDER BY m.embedding_vec <=> (p_embedding #>> '{}')::vector
    LIMIT p_limit;
  ELSE
    RETURN QUERY
    SELECT
      m.id,
      m.content,
      m.category,
      m.pinned,
      m.confidence,
      0.0::FLOAT AS similarity
    FROM public.memories m
    WHERE m.user_id = p_user_id
      AND (p_categories IS NULL OR m.category = ANY(p_categories))
    ORDER BY m.pinned DESC, m.created_at DESC
    LIMIT p_limit;
  END IF;
END;
$$;

-- 5. Enable Realtime for memories so changes sync across devices.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'memories'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memories;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'memory_settings'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.memory_settings;
  END IF;
END $$;

ALTER TABLE public.memories ENABLE ROW LEVEL SECURITY;
