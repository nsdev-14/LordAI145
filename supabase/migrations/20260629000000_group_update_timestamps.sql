-- Create a reusable trigger function to update updated_at timestamps
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS trigger AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
-- Attach the trigger to groups so updated_at is maintained automatically
CREATE TRIGGER set_groups_updated_at
BEFORE UPDATE ON public.groups
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at();
-- Add helpful indexes for invite lookups and group membership queries
CREATE INDEX IF NOT EXISTS group_invites_email_idx ON public.group_invites(email);
CREATE INDEX IF NOT EXISTS group_messages_group_id_idx ON public.group_messages(group_id);
CREATE INDEX IF NOT EXISTS group_read_receipts_user_idx ON public.group_read_receipts(user_id);
CREATE INDEX IF NOT EXISTS group_mention_user_idx ON public.group_mentions(user_id);
