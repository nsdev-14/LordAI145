DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'chat_id'
  ) AND NOT EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'messages'
      AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE public.messages RENAME COLUMN chat_id TO conversation_id;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM pg_constraint
    WHERE conname = 'messages_chat_id_fkey'
      AND conrelid = 'public.messages'::regclass
  ) THEN
    ALTER TABLE public.messages
      RENAME CONSTRAINT messages_chat_id_fkey TO messages_conversation_id_fkey;
  END IF;
END $$;

ALTER INDEX IF EXISTS messages_chat_created_idx RENAME TO messages_conversation_created_idx;

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
