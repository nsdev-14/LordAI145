-- Fix infinite recursion in RLS policies by using SECURITY DEFINER functions
-- This migration creates helper functions that bypass RLS to prevent circular policy evaluation

-- ============================================================================
-- Helper Functions (SECURITY DEFINER to bypass RLS)
-- ============================================================================

-- Check if a user is a member of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_member(group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = is_group_member.group_id
    AND group_members.user_id = auth.uid()
  );
$$;
-- Check if a user is an admin or owner of a group (bypasses RLS)
CREATE OR REPLACE FUNCTION public.is_group_admin(group_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS(
    SELECT 1 FROM public.group_members
    WHERE group_members.group_id = is_group_admin.group_id
    AND group_members.user_id = auth.uid()
    AND group_members.role IN ('owner', 'admin')
  );
$$;
-- Get all group IDs that a user is a member of (bypasses RLS)
CREATE OR REPLACE FUNCTION public.get_user_group_ids()
RETURNS SETOF UUID
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT group_id FROM public.group_members
  WHERE user_id = auth.uid();
$$;
-- ============================================================================
-- Drop old recursive policies
-- ============================================================================

DROP POLICY IF EXISTS "Users can see their groups" ON public.groups;
DROP POLICY IF EXISTS "Users can view groups with pending invites" ON public.groups;
DROP POLICY IF EXISTS "Only owner can update group" ON public.groups;
DROP POLICY IF EXISTS "Only owner can delete group" ON public.groups;
DROP POLICY IF EXISTS "Users can see group members" ON public.group_members;
DROP POLICY IF EXISTS "Users can update own typing status" ON public.group_members;
DROP POLICY IF EXISTS "Admins can update members" ON public.group_members;
DROP POLICY IF EXISTS "Users can see group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can insert group messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can update own messages" ON public.group_messages;
DROP POLICY IF EXISTS "Users can see attachments" ON public.group_message_attachments;
DROP POLICY IF EXISTS "Users can see reactions" ON public.group_message_reactions;
DROP POLICY IF EXISTS "Users can add reactions" ON public.group_message_reactions;
DROP POLICY IF EXISTS "Users can remove own reactions" ON public.group_message_reactions;
DROP POLICY IF EXISTS "Users can see read receipts" ON public.group_read_receipts;
DROP POLICY IF EXISTS "Users can record read receipts" ON public.group_read_receipts;
DROP POLICY IF EXISTS "Users can see their mentions" ON public.group_mentions;
DROP POLICY IF EXISTS "Users can update own mentions" ON public.group_mentions;
DROP POLICY IF EXISTS "Users can see their invites" ON public.group_invites;
DROP POLICY IF EXISTS "Members can see pending invites" ON public.group_invites;
DROP POLICY IF EXISTS "Users can see pinned messages" ON public.group_pinned_messages;
-- ============================================================================
-- Recreate policies using helper functions (NO RECURSION)
-- ============================================================================

-- ============================================================================
-- Groups table policies
-- ============================================================================

CREATE POLICY "Users can see their groups" ON public.groups FOR SELECT TO authenticated
  USING (public.is_group_member(id));
CREATE POLICY "Users can view groups with pending invites" ON public.groups FOR SELECT TO authenticated
  USING (id IN (
    SELECT group_id FROM public.group_invites 
    WHERE email = (SELECT email FROM public.profiles WHERE id = auth.uid() LIMIT 1)
    AND status = 'pending'
  ));
CREATE POLICY "Only owner can update group" ON public.groups FOR UPDATE TO authenticated
  USING (owner_id = auth.uid());
CREATE POLICY "Only owner can delete group" ON public.groups FOR DELETE TO authenticated
  USING (owner_id = auth.uid());
-- ============================================================================
-- Group members table policies
-- ============================================================================

CREATE POLICY "Users can see group members" ON public.group_members FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));
CREATE POLICY "Users can insert own membership" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid() AND public.is_group_member(group_id));
CREATE POLICY "Users can update own typing status" ON public.group_members FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
CREATE POLICY "Admins can update members" ON public.group_members FOR UPDATE TO authenticated
  USING (public.is_group_admin(group_id));
