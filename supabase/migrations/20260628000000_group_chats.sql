-- Create groups table
CREATE TABLE public.groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  name TEXT NOT NULL CHECK (char_length(name) BETWEEN 1 AND 200),
  description TEXT CHECK (char_length(description) <= 1000),
  avatar_url TEXT,
  is_archived BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Create group_members table
CREATE TABLE public.group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  last_seen_at TIMESTAMPTZ,
  is_typing BOOLEAN DEFAULT FALSE,
  last_typing_at TIMESTAMPTZ,
  UNIQUE(group_id, user_id)
);
-- Create group_messages table
CREATE TABLE public.group_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  user_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  content TEXT NOT NULL CHECK (char_length(content) BETWEEN 1 AND 100000),
  role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'assistant', 'system')),
  model TEXT,
  is_edited BOOLEAN DEFAULT FALSE,
  edited_at TIMESTAMPTZ,
  is_deleted BOOLEAN DEFAULT FALSE,
  deleted_at TIMESTAMPTZ,
  reply_to_id UUID REFERENCES public.group_messages(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Create group_message_attachments table
CREATE TABLE public.group_message_attachments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  file_path TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT NOT NULL,
  file_size BIGINT NOT NULL,
  uploaded_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
-- Create group_message_reactions table
CREATE TABLE public.group_message_reactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  emoji TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id, emoji)
);
-- Create group_read_receipts table
CREATE TABLE public.group_read_receipts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  read_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(message_id, user_id)
);
-- Create group_mentions table
CREATE TABLE public.group_mentions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  mentioned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_read BOOLEAN DEFAULT FALSE,
  read_at TIMESTAMPTZ
);
-- Create group_invites table
CREATE TABLE public.group_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  invited_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  token TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'rejected', 'expired')),
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);
-- Create group_pinned_messages table
CREATE TABLE public.group_pinned_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID NOT NULL REFERENCES public.groups(id) ON DELETE CASCADE,
  message_id UUID NOT NULL REFERENCES public.group_messages(id) ON DELETE CASCADE,
  pinned_by UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  pinned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(group_id, message_id)
);
-- Grants and RLS enablement
GRANT SELECT, INSERT, UPDATE, DELETE ON public.groups TO authenticated;
GRANT ALL ON public.groups TO service_role;
ALTER TABLE public.groups ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_members TO authenticated;
GRANT ALL ON public.group_members TO service_role;
ALTER TABLE public.group_members ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.group_messages TO authenticated;
GRANT ALL ON public.group_messages TO service_role;
ALTER TABLE public.group_messages ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.group_message_attachments TO authenticated;
GRANT ALL ON public.group_message_attachments TO service_role;
ALTER TABLE public.group_message_attachments ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.group_message_reactions TO authenticated;
GRANT ALL ON public.group_message_reactions TO service_role;
ALTER TABLE public.group_message_reactions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.group_read_receipts TO authenticated;
GRANT ALL ON public.group_read_receipts TO service_role;
ALTER TABLE public.group_read_receipts ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.group_mentions TO authenticated;
GRANT ALL ON public.group_mentions TO service_role;
ALTER TABLE public.group_mentions ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE ON public.group_invites TO authenticated;
GRANT ALL ON public.group_invites TO service_role;
ALTER TABLE public.group_invites ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, DELETE ON public.group_pinned_messages TO authenticated;
GRANT ALL ON public.group_pinned_messages TO service_role;
ALTER TABLE public.group_pinned_messages ENABLE ROW LEVEL SECURITY;
-- Policies
CREATE POLICY "Users can see their groups" ON public.groups FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = id AND user_id = auth.uid()));
CREATE POLICY "Only owner can update group" ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Only owner can delete group" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Users can see group members" ON public.group_members FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.group_members WHERE group_id = group_members.group_id AND user_id = auth.uid()));
CREATE POLICY "Users can update own typing status" ON public.group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can update members" ON public.group_members FOR UPDATE TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_members.group_id
    AND gm.user_id = auth.uid()
    AND gm.role IN ('owner', 'admin')
  ));
CREATE POLICY "Users can see group messages" ON public.group_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
  ));
CREATE POLICY "Users can insert group messages" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_messages.group_id AND gm.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own messages" ON public.group_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can see attachments" ON public.group_message_attachments FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members ON gm.group_id = group_members.group_id
    WHERE gm.id = message_id AND group_members.user_id = auth.uid()
  ));
CREATE POLICY "Users can see reactions" ON public.group_message_reactions FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members ON gm.group_id = group_members.group_id
    WHERE gm.id = message_id AND group_members.user_id = auth.uid()
  ));
CREATE POLICY "Users can add reactions" ON public.group_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions" ON public.group_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can see read receipts" ON public.group_read_receipts FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members ON gm.group_id = group_members.group_id
    WHERE gm.id = message_id AND group_members.user_id = auth.uid()
  ));
CREATE POLICY "Users can record read receipts" ON public.group_read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can see their mentions" ON public.group_mentions FOR SELECT TO authenticated
  USING (user_id = auth.uid() OR EXISTS (
    SELECT 1 FROM public.group_messages gm
    JOIN public.group_members ON gm.group_id = group_members.group_id
    WHERE gm.id = message_id AND group_members.user_id = auth.uid()
  ));
CREATE POLICY "Users can update own mentions" ON public.group_mentions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Users can see their invites" ON public.group_invites FOR SELECT TO authenticated
  USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Members can see pending invites" ON public.group_invites FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_invites.group_id AND gm.user_id = auth.uid()
  ));
CREATE POLICY "Users can see pinned messages" ON public.group_pinned_messages FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.group_members gm
    WHERE gm.group_id = group_pinned_messages.group_id AND gm.user_id = auth.uid()
  ));
-- Create indexes for performance
CREATE INDEX groups_owner_idx ON public.groups(owner_id);
CREATE INDEX groups_archived_idx ON public.groups(is_archived);
CREATE INDEX groups_created_idx ON public.groups(created_at DESC);
CREATE INDEX group_members_group_idx ON public.group_members(group_id);
CREATE INDEX group_members_user_idx ON public.group_members(user_id);
CREATE INDEX group_members_role_idx ON public.group_members(role);
CREATE INDEX group_pinned_message_idx ON public.group_pinned_messages(message_id);
CREATE INDEX group_reactions_user_idx ON public.group_message_reactions(user_id);
CREATE INDEX group_mentions_user_idx ON public.group_mentions(user_id, is_read);
CREATE INDEX group_invites_email_idx ON public.group_invites(email, status);
CREATE INDEX group_invites_group_idx ON public.group_invites(group_id);
CREATE INDEX group_pinned_group_idx ON public.group_pinned_messages(group_id);
-- Create trigger to update group updated_at
CREATE OR REPLACE FUNCTION public.update_group_timestamp() RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$ 
BEGIN 
  UPDATE public.groups SET updated_at = now() WHERE id = COALESCE(NEW.group_id, OLD.group_id);
  RETURN COALESCE(NEW, OLD); 
END; $$;
CREATE TRIGGER update_group_on_message AFTER INSERT ON public.group_messages FOR EACH ROW EXECUTE FUNCTION public.update_group_timestamp();
CREATE TRIGGER update_group_on_member_change AFTER INSERT OR UPDATE OR DELETE ON public.group_members FOR EACH ROW EXECUTE FUNCTION public.update_group_timestamp();
