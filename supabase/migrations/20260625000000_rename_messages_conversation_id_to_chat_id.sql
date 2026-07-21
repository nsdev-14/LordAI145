-- Rename the legacy conversation_id column to chat_id for message persistence
ALTER TABLE public.messages RENAME COLUMN conversation_id TO chat_id;
-- Keep names aligned with the new column name.
ALTER TABLE public.messages RENAME CONSTRAINT messages_conversation_id_fkey TO messages_chat_id_fkey;
ALTER INDEX IF EXISTS messages_conversation_created_idx RENAME TO messages_chat_created_idx;