CREATE POLICY "Users can delete own membership" ON public.group_members FOR DELETE TO authenticated
  USING (user_id = auth.uid());
-- ============================================================================
-- Group messages table policies
-- ============================================================================

CREATE POLICY "Users can see group messages" ON public.group_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));
CREATE POLICY "Users can insert group messages" ON public.group_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_group_member(group_id) AND (user_id = auth.uid() OR user_id IS NULL));
CREATE POLICY "Users can update own messages" ON public.group_messages FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
-- ============================================================================
-- Group message attachments table policies
-- ============================================================================

CREATE POLICY "Users can see attachments" ON public.group_message_attachments FOR SELECT TO authenticated
  USING (message_id IN (
    SELECT id FROM public.group_messages
    WHERE public.is_group_member(group_id)
  ));
CREATE POLICY "Users can upload attachments to own messages" ON public.group_message_attachments FOR INSERT TO authenticated
  WITH CHECK (
    uploaded_by = auth.uid()
    AND message_id IN (
      SELECT id FROM public.group_messages WHERE user_id = auth.uid()
    )
  );
CREATE POLICY "Users can delete own attachments" ON public.group_message_attachments FOR DELETE TO authenticated
  USING (uploaded_by = auth.uid());
-- ============================================================================
-- Group message reactions table policies
-- ============================================================================

CREATE POLICY "Users can see reactions" ON public.group_message_reactions FOR SELECT TO authenticated
  USING (message_id IN (
    SELECT id FROM public.group_messages
    WHERE public.is_group_member(group_id)
  ));
CREATE POLICY "Users can add reactions" ON public.group_message_reactions FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can remove own reactions" ON public.group_message_reactions FOR DELETE TO authenticated
  USING (user_id = auth.uid());
-- ============================================================================
-- Group read receipts table policies
-- ============================================================================

CREATE POLICY "Users can see read receipts" ON public.group_read_receipts FOR SELECT TO authenticated
  USING (message_id IN (
    SELECT id FROM public.group_messages
    WHERE public.is_group_member(group_id)
  ));
CREATE POLICY "Users can record read receipts" ON public.group_read_receipts FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
CREATE POLICY "Users can update read receipts" ON public.group_read_receipts FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
-- ============================================================================
-- Group mentions table policies
-- ============================================================================

CREATE POLICY "Users can see their mentions" ON public.group_mentions FOR SELECT TO authenticated
  USING (
    user_id = auth.uid()
    OR message_id IN (
      SELECT id FROM public.group_messages
      WHERE public.is_group_member(group_id)
    )
  );
CREATE POLICY "Users can update own mentions" ON public.group_mentions FOR UPDATE TO authenticated
  USING (user_id = auth.uid());
-- ============================================================================
-- Group invites table policies
-- ============================================================================

CREATE POLICY "Users can see their invites" ON public.group_invites FOR SELECT TO authenticated
  USING (email = (SELECT email FROM public.profiles WHERE id = auth.uid()));
CREATE POLICY "Members can see pending invites for their groups" ON public.group_invites FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));
CREATE POLICY "Group members can create invites" ON public.group_invites FOR INSERT TO authenticated
  WITH CHECK (
    invited_by = auth.uid()
    AND public.is_group_admin(group_id)
  );
-- ============================================================================
-- Group pinned messages table policies
-- ============================================================================

CREATE POLICY "Users can see pinned messages" ON public.group_pinned_messages FOR SELECT TO authenticated
  USING (public.is_group_member(group_id));
CREATE POLICY "Group admins can pin messages" ON public.group_pinned_messages FOR INSERT TO authenticated
  WITH CHECK (public.is_group_admin(group_id));
CREATE POLICY "Group admins can unpin messages" ON public.group_pinned_messages FOR DELETE TO authenticated
  USING (public.is_group_admin(group_id));
-- ============================================================================
-- End of migration
-- ============================================================================;
