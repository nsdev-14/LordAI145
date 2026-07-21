-- Fix: Add INSERT policy for groups table and auto-add creator to group_members

-- ============================================================================
-- 1. Add INSERT policy for groups table
-- ============================================================================

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Users can create groups" ON public.groups;
-- Allow authenticated users to insert a group only if they are the owner
CREATE POLICY "Users can create groups" ON public.groups FOR INSERT TO authenticated
  WITH CHECK (owner_id = auth.uid());
-- ============================================================================
-- 2. Create RPC function to create group and auto-add creator as owner
-- ============================================================================

CREATE OR REPLACE FUNCTION public.create_group_with_owner(
  p_name TEXT,
  p_description TEXT DEFAULT NULL,
  p_avatar_url TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_group_id UUID;
  v_user_id UUID;
BEGIN
  -- Get the current user ID
  v_user_id := auth.uid();
  
  -- Verify user is authenticated
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;
  
  -- Insert the group with the current user as owner
  INSERT INTO public.groups (name, description, avatar_url, owner_id)
  VALUES (p_name, p_description, p_avatar_url, v_user_id)
  RETURNING id INTO v_group_id;
  
  -- Automatically add the creator as owner in group_members
  INSERT INTO public.group_members (group_id, user_id, role)
  VALUES (v_group_id, v_user_id, 'owner');
  
  RETURN v_group_id;
END;
$$;
-- Grant execute permission to authenticated users
GRANT EXECUTE ON FUNCTION public.create_group_with_owner(TEXT, TEXT, TEXT) TO authenticated;
-- ============================================================================
-- 3. Add INSERT policy for group_members to allow the auto-insert
-- ============================================================================

-- Drop existing policy if it exists (idempotent)
DROP POLICY IF EXISTS "Users can insert own membership" ON public.group_members;
-- Allow users to be inserted as members (needed for the RPC function)
-- This policy allows insertion when the user is inserting themselves
CREATE POLICY "Users can insert own membership" ON public.group_members FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());
-- ============================================================================
-- End of migration
-- ============================================================================;
