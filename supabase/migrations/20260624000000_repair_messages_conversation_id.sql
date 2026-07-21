ALTER TABLE public.messages
  ADD COLUMN IF NOT EXISTS conversation_id UUID;
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_conversation_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      ADD CONSTRAINT messages_conversation_id_fkey
      FOREIGN KEY (conversation_id)
      REFERENCES public.conversations(id)
      ON DELETE CASCADE;
  END IF;
END $$;
CREATE INDEX IF NOT EXISTS messages_conversation_created_idx
  ON public.messages(conversation_id, created_at);
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM public.messages
    WHERE conversation_id IS NULL
  ) THEN
    ALTER TABLE public.messages
      ALTER COLUMN conversation_id SET NOT NULL;
  END IF;
END $$;
DROP POLICY IF EXISTS "Users manage their own messages" ON public.messages;
CREATE POLICY "Users manage their own messages"
  ON public.messages
  FOR ALL
  TO authenticated
  USING (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
    )
  )
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM public.conversations c
      WHERE c.id = conversation_id
        AND c.user_id = auth.uid()
    )
  );
