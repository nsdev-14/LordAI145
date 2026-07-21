-- Chat Sharing system for LORD AI.
--
-- Lets a user generate a public, read-only link for one of their conversations.
-- Security model:
--   * A share is owned by the creator (created_by) and tied to ONE conversation.
--   * Only the conversation OWNER can create / revoke shares (enforced by RLS
--     using the existing per-user conversations RLS as the source of truth).
--   * Public reads go through a dedicated NO-AUTH API route that joins
--     conversation_shares -> conversations and returns ONLY the conversation
--     title + messages. It never returns user_id, email, or any PII.
--   * share_token is a cryptographically-random UUID (generated server-side via
--     gen_random_uuid()), so URLs cannot be enumerated or guessed.
--   * Revoking (DELETE) removes the row immediately, invalidating old URLs.
--   * expires_at (nullable) lets a share auto-expire; the read route rejects
--     expired shares.

CREATE TABLE IF NOT EXISTS public.conversation_shares (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  share_token  UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  created_by   UUID NOT NULL,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at   TIMESTAMPTZ,
  is_public    BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (conversation_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.conversation_shares TO authenticated;
GRANT ALL ON public.conversation_shares TO service_role;
ALTER TABLE public.conversation_shares ENABLE ROW LEVEL SECURITY;
-- Create / read / update / delete shares only for the owner's own shares.
CREATE POLICY "Users manage their own conversation shares"
  ON public.conversation_shares
  FOR ALL
  TO authenticated
  USING (auth.uid() = created_by)
  WITH CHECK (auth.uid() = created_by);
-- A created share must point at a conversation the creator owns. This blocks
-- sharing someone else's conversation even if a foreign conversation_id is sent.
CREATE POLICY "Share targets only own conversations"
  ON public.conversation_shares
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id AND c.user_id = auth.uid()
    )
  );
CREATE INDEX IF NOT EXISTS conversation_shares_token_idx
  ON public.conversation_shares (share_token);
CREATE INDEX IF NOT EXISTS conversation_shares_conv_idx
  ON public.conversation_shares (conversation_id);
-- Public, read-only accessor for a shared conversation. SECURITY DEFINER so it
-- runs with the function owner's privileges and BYPASSES row-level security on
-- conversations/messages. It performs its own checks:
--   * the share token exists,
--   * the share has not expired,
--   * is_public is true.
-- It returns ONLY the conversation title + messages — never user_id, email, or
-- any other PII — so anonymous viewers cannot learn anything about the owner.
-- An expired / missing / non-public share returns NULL, which the API maps to
-- 404 to avoid revealing whether a token is valid (anti-enumeration).
CREATE OR REPLACE FUNCTION public.get_shared_conversation(share_token UUID)
RETURNS TABLE (
  title TEXT,
  created_at TIMESTAMPTZ,
  message_id TEXT,
  role TEXT,
  content TEXT,
  message_created_at TIMESTAMPTZ
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    c.title,
    c.created_at,
    m.id::TEXT,
    m.role,
    m.content,
    m.created_at
  FROM public.conversation_shares s
  JOIN public.conversations c ON c.id = s.conversation_id
  JOIN public.messages m ON m.conversation_id = c.id
  WHERE s.share_token = get_shared_conversation.share_token
    AND s.is_public = true
    AND (s.expires_at IS NULL OR s.expires_at > now())
  ORDER BY m.created_at ASC, m.id ASC;
$$;
