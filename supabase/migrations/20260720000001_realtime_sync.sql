-- Real-Time Conversation Sync support for LORD AI.
--
-- Enables Supabase Realtime on the two tables that drive the multi-device
-- experience (conversations + messages) so that changes made on one device are
-- pushed to every other device of the SAME authenticated user.
--
-- Security model:
--   * Both tables already have per-user RLS (auth.uid() = user_id). Realtime
--     replays ONLY rows the subscriber is allowed to see, so a user can never
--     receive another user's events.
--   * The application layer additionally filters every channel by `user_id`
--     (see RealtimeManager) as defense-in-depth, so even the websocket only
--     ever carries this user's rows.
--   * Subscriptions are created ONLY after authentication and torn down on
--     logout / unmount.
--
-- Streaming assistant responses:
--   * A `streaming` flag on messages marks an assistant message that is still
--     being generated on another device. The originating device INSERTs the
--     message row, then UPDATEs it with each appended token chunk. Other
--     devices receive those UPDATE events and append tokens incrementally
--     (never recreating the message list). When streaming finishes the flag is
--     cleared.

-- 1. Add a `streaming` flag to messages (false for historical rows).
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS streaming BOOLEAN NOT NULL DEFAULT false;
-- 2. Add a stable client-generated tag to conversations + messages so the
--    originating device can ignore its OWN realtime echoes (self-suppression).
--    `client_tag` is set on writes; the realtime listener drops events whose
--    tag matches a recently-sent write. NULL for writes it does not care about.
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS client_tag TEXT;
ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS client_tag TEXT;
CREATE INDEX IF NOT EXISTS messages_conversation_streaming_idx
  ON public.messages (conversation_id, streaming);
-- 3. Enable Realtime by adding the tables to the supabase_realtime publication.
--    `IF NOT EXISTS` guards make this idempotent / re-runnable.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'conversations'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.conversations;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'public'
      AND tablename = 'messages'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.messages;
  END IF;
END $$;
-- 4. Realtime replay respects RLS only when row security is enforced on the
--    publication. Ensure the tables are RLS-enabled (they already are, but be
--    explicit so this migration is self-contained).
ALTER TABLE public.conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.messages ENABLE ROW LEVEL SECURITY;
